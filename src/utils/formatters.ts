// ============================================================
// W TRACKER — UTILIDADES GLOBALES Y LÓGICA DE NEGOCIO
// Versión: 2.2.0 (Workday Tracking Architecture - Consolidado)
// Ruta: src/utils/formatters.ts
// Responsabilidad: Formateadores, Cálculos de Nómina, Mapeo UI y Microcopy
// ============================================================

import { PALETTE, PILL_STATUS_COLORS } from '../theme/tokens';
import { IntegrityType, PillStatus, SessionState } from '../types/contracts';

// ── 1. FORMATEADORES FINANCIEROS Y DE TIEMPO ────────────────

export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatHours = (hours: number): string => {
  return `${hours.toFixed(1)} h`;
};

export const formatDate = (isoDate: string): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString('es-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatTime12 = (hhmm: string): string => {
  if (!hhmm || hhmm === '--:--') return '--:--';
  const parts = hhmm.split(':');
  const hStr = parts[0];
  const mStr = parts[1];
  if (!hStr || !mStr) return '--:--';

  const h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;

  return `${h12}:${m} ${ampm}`;
};

export const formatTimeRange = (start: string, end: string | null | undefined): string => {
  const endTimeFormatted = end ? formatTime12(end) : 'En curso';
  return `${formatTime12(start)} — ${endTimeFormatted}`;
};

// ── 2. MAPEO OPERATIVO (MÁQUINA DE ESTADOS → UI) ─────────────

export interface SessionStateUIMap {
  pillLabel: string;
  destinationSubtext: string;
  ctaPrimary: string;
  ctaSecondary?: string;
  showTimer: boolean;
}

export const getSessionStateUI = (state: SessionState): SessionStateUIMap => {
  const map: Record<SessionState, SessionStateUIMap> = {
    NO_INICIADA: {
      pillLabel: 'No iniciada',
      destinationSubtext: 'Configura tu jornada',
      ctaPrimary: 'Iniciar jornada',
      showTimer: false,
    },
    ESPERANDO: {
      pillLabel: 'Esperando llegada',
      destinationSubtext: 'Esperando llegada física al destino',
      ctaPrimary: 'Confirmar llegada',
      ctaSecondary: 'Cancelar jornada',
      showTimer: false,
    },
    TRASLADO: {
      pillLabel: 'En traslado',
      destinationSubtext: 'Transitando hacia nuevo destino',
      ctaPrimary: 'Confirmar llegada',
      ctaSecondary: 'Cancelar traslado',
      showTimer: true,
    },
    ACTIVA: {
      pillLabel: 'Jornada activa',
      destinationSubtext: 'Trabajando en destino validado',
      ctaPrimary: 'Finalizar jornada',
      ctaSecondary: 'Iniciar almuerzo',
      showTimer: true,
    },
    PAUSADA: {
      pillLabel: 'En almuerzo',
      destinationSubtext: 'Tiempo de almuerzo / pausa',
      ctaPrimary: 'Finalizar almuerzo',
      showTimer: true,
    },
    SALIDA: {
      pillLabel: 'Salida detectada',
      destinationSubtext: 'Fuera del radio de la geocerca',
      ctaPrimary: 'Confirmar salida',
      ctaSecondary: 'Sigo trabajando',
      showTimer: true,
    },
    CERRADA: {
      pillLabel: 'Jornada cerrada',
      destinationSubtext: 'Auditoría completada',
      ctaPrimary: 'Revisar jornada',
      ctaSecondary: 'Ver historial',
      showTimer: false,
    },
  };
  return map[state];
};

export const getStatusColor = (status: PillStatus): string => {
  return PILL_STATUS_COLORS[status]?.main ?? PALETTE.slateBlue;
};

export const getStatusLabel = (status: PillStatus): string => {
  const map: Record<PillStatus, string> = {
    idle: 'No iniciada',
    pending: 'Esperando llegada',
    active: 'Trabajando',
    warning: 'Salida detectada',
    error: 'Revisar',
    closed: 'Jornada cerrada',
    lunch: 'En almuerzo',
    transit: 'En traslado',

    NEUTRAL: 'No iniciada',
    INFO: 'Esperando llegada',
    SUCCESS: 'Trabajando',
    WARNING: 'Salida detectada',
    ERROR: 'Revisar',
    LUNCH: 'En almuerzo',
    TRANSIT: 'En traslado',
  };
  return map[status] ?? 'Estado desconocido';
};

// ── 3. AUDITORÍA E INTEGRIDAD FORENSE ─────────────────────────

