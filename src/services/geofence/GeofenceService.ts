// ============================================================
// SERVICE: GeofenceService — Control nativo de geocercas (V2.2.0)
// Responsabilidad: Gestión de geolocalización en background, 
// resolución de destinos, cálculos espaciales y bus de eventos Headless.
// Arquitectura: 100% Desacoplada (Evita dependencias circulares).
// ============================================================

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type {
  Coordinates,
  ExitValidationResult,
  GeofenceConfig,
  GeofenceEvent,
  IGeofenceService,
} from '../../types/contracts';

// IMPORTANTE:
// Este nombre debe permanecer estable entre versiones de la app.
// Cambiarlo puede dejar una tarea registrada con el nombre anterior.
const GEOFENCE_TASK_NAME = 'WTRACKER_BACKGROUND_GEOFENCE_TASK';

const MINIMUM_GEOFENCE_RADIUS_METERS = 10;
const DEFAULT_DESTINATION_RADIUS_METERS = 100;
const EXIT_DEBOUNCE_MS = 2 * 60 * 1000; // 2 Minutos de antirruido GPS

type GeofenceListener = (
  event: GeofenceEvent,
  identifier: string
) => void | Promise<void>;

type GeofencingTaskData = {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
};

// ── BUS GLOBAL DE EVENTOS NATIVOS ─────────────────────────────
//
// Se mantiene fuera de la clase para que la tarea global pueda
// publicar eventos sin importar SessionEngineService ni crear
// una dependencia circular.
//
const nativeEventListeners = new Set<GeofenceListener>();

async function dispatchNativeGeofenceEvent(
  event: GeofenceEvent,
  identifier: string
): Promise<void> {
  const activeListeners = Array.from(nativeEventListeners);

  if (activeListeners.length === 0) {
    console.info(
      `[Geofence Task] Evento ${event} recibido sin listeners activos: ${identifier}`
    );
    return;
  }

  const results = await Promise.allSettled(
    activeListeners.map((listener) =>
      Promise.resolve(listener(event, identifier))
    )
  );

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('[Geofence Listener Error]', result.reason);
    }
  });
}

// ── TAREA GLOBAL DE SEGUNDO PLANO ─────────────────────────────
//
// TaskManager exige que defineTask se ejecute en el ámbito global
// del bundle y no dentro de un componente, hook o método.
//
try {
  if (!TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
    TaskManager.defineTask<GeofencingTaskData>(
      GEOFENCE_TASK_NAME,
      async ({ data, error }) => {
        if (error) {
          console.error('[Background Geofence Task Error]', error);
          return;
        }

        if (!data?.region?.identifier) {
          console.warn(
            '[Background Geofence Task] Evento recibido sin una región válida.'
          );
          return;
        }

        const { eventType, region } = data;
        const identifier = typeof region.identifier === 'string' ? region.identifier.trim() : '';

        let event: GeofenceEvent;

        switch (eventType) {
          case Location.GeofencingEventType.Enter:
            event = 'ENTER';
            break;

          case Location.GeofencingEventType.Exit:
            event = 'EXIT';
            break;

          default:
            console.warn(
              '[Background Geofence Task] Tipo de evento desconocido:',
              eventType
            );
            return;
        }

        console.log(
          `[Background Geofence] ${event} detectado en: ${identifier}`
        );

        try {
          await dispatchNativeGeofenceEvent(event, identifier);
        } catch (dispatchError) {
          console.error(
            '[Background Geofence Task Dispatch Error]',
            dispatchError
          );
        }
      }
    );
  }
} catch (error) {
  // Protege Fast Refresh y Hot Reload, donde el módulo puede
  // evaluarse más de una vez durante el desarrollo.
  console.warn(
    '[Geofence Task] No se pudo definir o ya estaba definida.',
    error
  );
}

// ── SERVICIO PRINCIPAL ────────────────────────────────────────

export class GeofenceService implements IGeofenceService {
  private readonly callbacks = new Set<GeofenceListener>();
  private exitDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingExitIdentifier: string | null = null;
  private disposed = false;

