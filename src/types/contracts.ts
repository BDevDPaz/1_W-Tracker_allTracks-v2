export type SessionState =
  | "NO_INICIADA"
  | "ESPERANDO"
  | "ACTIVA"
  | "SALIDA"
  | "PAUSADA"
  | "TRASLADO"
  | "CERRADA";

export type IntegrityType =
  | "VALID"
  | "MANUAL"
  | "AUTO"
  | "CONFLICT"
  | "RECOVERED"
  | "GPS";

export type PillStatus =
  | "idle"
  | "pending"
  | "active"
  | "warning"
  | "error"
  | "closed"
  | "lunch"
  | "transit"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "INFO"
  | "NEUTRAL"
  | "LUNCH"
  | "TRANSIT";

export type SystemHealthStatus = "OK" | "WARNING" | "ERROR";
export type RehydrationResult = "NONE" | "RECOVERED" | "CONFLICT" | "OK";

export type TimelineEventType =
  | "WORKDAY_START"
  | "GEOFENCE_ENTER"
  | "GEOFENCE_EXIT"
  | "LUNCH_START"
  | "LUNCH_END"
  | "TRANSFER_START"
  | "TRANSFER_END"
  | "DESTINATION_CHANGED"
  | "WORKDAY_END"
  | "MANUAL_ADJUSTMENT"
  | "SYSTEM_RECOVERY";

export type RootStackParamList = {
  HomeTabs: undefined;
  Ajustes: undefined;
  Reportes: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
};

export type RootTabParamList = {
  Hoy: undefined;
  Historial: undefined;
  Resumen: undefined;
  Reportes: undefined;
  Ajustes: undefined;
};

export interface DailySetupPayload {
  destination: string;
  alias?: string;
  lat?: number;
  lng?: number;
}

export interface LunchModalPayload {
  lunchMinutes?: number;
  minutes?: number;
}

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message?: string;
  text?: string;
  durationMs?: number;
}

export interface ToastContextValue {
  push: (msg: Omit<ToastMessage, "id"> | string) => void;
  clear: () => void;
}

export interface IToastQueue {
  push(msg: Omit<ToastMessage, "id"> | string): void;
  clear(): void;
}

export interface SessionStartLocation {
  lat: number;
  lng: number;
  radius: number;
}

export interface StartSessionPayload {
  destination: string;
  alias?: string;
  location?: SessionStartLocation;
}

export interface DestinationVisit {
  id: string;
  workdayId?: string;
  sessionId?: string;
  destination: string;
  alias?: string;
  startTime?: string;
  enterTime: string;
  endTime?: string;
  exitTime?: string;
  durationMinutes?: number;
  lat?: number;
  lng?: number;
}

export interface Transfer {
  id: string;
  workdayId?: string;
  sessionId?: string;
  fromDestination?: string;
  originDestination?: string;
  toDestination?: string;
  targetDestination?: string;
  destination?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  isPaid?: boolean;
  status?: "ONGOING" | "COMPLETED";
}

export interface Break {
  id: string;
  workdayId?: string;
  sessionId?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  isPaid?: boolean;
}

export interface TimelineEvent {
  id: string;
  workdayId?: string;
  sessionId?: string;
  timestamp: string;
  type?: SessionState;
  title?: string;
  description: string;
  status: PillStatus;
  sequence?: number;
  metadata?: string;
}

export interface WorkDay {
  id: string;
  date: string;
  destination: string;
  alias?: string;
  startTime: string;
  endTime?: string;
  totalHours: number;
  lunchDeductedMinutes: number;
  overtimeHours: number;
  snapshotRate: number;
  totalEarnings: number;
  integrityType: IntegrityType;
  notes?: string;
  state: SessionState;

  paidMinutes: number;
  pauseMinutes: number;
  transferMinutes: number;
  destinationCount: number;

  // Garantizamos que siempre son arreglos para evitar .map sobre undefined
  visits: DestinationVisit[];
  transfers: Transfer[];
  breaks: Break[];
  timelineEvents: TimelineEvent[];

