import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header, Surface, Input, Button, Icon } from "@/components";
import type { IconName } from "@/components/atoms/Icon";
import { settingsService, ToastService } from "@/services";
import { PALETTE, FONT, SPACING, TEXT } from "@/theme";
import type { UserSettings, SettingsTab } from "@/types/contracts";

type WorkerForm = {
  phone: string;
  emergencyContact: string;
  emergencyPhone: string;
  preferredStartTime: string;
  lunchPreferenceMinutes: string;
  entryReminderEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  timeFormat: "12h" | "24h";
  language: "es" | "en";
  dailyReminder: boolean;
  workdayAlerts: boolean;
  reportReady: boolean;
};

type AdminForm = {
  name: string;
  reportEmail: string;
  address: string;
  employeeId: string;
  company: string;
  position: string;
  startDate: string;
  hourlyRate: string;
  overtimeMultiplier: string;
  baseWorkHour: string;
  overtimeThresholdHours: string;
  lunchDiscountMinutes: string;
  standardLunchMinutes: string;
  paidTransfers: boolean;
  payTransferTime: boolean;
  multiDestination: boolean;
  allowMultiDestination: boolean;
  geofenceRadius: string;
  destinationLimit: string;
  principalAddress: string;
  gracePeriodMinutes: string;
  entryToleranceMinutes: string;
  payDay: string;
  paymentMethod: string;
  currency: string;
};

const DEFAULT_WORKER_FORM: WorkerForm = {
  phone: "",
  emergencyContact: "",
  emergencyPhone: "",
  preferredStartTime: "06:00",
  lunchPreferenceMinutes: "30",
  entryReminderEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  timeFormat: "12h",
  language: "es",
  dailyReminder: true,
  workdayAlerts: true,
  reportReady: true,
};

const DEFAULT_ADMIN_FORM: AdminForm = {
  name: "",
  reportEmail: "",
  address: "",
  employeeId: "",
  company: "",
  position: "",
  startDate: "",
  hourlyRate: "20",
  overtimeMultiplier: "1.5",
  baseWorkHour: "06:00",
  overtimeThresholdHours: "8",
  lunchDiscountMinutes: "30",
  standardLunchMinutes: "30",
  paidTransfers: true,
  payTransferTime: true,
  multiDestination: false,
  allowMultiDestination: false,
  geofenceRadius: "100",
  destinationLimit: "5",
  principalAddress: "",
  gracePeriodMinutes: "0",
  entryToleranceMinutes: "0",
  payDay: "",
  paymentMethod: "",
  currency: "USD",
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

const SwitchRow: React.FC<{
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}> = ({ title, subtitle, value, onChange, disabled, last }) => (
  <View style={[styles.switchRow, last ? styles.switchRowLast : null]}>
    <View style={styles.switchTextContainer}>
      <Text style={styles.switchTitle}>{title}</Text>
      <Text style={styles.switchSubtitle}>{subtitle}</Text>
    </View>
    <Switch
      trackColor={{
        false: PALETTE.steelLine,
        true: PALETTE.mutedGoldDark,
      }}
      thumbColor={value ? PALETTE.mutedGold : TEXT.muted}
      onValueChange={onChange}
      value={value}
      disabled={disabled}
    />
  </View>
);

const MaskedRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <View style={styles.maskedRow}>
    <Text style={styles.maskedLabel}>{label}</Text>
    <Text style={styles.maskedValue}>{value}</Text>
  </View>
);

