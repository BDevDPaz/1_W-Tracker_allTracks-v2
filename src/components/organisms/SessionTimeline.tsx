// ============================================================
// ORGANISM: SessionTimeline — Bitácora cronológica visual (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint Pantalla Hoy — Sección 2.4 | Historial — Sección 4.1
// Renderiza hitos cronológicos unidos por línea conductora steelLine
// ============================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../../theme';
import { PillStatus, TimelineEvent } from '../../types';
import { formatTime12 } from '../../utils/formatters';
import { Icon, IconName } from '../atoms/Icon';

export interface SessionTimelineProps {
  events: TimelineEvent[];
  title?: string;
  activeEventId?: string;
}

const STATUS_ICONS: Record<PillStatus, IconName> = {
  idle: 'moon',
  pending: 'clock',
  active: 'check-circle',
  warning: 'alert-triangle',
  error: 'close',
  closed: 'stop',
};

const STATUS_COLORS: Record<PillStatus, string> = {
  idle: PALETTE.slateBlue,
  pending: PALETTE.warningYellow,
  active: PALETTE.successGreen,
  warning: PALETTE.amberWarning,
  error: PALETTE.deepRed,
  closed: PALETTE.mutedGold,
};

export const SessionTimeline: React.FC<SessionTimelineProps> = React.memo(({
  events,
  title = 'Bitácora de actividades',
}) => {
  if (!events || events.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
        <View style={styles.emptyContainer}>
          <Icon name="history" size={24} color={TEXT.muted} />
          <Text style={styles.emptyText}>Sin registros de actividad para la jornada.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>

      <View style={styles.timelineWrapper}>
        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          const status = (event.status as PillStatus) || 'idle';
          const iconColor = STATUS_COLORS[status] || PALETTE.steelLine;
          const iconName = STATUS_ICONS[status] || 'clock';

          let rawTime = event.timestamp;
          if (rawTime.includes('T')) {
            rawTime = rawTime.split('T')[1]?.substring(0, 5) || '--:--';
          }

          const timeFormatted = formatTime12(rawTime);
          const eventKey = `timeline-${event.id || index}-${index}`;

          return (
            <View key={eventKey} style={styles.eventRow}>
              {/* COLUMNA IZQUIERDA: HORA */}
              <View style={styles.leftColumn}>
                <Text style={styles.timeText}>{timeFormatted}</Text>
              </View>

              {/* COLUMNA CENTRAL: PUNTO E ÍCONO CON LÍNEA */}
              <View style={styles.centerColumn}>
                <View style={[styles.dotContainer, { borderColor: iconColor }]}>
                  <Icon name={iconName} size={10} color={iconColor} strokeWidth={3} />
                </View>

                {!isLast && <View style={styles.connectorLine} />}
              </View>

              {/* COLUMNA DERECHA: TARJETA DE EVENTO */}
              <View style={styles.rightColumn}>
                <View style={styles.eventCard}>
                  <Text style={styles.descriptionText}>{event.description}</Text>
                  {event.metadata ? (
                    <Text style={styles.metadataText}>{event.metadata}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  sectionTitle: {
    color: TEXT.secondary,
    fontSize: FONT.label.size,
    fontWeight: FONT.label.weight,
    letterSpacing: FONT.label.letterSpacing,
    fontFamily: 'Montserrat',
    marginBottom: SPACING.md,
  },
  timelineWrapper: {
    backgroundColor: PALETTE.graphite,
    borderRadius: RADIUS.cards,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  emptyContainer: {
    backgroundColor: PALETTE.graphite,
    borderRadius: RADIUS.cards,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    color: TEXT.muted,
    fontSize: FONT.body.size,
    fontFamily: 'Montserrat',
    textAlign: 'center',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 48,
  },
  leftColumn: {
    width: 65,
    paddingTop: 2,
  },
  timeText: {
    color: TEXT.secondary,
    fontSize: FONT.captionStrong.size,
    fontWeight: '600',
    fontFamily: 'Montserrat',
  },
  centerColumn: {
    alignItems: 'center',
    width: 24,
    marginRight: SPACING.sm,
  },
  dotContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PALETTE.obsidian,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  connectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: PALETTE.steelLine,
    marginTop: -2,
    marginBottom: -2,
  },
  rightColumn: {
    flex: 1,
    paddingBottom: SPACING.md,
  },
  eventCard: {
    backgroundColor: PALETTE.carbonMist,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm + 2,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
  },
  descriptionText: {
    color: TEXT.primary,
    fontSize: FONT.caption.size + 1,
    lineHeight: FONT.caption.lineHeight + 2,
    fontFamily: 'Montserrat',
  },
  metadataText: {
    color: TEXT.muted,
    fontSize: FONT.label.size,
    fontFamily: 'Montserrat',
    marginTop: SPACING.xxs,
  },
});
