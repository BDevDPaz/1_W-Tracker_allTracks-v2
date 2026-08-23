// ============================================================
// SERVICE: DatabaseService — Capa de persistencia SQLite
// Versión: 2.2.0 (Workday Tracking Platform - Consolidado)
// Fuente: Matriz de Resiliencia — SQLite + WAL + Relaciones
// Responsabilidad: Motor de BBDD, Migraciones en Caliente, y Repositorios
// ============================================================

import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type {
  Break,
  DestinationVisit,
  ISessionRepository,
  Session,
  TimelineEvent,
  Transfer,
  WeeklySummary,
} from '../../types/contracts';

// ── 1. HELPERS INTERNOS DE TIEMPO Y MIGRACIÓN EN CALIENTE ───

function parseHHMMToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function calcDurationMinutes(start: string, end: string | null | undefined): number {
  if (!start || !end) return 0;
  let diff = parseHHMMToMinutes(end) - parseHHMMToMinutes(start);
  if (diff < 0) diff += 1440;
  return diff;
}

interface SQLiteTableColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

async function columnExists(db: SQLite.SQLiteDatabase, tableName: string, columnName: string): Promise<boolean> {
  const columns = await db.getAllAsync<SQLiteTableColumn>(`PRAGMA table_info(${tableName})`);
  return columns.some((column) => column.name === columnName);
}

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  definition: string
): Promise<void> {
  const exists = await columnExists(db, tableName, columnName);
  if (exists) return;

  await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  console.info(`[Database Migration] Added ${tableName}.${columnName}`);
}