  private readonly nativeListener: GeofenceListener = async (
    event,
    identifier
  ) => {
    this.emitEvent(event, identifier);
  };

  constructor() {
    nativeEventListeners.add(this.nativeListener);
  }

  /**
   * Registra una geocerca en el sistema operativo.
   *
   * Expo administra todas las regiones asociadas al nombre de tarea
   * proporcionado. Esta implementación reemplaza cualquier registro
   * previo antes de registrar la nueva configuración.
   */
  async register(config: GeofenceConfig): Promise<void> {
    this.assertNotDisposed();
    this.validateConfig(config);

    const isAvailable = await Location.isBackgroundLocationAvailableAsync();
    if (!isAvailable) {
      throw new Error(
        'El monitoreo de ubicación en segundo plano no está disponible en este dispositivo.'
      );
    }

    const permissionStatus = await this.getPermissionStatus();
    if (permissionStatus !== 'GRANTED') {
      const permissionsGranted = await this.requestPermissions();
      if (!permissionsGranted) {
        throw new Error(
          'Se requieren permisos de ubicación en primer y segundo plano para registrar la geocerca.'
        );
      }
    }

    try {
      const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      if (isRunning) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      }

      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
        {
          identifier: config.identifier,
          latitude: config.latitude,
          longitude: config.longitude,
          radius: config.radius,
          notifyOnEnter: true,
          notifyOnExit: true,
        },
      ]);

      console.log(
        `[Geofence] Registrada con éxito: ${config.identifier} (${config.radius}m)`
      );
    } catch (error) {
      console.error('[Geofence Register Failed]', error);
      throw error;
    }
  }

  /**
   * Elimina del sistema operativo todas las regiones asociadas
   * con la tarea de geofencing.
   *
   * El identificador es opcional porque Expo detiene la tarea
   * completa, no una región individual.
   */
  async unregister(identifier?: string): Promise<void> {
    this.clearExitDebounce();

    try {
      const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      if (!isRunning) {
        return;
      }

      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);

      console.log(
        identifier
          ? `[Geofence] Removida del OS: ${identifier}`
          : '[Geofence] Geofencing removido del OS'
      );
    } catch (error) {
      console.warn(
        identifier
          ? `[Geofence Unregister Warning] No se pudo remover ${identifier}`
          : '[Geofence Unregister Warning] No se pudo detener el geofencing',
        error
      );
    }
  }

  // ── REEMPLAZO DINÁMICO DE GEOCERCAS (HOT-SWAP) ───────────────────

  async replaceGeofence(config: GeofenceConfig): Promise<void>;
  async replaceGeofence(oldIdentifier: string, newConfig: GeofenceConfig): Promise<void>;
  async replaceGeofence(
    configOrIdentifier: string | GeofenceConfig,
    newConfigParameter?: GeofenceConfig
  ): Promise<void> {
    this.assertNotDisposed();

    const oldIdentifier =
      typeof configOrIdentifier === 'string'
        ? configOrIdentifier
        : configOrIdentifier.identifier;

    const newConfig =
      typeof configOrIdentifier === 'string'
        ? newConfigParameter
        : configOrIdentifier;

    if (!newConfig) {
      throw new Error(
        'Se requiere una configuración válida para reemplazar la geocerca.'
      );
    }

    this.validateConfig(newConfig);

    console.log(
      `[Geofence] Reemplazando ${oldIdentifier} por ${newConfig.identifier}...`
    );

    try {
      await this.unregister(oldIdentifier);
      await this.register(newConfig);
    } catch (error) {
      console.error('[Geofence replaceGeofence Failed]', error);
      throw error;
    }
  }

  /**
   * Geocodifica una dirección y, cuando se proporciona sessionId,
   * registra la ubicación como siguiente destino.
   */
  async registerNextDestination(
    address: string,
    sessionId?: string
  ): Promise<Coordinates | null> {
    this.assertNotDisposed();

    const coordinates = await this.geocodeAddress(address);

    if (!coordinates) {
      return null;
    }

    if (sessionId) {
      const normalizedSessionId = sessionId.trim();

      if (!normalizedSessionId) {
        throw new Error('El identificador de sesión no puede estar vacío.');
      }

      await this.replaceGeofence(normalizedSessionId, {
        identifier: normalizedSessionId,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        radius: DEFAULT_DESTINATION_RADIUS_METERS,
      });
    }

    return coordinates;
  }

  /**
   * Suscribe un callback a los eventos confirmados del servicio.
   * Devuelve una función idempotente para cancelar la suscripción.
   */
  onEvent(callback: GeofenceListener): () => void {
    this.assertNotDisposed();
    this.callbacks.add(callback);

    let subscribed = true;
    return () => {
      if (!subscribed) {
        return;
      }
      subscribed = false;
      this.callbacks.delete(callback);
    };
  }

  /**
   * Procesa eventos nativos y aplica debounce a EXIT.
   *
   * ENTER se distribuye inmediatamente.
   * EXIT se distribuye después del periodo de gracia.
   * Un ENTER durante dicho periodo cancela el EXIT pendiente.
   */
  emitEvent(event: GeofenceEvent, identifier: string): void {
    if (this.disposed) {
      return;
    }

    if (!identifier) {
      console.warn('[Geofence] Evento ignorado por falta de identificador.');
      return;
    }

    if (event === 'ENTER') {
      if (this.exitDebounceTimer) {
        console.log(
          '[Geofence] Salida cancelada: reingreso detectado dentro del periodo de gracia.'
        );
        this.clearExitDebounce();
      }

      void this.triggerCallbacks('ENTER', identifier);
      return;
    }

    if (event === 'EXIT') {
      this.clearExitDebounce();
      this.pendingExitIdentifier = identifier;

      this.exitDebounceTimer = setTimeout(() => {
        const confirmedIdentifier = this.pendingExitIdentifier;

        this.exitDebounceTimer = null;
        this.pendingExitIdentifier = null;

        if (!confirmedIdentifier || this.disposed) {
          return;
        }

        console.log(
          `[Geofence] Salida confirmada tras debounce: ${confirmedIdentifier}`
        );

        void this.triggerCallbacks('EXIT', confirmedIdentifier);
      }, EXIT_DEBOUNCE_MS);

      return;
    }
    
    console.warn('[Geofence] Evento desconocido ignorado:', event);
  }

  async getCurrentLocation(): Promise<Coordinates | null> {
    this.assertNotDisposed();

    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      if (foreground.status !== Location.PermissionStatus.GRANTED) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
    } catch (error) {
      console.warn('[Geofence] Error obteniendo ubicación actual', error);
      return null;
    }
  }

  async geocodeAddress(address: string): Promise<Coordinates | null> {
    this.assertNotDisposed();

    const normalizedAddress = address.trim();
    if (!normalizedAddress) {
      return null;
    }

    try {
      const results = await Location.geocodeAsync(normalizedAddress);
      const firstResult = results[0];

      if (!firstResult) {
        return null;
      }

      return {
        lat: firstResult.latitude,
        lng: firstResult.longitude,
      };
    } catch (error) {
      console.warn(
        `[Geofence] No se pudo geocodificar la dirección: ${normalizedAddress}`,
        error
      );
      return null;
    }
  }

  async validateExitByCurrentLocation(params: {
    center: Coordinates;
    radiusMeters: number;
  }): Promise<ExitValidationResult | null> {
    this.assertNotDisposed();
    this.validateCoordinates(params.center);

    if (!Number.isFinite(params.radiusMeters) || params.radiusMeters <= 0) {
      throw new Error('El radio de validación debe ser un número mayor que cero.');
    }

    const currentLocation = await this.getCurrentLocation();
    if (!currentLocation) {
      return null;
    }

    const distance = this.calculateDistanceMeters(params.center, currentLocation);

    return {
      isOutside: distance > radiusMeters,
      distance: Math.round(distance),
      distanceMeters: Math.round(distance),
      radiusMeters,
    };
  }

  async getPermissionStatus(): Promise<'GRANTED' | 'DENIED' | 'NOT_DETERMINED'> {
    try {
      const background = await Location.getBackgroundPermissionsAsync();
      if (background.status === Location.PermissionStatus.GRANTED) {
        return 'GRANTED';
      }

      const foreground = await Location.getForegroundPermissionsAsync();
      if (foreground.status === Location.PermissionStatus.GRANTED) {
        return 'GRANTED';
      }

      if (
        background.status === Location.PermissionStatus.DENIED ||
        foreground.status === Location.PermissionStatus.DENIED
      ) {
        return 'DENIED';
      }

      return 'NOT_DETERMINED';
    } catch (error) {
      console.warn('[Geofence] No se pudo consultar el estado de permisos.', error);
      return 'NOT_DETERMINED';
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== Location.PermissionStatus.GRANTED) {
        return false;
      }

      const background = await Location.requestBackgroundPermissionsAsync();
      return background.status === Location.PermissionStatus.GRANTED;
    } catch (error) {
      console.warn('[Geofence] Error solicitando permisos de ubicación.', error);
      return false;
    }
  }

  /**
   * Libera listeners y temporizadores internos.
   *
   * No detiene automáticamente la geocerca del sistema operativo.
   * Para eso debe llamarse unregister() antes de dispose().
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.clearExitDebounce();
    this.callbacks.clear();
    nativeEventListeners.delete(this.nativeListener);
  }

  private async triggerCallbacks(
    event: GeofenceEvent,
    identifier: string
  ): Promise<void> {
    const activeCallbacks = Array.from(this.callbacks);

    const results = await Promise.allSettled(
      activeCallbacks.map((callback) =>
        Promise.resolve(callback(event, identifier))
      )
    );

    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.error('[Geofence Callback Error]', result.reason);
      }
    });
  }

  private clearExitDebounce(): void {
    if (this.exitDebounceTimer) {
      clearTimeout(this.exitDebounceTimer);
      this.exitDebounceTimer = null;
    }
    this.pendingExitIdentifier = null;
  }

  private validateConfig(config: GeofenceConfig): void {
    if (!config.identifier?.trim()) {
      throw new Error('El identificador de la geocerca no puede estar vacío.');
    }

    this.validateCoordinates({
      lat: config.latitude,
      lng: config.longitude,
    });

    if (!Number.isFinite(config.radius)) {
      throw new Error('El radio de la geocerca debe ser un número válido.');
    }

    if (config.radius < MINIMUM_GEOFENCE_RADIUS_METERS) {
      throw new Error(`Radio mínimo de geocerca: ${MINIMUM_GEOFENCE_RADIUS_METERS} metros.`);
    }
  }

  private validateCoordinates(coordinates: Coordinates): void {
    if (!Number.isFinite(coordinates.lat) || coordinates.lat < -90 || coordinates.lat > 90) {
      throw new Error('La latitud debe ser un número entre -90 y 90.');
    }

    if (!Number.isFinite(coordinates.lng) || coordinates.lng < -180 || coordinates.lng > 180) {
      throw new Error('La longitud debe ser un número entre -180 y 180.');
    }
  }

  private calculateDistanceMeters(from: Coordinates, to: Coordinates): number {
    const earthRadiusMeters = 6_371_000;

    const deltaLatitude = this.toRadians(to.lat - from.lat);
    const deltaLongitude = this.toRadians(to.lng - from.lng);

    const fromLatitude = this.toRadians(from.lat);
    const toLatitude = this.toRadians(to.lat);

    const haversine =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(fromLatitude) *
        Math.cos(toLatitude) *
        Math.sin(deltaLongitude / 2) ** 2;

    const normalizedHaversine = Math.min(1, Math.max(0, haversine));

    const angularDistance =
      2 * Math.atan2(Math.sqrt(normalizedHaversine), Math.sqrt(1 - normalizedHaversine));

    return earthRadiusMeters * angularDistance;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('GeofenceService ya fue liberado y no puede reutilizarse.');
    }
  }
}

export const geofenceService = new GeofenceService();

