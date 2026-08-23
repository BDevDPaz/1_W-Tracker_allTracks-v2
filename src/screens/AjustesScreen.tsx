// ============================================================
// SCREEN: AjustesScreen — Gobernanza y configuración (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint Pantalla Ajustes | Identidad V2
// Responsabilidad: Configuración protegida por PIN, preferencias operativas y permisos.
// REGLAS: 
// - Parámetros financieros y de jornada usan "AdminDraft" y requieren PIN.
// - Preferencias de UI se guardan al instante.
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button, Icon } from '../components';
import { IconName } from '../components/atoms/Icon';
import { geofenceService } from '../services/geofence/GeofenceService';
import { sessionEngine } from '../services/sessionEngine/SessionEngineService';
import { settingsService } from '../services/settings/SettingsService';
import { ToastService } from '../services/toast/ToastService';
import { useSessionStore } from '../stores/sessionStore';
import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../theme';
import { UserSettings } from '../types';
import { LOADING_COPY } from '../utils/formatters';

// ── TIPOS Y FALLBACKS ────────────────────────────────────────

const DEFAULT_SETTINGS: UserSettings = {
  name: '',
  hourlyRate: 20,
  reportEmail: '',
  baseWorkHour: '06:00',
  overtimeMultiplier: 1.5,
  lunchDiscountMinutes: 30,
  geofenceRadius: 100,
  dailyReminder: true,
  workdayAlerts: true,
  reportReady: true,
  language: 'es',
  paidTransfers: false,
  multiDestination: false,
  destinationLimit: 5,
  hasCompletedOnboarding: false,
};

type PermissionStatus = 'GRANTED' | 'DENIED' | 'NOT_DETERMINED';
type AdminLockState = 'LOCKED' | 'UNLOCKED';

type AdminDraft = {
  name: string;
  hourlyRate: string;
  reportEmail: string;
  baseWorkHour: string;
  overtimeMultiplier: string;
  lunchDiscountMinutes: string;
  geofenceRadius: string;
  paidTransfers: boolean;
  multiDestination: boolean;
};

// ── UTILERÍAS DE DRAFT Y VALIDACIÓN ──────────────────────────

const createAdminDraft = (source: UserSettings): AdminDraft => ({
  name: source.name || '',
  hourlyRate: String(source.hourlyRate ?? 20),
  reportEmail: source.reportEmail || '',
  baseWorkHour: source.baseWorkHour || '06:00',
  overtimeMultiplier: String(source.overtimeMultiplier ?? 1.5),
  lunchDiscountMinutes: String(source.lunchDiscountMinutes ?? 30),
  geofenceRadius: String(source.geofenceRadius ?? 100),
  paidTransfers: source.paidTransfers ?? false,
  multiDestination: source.multiDestination ?? false,
});

const areAdminDraftsEqual = (left: AdminDraft, right: AdminDraft): boolean => {
  return (
    left.name === right.name &&
    left.hourlyRate === right.hourlyRate &&
    left.reportEmail === right.reportEmail &&
    left.baseWorkHour === right.baseWorkHour &&
    left.overtimeMultiplier === right.overtimeMultiplier &&
    left.lunchDiscountMinutes === right.lunchDiscountMinutes &&
    left.geofenceRadius === right.geofenceRadius &&
    left.paidTransfers === right.paidTransfers &&
    left.multiDestination === right.multiDestination
  );
};

const isValidTime = (value: string): boolean => {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const isValidEmail = (value: string): boolean => {
  if (value.trim().length === 0) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

const parseNumberInput = (value: string, fallback: number): number => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseIntegerInput = (value: string, fallback: number): number => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// ── COMPONENTES INTERNOS V2 ──────────────────────────────────

const FieldInput: React.FC<{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  iconName?: IconName;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  placeholder?: string;
  editable?: boolean;
}> = ({ label, value, onChangeText, iconName, keyboardType = 'default', placeholder, editable = true }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.inputWrapper, !editable && styles.inputWrapperDisabled]}>
      {iconName && <Icon name={iconName} size={18} color={TEXT.muted} />}
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={TEXT.muted}
        editable={editable}
        selectTextOnFocus={editable}
      />
    </View>
  </View>
);

