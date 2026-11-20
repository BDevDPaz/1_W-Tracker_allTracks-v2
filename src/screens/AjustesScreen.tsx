import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
  ScrollView,
  Switch,
  ActivityIndicator,
} from "react-native";

import { Header, Surface, Input, Button, Icon } from "@/components";
import type { IconName } from "@/components/atoms/Icon";
import { settingsService, ToastService } from "@/services";
import { PALETTE, FONT, SPACING, TEXT } from "@/theme";
import type { UserSettings } from "@/types/contracts";

type SettingsForm = {
  name: string;
  hourlyRate: string;
  reportEmail: string;
  baseWorkHour: string;
  overtimeMultiplier: string;
  lunchDiscountMinutes: string;
  geofenceRadius: string;
  destinationLimit: string;
  multiDestination: boolean;
  paidTransfers: boolean;
};

const SectionTitle: React.FC<{ title: string; icon: IconName }> = ({
  title,
  icon,
}) => (
  <View style={styles.sectionHeader}>
    <Icon name={icon} size={18} color={PALETTE.mutedGold} />
    <Text style={styles.sectionTitleText}>{title}</Text>
  </View>
);

export const AjustesScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SettingsForm>({
    name: "",
    hourlyRate: "20",
    reportEmail: "",
    baseWorkHour: "08:00",
    overtimeMultiplier: "1.5",
    lunchDiscountMinutes: "30",
    geofenceRadius: "100",
    destinationLimit: "5",
    multiDestination: false,
    paidTransfers: true,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentSettings = await settingsService.load();
        setForm({
          name: currentSettings.name,
          hourlyRate: String(currentSettings.hourlyRate),
          reportEmail: currentSettings.reportEmail,
          baseWorkHour: currentSettings.baseWorkHour,
          overtimeMultiplier: String(currentSettings.overtimeMultiplier),
          lunchDiscountMinutes: String(currentSettings.lunchDiscountMinutes),
          geofenceRadius: String(currentSettings.geofenceRadius),
          destinationLimit: String(currentSettings.destinationLimit),
          multiDestination: currentSettings.multiDestination,
          paidTransfers: currentSettings.paidTransfers,
        });
      } catch (_error) {
        ToastService.push({
          type: "error",
          text: "Error al cargar la configuración.",
        });
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, []);

  const updateForm = (field: keyof SettingsForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentSettings = await settingsService.load();
      const updatedSettings: UserSettings = {
        ...currentSettings,
        name: form.name,
        hourlyRate: parseFloat(form.hourlyRate),
        reportEmail: form.reportEmail,
        baseWorkHour: form.baseWorkHour,
        overtimeMultiplier: parseFloat(form.overtimeMultiplier),
        lunchDiscountMinutes: parseInt(form.lunchDiscountMinutes, 10),
        geofenceRadius: parseInt(form.geofenceRadius, 10),
        destinationLimit: parseInt(form.destinationLimit, 10),
        multiDestination: form.multiDestination,
        paidTransfers: form.paidTransfers,
      };

      await settingsService.save(updatedSettings);
      ToastService.push({
        type: "success",
        text: "Configuración guardada correctamente.",
      });
    } catch (error) {
      const errMsg =
        error instanceof Error
          ? error.message
          : "Error al guardar los ajustes.";
      ToastService.push({ type: "error", text: errMsg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <ActivityIndicator size="large" color={PALETTE.mutedGold} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="AJUSTES" subtitle="CONFIGURACIÓN DEL SISTEMA" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        automaticallyAdjustKeyboardInsets
      >
        <Surface variant="base" style={styles.card}>
          <SectionTitle title="Perfil y Contacto" icon="navigation" />
          <Input
            label="Nombre Completo"
            placeholder="Ej: John Doe"
            value={form.name}
            onChangeText={(v) => updateForm("name", v)}
          />
          <Input
            label="Correo para Reportes"
            placeholder="ejemplo@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.reportEmail}
            onChangeText={(v) => updateForm("reportEmail", v)}
            containerStyle={{ marginBottom: 0 }}
          />
        </Surface>

        <Surface variant="base" style={styles.card}>
          <SectionTitle title="Nómina y Financiero" icon="dollar-sign" />
          <View style={styles.row}>
            <Input
              label="Tarifa Base ($/h)"
              keyboardType="numeric"
              value={form.hourlyRate}
              onChangeText={(v) => updateForm("hourlyRate", v)}
              containerStyle={styles.halfInput}
            />
            <Input
              label="Multiplicador Extra"
              placeholder="1.5"
              keyboardType="numeric"
              value={form.overtimeMultiplier}
              onChangeText={(v) => updateForm("overtimeMultiplier", v)}
              containerStyle={styles.halfInput}
            />
          </View>
          <View style={styles.row}>
            <Input
              label="Horas Base (HH:MM)"
              placeholder="08:00"
              value={form.baseWorkHour}
              onChangeText={(v) => updateForm("baseWorkHour", v)}
              containerStyle={styles.halfInput}
            />
            <Input
              label="Almuerzo Default (Min)"
              keyboardType="number-pad"
              value={form.lunchDiscountMinutes}
              onChangeText={(v) => updateForm("lunchDiscountMinutes", v)}
              containerStyle={styles.halfInput}
            />
          </View>
        </Surface>

        <Surface variant="base" style={styles.card}>
          <SectionTitle title="Operaciones y Geocerca" icon="map-pin" />
          <View style={styles.row}>
            <Input
              label="Radio GPS (Metros)"
              keyboardType="number-pad"
              value={form.geofenceRadius}
              onChangeText={(v) => updateForm("geofenceRadius", v)}
              containerStyle={styles.halfInput}
            />
            <Input
              label="Límite Destinos/Día"
              keyboardType="number-pad"
              value={form.destinationLimit}
              onChangeText={(v) => updateForm("destinationLimit", v)}
              containerStyle={styles.halfInput}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextContainer}>
              <Text style={styles.switchTitle}>Modo Multi-Destino</Text>
              <Text style={styles.switchSubtitle}>
                Permite registrar múltiples sitios en un día.
              </Text>
            </View>
            <Switch
              trackColor={{
                false: PALETTE.steelLine,
                true: PALETTE.mutedGoldDark,
              }}
              thumbColor={
                form.multiDestination ? PALETTE.mutedGold : TEXT.muted
              }
              onValueChange={(v) => updateForm("multiDestination", v)}
              value={form.multiDestination}
            />
          </View>

          <View
            style={[
              styles.switchRow,
              { borderBottomWidth: 0, paddingBottom: 0 },
            ]}
          >
            <View style={styles.switchTextContainer}>
              <Text style={styles.switchTitle}>Traslados Pagados</Text>
              <Text style={styles.switchSubtitle}>
                Incluir el tiempo de traslado en la nómina final.
              </Text>
            </View>
            <Switch
              trackColor={{
                false: PALETTE.steelLine,
                true: PALETTE.mutedGoldDark,
              }}
              thumbColor={form.paidTransfers ? PALETTE.mutedGold : TEXT.muted}
              onValueChange={(v) => updateForm("paidTransfers", v)}
              value={form.paidTransfers}
              disabled={!form.multiDestination}
            />
          </View>
        </Surface>

        <Button
          title="Guardar Configuración"
          variant="primary"
          size="lg"
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
    paddingTop: Platform.OS === "android" ? 24 : 0,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  card: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.steelLine,
    paddingBottom: SPACING.sm,
  },
  sectionTitleText: {
    fontSize: FONT.h3.size,
    fontWeight: "700",
    color: TEXT.primary,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  halfInput: {
    flex: 1,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.steelLine,
  },
  switchTextContainer: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  switchTitle: {
    fontSize: FONT.bodyStrong.size,
    fontWeight: "600",
    color: TEXT.primary,
  },
  switchSubtitle: {
    fontSize: 11,
    color: TEXT.muted,
    marginTop: 2,
  },
  saveButton: {
    marginTop: SPACING.sm,
  },
});