  _lat?: number;
  _lng?: number;
  _radius?: number;
  _deviceStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Session = WorkDay;

export interface UserSettings {
  id?: string;
  name: string;
  hourlyRate: number;
  reportEmail: string;
  baseWorkHour: string;
  overtimeMultiplier: number;
  lunchDiscountMinutes: number;
  standardLunchMinutes?: number;
  overtimeThresholdHours?: number;
  geofenceRadius: number;
  dailyReminder: boolean;
  workdayAlerts: boolean;
  reportReady: boolean;
  language: "es" | "en";
  currency?: string;
  multiDestination: boolean;
  allowMultiDestination?: boolean;
  paidTransfers: boolean;
  payTransferTime?: boolean;
  destinationLimit: number;
  hasCompletedOnboarding: boolean;
  adminPin: string | null;
}

export interface SystemHealth {
  locationPermission: SystemHealthStatus;
  backgroundLocation: SystemHealthStatus;
  geofenceActive: SystemHealthStatus;
  notificationsReady: SystemHealthStatus;
  storageIntegrity: SystemHealthStatus;
  lastValidationMinutes: number;
}

export interface WeeklySummary {
  weekStartDate: string;
  weekEndDate: string;
  periodLabel: string;
  totalHours: number;
  paidHours: number;
  overtimeHours: number;
  totalEarnings: number;
  workDaysCount: number;
  sessionCount: number;
  transfersCount: number;
  manualAdjustments: number;
  baseEarnings: number;
  overtimeEarnings: number;
  baseRate: number;
  overtimeMultiplier: number;
}

export interface PDFReport {
  filePath: string;
  generatedAt: string;
  workDaysIncluded: number;
  periodLabel: string;
  summary: WeeklySummary;
  sessions: Session[];
}

export interface Coordinates {
  latitude?: number;
  longitude?: number;
  lat: number;
  lng: number;
}

export interface ExitValidationResult {
  isOutside: boolean;
  distance: number;
  distanceMeters: number;
  radiusMeters: number;
}

export interface GeofenceConfig {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export type GeofenceEvent = "ENTER" | "EXIT";

export interface ISessionRepository {
  getAll(): Promise<Session[]>;
  getById(id: string): Promise<Session | null>;
  getActive(): Promise<Session | null>;
  getByPeriod(startDate: string, endDate: string): Promise<Session[]>;
  create(sessionData: Session): Promise<Session>;
  update(id: string, patch: Partial<Session>): Promise<Session>;
  delete(id: string): Promise<void>;
  getWeeklySummary(weekStart: string, weekEnd: string): Promise<WeeklySummary>;
  getVisits(sessionId: string): Promise<DestinationVisit[]>;
  getTransfers(sessionId: string): Promise<Transfer[]>;
  getBreaks(sessionId: string): Promise<Break[]>;
  appendWALEntry(
    sessionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
}

export interface ISessionEngineService {
  subscribe(
    listener: (state: SessionState, session: Session | null) => void,
  ): () => void;
  getCurrentState(): SessionState;
  getActiveSession(): Session | null;
  startSession(
    payload?: StartSessionPayload | SessionStartLocation,
  ): Promise<Session>;
  confirmArrival(): Promise<void>;
  startLunch(): Promise<void>;
  endLunch(): Promise<void>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
  addDestination(destination: string, alias?: string): Promise<void>;
  closeCurrentDestination(): Promise<void>;
  startTransfer(destination: string, alias?: string): Promise<void>;
  completeTransfer(): Promise<void>;
  endTransfer(): Promise<void>;
  finishWorkDay(lunchMinutes: number): Promise<Session>;
  closeSession(input?: number | string): Promise<Session>;
  confirmExit(): Promise<Session>;
  cancelSession(): Promise<void>;
  addNote(note: string): Promise<void>;
  onGeofenceEnter(): Promise<void>;
  onGeofenceExit(): Promise<void>;
  validateForegroundExit(): Promise<void>;
  resumeFromExit(): void;
  rehydrateFromWAL(): Promise<RehydrationResult>;
  detectTimeDrift(currentTimestamp: number, previousTimestamp: number): boolean;
  handleMidnightCrossing(): Promise<void>;
  reset(): void;
  dispose(): void;
}

export interface ISettingsService {
  load(): Promise<UserSettings>;
  getSettings(): UserSettings;
  save(settings: UserSettings): Promise<void>;
}

export interface IPDFService {
  generate(report: PDFReport): Promise<string>;
  share(filePath: string): Promise<void>;
  sendByEmail(filePath: string, to: string): Promise<void>;
  preview(filePath: string): Promise<void>;
}

export interface IGeofenceService {
  register(params: GeofenceConfig): Promise<void>;
  unregister(identifier?: string): Promise<void>;
  replaceGeofence(
    configOrIdentifier: string | GeofenceConfig,
    newConfigParameter?: GeofenceConfig,
  ): Promise<void>;
  registerNextDestination(
    address: string,
    sessionId?: string,
  ): Promise<Coordinates | null>;
  geocodeAddress(address: string): Promise<Coordinates | null>;
  validateExitByCurrentLocation(params: {
    center: Coordinates;
    radiusMeters: number;
  }): Promise<ExitValidationResult | null>;
  getCurrentLocation(): Promise<Coordinates | null>;
  onEvent(
    callback: (event: GeofenceEvent, identifier: string) => void,
  ): () => void;
  getPermissionStatus(): Promise<"GRANTED" | "DENIED" | "NOT_DETERMINED">;
  requestPermissions(): Promise<boolean>;
  dispose(): void;
}
