// ============================================================
// SERVICE: SessionEngineService — Motor de jornadas V2.2
// Ruta: src/services/sessionEngine/SessionEngineService.ts
// Versión: 2.2.0 (Workday Tracking Platform)
//
// Responsabilidades:
// - Máquina de estados de jornadas.
// - Registro de llegadas, pausas, traslados y destinos.
// - Integración desacoplada con geocercas.
// - Persistencia relacional mediante SessionRepository.
// - Registro de eventos en Write-Ahead Log.
// - Rehidratación después de cierres inesperados.
// - Cálculo de horas, horas extra y ganancias.
// - Detección de drift temporal.
// - Compatibilidad con las API V2.0 y V2.2.
// ============================================================

import * as Crypto from 'expo-crypto';

import type {
  Break,
  DestinationVisit,
  ISessionEngineService,
  RehydrationResult,
  Session,
  SessionStartLocation,
  SessionState,
  StartSessionPayload,
  TimelineEvent,
  Transfer,
  UserSettings,
} from '../../types/contracts';

import {
  DatabaseService,
  sessionRepository,
} from '../database/DatabaseService';

import { geofenceService } from '../geofence/GeofenceService';
import { settingsService } from '../settings/SettingsService';

// ── CONSTANTES ──────────────────────────────────────────────

const FOREGROUND_EXIT_DEBOUNCE_MS = 2 * 60 * 1000;
const DEFAULT_DESTINATION = 'Sitio Principal';
const DEFAULT_GEOFENCE_RADIUS_METERS = 100;
const DEFAULT_BASE_WORK_HOURS = 8;
const DEFAULT_HOURLY_RATE = 20;
const DEFAULT_OVERTIME_MULTIPLIER = 1.5;

type SessionEngineListener = (
  state: SessionState,
  session: Session | null
) => void;

type WALEventPayload = Record<string, unknown>;

type StartSessionInput =
  | StartSessionPayload
  | SessionStartLocation
  | undefined;

type CloseSessionInput = number | string | undefined;

// ── SERVICIO PRINCIPAL ──────────────────────────────────────

