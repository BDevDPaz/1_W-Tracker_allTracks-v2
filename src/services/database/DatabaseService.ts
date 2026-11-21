import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";
import type {
  Break,
  DestinationVisit,
  ISessionRepository,
  Session,
  TimelineEvent,
  Transfer,
  WeeklySummary,
  SessionState,
  IntegrityType,
  PillStatus,
} from "@/types/contracts";

interface DBSessionRow {
  id: string;
  date: string;
  destination: string;
  alias: string | null;
  start_time: string;
  end_time: string | null;
  total_hours: number;
  lunch_deducted_minutes: number;
  overtime_hours: number;
  snapshot_rate: number;
  snapshot_multiplier: number;
  snapshot_threshold_hours: number;
  snapshot_currency: string;
  snapshot_is_approximate: number;
  total_earnings: number;
  integrity_type: string;
  notes: string | null;
  state: string;
  paid_minutes: number;
  pause_minutes: number;
  transfer_minutes: number;
  destination_count: number;
  _lat: number | null;
  _lng: number | null;
  _device_status: string | null;
  created_at: string;
  updated_at: string;
}

interface DBTimelineRow {
  id: string;
  session_id: string;
  timestamp: string;
  description: string;
  status: string;
  sequence: number;
  metadata: string | null;
}

interface DBVisitRow {
  id: string;
  session_id: string;
  destination: string;
  alias: string | null;
  enter_time: string;
  exit_time: string | null;
  lat: number | null;
  lng: number | null;
}

interface DBTransferRow {
  id: string;
  session_id: string;
  origin_destination: string;
  target_destination: string;
  start_time: string;
  end_time: string | null;
}

interface DBBreakRow {
  id: string;
  session_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
}

interface DBSettingsRow {
  hourly_rate: number | null;
  overtime_multiplier: number | null;
  overtime_threshold_hours: number | null;
  currency: string | null;
}

interface DBTransferCountRow {
  count: number;
}

function parseHHMMToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const timePart = timeStr.includes("T")
    ? (timeStr.split("T")[1] ?? timeStr)
    : timeStr;
  const parts = timePart.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function calcDurationMinutes(start: string, end: string | null): number {
  if (!start || !end) return 0;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
    const diff = Math.round((endMs - startMs) / 60000);
    return diff < 0 ? 0 : diff;
  }
  let diff = parseHHMMToMinutes(end) - parseHHMMToMinutes(start);
  if (diff < 0) diff += 1440;
  return diff;
}

function calcTotalHours(
  startTime: string,
  endTime: string | null,
  lunchDeductedMinutes: number,
): number {
  if (!startTime || !endTime) return 0;
  const totalMinutes = calcDurationMinutes(startTime, endTime);
  const netMinutes = Math.max(0, totalMinutes - (lunchDeductedMinutes || 0));
  return Number((netMinutes / 60).toFixed(2));
}

function calcTotalEarnings(
  totalHours: number,
  snapshotRate: number,
  overtimeHours: number,
  overtimeMultiplier: number,
): number {
  const baseHours = Math.max(0, totalHours - (overtimeHours || 0));
  const base = baseHours * snapshotRate;
  const overtime =
    (overtimeHours || 0) * snapshotRate * overtimeMultiplier;
  return Number((base + overtime).toFixed(2));
}

interface SQLiteTableColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

