// ============================================================
// SCREEN: HoyScreen — Centro de operaciones en tiempo real (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint Pantalla Hoy | Blueprint de Navegación 2.1
// Ruta: src/screens/HoyScreen.tsx
// Responsabilidad: Orquesta la sesión activa, los modales operacionales y el dashboard en vivo.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Button,
  Icon,
  OperationalHeroCard,
  SessionTimeline,
  SummaryBlock,
  SystemHealthBlock,
} from '../components';
import {
  DailySetupModal,
  EditSessionModal,
  ExitDetectionModal,
  LunchModal,
} from '../modals';
import { useSessionStore } from '../stores/sessionStore';
import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../theme';
import { LunchModalPayload, SessionState, TimelineEvent } from '../types';
import { formatCurrency, formatHours } from '../utils/formatters';

// ── HELPERS DE TIEMPO Y CÁLCULO ─────────────────────────────

const getCurrentTimeHHMM = (): string => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const calculateElapsedTime = (startTimeStr?: string | null): string => {
  if (!startTimeStr) return '00:00';

  let startH = 0;
  let startM = 0;

  if (startTimeStr.includes('T')) {
    const date = new Date(startTimeStr);
    if (!isNaN(date.getTime())) {
      startH = date.getHours();
      startM = date.getMinutes();
    }
  } else {
    const parts = startTimeStr.split(':');
    startH = Number(parts[0] ?? 0);
    startM = Number(parts[1] ?? 0);
  }

  const now = new Date();
  const startTotalMinutes = startH * 60 + startM;
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  let diff = currentTotalMinutes - startTotalMinutes;
  if (diff < 0) diff += 24 * 60; // Mitigación para cruce de medianoche

  const hh = String(Math.floor(diff / 60)).padStart(2, '0');
  const mm = String(diff % 60).padStart(2, '0');

  return `${hh}:${mm}`;
};

// ── COMPONENTE PRINCIPAL (SCREEN) ───────────────────────────