async function migrateSettingsTable(db: SQLite.SQLiteDatabase): Promise<void> {
  await addColumnIfMissing(db, 'settings', 'multi_destination', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'settings', 'paid_transfers', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing(db, 'settings', 'destination_limit', 'INTEGER NOT NULL DEFAULT 5');
  await addColumnIfMissing(db, 'settings', 'has_completed_onboarding', 'INTEGER NOT NULL DEFAULT 0');
}

async function migrateIntegrityTypes(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(`
    UPDATE sessions
    SET integrity_type = 'VALID'
    WHERE integrity_type IS NULL
       OR TRIM(integrity_type) = ''
       OR integrity_type = 'GPS';
  `);
}

// ── 2. ESQUEMA DDL (DATA DEFINITION LANGUAGE) ───────────────

export const DB_SCHEMA = `
  -- Tabla principal de jornadas (WorkDays V2.2.0)
  CREATE TABLE IF NOT EXISTS sessions (
    id                       TEXT PRIMARY KEY NOT NULL,
    date                     TEXT NOT NULL,
    destination              TEXT NOT NULL,
    alias                    TEXT,
    start_time               TEXT NOT NULL,
    end_time                 TEXT,
    total_hours              REAL NOT NULL DEFAULT 0,
    lunch_deducted_minutes   INTEGER NOT NULL DEFAULT 0,
    overtime_hours           REAL NOT NULL DEFAULT 0,
    snapshot_rate            REAL NOT NULL DEFAULT 20,
    total_earnings           REAL NOT NULL DEFAULT 0,
    integrity_type           TEXT NOT NULL DEFAULT 'VALID',
    notes                    TEXT,
    state                    TEXT NOT NULL DEFAULT 'NO_INICIADA',
    paid_minutes             INTEGER NOT NULL DEFAULT 0,
    pause_minutes            INTEGER NOT NULL DEFAULT 0,
    transfer_minutes         INTEGER NOT NULL DEFAULT 0,
    destination_count        INTEGER NOT NULL DEFAULT 1,
    _lat                     REAL,
    _lng                     REAL,
    _device_status           TEXT,
    created_at               TEXT NOT NULL,
    updated_at               TEXT NOT NULL
  );

  -- Tabla de destinos visitados (V2.2.0 Relacional)
  CREATE TABLE IF NOT EXISTS destination_visits (
    id           TEXT PRIMARY KEY NOT NULL,
    session_id   TEXT NOT NULL,
    destination  TEXT NOT NULL,
    alias        TEXT,
    enter_time   TEXT NOT NULL,
    exit_time    TEXT,
    lat          REAL,
    lng          REAL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- Tabla de traslados entre destinos (V2.2.0 Relacional)
  CREATE TABLE IF NOT EXISTS transfers (
    id                  TEXT PRIMARY KEY NOT NULL,
    session_id          TEXT NOT NULL,
    origin_destination  TEXT NOT NULL,
    target_destination  TEXT NOT NULL,
    start_time          TEXT NOT NULL,
    end_time            TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- Tabla de descansos / almuerzos (V2.2.0 Relacional)
  CREATE TABLE IF NOT EXISTS breaks (
    id                TEXT PRIMARY KEY NOT NULL,
    session_id        TEXT NOT NULL,
    start_time        TEXT NOT NULL,
    end_time          TEXT,
    duration_minutes  INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- Hitos de cada sesión para auditoría forense
  CREATE TABLE IF NOT EXISTS timeline_events (
    id            TEXT PRIMARY KEY NOT NULL,
    session_id    TEXT NOT NULL,
    timestamp     TEXT NOT NULL,
    description   TEXT NOT NULL,
    status        TEXT NOT NULL,
    sequence      INTEGER NOT NULL,
    metadata      TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- Write-Ahead Log para resiliencia ante cierres inesperados
  CREATE TABLE IF NOT EXISTS wal_log (
    id          TEXT PRIMARY KEY NOT NULL,
    session_id  TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    synced      INTEGER NOT NULL DEFAULT 0
  );

  -- Configuración del usuario: 1 fila canónica (V2.2.0)
  CREATE TABLE IF NOT EXISTS settings (
    id                       TEXT PRIMARY KEY NOT NULL DEFAULT 'user_settings',
    name                     TEXT NOT NULL DEFAULT '',
    hourly_rate              REAL NOT NULL DEFAULT 20,
    report_email             TEXT NOT NULL DEFAULT '',
    base_work_hour           TEXT NOT NULL DEFAULT '06:00',
    overtime_multiplier      REAL NOT NULL DEFAULT 1.5,
    lunch_discount_minutes   INTEGER NOT NULL DEFAULT 30,
    geofence_radius          INTEGER NOT NULL DEFAULT 100,
    daily_reminder           INTEGER NOT NULL DEFAULT 1,
    workday_alerts           INTEGER NOT NULL DEFAULT 1,
    report_ready             INTEGER NOT NULL DEFAULT 1,
    language                 TEXT NOT NULL DEFAULT 'es',
    multi_destination        INTEGER NOT NULL DEFAULT 0,
    paid_transfers           INTEGER NOT NULL DEFAULT 1,
    destination_limit        INTEGER NOT NULL DEFAULT 5,
    has_completed_onboarding INTEGER NOT NULL DEFAULT 0,
    updated_at               TEXT NOT NULL
  );

  -- Índices para optimización de rendimiento
  CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
  CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
  CREATE INDEX IF NOT EXISTS idx_wal_synced ON wal_log(synced);
  CREATE INDEX IF NOT EXISTS idx_timeline_session ON timeline_events(session_id);
  CREATE INDEX IF NOT EXISTS idx_visits_session ON destination_visits(session_id);
  CREATE INDEX IF NOT EXISTS idx_transfers_session ON transfers(session_id);
  CREATE INDEX IF NOT EXISTS idx_breaks_session ON breaks(session_id);
`;

// ── 3. SERVICIO PRINCIPAL DE BASE DE DATOS ──────────────────

export class DatabaseService {
  private static db: SQLite.SQLiteDatabase | null = null;

  static async initialize(): Promise<void> {
    if (this.db) return;

    const db = await SQLite.openDatabaseAsync('w-tracker.db');

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);

    await db.execAsync(DB_SCHEMA);
    await migrateSettingsTable(db);
    await migrateIntegrityTypes(db);

    this.db = db;
  }

  static getDb(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('DatabaseService no ha sido inicializado. Ejecuta DatabaseService.initialize() previamente.');
    }
    return this.db;
  }

  static getDB(): SQLite.SQLiteDatabase {
    return this.getDb();
  }

  async initDB(): Promise<void> {
    await DatabaseService.initialize();
  }

  getDb(): SQLite.SQLiteDatabase {
    return DatabaseService.getDb();
  }

  getDB(): SQLite.SQLiteDatabase {
    return DatabaseService.getDb();
  }

  async close(): Promise<void> {
    DatabaseService.db = null;
  }
}

