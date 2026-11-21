import * as Crypto from "expo-crypto";
import {
  DatabaseService,
  sessionRepository,
} from "@/services/database/DatabaseService";
import { geofenceService } from "@/services/geofence/GeofenceService";
import { settingsService } from "@/services/settings/SettingsService";
import type { Session, UserSettings } from "@/types/contracts";
import * as Notifications from "expo-notifications";

class PromiseQueue {
  private queue: (() => Promise<unknown>)[] = [];
  private isProcessing = false;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await task();
          resolve(res);
        } catch (error) {
          reject(error);
        }
      });
      if (!this.isProcessing) {
        void this.process();
      }
    });
  }

  private async process() {
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) await task();
    }
    this.isProcessing = false;
  }
}

class SessionEngine {
  private get db() {
    return DatabaseService.getDb();
  }
  private queue = new PromiseQueue();
  private listeners: Set<(session: Session | null) => void> = new Set();
  private geofence = geofenceService;

  subscribe(listener: (session: Session | null) => void) {
    this.listeners.add(listener);
    void this.notifyStateChange();
    return () => this.listeners.delete(listener);
  }

  private async notifyStateChange() {
    try {
      const session = await this.getActiveSession();
      this.listeners.forEach((l) => l(session));
    } catch (_error) {
      /* silence error */
    }
  }

  private async getFreshSettings(): Promise<UserSettings> {
    return settingsService.getFreshSettings();
  }

  private async getGracePeriodMinutes(): Promise<number> {
    try {
      const fresh = await this.getFreshSettings();
      const grace = fresh.gracePeriodMinutes;
      if (typeof grace === "number" && Number.isFinite(grace) && grace > 0) {
        return grace;
      }
      // 0 = no configurado en Admin. Mantiene el comportamiento anterior (15)
      // hasta que Admin configure un valor explícito > 0.
      return 15;
    } catch (_error) {
      return 15;
    }
  }

  async getActiveSession(): Promise<Session | null> {
    return (await this.queue.enqueue(async () => {
      return await sessionRepository.getActive();
    })) as Session | null;
  }