export const HoyScreen: React.FC = () => {
  const {
    sessionState,
    activeSession,
    startSession,
    confirmArrival,
    validateForegroundExit,
    closeSession,
    confirmExit,
    stayWorking,
    cancelSession,
    systemHealth,
  } = useSessionStore();

  const scrollRef = useRef<ScrollView | null>(null);
  const systemHealthY = useRef<number>(0);

  const [elapsedTime, setElapsedTime] = useState<string>('00:00');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string | undefined>();

  // Estados de Modales
  const [showDailySetupModal, setShowDailySetupModal] = useState<boolean>(false);
  const [showLunchModal, setShowLunchModal] = useState<boolean>(false);
  const [showExitDetectionModal, setShowExitDetectionModal] = useState<boolean>(false);
  const [exitDetectedTime, setExitDetectedTime] = useState<string>('00:00');

  // ── SINCRO DE TEMPORIZADOR EN TIEMPO REAL ─────────────────

  useEffect(() => {
    const isRunning =
      sessionState === 'TRASLADO' ||
      sessionState === 'ACTIVA' ||
      sessionState === 'PAUSADA' ||
      sessionState === 'SALIDA';

    if (!isRunning || !activeSession?.startTime) {
      setElapsedTime('00:00');
      return;
    }

    const updateTimer = () => {
      setElapsedTime(calculateElapsedTime(activeSession.startTime));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000);

    return () => clearInterval(interval);
  }, [sessionState, activeSession?.startTime]);

  // ── VALIDACIÓN DE SALIDA EN FOREGROUND ────────────────────

  useEffect(() => {
    if (sessionState !== 'ACTIVA') return;

    let isMounted = true;
    const interval = setInterval(() => {
      validateForegroundExit().catch((error: unknown) => {
        if (isMounted) {
          console.warn('[Foreground Exit Validation Warning]', error);
        }
      });
    }, 60000); // Evalúa cada minuto mientras la app está abierta

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionState, validateForegroundExit]);

  // ── DISPARO AUTOMÁTICO DE MODAL DE SALIDA ─────────────────

  useEffect(() => {
    if (sessionState === 'SALIDA') {
      setExitDetectedTime(getCurrentTimeHHMM());
      setShowExitDetectionModal(true);
    } else {
      setShowExitDetectionModal(false);
    }
  }, [sessionState]);

  // ── MANEJADORES DE ACCIONES Y NAVEGACIÓN ──────────────────

  const scrollToMonitoring = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(systemHealthY.current - 24, 0),
      animated: true,
    });
  }, []);

  const requestCancelSession = useCallback(() => {
    Alert.alert(
      'Cancelar Jornada',
      '¿Estás seguro de que deseas cancelar la jornada actual? Esta acción detendrá el monitoreo y no se registrarán horas.',
      [
        { text: 'No, mantener', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              setLoadingText('Cancelando jornada...');
              await cancelSession();
            } catch (error) {
              console.error('[Cancel Session Error]', error);
              Alert.alert('No se pudo cancelar', 'Intenta nuevamente en unos segundos.');
            } finally {
              setLoading(false);
              setLoadingText(undefined);
            }
          },
        },
      ]
    );
  }, [cancelSession]);

  const handleManualArrival = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingText('Confirmando llegada...');
      await confirmArrival();
    } catch (error) {
      console.error('[Manual Arrival Error]', error);
      Alert.alert('Error al confirmar llegada', 'Verifica tu conexión a internet o permisos de ubicación.');
    } finally {
      setLoading(false);
      setLoadingText(undefined);
    }
  }, [confirmArrival]);

  // ── MAPPING DE ACCIONES PRINCIPALES Y SECUNDARIAS ─────────

  const handlePrimaryAction = useCallback(() => {
    switch (sessionState) {
      case 'NO_INICIADA':
        setShowDailySetupModal(true);
        break;
      case 'ESPERANDO':
      case 'TRASLADO':
        scrollToMonitoring();
        break;
      case 'ACTIVA':
      case 'PAUSADA':
        setShowLunchModal(true); // Solicitar descuento de almuerzo antes de cerrar
        break;
      case 'SALIDA':
        setExitDetectedTime(getCurrentTimeHHMM());
        setShowExitDetectionModal(true);
        break;
      default:
        break;
    }
  }, [sessionState, scrollToMonitoring]);

  const handleSecondaryAction = useCallback(() => {
    switch (sessionState) {
      case 'ESPERANDO':
      case 'TRASLADO':
        requestCancelSession();
        break;
      case 'SALIDA':
        stayWorking();
        setShowExitDetectionModal(false);
        break;
      default:
        break;
    }
  }, [sessionState, requestCancelSession, stayWorking]);

  // ── MANEJADORES DE MODALES ────────────────────────────────

  const handleConfirmDailySetup = useCallback(
    async (payload: { destination: string; alias?: string }) => {
      try {
        setLoading(true);
        setLoadingText('Iniciando jornada...');
        await startSession(payload.destination, payload.alias);
        setShowDailySetupModal(false);
      } catch (error) {
        console.error('[Daily Setup Error]', error);
        Alert.alert(
          'Fallo al iniciar jornada',
          'Asegúrate de conceder permisos de ubicación (Siempre) para habilitar el monitoreo.'
        );
      } finally {
        setLoading(false);
        setLoadingText(undefined);
      }
    },
    [startSession]
  );

  const handleConfirmLunch = useCallback(
    async (payload: LunchModalPayload) => {
      try {
        setLoading(true);
        setLoadingText('Cerrando jornada...');
        await closeSession(payload.minutes);
        setShowLunchModal(false);
      } catch (error) {
        console.error('[Lunch Close Error]', error);
        Alert.alert('No se pudo cerrar la jornada', 'Intenta nuevamente en unos segundos.');
      } finally {
        setLoading(false);
        setLoadingText(undefined);
      }
    },
    [closeSession]
  );

  const handleConfirmExit = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingText('Confirmando salida y cerrando...');
      await confirmExit();
      setShowExitDetectionModal(false);
    } catch (error) {
      console.error('[Confirm Exit Error]', error);
      Alert.alert('No se pudo confirmar la salida', 'Intenta nuevamente en unos segundos.');
    } finally {
      setLoading(false);
      setLoadingText(undefined);
    }
  }, [confirmExit]);

  const handleStayWorking = useCallback(() => {
    stayWorking();
    setShowExitDetectionModal(false);
  }, [stayWorking]);

  // ── ESTADOS VISUALES ──────────────────────────────────────

  const orbConfig = useMemo(() => {
    switch (sessionState as SessionState) {
      case 'ACTIVA':
        return { icon: 'briefcase', style: styles.statusOrbActive, color: PALETTE.mutedGold };
      case 'ESPERANDO':
      case 'TRASLADO':
        return { icon: 'map-pin', style: null, color: TEXT.primary };
      case 'PAUSADA':
        return { icon: 'coffee', style: styles.statusOrbWarning, color: PALETTE.amberWarning };
      case 'SALIDA':
        return { icon: 'alert-triangle', style: styles.statusOrbWarning, color: PALETTE.deepRed };
      case 'CERRADA':
        return { icon: 'check-circle', style: null, color: PALETTE.successGreen };
      default:
        return { icon: 'moon', style: null, color: TEXT.muted };
    }
  }, [sessionState]);

  const hoursToday: number = activeSession?.totalHours ?? 0;
  const earningsToday: number = activeSession?.totalEarnings ?? 0;
  const overtime: number = activeSession?.overtimeHours ?? 0;
  
  // Mapeo seguro de eventos (si no existe timelineEvents en el modelo V2 relacional, se asume arreglo vacío)
  const timelineEvents: TimelineEvent[] = (activeSession as any)?.timelineEvents ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>W Tracker</Text>
            <Text style={styles.headerSubtitle}>CONTROL DIARIO OPERATIVO</Text>
          </View>

          {/* Status Orb Indicator */}
          <View style={[styles.statusOrb, orbConfig.style]}>
            <Icon name={orbConfig.icon as any} size={20} color={orbConfig.color} strokeWidth={2.5} />
          </View>
        </View>

        {/* CONTENEDOR HERO DE MÁQUINA DE ESTADOS */}
        <OperationalHeroCard
          state={sessionState}
          session={activeSession}
          elapsedTime={elapsedTime}
          loading={loading}
          loadingText={loadingText}
          onPrimaryAction={handlePrimaryAction}
          onSecondaryAction={handleSecondaryAction}
        />

        {/* FALLBACK MANUAL: ESPERANDO LLEGADA (Ideal para Expo Go / Mocking) */}
        {sessionState === 'ESPERANDO' && (
          <View style={styles.manualArrivalBlock}>
            <Button
              label="Confirmar Llegada Manual"
              variant="secondary"
              size="md"
              onPress={handleManualArrival}
              loading={loading}
              loadingText="Confirmando..."
              iconName="map-pin"
              fullWidth
            />
            <Text style={styles.manualArrivalHint}>
              Útil si el GPS tarda en calibrarse o el evento ENTER de la geocerca no se emite a tiempo.
            </Text>
          </View>
        )}

        {/* MÉTRICAS FINANCIERAS Y DE TIEMPO DEL DÍA */}
        <SummaryBlock
          metrics={[
            {
              title: 'HORAS',
              subtitle: 'hoy',
              value: formatHours(hoursToday),
            },
            {
              title: 'INGRESO',
              subtitle: 'estimado',
              value: formatCurrency(earningsToday),
              accentValue: true,
            },
            {
              title: 'OVERTIME',
              value: formatHours(overtime),
              conditional: true,
            },
          ]}
        />

        {/* DIAGNÓSTICO DEL SISTEMA Y GEOFENCE */}
        <View
          onLayout={(event) => {
            systemHealthY.current = event.nativeEvent.layout.y;
          }}
        >
          <SystemHealthBlock health={systemHealth} />
        </View>

        {/* BITÁCORA Y EVENTOS EN TIEMPO REAL */}
        <SessionTimeline events={timelineEvents} title="Bitácora de Actividad" />
      </ScrollView>

      {/* ── MODALES OPERACIONALES ── */}
      <DailySetupModal
        visible={showDailySetupModal}
        loading={loading}
        onCancel={() => setShowDailySetupModal(false)}
        onConfirm={handleConfirmDailySetup}
      />

      <LunchModal
        visible={showLunchModal}
        loading={loading}
        onCancel={() => setShowLunchModal(false)}
        onConfirm={handleConfirmLunch}
      />

      <ExitDetectionModal
        visible={showExitDetectionModal}
        loading={loading}
        exitTime={exitDetectedTime}
        onConfirmExit={handleConfirmExit}
        onStayWorking={handleStayWorking}
      />
    </SafeAreaView>
  );
};

// ── ESTILOS ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl * 2,
    paddingTop: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    minHeight: 60,
  },
  headerTitle: {
    color: TEXT.primary,
    fontSize: FONT.h2.size,
    fontWeight: '700',
    fontFamily: 'Montserrat',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: TEXT.secondary,
    fontSize: FONT.label.size - 1,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Montserrat',
    marginTop: 2,
  },
  statusOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PALETTE.carbonMist,
    borderWidth: 1,
    borderColor: PALETTE.steelLine,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusOrbActive: {
    borderColor: PALETTE.mutedGold,
    shadowColor: PALETTE.mutedGold,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  statusOrbWarning: {
    borderColor: PALETTE.deepRed,
    shadowColor: PALETTE.deepRed,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  manualArrivalBlock: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  manualArrivalHint: {
    color: TEXT.muted,
    fontSize: FONT.caption.size,
    fontFamily: 'Montserrat',
    textAlign: 'center',
    lineHeight: FONT.caption.lineHeight,
  },
});
