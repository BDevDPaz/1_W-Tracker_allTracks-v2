import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { DatabaseService } from "@/services/database/DatabaseService";

const GEOFENCE_TASK_NAME = "BACKGROUND_GEOFENCE_TASK";

// Dwell / debounce: ignora eventos duplicados del OS en esta ventana.
const DWELL_MS = 120000;
// Histéresis: Enter más estricto, Exit más estricto, para no parpadear en el borde.
const ENTER_FACTOR = 0.85;
const EXIT_FACTOR = 1.15;
const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

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

interface GeofenceEventRow {
  id: string;
  identifier: string;
  event_type: string;
  timestamp: string;
  distance_meters: number | null;
  accuracy_meters: number | null;
  processed: number;
  created_at: string;
}

export interface PendingGeofenceEvent {
  id: string;
  identifier: string;
  eventType: "ENTER" | "EXIT";
  timestamp: string;
  distanceMeters: number | null;
  accuracyMeters: number | null;
}

async function ensureGeofenceEventsTable(
  db: ReturnType<typeof DatabaseService.getDb>,
): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS geofence_events (
      id TEXT PRIMARY KEY NOT NULL,
      identifier TEXT NOT NULL,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      distance_meters REAL,
      accuracy_meters REAL,
      processed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_geofence_events_processed ON geofence_events(processed, timestamp);
  `);
}

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[GeofenceTask] Error:", error.message);
    return;
  }

  if (!data) return;

  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };

  const exactTimestamp = new Date().toISOString();
  const identifier = region?.identifier ?? GEOFENCE_TASK_NAME;
  const centerLat = region?.latitude;
  const centerLng = region?.longitude;
  const radius = region?.radius;

  if (
    typeof centerLat !== "number" ||
    typeof centerLng !== "number" ||
    typeof radius !== "number" ||
    radius < 10
  ) {
    return;
  }

  try {
    await DatabaseService.initialize();
    const db = DatabaseService.getDb();
    await ensureGeofenceEventsTable(db);

    // Validación con posición fresca, no con el evento del OS sin verificar.
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const accuracy = location.coords.accuracy ?? null;
    // Si la precisión es peor que el radio, la lectura no es confiable.
    if (accuracy != null && accuracy > Math.max(MAX_ACCEPTABLE_ACCURACY_METERS, radius)) {
      return;
    }

    const distance = haversineMeters(
      location.coords.latitude,
      location.coords.longitude,
      centerLat,
      centerLng,
    );

    // Histéresis: Enter exige estar bien dentro, Exit exige estar bien fuera.
    if (eventType === Location.GeofencingEventType.Enter) {
      if (distance > radius * ENTER_FACTOR) return;
    } else if (eventType === Location.GeofencingEventType.Exit) {
      if (distance < radius * EXIT_FACTOR) return;
    } else {
      return;
    }

    // Dwell / debounce: si ya hay un evento igual reciente, no duplicar.
    const lastEvent = await db.getFirstAsync<GeofenceEventRow>(
      `SELECT * FROM geofence_events WHERE identifier = ? AND event_type = ? ORDER BY timestamp DESC LIMIT 1`,
      [identifier, eventType === Location.GeofencingEventType.Enter ? "ENTER" : "EXIT"],
    );
    if (lastEvent) {
      const lastMs = Date.parse(lastEvent.timestamp);
      if (!Number.isNaN(lastMs) && Date.parse(exactTimestamp) - lastMs < DWELL_MS) {
        return;
      }
    }

    const eventTypeStr =
      eventType === Location.GeofencingEventType.Enter ? "ENTER" : "EXIT";

    // Delegación: Geofence solo encola. Engine decide y muta sessions con snapshot.
    await db.runAsync(
      `INSERT INTO geofence_events (id, identifier, event_type, timestamp, distance_meters, accuracy_meters, processed, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        Crypto.randomUUID(),
        identifier,
        eventTypeStr,
        exactTimestamp,
        distance,
        accuracy,
        exactTimestamp,
      ],
    );

    // Notificación inmediata, pero solo después de validar distancia, precisión, histéresis y dwell.
    if (eventTypeStr === "ENTER") {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "📍 Check-in Automático",
          body: "Has llegado a tu destino. Jornada activa.",
          sound: true,
        },
        trigger: null,
      });
    } else {
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
      /* geocoding falló, no se registra geofence falso */
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
        accuracy: Location.Accuracy.High,
      });
      const accuracy = location.coords.accuracy ?? null;
      if (accuracy != null && accuracy > Math.max(MAX_ACCEPTABLE_ACCURACY_METERS, radius)) {
        return false;
      }
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
    if (!identifier || !identifier.trim()) return false;
    if (!Number.isFinite(radius) || radius < 10) return false;

    const hasPermissions = (await this.getPermissionStatus()) === "GRANTED";
    if (!hasPermissions) return false;

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
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
          // Sin centro real, no se registra geofence falso centrado en el usuario.
          return false;
        }
      }

      // Limpia geofence previo para no dejar geofences viejos activos.
      try {
        const isRegistered =
          await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
        if (isRegistered) {
          await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        }
      } catch (_e) {}

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

      const accuracy = current.coords.accuracy ?? null;
      if (accuracy != null && accuracy > Math.max(MAX_ACCEPTABLE_ACCURACY_METERS, radius)) {
        return false;
      }

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

  // --- Cola para Engine ---
  async getPendingGeofenceEvents(): Promise<PendingGeofenceEvent[]> {
    await DatabaseService.initialize();
    const db = DatabaseService.getDb();
    await ensureGeofenceEventsTable(db);
    const rows = await db.getAllAsync<GeofenceEventRow>(
      `SELECT * FROM geofence_events WHERE processed = 0 ORDER BY timestamp ASC`,
    );
    return rows.map((r) => ({
      id: r.id,
      identifier: r.identifier,
      eventType: r.event_type === "ENTER" ? "ENTER" : "EXIT",
      timestamp: r.timestamp,
      distanceMeters: r.distance_meters,
      accuracyMeters: r.accuracy_meters,
    }));
  }

  async markGeofenceEventProcessed(id: string): Promise<void> {
    await DatabaseService.initialize();
    const db = DatabaseService.getDb();
    await db.runAsync(
      `UPDATE geofence_events SET processed = 1 WHERE id = ?`,
      [id],
    );
  }
}

export const geofenceService = new GeofenceService();
