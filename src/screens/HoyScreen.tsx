import type { NavigationProp } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Header,
  MetricTile,
  HeroCard,
  Timeline,
  DailySetupModal,
  LunchModal,
  DestinationModal,
  ExitDetectionModal,
} from "@/components";
import { useSessionStore } from "@/stores/sessionStore";
import { PALETTE, SPACING } from "@/theme/tokens";
import type { UIActionKey } from "@/types/ui";
import { formatCurrency, formatHours, isToday } from "@/utils/formatters";
import { getUIState, buildDailyTimeline } from "@/utils/uiMapper";

export const HoyScreen: React.FC = () => {
  // CORRECCIÓN: Eliminamos el <any> usando Record<string, unknown>
  const navigation = useNavigation<NavigationProp<Record<string, unknown>>>();

  const {
    sessionState,
    activeSession,
    todaySessions,
    elapsedTime,
    systemHealth,
    startSession,
    confirmArrival,
    startLunch,
    endLunch,
    startTransfer,
    cancelTransfer,
    finishWorkDay,
    confirmExit,
    stayWorking,
    cancelSession,
  } = useSessionStore();

  const ui = getUIState(sessionState);

  const sessionsToMap =
    todaySessions.length > 0
      ? todaySessions
      : activeSession
        ? [activeSession]
        : [];
  const timelineEvents = buildDailyTimeline(sessionsToMap);

  const [showDailySetup, setShowDailySetup] = useState(false);
  const [showLunchModal, setShowLunchModal] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);

  const handleUIAction = (actionKey: UIActionKey) => {
    switch (actionKey) {
      case "START_SESSION":
        setShowDailySetup(true);
        break;
      case "CONFIRM_ARRIVAL":
        void confirmArrival();
        break;
      case "CANCEL_SESSION":
        void cancelSession();
        break;
      case "START_TRANSFER":
        setShowDestinationModal(true);
        break;
      case "CANCEL_TRANSFER":
        void cancelTransfer();
        break;
      case "FINISH_SESSION":
        Alert.alert(
          "Finalizar Jornada",
          "¿Estás seguro que deseas cerrar la sesión actual y generar la auditoría?",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Finalizar",
              style: "destructive",
              onPress: () => finishWorkDay(0),
            },
          ],
        );
        break;
      case "START_LUNCH":
        void startLunch();
        break;
      case "FINISH_LUNCH":
        void endLunch();
        break;
      case "CONFIRM_EXIT":
        void confirmExit();
        break;
      case "STAY_WORKING":
        stayWorking();
        break;
      case "REVIEW_JOURNEY":
        if (activeSession) {
          navigation.navigate("Reportes", { sessionId: activeSession.id });
        }
        break;
      case "REVIEW_HISTORY":
        navigation.navigate("Historial");
        break;
      default:
        console.warn("Acción UI no manejada:", actionKey);
        break;
    }
  };

  const handleStartSession = async (destination: string, alias?: string) => {
    await startSession(destination, alias);
    setShowDailySetup(false);
  };

  const handleFinishWorkDay = async (minutes: number) => {
    await finishWorkDay(minutes);
    setShowLunchModal(false);
  };

  // CORRECCIÓN: horas / ingreso en vivo.
  // Antes: leía activeSession.totalHours, que en DB es 0 hasta cerrar.
  // Ahora: si el estado es ACTIVA / PAUSADA / TRASLADO / SALIDA, deriva
  // de elapsedTime (que ya hace tick cada segundo) menos lunch.
  // ESPERANDO / NO_INICIADA / CERRADA usan el valor guardado.
  let hours = activeSession?.totalHours ?? 0;
  let earnings = activeSession?.totalEarnings ?? 0;

  if (
    activeSession &&
    (activeSession.state === "ACTIVA" ||
      activeSession.state === "PAUSADA" ||
      activeSession.state === "TRASLADO" ||
      activeSession.state === "SALIDA")
  ) {
    const parts = elapsedTime.split(":").map((p) => Number(p) || 0);
    const totalSeconds =
      (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
    let elapsedMinutes = totalSeconds / 60;

    // Fallback si elapsedTime aún es 00:00:00 pero ya hay startTime
    if (elapsedMinutes <= 0 && activeSession.startTime) {
      const startMs = Date.parse(activeSession.startTime);
      if (!Number.isNaN(startMs)) {
        elapsedMinutes = Math.max(0, (Date.now() - startMs) / 60000);
      }
    }

    const netMinutes = Math.max(
      0,
      Math.round(elapsedMinutes) - (activeSession.lunchDeductedMinutes || 0),
    );
    const liveHours = Number((netMinutes / 60).toFixed(2));
    const liveOvertime = Number(Math.max(0, liveHours - 8).toFixed(2));
    const rate = activeSession.snapshotRate || 0;
    const liveEarnings = Number(
      (
        (liveHours - liveOvertime) * rate +
        liveOvertime * rate * 1.5
      ).toFixed(2),
    );
    hours = liveHours;
    earnings = liveEarnings;
  }

  const destination =
    activeSession?.alias || activeSession?.destination || null;

  const displayDate =
    activeSession && !isToday(activeSession.date)
      ? `Turno del ${activeSession.date}`
      : new Date().toLocaleDateString("es-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });

  // CORRECCIÓN: Casteo estricto a los tipos que soporta tu componente Header
  const headerHealthStatus = (
    systemHealth.geofenceActive === "OK"
      ? "OK"
      : systemHealth.locationPermission
  ) as "OK" | "WARNING" | "ERROR";

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="HOY"
        subtitle={displayDate.toUpperCase()}
        healthStatus={headerHealthStatus}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <HeroCard
          ui={ui}
          elapsedTime={elapsedTime}
          destination={destination}
          onAction={handleUIAction}
        />

        {ui.visibility.showHours || ui.visibility.showEarnings ? (
          <View style={styles.metricsContainer}>
            {ui.visibility.showHours ? (
              <MetricTile
                label="Horas Trabajadas"
                value={formatHours(hours)}
                icon="clock"
              />
            ) : null}
            {ui.visibility.showEarnings ? (
              <MetricTile
                label="Ingreso Estimado"
                value={formatCurrency(earnings)}
                icon="dollar-sign"
                highlight={earnings > 0}
              />
            ) : null}
          </View>
        ) : null}

        <Timeline events={timelineEvents} />
      </ScrollView>

      <DailySetupModal
        visible={showDailySetup}
        onClose={() => setShowDailySetup(false)}
        onSubmit={handleStartSession}
      />
      <LunchModal
        visible={showLunchModal}
        defaultMinutes={activeSession?.lunchDeductedMinutes ?? 30}
        onClose={() => setShowLunchModal(false)}
        onSubmit={handleFinishWorkDay}
      />
      <DestinationModal
        visible={showDestinationModal}
        onClose={() => setShowDestinationModal(false)}
        onSubmit={async (dest, alias) => {
          await startTransfer(dest, alias);
          setShowDestinationModal(false);
        }}
      />
      <ExitDetectionModal
        visible={sessionState === "SALIDA"}
        onConfirmExit={() => void confirmExit()}
        onStayWorking={stayWorking}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
    paddingTop: Platform.OS === "android" ? 24 : 0,
  },
  scrollContent: { paddingBottom: SPACING.xxxl },
  metricsContainer: {
    flexDirection: "row",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
});
