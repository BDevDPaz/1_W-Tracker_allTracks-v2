import * as Crypto from "expo-crypto";
import {
  DatabaseService,
  sessionRepository,
} from "@/services/database/DatabaseService";
import { geofenceService } from "@/services/geofence/GeofenceService";
import { settingsService } from "@/services/settings/SettingsService";
// CORRECCIÓN: Se eliminaron SessionState, Transfer y Break para evitar "is defined but never used"
import type { Session } from "@/types/contracts";

class PromiseQueue {
  // CORRECCIÓN: Reemplazado any por unknown
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
      this.notifyStateChange();
    })) as void;
  }

  async confirmArrival(exactTime?: string): Promise<void> {
    return (await this.queue.enqueue(async () => {
      const session = await this.db.getFirstAsync<{
        id: string;
        state: string;
      }>(
        `SELECT id, state FROM sessions WHERE state != 'CERRADA' ORDER BY created_at DESC LIMIT 1`,
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
      const session = await this.db.getFirstAsync<{ id: string }>(
        `SELECT id FROM sessions WHERE state = 'TRASLADO'`,
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
      await this.db.runAsync(
        `UPDATE breaks SET end_time = ? WHERE session_id = ? AND end_time IS NULL`,
        [now, session.id],
      );
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
      }>(
        `SELECT id, state FROM sessions WHERE state != 'CERRADA' ORDER BY created_at DESC LIMIT 1`,
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

      await this.db.runAsync(
        `UPDATE sessions SET state = 'CERRADA', end_time = ?, lunch_deducted_minutes = ?, updated_at = ? WHERE id = ?`,
        [now, lunchDeductedMinutes, now, session.id],
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
