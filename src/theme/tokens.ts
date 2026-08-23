// ============================================================
// W TRACKER DESIGN SYSTEM V2.2.0 — DESIGN TOKENS CANÓNICOS
// Versión: 2.2.0 (Workday Tracking Platform - Consolidado)
// Ruta: src/theme/tokens.ts
// Fuente: Refactor de Identidad Visual y Sistema de Diseño V2
// Responsabilidad: Única fuente de verdad para la interfaz de usuario.
// ============================================================

import { SessionState, PillStatus, IntegrityType } from '../types/contracts';

// ── 1. PALETA DE COLORES CANÓNICA ───────────────────────────────
export const PALETTE = {
  // Fondos y Superficies (Dark Mode Core)
  obsidian: '#050505',    // Level 0: Fondo principal de pantalla
  graphite: '#121212',    // Level 1: Tarjetas base / Elementos secundarios
  carbonMist: '#1A1A1A',  // Level 2: Tarjetas elevadas / Modales / Hero Card
  steelLine: '#2A2A2A',   // Divisores, bordes y líneas de conexión
  steelLineLight: '#3A3A3A',

  // Accent Único (Firma W-Tracker)
  mutedGold: '#C5A059',
  mutedGoldDark: '#9E7E38',
  mutedGoldTransparent: 'rgba(197, 160, 89, 0.12)',

  // Estados Semánticos Operativos V2.2.0
  successGreen: '#2E7D32',   // ACTIVA — Trabajo remunerado
  successGreenBg: 'rgba(46, 125, 50, 0.15)',

  royalBlue: '#2563EB',      // TRASLADO — Tránsito remunerado
  royalBlueBg: 'rgba(37, 99, 235, 0.15)',

  lunchOrange: '#EA580C',    // PAUSADA — Pausa / Almuerzo
  lunchOrangeBg: 'rgba(234, 88, 12, 0.15)',

  amberWarning: '#F57C00',   // SALIDA — Decision Hub / Retrocompatibilidad
  amberWarningBg: 'rgba(245, 124, 0, 0.15)',

  deepRed: '#C62828',        // CONFLICT / ERROR — Requerimiento forense
  deepRedBg: 'rgba(198, 40, 40, 0.15)',

  slateBlue: '#455A64',      // CERRADA / NO_INICIADA — Estado pasivo
  slateBlueBg: 'rgba(69, 90, 100, 0.15)',

  warningYellow: '#EAB308',  // ESPERANDO — Arribo pendiente
  warningYellowBg: 'rgba(234, 179, 8, 0.15)',

  neutralGray: '#9CA3AF',
} as const;

// ── 2. TIPOGRAFÍA Y JERARQUÍA ───────────────────────────────────
export const TEXT = {
  primary: '#FFFFFF',
  secondary: '#A1A1AA',
  muted: '#6B7280',
  accent: PALETTE.mutedGold,
} as const;

export const FONT = {
  h1: { size: 32, lineHeight: 38, weight: '700' as const, letterSpacing: -0.5 },
  h2: { size: 24, lineHeight: 30, weight: '700' as const, letterSpacing: -0.3 },
  h3: { size: 18, lineHeight: 24, weight: '600' as const, letterSpacing: 0 },
  bodyLarge: { size: 16, lineHeight: 22, weight: '500' as const, letterSpacing: 0 },
  body: { size: 14, lineHeight: 20, weight: '400' as const, letterSpacing: 0 },
  bodyStrong: { size: 14, lineHeight: 20, weight: '600' as const, letterSpacing: 0 },
  caption: { size: 12, lineHeight: 16, weight: '400' as const, letterSpacing: 0.2 },
  captionStrong: { size: 12, lineHeight: 16, weight: '600' as const, letterSpacing: 0.2 },
  label: { size: 10, lineHeight: 14, weight: '700' as const, letterSpacing: 1.5 },
} as const;

// ── 3. ESPACIADO Y GEOMETRÍA DE REJILLA ─────────────────────────
export const SPACING = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
} as const;

export const RADIUS = {
  xs: 6, sm: 10, inputs: 16, cards: 20, modals: 28, pills: 999,
} as const;

