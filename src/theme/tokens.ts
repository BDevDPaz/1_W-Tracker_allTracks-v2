import type {
  SessionState,
  PillStatus,
  IntegrityType,
} from "@/types/contracts";

export const PALETTE = {
  // Sistema premium de la página: negro #0A0A0C + dorado #D4AF37
  obsidian: "#0A0A0C",
  graphite: "#121212",
  carbonMist: "#1A1A1A",
  steelLine: "#2A2A2A",
  steelLineLight: "#3A3A3A",
  mutedGold: "#D4AF37",
  mutedGoldLight: "#E8C86A",
  mutedGoldDark: "#9E7E38",
  mutedGoldTransparent: "rgba(212, 175, 55, 0.12)",
  mutedGoldTransparentStrong: "rgba(212, 175, 55, 0.18)",
  successGreen: "#2E7D32",
  successGreenBg: "rgba(46, 125, 50, 0.15)",
  royalBlue: "#2563EB",
  royalBlueBg: "rgba(37, 99, 235, 0.15)",
  lunchOrange: "#EA580C",
  lunchOrangeBg: "rgba(234, 88, 12, 0.15)",
  amberWarning: "#F57C00",
  amberWarningBg: "rgba(245, 124, 0, 0.15)",
  deepRed: "#C62828",
  deepRedBg: "rgba(198, 40, 40, 0.15)",
  slateBlue: "#455A64",
  slateBlueBg: "rgba(69, 90, 100, 0.15)",
  warningYellow: "#EAB308",
  warningYellowBg: "rgba(234, 179, 8, 0.15)",
  neutralGray: "#9CA3AF",
} as const;

export const TEXT = {
  primary: "#FFFFFF",
  secondary: "#A1A1AA",
  muted: "#6B7280",
  accent: PALETTE.mutedGold,
} as const;

export const FONT = {
  h1: { size: 34, lineHeight: 40, weight: "800" as const, letterSpacing: -0.5 },
  h2: { size: 26, lineHeight: 32, weight: "700" as const, letterSpacing: -0.3 },
  h3: { size: 18, lineHeight: 24, weight: "600" as const, letterSpacing: 0 },
  bodyLarge: {
    size: 16,
    lineHeight: 22,
    weight: "500" as const,
    letterSpacing: 0,
  },
  body: { size: 14, lineHeight: 20, weight: "400" as const, letterSpacing: 0 },
  bodyStrong: {
    size: 14,
    lineHeight: 20,
    weight: "600" as const,
    letterSpacing: 0,
  },
  caption: {
    size: 12,
    lineHeight: 16,
    weight: "400" as const,
    letterSpacing: 0.2,
  },
  captionStrong: {
    size: 12,
    lineHeight: 16,
    weight: "600" as const,
    letterSpacing: 0.2,
  },
  label: {
    size: 10,
    lineHeight: 14,
    weight: "700" as const,
    letterSpacing: 1.5,
  },
} as const;

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const RADIUS = {
  xs: 6,
  sm: 10,
  inputs: 16,
  cards: 24,
  hero: 28,
  modals: 28,
  pills: 999,
} as const;

export const SHADOWS = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  hero: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  goldGlow: {
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const STATE_COLORS: Record<SessionState, { main: string; bg: string }> =
  {
    NO_INICIADA: { main: PALETTE.slateBlue, bg: PALETTE.slateBlueBg },
    ESPERANDO: { main: PALETTE.warningYellow, bg: PALETTE.warningYellowBg },
    TRASLADO: { main: PALETTE.royalBlue, bg: PALETTE.royalBlueBg },
    ACTIVA: { main: PALETTE.successGreen, bg: PALETTE.successGreenBg },
    PAUSADA: { main: PALETTE.lunchOrange, bg: PALETTE.lunchOrangeBg },
    SALIDA: { main: PALETTE.amberWarning, bg: PALETTE.amberWarningBg },
    CERRADA: { main: PALETTE.slateBlue, bg: PALETTE.slateBlueBg },
  };

export const PILL_STATUS_COLORS: Record<
  PillStatus,
  { main: string; bg: string }
> = {
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

export const INTEGRITY_COLORS: Record<
  IntegrityType,
  { main: string; bg: string; label: string }
> = {
  VALID: {
    main: PALETTE.successGreen,
    bg: PALETTE.successGreenBg,
    label: "Validada",
  },
  MANUAL: {
    main: PALETTE.neutralGray,
    bg: "rgba(156, 163, 175, 0.15)",
    label: "Ajuste Manual",
  },
  AUTO: {
    main: PALETTE.slateBlue,
    bg: PALETTE.slateBlueBg,
    label: "Auto Cierre",
  },
  CONFLICT: {
    main: PALETTE.amberWarning,
    bg: PALETTE.amberWarningBg,
    label: "Revisión Forense",
  },
  RECOVERED: {
    main: PALETTE.royalBlue,
    bg: PALETTE.royalBlueBg,
    label: "Recuperada (WAL)",
  },
  GPS: {
    main: PALETTE.successGreen,
    bg: PALETTE.successGreenBg,
    label: "Validada",
  },
};

export const COLORS = {
  background: PALETTE.obsidian,
  surface: PALETTE.graphite,
  surfaceElevated: PALETTE.carbonMist,
  surfaceHighlight: "#202020",
  border: PALETTE.steelLine,
} as const;

export const ACCENT = {
  primary: PALETTE.mutedGold,
  light: PALETTE.mutedGoldLight,
  dim: PALETTE.mutedGoldDark,
  soft: PALETTE.mutedGoldTransparent,
  softStrong: PALETTE.mutedGoldTransparentStrong,
} as const;

export const STATUS = {
  success: PALETTE.successGreen,
  warning: PALETTE.amberWarning,
  error: PALETTE.deepRed,
  info: PALETTE.royalBlue,
} as const;
