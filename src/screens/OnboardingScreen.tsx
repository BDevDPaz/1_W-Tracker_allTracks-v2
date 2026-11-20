import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
} from "react-native";

import { Surface, Button, Input, Icon } from "@/components";
import { geofenceService, settingsService, ToastService } from "@/services";
import { useSessionStore } from "@/stores/sessionStore";
import { PALETTE, FONT, SPACING, TEXT } from "@/theme";

export const OnboardingScreen: React.FC = () => {
  const { completeOnboarding } = useSessionStore();

  const [name, setName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("20");
  const [reportEmail, setReportEmail] = useState("");

  const [permStatus, setPermStatus] = useState<
    "GRANTED" | "DENIED" | "NOT_DETERMINED" | "ERROR"
  >("NOT_DETERMINED");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    geofenceService.getPermissionStatus().then(setPermStatus);
  }, []);

  const handleRequestPermissions = async () => {
    try {
      const granted = await geofenceService.requestPermissions();
      setPermStatus(granted ? "GRANTED" : "DENIED");
      if (!granted) {
        ToastService.push({
          type: "warning",
          text: 'W-Tracker necesita ubicación "Siempre" para detectar salidas automáticamente.',
        });
      } else {
        ToastService.push({
          type: "success",
          text: "Permisos otorgados correctamente.",
        });
      }
    } catch (_error) {
      ToastService.push({
        type: "error",
        text: "Hubo un error al solicitar permisos.",
      });
    }
  };

  const handleComplete = async () => {
    if (!name.trim()) {
      ToastService.push({
        type: "error",
        text: "Por favor, ingresa tu nombre.",
      });
      return;
    }

    const parsedRate = parseFloat(hourlyRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      ToastService.push({
        type: "error",
        text: "Ingresa una tarifa por hora válida.",
      });
      return;
    }

    setLoading(true);
    try {
      const currentSettings = await settingsService.load();
      await settingsService.save({
        ...currentSettings,
        name: name.trim(),
        hourlyRate: parsedRate,
        reportEmail: reportEmail.trim().toLowerCase(),
        hasCompletedOnboarding: true,
      });
      await completeOnboarding();
    } catch (error) {
      const errMsg =
        error instanceof Error
          ? error.message
          : "Error al guardar la configuración.";
      ToastService.push({ type: "error", text: errMsg });
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Icon name="shield-check" size={40} color={PALETTE.obsidian} />
          </View>
          <Text style={styles.title}>W-TRACKER</Text>
          <Text style={styles.subtitle}>Auditoría de Jornada V2.0</Text>
        </View>

        <Surface variant="elevated" style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="map-pin" size={20} color={PALETTE.mutedGold} />
            <Text style={styles.cardTitle}>Permisos Críticos</Text>
          </View>
          <Text style={styles.description}>
            Para auditar automáticamente tus horas y registrar tu línea de
            tiempo forense, requerimos acceso a tu ubicación en todo momento
            (Background).
          </Text>

          {permStatus === "GRANTED" ? (
            <View style={styles.grantedBox}>
              <Icon name="check" size={16} color={PALETTE.successGreen} />
              <Text style={styles.grantedText}>
                Permisos de ubicación habilitados
              </Text>
            </View>
          ) : (
            <Button
              title="Otorgar Permisos"
              variant="secondary"
              onPress={handleRequestPermissions}
              style={{ marginTop: SPACING.sm }}
            />
          )}
        </Surface>

        <Surface variant="base" style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="dollar-sign" size={20} color={PALETTE.mutedGold} />
            <Text style={styles.cardTitle}>Perfil Financiero</Text>
          </View>
          <Input
            label="Tu Nombre"
            placeholder="Nombre completo"
            value={name}
            onChangeText={setName}
          />
          <Input
            label="Tarifa Base ($/hora)"
            placeholder="20"
            keyboardType="numeric"
            value={hourlyRate}
            onChangeText={setHourlyRate}
          />
          <Input
            label="Correo de Auditoría (Opcional)"
            placeholder="ejemplo@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={reportEmail}
            onChangeText={setReportEmail}
            containerStyle={{ marginBottom: 0 }}
          />
        </Surface>

        <Button
          title="Empezar a Trabajar"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleComplete}
          style={styles.submitButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
    paddingTop: Platform.OS === "android" ? 40 : 20,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    alignItems: "center",
    marginBottom: SPACING.xxl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PALETTE.mutedGold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: TEXT.primary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: FONT.body.size,
    color: PALETTE.mutedGold,
    fontWeight: "600",
    marginTop: 4,
  },
  card: {
    marginBottom: SPACING.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: FONT.h3.size,
    fontWeight: "700",
    color: TEXT.primary,
  },
  description: {
    fontSize: FONT.body.size,
    color: TEXT.secondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  grantedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.successGreen,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  grantedText: {
    color: PALETTE.successGreen,
    fontWeight: "600",
    fontSize: FONT.captionStrong.size,
  },
  submitButton: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xxxl,
  },
});
