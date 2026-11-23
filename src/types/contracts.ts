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

// --- P3: reglas fijas, no configurables por encima / por fuera ---
// Umbral horas extra fijo en 8 por ley. Admin no puede subirlo.
// Almuerzo 30-60 min, default 30. Alerta almuerzo = hora base + 5h.
export const OVERTIME_THRESHOLD_HOURS = 8;
export const LUNCH_MIN_MINUTES = 30;
export const LUNCH_MAX_MINUTES = 60;
export const LUNCH_DEFAULT_MINUTES = 30;
export const LUNCH_ALERT_OFFSET_HOURS = 5;

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
  // P3: confirmación explícita de que la pausa fue tomada, con timestamp.
  // Sin confirmed = true, la pausa no cuenta como confirmada legalmente.
  confirmed?: boolean;
  confirmedAt?: string;
  // P3: PAUSE = pausa de mediodía (base + 5h). CLOSE = deducción al cerrar.
  // Mismo modal, dos momentos. No son dos deducciones: el cierre usa la pausa confirmada.
  mode?: "PAUSE" | "CLOSE";
}

// P3: payload que el Engine persiste cuando el usuario confirma la pausa.
export interface LunchConfirmation {
  minutes: number;
  confirmed: boolean;
  confirmedAt: string;
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
  // P3: timestamp de la confirmación explícita "tomé mi pausa".
  // Null / false = pausa registrada pero no confirmada.
  confirmedAt?: string | null;
  confirmed?: boolean;
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
  // Snapshot congelado en ACTIVA. Provisional en creación, congelado al pasar a ACTIVA.
  // Nunca se recalcula con settings en vivo después de ACTIVA.
  // snapshotIsApproximate = true solo para sesiones abiertas migradas con backfill.
  snapshotMultiplier?: number;
  snapshotThresholdHours?: number;
  snapshotCurrency?: string;
  snapshotIsApproximate?: boolean;
  totalEarnings: number;
  integrityType: IntegrityType;
  notes?: string;
  state: SessionState;

  paidMinutes: number;
  pauseMinutes: number;
  transferMinutes: number;
  destinationCount: number;

  // P3: confirmación explícita de almuerzo, con timestamp. Protección legal.
  // lunchConfirmedAt = cuando el usuario confirmó "tomé mi pausa".
  // Null / false = no confirmado. El cierre usa la pausa confirmada, no un input suelto.
  lunchConfirmedAt?: string | null;
  lunchConfirmed?: boolean;

  // P3: sesión cerrada editada por Admin queda pendiente de validación del usuario.
  // Mientras pendingValidation = true, el PDF no es definitivo y debe marcarse como pendiente.
  // validatedAt = cuando el usuario validó el ajuste.
  pendingValidation?: boolean;
  pendingValidationReason?: string | null;
  validatedAt?: string | null;

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

export type SettingsTab = "worker" | "admin";
export type TimeFormat = "12h" | "24h";

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
  // P2: solo quedan allowMultiDestination + payTransferTime.
  // Eliminados multiDestination y paidTransfers por duplicados sin efecto.
  allowMultiDestination?: boolean;
  payTransferTime?: boolean;
  destinationLimit: number;
  hasCompletedOnboarding: boolean;
  adminPin: string | null;

  // --- Trabajador: lo operativo, sin PIN ---
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  preferredStartTime?: string;
  lunchPreferenceMinutes?: number;
  entryReminderEnabled?: boolean;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
  timeFormat?: TimeFormat;

  // --- Administrador: lo contractual y de control, con PIN ---
  address?: string;
  employeeId?: string;
  company?: string;
  position?: string;
  startDate?: string;
  principalAddress?: string;
  gracePeriodMinutes?: number;
  entryToleranceMinutes?: number;
  payDay?: string;
  paymentMethod?: string;
  adminPinHash?: string | null;
  adminPinSet?: boolean;
  lastAdminChangeAt?: string | null;
  lastAdminChangeBy?: string | null;
}

// Subconjuntos para los dos guardados separados
export type WorkerSettings = Pick<
  UserSettings,
  | "phone"
  | "emergencyContact"
  | "emergencyPhone"
  | "preferredStartTime"
  | "lunchPreferenceMinutes"
  | "entryReminderEnabled"
  | "soundEnabled"
  | "vibrationEnabled"
  | "timeFormat"
  | "language"
  | "dailyReminder"
  | "workdayAlerts"
  | "reportReady"
>;

export type AdminSettings = Pick<
  UserSettings,
  | "name"
  | "reportEmail"
  | "address"
  | "employeeId"
  | "company"
  | "position"
  | "startDate"
  | "hourlyRate"
  | "overtimeMultiplier"
  | "baseWorkHour"
  | "overtimeThresholdHours"
  | "lunchDiscountMinutes"
  | "standardLunchMinutes"
  | "payTransferTime"
  | "allowMultiDestination"
  | "geofenceRadius"
  | "destinationLimit"
  | "principalAddress"
  | "gracePeriodMinutes"
  | "entryToleranceMinutes"
  | "payDay"
  | "paymentMethod"
  | "currency"
>;

export interface FieldValidationError {
  field: string;
  message: string;
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
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
  // P3 — opcionales en este paso para que tsc siga en verde.
  // Se implementan en SessionEngineService.ts en el siguiente archivo P3.
  confirmLunchPause?(minutes: number, confirmedAt: string): Promise<void>;
  validateSession?(id: string): Promise<void>;
}

export interface ISettingsService {
  load(): Promise<UserSettings>;
  getSettings(): UserSettings;
  save(settings: UserSettings): Promise<void>;
  // Lectura fresca sin caché, para fondo / TaskManager / Engine. No usa load().
  getFreshSettings?(): Promise<UserSettings>;
  // Nuevos métodos, opcionales en este paso para que tsc siga en verde.
  // En Paso 2 se implementan y se vuelven obligatorios.
  verifyAdminPin?(pin: string): Promise<boolean>;
  setAdminPin?(pin: string): Promise<void>;
  changeAdminPin?(oldPin: string, newPin: string): Promise<void>;
  hasAdminPin?(): Promise<boolean>;
  saveWorkerSettings?(patch: Partial<UserSettings>): Promise<void>;
  saveAdminSettings?(patch: Partial<UserSettings>): Promise<void>;
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
