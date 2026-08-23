// ============================================================
// ORGANISM: OperationalHeroCard — Controlador de tarjeta Hero operativa (CONSOLIDADO)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint Pantalla Hoy — Sección 3 | Identidad Visual V2
// Responsabilidad: Tarjeta principal de la pantalla Hoy. Refleja la máquina de 7 estados.
// REGLA: Tiene el monopolio de las CTAs primarias en HoyScreen.
//        Solo 1 botón variant="primary" visible simultáneamente.
// ============================================================

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FONT, PALETTE, RADIUS, SPACING, STATE_COLORS, TEXT } from '../../theme';
import { Session, SessionState } from '../../types';
import { formatCurrency, formatTime12, getSessionStateUI } from '../../utils/formatters';
import { Button } from '../atoms/Button';
import { Icon, IconName } from '../atoms/Icon';
import { StatusPill } from '../atoms/StatusPill';

export interface OperationalHeroCardProps {
  state: SessionState;
  session: Partial<Session> | null;
  elapsedTime: string; // "HH:MM" en tiempo real
  loading?: boolean;
  loadingText?: string;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
}

const STATE_ICONS: Record<SessionState, IconName> = {
  NO_INICIADA: 'moon',
  ESPERANDO: 'clock',
  TRASLADO: 'car',
  ACTIVA: 'briefcase',
  PAUSADA: 'coffee',
  SALIDA: 'alert-triangle',
  CERRADA: 'check-circle',
};

const PILL_MAP: Record<SessionState, 'idle' | 'pending' | 'active' | 'warning' | 'error' | 'closed'> = {
  NO_INICIADA: 'idle',
  ESPERANDO: 'pending',
  TRASLADO: 'pending',
  ACTIVA: 'active',
  PAUSADA: 'warning',
  SALIDA: 'warning',
  CERRADA: 'closed',
};