const SwitchRow: React.FC<{
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}> = ({ title, subtitle, value, onValueChange, disabled = false }) => (
  <View style={styles.switchRow}>
    <View style={styles.switchTextGroup}>
      <Text style={[styles.switchTitle, disabled && styles.textDisabled]}>{title}</Text>
      {subtitle && <Text style={styles.switchSubtitle}>{subtitle}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: PALETTE.steelLine, true: PALETTE.mutedGold }}
      thumbColor={value ? PALETTE.obsidian : TEXT.muted}
    />
  </View>
);

const SectionCard: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <View style={styles.sectionCard}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    {children}
  </View>
);

// ── PANTALLA PRINCIPAL ───────────────────────────────────────

export const AjustesScreen: React.FC = () => {
  const { activeSession, updateSystemHealth } = useSessionStore();

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [adminDraft, setAdminDraft] = useState<AdminDraft>(createAdminDraft(DEFAULT_SETTINGS));
  const [adminState, setAdminState] = useState<AdminLockState>('LOCKED');
  
  const [adminPin, setAdminPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('NOT_DETERMINED');

  const isAdminUnlocked = adminState === 'UNLOCKED';
  const savedAdminDraft = useMemo(() => createAdminDraft(savedSettings), [savedSettings]);
  const hasAdminChanges = useMemo(() => !areAdminDraftsEqual(adminDraft, savedAdminDraft), [adminDraft, savedAdminDraft]);

  // ── LOADERS E INICIALIZACIÓN ───────────────────────────────

  const refreshPermissionStatus = useCallback(async () => {
    try {
      const status = await geofenceService.getPermissionStatus();
      setPermissionStatus(status as PermissionStatus);

      updateSystemHealth({
        locationPermission: status === 'GRANTED' ? 'OK' : status === 'DENIED' ? 'ERROR' : 'WARNING',
        backgroundLocation: status === 'GRANTED' ? 'OK' : status === 'DENIED' ? 'ERROR' : 'WARNING',
      });
    } catch (error) {
      console.error('[Permission Status Error]', error);
      setPermissionStatus('NOT_DETERMINED');
      updateSystemHealth({ locationPermission: 'WARNING', backgroundLocation: 'WARNING' });
    }
  }, [updateSystemHealth]);

  useEffect(() => {
    const loadCurrentSettings = async () => {
      try {
        const currentData = await settingsService.load();
        setSettings(currentData);
        setSavedSettings(currentData);
        setAdminDraft(createAdminDraft(currentData));
      } catch (error) {
        console.error('Error cargando ajustes', error);
        ToastService.push({ type: 'warning', text: 'Se cargó la configuración por defecto' });
      } finally {
        setIsLoading(false);
      }
    };

    loadCurrentSettings();
    refreshPermissionStatus();
  }, [refreshPermissionStatus]);

  // ── MANEJADORES DE ESTADO (DRAFTS Y PREFERENCIAS) ──────────

  const updateAdminDraft = useCallback(<K extends keyof AdminDraft>(key: K, value: AdminDraft[K]) => {
    setAdminDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const savePreference = useCallback(async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    if (hasAdminChanges) {
      Alert.alert('Cambios pendientes', 'Guarda o cancela los cambios administrativos antes de modificar preferencias.');
      return;
    }

    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    setIsSavingPreference(true);

    try {
      await settingsService.save(nextSettings);
      setSavedSettings(nextSettings);
      setAdminDraft(createAdminDraft(nextSettings));

      if (key === 'reportReady') {
        updateSystemHealth({ notificationsReady: value ? 'OK' : 'WARNING' });
      }
      ToastService.push({ type: 'success', text: 'Preferencia operativa actualizada' });
    } catch (error) {
      console.error('[Save Preference Error]', error);
      setSettings(savedSettings);
      setAdminDraft(createAdminDraft(savedSettings));
      Alert.alert('Error al guardar', 'Intenta nuevamente en unos segundos.');
    } finally {
      setIsSavingPreference(false);
    }
  }, [hasAdminChanges, settings, savedSettings, updateSystemHealth]);

  const buildSettingsFromAdminDraft = useCallback((): UserSettings => {
    return {
      ...settings,
      name: adminDraft.name,
      hourlyRate: parseNumberInput(adminDraft.hourlyRate, savedSettings.hourlyRate || 20),
      reportEmail: adminDraft.reportEmail,
      baseWorkHour: adminDraft.baseWorkHour,
      overtimeMultiplier: parseNumberInput(adminDraft.overtimeMultiplier, savedSettings.overtimeMultiplier || 1.5),
      lunchDiscountMinutes: parseIntegerInput(adminDraft.lunchDiscountMinutes, savedSettings.lunchDiscountMinutes || 30),
      geofenceRadius: parseIntegerInput(adminDraft.geofenceRadius, savedSettings.geofenceRadius || 100),
      paidTransfers: adminDraft.paidTransfers,
      multiDestination: adminDraft.multiDestination,
    };
  }, [adminDraft, settings, savedSettings]);

  // ── MANEJADORES ADMINISTRATIVOS ────────────────────────────

  const validateAdminDraft = useCallback((): UserSettings | null => {
    const hourlyRate = Number(adminDraft.hourlyRate.replace(',', '.'));
    const overtimeMultiplier = Number(adminDraft.overtimeMultiplier.replace(',', '.'));
    const lunchDiscountMinutes = parseInt(adminDraft.lunchDiscountMinutes, 10);
    const geofenceRadius = parseInt(adminDraft.geofenceRadius, 10);

    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      Alert.alert('Valor inválido', 'La tarifa por hora debe ser mayor a 0.');
      return null;
    }
    if (!isValidTime(adminDraft.baseWorkHour)) {
      Alert.alert('Formato inválido', 'La hora base debe tener formato HH:MM (ej. 06:00).');
      return null;
    }
    if (!Number.isFinite(overtimeMultiplier) || overtimeMultiplier < 1.0) {
      Alert.alert('Valor inválido', 'El multiplicador de overtime no puede ser menor a 1.0.');
      return null;
    }
    if (!Number.isFinite(lunchDiscountMinutes) || lunchDiscountMinutes < 0) {
      Alert.alert('Valor inválido', 'El descuento de almuerzo no puede ser negativo.');
      return null;
    }
    if (!Number.isFinite(geofenceRadius) || geofenceRadius < 10) {
      Alert.alert('Valor inválido', 'El radio de geocerca debe ser de al menos 10 metros.');
      return null;
    }
    if (!isValidEmail(adminDraft.reportEmail)) {
      Alert.alert('Formato inválido', 'El correo para reportes no tiene un formato válido.');
      return null;
    }

    return buildSettingsFromAdminDraft();
  }, [adminDraft, buildSettingsFromAdminDraft]);

  const handleUnlockAdmin = () => {
    if (adminPin.length >= 4) {
      setAdminDraft(createAdminDraft(savedSettings));
      setAdminState('UNLOCKED');
      setAdminPin('');
      ToastService.push({ type: 'info', text: 'Zona administrativa desbloqueada' });
    } else {
      Alert.alert('Acceso protegido', 'Ingresa al menos 4 dígitos para desbloquear.');
    }
  };

  const handleCancelAdmin = () => {
    setAdminDraft(createAdminDraft(savedSettings));
    setSettings(savedSettings);
    setAdminState('LOCKED');
    setAdminPin('');
    ToastService.push({ type: 'info', text: 'Cambios administrativos descartados' });
  };

  const handleLockAdmin = () => {
    if (!hasAdminChanges) {
      setAdminState('LOCKED');
      setAdminPin('');
      ToastService.push({ type: 'info', text: 'Zona administrativa bloqueada' });
      return;
    }

    Alert.alert('Cambios sin guardar', '¿Deseas descartar los cambios administrativos y bloquear la sección?', [
      { text: 'Seguir editando', style: 'cancel' },
      {
        text: 'Descartar y bloquear',
        style: 'destructive',
        onPress: () => {
          setAdminDraft(createAdminDraft(savedSettings));
          setSettings(savedSettings);
          setAdminState('LOCKED');
          setAdminPin('');
        },
      },
    ]);
  };

  const handleSaveAdmin = async () => {
    const nextSettings = validateAdminDraft();
    if (!nextSettings) return;

    setIsSaving(true);
    try {
      const previousRadius = savedSettings.geofenceRadius;
      await settingsService.save(nextSettings);

      // Re-registro de geocerca si cambió el radio y hay sesión activa
      if (previousRadius !== nextSettings.geofenceRadius) {
        const activeEngineSession = sessionEngine.getActiveSession();
        if (activeEngineSession?._lat != null && activeEngineSession?._lng != null) {
          try {
            await geofenceService.unregister(activeEngineSession.id);
            await geofenceService.register({
              identifier: activeEngineSession.id,
              latitude: activeEngineSession._lat,
              longitude: activeEngineSession._lng,
              radius: nextSettings.geofenceRadius,
            });
            updateSystemHealth({ geofenceActive: 'OK' });
          } catch (geoError) {
            console.warn('[Geofence Re-register Warning]', geoError);
            updateSystemHealth({ geofenceActive: 'WARNING' });
          }
        }
      }

      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setAdminDraft(createAdminDraft(nextSettings));
      setAdminState('LOCKED');
      setAdminPin('');
      ToastService.push({ type: 'success', text: 'Configuración de gobernanza guardada' });
    } catch (error: any) {
      console.error('[Save Admin Settings Error]', error);
      Alert.alert('Error al guardar', error.message || 'Verifica los datos e intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── MANEJADORES DE PERMISOS ────────────────────────────────

  const handleReviewPermissions = async () => {
    setIsRequestingPermissions(true);
    try {
      const granted = await geofenceService.requestPermissions();
      await refreshPermissionStatus();
      if (granted) {
        ToastService.push({ type: 'success', text: 'Permisos de ubicación activados' });
      } else {
        Alert.alert('Permisos incompletos', 'Activa los permisos de ubicación en "Siempre" desde la configuración de tu dispositivo.');
      }
    } catch (error) {
      console.error('[Request Permissions Error]', error);
      Alert.alert('Error', 'No se pudieron revisar los permisos de ubicación.');
    } finally {
      setIsRequestingPermissions(false);
    }
  };

  // ── RENDERIZADO ───────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PALETTE.mutedGold} />
          <Text style={styles.loadingText}>Cargando ajustes del sistema...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const locationGranted = permissionStatus === 'GRANTED';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardRoot}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Ajustes</Text>
            <Text style={styles.headerSubtitle}>GOBERNANZA Y CONFIGURACIÓN</Text>
          </View>

          {/* 1. PERFIL LABORAL Y FINANCIERO */}
          <SectionCard 
            title="PERFIL LABORAL Y FINANCIERO" 
            hint={isAdminUnlocked ? 'Edición administrativa habilitada.' : 'Desbloquea la zona administrativa para editar.'}
          >
            <FieldInput
              label="Nombre del Operario"
              iconName="user"
              value={adminDraft.name}
              onChangeText={(v) => updateAdminDraft('name', v)}
              editable={isAdminUnlocked}
            />
            <FieldInput
              label="Tarifa Base por Hora (USD)"
              iconName="briefcase"
              value={adminDraft.hourlyRate}
              onChangeText={(v) => updateAdminDraft('hourlyRate', v)}
              keyboardType="numeric"
              editable={isAdminUnlocked}
            />
            <FieldInput
              label="Correo para Reportes PDF"
              iconName="mail"
              value={adminDraft.reportEmail}
              onChangeText={(v) => updateAdminDraft('reportEmail', v)}
              keyboardType="email-address"
              placeholder="ejemplo@empresa.com"
              editable={isAdminUnlocked}
            />
          </SectionCard>

          {/* 2. PARÁMETROS DE JORNADA Y GEOCERCA */}
          <SectionCard 
            title="PARÁMETROS DE JORNADA Y GEOCERCA" 
            hint={isAdminUnlocked ? 'Ten precaución al alterar radios y multiplicadores.' : 'Bloqueado por seguridad.'}
          >
            <FieldInput
              label="Hora Base (Formato HH:MM)"
              iconName="clock"
              value={adminDraft.baseWorkHour}
              onChangeText={(v) => updateAdminDraft('baseWorkHour', v)}
              editable={isAdminUnlocked}
            />
            <FieldInput
              label="Multiplicador Overtime (≥ 1.0)"
              iconName="percent"
              value={adminDraft.overtimeMultiplier}
              onChangeText={(v) => updateAdminDraft('overtimeMultiplier', v)}
              keyboardType="numeric"
              editable={isAdminUnlocked}
            />
            <FieldInput
              label="Descuento Almuerzo por Defecto (Min)"
              iconName="coffee"
              value={adminDraft.lunchDiscountMinutes}
              onChangeText={(v) => updateAdminDraft('lunchDiscountMinutes', v)}
              keyboardType="numeric"
              editable={isAdminUnlocked}
            />
            <FieldInput
              label="Radio de Geocerca (Metros)"
              iconName="map-pin"
              value={adminDraft.geofenceRadius}
              onChangeText={(v) => updateAdminDraft('geofenceRadius', v)}
              keyboardType="numeric"
              editable={isAdminUnlocked}
            />
            <SwitchRow
              title="Traslados Remunerados"
              subtitle="Contabilizar tiempo de tránsito entre destinos"
              value={adminDraft.paidTransfers}
              onValueChange={(v) => updateAdminDraft('paidTransfers', v)}
              disabled={!isAdminUnlocked}
            />
            <SwitchRow
              title="Soporte Multi-Destino"
              subtitle="Permitir múltiples check-ins por jornada"
              value={adminDraft.multiDestination}
              onValueChange={(v) => updateAdminDraft('multiDestination', v)}
              disabled={!isAdminUnlocked}
            />
          </SectionCard>

          {/* 3. ZONA ADMINISTRATIVA (BLOQUEO PIN) */}
          <View style={[styles.adminControlBlock, isAdminUnlocked && styles.adminControlBlockUnlocked]}>
            <View style={styles.adminHeader}>
              <Icon name={isAdminUnlocked ? "unlock" : "lock"} size={18} color={isAdminUnlocked ? PALETTE.successGreen : TEXT.primary} />
              <Text style={styles.adminTitle}>Zona Administrativa {isAdminUnlocked && 'Desbloqueada'}</Text>
            </View>

            {!isAdminUnlocked ? (
              <View style={styles.adminLockedContent}>
                <TextInput
                  style={styles.pinInput}
                  value={adminPin}
                  onChangeText={setAdminPin}
                  secureTextEntry
                  keyboardType="numeric"
                  maxLength={8}
                  placeholder="PIN o Contraseña de acceso"
                  placeholderTextColor={TEXT.muted}
                />
                <Button label="Desbloquear para Editar" variant="secondary" size="md" onPress={handleUnlockAdmin} fullWidth />
              </View>
            ) : (
              <View style={styles.adminUnlockedContent}>
                <Button
                  label="Guardar Cambios Administrativos"
                  variant="primary"
                  size="md"
                  onPress={handleSaveAdmin}
                  disabled={!hasAdminChanges || isSaving}
                  loading={isSaving}
                  loadingText={LOADING_COPY.saveSettings}
                  iconName="shield-check"
                  fullWidth
                />
                <View style={styles.adminActionRow}>
                  <Button label="Cancelar" variant="secondary" size="md" onPress={handleCancelAdmin} disabled={isSaving} style={{ flex: 1 }} />
                  <Button label="Bloquear" variant="outline" size="md" onPress={handleLockAdmin} disabled={isSaving} style={{ flex: 1 }} />
                </View>
                {hasAdminChanges && <Text style={styles.dirtyHint}>* Tienes cambios sin guardar.</Text>}
              </View>
            )}
          </View>

          {/* 4. PREFERENCIAS OPERATIVAS */}
          <SectionCard title="PREFERENCIAS OPERATIVAS" hint="Estos ajustes se guardan automáticamente al cambiarlos.">
            <SwitchRow
              title="Recordatorios Diarios"
              subtitle="Notificar para iniciar jornada"
              value={settings.dailyReminder}
              onValueChange={(v) => savePreference('dailyReminder', v)}
              disabled={isSavingPreference}
            />
            <SwitchRow
              title="Alertas de Jornada"
              subtitle="Avisos sobre overtime o geocercas"
              value={settings.workdayAlerts}
              onValueChange={(v) => savePreference('workdayAlerts', v)}
              disabled={isSavingPreference}
            />
            <SwitchRow
              title="Reportes Listos"
              subtitle="Aviso cuando finaliza la auditoría"
              value={settings.reportReady}
              onValueChange={(v) => savePreference('reportReady', v)}
              disabled={isSavingPreference}
            />

            <View style={styles.languageSection}>
              <Text style={styles.fieldLabel}>IDIOMA DE LA INTERFAZ</Text>
              <View style={styles.languageRow}>
                {(['es', 'en'] as const).map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langBtn, settings.language === lang && styles.langBtnActive, isSavingPreference && styles.langBtnDisabled]}
                    onPress={() => savePreference('language', lang)}
                    disabled={isSavingPreference}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.langBtnText, settings.language === lang && styles.langBtnTextActive]}>
                      {lang === 'es' ? 'Español' : 'English'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </SectionCard>

          {/* 5. UBICACIÓN Y PERMISOS NATIVOS */}
          <SectionCard title="PERMISOS DEL DISPOSITIVO">
            <SwitchRow title="Acceso a Ubicación (GPS)" value={locationGranted} onValueChange={handleReviewPermissions} />
            <SwitchRow title="Monitoreo en Background" value={locationGranted} onValueChange={handleReviewPermissions} />
            
            <Text style={[styles.permissionStatusText, !locationGranted && styles.permissionStatusError]}>
              Estado: {permissionStatus === 'GRANTED' ? 'Concedidos (Siempre)' : permissionStatus === 'DENIED' ? 'Denegados' : 'No determinados'}
            </Text>

            <TouchableOpacity
              style={[styles.reviewPermissionsBtn, isRequestingPermissions && styles.langBtnDisabled]}
              onPress={handleReviewPermissions}
              activeOpacity={0.8}
              disabled={isRequestingPermissions}
            >
              <Text style={styles.reviewPermissionsText}>
                {isRequestingPermissions ? 'Validando con el OS...' : 'Revisar Permisos Nativos'}
              </Text>
            </TouchableOpacity>
          </SectionCard>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>W Tracker v2.0.0</Text>
            <Text style={styles.footerText}>© BDevDPaz 2026</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── ESTILOS ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PALETTE.obsidian },
  keyboardRoot: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  loadingText: { color: TEXT.secondary, fontSize: FONT.body.size, fontFamily: 'Montserrat' },
  header: { marginHorizontal: SPACING.xl, marginTop: SPACING.sm, marginBottom: SPACING.lg },
  headerTitle: { color: TEXT.primary, fontSize: FONT.h2.size, fontWeight: '700', fontFamily: 'Montserrat', letterSpacing: -0.5 },
  headerSubtitle: { color: TEXT.secondary, fontSize: FONT.label.size, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Montserrat', marginTop: 2 },
  sectionCard: { backgroundColor: PALETTE.graphite, borderRadius: RADIUS.cards, borderColor: PALETTE.steelLine, borderWidth: 1, marginHorizontal: SPACING.xl, padding: SPACING.lg, marginBottom: SPACING.xl, gap: SPACING.md },
  sectionTitle: { color: TEXT.secondary, fontSize: FONT.label.size, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'Montserrat' },
  sectionHint: { color: TEXT.muted, fontSize: FONT.caption.size, fontFamily: 'Montserrat', marginTop: -SPACING.xs, marginBottom: SPACING.xs },
  fieldGroup: { gap: SPACING.xs },
  fieldLabel: { color: TEXT.muted, fontSize: FONT.caption.size, fontFamily: 'Montserrat', textTransform: 'uppercase', letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: PALETTE.carbonMist, borderColor: PALETTE.steelLine, borderWidth: 1, borderRadius: RADIUS.inputs, paddingHorizontal: SPACING.md, height: 48, gap: SPACING.sm },
  inputWrapperDisabled: { opacity: 0.5 },
  input: { flex: 1, color: TEXT.primary, fontSize: FONT.body.size, fontFamily: 'Montserrat' },
  inputDisabled: { color: TEXT.muted },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.xs },
  switchTextGroup: { flex: 1, paddingRight: SPACING.md },
  switchTitle: { color: TEXT.primary, fontSize: FONT.bodyStrong.size - 1, fontWeight: '600', fontFamily: 'Montserrat' },
  switchSubtitle: { color: TEXT.muted, fontSize: FONT.caption.size, fontFamily: 'Montserrat', marginTop: 2 },
  textDisabled: { color: TEXT.muted },
  adminControlBlock: { marginHorizontal: SPACING.xl, padding: SPACING.lg, borderRadius: RADIUS.cards, backgroundColor: PALETTE.carbonMist, marginBottom: SPACING.xl, borderWidth: 1, borderColor: PALETTE.steelLine },
  adminControlBlockUnlocked: { borderColor: PALETTE.mutedGold },
  adminHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.md },
  adminTitle: { color: TEXT.primary, fontSize: FONT.bodyStrong.size, fontWeight: '700', fontFamily: 'Montserrat' },
  adminLockedContent: { gap: SPACING.md },
  pinInput: { backgroundColor: PALETTE.graphite, color: TEXT.primary, fontSize: FONT.body.size, fontFamily: 'Montserrat', borderRadius: RADIUS.inputs, padding: SPACING.md, borderWidth: 1, borderColor: PALETTE.steelLine, textAlign: 'center', letterSpacing: 4 },
  adminUnlockedContent: { gap: SPACING.md },
  adminActionRow: { flexDirection: 'row', gap: SPACING.md },
  dirtyHint: { color: PALETTE.amberWarning, fontSize: FONT.caption.size, fontFamily: 'Montserrat', textAlign: 'center' },
  languageSection: { paddingTop: SPACING.sm, gap: SPACING.xs },
  languageRow: { flexDirection: 'row', gap: SPACING.sm },
  langBtn: { flex: 1, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.inputs, borderWidth: 1, borderColor: PALETTE.steelLine, alignItems: 'center', backgroundColor: PALETTE.carbonMist },
  langBtnActive: { backgroundColor: 'rgba(197, 160, 89, 0.12)', borderColor: PALETTE.mutedGold },
  langBtnDisabled: { opacity: 0.5 },
  langBtnText: { color: TEXT.muted, fontSize: FONT.body.size - 1, fontFamily: 'Montserrat' },
  langBtnTextActive: { color: PALETTE.mutedGold, fontWeight: '600' },
  permissionStatusText: { color: TEXT.secondary, fontSize: FONT.caption.size, fontFamily: 'Montserrat', marginTop: SPACING.sm },
  permissionStatusError: { color: PALETTE.deepRed },
  reviewPermissionsBtn: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, borderRadius: RADIUS.inputs, borderWidth: 1, borderColor: PALETTE.steelLine, alignItems: 'center', backgroundColor: PALETTE.carbonMist },
  reviewPermissionsText: { color: TEXT.primary, fontSize: FONT.body.size - 1, fontFamily: 'Montserrat' },
  footer: { alignItems: 'center', paddingBottom: SPACING.xxl, opacity: 0.5, gap: 4 },
  footerText: { color: TEXT.muted, fontSize: FONT.caption.size, fontFamily: 'Montserrat' },
});
