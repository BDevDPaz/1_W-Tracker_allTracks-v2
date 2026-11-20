import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { DatabaseService } from "@/services/database/DatabaseService";

const GEOFENCE_TASK_NAME = "BACKGROUND_GEOFENCE_TASK";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[GeofenceTask] Error:", error.message);
    return;
  }

  if (data) {
    const { eventType } = data as {
      eventType: Location.GeofencingEventType;
      region: Location.LocationRegion;
    };
    const exactTimestamp = new Date().toISOString();

    try {
      const db = DatabaseService.getDb();

      if (eventType === Location.GeofencingEventType.Enter) {
        // CORRECCIÓN: Tipado de DB Row
        const session = await db.getFirstAsync<{ id: string; state: string }>(
          `SELECT id, state FROM sessions WHERE state != 'CERRADA' ORDER BY created_at DESC LIMIT 1`,
        );
        if (session && session.state === "ESPERANDO") {
          await db.runAsync(
            `UPDATE sessions SET state = 'ACTIVA', start_time = ?, updated_at = ? WHERE id = ?`,
            [exactTimestamp, exactTimestamp, session.id],
          );
        } else if (session && session.state === "TRASLADO") {
          const openTransfer = await db.getFirstAsync<{
            id: string;
            target_destination: string;
          }>(
            `SELECT id, target_destination FROM transfers WHERE session_id = ? AND end_time IS NULL`,
            [session.id],
          );
          if (openTransfer) {
            await db.runAsync(
              `UPDATE transfers SET end_time = ? WHERE id = ?`,
              [exactTimestamp, openTransfer.id],
            );
            await db.runAsync(
              `UPDATE sessions SET state = 'ACTIVA', destination = ?, alias = ?, updated_at = ? WHERE id = ?`,
              [
                openTransfer.target_destination,
                openTransfer.target_destination,
                exactTimestamp,
                session.id,
              ],
            );
          }
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title: "📍 Check-in Automático",
            body: "Has llegado a tu destino. Jornada activa.",
            sound: true,
          },
          trigger: null,
        });
      } else if (eventType === Location.GeofencingEventType.Exit) {
        const session = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM sessions WHERE state = 'ACTIVA' ORDER BY created_at DESC LIMIT 1`,
        );
        if (session) {
          await db.runAsync(
            `UPDATE sessions SET state = 'SALIDA', updated_at = ? WHERE id = ?`,
            [exactTimestamp, session.id],
          );
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🚧 Salida Detectada",
            body: "¿Te diriges a otro destino o has finalizado tu jornada?",
            sound: true,
          },
          trigger: null,
        });
      }
    } catch (dbError) {
      console.error("[GeofenceTask DB Error]:", dbError);
    }
  }
});

class GeofenceService {
  async getPermissionStatus(): Promise<"GRANTED" | "DENIED" | "ERROR"> {
    try {
      const { status: fgStatus } =
        await Location.getForegroundPermissionsAsync();
      const { status: bgStatus } =
        await Location.getBackgroundPermissionsAsync();
      return fgStatus === "granted" && bgStatus === "granted"
        ? "GRANTED"
        : "DENIED";
    } catch {
      return "ERROR";
    }
  }

  async requestPermissions(): Promise<boolean> {
    const { status: fgStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") return false;
    const { status: bgStatus } =
      await Location.requestBackgroundPermissionsAsync();
    return bgStatus === "granted";
  }

  async register({
    identifier,
    radius,
  }: {
    identifier: string;
    radius: number;
  }): Promise<void> {
    const hasPermissions = (await this.getPermissionStatus()) === "GRANTED";
    if (!hasPermissions) return;

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
        {
          identifier,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          radius: radius,
          notifyOnEnter: true,
          notifyOnExit: true,
        },
      ]);
    } catch (error) {
      console.error("[Geofence] Error al registrar:", error);
    }
  }

  // CORRECCIÓN: variable prefix con underscore
  async unregister(_identifier: string): Promise<void> {
    try {
      const isRegistered =
        await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
      if (isRegistered) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      }
    } catch (error) {
      console.error("[Geofence] Error al detener:", error);
    }
  }
}

export const geofenceService = new GeofenceService();
