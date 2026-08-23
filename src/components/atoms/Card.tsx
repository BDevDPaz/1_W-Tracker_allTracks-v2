// ============================================================
// ATOM: Card — Contenedor atómico base con jerarquía de elevación (CONSOLIDADO)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Guía Técnica — Sección 2.1 | Identidad Visual V2
// Soporta Level 0 (Obsidian), Level 1 (Graphite) y Level 2 (CarbonMist / Highlight)
// ============================================================

import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { PALETTE, RADIUS, SPACING } from '../../theme';

export type CardVariant = 'base' | 'elevated' | 'highlight';
export type CardLevel = 0 | 1 | 2;

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  level?: CardLevel;
  bordered?: boolean;
  hasBorder?: boolean;
  borderColor?: string;
  padding?: keyof typeof SPACING;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  activeOpacity?: number;
}

const LEVEL_BACKGROUNDS: Record<CardLevel, string> = {
  0: PALETTE.obsidian,
  1: PALETTE.graphite,
  2: PALETTE.carbonMist,
};

const VARIANT_TO_LEVEL: Record<CardVariant, CardLevel> = {
  base: 1,
  elevated: 2,
  highlight: 2,
};

export const Card: React.FC<CardProps> = React.memo(({
  children,
  variant,
  level,
  bordered,
  hasBorder,
  borderColor = PALETTE.steelLine,
  padding = 'lg',
  style,
  onPress,
  activeOpacity = 0.8,
}) => {
  // Mapeo unificado entre variant y level
  const effectiveLevel: CardLevel =
    level ?? (variant ? VARIANT_TO_LEVEL[variant] : 1);

  const effectiveBordered: boolean =
    bordered ?? hasBorder ?? (variant === 'highlight' || effectiveLevel > 0);

  const backgroundColor =
    variant === 'highlight' ? '#202020' : LEVEL_BACKGROUNDS[effectiveLevel];

  const cardStyle: ViewStyle = {
    backgroundColor,
    borderRadius: RADIUS.cards,
    padding: SPACING[padding],
    borderWidth: effectiveBordered ? 1 : 0,
    borderColor: effectiveBordered ? borderColor : 'transparent',
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.baseCard, cardStyle, style]}
        onPress={onPress}
        activeOpacity={activeOpacity}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.baseCard, cardStyle, style]}>{children}</View>;
});

const styles = StyleSheet.create({
  baseCard: {
    overflow: 'hidden',
  },
});
