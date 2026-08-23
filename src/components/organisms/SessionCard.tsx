// ============================================================
// ORGANISM: SessionCard — Tarjeta de auditoría e historial (CONSOLIDADO)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint Pantalla Historial — Sección 2.4 | Identidad V2
// Visualización de jornadas históricas y en curso con métricas de auditoría.
// ============================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../../theme';
import { Session, SessionState } from '../../types';
import {
  formatCurrency,
  formatDate,
  formatHours,
  formatTimeRange,
} from '../../utils/formatters';
import { Icon } from '../atoms/Icon';
import { IntegrityBadge } from '../atoms/IntegrityBadge';

export interface SessionCardProps {
  session: Session;
  onPress?: (session: Session) => void;
  onLongPress?: (session: Session) => void;
  onEdit?: (session: Session) => void;
  onDelete?: (session: Session) => void;
}

const getStateLabel = (state: SessionState): string => {
  switch (state) {
    case 'NO_INICIADA':
      return 'No iniciada';
    case 'ESPERANDO':
      return 'Esperando llegada';
    case 'TRASLADO':
      return 'En traslado';
    case 'ACTIVA':
      return 'Activa';
    case 'PAUSADA':
      return 'En pausa';
    case 'SALIDA':
      return 'Salida detectada';
    case 'CERRADA':
      return 'Cerrada';
    default:
      return 'Pendiente';
  }
};

export const SessionCard: React.FC<SessionCardProps> = React.memo(({
  session,
  onPress,
  onLongPress,
  onEdit,
  onDelete,
}) => {
  const isClosed = session.state === 'CERRADA';
  const hasEndTime = Boolean(session.endTime);
  const formattedDate = formatDate(session.date);
  const timeRange = hasEndTime
    ? formatTimeRange(session.startTime, session.endTime)
    : `${session.startTime} - En curso`;

  const destinationName = session.alias || session.destination || 'Sin destino';
  const visitCount = session.visits?.length || 1;

  return (
    <TouchableOpacity
      style={[styles.card, !isClosed && styles.cardPending]}
      onPress={() => onPress?.(session)}
      onLongPress={() => onLongPress?.(session)}
      activeOpacity={onPress ? 0.82 : 1}
      disabled={!onPress && !onLongPress}
    >
      {/* HEADER: FECHA + STATE BADGE + INTEGRITY BADGE */}
      <View style={styles.cardHeader}>
        <View style={styles.dateGroup}>
          <Icon name="history" size={14} color={TEXT.secondary} />
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>

        <View style={styles.badgeGroup}>
          {!isClosed && (
            <View style={styles.stateBadge}>
              <Text style={styles.stateBadgeText}>
                {getStateLabel(session.state)}
              </Text>
            </View>
          )}
          <IntegrityBadge type={session.integrityType} />
        </View>
      </View>

      {/* CUERPO PRINCIPAL: DESTINO Y RANGO HORARIO */}
      <View style={styles.bodySection}>
        <Text
          style={[styles.destinationTitle, !isClosed && styles.destinationPending]}
          numberOfLines={2}
        >
          {destinationName}
        </Text>
        <Text style={styles.timeRangeText}>{timeRange}</Text>
      </View>

      {/* REJILLA DE MÉTRICAS FINANCIERAS Y AUDITORÍA */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>HORAS TOTALES</Text>
          <Text style={styles.metricValue}>{formatHours(session.totalHours)}</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>ALMUERZO</Text>
          <Text style={styles.metricValue}>{session.lunchDeductedMinutes}m</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>DESTINOS</Text>
          <Text style={styles.metricValue}>{visitCount}</Text>
        </View>

        <View style={[styles.metricItem, styles.earningsItem]}>
          <Text style={styles.metricLabel}>INGRESO</Text>
          <Text style={styles.earningsValue}>
            {formatCurrency(session.totalEarnings)}
          </Text>
        </View>
      </View>

      {/* PIE DE TARJETA: NOTAS Y ACCIONES DE AUDITORÍA */}
      {(session.notes || onEdit || onDelete) && (
        <View style={styles.cardFooter}>
          {session.notes ? (
            <Text style={styles.notesText} numberOfLines={1}>
              Nota: {session.notes}
            </Text>
          ) : (
            <View />
          )}

          <View style={styles.actionIconsGroup}>
            {onEdit && (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => onEdit(session)}
                activeOpacity={0.7}
              >
                <Icon name="pencil" size={14} color={TEXT.secondary} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => onDelete(session)}
                activeOpacity={0.7}
              >
                <Icon name="close" size={14} color={PALETTE.deepRed} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.graphite,
    borderRadius: RADIUS.cards,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    padding: SPACING.lg,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  cardPending: {
    borderColor: PALETTE.amberWarning,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  dateGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  dateText: {
    color: TEXT.secondary,
    fontSize: FONT.captionStrong.size,
    fontWeight: '600',
    fontFamily: 'Montserrat',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  stateBadge: {
    paddingHorizontal: SPACING.xs + 2,
    height: 22,
    borderRadius: RADIUS.pills,
    backgroundColor: 'rgba(245, 124, 0, 0.14)',
    borderWidth: 1,
    borderColor: PALETTE.amberWarning,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateBadgeText: {
    color: PALETTE.amberWarning,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Montserrat',
    textTransform: 'uppercase',
  },
  bodySection: {
    marginBottom: SPACING.md,
  },
  destinationTitle: {
    color: TEXT.primary,
    fontSize: FONT.h3.size - 2,
    fontWeight: FONT.h3.weight,
    fontFamily: 'Montserrat',
    marginBottom: SPACING.xxs,
    lineHeight: 22,
  },
  destinationPending: {
    color: TEXT.secondary,
  },
  timeRangeText: {
    color: TEXT.muted,
    fontSize: FONT.caption.size,
    fontFamily: 'Montserrat',
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: PALETTE.carbonMist,
    borderRadius: RADIUS.inputs,
    padding: SPACING.md,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'flex-start',
  },
  earningsItem: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    color: TEXT.muted,
    fontSize: FONT.label.size - 2,
    fontWeight: FONT.label.weight,
    letterSpacing: 1,
    fontFamily: 'Montserrat',
    marginBottom: SPACING.xxs,
  },
  metricValue: {
    color: TEXT.primary,
    fontSize: FONT.bodyStrong.size - 2,
    fontWeight: '600',
    fontFamily: 'Montserrat',
  },
  earningsValue: {
    color: PALETTE.mutedGold,
    fontSize: FONT.bodyStrong.size,
    fontWeight: '700',
    fontFamily: 'Montserrat',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: PALETTE.steelLine,
  },
  notesText: {
    color: TEXT.secondary,
    fontSize: FONT.caption.size,
    fontFamily: 'Montserrat',
    fontStyle: 'italic',
    flex: 1,
    marginRight: SPACING.md,
  },
  actionIconsGroup: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  iconBtn: {
    padding: SPACING.xs,
    backgroundColor: PALETTE.carbonMist,
    borderRadius: RADIUS.xs,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
  },
});