// ── 4. IMPLEMENTACIÓN DEL REPOSITORIO DE SESIONES ───────────

export class SessionRepository implements ISessionRepository {
  private async getDatabase(): Promise<SQLite.SQLiteDatabase> {
    return DatabaseService.getDb();
  }

  async appendWALEntry(sessionId: string, eventType: string, payload: any): Promise<void> {
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO wal_log (id, session_id, event_type, payload, created_at, synced) VALUES (?, ?, ?, ?, ?, 0)`,
      [Crypto.randomUUID(), sessionId, eventType, JSON.stringify(payload), new Date().toISOString()]
    );
  }

  async getAll(): Promise<Session[]> {
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<any>('SELECT * FROM sessions ORDER BY date DESC, start_time DESC');
    const sessions: Session[] = [];
    for (const row of rows) {
      sessions.push(await this._hydrateSession(database, row));
    }
    return sessions;
  }

  async getById(id: string): Promise<Session | null> {
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<any>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!row) return null;
    return this._hydrateSession(database, row);
  }

  async getActive(): Promise<Session | null> {
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<any>(`
      SELECT *
      FROM sessions
      WHERE state != 'CERRADA' AND state != 'NO_INICIADA'
        AND (end_time IS NULL OR end_time = '')
      ORDER BY start_time DESC
      LIMIT 1
    `);
    if (!row) return null;
    return this._hydrateSession(database, row);
  }

  async getByPeriod(startDate: string, endDate: string): Promise<Session[]> {
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<any>(
      'SELECT * FROM sessions WHERE date >= ? AND date <= ? ORDER BY date DESC, start_time DESC',
      [startDate, endDate]
    );
    const sessions: Session[] = [];
    for (const row of rows) {
      sessions.push(await this._hydrateSession(database, row));
    }
    return sessions;
  }

  async create(sessionData: Session): Promise<Session> {
    const database = await this.getDatabase();
    const now = new Date().toISOString();

    const integrity = sessionData.integrityType === 'GPS' ? 'VALID' : (sessionData.integrityType ?? 'VALID');
    const dest = sessionData.destination || (sessionData.visits && sessionData.visits[0]?.destination) || 'Principal';

    await database.runAsync(
      `INSERT INTO sessions (
        id, date, destination, alias, start_time, end_time, total_hours,
        lunch_deducted_minutes, overtime_hours, snapshot_rate, total_earnings,
        integrity_type, notes, state, paid_minutes, pause_minutes, transfer_minutes,
        destination_count, _lat, _lng, _device_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionData.id,
        sessionData.date,
        dest,
        sessionData.alias || null,
        sessionData.startTime,
        sessionData.endTime || null,
        sessionData.totalHours ?? 0,
        sessionData.lunchDeductedMinutes ?? sessionData.pauseMinutes ?? 0,
        sessionData.overtimeHours ?? 0,
        sessionData.snapshotRate ?? 20,
        sessionData.totalEarnings ?? 0,
        integrity,
        sessionData.notes || null,
        sessionData.state,
        sessionData.paidMinutes ?? (sessionData as any).paid_minutes ?? 0,
        sessionData.pauseMinutes ?? (sessionData as any).pause_minutes ?? 0,
        sessionData.transferMinutes ?? (sessionData as any).transfer_minutes ?? 0,
        sessionData.destinationCount ?? (sessionData as any).destination_count ?? 1,
        sessionData._lat || null,
        sessionData._lng || null,
        sessionData._deviceStatus || null,
        sessionData.createdAt || now,
        sessionData.updatedAt || now,
      ]
    );

    const timeline = sessionData.timelineEvents || sessionData.timeline;
    if (timeline?.length) await this._replaceTimelineEvents(database, sessionData.id, timeline);
    if (sessionData.visits?.length) await this._replaceVisits(database, sessionData.id, sessionData.visits);
    if (sessionData.transfers?.length) await this._replaceTransfers(database, sessionData.id, sessionData.transfers);
    if (sessionData.breaks?.length) await this._replaceBreaks(database, sessionData.id, sessionData.breaks);