export const OperationalHeroCard: React.FC<OperationalHeroCardProps> = React.memo(({
  state,
  session,
  elapsedTime,
  loading = false,
  loadingText,
  onPrimaryAction,
  onSecondaryAction,
}) => {
  const uiMap = useMemo(() => getSessionStateUI(state), [state]);
  const stateColor = STATE_COLORS[state] || STATE_COLORS.NO_INICIADA;
  const stateIcon = STATE_ICONS[state];

  const destinationText = session?.alias || session?.destination || 'Sin destino configurado';
  const startTimeText = session?.startTime ? formatTime12(session.startTime) : '--:--';
  const earnings = session?.totalEarnings ?? 0;
  const showTimer = uiMap.showTimer || state === 'TRASLADO' || state === 'PAUSADA';

  return (
    <View style={[styles.card, { borderColor: stateColor.main }]}>
      {/* Indicador de Estado Superior */}
      <View style={[styles.stateIndicatorBar, { backgroundColor: stateColor.main }]} />

      {/* Header Row: Destino + Subtexto + StatusPill */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleGroup}>
          <View style={[styles.iconContainer, { backgroundColor: stateColor.bg }]}>
            <Icon name={stateIcon} size={18} color={stateColor.main} strokeWidth={2.5} />
          </View>

          <View style={styles.headerTexts}>
            <Text style={styles.stateSubtitle}>{uiMap.destinationSubtext.toUpperCase()}</Text>
            <Text style={styles.destinationTitle} numberOfLines={1}>
              {destinationText}
            </Text>
          </View>
        </View>

        <StatusPill status={PILL_MAP[state]} customLabel={uiMap.pillLabel} />
      </View>

      {/* ZONA DE MÉTRICAS / TIMER */}
      {showTimer ? (
        <View style={styles.timerSection}>
          <View style={styles.timerBlock}>
            <Text style={styles.timerLabel}>TIEMPO TRANSCURRIDO</Text>
            <Text style={styles.timerValue}>{elapsedTime}</Text>
            {earnings > 0 && (
              <Text style={styles.earningsHint}>
                Acumulado: {formatCurrency(earnings)}
              </Text>
            )}
          </View>

          <View style={styles.verticalDivider} />

          <View style={styles.timerBlock}>
            <Text style={styles.timerLabel}>HORA DE INICIO</Text>
            <Text style={styles.startValue}>{startTimeText}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.inactiveMessageBlock}>
          <Text style={styles.inactiveText}>
            {state === 'NO_INICIADA'
              ? 'Inicia tu jornada laboral para activar el monitoreo espacial y el registro de tiempo.'
              : state === 'CERRADA'
              ? 'La jornada ha finalizado. Todos los registros se encuentran guardados para auditoría.'
              : 'Esperando confirmación de arribo al destino configurado.'}
          </Text>
        </View>
      )}

      {/* ACCIONES DE LA TARJETA (CTAs) */}
      <View style={styles.actionGroup}>
        <Button
          label={uiMap.ctaPrimary}
          onPress={onPrimaryAction}
          variant={state === 'SALIDA' ? 'danger' : 'primary'}
          size="lg"
          fullWidth={!uiMap.ctaSecondary}
          loading={loading}
          loadingText={loadingText}
          iconName={state === 'NO_INICIADA' ? 'play' : state === 'ACTIVA' ? 'stop' : undefined}
          style={styles.actionBtn}
        />

        {uiMap.ctaSecondary && onSecondaryAction ? (
          <Button
            label={uiMap.ctaSecondary}
            onPress={onSecondaryAction}
            variant="secondary"
            size="lg"
            disabled={loading}
            style={styles.actionBtn}
          />
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.carbonMist,
    borderRadius: RADIUS.cards,
    borderWidth: 1,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    padding: SPACING.xl,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 220,
  },
  stateIndicatorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
    gap: SPACING.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTexts: {
    flex: 1,
  },
  stateSubtitle: {
    color: TEXT.muted,
    fontSize: FONT.label.size,
    fontWeight: FONT.label.weight,
    letterSpacing: FONT.label.letterSpacing,
    fontFamily: 'Montserrat',
    marginBottom: SPACING.xxs,
  },
  destinationTitle: {
    color: TEXT.primary,
    fontSize: FONT.h3.size - 2,
    fontWeight: FONT.h3.weight,
    fontFamily: 'Montserrat',
  },
  timerSection: {
    flexDirection: 'row',
    backgroundColor: PALETTE.graphite,
    borderRadius: RADIUS.inputs,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    alignItems: 'center',
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
  },
  timerBlock: {
    flex: 1,
    alignItems: 'center',
  },
  timerLabel: {
    color: TEXT.secondary,
    fontSize: FONT.label.size - 1,
    fontWeight: FONT.label.weight,
    letterSpacing: FONT.label.letterSpacing,
    fontFamily: 'Montserrat',
    marginBottom: SPACING.xs,
  },
  timerValue: {
    color: PALETTE.mutedGold,
    fontSize: FONT.h2.size,
    fontWeight: '700',
    fontFamily: 'Montserrat',
  },
  startValue: {
    color: TEXT.primary,
    fontSize: FONT.h3.size,
    fontWeight: '600',
    fontFamily: 'Montserrat',
  },
  earningsHint: {
    color: TEXT.secondary,
    fontSize: FONT.caption.size,
    fontFamily: 'Montserrat',
    marginTop: SPACING.xxs,
  },
  verticalDivider: {
    width: 1,
    height: '70%',
    backgroundColor: PALETTE.steelLine,
  },
  inactiveMessageBlock: {
    backgroundColor: PALETTE.graphite,
    borderRadius: RADIUS.inputs,
    padding: SPACING.md + 2,
    marginBottom: SPACING.xl,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
  },
  inactiveText: {
    color: TEXT.secondary,
    fontSize: FONT.body.size - 1,
    lineHeight: FONT.body.lineHeight,
    fontFamily: 'Montserrat',
    textAlign: 'center',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionBtn: {
    flex: 1,
  },
});
