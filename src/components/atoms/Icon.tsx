// ============================================================
// ATOM: Icon — Motor Vectorial SVG
// Versión: 2.0.0 (Workday Tracking Design System)
// Ruta: src/components/atoms/Icon.tsx
// Dependencia: lucide-react-native
// Responsabilidad: Wrapper fuertemente tipado para íconos vectoriales.
// ============================================================

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import {
  MapPin, Clock, History, FileText, Settings, Navigation,
  Moon, Briefcase, Coffee, Car, User, Mail, Percent, Search,
  Play, Square, X, AlertTriangle, CheckCircle, ShieldCheck,
  ChevronRight, ChevronLeft, Unlock, Lock, Pencil
} from 'lucide-react-native';
import { TEXT } from '../../theme';

// Mapa maestro que convierte kebab-case a componentes de Lucide
const ICON_MAP = {
  'map-pin': MapPin,
  'clock': Clock,
  'history': History,
  'file-text': FileText,
  'settings': Settings,
  'navigation': Navigation,
  'moon': Moon,
  'briefcase': Briefcase,
  'coffee': Coffee,
  'car': Car,
  'user': User,
  'mail': Mail,
  'percent': Percent,
  'search': Search,
  'play': Play,
  'stop': Square,
  'close': X,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle,
  'shield-check': ShieldCheck,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'unlock': Unlock,
  'lock': Lock,
  'pencil': Pencil
} as const;

export type IconName = keyof typeof ICON_MAP;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export const Icon: React.FC<IconProps> = React.memo(({
  name, size = 24, color = TEXT.primary, strokeWidth = 2, style
}) => {
  const LucideIcon = ICON_MAP[name];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} color={color} strokeWidth={strokeWidth} style={style as any} />;
});
