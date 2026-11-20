import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { DatabaseService } from "@/services/database/DatabaseService";

const GEOFENCE_TASK_NAME = "BACKGROUND_GEOFENCE_TASK";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
        const session = await db.getFirstAsync<{ id: string; state: string }>(
          `SELECT id, state FROM sessions WHERE state != 'CERRADA' ORDER BY created_at DESC LIMIT 1`,
        );

        let shouldNotify = false;

        if (session && session.state === "ESPERANDO") {
          await db.runAsync(
            `UPDATE sessions SET state = 'ACTIVA', start_time = ?, updated_at = ? WHERE id = ?`,
            [exactTimestamp, exactTimestamp, session.id],
          );
          shouldNotify = true;
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
            shouldNotify = true;
          }
        }

        if (shouldNotify) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "📍 Check-in Automático",
              body: "Has llegado a tu destino. Jornada activa.",
              sound: true,
            },
            trigger: null,
          });
        }
      } else if (eventType === Location.GeofencingEventType.Exit) {
        const session = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM sessions WHERE state = 'ACTIVA' ORDER BY created_at DESC LIMIT 1`,
        );
        if (session) {
          await db.runAsync(
            `UPDATE sessions SET state = 'SALIDA', updated_at = ? WHERE id = ?`,
            [exactTimestamp, session.id],
          );

          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🚧 Salida Detectada",
              body: "¿Te diriges a otro destino o has finalizado tu jornada?",
              sound: true,
            },
            trigger: null,
          });
        }
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

  private async resolveDestinationCoords(
    destination?: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (!destination || !destination.trim()) return null;
    const trimmed = destination.trim();
    // CORRECCIÓN: solo "principal" es manual.
    // El alias (ej. Casa Novia) nunca va aquí, va en el campo alias.
    // El destino siempre debe ser la dirección real para poder geocodificar.
    if (trimmed.toLowerCase() === "principal") {
      return null;
    }
    try {
      const results = await Location.geocodeAsync(trimmed);
      if (results.length > 0) {
        const first = results[0]!;
        if (
          typeof first.latitude === "number" &&
          typeof first.longitude === "number"
        ) {
          return {
            latitude: first.latitude,
            longitude: first.longitude,
          };
        }
      }
    } catch (_e) {
      /* geocoding falló, se usa fallback y no se auto-activa */
    }
    return null;
  }

  async isAlreadyInside(
    centerLat: number,
    centerLng: number,
    radius: number,
  ): Promise<boolean> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const distance = haversineMeters(
        location.coords.latitude,
        location.coords.longitude,
        centerLat,
        centerLng,
      );
      return distance <= radius;
    } catch (_e) {
      return false;
    }
  }

  async register({
    identifier,
    radius,
    destination,
    latitude,
    longitude,
  }: {
    identifier: string;
    radius: number;
    destination?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<boolean> {
    const hasPermissions = (await this.getPermissionStatus()) === "GRANTED";
    if (!hasPermissions) return false;

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let centerLat: number;
      let centerLng: number;
      let centerIsKnown = false;

      if (
        typeof latitude === "number" &&
        typeof longitude === "number"
      ) {
        centerLat = latitude;
        centerLng = longitude;
        centerIsKnown = true;
      } else {
        const geocoded = await this.resolveDestinationCoords(destination);
        if (geocoded) {
          centerLat = geocoded.latitude;
          centerLng = geocoded.longitude;
          centerIsKnown = true;
        } else {
          centerLat = current.coords.latitude;
          centerLng = current.coords.longitude;
          centerIsKnown = false;
        }
      }

      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
        {
          identifier,
          latitude: centerLat,
          longitude: centerLng,
          radius: radius,
          notifyOnEnter: true,
          notifyOnExit: true,
        },
      ]);

      if (!centerIsKnown) return false;

      const distance = haversineMeters(
        current.coords.latitude,
        current.coords.longitude,
        centerLat,
        centerLng,
      );
      return distance <= radius;
    } catch (error) {
      console.error("[Geofence] Error al registrar:", error);
      return false;
    }
  }

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