export interface IntegrityBadgeConfig {
  label: string;
  borderColor: string;
  textColor: string;
  icon: string;
}

export const getIntegrityConfig = (type: IntegrityType): IntegrityBadgeConfig => {
  const map: Record<IntegrityType, IntegrityBadgeConfig> = {
    VALID: {
      label: 'Validada',
      borderColor: PALETTE.successGreen,
      textColor: PALETTE.successGreen,
      icon: 'shield-check',
    },
    MANUAL: {
      label: 'Ajuste manual',
      borderColor: '#9CA3AF',
      textColor: '#9CA3AF',
      icon: 'pencil',
    },
    AUTO: {
      label: 'Auto cierre',
      borderColor: PALETTE.slateBlue,
      textColor: PALETTE.slateBlue,
      icon: 'clock',
    },
    RECOVERED: {
      label: 'Recuperada',
      borderColor: PALETTE.royalBlue,
      textColor: PALETTE.royalBlue,
      icon: 'refresh-cw',
    },
    CONFLICT: {
      label: 'Revisar',
      borderColor: PALETTE.amberWarning,
      textColor: PALETTE.amberWarning,
      icon: 'alert-triangle',
    },
    GPS: {
      label: 'Validada',
      borderColor: PALETTE.successGreen,
      textColor: PALETTE.successGreen,
      icon: 'shield-check',
    },
  };
  return map[type] ?? map.VALID;
};

// ── 4. LÓGICA DE NÓMINA Y MANEJO DE TIEMPOS ──────────────────

export const isTimeOverlapping = (
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string
): boolean => {
  const toMinutes = (t: string): number => {
    const parts = t.split(':');
    const h = parseInt(parts[0] ?? '0', 10);
    const m = parseInt(parts[1] ?? '0', 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    return h * 60 + m;
  };

  const ns = toMinutes(newStart);
  const ne = toMinutes(newEnd);
  const es = toMinutes(existingStart);
  const ee = toMinutes(existingEnd);

  return ns < ee && ne > es;
};

export const calculateEarnings = (
  hours: number,
  rate: number,
  overtimeHours: number,
  overtimeMultiplier: number
): number => {
  const baseHours = Math.max(0, hours - overtimeHours);
  const basePay = baseHours * rate;
  const overtimePay = overtimeHours * rate * overtimeMultiplier;
  return Math.round((basePay + overtimePay) * 100) / 100;
};

export const getMinutesBetweenHHMM = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);

  if (h1 === undefined || m1 === undefined || h2 === undefined || m2 === undefined) return 0;

  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 1440;

  return diff;
};

export const minutesBetween = (isoA: string, isoB: string): number => {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  const removeMs = (t: number) => Math.floor(t / 60000) * 60000;
  return Math.round(Math.abs(removeMs(b) - removeMs(a)) / 60000);
};

// ── 5. CALCULADORES DE FECHAS Y RANGOS DE SEMANA ─────────────

export const getWeekStart = (offsetWeeks = 0): string => {
  const today = new Date();
  const day = today.getDay();
  const diff = (day === 0 ? -6 : 1 - day) + offsetWeeks * 7;
  const monday = new Date(today);

  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split('T')[0]!;
};

export const formatWeekRange = (weekStart: string): string => {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString('es-US', {
      month: 'short',
      day: 'numeric',
    });

  return `${fmt(start)} — ${fmt(end)}`;
};

export const isToday = (isoDate: string): boolean => {
  return isoDate === new Date().toISOString().split('T')[0];
};

// ── 6. DICCIONARIOS DE COMUNICACIÓN Y MICROCOPY ─────────────

export const MICROCOPY: Record<string, string> = {
  'Geofence activada': 'Zona activa',
  'Geocerca activada': 'Zona activa',
  'Pending arrival': 'Esperando llegada',
  'Background task ejecutada': 'Monitoreo protegido',
  'Registro editado manualmente': 'Ajuste manual aplicado',
  'Error crítico / Mutex failed': 'Se requiere revisión antes de continuar',
  'WAL entry written': 'Sesión protegida',
  'Scheduler triggered': 'Monitoreo protegido',
  'Clock drift': 'Inconsistencia horaria detectada',
  'Geofence breach': 'Salida detectada',
};

export const LOADING_COPY: Record<string, string> = {
  closeSession: 'Cerrando jornada...',
  generateReport: 'Generando reporte PDF...',
  syncLocation: 'Sincronizando ubicación...',
  saveSettings: 'Guardando configuración...',
  exportPDF: 'Exportando documento PDF...',
  restoreSession: 'Restaurando sesión...',
};