// ── 4. MAPEOS DE ESTADO CROMÁTICO Y SEMÁNTICO ───────────────────
export const STATE_COLORS: Record<SessionState, { main: string; bg: string }> = {
  NO_INICIADA: { main: PALETTE.slateBlue, bg: PALETTE.slateBlueBg },
  ESPERANDO: { main: PALETTE.warningYellow, bg: PALETTE.warningYellowBg },
  TRASLADO: { main: PALETTE.royalBlue, bg: PALETTE.royalBlueBg },
  ACTIVA: { main: PALETTE.successGreen, bg: PALETTE.successGreenBg },
  PAUSADA: { main: PALETTE.lunchOrange, bg: PALETTE.lunchOrangeBg },
  SALIDA: { main: PALETTE.amberWarning, bg: PALETTE.amberWarningBg },
  CERRADA: { main: PALETTE.slateBlue, bg: PALETTE.slateBlueBg },
};

export const PILL_STATUS_COLORS: Record<PillStatus, { main: string; bg: string }> = {
  idle: { main: PALETTE.slateBlue, bg: PALETTE.slateBlueBg },
  pending: { main: PALETTE.warningYellow, bg: PALETTE.warningYellowBg },
  active: { main: PALETTE.successGreen, bg: PALETTE.successGreenBg },
  warning: { main: PALETTE.amberWarning, bg: PALETTE.amberWarningBg },
  error: { main: PALETTE.deepRed, bg: PALETTE.deepRedBg },
  closed: { main: PALETTE.slateBlue, bg: PALETTE.slateBlueBg },
  lunch: { main: PALETTE.lunchOrange, bg: PALETTE.lunchOrangeBg },
  transit: { main: PALETTE.royalBlue, bg: PALETTE.royalBlueBg },

  NEUTRAL: { main: PALETTE.slateBlue, bg: PALETTE.slateBlueBg },
  INFO: { main: PALETTE.warningYellow, bg: PALETTE.warningYellowBg },
  SUCCESS: { main: PALETTE.successGreen, bg: PALETTE.successGreenBg },
  WARNING: { main: PALETTE.amberWarning, bg: PALETTE.amberWarningBg },
  ERROR: { main: PALETTE.deepRed, bg: PALETTE.deepRedBg },
  LUNCH: { main: PALETTE.lunchOrange, bg: PALETTE.lunchOrangeBg },
  TRANSIT: { main: PALETTE.royalBlue, bg: PALETTE.royalBlueBg },
};

export const INTEGRITY_COLORS: Record<IntegrityType, { main: string; bg: string; label: string }> = {
  VALID: { main: PALETTE.successGreen, bg: PALETTE.successGreenBg, label: 'Validada' },
  MANUAL: { main: PALETTE.neutralGray, bg: 'rgba(156, 163, 175, 0.15)', label: 'Ajuste Manual' },
  AUTO: { main: PALETTE.slateBlue, bg: PALETTE.slateBlueBg, label: 'Auto Cierre' },
  CONFLICT: { main: PALETTE.amberWarning, bg: PALETTE.amberWarningBg, label: 'Revisión Forense' },
  RECOVERED: { main: PALETTE.royalBlue, bg: PALETTE.royalBlueBg, label: 'Recuperada (WAL)' },
  GPS: { main: PALETTE.successGreen, bg: PALETTE.successGreenBg, label: 'Validada' },
};

// ── 5. ALIASES DE COMPATIBILIDAD RETROACTIVA ────────────────────
export const COLORS = {
  background: PALETTE.obsidian,
  surface: PALETTE.graphite,
  surfaceElevated: PALETTE.carbonMist,
  surfaceHighlight: '#202020',
  border: PALETTE.steelLine,
} as const;

export const ACCENT = {
  primary: PALETTE.mutedGold,
  dim: PALETTE.mutedGoldDark,
  soft: PALETTE.mutedGoldTransparent,
} as const;

export const STATUS = {
  success: PALETTE.successGreen,
  warning: PALETTE.amberWarning,
  error: PALETTE.deepRed,
  info: PALETTE.royalBlue,
} as const;

