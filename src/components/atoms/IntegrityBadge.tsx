// ============================================================
// ATOM: IntegrityBadge — Indicador visual de auditoría forense (CONSOLIDADO)
// Versión: 2.2.0 (Workday Tracking Platform)
// Fuente: Blueprint Pantalla Historial — Sección 3 | Identidad V2
// Mapea la integridad de la sesión (VALID, MANUAL, AUTO, CONFLICT, RECOVERED, GPS)
// ============================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FONT, INTEGRITY_COLORS, RADIUS, SPACING } from '../../theme';
import { IntegrityType } from '../../types';
import { getIntegrityConfig } from '../../utils/formatters';
import { Icon, IconName } from './Icon';

export interface IntegrityBadgeProps {
  type: IntegrityType;
  customLabel?: string;
}

const INTEGRITY_ICONS: Record<IntegrityType, IconName> = {
  VALID: 'shield-check',
  MANUAL: 'pencil',
  AUTO: 'clock',
  CONFLICT: 'alert-triangle',
  RECOVERED: 'refresh-cw',
  GPS: 'shield-check',
};

export const IntegrityBadge: React.FC<IntegrityBadgeProps> = React.memo(({
  type,
  customLabel,
}) => {
  const colorConfig = INTEGRITY_COLORS[type];
  const fallbackConfig = getIntegrityConfig(type);

  const mainColor = colorConfig?.main ?? fallbackConfig.borderColor;
  const bgColor = colorConfig?.bg ?? 'transparent';
  const labelText = customLabel || colorConfig?.label || fallbackConfig.label;
  const iconName = INTEGRITY_ICONS[type] || 'shield-check';

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderColor: mainColor }]}>
      <Icon name={iconName} size={12} color={mainColor} strokeWidth={2.5} />
      <Text style={[styles.label, { color: mainColor }]}>
        {labelText.toUpperCase()}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs + 1,
    borderRadius: RADIUS.pills,
    borderWidth: 1,
    gap: SPACING.xs,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: FONT.label.size - 1,
    fontWeight: FONT.label.weight,
    letterSpacing: FONT.label.letterSpacing,
    fontFamily: 'Montserrat',
  },
});