  async startSession(destination: string, alias?: string): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const current = await this.db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sessions WHERE state != 'CERRADA'`,
      );
      if (current) throw new Error("Ya existe una sesión activa.");

      // Provisional: fresco en creación, no caché.
      const fresh = await this.getFreshSettings();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const today = now.split("T")[0];

      await this.db.runAsync(
        `INSERT INTO sessions (id, date, start_time, state, destination, alias, snapshot_rate, snapshot_multiplier, snapshot_threshold_hours, snapshot_currency, snapshot_is_approximate, integrity_type, created_at, updated_at)
         VALUES (?, ?, ?, 'ESPERANDO', ?, ?, ?, ?, ?, ?, 0, 'VALID', ?, ?)`,
        [
          id,
          today,
          now,
          destination,
          alias || destination,
          fresh.hourlyRate,
          fresh.overtimeMultiplier,
          fresh.overtimeThresholdHours ?? 8,
          fresh.currency ?? "USD",
          now,
          now,
        ],
      );

      try {
        const alreadyInside = await this.geofence.register({
          identifier: id,
          radius: fresh.geofenceRadius || 100,
          destination,
        });
        if (alreadyInside) {
          // Congelado: fresco de nuevo en el momento exacto de pasar a ACTIVA.
          const frozen = await this.getFreshSettings();
          await this.db.runAsync(
            `UPDATE sessions SET state = 'ACTIVA', start_time = ?, snapshot_rate = ?, snapshot_multiplier = ?, snapshot_threshold_hours = ?, snapshot_currency = ?, snapshot_is_approximate = 0, updated_at = ? WHERE id = ?`,
            [
              now,
              frozen.hourlyRate,
              frozen.overtimeMultiplier,
              frozen.overtimeThresholdHours ?? 8,
              frozen.currency ?? "USD",
              now,
              id,
            ],
          );
          // Notificación inmediata, no esperar a que el task de fondo dispare tarde
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "📍 Check-in Automático",
              body: "Has llegado a tu destino. Jornada activa.",
              sound: true,
            },
            trigger: null,
          }).catch(() => {});
        }
      } catch (_error) {
        /* sin permiso o sin geocoding, queda en ESPERANDO con confirmación manual */
        /* Principal: Geofence devuelve false sin centro real, no se registra geofence falso */
      }
      this.notifyStateChange();
    })) as void;
  }

  async confirmArrival(exactTime?: string): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{
        id: string;
        state: string;
        destination: string;
      }>(
        `SELECT id, state, destination FROM sessions WHERE state != 'CERRADA' ORDER BY created_at DESC LIMIT 1`,
      );
      if (!session) return;

      const now = exactTime || new Date().toISOString();

      if (session.state === "ESPERANDO") {
        // Único punto donde se congela: ESPERANDO -> ACTIVA, con fresco.
        const fresh = await this.getFreshSettings();
        await this.db.runAsync(
          `UPDATE sessions SET state = 'ACTIVA', start_time = ?, snapshot_rate = ?, snapshot_multiplier = ?, snapshot_threshold_hours = ?, snapshot_currency = ?, snapshot_is_approximate = 0, updated_at = ? WHERE id = ?`,
          [
            now,
            fresh.hourlyRate,
            fresh.overtimeMultiplier,
            fresh.overtimeThresholdHours ?? 8,
            fresh.currency ?? "USD",
            now,
            session.id,
          ],
        );
        try {
          await this.geofence.register({
            identifier: session.id,
            radius: fresh.geofenceRadius || 100,
            destination: session.destination,
          });
        } catch (_error) {
          /* silence error */
        }
      } else if (session.state === "TRASLADO") {
        // Vuelta de traslado: NO se vuelve a congelar snapshot.
        // El snapshot ya quedó congelado en la primera ACTIVA.
        const openTransfer = await this.db.getFirstAsync<{
          id: string;
          target_destination: string;
        }>(
          `SELECT id, target_destination FROM transfers WHERE session_id = ? AND end_time IS NULL`,
          [session.id],
        );
        if (openTransfer) {
          await this.db.runAsync(
            `UPDATE transfers SET end_time = ? WHERE id = ?`,
            [now, openTransfer.id],
          );
          await this.db.runAsync(
            `UPDATE sessions SET state = 'ACTIVA', destination = ?, alias = ?, updated_at = ? WHERE id = ?`,
            [
              openTransfer.target_destination,
              openTransfer.target_destination,
              now,
              session.id,
            ],
          );
          try {
            const fresh = await this.getFreshSettings();
            await this.geofence.register({
              identifier: session.id,
              radius: fresh.geofenceRadius || 100,
              destination: openTransfer.target_destination,
            });
          } catch (_error) {
            /* silence error */
          }
        }
      }
      this.notifyStateChange();
    })) as void;
  }

  async handleGeofenceExit(exactTime: string): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sessions WHERE state = 'ACTIVA' ORDER BY created_at DESC LIMIT 1`,
      );
      if (!session) return;

      await this.db.runAsync(
        `UPDATE sessions SET state = 'SALIDA', updated_at = ? WHERE id = ?`,
        [exactTime, session.id],
      );
      this.notifyStateChange();
    })) as void;
  }

  async processPendingGeofenceEvents(): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const pending = await this.geofence.getPendingGeofenceEvents();
      for (const evt of pending) {
        try {
          const session = await this.db.getFirstAsync<{
            id: string;
            state: string;
          }>(
            `SELECT id, state FROM sessions WHERE id = ?`,
            [evt.identifier],
          );
          if (!session) continue;

          if (evt.eventType === "ENTER" && session.state === "ESPERANDO") {
            const fresh = await this.getFreshSettings();
            await this.db.runAsync(
              `UPDATE sessions SET state = 'ACTIVA', start_time = ?, snapshot_rate = ?, snapshot_multiplier = ?, snapshot_threshold_hours = ?, snapshot_currency = ?, snapshot_is_approximate = 0, updated_at = ? WHERE id = ?`,
              [
                evt.timestamp,
                fresh.hourlyRate,
                fresh.overtimeMultiplier,
                fresh.overtimeThresholdHours ?? 8,
                fresh.currency ?? "USD",
                evt.timestamp,
                session.id,
              ],
            );
          } else if (evt.eventType === "EXIT" && session.state === "ACTIVA") {
            await this.db.runAsync(
              `UPDATE sessions SET state = 'SALIDA', updated_at = ? WHERE id = ?`,
              [evt.timestamp, session.id],
            );
          }
        } finally {
          await this.geofence.markGeofenceEventProcessed(evt.id);
        }
      }
      this.notifyStateChange();
    })) as void;
  }

  async evaluatePendingExits(): Promise<void> {
    const toFinish = await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{
        id: string;
        updated_at: string;
      }>(
        `SELECT id, updated_at FROM sessions WHERE state = 'SALIDA' ORDER BY created_at DESC LIMIT 1`,
      );
      if (!session) return null;

      const grace = await this.getGracePeriodMinutes();
      const exitTime = Date.parse(session.updated_at);
      if (Number.isNaN(exitTime)) return null;
      const diffMinutes = (Date.now() - exitTime) / (1000 * 60);

      if (diffMinutes >= grace) {
        return { exitTime: session.updated_at };
      }
      return null;
    });

    // Fuera de la cola: finishWorkDay también encola, si se llamara dentro habría deadlock.
    if (toFinish) {
      await this.finishWorkDay(0, (toFinish as { exitTime: string }).exitTime);
    }
  }

  async startTransfer(
    targetDestination: string,
    targetAlias?: string,
  ): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{
        id: string;
        state: string;
        destination: string;
      }>(
        `SELECT id, state, destination FROM sessions WHERE state != 'CERRADA' ORDER BY created_at DESC LIMIT 1`,
      );
      if (!session) throw new Error("No hay sesión activa.");
      if (session.state !== "ACTIVA")
        throw new Error("Solo puedes trasladarte si la jornada está activa.");

      // P2: allowMultiDestination es el único toggle de multi-destino.
      // Un transfer es el segundo destino. Si es false, no se permite ningún traslado.
      // Se lee fresco, no caché, porque es un permiso operativo vigente al momento del traslado.
      const fresh = await this.getFreshSettings();
      if (fresh.allowMultiDestination !== true) {
        throw new Error(
          "Multi-destino desactivado por el administrador. No puedes trasladarte a un segundo destino.",
        );
      }

      const now = new Date().toISOString();
      const finalDest = targetAlias || targetDestination;
      const transferId = Crypto.randomUUID();

      try {
        await this.geofence.unregister(session.id);
      } catch (_e) {
        /* silence error */
      }

      await this.db.runAsync(
        `INSERT INTO transfers (id, session_id, origin_destination, target_destination, start_time) VALUES (?, ?, ?, ?, ?)`,
        [transferId, session.id, session.destination, finalDest, now],
      );
      await this.db.runAsync(
        `UPDATE sessions SET state = 'TRASLADO', updated_at = ? WHERE id = ?`,
        [now, session.id],
      );
      this.notifyStateChange();
    })) as void;
  }

  async cancelTransfer(): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{
        id: string;
        destination: string;
      }>(
        `SELECT id, destination FROM sessions WHERE state = 'TRASLADO'`,
      );
      if (!session) return;

      const now = new Date().toISOString();
      await this.db.runAsync(
        `DELETE FROM transfers WHERE session_id = ? AND end_time IS NULL`,
        [session.id],
      );
      await this.db.runAsync(
        `UPDATE sessions SET state = 'ACTIVA', updated_at = ? WHERE id = ?`,
        [now, session.id],
      );

      try {
        const fresh = await this.getFreshSettings();
        await this.geofence.register({
          identifier: session.id,
          radius: fresh.geofenceRadius || 100,
          destination: session.destination,
        });
      } catch (_error) {
        /* silence error */
      }
      this.notifyStateChange();
    })) as void;
  }

  async startLunch(): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sessions WHERE state = 'ACTIVA'`,
      );
      if (!session) return;

      const now = new Date().toISOString();
      const breakId = Crypto.randomUUID();

      await this.db.runAsync(
        `INSERT INTO breaks (id, session_id, start_time, duration_minutes) VALUES (?, ?, ?, 0)`,
        [breakId, session.id, now],
      );
      await this.db.runAsync(
        `UPDATE sessions SET state = 'PAUSADA', updated_at = ? WHERE id = ?`,
        [now, session.id],
      );
      this.notifyStateChange();
    })) as void;
  }

  async endLunch(): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sessions WHERE state = 'PAUSADA'`,
      );
      if (!session) return;

      const now = new Date().toISOString();
      const openBreak = await this.db.getFirstAsync<{
        id: string;
        start_time: string;
      }>(
        `SELECT id, start_time FROM breaks WHERE session_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1`,
        [session.id],
      );
      if (openBreak) {
        const startMs = Date.parse(openBreak.start_time);
        const endMs = Date.parse(now);
        const duration =
          !Number.isNaN(startMs) && !Number.isNaN(endMs)
            ? Math.max(0, Math.round((endMs - startMs) / 60000))
            : 0;
        await this.db.runAsync(
          `UPDATE breaks SET end_time = ?, duration_minutes = ? WHERE id = ?`,
          [now, duration, openBreak.id],
        );
      } else {
        await this.db.runAsync(
          `UPDATE breaks SET end_time = ? WHERE session_id = ? AND end_time IS NULL`,
          [now, session.id],
        );
      }
      await this.db.runAsync(
        `UPDATE sessions SET state = 'ACTIVA', updated_at = ? WHERE id = ?`,
        [now, session.id],
      );
      this.notifyStateChange();
    })) as void;
  }

  async stayWorking(): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sessions WHERE state = 'SALIDA'`,
      );
      if (!session) return;
      await this.db.runAsync(
        `UPDATE sessions SET state = 'ACTIVA', updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), session.id],
      );
      this.notifyStateChange();
    })) as void;
  }

  async confirmExit(): Promise<void> {
    await this.finishWorkDay(0);
  }

  async finishWorkDay(
    lunchDeductedMinutes: number = 0,
    forcedEndTime?: string,
  ): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{
        id: string;
        state: string;
        start_time: string;
        snapshot_rate: number;
        snapshot_multiplier: number;
        snapshot_threshold_hours: number;
      }>(
        `SELECT id, state, start_time, snapshot_rate, snapshot_multiplier, snapshot_threshold_hours FROM sessions WHERE state != 'CERRADA' ORDER BY created_at DESC LIMIT 1`,
      );
      if (!session) return;

      try {
        await this.geofence.unregister(session.id);
      } catch (_e) {
        /* silence error */
      }

      const now = forcedEndTime || new Date().toISOString();

      await this.db.runAsync(
        `UPDATE breaks SET end_time = ? WHERE session_id = ? AND end_time IS NULL`,
        [now, session.id],
      );
      await this.db.runAsync(
        `UPDATE transfers SET end_time = ? WHERE session_id = ? AND end_time IS NULL`,
        [now, session.id],
      );

      const breaks = await this.db.getAllAsync<{
        start_time: string;
        end_time: string | null;
      }>(
        `SELECT start_time, end_time FROM breaks WHERE session_id = ?`,
        [session.id],
      );
      let pauseMinutes = 0;
      for (const b of breaks) {
        if (b.start_time && b.end_time) {
          const diff = Math.round(
            (Date.parse(b.end_time) - Date.parse(b.start_time)) / 60000,
          );
          if (Number.isFinite(diff) && diff > 0) pauseMinutes += diff;
          const dur = Number.isFinite(diff) && diff > 0 ? diff : 0;
          await this.db.runAsync(
            `UPDATE breaks SET duration_minutes = ? WHERE session_id = ? AND start_time = ?`,
            [dur, session.id, b.start_time],
          );
        }
      }

      const transfers = await this.db.getAllAsync<{
        start_time: string;
        end_time: string | null;
      }>(
        `SELECT start_time, end_time FROM transfers WHERE session_id = ?`,
        [session.id],
      );
      let transferMinutes = 0;
      for (const t of transfers) {
        if (t.start_time && t.end_time) {
          const diff = Math.round(
            (Date.parse(t.end_time) - Date.parse(t.start_time)) / 60000,
          );
          if (Number.isFinite(diff) && diff > 0) transferMinutes += diff;
        }
      }

      const startMs = Date.parse(session.start_time);
      const endMs = Date.parse(now);
      let totalMinutes = 0;
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        totalMinutes = Math.round((endMs - startMs) / 60000);
        if (totalMinutes < 0) totalMinutes = 0;
      }
      // Una sola deducción: solo lunchDeductedMinutes (valor real del modal).
      // pauseMinutes se guarda como registro, no se vuelve a restar.
      const netMinutes = Math.max(0, totalMinutes - (lunchDeductedMinutes || 0));

      // P2: payTransferTime es el único toggle de traslado pagado.
      // Si es false, transferMinutes NO entra en paid_minutes ni en total_earnings.
      // No existe columna snapshot_pay_transfer_time, así que se lee vigente con getFreshSettings().
      // Si la lectura falla, se mantiene pagado para no recortar pago por un error de lectura.
      let payTransferTime = true;
      try {
        const fresh = await this.getFreshSettings();
        payTransferTime = fresh.payTransferTime !== false;
      } catch (_error) {
        payTransferTime = true;
      }
      const paidMinutes = payTransferTime
        ? netMinutes
        : Math.max(0, netMinutes - transferMinutes);
      const totalHours = Number((paidMinutes / 60).toFixed(2));

      // Cierre SOLO con snapshot. Nunca con settings en vivo.
      // Fallbacks solo si snapshot es null (sesión vieja sin migración).
      const rate = session.snapshot_rate ?? 20;
      const multiplier = session.snapshot_multiplier ?? 1.5;
      const threshold = session.snapshot_threshold_hours ?? 8;
      const overtimeHours = Number(Math.max(0, totalHours - threshold).toFixed(2));
      const baseHours = Math.max(0, totalHours - overtimeHours);
      const totalEarnings = Number(
        (baseHours * rate + overtimeHours * rate * multiplier).toFixed(2),
      );

      await this.db.runAsync(
        `UPDATE sessions SET state = 'CERRADA', end_time = ?, lunch_deducted_minutes = ?, total_hours = ?, total_earnings = ?, overtime_hours = ?, paid_minutes = ?, pause_minutes = ?, transfer_minutes = ?, updated_at = ? WHERE id = ?`,
        [
          now,
          lunchDeductedMinutes,
          totalHours,
          totalEarnings,
          overtimeHours,
          paidMinutes,
          pauseMinutes,
          transferMinutes,
          now,
          session.id,
        ],
      );
      this.notifyStateChange();
    })) as void;
  }

  async cancelSession(): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sessions WHERE state != 'CERRADA'`,
      );
      if (!session) return;

      try {
        await this.geofence.unregister(session.id);
      } catch (_e) {
        /* silence error */
      }
      await this.db.runAsync(`DELETE FROM sessions WHERE id = ?`, [session.id]);
      this.notifyStateChange();
    })) as void;
  }
}

export const sessionEngineService = new SessionEngine();