    const created = await this.getById(sessionData.id);
    if (!created) throw new Error(`Error recuperando sesión creada: ${sessionData.id}`);
    return created;
  }

  async update(id: string, patch: Partial<Session>): Promise<Session> {
    const database = await this.getDatabase();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: any[] = [];

    if (patch.date !== undefined) { fields.push('date = ?'); values.push(patch.date); }
    if (patch.destination !== undefined) { fields.push('destination = ?'); values.push(patch.destination); }
    if (patch.alias !== undefined) { fields.push('alias = ?'); values.push(patch.alias || null); }
    if (patch.startTime !== undefined) { fields.push('start_time = ?'); values.push(patch.startTime); }
    if (patch.endTime !== undefined) { fields.push('end_time = ?'); values.push(patch.endTime || null); }
    if (patch.totalHours !== undefined) { fields.push('total_hours = ?'); values.push(patch.totalHours); }
    if (patch.lunchDeductedMinutes !== undefined) { fields.push('lunch_deducted_minutes = ?'); values.push(patch.lunchDeductedMinutes); }
    if (patch.overtimeHours !== undefined) { fields.push('overtime_hours = ?'); values.push(patch.overtimeHours); }
    if (patch.totalEarnings !== undefined) { fields.push('total_earnings = ?'); values.push(patch.totalEarnings); }

    if (patch.integrityType !== undefined) {
      fields.push('integrity_type = ?');
      values.push(patch.integrityType === 'GPS' ? 'VALID' : patch.integrityType);
    }

    if (patch.notes !== undefined) { fields.push('notes = ?'); values.push(patch.notes || null); }
    if (patch.state !== undefined) { fields.push('state = ?'); values.push(patch.state); }
    if (patch._lat !== undefined) { fields.push('_lat = ?'); values.push(patch._lat || null); }
    if (patch._lng !== undefined) { fields.push('_lng = ?'); values.push(patch._lng || null); }
    if (patch._deviceStatus !== undefined) { fields.push('_device_status = ?'); values.push(patch._deviceStatus || null); }

    if (patch.paidMinutes !== undefined) { fields.push('paid_minutes = ?'); values.push(patch.paidMinutes); }
    if (patch.pauseMinutes !== undefined) { fields.push('pause_minutes = ?'); values.push(patch.pauseMinutes); }
    if (patch.transferMinutes !== undefined) { fields.push('transfer_minutes = ?'); values.push(patch.transferMinutes); }
    if (patch.destinationCount !== undefined) { fields.push('destination_count = ?'); values.push(patch.destinationCount); }

    fields.push('updated_at = ?');
    values.push(now);

    if (fields.length > 0) {
      values.push(id);
      await database.runAsync(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const timeline = patch.timelineEvents || patch.timeline;
    if (timeline !== undefined) await this._replaceTimelineEvents(database, id, timeline);
    if (patch.visits !== undefined) await this._replaceVisits(database, id, patch.visits);
    if (patch.transfers !== undefined) await this._replaceTransfers(database, id, patch.transfers);
    if (patch.breaks !== undefined) await this._replaceBreaks(database, id, patch.breaks);

    const updated = await this.getById(id);
    if (!updated) throw new Error(`Error recuperando sesión actualizada: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const database = await this.getDatabase();
    await database.runAsync('DELETE FROM sessions WHERE id = ?', [id]);
  }

  async getWeeklySummary(weekStart: string, weekEnd: string): Promise<WeeklySummary> {
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<any>(
      `SELECT * FROM sessions WHERE date >= ? AND date <= ? AND state = 'CERRADA'`,
      [weekStart, weekEnd]
    );

    let totalHours = 0;
    let totalEarnings = 0;
    let manualAdjustments = 0;
    let overtimeHours = 0;
    let baseEarnings = 0;
    let overtimeEarnings = 0;
    let paidMinutesSum = 0;
    let transfersSum = 0;

    const settingsRow = await database.getFirstAsync<any>("SELECT hourly_rate, overtime_multiplier FROM settings WHERE id = 'user_settings'");
    const baseRate = settingsRow ? Number(settingsRow.hourly_rate ?? 20) : 20;
    const overtimeMultiplier = settingsRow ? Number(settingsRow.overtime_multiplier ?? 1.5) : 1.5;

    for (const row of rows) {
      totalHours += Number(row.total_hours ?? 0);
      totalEarnings += Number(row.total_earnings ?? 0);
      overtimeHours += Number(row.overtime_hours ?? 0);
      paidMinutesSum += Number(row.paid_minutes ?? 0);

      if (row.integrity_type === 'MANUAL') manualAdjustments++;

      const sRate = Number(row.snapshot_rate ?? baseRate);
      const sOvertime = Number(row.overtime_hours ?? 0);
      const sTotalHours = Number(row.total_hours ?? 0);
      const sBaseHours = Math.max(0, sTotalHours - sOvertime);

      baseEarnings += sBaseHours * sRate;
      overtimeEarnings += sOvertime * sRate * overtimeMultiplier;

      const transferCountRow = await database.getFirstAsync<any>('SELECT COUNT(*) as count FROM transfers WHERE session_id = ?', [row.id]);
      transfersSum += Number(transferCountRow?.count ?? 0);
    }

    return {
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      periodLabel: `${weekStart} - ${weekEnd}`,
      totalHours: Number(totalHours.toFixed(2)),
      paidHours: Number((paidMinutesSum / 60).toFixed(2)) || Number(totalHours.toFixed(2)),
      totalEarnings: Number(totalEarnings.toFixed(2)),
      workDaysCount: rows.length,
      sessionCount: rows.length,
      transfersCount: transfersSum,
      manualAdjustments,
      overtimeHours: Number(overtimeHours.toFixed(2)),
      baseEarnings: Number(baseEarnings.toFixed(2)),
      overtimeEarnings: Number(overtimeEarnings.toFixed(2)),
      baseRate,
      overtimeMultiplier,
    };
  }

  // ── SUB-REPOSITORY METHODS ──────────────────────────────────

  async getVisits(sessionId: string): Promise<DestinationVisit[]> {
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<any>(
      'SELECT * FROM destination_visits WHERE session_id = ? ORDER BY enter_time ASC',
      [sessionId]
    );
    return rows.map(r => ({
      id: r.id,
      workdayId: r.session_id,
      sessionId: r.session_id,
      destination: r.destination,
      alias: r.alias ?? undefined,
      startTime: r.enter_time,
      enterTime: r.enter_time,
      endTime: r.exit_time ?? undefined,
      exitTime: r.exit_time ?? undefined,
      durationMinutes: calcDurationMinutes(r.enter_time, r.exit_time),
      lat: r.lat != null ? Number(r.lat) : undefined,
      lng: r.lng != null ? Number(r.lng) : undefined,
    }));
  }

  async getTransfers(sessionId: string): Promise<Transfer[]> {
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<any>(
      'SELECT * FROM transfers WHERE session_id = ? ORDER BY start_time ASC',
      [sessionId]
    );
    return rows.map(r => ({
      id: r.id,
      workdayId: r.session_id,
      sessionId: r.session_id,
      fromDestination: r.origin_destination,
      originDestination: r.origin_destination,
      toDestination: r.target_destination,
      targetDestination: r.target_destination,
      destination: r.target_destination,
      startTime: r.start_time,
      endTime: r.end_time ?? undefined,
      durationMinutes: calcDurationMinutes(r.start_time, r.end_time),
      status: r.end_time ? 'COMPLETED' : 'ONGOING',
    }));
  }

  async getBreaks(sessionId: string): Promise<Break[]> {
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<any>(
      'SELECT * FROM breaks WHERE session_id = ? ORDER BY start_time ASC',
      [sessionId]
    );
    return rows.map(r => ({
      id: r.id,
      workdayId: r.session_id,
      sessionId: r.session_id,
      startTime: r.start_time,
      endTime: r.end_time ?? undefined,
      durationMinutes: Number(r.duration_minutes ?? calcDurationMinutes(r.start_time, r.end_time)),
    }));
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────

  private async _hydrateSession(database: SQLite.SQLiteDatabase, row: any): Promise<Session> {
    const timelineRows = await database.getAllAsync<any>(
      'SELECT * FROM timeline_events WHERE session_id = ? ORDER BY sequence ASC',
      [row.id]
    );

    const visits = await this.getVisits(row.id);
    const transfers = await this.getTransfers(row.id);
    const breaks = await this.getBreaks(row.id);

    const timelineEvents: TimelineEvent[] = timelineRows.map((e: any, idx: number) => ({
      id: e.id,
      workdayId: row.id,
      sessionId: row.id,
      timestamp: e.timestamp,
      type: row.state,
      title: e.description,
      description: e.description,
      status: e.status as any,
      sequence: Number(e.sequence ?? idx + 1),
      metadata: e.metadata ?? undefined,
    }));

    const session: Session = {
      id: row.id,
      date: row.date,
      destination: row.destination ?? 'Principal',
      alias: row.alias ?? undefined,
      startTime: row.start_time,
      endTime: row.end_time || '',
      totalHours: Number(row.total_hours ?? 0),
      lunchDeductedMinutes: Number(row.lunch_deducted_minutes ?? 0),
      paidMinutes: Number(row.paid_minutes ?? 0),
      pauseMinutes: Number(row.pause_minutes ?? 0),
      transferMinutes: Number(row.transfer_minutes ?? 0),
      destinationCount: Number(row.destination_count ?? 1),
      overtimeHours: Number(row.overtime_hours ?? 0),
      snapshotRate: Number(row.snapshot_rate ?? 0),
      totalEarnings: Number(row.total_earnings ?? 0),
      integrityType: (row.integrity_type === 'GPS' ? 'VALID' : row.integrity_type) as any,
      notes: row.notes ?? undefined,
      state: row.state as any,
      visits,
      transfers,
      breaks,
      timeline: timelineEvents,
      timelineEvents,
      _lat: row._lat != null ? Number(row._lat) : undefined,
      _lng: row._lng != null ? Number(row._lng) : undefined,
      _deviceStatus: row._device_status ?? undefined,
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at ?? new Date().toISOString(),
    };
    return session;
  }

  private async _replaceTimelineEvents(db: SQLite.SQLiteDatabase, sessionId: string, events: TimelineEvent[]): Promise<void> {
    await db.runAsync('DELETE FROM timeline_events WHERE session_id = ?', [sessionId]);
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      await db.runAsync(
        `INSERT INTO timeline_events (id, session_id, timestamp, description, status, sequence, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [e.id, sessionId, e.timestamp, e.description, e.status, e.sequence ?? (i + 1), e.metadata || null]
      );
    }
  }

  private async _replaceVisits(db: SQLite.SQLiteDatabase, sessionId: string, visits: DestinationVisit[]): Promise<void> {
    await db.runAsync('DELETE FROM destination_visits WHERE session_id = ?', [sessionId]);
    for (const v of visits) {
      const enterTime = v.enterTime || v.startTime || '';
      const exitTime = v.exitTime || v.endTime || null;
      await db.runAsync(
        `INSERT INTO destination_visits (id, session_id, destination, alias, enter_time, exit_time, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, sessionId, v.destination, v.alias || null, enterTime, exitTime, v.lat || null, v.lng || null]
      );
    }
  }

  private async _replaceTransfers(db: SQLite.SQLiteDatabase, sessionId: string, transfers: Transfer[]): Promise<void> {
    await db.runAsync('DELETE FROM transfers WHERE session_id = ?', [sessionId]);
    for (const t of transfers) {
      const origin = t.originDestination || t.fromDestination || '';
      const target = t.targetDestination || t.toDestination || t.destination || '';
      await db.runAsync(
        `INSERT INTO transfers (id, session_id, origin_destination, target_destination, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`,
        [t.id, sessionId, origin, target, t.startTime, t.endTime || null]
      );
    }
  }

  private async _replaceBreaks(db: SQLite.SQLiteDatabase, sessionId: string, breaks: Break[]): Promise<void> {
    await db.runAsync('DELETE FROM breaks WHERE session_id = ?', [sessionId]);
    for (const b of breaks) {
      await db.runAsync(
        `INSERT INTO breaks (id, session_id, start_time, end_time, duration_minutes) VALUES (?, ?, ?, ?, ?)`,
        [b.id, sessionId, b.startTime, b.endTime || null, b.durationMinutes || 0]
      );
    }
  }
}

export const sessionRepository = new SessionRepository();
export const databaseService = new DatabaseService();
