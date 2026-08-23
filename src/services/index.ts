// ============================================================
// W TRACKER — BARREL DE SERVICIOS CANÓNICO V2.2
// Ruta: src/services/index.ts
// Versión: 2.2.0 (Workday Tracking Platform)
//
// Responsabilidad:
// - Proporcionar un punto único de exportación.
// - Mantener una API pública explícita y estable.
// - Evitar colisiones entre módulos.
// - Evitar exportaciones internas accidentales.
// ============================================================

// ═══════════════════════════════════════════════════════════
// 1. PERSISTENCIA Y REPOSITORIOS
// ═══════════════════════════════════════════════════════════

export {
  DatabaseService,
  databaseService,
  DB_SCHEMA,
  SessionRepository,
  sessionRepository,
} from './database/DatabaseService';

// ═══════════════════════════════════════════════════════════
// 2. CONFIGURACIÓN Y GOBERNANZA
// ═══════════════════════════════════════════════════════════

export {
  SettingsService,
  settingsService,
} from './settings/SettingsService';

// ═══════════════════════════════════════════════════════════
// 3. MOTOR OPERATIVO DE JORNADAS
// ═══════════════════════════════════════════════════════════

export {
  SessionEngineService,
  sessionEngine,
} from './sessionEngine/SessionEngineService';

// ═══════════════════════════════════════════════════════════
// 4. GEOLOCALIZACIÓN Y GEOFENCING
// ═══════════════════════════════════════════════════════════

export {
  GeofenceService,
  geofenceService,
} from './geofence/GeofenceService';

// ═══════════════════════════════════════════════════════════
// 5. REPORTES PDF
// ═══════════════════════════════════════════════════════════

export {
  PDFService,
  pdfService,
} from './pdf/PDFService';

// ═══════════════════════════════════════════════════════════
// 6. NOTIFICACIONES TOAST
// ═══════════════════════════════════════════════════════════

export {
  ToastProvider,
  ToastService,
  useToast,
} from './toast/ToastService';