// Normaliza Fecha Inicio a YYYY-MM-DD.
// Acepta: "" (vacío, campo opcional), "20190308", "2019/03/08", "2019-03-08".
// Retorna null si el formato es inválido o la fecha no existe (ej: 20191340, 20190230).
function normalizeStartDate(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return "";
  let candidate = v;
  if (/^\d{8}$/.test(v)) {
    candidate = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(v)) {
    candidate = v.replace(/\//g, "-");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return null;
  }
  const [yStr, mStr, dStr] = candidate.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return candidate;
}

function workerFormFromSettings(s: UserSettings): WorkerForm {
  return {
    phone: s.phone ?? "",
    emergencyContact: s.emergencyContact ?? "",
    emergencyPhone: s.emergencyPhone ?? "",
    preferredStartTime: s.preferredStartTime ?? "06:00",
    lunchPreferenceMinutes: String(s.lunchPreferenceMinutes ?? 30),
    entryReminderEnabled: s.entryReminderEnabled ?? true,
    soundEnabled: s.soundEnabled ?? true,
    vibrationEnabled: s.vibrationEnabled ?? true,
    timeFormat: s.timeFormat ?? "12h",
    language: s.language,
    dailyReminder: s.dailyReminder,
    workdayAlerts: s.workdayAlerts,
    reportReady: s.reportReady,
  };
}

function adminFormFromSettings(s: UserSettings): AdminForm {
  const rawStartDate = s.startDate ?? "";
  const normalizedStartDate = normalizeStartDate(rawStartDate);
  return {
    name: s.name,
    reportEmail: s.reportEmail,
    address: s.address ?? "",
    employeeId: s.employeeId ?? "",
    company: s.company ?? "",
    position: s.position ?? "",
    startDate: normalizedStartDate ?? rawStartDate,
    hourlyRate: String(s.hourlyRate),
    overtimeMultiplier: String(s.overtimeMultiplier),
    baseWorkHour: s.baseWorkHour,
    overtimeThresholdHours: String(s.overtimeThresholdHours ?? 8),
    lunchDiscountMinutes: String(s.lunchDiscountMinutes),
    standardLunchMinutes: String(s.standardLunchMinutes ?? 30),
    paidTransfers: s.paidTransfers,
    payTransferTime: s.payTransferTime ?? true,
    multiDestination: s.multiDestination,
    allowMultiDestination: s.allowMultiDestination ?? false,
    geofenceRadius: String(s.geofenceRadius),
    destinationLimit: String(s.destinationLimit),
    principalAddress: s.principalAddress ?? "",
    gracePeriodMinutes: String(s.gracePeriodMinutes ?? 0),
    entryToleranceMinutes: String(s.entryToleranceMinutes ?? 0),
    payDay: s.payDay ?? "",
    paymentMethod: s.paymentMethod ?? "",
    currency: s.currency ?? "USD",
  };
}

export const AjustesScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>("worker");

  const [workerForm, setWorkerForm] = useState<WorkerForm>(DEFAULT_WORKER_FORM);
  const [workerOriginal, setWorkerOriginal] =
    useState<WorkerForm>(DEFAULT_WORKER_FORM);
  const [adminForm, setAdminForm] = useState<AdminForm>(DEFAULT_ADMIN_FORM);
  const [adminOriginal, setAdminOriginal] =
    useState<AdminForm>(DEFAULT_ADMIN_FORM);

  const [savingWorker, setSavingWorker] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // PIN Admin
  const [hasPin, setHasPin] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [settingPin, setSettingPin] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [changingPin, setChangingPin] = useState(false);
  const [lastAdminChangeAt, setLastAdminChangeAt] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentSettings = await settingsService.load();
        const w = workerFormFromSettings(currentSettings);
        const a = adminFormFromSettings(currentSettings);
        setWorkerForm(w);
        setWorkerOriginal(w);
        setAdminForm(a);
        setAdminOriginal(a);
        setLastAdminChangeAt(currentSettings.lastAdminChangeAt ?? null);
        if (settingsService.hasAdminPin) {
          const has = await settingsService.hasAdminPin();
          setHasPin(has);
        } else {
          setHasPin(Boolean(currentSettings.adminPinHash));
        }
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

  const isWorkerDirty = useMemo(
    () => JSON.stringify(workerForm) !== JSON.stringify(workerOriginal),
    [workerForm, workerOriginal],
  );

  const isAdminDirty = useMemo(
    () => JSON.stringify(adminForm) !== JSON.stringify(adminOriginal),
    [adminForm, adminOriginal],
  );

  const updateWorker = (field: keyof WorkerForm, value: string | boolean) => {
    setWorkerForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateAdmin = (field: keyof AdminForm, value: string | boolean) => {
    setAdminForm((prev) => ({ ...prev, [field]: value }));
  };

  // Al teclear 8 dígitos seguidos (20190308), normaliza en vivo a 2019-03-08.
  const handleStartDateChange = (v: string) => {
    if (/^\d{8}$/.test(v.trim())) {
      const n = normalizeStartDate(v);
      if (n !== null) {
        updateAdmin("startDate", n);
        return;
      }
    }
    updateAdmin("startDate", v);
  };

  const handleSaveWorker = async () => {
    setSavingWorker(true);
    try {
      if (!settingsService.saveWorkerSettings) {
        throw new Error("saveWorkerSettings no disponible.");
      }
      await settingsService.saveWorkerSettings({
        phone: workerForm.phone,
        emergencyContact: workerForm.emergencyContact,
        emergencyPhone: workerForm.emergencyPhone,
        preferredStartTime: workerForm.preferredStartTime,
        lunchPreferenceMinutes: parseInt(workerForm.lunchPreferenceMinutes, 10),
        entryReminderEnabled: workerForm.entryReminderEnabled,
        soundEnabled: workerForm.soundEnabled,
        vibrationEnabled: workerForm.vibrationEnabled,
        timeFormat: workerForm.timeFormat,
        language: workerForm.language,
        dailyReminder: workerForm.dailyReminder,
        workdayAlerts: workerForm.workdayAlerts,
        reportReady: workerForm.reportReady,
      });
      setWorkerOriginal(workerForm);
      ToastService.push({
        type: "success",
        text: "Ajustes de trabajador guardados.",
      });
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Error al guardar.";
      ToastService.push({ type: "error", text: errMsg });
    } finally {
      setSavingWorker(false);
    }
  };

  const handleSaveAdmin = async () => {
    // Validar + normalizar startDate ANTES del Alert de confirmación.
    // Si es inválido, no se abre el Alert y no se guarda nada.
    const normalizedStartDate = normalizeStartDate(adminForm.startDate);
    if (normalizedStartDate === null) {
      ToastService.push({
        type: "error",
        text: "Fecha Inicio debe ser YYYY-MM-DD, ej: 2019-03-08.",
      });
      return;
    }
    const adminToSave: AdminForm =
      normalizedStartDate !== adminForm.startDate
        ? { ...adminForm, startDate: normalizedStartDate }
        : adminForm;
    if (adminToSave !== adminForm) {
      setAdminForm(adminToSave);
    }

    Alert.alert(
      "Guardar cambios de Administrador",
      "Estos cambios afectan nómina, geocerca y control. ¿Confirmas guardar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Guardar",
          onPress: async () => {
            setSavingAdmin(true);
            try {
              if (!settingsService.saveAdminSettings) {
                throw new Error("saveAdminSettings no disponible.");
              }
              await settingsService.saveAdminSettings({
                name: adminToSave.name,
                reportEmail: adminToSave.reportEmail,
                address: adminToSave.address,
                employeeId: adminToSave.employeeId,
                company: adminToSave.company,
                position: adminToSave.position,
                startDate: adminToSave.startDate,
                hourlyRate: parseFloat(adminToSave.hourlyRate),
                overtimeMultiplier: parseFloat(adminToSave.overtimeMultiplier),
                baseWorkHour: adminToSave.baseWorkHour,
                overtimeThresholdHours: parseFloat(adminToSave.overtimeThresholdHours),
                lunchDiscountMinutes: parseInt(adminToSave.lunchDiscountMinutes, 10),
                standardLunchMinutes: parseInt(adminToSave.standardLunchMinutes, 10),
                paidTransfers: adminToSave.paidTransfers,
                payTransferTime: adminToSave.payTransferTime,
                multiDestination: adminToSave.multiDestination,
                allowMultiDestination: adminToSave.allowMultiDestination,
                geofenceRadius: parseInt(adminToSave.geofenceRadius, 10),
                destinationLimit: parseInt(adminToSave.destinationLimit, 10),
                principalAddress: adminToSave.principalAddress,
                gracePeriodMinutes: parseInt(adminToSave.gracePeriodMinutes, 10),
                entryToleranceMinutes: parseInt(adminToSave.entryToleranceMinutes, 10),
                payDay: adminToSave.payDay,
                paymentMethod: adminToSave.paymentMethod,
                currency: adminToSave.currency,
              });
              setAdminOriginal(adminToSave);
              setLastAdminChangeAt(new Date().toISOString());
              ToastService.push({
                type: "success",
                text: "Ajustes de administrador guardados.",
              });
            } catch (error) {
              const errMsg =
                error instanceof Error ? error.message : "Error al guardar.";
              ToastService.push({ type: "error", text: errMsg });
            } finally {
              setSavingAdmin(false);
            }
          },
        },
      ],
    );
  };

  const handleUnlock = async () => {
    setPinError("");
    if (pinInput.length < 4) {
      setPinError("Ingresa tu PIN de 4 a 6 dígitos.");
      return;
    }
    setUnlocking(true);
    try {
      if (!settingsService.verifyAdminPin) throw new Error("PIN no disponible.");
      const ok = await settingsService.verifyAdminPin(pinInput);
      if (!ok) {
        setPinError("PIN incorrecto.");
        setPinInput("");
        return;
      }
      setIsAdminUnlocked(true);
      setPinInput("");
      ToastService.push({ type: "success", text: "Administrador desbloqueado." });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Error al verificar PIN.";
      setPinError(errMsg);
    } finally {
      setUnlocking(false);
    }
  };

  const handleCreatePin = async () => {
    setPinError("");
    if (pinInput.length < 4 || pinInput.length > 6 || !/^\d+$/.test(pinInput)) {
      setPinError("El PIN debe ser de 4 a 6 dígitos.");
      return;
    }
    if (pinInput !== pinConfirm) {
      setPinError("Los PIN no coinciden.");
      return;
    }
    setSettingPin(true);
    try {
      if (!settingsService.setAdminPin) throw new Error("PIN no disponible.");
      await settingsService.setAdminPin(pinInput);
      setHasPin(true);
      setIsAdminUnlocked(true);
      setPinInput("");
      setPinConfirm("");
      ToastService.push({ type: "success", text: "PIN de administrador creado." });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Error al crear PIN.";
      setPinError(errMsg);
    } finally {
      setSettingPin(false);
    }
  };

  const handleChangePin = async () => {
    setPinError("");
    if (!/^\d{4,6}$/.test(oldPin) || !/^\d{4,6}$/.test(newPin)) {
      setPinError("Ambos PIN deben ser de 4 a 6 dígitos.");
      return;
    }
    setChangingPin(true);
    try {
      if (!settingsService.changeAdminPin) throw new Error("PIN no disponible.");
      await settingsService.changeAdminPin(oldPin, newPin);
      setOldPin("");
      setNewPin("");
      setShowChangePin(false);
      ToastService.push({ type: "success", text: "PIN cambiado correctamente." });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Error al cambiar PIN.";
      setPinError(errMsg);
    } finally {
      setChangingPin(false);
    }
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    setPinInput("");
    setPinError("");
    setShowChangePin(false);
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

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "worker" && styles.tabButtonActive]}
          onPress={() => setActiveTab("worker")}
        >
          <Text style={[styles.tabText, activeTab === "worker" && styles.tabTextActive]}>
            TRABAJADOR
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "admin" && styles.tabButtonActive]}
          onPress={() => setActiveTab("admin")}
        >
          <Text style={[styles.tabText, activeTab === "admin" && styles.tabTextActive]}>
            ADMINISTRADOR {hasPin && !isAdminUnlocked ? "🔒" : hasPin ? "🔓" : ""}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        automaticallyAdjustKeyboardInsets
      >
        {activeTab === "worker" ? (
          <>
            <Surface variant="base" style={styles.card}>
              <SectionTitle title="Contacto y Emergencia" icon="navigation" />
              <Input
                label="Teléfono"
                placeholder="Ej: (818) 555-0123"
                keyboardType="phone-pad"
                value={workerForm.phone}
                onChangeText={(v) => updateWorker("phone", v)}
              />
              <Input
                label="Contacto de Emergencia"
                placeholder="Nombre del contacto"
                value={workerForm.emergencyContact}
                onChangeText={(v) => updateWorker("emergencyContact", v)}
              />
              <Input
                label="Teléfono de Emergencia"
                placeholder="Teléfono de emergencia"
                keyboardType="phone-pad"
                value={workerForm.emergencyPhone}
                onChangeText={(v) => updateWorker("emergencyPhone", v)}
                containerStyle={{ marginBottom: 0 }}
              />
            </Surface>

            <Surface variant="base" style={styles.card}>
              <SectionTitle title="Preferencias Operativas" icon="map-pin" />
              <View style={styles.row}>
                <Input
                  label="Inicio Preferido (HH:MM)"
                  placeholder="06:00"
                  value={workerForm.preferredStartTime}
                  onChangeText={(v) => updateWorker("preferredStartTime", v)}
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="Almuerzo Preferido (Min)"
                  keyboardType="number-pad"
                  value={workerForm.lunchPreferenceMinutes}
                  onChangeText={(v) => updateWorker("lunchPreferenceMinutes", v)}
                  containerStyle={styles.halfInput}
                />
              </View>

              <View style={styles.segmentRow}>
                <Text style={styles.segmentLabel}>Formato de hora</Text>
                <View style={styles.segmentContainer}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      workerForm.timeFormat === "12h" && styles.segmentButtonActive,
                    ]}
                    onPress={() => updateWorker("timeFormat", "12h")}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        workerForm.timeFormat === "12h" && styles.segmentTextActive,
                      ]}
                    >
                      12h
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      workerForm.timeFormat === "24h" && styles.segmentButtonActive,
                    ]}
                    onPress={() => updateWorker("timeFormat", "24h")}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        workerForm.timeFormat === "24h" && styles.segmentTextActive,
                      ]}
                    >
                      24h
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.segmentRow}>
                <Text style={styles.segmentLabel}>Idioma</Text>
                <View style={styles.segmentContainer}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      workerForm.language === "es" && styles.segmentButtonActive,
                    ]}
                    onPress={() => updateWorker("language", "es")}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        workerForm.language === "es" && styles.segmentTextActive,
                      ]}
                    >
                      ES
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      workerForm.language === "en" && styles.segmentButtonActive,
                    ]}
                    onPress={() => updateWorker("language", "en")}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        workerForm.language === "en" && styles.segmentTextActive,
                      ]}
                    >
                      EN
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Surface>

            <Surface variant="base" style={styles.card}>
              <SectionTitle title="Notificaciones y Sonido" icon="navigation" />
              <SwitchRow
                title="Recordatorio de entrada"
                subtitle="Aviso antes de tu hora preferida."
                value={workerForm.entryReminderEnabled}
                onChange={(v) => updateWorker("entryReminderEnabled", v)}
              />
              <SwitchRow
                title="Recordatorio diario"
                subtitle="Resumen diario del sistema."
                value={workerForm.dailyReminder}
                onChange={(v) => updateWorker("dailyReminder", v)}
              />
              <SwitchRow
                title="Alertas de jornada"
                subtitle="Alertas de entrada, salida y almuerzo."
                value={workerForm.workdayAlerts}
                onChange={(v) => updateWorker("workdayAlerts", v)}
              />
              <SwitchRow
                title="Reporte listo"
                subtitle="Aviso cuando el reporte esté listo."
                value={workerForm.reportReady}
                onChange={(v) => updateWorker("reportReady", v)}
              />
              <SwitchRow
                title="Sonido"
                subtitle="Sonidos del sistema."
                value={workerForm.soundEnabled}
                onChange={(v) => updateWorker("soundEnabled", v)}
              />
              <SwitchRow
                title="Vibración"
                subtitle="Vibración en alertas."
                value={workerForm.vibrationEnabled}
                onChange={(v) => updateWorker("vibrationEnabled", v)}
                last
              />
            </Surface>

            <Button
              title={isWorkerDirty ? "Guardar Ajustes de Trabajador" : "Sin cambios"}
              variant="primary"
              size="lg"
              onPress={handleSaveWorker}
              loading={savingWorker}
              disabled={!isWorkerDirty || savingWorker}
              style={styles.saveButton}
            />
            {isWorkerDirty ? (
              <Text style={styles.dirtyHint}>Tienes cambios sin guardar en Trabajador.</Text>
            ) : null}
          </>
        ) : (
          <>
            {!hasPin ? (
              <Surface variant="base" style={styles.card}>
                <SectionTitle title="Crear PIN de Administrador" icon="navigation" />
                <Text style={styles.lockDesc}>
                  Este PIN protege nómina, tarifa, geocerca y datos contractuales. Solo el
                  administrador lo conoce. No se guarda en texto plano.
                </Text>
                <Text style={styles.pinLabel}>Nuevo PIN (4 a 6 dígitos)</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pinInput}
                  onChangeText={setPinInput}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  placeholder="••••"
                  placeholderTextColor={TEXT.muted}
                />
                <Text style={styles.pinLabel}>Confirmar PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pinConfirm}
                  onChangeText={setPinConfirm}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  placeholder="••••"
                  placeholderTextColor={TEXT.muted}
                />
                {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
                <Button
                  title="Crear PIN y Desbloquear"
                  variant="primary"
                  size="lg"
                  onPress={handleCreatePin}
                  loading={settingPin}
                  style={styles.saveButton}
                />
              </Surface>
            ) : !isAdminUnlocked ? (
              <>
                <Surface variant="base" style={styles.card}>
                  <SectionTitle title="Administrador Bloqueado" icon="navigation" />
                  <Text style={styles.lockDesc}>
                    Ingresa el PIN para editar. Los valores están enmascarados por seguridad.
                  </Text>
                  <Text style={styles.pinLabel}>PIN de Administrador</Text>
                  <TextInput
                    style={styles.pinInput}
                    value={pinInput}
                    onChangeText={setPinInput}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    placeholder="••••"
                    placeholderTextColor={TEXT.muted}
                  />
                  {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
                  <Button
                    title="Desbloquear Administrador"
                    variant="primary"
                    size="lg"
                    onPress={handleUnlock}
                    loading={unlocking}
                    style={styles.saveButton}
                  />
                </Surface>

                <Surface variant="base" style={styles.card}>
                  <SectionTitle title="Vista Enmascarada" icon="dollar-sign" />
                  <MaskedRow label="Nombre Completo" value="••••••••" />
                  <MaskedRow label="Correo para Reportes" value="••••@••••" />
                  <MaskedRow label="Dirección" value="••••••••" />
                  <MaskedRow label="Tarifa Base ($/h)" value="$ ••.••" />
                  <MaskedRow label="Multiplicador Extra" value="•.•" />
                  <MaskedRow label="Radio GPS" value="••• m" />
                  <MaskedRow label="Dirección Principal" value="••••••••" />
                  {lastAdminChangeAt ? (
                    <Text style={styles.lastChange}>
                      Último cambio admin: {new Date(lastAdminChangeAt).toLocaleString()}
                    </Text>
                  ) : null}
                </Surface>
              </>
            ) : (
              <>
                <Surface variant="base" style={styles.card}>
                  <View style={styles.unlockedHeader}>
                    <Text style={styles.unlockedText}>🔓 Administrador desbloqueado</Text>
                    <TouchableOpacity onPress={handleLockAdmin}>
                      <Text style={styles.lockButtonText}>Bloquear</Text>
                    </TouchableOpacity>
                  </View>
                  {lastAdminChangeAt ? (
                    <Text style={styles.lastChange}>
                      Último cambio admin: {new Date(lastAdminChangeAt).toLocaleString()}
                    </Text>
                  ) : null}
                  <View style={styles.row}>
                    <Button
                      title={showChangePin ? "Cancelar cambio PIN" : "Cambiar PIN"}
                      variant="secondary"
                      size="sm"
                      onPress={() => setShowChangePin((v) => !v)}
                      style={{ flex: 1 }}
                    />
                  </View>
                  {showChangePin ? (
                    <View style={{ marginTop: SPACING.md }}>
                      <Text style={styles.pinLabel}>PIN Actual</Text>
                      <TextInput
                        style={styles.pinInput}
                        value={oldPin}
                        onChangeText={setOldPin}
                        keyboardType="number-pad"
                        secureTextEntry
                        maxLength={6}
                        placeholder="••••"
                        placeholderTextColor={TEXT.muted}
                      />
                      <Text style={styles.pinLabel}>Nuevo PIN</Text>
                      <TextInput
                        style={styles.pinInput}
                        value={newPin}
                        onChangeText={setNewPin}
                        keyboardType="number-pad"
                        secureTextEntry
                        maxLength={6}
                        placeholder="••••"
                        placeholderTextColor={TEXT.muted}
                      />
                      {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
                      <Button
                        title="Confirmar Cambio de PIN"
                        variant="primary"
                        size="lg"
                        onPress={handleChangePin}
                        loading={changingPin}
                        style={styles.saveButton}
                      />
                    </View>
                  ) : null}
                </Surface>

                <Surface variant="base" style={styles.card}>
                  <SectionTitle title="Perfil y Contacto" icon="navigation" />
                  <Input
                    label="Nombre Completo"
                    placeholder="Ej: John Doe"
                    value={adminForm.name}
                    onChangeText={(v) => updateAdmin("name", v)}
                  />
                  <Input
                    label="Correo para Reportes"
                    placeholder="ejemplo@correo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={adminForm.reportEmail}
                    onChangeText={(v) => updateAdmin("reportEmail", v)}
                  />
                  <Input
                    label="Dirección"
                    placeholder="Dirección del trabajador"
                    value={adminForm.address}
                    onChangeText={(v) => updateAdmin("address", v)}
                  />
                  <View style={styles.row}>
                    <Input
                      label="ID Empleado"
                      placeholder="Ej: EMP-001"
                      value={adminForm.employeeId}
                      onChangeText={(v) => updateAdmin("employeeId", v)}
                      containerStyle={styles.halfInput}
                    />
                    <Input
                      label="Empresa"
                      placeholder="Empresa"
                      value={adminForm.company}
                      onChangeText={(v) => updateAdmin("company", v)}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <View style={styles.row}>
                    <Input
                      label="Puesto"
                      placeholder="Ej: Técnico"
                      value={adminForm.position}
                      onChangeText={(v) => updateAdmin("position", v)}
                      containerStyle={styles.halfInput}
                    />
                    <Input
                      label="Fecha Inicio (YYYY-MM-DD)"
                      placeholder="2025-01-01"
                      value={adminForm.startDate}
                      onChangeText={handleStartDateChange}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <Input
                    label="Dirección Principal"
                    placeholder="Dirección principal - manual, sin auto check-in"
                    value={adminForm.principalAddress}
                    onChangeText={(v) => updateAdmin("principalAddress", v)}
                    containerStyle={{ marginBottom: 0 }}
                  />
                </Surface>

                <Surface variant="base" style={styles.card}>
                  <SectionTitle title="Nómina y Financiero" icon="dollar-sign" />
                  <View style={styles.row}>
                    <Input
                      label="Tarifa Base ($/h)"
                      keyboardType="numeric"
                      value={adminForm.hourlyRate}
                      onChangeText={(v) => updateAdmin("hourlyRate", v)}
                      containerStyle={styles.halfInput}
                    />
                    <Input
                      label="Multiplicador Extra"
                      placeholder="1.5"
                      keyboardType="numeric"
                      value={adminForm.overtimeMultiplier}
                      onChangeText={(v) => updateAdmin("overtimeMultiplier", v)}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <View style={styles.row}>
                    <Input
                      label="Horas Base (HH:MM)"
                      placeholder="06:00"
                      value={adminForm.baseWorkHour}
                      onChangeText={(v) => updateAdmin("baseWorkHour", v)}
                      containerStyle={styles.halfInput}
                    />
                    <Input
                      label="Umbral Horas Extra"
                      keyboardType="numeric"
                      value={adminForm.overtimeThresholdHours}
                      onChangeText={(v) => updateAdmin("overtimeThresholdHours", v)}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <View style={styles.row}>
                    <Input
                      label="Almuerzo Descuento (Min)"
                      keyboardType="number-pad"
                      value={adminForm.lunchDiscountMinutes}
                      onChangeText={(v) => updateAdmin("lunchDiscountMinutes", v)}
                      containerStyle={styles.halfInput}
                    />
                    <Input
                      label="Almuerzo Estándar (Min)"
                      keyboardType="number-pad"
                      value={adminForm.standardLunchMinutes}
                      onChangeText={(v) => updateAdmin("standardLunchMinutes", v)}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <View style={styles.row}>
                    <Input
                      label="Moneda"
                      placeholder="USD"
                      autoCapitalize="characters"
                      value={adminForm.currency}
                      onChangeText={(v) => updateAdmin("currency", v)}
                      containerStyle={styles.halfInput}
                    />
                    <Input
                      label="Día de Pago"
                      placeholder="Ej: Viernes"
                      value={adminForm.payDay}
                      onChangeText={(v) => updateAdmin("payDay", v)}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <Input
                    label="Método de Pago"
                    placeholder="Ej: Transferencia"
                    value={adminForm.paymentMethod}
                    onChangeText={(v) => updateAdmin("paymentMethod", v)}
                    containerStyle={{ marginBottom: 0 }}
                  />
                </Surface>

                <Surface variant="base" style={styles.card}>
                  <SectionTitle title="Operaciones y Geocerca" icon="map-pin" />
                  <View style={styles.row}>
                    <Input
                      label="Radio GPS (Metros)"
                      keyboardType="number-pad"
                      value={adminForm.geofenceRadius}
                      onChangeText={(v) => updateAdmin("geofenceRadius", v)}
                      containerStyle={styles.halfInput}
                    />
                    <Input
                      label="Límite Destinos/Día"
                      keyboardType="number-pad"
                      value={adminForm.destinationLimit}
                      onChangeText={(v) => updateAdmin("destinationLimit", v)}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <View style={styles.row}>
                    <Input
                      label="Gracia Salida (Min)"
                      keyboardType="number-pad"
                      value={adminForm.gracePeriodMinutes}
                      onChangeText={(v) => updateAdmin("gracePeriodMinutes", v)}
                      containerStyle={styles.halfInput}
                    />
                    <Input
                      label="Tolerancia Entrada (Min)"
                      keyboardType="number-pad"
                      value={adminForm.entryToleranceMinutes}
                      onChangeText={(v) => updateAdmin("entryToleranceMinutes", v)}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <SwitchRow
                    title="Modo Multi-Destino"
                    subtitle="Permite registrar múltiples sitios en un día."
                    value={adminForm.multiDestination}
                    onChange={(v) => updateAdmin("multiDestination", v)}
                  />
                  <SwitchRow
                    title="Permitir Multi-Destino"
                    subtitle="Permiso admin para multi-destino."
                    value={adminForm.allowMultiDestination}
                    onChange={(v) => updateAdmin("allowMultiDestination", v)}
                  />
                  <SwitchRow
                    title="Traslados Pagados"
                    subtitle="Incluir el tiempo de traslado en la nómina final."
                    value={adminForm.paidTransfers}
                    onChange={(v) => updateAdmin("paidTransfers", v)}
                    disabled={!adminForm.multiDestination}
                  />
                  <SwitchRow
                    title="Pagar Tiempo de Traslado"
                    subtitle="Pagar tiempo de traslado aunque no sea multi-destino."
                    value={adminForm.payTransferTime}
                    onChange={(v) => updateAdmin("payTransferTime", v)}
                    last
                  />
                </Surface>

                <Button
                  title={isAdminDirty ? "Guardar Cambios de Administrador" : "Sin cambios"}
                  variant="primary"
                  size="lg"
                  onPress={handleSaveAdmin}
                  loading={savingAdmin}
                  disabled={!isAdminDirty || savingAdmin}
                  style={styles.saveButton}
                />
                {isAdminDirty ? (
                  <Text style={styles.dirtyHint}>
                    Tienes cambios sin guardar en Administrador. Se pedirá confirmación.
                  </Text>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
    // Reserva espacio para el toast global (ToastService) que es un overlay
    // absoluto en la parte superior. Sin este inset, el toast tapa el título AJUSTES.
    paddingTop: Platform.OS === "android" ? 64 : 16,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    backgroundColor: PALETTE.steelLine,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: PALETTE.obsidian,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT.muted,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: PALETTE.mutedGold,
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
  switchRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
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
  dirtyHint: {
    marginTop: SPACING.sm,
    textAlign: "center",
    fontSize: 12,
    color: TEXT.muted,
  },
  lockDesc: {
    fontSize: 13,
    color: TEXT.muted,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  pinLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: PALETTE.steelLine,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    letterSpacing: 4,
    color: TEXT.primary,
    backgroundColor: PALETTE.obsidian,
  },
  pinError: {
    color: "#FF6B6B",
    fontSize: 12,
    marginTop: 8,
  },
  maskedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.steelLine,
  },
  maskedLabel: {
    fontSize: 13,
    color: TEXT.muted,
  },
  maskedValue: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT.primary,
    letterSpacing: 2,
  },
  unlockedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  unlockedText: {
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.mutedGold,
  },
  lockButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT.primary,
    textDecorationLine: "underline",
  },
  lastChange: {
    fontSize: 11,
    color: TEXT.muted,
    marginTop: 6,
  },
  segmentRow: {
    marginBottom: SPACING.md,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: PALETTE.steelLine,
    borderRadius: 10,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: PALETTE.obsidian,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT.muted,
  },
  segmentTextActive: {
    color: PALETTE.mutedGold,
  },
});
