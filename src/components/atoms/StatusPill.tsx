// ============================================================
// ATOM: StatusPill — Indicador de estado transaccional (CONSOLIDADO V2.2)
// Versión: 2.2.0 (Workday Tracking Platform)
// Fuente: Guía Técnica — Sección 2.1 | Identidad V2
// Mapea estados de la máquina de estados y Pills visuales con SVG
// ============================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FONT, PILL_STATUS_COLORS, RADIUS, SPACING } from '../../theme';
import { PillStatus } from '../../types';
import { getStatusColor, getStatusLabel } from '../../utils/formatters';
import { Icon, IconName } from './Icon';

export interface StatusPillProps {
  status: PillStatus;
  label?: string;
  customLabel?: string;
  showIcon?: boolean;
  useDot?: boolean;
}

const STATUS_ICONS: Record<PillStatus, IconName> = {
  idle: 'moon',
  pending: 'clock',
  active: 'map-pin',
  warning: 'alert-triangle',
  error: 'alert-triangle',
  closed: 'check-circle',
  lunch: 'coffee',
  transit: 'car',

  NEUTRAL: 'moon',
  INFO: 'clock',
  SUCCESS: 'map-pin',
  WARNING: 'alert-triangle',
  ERROR: 'alert-triangle',
  LUNCH: 'coffee',
  TRANSIT: 'car',
};

export const StatusPill: React.FC<StatusPillProps> = React.memo(({
  status,
  label,
  customLabel,
  showIcon = true,
  useDot = false,
}) => {
  const colors = PILL_STATUS_COLORS[status];
  const fallbackColor = getStatusColor(status);

  const mainColor = colors?.main ?? fallbackColor;
  const bgColor = colors?.bg ?? 'transparent';
  const displayLabel = customLabel || label || getStatusLabel(status);
  const iconName = STATUS_ICONS[status] || 'clock';

  return (
    <View style={[styles.pill, { backgroundColor: bgColor, borderColor: mainColor }]}>
      {useDot ? (
        <View style={[styles.dot, { backgroundColor: mainColor }]} />
      ) : (
        showIcon && <Icon name={iconName} size={12} color={mainColor} strokeWidth={2.5} />
      )}
      <Text style={[styles.label, { color: mainColor }]}>
        {displayLabel.toUpperCase()}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: SPACING.sm + 2,
    borderRadius: RADIUS.pills,
    borderWidth: 1,
    gap: SPACING.xs,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: FONT.label.size,
    fontWeight: FONT.label.weight,
    letterSpacing: FONT.label.letterSpacing,
    fontFamily: 'Montserrat',
  },
});