async function columnExists(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const columns = await db.getAllAsync<SQLiteTableColumn>(
    `PRAGMA table_info(${tableName})`,
  );
  return columns.some((column) => column.name === columnName);
}

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  definition: string,
): Promise<void> {
  const exists = await columnExists(db, tableName, columnName);
  if (exists) return;
  await db.execAsync(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`,
  );
}

async function migrateSettingsTable(db: SQLite.SQLiteDatabase): Promise<void> {
  await addColumnIfMissing(
    db,
    "settings",
    "multi_destination",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "paid_transfers",
    "INTEGER NOT NULL DEFAULT 1",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "destination_limit",
    "INTEGER NOT NULL DEFAULT 5",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "has_completed_onboarding",
    "INTEGER NOT NULL DEFAULT 0",
  );
  // --- Paso 2a: Split Ajustes Trabajador vs Administrador ---
  // Campos que existían en el tipo pero nunca se persistían
  await addColumnIfMissing(
    db,
    "settings",
    "standard_lunch_minutes",
    "INTEGER NOT NULL DEFAULT 30",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "overtime_threshold_hours",
    "REAL NOT NULL DEFAULT 8",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "currency",
    "TEXT NOT NULL DEFAULT 'USD'",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "allow_multi_destination",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "pay_transfer_time",
    "INTEGER NOT NULL DEFAULT 1",
  );
  // Trabajador
  await addColumnIfMissing(db, "settings", "phone", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing(
    db,
    "settings",
    "emergency_contact",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "emergency_phone",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "preferred_start_time",
    "TEXT NOT NULL DEFAULT '06:00'",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "lunch_preference_minutes",
    "INTEGER NOT NULL DEFAULT 30",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "entry_reminder_enabled",
    "INTEGER NOT NULL DEFAULT 1",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "sound_enabled",
    "INTEGER NOT NULL DEFAULT 1",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "vibration_enabled",
    "INTEGER NOT NULL DEFAULT 1",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "time_format",
    "TEXT NOT NULL DEFAULT '12h'",
  );
  // Administrador
  await addColumnIfMissing(
    db,
    "settings",
    "address",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "employee_id",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "company",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "position",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "start_date",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "principal_address",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "grace_period_minutes",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "entry_tolerance_minutes",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "pay_day",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "payment_method",
    "TEXT NOT NULL DEFAULT ''",
  );
  await addColumnIfMissing(db, "settings", "admin_pin_hash", "TEXT");
  await addColumnIfMissing(
    db,
    "settings",
    "admin_pin_set",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "last_admin_change_at",
    "TEXT",
  );
  await addColumnIfMissing(
    db,
    "settings",
    "last_admin_change_by",
    "TEXT",
  );
}

async function migrateIntegrityTypes(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(`
    UPDATE sessions
    SET integrity_type = 'VALID'
    WHERE integrity_type IS NULL OR TRIM(integrity_type) = '' OR integrity_type = 'GPS';
  `);
}

async function migrateSessionSnapshots(db: SQLite.SQLiteDatabase): Promise<void> {
  await addColumnIfMissing(db, "sessions", "snapshot_multiplier", "REAL");
  await addColumnIfMissing(
    db,
    "sessions",
    "snapshot_threshold_hours",
    "REAL",
  );
  await addColumnIfMissing(db, "sessions", "snapshot_currency", "TEXT");
  await addColumnIfMissing(
    db,
    "sessions",
    "snapshot_is_approximate",
    "INTEGER",
  );

  // Backfill inmediato, solo filas sin snapshot. No recalcula cerradas.
  // Lee settings actuales una sola vez en migración, no en cada lectura posterior.
  // Fallback solo si no existe fila de settings.
  const settingsRow = await db.getFirstAsync<DBSettingsRow>(
    "SELECT hourly_rate, overtime_multiplier, overtime_threshold_hours, currency FROM settings WHERE id = 'user_settings'",
  );
  const snapshotMultiplier = settingsRow?.overtime_multiplier ?? 1.5;
  const snapshotThresholdHours = settingsRow?.overtime_threshold_hours ?? 8;
  const snapshotCurrency = settingsRow?.currency ?? "USD";

  await db.runAsync(
    `UPDATE sessions SET snapshot_multiplier = ?, snapshot_threshold_hours = ?, snapshot_currency = ?, snapshot_is_approximate = 1 WHERE snapshot_multiplier IS NULL`,
    [snapshotMultiplier, snapshotThresholdHours, snapshotCurrency],
  );
  await db.runAsync(
    `UPDATE sessions SET snapshot_threshold_hours = ?, snapshot_currency = ?, snapshot_is_approximate = 1 WHERE snapshot_threshold_hours IS NULL`,
    [snapshotThresholdHours, snapshotCurrency],
  );
  await db.runAsync(
    `UPDATE sessions SET snapshot_currency = ? WHERE snapshot_currency IS NULL`,
    [snapshotCurrency],
  );
  await db.runAsync(
    `UPDATE sessions SET snapshot_is_approximate = 1 WHERE snapshot_is_approximate IS NULL AND snapshot_multiplier IS NOT NULL`,
  );
}

export const DB_SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, destination TEXT NOT NULL, alias TEXT,
    start_time TEXT NOT NULL, end_time TEXT, total_hours REAL NOT NULL DEFAULT 0,
    lunch_deducted_minutes INTEGER NOT NULL DEFAULT 0, overtime_hours REAL NOT NULL DEFAULT 0,
    snapshot_rate REAL NOT NULL DEFAULT 20, snapshot_multiplier REAL NOT NULL DEFAULT 1.5,
    snapshot_threshold_hours REAL NOT NULL DEFAULT 8, snapshot_currency TEXT NOT NULL DEFAULT 'USD',
    snapshot_is_approximate INTEGER NOT NULL DEFAULT 0,
    total_earnings REAL NOT NULL DEFAULT 0,
    integrity_type TEXT NOT NULL DEFAULT 'VALID', notes TEXT, state TEXT NOT NULL DEFAULT 'NO_INICIADA',
    paid_minutes INTEGER NOT NULL DEFAULT 0, pause_minutes INTEGER NOT NULL DEFAULT 0,
    transfer_minutes INTEGER NOT NULL DEFAULT 0, destination_count INTEGER NOT NULL DEFAULT 1,
    _lat REAL, _lng REAL, _device_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS destination_visits (
    id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, destination TEXT NOT NULL,
    alias TEXT, enter_time TEXT NOT NULL, exit_time TEXT, lat REAL, lng REAL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, origin_destination TEXT NOT NULL,
    target_destination TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS breaks (
    id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, start_time TEXT NOT NULL,
    end_time TEXT, duration_minutes INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, timestamp TEXT NOT NULL,
    description TEXT NOT NULL, status TEXT NOT NULL, sequence INTEGER NOT NULL, metadata TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS wal_log (
    id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, event_type TEXT NOT NULL,
    payload TEXT NOT NULL, created_at TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY NOT NULL DEFAULT 'user_settings', name TEXT NOT NULL DEFAULT '',
    hourly_rate REAL NOT NULL DEFAULT 20, report_email TEXT NOT NULL DEFAULT '',
    base_work_hour TEXT NOT NULL DEFAULT '06:00', overtime_multiplier REAL NOT NULL DEFAULT 1.5,
    lunch_discount_minutes INTEGER NOT NULL DEFAULT 30, geofence_radius INTEGER NOT NULL DEFAULT 100,
    daily_reminder INTEGER NOT NULL DEFAULT 1, workday_alerts INTEGER NOT NULL DEFAULT 1,
    report_ready INTEGER NOT NULL DEFAULT 1, language TEXT NOT NULL DEFAULT 'es',
    multi_destination INTEGER NOT NULL DEFAULT 0, paid_transfers INTEGER NOT NULL DEFAULT 1,
    destination_limit INTEGER NOT NULL DEFAULT 5, has_completed_onboarding INTEGER NOT NULL DEFAULT 0,
    standard_lunch_minutes INTEGER NOT NULL DEFAULT 30,
    overtime_threshold_hours REAL NOT NULL DEFAULT 8,
    currency TEXT NOT NULL DEFAULT 'USD',
    allow_multi_destination INTEGER NOT NULL DEFAULT 0,
    pay_transfer_time INTEGER NOT NULL DEFAULT 1,
    phone TEXT NOT NULL DEFAULT '',
    emergency_contact TEXT NOT NULL DEFAULT '',
    emergency_phone TEXT NOT NULL DEFAULT '',
    preferred_start_time TEXT NOT NULL DEFAULT '06:00',
    lunch_preference_minutes INTEGER NOT NULL DEFAULT 30,
    entry_reminder_enabled INTEGER NOT NULL DEFAULT 1,
    sound_enabled INTEGER NOT NULL DEFAULT 1,
    vibration_enabled INTEGER NOT NULL DEFAULT 1,
    time_format TEXT NOT NULL DEFAULT '12h',
    address TEXT NOT NULL DEFAULT '',
    employee_id TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL DEFAULT '',
    principal_address TEXT NOT NULL DEFAULT '',
    grace_period_minutes INTEGER NOT NULL DEFAULT 0,
    entry_tolerance_minutes INTEGER NOT NULL DEFAULT 0,
    pay_day TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT '',
    admin_pin_hash TEXT,
    admin_pin_set INTEGER NOT NULL DEFAULT 0,
    last_admin_change_at TEXT,
    last_admin_change_by TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
  CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
  CREATE INDEX IF NOT EXISTS idx_wal_synced ON wal_log(synced);
`;

export class DatabaseService {
  private static db: SQLite.SQLiteDatabase | null = null;

  static async initialize(): Promise<void> {
    if (this.db) return;
    const db = await SQLite.openDatabaseAsync("w-tracker.db");
    await db.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
    await db.execAsync(DB_SCHEMA);
    await migrateSettingsTable(db);
    await migrateIntegrityTypes(db);
    await migrateSessionSnapshots(db);
    this.db = db;
  }

  static getDb(): SQLite.SQLiteDatabase {
    if (!this.db) throw new Error("DatabaseService no inicializado.");
    return this.db;
  }
}

export class SessionRepository implements ISessionRepository {
  private async getDatabase(): Promise<SQLite.SQLiteDatabase> {
    return DatabaseService.getDb();
  }

  async appendWALEntry(
    sessionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const database = await this.getDatabase();
    await database.runAsync(
      `INSERT INTO wal_log (id, session_id, event_type, payload, created_at, synced) VALUES (?, ?, ?, ?, ?, 0)`,
      [
        Crypto.randomUUID(),
        sessionId,
        eventType,
        JSON.stringify(payload),
        new Date().toISOString(),
      ],
    );
  }

  async getAll(): Promise<Session[]> {
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<DBSessionRow>(
      "SELECT * FROM sessions ORDER BY date DESC, start_time DESC",
    );
    return Promise.all(rows.map((row) => this._hydrateSession(database, row)));
  }

  async getByFilters(
    searchQuery?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Session[]> {
    const db = await this.getDatabase();
    let query = "SELECT * FROM sessions WHERE 1=1";
    const params: SQLite.SQLiteBindValue[] = [];

    if (startDate && endDate) {
      query += " AND date >= ? AND date <= ?";
      params.push(startDate, endDate);
    } else if (startDate) {
      query += " AND date >= ?";
      params.push(startDate);
    }

    if (searchQuery && searchQuery.trim() !== "") {
      query += " AND (destination LIKE ? OR alias LIKE ? OR notes LIKE ?)";
      const likeQuery = `%${searchQuery.trim()}%`;
      params.push(likeQuery, likeQuery, likeQuery);
    }

    query += " ORDER BY date DESC, start_time DESC";
    const rows = await db.getAllAsync<DBSessionRow>(query, params);
    return Promise.all(rows.map((row) => this._hydrateSession(db, row)));
  }

  async getById(id: string): Promise<Session | null> {
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<DBSessionRow>(
      "SELECT * FROM sessions WHERE id = ?",
      [id],
    );
    if (!row) return null;
    return this._hydrateSession(database, row);
  }

  async getActive(): Promise<Session | null> {
    const database = await this.getDatabase();
    const row = await database.getFirstAsync<DBSessionRow>(`
      SELECT * FROM sessions
      WHERE state != 'CERRADA' AND state != 'NO_INICIADA' AND (end_time IS NULL OR end_time = '')
      ORDER BY start_time DESC LIMIT 1
    `);
    if (!row) return null;
    return this._hydrateSession(database, row);
  }

  async getByPeriod(startDate: string, endDate: string): Promise<Session[]> {
    return this.getByFilters(undefined, startDate, endDate);
  }

  async create(sessionData: Session): Promise<Session> {
    const database = await this.getDatabase();
    const now = new Date().toISOString();
    const integrity =
      sessionData.integrityType === "GPS" ? "VALID" : sessionData.integrityType;
    const dest =
      sessionData.destination ||
      sessionData.visits[0]?.destination ||
      "Principal";

    const hasSnapshot =
      sessionData.snapshotMultiplier !== undefined &&
      sessionData.snapshotThresholdHours !== undefined;
    const snapshotMultiplier = sessionData.snapshotMultiplier ?? 1.5;
    const snapshotThresholdHours = sessionData.snapshotThresholdHours ?? 8;
    const snapshotCurrency = sessionData.snapshotCurrency ?? "USD";
    const snapshotIsApproximate = sessionData.snapshotIsApproximate ?? !hasSnapshot;

    await database.runAsync(
      `INSERT INTO sessions (
        id, date, destination, alias, start_time, end_time, total_hours, lunch_deducted_minutes,
        overtime_hours, snapshot_rate, snapshot_multiplier, snapshot_threshold_hours, snapshot_currency, snapshot_is_approximate, total_earnings, integrity_type, notes, state, paid_minutes,
        pause_minutes, transfer_minutes, destination_count, _lat, _lng, _device_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionData.id,
        sessionData.date,
        dest,
        sessionData.alias || null,
        sessionData.startTime,
        sessionData.endTime || null,
        sessionData.totalHours,
        sessionData.lunchDeductedMinutes,
        sessionData.overtimeHours,
        sessionData.snapshotRate,
        snapshotMultiplier,
        snapshotThresholdHours,
        snapshotCurrency,
        snapshotIsApproximate ? 1 : 0,
        sessionData.totalEarnings,
        integrity,
        sessionData.notes || null,
        sessionData.state,
        sessionData.paidMinutes,
        sessionData.pauseMinutes,
        sessionData.transferMinutes,
        sessionData.destinationCount,
        sessionData._lat || null,
        sessionData._lng || null,
        sessionData._deviceStatus || null,
        sessionData.createdAt || now,
        sessionData.updatedAt || now,
      ],
    );

    if (sessionData.timelineEvents?.length)
      await this._replaceTimelineEvents(
        database,
        sessionData.id,
        sessionData.timelineEvents,
      );
    if (sessionData.visits?.length)
      await this._replaceVisits(database, sessionData.id, sessionData.visits);
    if (sessionData.transfers?.length)
      await this._replaceTransfers(
        database,
        sessionData.id,
        sessionData.transfers,
      );
    if (sessionData.breaks?.length)
      await this._replaceBreaks(database, sessionData.id, sessionData.breaks);

    const created = await this.getById(sessionData.id);
    if (!created)
      throw new Error(`Error recuperando sesión: ${sessionData.id}`);
    return created;
  }

  async update(id: string, patch: Partial<Session>): Promise<Session> {
    const database = await this.getDatabase();
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: SQLite.SQLiteBindValue[] = [];

    const addPatch = (col: string, val: SQLite.SQLiteBindValue) => {
      fields.push(`${col} = ?`);
      values.push(val);
    };

    if (patch.date !== undefined) addPatch("date", patch.date);
    if (patch.destination !== undefined)
      addPatch("destination", patch.destination);
    if (patch.alias !== undefined) addPatch("alias", patch.alias || null);
    if (patch.startTime !== undefined) addPatch("start_time", patch.startTime);
    if (patch.endTime !== undefined)
      addPatch("end_time", patch.endTime || null);
    if (patch.totalHours !== undefined)
      addPatch("total_hours", patch.totalHours);
    if (patch.lunchDeductedMinutes !== undefined)
      addPatch("lunch_deducted_minutes", patch.lunchDeductedMinutes);
    if (patch.overtimeHours !== undefined)
      addPatch("overtime_hours", patch.overtimeHours);
    if (patch.snapshotRate !== undefined)
      addPatch("snapshot_rate", patch.snapshotRate);
    if (patch.snapshotMultiplier !== undefined)
      addPatch("snapshot_multiplier", patch.snapshotMultiplier);
    if (patch.snapshotThresholdHours !== undefined)
      addPatch("snapshot_threshold_hours", patch.snapshotThresholdHours);
    if (patch.snapshotCurrency !== undefined)
      addPatch("snapshot_currency", patch.snapshotCurrency);
    if (patch.snapshotIsApproximate !== undefined)
      addPatch(
        "snapshot_is_approximate",
        patch.snapshotIsApproximate ? 1 : 0,
      );
    if (patch.totalEarnings !== undefined)
      addPatch("total_earnings", patch.totalEarnings);
    if (patch.integrityType !== undefined)
      addPatch(
        "integrity_type",
        patch.integrityType === "GPS" ? "VALID" : patch.integrityType,
      );
    if (patch.notes !== undefined) addPatch("notes", patch.notes || null);
    if (patch.state !== undefined) addPatch("state", patch.state);
    if (patch._lat !== undefined) addPatch("_lat", patch._lat ?? null);
    if (patch._lng !== undefined) addPatch("_lng", patch._lng ?? null);
    if (patch._deviceStatus !== undefined)
      addPatch("_device_status", patch._deviceStatus || null);
    if (patch.paidMinutes !== undefined)
      addPatch("paid_minutes", patch.paidMinutes);
    if (patch.pauseMinutes !== undefined)
      addPatch("pause_minutes", patch.pauseMinutes);
    if (patch.transferMinutes !== undefined)
      addPatch("transfer_minutes", patch.transferMinutes);
    if (patch.destinationCount !== undefined)
      addPatch("destination_count", patch.destinationCount);

    if (fields.length > 0) {
      addPatch("updated_at", now);
      values.push(id);
      await database.runAsync(
        `UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`,
        values,
      );
    }

    if (patch.timelineEvents)
      await this._replaceTimelineEvents(database, id, patch.timelineEvents);
    if (patch.visits) await this._replaceVisits(database, id, patch.visits);
    if (patch.transfers)
      await this._replaceTransfers(database, id, patch.transfers);
    if (patch.breaks) await this._replaceBreaks(database, id, patch.breaks);

    const updated = await this.getById(id);
    if (!updated) throw new Error(`Error recuperando sesión: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const database = await this.getDatabase();
    await database.runAsync("DELETE FROM sessions WHERE id = ?", [id]);
  }

  async getWeeklySummary(
    weekStart: string,
    weekEnd: string,
  ): Promise<WeeklySummary> {
    const database = await this.getDatabase();
    const rows = await database.getAllAsync<DBSessionRow>(
      `SELECT * FROM sessions WHERE date >= ? AND date <= ? AND state = 'CERRADA'`,
      [weekStart, weekEnd],
    );

    let totalHours = 0,
      totalEarnings = 0,
      manualAdjustments = 0,
      overtimeHours = 0;
    let baseEarnings = 0,
      overtimeEarnings = 0,
      paidMinutesSum = 0,
      transfersSum = 0;
    let totalBaseHours = 0,
      weightedBaseRateSum = 0,
      weightedMultiplierSum = 0;

    for (const row of rows) {
      const effectiveHours =
        row.total_hours > 0
          ? row.total_hours
          : calcTotalHours(
              row.start_time,
              row.end_time,
              row.lunch_deducted_minutes,
            );
      const effectiveEarnings =
        row.total_earnings > 0
          ? row.total_earnings
          : calcTotalEarnings(
              effectiveHours,
              row.snapshot_rate,
              row.overtime_hours,
              row.snapshot_multiplier,
            );
      totalHours += effectiveHours;
      totalEarnings += effectiveEarnings;
      overtimeHours += row.overtime_hours;
      paidMinutesSum +=
        row.paid_minutes > 0
          ? row.paid_minutes
          : Math.round(effectiveHours * 60);
      if (row.integrity_type === "MANUAL") manualAdjustments++;

      const sRate = row.snapshot_rate;
      const sMultiplier = row.snapshot_multiplier;
      const sOvertime = row.overtime_hours;
      const sBaseHours = Math.max(0, effectiveHours - sOvertime);

      baseEarnings += sBaseHours * sRate;
      overtimeEarnings += sOvertime * sRate * sMultiplier;
      totalBaseHours += sBaseHours;
      weightedBaseRateSum += sBaseHours * sRate;
      weightedMultiplierSum += sOvertime * sMultiplier;

      const transferCountRow = await database.getFirstAsync<DBTransferCountRow>(
        "SELECT COUNT(*) as count FROM transfers WHERE session_id = ?",
        [row.id],
      );
      transfersSum += transferCountRow?.count ?? 0;
    }

    // baseRate y overtimeMultiplier del resumen son promedios ponderados desde snapshots, no desde settings en vivo.
    const baseRate =
      totalBaseHours > 0
        ? Number((weightedBaseRateSum / totalBaseHours).toFixed(2))
        : rows.length > 0
          ? rows[0]!.snapshot_rate
          : 0;
    const overtimeMultiplier =
      overtimeHours > 0
        ? Number((weightedMultiplierSum / overtimeHours).toFixed(2))
        : rows.length > 0
          ? rows[0]!.snapshot_multiplier
          : 0;

    return {
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      periodLabel: `${weekStart} - ${weekEnd}`,
      totalHours: Number(totalHours.toFixed(2)),
      paidHours:
        Number((paidMinutesSum / 60).toFixed(2)) ||
        Number(totalHours.toFixed(2)),
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

  async getVisits(sessionId: string): Promise<DestinationVisit[]> {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<DBVisitRow>(
      "SELECT * FROM destination_visits WHERE session_id = ? ORDER BY enter_time ASC",
      [sessionId],
    );
    return rows.map((r) => ({
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
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
    }));
  }

  async getTransfers(sessionId: string): Promise<Transfer[]> {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<DBTransferRow>(
      "SELECT * FROM transfers WHERE session_id = ? ORDER BY start_time ASC",
      [sessionId],
    );
    return rows.map((r) => ({
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
      status: r.end_time ? "COMPLETED" : "ONGOING",
    }));
  }

  async getBreaks(sessionId: string): Promise<Break[]> {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<DBBreakRow>(
      "SELECT * FROM breaks WHERE session_id = ? ORDER BY start_time ASC",
      [sessionId],
    );
    return rows.map((r) => ({
      id: r.id,
      workdayId: r.session_id,
      sessionId: r.session_id,
      startTime: r.start_time,
      endTime: r.end_time ?? undefined,
      durationMinutes: r.duration_minutes,
    }));
  }

  private async _hydrateSession(
    database: SQLite.SQLiteDatabase,
    row: DBSessionRow,
  ): Promise<Session> {
    const timelineRows = await database.getAllAsync<DBTimelineRow>(
      "SELECT * FROM timeline_events WHERE session_id = ? ORDER BY sequence ASC",
      [row.id],
    );
    const timelineEvents: TimelineEvent[] = timelineRows.map((e, idx) => ({
      id: e.id,
      workdayId: row.id,
      sessionId: row.id,
      timestamp: e.timestamp,
      type: row.state as SessionState,
      title: e.description,
      description: e.description,
      status: e.status as PillStatus,
      sequence: e.sequence ?? idx + 1,
      metadata: e.metadata ?? undefined,
    }));

    // CORRECCIÓN: horas en vivo para sesión no cerrada, con snapshot, no con live ni hardcodeado.
    // CERRADA -> usa lo guardado / calcula con end_time y snapshot.
    // ESPERANDO / NO_INICIADA -> 0, todavía no llegó.
    // ACTIVA / PAUSADA / TRASLADO / SALIDA -> calcula con now y snapshot_threshold_hours y snapshot_multiplier.
    let effectiveTotalHours: number;
    let effectiveOvertimeHours: number;
    let effectiveTotalEarnings: number;

    if (row.state === "CERRADA") {
      effectiveTotalHours =
        row.total_hours > 0
          ? row.total_hours
          : calcTotalHours(
              row.start_time,
              row.end_time,
              row.lunch_deducted_minutes,
            );
      effectiveOvertimeHours = row.overtime_hours;
      effectiveTotalEarnings =
        row.total_earnings > 0
          ? row.total_earnings
          : calcTotalEarnings(
              effectiveTotalHours,
              row.snapshot_rate,
              effectiveOvertimeHours,
              row.snapshot_multiplier,
            );
    } else if (row.state === "ESPERANDO" || row.state === "NO_INICIADA") {
      effectiveTotalHours = 0;
      effectiveOvertimeHours = 0;
      effectiveTotalEarnings = 0;
    } else {
      const nowIso = new Date().toISOString();
      effectiveTotalHours = calcTotalHours(
        row.start_time,
        nowIso,
        row.lunch_deducted_minutes,
      );
      effectiveOvertimeHours = Number(
        Math.max(0, effectiveTotalHours - row.snapshot_threshold_hours).toFixed(2),
      );
      effectiveTotalEarnings = calcTotalEarnings(
        effectiveTotalHours,
        row.snapshot_rate,
        effectiveOvertimeHours,
        row.snapshot_multiplier,
      );
    }

    return {
      id: row.id,
      date: row.date,
      destination: row.destination ?? "Principal",
      alias: row.alias ?? undefined,
      startTime: row.start_time,
      endTime: row.end_time ?? undefined,
      totalHours: effectiveTotalHours,
      lunchDeductedMinutes: row.lunch_deducted_minutes,
      paidMinutes:
        row.state === "CERRADA" && row.paid_minutes > 0
          ? row.paid_minutes
          : Math.round(effectiveTotalHours * 60),
      pauseMinutes: row.pause_minutes,
      transferMinutes: row.transfer_minutes,
      destinationCount: row.destination_count,
      overtimeHours: effectiveOvertimeHours,
      snapshotRate: row.snapshot_rate,
      snapshotMultiplier: row.snapshot_multiplier,
      snapshotThresholdHours: row.snapshot_threshold_hours,
      snapshotCurrency: row.snapshot_currency,
      snapshotIsApproximate: row.snapshot_is_approximate === 1,
      totalEarnings: effectiveTotalEarnings,
      integrityType: (row.integrity_type === "GPS"
        ? "VALID"
        : row.integrity_type) as IntegrityType,
      notes: row.notes ?? undefined,
      state: row.state as SessionState,
      visits: await this.getVisits(row.id),
      transfers: await this.getTransfers(row.id),
      breaks: await this.getBreaks(row.id),
      timelineEvents,
      _lat: row._lat ?? undefined,
      _lng: row._lng ?? undefined,
      _deviceStatus: row._device_status ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async _replaceTimelineEvents(
    db: SQLite.SQLiteDatabase,
    sessionId: string,
    events: TimelineEvent[],
  ): Promise<void> {
    await db.runAsync("DELETE FROM timeline_events WHERE session_id = ?", [
      sessionId,
    ]);
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      await db.runAsync(
        `INSERT INTO timeline_events (id, session_id, timestamp, description, status, sequence, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id,
          sessionId,
          e.timestamp,
          e.description,
          e.status,
          e.sequence ?? i + 1,
          e.metadata || null,
        ],
      );
    }
  }

  private async _replaceVisits(
    db: SQLite.SQLiteDatabase,
    sessionId: string,
    visits: DestinationVisit[],
  ): Promise<void> {
    await db.runAsync("DELETE FROM destination_visits WHERE session_id = ?", [
      sessionId,
    ]);
    for (const v of visits) {
      await db.runAsync(
        `INSERT INTO destination_visits (id, session_id, destination, alias, enter_time, exit_time, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.id,
          sessionId,
          v.destination,
          v.alias ?? null,
          v.enterTime ?? v.startTime ?? "",
          v.exitTime ?? v.endTime ?? null,
          v.lat ?? null,
          v.lng ?? null,
        ],
      );
    }
  }

  private async _replaceTransfers(
    db: SQLite.SQLiteDatabase,
    sessionId: string,
    transfers: Transfer[],
  ): Promise<void> {
    await db.runAsync("DELETE FROM transfers WHERE session_id = ?", [sessionId]);
    for (const t of transfers) {
      const origin = t.originDestination || t.fromDestination || "";
      const target =
        t.targetDestination || t.toDestination || t.destination || "";
      await db.runAsync(
        `INSERT INTO transfers (id, session_id, origin_destination, target_destination, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`,
        [t.id, sessionId, origin, target, t.startTime, t.endTime || null],
      );
    }
  }

  private async _replaceBreaks(
    db: SQLite.SQLiteDatabase,
    sessionId: string,
    breaks: Break[],
  ): Promise<void> {
    await db.runAsync("DELETE FROM breaks WHERE session_id = ?", [sessionId]);
    for (const b of breaks) {
      await db.runAsync(
        `INSERT INTO breaks (id, session_id, start_time, end_time, duration_minutes) VALUES (?, ?, ?, ?, ?)`,
        [
          b.id,
          sessionId,
          b.startTime,
          b.endTime || null,
          b.durationMinutes || 0,
        ],
      );
    }
  }
}

export const sessionRepository = new SessionRepository();
export const databaseService = new DatabaseService();