export class SessionEngineService
  implements ISessionEngineService
{
  private currentState: SessionState = 'NO_INICIADA';

  private activeSession: Session | null = null;

  private readonly listeners =
    new Set<SessionEngineListener>();

  private foregroundExitDetectedAt: number | null = null;

  private lastPaidMinutes = 0;

  private lastPauseMinutes = 0;

  private lastTransferMinutes = 0;

  private disposed = false;

  private readonly unsubscribeGeofence: () => void;

  constructor() {
    this.unsubscribeGeofence = geofenceService.onEvent(
      async (event, identifier) => {
        const session = this.activeSession;

        if (!session || session.id !== identifier) {
          return;
        }

        if (event === 'ENTER') {
          await this.onGeofenceEnter();
          return;
        }

        await this.onGeofenceExit();
      }
    );
  }

  // ═════════════════════════════════════════════════════════
  // 1. OBSERVER API
  // ═════════════════════════════════════════════════════════

  subscribe(listener: SessionEngineListener): () => void {
    this.assertNotDisposed();

    this.listeners.add(listener);

    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.cloneSession(this.activeSession);

    for (const listener of this.listeners) {
      try {
        listener(this.currentState, snapshot);
      } catch (error) {
        console.error(
          '[SessionEngine Listener Error]',
          error
        );
      }
    }
  }

  // ═════════════════════════════════════════════════════════
  // 2. READ API
  // ═════════════════════════════════════════════════════════

  getCurrentState(): SessionState {
    return this.currentState;
  }

  getActiveSession(): Session | null {
    return this.cloneSession(this.activeSession);
  }

  // ═════════════════════════════════════════════════════════
  // 3. SESSION START
  // ═════════════════════════════════════════════════════════

  async startSession(
    payload: StartSessionPayload
  ): Promise<Session>;

  async startSession(
    location?: SessionStartLocation
  ): Promise<Session>;

  async startSession(
    input?: StartSessionInput
  ): Promise<Session> {
    this.assertNotDisposed();

    if (
      this.activeSession ||
      this.currentState !== 'NO_INICIADA'
    ) {
      throw new Error(
        'Ya existe una jornada activa o pendiente.'
      );
    }

    const persistedActive =
      await sessionRepository.getActive();

    if (persistedActive) {
      throw new Error(
        'Existe una jornada activa en la base de datos. ' +
          'Ejecuta rehydrateFromWAL() antes de iniciar otra.'
      );
    }

    const settings = await settingsService.load();
    const normalizedInput =
      await this.normalizeStartInput(input, settings);

    const now = new Date();
    const sessionId = Crypto.randomUUID();
    const date = this.getLocalDate(now);
    const startTime = this.getCurrentTimeHHMM(now);

    let coordinates = normalizedInput.location
      ? {
          lat: normalizedInput.location.lat,
          lng: normalizedInput.location.lng,
        }
      : null;

    let locationSource = normalizedInput.location
      ? 'PROVIDED_LOCATION'
      : 'UNKNOWN';

    if (!coordinates && normalizedInput.destination) {
      coordinates = await geofenceService.geocodeAddress(
        normalizedInput.destination
      );

      if (coordinates) {
        locationSource = 'GEOCODED_DESTINATION';
      }
    }

    if (!coordinates) {
      coordinates =
        await geofenceService.getCurrentLocation();

      if (coordinates) {
        locationSource = 'CURRENT_LOCATION_FALLBACK';
      }
    }

    const radius =
      normalizedInput.location?.radius ??
      settings.geofenceRadius ??
      DEFAULT_GEOFENCE_RADIUS_METERS;

    const timelineEvent = this.createTimelineEvent(
      'ESPERANDO',
      `Jornada configurada para ${
        normalizedInput.alias ||
        normalizedInput.destination
      }`,
      'pending',
      {
        source: 'SessionEngineService.startSession',
        locationSource,
      }
    );

    const session: Session = {
      id: sessionId,
      date,
      destination: normalizedInput.destination,
      alias: normalizedInput.alias,
      startTime,
      endTime: '',
      totalHours: 0,
      lunchDeductedMinutes: 0,
      overtimeHours: 0,
      snapshotRate: settings.hourlyRate,
      totalEarnings: 0,
      integrityType: 'VALID',
      state: 'ESPERANDO',
      timelineEvents: [timelineEvent],
      visits: [],
      transfers: [],
      breaks: [],
      paidMinutes: 0,
      pauseMinutes: 0,
      transferMinutes: 0,
      destinationCount: 1,
      _lat: coordinates?.lat,
      _lng: coordinates?.lng,
      _radius: coordinates ? radius : undefined,
      _deviceStatus: locationSource,
    };

    const created = await sessionRepository.create(session);

    this.activeSession = created;
    this.currentState = created.state;
    this.resetRuntimeMetrics(created);

    try {
      if (
        coordinates &&
        Number.isFinite(radius) &&
        radius > 0
      ) {
        await geofenceService.register({
          identifier: sessionId,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          radius,
        });
      }
    } catch (error) {
      console.warn(
        '[SessionEngine] La jornada fue creada, pero no pudo registrarse la geocerca.',
        error
      );
    }

    await this.writeWAL(sessionId, 'START_SESSION', {
      destination: normalizedInput.destination,
      alias: normalizedInput.alias ?? null,
      locationSource,
      latitude: coordinates?.lat ?? null,
      longitude: coordinates?.lng ?? null,
      radius: coordinates ? radius : null,
    });

    this.emit();

    return this.requireSessionSnapshot();
  }

  async confirmArrival(): Promise<void> {
    const session = this.requireActiveSession();

    if (this.currentState !== 'ESPERANDO') {
      return;
    }

    const now = new Date();
    const enterTime = this.getCurrentTimeHHMM(now);

    const visit: DestinationVisit = {
      id: Crypto.randomUUID(),
      sessionId: session.id,
      destination: session.destination,
      alias: session.alias,
      enterTime,
      lat: session._lat,
      lng: session._lng,
    };

    session.startTime = enterTime;
    session.visits = [...(session.visits ?? []), visit];

    session.timelineEvents.push(
      this.createTimelineEvent(
        'ACTIVA',
        `Llegada confirmada a ${
          session.alias || session.destination
        }`,
        'active'
      )
    );

    session.state = 'ACTIVA';
    this.currentState = 'ACTIVA';
    this.foregroundExitDetectedAt = null;

    this.updateMetrics();

    this.activeSession = await sessionRepository.update(
      session.id,
      {
        startTime: enterTime,
        state: 'ACTIVA',
        visits: session.visits,
        timelineEvents: session.timelineEvents,
        paidMinutes: this.lastPaidMinutes,
        pauseMinutes: this.lastPauseMinutes,
        transferMinutes: this.lastTransferMinutes,
      }
    );

    await this.writeWAL(
      session.id,
      'CONFIRM_ARRIVAL',
      { enterTime }
    );

    this.emit();
  }

  // ═════════════════════════════════════════════════════════
  // 4. PAUSES AND LUNCH
  // ═════════════════════════════════════════════════════════

  async startLunch(): Promise<void> {
    const session = this.requireActiveSession();

    if (
      this.currentState !== 'ACTIVA' &&
      this.currentState !== 'SALIDA'
    ) {
      return;
    }

    const startTime = this.getCurrentTimeHHMM();

    this.closeOpenVisit(session, startTime);

    const workBreak: Break = {
      id: Crypto.randomUUID(),
      sessionId: session.id,
      startTime,
      durationMinutes: 0,
      isPaid: false,
    };

    session.breaks = [
      ...(session.breaks ?? []),
      workBreak,
    ];

    session.timelineEvents.push(
      this.createTimelineEvent(
        'PAUSADA',
        'Almuerzo o pausa iniciada',
        'warning'
      )
    );

    session.state = 'PAUSADA';
    this.currentState = 'PAUSADA';
    this.foregroundExitDetectedAt = null;

    this.updateMetrics();

    this.activeSession = await sessionRepository.update(
      session.id,
      {
        state: 'PAUSADA',
        visits: session.visits,
        breaks: session.breaks,
        timelineEvents: session.timelineEvents,
        paidMinutes: this.lastPaidMinutes,
        pauseMinutes: this.lastPauseMinutes,
        transferMinutes: this.lastTransferMinutes,
      }
    );

    await this.writeWAL(
      session.id,
      'START_LUNCH',
      { startTime }
    );

    this.emit();
  }

  async endLunch(): Promise<void> {
    const session = this.requireActiveSession();

    if (this.currentState !== 'PAUSADA') {
      return;
    }

    const endTime = this.getCurrentTimeHHMM();

    this.closeOpenBreak(session, endTime);

    const visit: DestinationVisit = {
      id: Crypto.randomUUID(),
      sessionId: session.id,
      destination: session.destination,
      alias: session.alias,
      enterTime: endTime,
      lat: session._lat,
      lng: session._lng,
    };

    session.visits = [
      ...(session.visits ?? []),
      visit,
    ];

    session.timelineEvents.push(
      this.createTimelineEvent(
        'ACTIVA',
        'Fin de pausa y reanudación del trabajo',
        'active'
      )
    );

    session.state = 'ACTIVA';
    this.currentState = 'ACTIVA';
    this.foregroundExitDetectedAt = null;

    this.updateMetrics();

    this.activeSession = await sessionRepository.update(
      session.id,
      {
        state: 'ACTIVA',
        visits: session.visits,
        breaks: session.breaks,
        timelineEvents: session.timelineEvents,
        paidMinutes: this.lastPaidMinutes,
        pauseMinutes: this.lastPauseMinutes,
        transferMinutes: this.lastTransferMinutes,
      }
    );

    await this.writeWAL(
      session.id,
      'END_LUNCH',
      { endTime }
    );

    this.emit();
  }

  async pauseSession(): Promise<void> {
    await this.startLunch();
  }

  async resumeSession(): Promise<void> {
    await this.endLunch();
  }

  // ═════════════════════════════════════════════════════════
  // 5. MULTI-DESTINATION AND TRANSFERS
  // ═════════════════════════════════════════════════════════

  async addDestination(
    destination: string,
    alias?: string
  ): Promise<void> {
    const session = this.requireActiveSession();
    const settings = await settingsService.load();

    const normalizedDestination = destination.trim();
    const normalizedAlias = alias?.trim() || undefined;

    if (!normalizedDestination) {
      throw new Error(
        'El destino no puede estar vacío.'
      );
    }

    if (!settings.multiDestination) {
      throw new Error(
        'La funcionalidad multi-destino está desactivada.'
      );
    }

    const destinationCount =
      session.destinationCount ??
      session.visits?.length ??
      1;

    if (
      destinationCount >= settings.destinationLimit
    ) {
      throw new Error(
        `Se alcanzó el límite diario de ` +
          `${settings.destinationLimit} destinos.`
      );
    }

    await this.startTransfer(
      normalizedDestination,
      normalizedAlias
    );
  }

  async closeCurrentDestination(): Promise<void> {
    const session = this.requireActiveSession();

    if (
      this.currentState !== 'ACTIVA' &&
      this.currentState !== 'SALIDA'
    ) {
      return;
    }

    const exitTime = this.getCurrentTimeHHMM();
    const closed = this.closeOpenVisit(
      session,
      exitTime
    );

    if (!closed) {
      return;
    }

    session.timelineEvents.push(
      this.createTimelineEvent(
        this.currentState,
        `Destino finalizado: ${
          session.alias || session.destination
        }`,
        'pending'
      )
    );

    this.updateMetrics();

    this.activeSession = await sessionRepository.update(
      session.id,
      {
        visits: session.visits,
        timelineEvents: session.timelineEvents,
        paidMinutes: this.lastPaidMinutes,
        pauseMinutes: this.lastPauseMinutes,
        transferMinutes: this.lastTransferMinutes,
      }
    );

    await this.writeWAL(
      session.id,
      'CLOSE_CURRENT_DESTINATION',
      { exitTime }
    );

    this.emit();
  }

  async startTransfer(
    destination: string,
    alias?: string
  ): Promise<void> {
    const session = this.requireActiveSession();

    if (
      this.currentState !== 'ACTIVA' &&
      this.currentState !== 'SALIDA' &&
      this.currentState !== 'PAUSADA'
    ) {
      return;
    }

    const normalizedDestination = destination.trim();
    const normalizedAlias = alias?.trim() || undefined;

    if (!normalizedDestination) {
      throw new Error(
        'El destino del traslado no puede estar vacío.'
      );
    }

    const settings = await settingsService.load();
    const startTime = this.getCurrentTimeHHMM();

    if (this.currentState === 'PAUSADA') {
      this.closeOpenBreak(session, startTime);
    } else {
      this.closeOpenVisit(session, startTime);
    }

    const transfer: Transfer = {
      id: Crypto.randomUUID(),
      sessionId: session.id,
      originDestination: session.destination,
      targetDestination: normalizedDestination,
      destination: normalizedDestination,
      startTime,
      isPaid: settings.paidTransfers,
    };

    session.transfers = [
      ...(session.transfers ?? []),
      transfer,
    ];

    session.timelineEvents.push(
      this.createTimelineEvent(
        'TRASLADO',
        `Traslado iniciado hacia ${
          normalizedAlias || normalizedDestination
        }`,
        'pending'
      )
    );

    session.destination = normalizedDestination;
    session.alias = normalizedAlias;
    session.state = 'TRASLADO';

    this.currentState = 'TRASLADO';
    this.foregroundExitDetectedAt = null;

    const coordinates =
      await geofenceService.geocodeAddress(
        normalizedDestination
      );

    if (coordinates) {
      session._lat = coordinates.lat;
      session._lng = coordinates.lng;
      session._radius = settings.geofenceRadius;
      session._deviceStatus = 'GEOCODED_DESTINATION';
    }

    this.updateMetrics();

    this.activeSession = await sessionRepository.update(
      session.id,
      {
        destination: session.destination,
        alias: session.alias,
        state: 'TRASLADO',
        visits: session.visits,
        transfers: session.transfers,
        breaks: session.breaks,
        timelineEvents: session.timelineEvents,
        paidMinutes: this.lastPaidMinutes,
        pauseMinutes: this.lastPauseMinutes,
        transferMinutes: this.lastTransferMinutes,
        _lat: session._lat,
        _lng: session._lng,
        _radius: session._radius,
        _deviceStatus: session._deviceStatus,
      }
    );

    if (coordinates) {
      try {
        await geofenceService.replaceGeofence(
          session.id,
          {
            identifier: session.id,
            latitude: coordinates.lat,
            longitude: coordinates.lng,
            radius: settings.geofenceRadius,
          }
        );
      } catch (error) {
        console.warn(
          '[SessionEngine] No pudo reemplazarse la geocerca del destino.',
          error
        );
      }
    }

    await this.writeWAL(
      session.id,
      'START_TRANSFER',
      {
        origin: transfer.originDestination,
        target: normalizedDestination,
        alias: normalizedAlias ?? null,
        startTime,
        paid: transfer.isPaid ?? false,
      }
    );

    this.emit();
  }

  async completeTransfer(): Promise<void> {
    const session = this.requireActiveSession();

    if (this.currentState !== 'TRASLADO') {
      return;
    }

    const enterTime = this.getCurrentTimeHHMM();

    this.closeOpenTransfer(session, enterTime);

    const visit: DestinationVisit = {
      id: Crypto.randomUUID(),
      sessionId: session.id,
      destination: session.destination,
      alias: session.alias,
      enterTime,
      lat: session._lat,
      lng: session._lng,
    };

    session.visits = [
      ...(session.visits ?? []),
      visit,
    ];

    session.destinationCount = Math.max(
      session.destinationCount ?? 1,
      session.visits.length
    );

    session.timelineEvents.push(
      this.createTimelineEvent(
        'ACTIVA',
        `Llegada al destino ${
          session.alias || session.destination
        }`,
        'active'
      )
    );

    session.state = 'ACTIVA';
    this.currentState = 'ACTIVA';
    this.foregroundExitDetectedAt = null;

    this.updateMetrics();

    this.activeSession = await sessionRepository.update(
      session.id,
      {
        state: 'ACTIVA',
        destinationCount: session.destinationCount,
        visits: session.visits,
        transfers: session.transfers,
        timelineEvents: session.timelineEvents,
        paidMinutes: this.lastPaidMinutes,
        pauseMinutes: this.lastPauseMinutes,
        transferMinutes: this.lastTransferMinutes,
      }
    );

    await this.writeWAL(
      session.id,
      'COMPLETE_TRANSFER',
      { enterTime }
    );

    this.emit();
  }

  async endTransfer(): Promise<void> {
    await this.completeTransfer();
  }

  // ═════════════════════════════════════════════════════════
  // 6. WORKDAY CLOSURE
  // ═════════════════════════════════════════════════════════

  async finishWorkDay(
    lunchMinutes: number
  ): Promise<Session> {
    const session = this.requireActiveSession();

    if (
      this.currentState === 'CERRADA' ||
      this.currentState === 'NO_INICIADA'
    ) {
      throw new Error(
        'No existe una jornada válida para finalizar.'
      );
    }

    if (
      !Number.isInteger(lunchMinutes) ||
      lunchMinutes < 0
    ) {
      throw new Error(
        'Los minutos de almuerzo deben ser un entero mayor o igual que cero.'
      );
    }

    const endTime = this.getCurrentTimeHHMM();

    this.closeOpenVisit(session, endTime);
    this.closeOpenTransfer(session, endTime);
    this.closeOpenBreak(session, endTime);

    session.endTime = endTime;
    session.lunchDeductedMinutes = lunchMinutes;
    session.state = 'CERRADA';

    session.timelineEvents.push(
      this.createTimelineEvent(
        'CERRADA',
        `Jornada finalizada. Descuento aplicado: ${lunchMinutes} minutos`,
        'closed'
      )
    );

    this.currentState = 'CERRADA';
    this.updateMetrics();

    try {
      await geofenceService.unregister(session.id);
    } catch (error) {
      console.warn(
        '[SessionEngine] No pudo eliminarse la geocerca al cerrar la jornada.',
        error
      );
    }

    const updatedSession =
      await sessionRepository.update(
        session.id,
        {
          endTime,
          state: 'CERRADA',
          lunchDeductedMinutes:
            session.lunchDeductedMinutes,
          totalHours: session.totalHours,
          overtimeHours: session.overtimeHours,
          totalEarnings: session.totalEarnings,
          visits: session.visits,
          transfers: session.transfers,
          breaks: session.breaks,
          timelineEvents: session.timelineEvents,
          paidMinutes: this.lastPaidMinutes,
          pauseMinutes: this.lastPauseMinutes,
          transferMinutes: this.lastTransferMinutes,
          destinationCount:
            session.destinationCount ??
            Math.max(1, session.visits?.length ?? 0),
        }
      );

    await this.writeWAL(
      session.id,
      'FINISH_WORKDAY',
      {
        endTime,
        lunchMinutes,
        totalHours: updatedSession.totalHours,
        overtimeHours:
          updatedSession.overtimeHours,
        totalEarnings:
          updatedSession.totalEarnings,
      }
    );

    const result = this.cloneSession(updatedSession);

    this.clearActiveState();
    this.emit();

    if (!result) {
      throw new Error(
        'No pudo generarse el resultado de la jornada cerrada.'
      );
    }

    return result;
  }

  async closeSession(
    lunchMinutes: number
  ): Promise<Session>;

  async closeSession(
    endTime?: string
  ): Promise<Session>;

  async closeSession(
    input?: CloseSessionInput
  ): Promise<Session> {
    if (
      input === undefined ||
      typeof input === 'number'
    ) {
      return this.finishWorkDay(input ?? 0);
    }

    const session = this.requireActiveSession();
    const normalizedEndTime = input.trim();

    if (!this.isValidTime(normalizedEndTime)) {
      throw new Error(
        'La hora final debe utilizar el formato HH:MM.'
      );
    }

    return this.finishWorkDayAt(
      session,
      normalizedEndTime,
      session.lunchDeductedMinutes ?? 0
    );
  }

  async confirmExit(): Promise<Session> {
    return this.finishWorkDay(0);
  }

  async cancelSession(): Promise<void> {
    const session = this.activeSession;

    if (!session) {
      return;
    }

    const sessionId = session.id;

    try {
      await geofenceService.unregister(sessionId);
    } catch (error) {
      console.warn(
        '[SessionEngine] No pudo eliminarse la geocerca de la sesión cancelada.',
        error
      );
    }

    await this.writeWAL(
      sessionId,
      'SESSION_CANCELLED',
      {
        state: session.state,
        cancelledAt: new Date().toISOString(),
      }
    );

    await sessionRepository.delete(sessionId);

    this.clearActiveState();
    this.emit();
  }

  async addNote(note: string): Promise<void> {
    const session = this.requireActiveSession();
    const normalizedNote = note.trim();

    session.notes = normalizedNote || undefined;

    this.activeSession =
      await sessionRepository.update(
        session.id,
        {
          notes: session.notes,
        }
      );

    await this.writeWAL(
      session.id,
      'NOTE_UPDATED',
      { note: normalizedNote }
    );

    this.emit();
  }

  // ═════════════════════════════════════════════════════════
  // 7. GEOFENCE HANDLERS
  // ═════════════════════════════════════════════════════════

  async onGeofenceEnter(): Promise<void> {
    if (!this.activeSession) {
      return;
    }

    if (this.currentState === 'ESPERANDO') {
      await this.confirmArrival();
      return;
    }

    if (this.currentState === 'TRASLADO') {
      await this.completeTransfer();
      return;
    }

    if (this.currentState === 'SALIDA') {
      await this.resumeFromExitInternal(
        'Reingreso detectado por geocerca'
      );
    }
  }

  async onGeofenceExit(): Promise<void> {
    const session = this.activeSession;

    if (
      !session ||
      this.currentState !== 'ACTIVA'
    ) {
      return;
    }

    session.state = 'SALIDA';

    session.timelineEvents.push(
      this.createTimelineEvent(
        'SALIDA',
        'Salida del área de trabajo detectada',
        'warning'
      )
    );

    this.currentState = 'SALIDA';
    this.foregroundExitDetectedAt = null;
    this.updateMetrics();

    this.activeSession =
      await sessionRepository.update(
        session.id,
        {
          state: 'SALIDA',
          timelineEvents: session.timelineEvents,
          paidMinutes: this.lastPaidMinutes,
          pauseMinutes: this.lastPauseMinutes,
          transferMinutes: this.lastTransferMinutes,
        }
      );

    await this.writeWAL(
      session.id,
      'GEOFENCE_EXIT',
      {
        detectedAt: new Date().toISOString(),
      }
    );

    this.emit();
  }

  async validateForegroundExit(): Promise<void> {
    const session = this.activeSession;

    if (
      !session ||
      this.currentState !== 'ACTIVA' ||
      session._lat === undefined ||
      session._lng === undefined
    ) {
      this.foregroundExitDetectedAt = null;
      return;
    }

    const settings = await settingsService.load();

    const radius =
      session._radius ??
      settings.geofenceRadius ??
      DEFAULT_GEOFENCE_RADIUS_METERS;

    const result =
      await geofenceService.validateExitByCurrentLocation(
        {
          center: {
            lat: session._lat,
            lng: session._lng,
          },
          radiusMeters: radius,
        }
      );

    if (!result) {
      this.foregroundExitDetectedAt = null;
      return;
    }

    if (!result.isOutside) {
      this.foregroundExitDetectedAt = null;
      return;
    }

    const now = Date.now();

    if (this.foregroundExitDetectedAt === null) {
      this.foregroundExitDetectedAt = now;
      return;
    }

    const elapsed =
      now - this.foregroundExitDetectedAt;

    if (
      elapsed >= FOREGROUND_EXIT_DEBOUNCE_MS
    ) {
      this.foregroundExitDetectedAt = null;
      await this.onGeofenceExit();
    }
  }

  resumeFromExit(): void {
    if (
      !this.activeSession ||
      this.currentState !== 'SALIDA'
    ) {
      return;
    }

    void this.resumeFromExitInternal(
      'Trabajo reanudado por confirmación del usuario'
    ).catch((error) => {
      console.error(
        '[SessionEngine Resume From Exit Error]',
        error
      );
    });
  }

  private async resumeFromExitInternal(
    description: string
  ): Promise<void> {
    const session = this.requireActiveSession();

    if (this.currentState !== 'SALIDA') {
      return;
    }

    session.state = 'ACTIVA';

    session.timelineEvents.push(
      this.createTimelineEvent(
        'ACTIVA',
        description,
        'active'
      )
    );

    this.currentState = 'ACTIVA';
    this.foregroundExitDetectedAt = null;

    this.activeSession =
      await sessionRepository.update(
        session.id,
        {
          state: 'ACTIVA',
          timelineEvents: session.timelineEvents,
        }
      );

    await this.writeWAL(
      session.id,
      'RESUME_FROM_EXIT',
      { description }
    );

    this.emit();
  }

  // ═════════════════════════════════════════════════════════
  // 8. RESILIENCE AND REHYDRATION
  // ═════════════════════════════════════════════════════════

  async rehydrateFromWAL():
    Promise<RehydrationResult> {
    this.assertNotDisposed();

    try {
      const sessions =
        await sessionRepository.getAll();

      const activeSessions = sessions
        .filter(
          (session) =>
            session.state !== 'CERRADA' &&
            session.state !== 'NO_INICIADA'
        )
        .sort((left, right) => {
          const leftValue =
            `${left.date}T${left.startTime}`;
          const rightValue =
            `${right.date}T${right.startTime}`;

          return rightValue.localeCompare(leftValue);
        });

      if (activeSessions.length === 0) {
        this.clearActiveState();
        this.emit();
        return 'NONE';
      }

      const recovered = activeSessions[0];
      let conflictDetected =
        activeSessions.length > 1;

      for (
        let index = 1;
        index < activeSessions.length;
        index += 1
      ) {
        const staleSession =
          activeSessions[index];

        const conflictNote = staleSession.notes
          ? `${staleSession.notes}\n` +
            'Cerrada automáticamente por conflicto de recuperación.'
          : 'Cerrada automáticamente por conflicto de recuperación.';

        await sessionRepository.update(
          staleSession.id,
          {
            state: 'CERRADA',
            endTime:
              staleSession.endTime ||
              this.getCurrentTimeHHMM(),
            integrityType: 'CONFLICT',
            notes: conflictNote,
          }
        );

        await this.writeWAL(
          staleSession.id,
          'AUTO_CLOSED_RECOVERY_CONFLICT',
          {
            recoveredAt:
              new Date().toISOString(),
          }
        );
      }

      this.activeSession = recovered;
      this.currentState = recovered.state;
      this.foregroundExitDetectedAt = null;
      this.resetRuntimeMetrics(recovered);

      if (
        recovered._lat !== undefined &&
        recovered._lng !== undefined
      ) {
        const settings =
          await settingsService.load();

        try {
          await geofenceService.register({
            identifier: recovered.id,
            latitude: recovered._lat,
            longitude: recovered._lng,
            radius:
              recovered._radius ??
              settings.geofenceRadius,
          });
        } catch (error) {
          conflictDetected = true;

          console.warn(
            '[SessionEngine] La sesión se recuperó, pero su geocerca no pudo restaurarse.',
            error
          );
        }
      }

      await this.writeWAL(
        recovered.id,
        'SESSION_RECOVERED',
        {
          state: recovered.state,
          conflictDetected,
        }
      );

      this.emit();

      return conflictDetected
        ? 'CONFLICT'
        : 'RECOVERED';
    } catch (error) {
      console.error(
        '[SessionEngine Rehydration Error]',
        error
      );

      return 'CONFLICT';
    }
  }

  detectTimeDrift(
    currentTimestamp: number,
    previousTimestamp: number
  ): boolean {
    if (
      !Number.isFinite(currentTimestamp) ||
      !Number.isFinite(previousTimestamp)
    ) {
      return true;
    }

    if (currentTimestamp >= previousTimestamp) {
      return false;
    }

    const session = this.activeSession;

    if (session) {
      session.integrityType = 'CONFLICT';

      void sessionRepository
        .update(session.id, {
          integrityType: 'CONFLICT',
        })
        .catch((error) => {
          console.error(
            '[SessionEngine Time Drift Persistence Error]',
            error
          );
        });

      void this.writeWAL(
        session.id,
        'TIME_DRIFT_DETECTED',
        {
          currentTimestamp,
          previousTimestamp,
        }
      );
    }

    this.emit();
    return true;
  }

  async handleMidnightCrossing(): Promise<void> {
    const session = this.activeSession;

    if (
      !session ||
      this.currentState === 'CERRADA' ||
      this.currentState === 'NO_INICIADA'
    ) {
      return;
    }

    await this.writeWAL(
      session.id,
      'MIDNIGHT_CROSSING',
      {
        originalSessionDate: session.date,
        detectedAt: new Date().toISOString(),
      }
    );
  }

  // ═════════════════════════════════════════════════════════
  // 9. RESET AND DISPOSAL
  // ═════════════════════════════════════════════════════════

  reset(): void {
    this.clearActiveState();
    this.emit();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.unsubscribeGeofence();
    this.listeners.clear();
    this.clearActiveState();
  }

  // ═════════════════════════════════════════════════════════
  // 10. PRIVATE PERSISTENCE HELPERS
  // ═════════════════════════════════════════════════════════

  private async writeWAL(
    sessionId: string,
    eventType: string,
    payload: WALEventPayload
  ): Promise<void> {
    try {
      await sessionRepository.appendWALEntry(
        sessionId,
        eventType,
        payload
      );
    } catch (repositoryError) {
      // Compatibilidad defensiva para implementaciones del
      // repositorio que todavía no exponen appendWALEntry().
      try {
        const database = DatabaseService.getDb();

        await database.runAsync(
          `INSERT INTO wal_log (
            id,
            session_id,
            event_type,
            payload,
            created_at,
            synced
          ) VALUES (?, ?, ?, ?, ?, 0)`,
          Crypto.randomUUID(),
          sessionId,
          eventType,
          JSON.stringify(payload),
          new Date().toISOString()
        );
      } catch (fallbackError) {
        console.warn(
          '[SessionEngine WAL Write Failed]',
          {
            repositoryError,
            fallbackError,
          }
        );
      }
    }
  }

  // ═════════════════════════════════════════════════════════
  // 11. METRICS
  // ═════════════════════════════════════════════════════════

  private updateMetrics(): void {
    const session = this.activeSession;

    if (!session) {
      return;
    }

    const currentTime = this.getCurrentTimeHHMM();

    let productiveMinutes = 0;

    for (const visit of session.visits ?? []) {
      const endTime =
        visit.exitTime || currentTime;

      productiveMinutes +=
        this.getMinutesBetween(
          visit.enterTime,
          endTime
        );
    }

    let transferMinutes = 0;

    for (const transfer of session.transfers ?? []) {
      const endTime =
        transfer.endTime || currentTime;

      transferMinutes +=
        this.getMinutesBetween(
          transfer.startTime,
          endTime
        );
    }

    let pauseMinutes = 0;

    for (const workBreak of session.breaks ?? []) {
      const endTime =
        workBreak.endTime || currentTime;

      pauseMinutes +=
        workBreak.endTime &&
        Number.isFinite(workBreak.durationMinutes)
          ? workBreak.durationMinutes
          : this.getMinutesBetween(
              workBreak.startTime,
              endTime
            );
    }

    const settings = settingsService.getSettings();

    const paidTransferMinutes =
      settings.paidTransfers
        ? transferMinutes
        : 0;

    const paidMinutes = Math.max(
      0,
      productiveMinutes +
        paidTransferMinutes -
        session.lunchDeductedMinutes
    );

    this.lastPaidMinutes = paidMinutes;
    this.lastPauseMinutes = pauseMinutes;
    this.lastTransferMinutes = transferMinutes;

    const totalHours = paidMinutes / 60;

    const baseHours = this.parseBaseHours(
      settings.baseWorkHour
    );

    const overtimeHours = Math.max(
      0,
      totalHours - baseHours
    );

    const regularHours = Math.max(
      0,
      totalHours - overtimeHours
    );

    const hourlyRate =
      session.snapshotRate ||
      settings.hourlyRate ||
      DEFAULT_HOURLY_RATE;

    const overtimeMultiplier =
      settings.overtimeMultiplier ||
      DEFAULT_OVERTIME_MULTIPLIER;

    const totalEarnings =
      regularHours * hourlyRate +
      overtimeHours *
        hourlyRate *
        overtimeMultiplier;

    session.paidMinutes = paidMinutes;
    session.pauseMinutes = pauseMinutes;
    session.transferMinutes = transferMinutes;
    session.totalHours =
      this.roundToTwoDecimals(totalHours);
    session.overtimeHours =
      this.roundToTwoDecimals(overtimeHours);
    session.totalEarnings =
      this.roundToTwoDecimals(totalEarnings);
  }

  // ═════════════════════════════════════════════════════════
  // 12. ENTITY HELPERS
  // ═════════════════════════════════════════════════════════

  private closeOpenVisit(
    session: Session,
    exitTime: string
  ): boolean {
    const visits = session.visits ?? [];
    const visit = visits[visits.length - 1];

    if (!visit || visit.exitTime) {
      return false;
    }

    visit.exitTime = exitTime;
    return true;
  }

  private closeOpenTransfer(
    session: Session,
    endTime: string
  ): boolean {
    const transfers = session.transfers ?? [];
    const transfer =
      transfers[transfers.length - 1];

    if (!transfer || transfer.endTime) {
      return false;
    }

    transfer.endTime = endTime;
    return true;
  }

  private closeOpenBreak(
    session: Session,
    endTime: string
  ): boolean {
    const breaks = session.breaks ?? [];
    const workBreak = breaks[breaks.length - 1];

    if (!workBreak || workBreak.endTime) {
      return false;
    }

    workBreak.endTime = endTime;
    workBreak.durationMinutes =
      this.getMinutesBetween(
        workBreak.startTime,
        endTime
      );

    return true;
  }

  private createTimelineEvent(
    type: SessionState,
    description: string,
    status: TimelineEvent['status'],
    metadata?: Record<string, unknown>
  ): TimelineEvent {
    return {
      id: Crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      title: description,
      description,
      status,
      metadata: metadata
        ? JSON.stringify(metadata)
        : undefined,
    };
  }

  private async normalizeStartInput(
    input: StartSessionInput,
    settings: UserSettings
  ): Promise<{
    destination: string;
    alias?: string;
    location?: SessionStartLocation;
  }> {
    if (!input) {
      return {
        destination: DEFAULT_DESTINATION,
      };
    }

    if (this.isSessionStartLocation(input)) {
      this.validateLocation(input);

      return {
        destination: DEFAULT_DESTINATION,
        location: input,
      };
    }

    const destination = input.destination.trim();
    const alias = input.alias?.trim() || undefined;

    if (!destination) {
      throw new Error(
        'El destino de la jornada no puede estar vacío.'
      );
    }

    if (input.location) {
      this.validateLocation(input.location);
    }

    return {
      destination,
      alias,
      location: input.location
        ? {
            ...input.location,
            radius:
              input.location.radius ||
              settings.geofenceRadius,
          }
        : undefined,
    };
  }

  private validateLocation(
    location: SessionStartLocation
  ): void {
    if (
      !Number.isFinite(location.lat) ||
      location.lat < -90 ||
      location.lat > 90
    ) {
      throw new Error(
        'La latitud debe encontrarse entre -90 y 90.'
      );
    }

    if (
      !Number.isFinite(location.lng) ||
      location.lng < -180 ||
      location.lng > 180
    ) {
      throw new Error(
        'La longitud debe encontrarse entre -180 y 180.'
      );
    }

    if (
      !Number.isFinite(location.radius) ||
      location.radius < 10
    ) {
      throw new Error(
        'El radio de geocerca debe ser de al menos 10 metros.'
      );
    }
  }

  private isSessionStartLocation(
    value: StartSessionPayload | SessionStartLocation
  ): value is SessionStartLocation {
    return (
      'lat' in value &&
      'lng' in value &&
      'radius' in value
    );
  }

  // ═════════════════════════════════════════════════════════
  // 13. TIME HELPERS
  // ═════════════════════════════════════════════════════════

  private getLocalDate(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');
    const day = String(date.getDate()).padStart(
      2,
      '0'
    );

    return `${year}-${month}-${day}`;
  }

  private getCurrentTimeHHMM(
    date = new Date()
  ): string {
    const hours = String(date.getHours()).padStart(
      2,
      '0'
    );
    const minutes = String(
      date.getMinutes()
    ).padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  private getMinutesBetween(
    start: string,
    end: string
  ): number {
    const startMinutes =
      this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    let difference =
      endMinutes - startMinutes;

    if (difference < 0) {
      difference += 24 * 60;
    }

    return difference;
  }

  private timeToMinutes(value: string): number {
    const normalized = value.includes('T')
      ? value.split('T')[1]?.slice(0, 5) ?? ''
      : value.slice(0, 5);

    const match =
      /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
        normalized
      );

    if (!match) {
      throw new Error(
        `Formato de hora inválido: ${value}`
      );
    }

    return (
      Number(match[1]) * 60 +
      Number(match[2])
    );
  }

  private isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(
      value
    );
  }

  private parseBaseHours(value: string): number {
    if (!this.isValidTime(value)) {
      return DEFAULT_BASE_WORK_HOURS;
    }

    const [hours, minutes] =
      value.split(':').map(Number);

    return hours + minutes / 60;
  }

  // ═════════════════════════════════════════════════════════
  // 14. STATE HELPERS
  // ═════════════════════════════════════════════════════════

  private async finishWorkDayAt(
    session: Session,
    endTime: string,
    lunchMinutes: number
  ): Promise<Session> {
    this.closeOpenVisit(session, endTime);
    this.closeOpenTransfer(session, endTime);
    this.closeOpenBreak(session, endTime);

    session.endTime = endTime;
    session.lunchDeductedMinutes = lunchMinutes;
    session.state = 'CERRADA';

    session.timelineEvents.push(
      this.createTimelineEvent(
        'CERRADA',
        `Jornada finalizada a las ${endTime}`,
        'closed'
      )
    );

    this.currentState = 'CERRADA';
    this.updateMetrics();

    try {
      await geofenceService.unregister(session.id);
    } catch (error) {
      console.warn(
        '[SessionEngine] No pudo eliminarse la geocerca.',
        error
      );
    }

    const updated =
      await sessionRepository.update(
        session.id,
        {
          endTime,
          state: 'CERRADA',
          lunchDeductedMinutes: lunchMinutes,
          totalHours: session.totalHours,
          overtimeHours: session.overtimeHours,
          totalEarnings: session.totalEarnings,
          visits: session.visits,
          transfers: session.transfers,
          breaks: session.breaks,
          timelineEvents: session.timelineEvents,
          paidMinutes: this.lastPaidMinutes,
          pauseMinutes: this.lastPauseMinutes,
          transferMinutes: this.lastTransferMinutes,
        }
      );

    await this.writeWAL(
      session.id,
      'CLOSE_SESSION_AT_TIME',
      {
        endTime,
        lunchMinutes,
      }
    );

    const result =
      this.cloneSession(updated);

    this.clearActiveState();
    this.emit();

    if (!result) {
      throw new Error(
        'No pudo recuperarse la jornada cerrada.'
      );
    }

    return result;
  }

  private requireActiveSession(): Session {
    this.assertNotDisposed();

    if (!this.activeSession) {
      throw new Error(
        'No existe una jornada activa.'
      );
    }

    return this.activeSession;
  }

  private requireSessionSnapshot(): Session {
    const snapshot =
      this.cloneSession(this.activeSession);

    if (!snapshot) {
      throw new Error(
        'No existe una jornada disponible.'
      );
    }

    return snapshot;
  }

  private clearActiveState(): void {
    this.activeSession = null;
    this.currentState = 'NO_INICIADA';
    this.foregroundExitDetectedAt = null;
    this.lastPaidMinutes = 0;
    this.lastPauseMinutes = 0;
    this.lastTransferMinutes = 0;
  }

  private resetRuntimeMetrics(
    session: Session
  ): void {
    this.lastPaidMinutes =
      session.paidMinutes ?? 0;
    this.lastPauseMinutes =
      session.pauseMinutes ?? 0;
    this.lastTransferMinutes =
      session.transferMinutes ?? 0;
  }

  private cloneSession(
    session: Session | null
  ): Session | null {
    if (!session) {
      return null;
    }

    return {
      ...session,
      timelineEvents:
        session.timelineEvents.map((event) => ({
          ...event,
        })),
      visits: session.visits?.map((visit) => ({
        ...visit,
      })),
      transfers: session.transfers?.map(
        (transfer) => ({
          ...transfer,
        })
      ),
      breaks: session.breaks?.map(
        (workBreak) => ({
          ...workBreak,
        })
      ),
    };
  }

  private roundToTwoDecimals(
    value: number
  ): number {
    return (
      Math.round(
        (value + Number.EPSILON) * 100
      ) / 100
    );
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error(
        'SessionEngineService fue liberado y no puede reutilizarse.'
      );
    }
  }
}

export const sessionEngine =
  new SessionEngineService();

