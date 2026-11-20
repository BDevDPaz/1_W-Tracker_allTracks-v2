import * as Crypto from "expo-crypto";
import {
  DatabaseService,
  sessionRepository,
} from "@/services/database/DatabaseService";
import { geofenceService } from "@/services/geofence/GeofenceService";
import { settingsService } from "@/services/settings/SettingsService";
import type { Session } from "@/types/contracts";
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

      const settings = await settingsService.load();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const today = now.split("T")[0];

      await this.db.runAsync(
        `INSERT INTO sessions (id, date, start_time, state, destination, alias, snapshot_rate, integrity_type, created_at, updated_at)
         VALUES (?, ?, ?, 'ESPERANDO', ?, ?, ?, 'VALID', ?, ?)`,
        [
          id,
          today,
          now,
          destination,
          alias || destination,
          settings.hourlyRate,
          now,
          now,
        ],
      );

      try {
        const alreadyInside = await this.geofence.register({
          identifier: id,
          radius: settings.geofenceRadius || 100,
          destination,
        });
        if (alreadyInside) {
         await this.db.runAsync(
           `UPDATE sessions SET state = 'ACTIVA', start_time = ?, updated_at = ? WHERE id = ?`,
           [now, now, id],
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
        await this.db.runAsync(
          `UPDATE sessions SET state = 'ACTIVA', start_time = ?, updated_at = ? WHERE id = ?`,
          [now, now, session.id],
        );
        try {
          const settings = await settingsService.load();
          await this.geofence.register({
            identifier: session.id,
            radius: settings.geofenceRadius || 100,
            destination: session.destination,
          });
        } catch (_error) {
          /* silence error */
        }
      } else if (session.state === "TRASLADO") {
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
            const settings = await settingsService.load();
            await this.geofence.register({
              identifier: session.id,
              radius: settings.geofenceRadius || 100,
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

  async evaluatePendingExits(): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{
        id: string;
        updated_at: string;
      }>(
        `SELECT id, updated_at FROM sessions WHERE state = 'SALIDA' ORDER BY created_at DESC LIMIT 1`,
      );
      if (!session) return;

      const exitTime = new Date(session.updated_at).getTime();
      const now = Date.now();
      const diffMinutes = (now - exitTime) / (1000 * 60);

      if (diffMinutes >= 15) {
        this.queue = new PromiseQueue();
        await this.finishWorkDay(0, session.updated_at);
      }
    })) as void;
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
        const settings = await settingsService.load();
        await this.geofence.register({
          identifier: session.id,
          radius: settings.geofenceRadius || 100,
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
      }>(
        `SELECT id, state, start_time, snapshot_rate FROM sessions WHERE state != 'CERRADA' ORDER BY created_at DESC LIMIT 1`,
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
      const netMinutes = Math.max(0, totalMinutes - (lunchDeductedMinutes || 0));
      const totalHours = Number((netMinutes / 60).toFixed(2));

      let settingsRate: number | undefined;
      let settingsMultiplier: number | undefined;
      try {
        const settings = await settingsService.load();
        settingsRate = settings.hourlyRate;
        settingsMultiplier = settings.overtimeMultiplier;
      } catch (_e) {
        /* usa snapshot_rate y 1.5 por defecto */
      }
      const rate = session.snapshot_rate ?? settingsRate ?? 20;
      const multiplier = settingsMultiplier ?? 1.5;
      const overtimeHours = Number(Math.max(0, totalHours - 8).toFixed(2));
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
          netMinutes,
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
