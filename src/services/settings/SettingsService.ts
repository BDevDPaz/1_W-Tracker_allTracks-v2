import * as Crypto from "expo-crypto";
import { DatabaseService } from "@/services/database/DatabaseService";
import type { ISettingsService, UserSettings } from "@/types/contracts";

const SETTINGS_ID = "user_settings";
const LEGACY_SETTINGS_KEY = "user_settings";
const GEOFENCE_RADIUS_MIN_METERS = 80;
const GEOFENCE_RADIUS_MAX_METERS = 250;
const GEOFENCE_RADIUS_STEP_METERS = 10;
const GEOFENCE_RADIUS_DEFAULT_METERS = 150;
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 6;
// P3: umbral horas extra fijo por ley. Almuerzo 30-60, default 30, pasos de 5.
const OVERTIME_THRESHOLD_HOURS = 8;
const LUNCH_MIN_MINUTES = 30;
const LUNCH_MAX_MINUTES = 60;
const LUNCH_STEP_MINUTES = 5;
const LUNCH_DEFAULT_MINUTES = 30;

export const DEFAULT_SETTINGS: Readonly<UserSettings> = Object.freeze({
  name: "",
  hourlyRate: 20,
  reportEmail: "",
  baseWorkHour: "06:00",
  overtimeMultiplier: 1.5,
  lunchDiscountMinutes: 30,
  standardLunchMinutes: 30,
  overtimeThresholdHours: 8,
  geofenceRadius: 150,
  dailyReminder: true,
  workdayAlerts: true,
  reportReady: true,
  language: "es",
  currency: "USD",
  allowMultiDestination: false,
  payTransferTime: true,
  destinationLimit: 5,
  hasCompletedOnboarding: false,
  adminPin: null,
  // Trabajador
  phone: "",
  emergencyContact: "",
  emergencyPhone: "",
  preferredStartTime: "06:00",
  lunchPreferenceMinutes: 30,
  entryReminderEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  timeFormat: "12h",
  // Administrador
  address: "",
  employeeId: "",
  company: "",
  position: "",
  startDate: "",
  principalAddress: "",
  gracePeriodMinutes: 0,
  entryToleranceMinutes: 0,
  payDay: "",
  paymentMethod: "",
  adminPinHash: null,
  adminPinSet: false,
  lastAdminChangeAt: null,
  lastAdminChangeBy: null,
});

const WORKER_KEYS: Array<keyof UserSettings> = [
  "phone",
  "emergencyContact",
  "emergencyPhone",
  "preferredStartTime",
  "lunchPreferenceMinutes",
  "entryReminderEnabled",
  "soundEnabled",
  "vibrationEnabled",
  "timeFormat",
  "language",
  "dailyReminder",
  "workdayAlerts",
  "reportReady",
];

const ADMIN_KEYS: Array<keyof UserSettings> = [
  "name",
  "reportEmail",
  "address",
  "employeeId",
  "company",
  "position",
  "startDate",
  "hourlyRate",
  "overtimeMultiplier",
  "baseWorkHour",
  "overtimeThresholdHours",
  "lunchDiscountMinutes",
  "standardLunchMinutes",
  "payTransferTime",
  "allowMultiDestination",
  "geofenceRadius",
  "destinationLimit",
  "principalAddress",
  "gracePeriodMinutes",
  "entryToleranceMinutes",
  "payDay",
  "paymentMethod",
  "currency",
];

interface DBSettingsRow {
  id: string;
  name: string | null;
  hourly_rate: number | null;
  report_email: string | null;
  base_work_hour: string | null;
  overtime_multiplier: number | null;
  lunch_discount_minutes: number | null;
  standard_lunch_minutes: number | null;
  overtime_threshold_hours: number | null;
  geofence_radius: number | null;
  daily_reminder: number | null;
  workday_alerts: number | null;
  report_ready: number | null;
  language: string | null;
  currency: string | null;
  allow_multi_destination: number | null;
  pay_transfer_time: number | null;
  destination_limit: number | null;
  has_completed_onboarding: number | null;
  phone: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  preferred_start_time: string | null;
  lunch_preference_minutes: number | null;
  entry_reminder_enabled: number | null;
  sound_enabled: number | null;
  vibration_enabled: number | null;
  time_format: string | null;
  address: string | null;
  employee_id: string | null;
  company: string | null;
  position: string | null;
  start_date: string | null;
  principal_address: string | null;
  grace_period_minutes: number | null;
  entry_tolerance_minutes: number | null;
  pay_day: string | null;
  payment_method: string | null;
  admin_pin_hash: string | null;
  admin_pin_set: number | null;
  last_admin_change_at: string | null;
  last_admin_change_by: string | null;
  updated_at: string | null;
}

interface LegacySettingsRow {
  value: string;
}

type StoredBoolean = boolean | 0 | 1 | "0" | "1";

type PersistedSettingsInput = Partial<Record<keyof UserSettings, unknown>>;

export class SettingsService implements ISettingsService {
  private cachedSettings: UserSettings | null = null;
  private loadPromise: Promise<UserSettings> | null = null;

  async load(): Promise<UserSettings> {
    if (this.cachedSettings) return this.cloneSettings(this.cachedSettings);
    if (this.loadPromise) {
      const settings = await this.loadPromise;
      return this.cloneSettings(settings);
    }
    this.loadPromise = this.loadInternal();
    try {
      const settings = await this.loadPromise;
      return this.cloneSettings(settings);
    } finally {
      this.loadPromise = null;
    }
  }

  // --- Lectura fresca sin caché para fondo / TaskManager / Engine ---
  // No usa cachedSettings, no usa loadPromise, no escribe caché, no llama a save().
  // Solo lee la fila actual de SQLite. Si no hay fila, devuelve defaults sin guardar.
  async getFreshSettings(): Promise<UserSettings> {
    const database = DatabaseService.getDb();
    const relationalRow = await database.getFirstAsync<DBSettingsRow>(
      `SELECT * FROM settings WHERE id = ? LIMIT 1`,
      [SETTINGS_ID],
    );

    if (relationalRow) {
      const freshSettings = this.mapFromDatabase(relationalRow);
      this.validateSettings(freshSettings);
      return this.cloneSettings(freshSettings);
    }

    const legacySettings = await this.loadLegacySettings();
    if (legacySettings) {
      let migratedSettings =
        this.normalizePersistedSettings(legacySettings);
      const legacyPin = legacySettings.adminPin;
      if (
        typeof legacyPin === "string" &&
        legacyPin.length >= PIN_MIN_LENGTH &&
        !migratedSettings.adminPinHash
      ) {
        migratedSettings = {
          ...migratedSettings,
          adminPinHash: await this.hashPin(legacyPin),
          adminPinSet: true,
        };
      }
      this.validateSettings(migratedSettings);
      return this.cloneSettings(migratedSettings);
    }

    return this.cloneDefaultSettings();
  }

  async save(settings: UserSettings): Promise<void> {
    const normalizedSettings = this.normalizeSettings(settings);
    this.validateSettings(normalizedSettings);

    const database = DatabaseService.getDb();
    const updatedAt = new Date().toISOString();

    try {
      await database.runAsync(
        `INSERT INTO settings (
          id, name, hourly_rate, report_email, base_work_hour, overtime_multiplier,
          lunch_discount_minutes, standard_lunch_minutes, overtime_threshold_hours,
          geofence_radius, daily_reminder, workday_alerts,
          report_ready, language, currency, allow_multi_destination,
          pay_transfer_time, destination_limit,
          has_completed_onboarding, phone, emergency_contact, emergency_phone,
          preferred_start_time, lunch_preference_minutes, entry_reminder_enabled,
          sound_enabled, vibration_enabled, time_format,
          address, employee_id, company, position, start_date, principal_address,
          grace_period_minutes, entry_tolerance_minutes, pay_day, payment_method,
          admin_pin_hash, admin_pin_set, last_admin_change_at, last_admin_change_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, hourly_rate = excluded.hourly_rate, report_email = excluded.report_email,
          base_work_hour = excluded.base_work_hour, overtime_multiplier = excluded.overtime_multiplier,
          lunch_discount_minutes = excluded.lunch_discount_minutes,
          standard_lunch_minutes = excluded.standard_lunch_minutes,
          overtime_threshold_hours = excluded.overtime_threshold_hours,
          geofence_radius = excluded.geofence_radius,
          daily_reminder = excluded.daily_reminder, workday_alerts = excluded.workday_alerts,
          report_ready = excluded.report_ready, language = excluded.language,
          currency = excluded.currency,
          allow_multi_destination = excluded.allow_multi_destination,
          pay_transfer_time = excluded.pay_transfer_time,
          destination_limit = excluded.destination_limit,
          has_completed_onboarding = excluded.has_completed_onboarding,
          phone = excluded.phone, emergency_contact = excluded.emergency_contact,
          emergency_phone = excluded.emergency_phone,
          preferred_start_time = excluded.preferred_start_time,
          lunch_preference_minutes = excluded.lunch_preference_minutes,
          entry_reminder_enabled = excluded.entry_reminder_enabled,
          sound_enabled = excluded.sound_enabled,
          vibration_enabled = excluded.vibration_enabled,
          time_format = excluded.time_format,
          address = excluded.address, employee_id = excluded.employee_id,
          company = excluded.company, position = excluded.position,
          start_date = excluded.start_date, principal_address = excluded.principal_address,
          grace_period_minutes = excluded.grace_period_minutes,
          entry_tolerance_minutes = excluded.entry_tolerance_minutes,
          pay_day = excluded.pay_day, payment_method = excluded.payment_method,
          admin_pin_hash = excluded.admin_pin_hash, admin_pin_set = excluded.admin_pin_set,
          last_admin_change_at = excluded.last_admin_change_at,
          last_admin_change_by = excluded.last_admin_change_by,
          updated_at = excluded.updated_at`,
        [
          SETTINGS_ID,
          normalizedSettings.name,
          normalizedSettings.hourlyRate,
          normalizedSettings.reportEmail,
          normalizedSettings.baseWorkHour,
          normalizedSettings.overtimeMultiplier,
          normalizedSettings.lunchDiscountMinutes,
          normalizedSettings.standardLunchMinutes ?? 30,
          normalizedSettings.overtimeThresholdHours ?? 8,
          normalizedSettings.geofenceRadius,
          this.booleanToSQLite(normalizedSettings.dailyReminder),
          this.booleanToSQLite(normalizedSettings.workdayAlerts),
          this.booleanToSQLite(normalizedSettings.reportReady),
          normalizedSettings.language,
          normalizedSettings.currency ?? "USD",
          this.booleanToSQLite(normalizedSettings.allowMultiDestination ?? false),
          this.booleanToSQLite(normalizedSettings.payTransferTime ?? true),
          normalizedSettings.destinationLimit,
          this.booleanToSQLite(normalizedSettings.hasCompletedOnboarding),
          normalizedSettings.phone ?? "",
          normalizedSettings.emergencyContact ?? "",
          normalizedSettings.emergencyPhone ?? "",
          normalizedSettings.preferredStartTime ?? "06:00",
          normalizedSettings.lunchPreferenceMinutes ?? 30,
          this.booleanToSQLite(normalizedSettings.entryReminderEnabled ?? true),
          this.booleanToSQLite(normalizedSettings.soundEnabled ?? true),
          this.booleanToSQLite(normalizedSettings.vibrationEnabled ?? true),
          normalizedSettings.timeFormat ?? "12h",
          normalizedSettings.address ?? "",
          normalizedSettings.employeeId ?? "",
          normalizedSettings.company ?? "",
          normalizedSettings.position ?? "",
          normalizedSettings.startDate ?? "",
          normalizedSettings.principalAddress ?? "",
          normalizedSettings.gracePeriodMinutes ?? 0,
          normalizedSettings.entryToleranceMinutes ?? 0,
          normalizedSettings.payDay ?? "",
          normalizedSettings.paymentMethod ?? "",
          normalizedSettings.adminPinHash ?? null,
          this.booleanToSQLite(normalizedSettings.adminPinSet ?? false),
          normalizedSettings.lastAdminChangeAt ?? null,
          normalizedSettings.lastAdminChangeBy ?? null,
          updatedAt,
        ],
      );
      this.cachedSettings = this.cloneSettings(normalizedSettings);
    } catch (error) {
      console.error(
        "[SettingsService Save Failed] Error guardando la configuración:",
        error,
      );
      throw error;
    }
  }

  getSettings(): UserSettings {
    return this.cloneSettings(this.cachedSettings ?? DEFAULT_SETTINGS);
  }

  async getSnapshotRate(): Promise<number> {
    const settings = await this.load();
    return settings.hourlyRate;
  }

  clearCache(): void {
    this.cachedSettings = null;
    this.loadPromise = null;
  }

  // --- PIN Admin ---

  async hasAdminPin(): Promise<boolean> {
    const settings = await this.load();
    return Boolean(settings.adminPinHash) || settings.adminPinSet === true;
  }

  async verifyAdminPin(pin: string): Promise<boolean> {
    const settings = await this.load();
    if (!settings.adminPinHash) return false;
    if (!this.isValidPinFormat(pin)) return false;
    const hash = await this.hashPin(pin);
    return hash === settings.adminPinHash;
  }

  async setAdminPin(pin: string): Promise<void> {
    if (!this.isValidPinFormat(pin))
      throw new Error("El PIN debe ser de 4 a 6 dígitos.");
    const current = await this.load();
    const hash = await this.hashPin(pin);
    const next: UserSettings = {
      ...current,
      adminPin: null,
      adminPinHash: hash,
      adminPinSet: true,
      lastAdminChangeAt: new Date().toISOString(),
      lastAdminChangeBy: "admin",
    };
    await this.save(next);
  }

  async changeAdminPin(oldPin: string, newPin: string): Promise<void> {
    const isValid = await this.verifyAdminPin(oldPin);
    if (!isValid) throw new Error("PIN actual incorrecto.");
    await this.setAdminPin(newPin);
  }

  // --- Guardados separados ---

  async saveWorkerSettings(patch: Partial<UserSettings>): Promise<void> {
    const current = await this.load();
    const filtered: Partial<UserSettings> = {};
    for (const key of WORKER_KEYS) {
      if (patch[key] !== undefined) {
        (filtered as Record<string, unknown>)[key] = patch[key];
      }
    }
    const next: UserSettings = { ...current, ...filtered };
    await this.save(next);
  }

  async saveAdminSettings(patch: Partial<UserSettings>): Promise<void> {
    const current = await this.load();
    const filtered: Partial<UserSettings> = {};
    for (const key of ADMIN_KEYS) {
      if (patch[key] !== undefined) {
        (filtered as Record<string, unknown>)[key] = patch[key];
      }
    }
    const next: UserSettings = {
      ...current,
      ...filtered,
      lastAdminChangeAt: new Date().toISOString(),
      lastAdminChangeBy: "admin",
    };
    await this.save(next);
  }

  private async loadInternal(): Promise<UserSettings> {
    try {
      const database = DatabaseService.getDb();
      const relationalRow = await database.getFirstAsync<DBSettingsRow>(
        `SELECT * FROM settings WHERE id = ? LIMIT 1`,
        [SETTINGS_ID],
      );

      if (relationalRow) {
        const loadedSettings = this.mapFromDatabase(relationalRow);
        this.validateSettings(loadedSettings);
        this.cachedSettings = this.cloneSettings(loadedSettings);
        return this.cloneSettings(this.cachedSettings);
      }

      const legacySettings = await this.loadLegacySettings();
      if (legacySettings) {
        let migratedSettings =
          this.normalizePersistedSettings(legacySettings);
        // Migración PIN viejo en texto plano -> hash, nunca se guarda en plano
        const legacyPin = legacySettings.adminPin;
        if (
          typeof legacyPin === "string" &&
          legacyPin.length >= PIN_MIN_LENGTH &&
          !migratedSettings.adminPinHash
        ) {
          migratedSettings = {
            ...migratedSettings,
            adminPinHash: await this.hashPin(legacyPin),
            adminPinSet: true,
          };
        }
        this.validateSettings(migratedSettings);
        try {
          await this.save(migratedSettings);
          await this.removeLegacySettings();
        } catch (migrationError) {
          console.warn("[SettingsService Migration Warning]", migrationError);
          this.cachedSettings = this.cloneSettings(migratedSettings);
        }
        return this.cloneSettings(this.cachedSettings ?? migratedSettings);
      }

      const defaults = this.cloneDefaultSettings();
      try {
        await this.save(defaults);
      } catch (persistenceError) {
        console.warn("[SettingsService Defaults Warning]", persistenceError);
        this.cachedSettings = this.cloneSettings(defaults);
      }
      return this.cloneSettings(this.cachedSettings ?? defaults);
    } catch (error) {
      console.warn("[SettingsService Load Warning]", error);
      const defaults = this.cloneDefaultSettings();
      this.cachedSettings = defaults;
      return this.cloneSettings(defaults);
    }
  }

  private async loadLegacySettings(): Promise<PersistedSettingsInput | null> {
    try {
      const database = DatabaseService.getDb();
      const row = await database.getFirstAsync<LegacySettingsRow>(
        `SELECT value FROM key_value_store WHERE key = ? LIMIT 1`,
        [LEGACY_SETTINGS_KEY],
      );
      if (!row?.value) return null;
      const parsed = JSON.parse(row.value) as unknown;
      if (!this.isRecord(parsed)) return null;
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  private async removeLegacySettings(): Promise<void> {
    try {
      const database = DatabaseService.getDb();
      await database.runAsync(`DELETE FROM key_value_store WHERE key = ?`, [
        LEGACY_SETTINGS_KEY,
      ]);
    } catch (_error) {}
  }

  private mapFromDatabase(row: DBSettingsRow): UserSettings {
    return this.normalizePersistedSettings({
      name: row.name,
      hourlyRate: row.hourly_rate,
      reportEmail: row.report_email,
      baseWorkHour: row.base_work_hour,
      overtimeMultiplier: row.overtime_multiplier,
      lunchDiscountMinutes: row.lunch_discount_minutes,
      standardLunchMinutes: row.standard_lunch_minutes,
      overtimeThresholdHours: row.overtime_threshold_hours,
      geofenceRadius: row.geofence_radius,
      dailyReminder: row.daily_reminder,
      workdayAlerts: row.workday_alerts,
      reportReady: row.report_ready,
      language: row.language,
      currency: row.currency,
      allowMultiDestination: row.allow_multi_destination,
      payTransferTime: row.pay_transfer_time,
      destinationLimit: row.destination_limit,
      hasCompletedOnboarding: row.has_completed_onboarding,
      phone: row.phone,
      emergencyContact: row.emergency_contact,
      emergencyPhone: row.emergency_phone,
      preferredStartTime: row.preferred_start_time,
      lunchPreferenceMinutes: row.lunch_preference_minutes,
      entryReminderEnabled: row.entry_reminder_enabled,
      soundEnabled: row.sound_enabled,
      vibrationEnabled: row.vibration_enabled,
      timeFormat: row.time_format,
      address: row.address,
      employeeId: row.employee_id,
      company: row.company,
      position: row.position,
      startDate: row.start_date,
      principalAddress: row.principal_address,
      gracePeriodMinutes: row.grace_period_minutes,
      entryToleranceMinutes: row.entry_tolerance_minutes,
      payDay: row.pay_day,
      paymentMethod: row.payment_method,
      adminPinHash: row.admin_pin_hash,
      adminPinSet: row.admin_pin_set,
      lastAdminChangeAt: row.last_admin_change_at,
      lastAdminChangeBy: row.last_admin_change_by,
    });
  }

  private normalizeSettings(settings: UserSettings): UserSettings {
    return {
      name: settings.name.trim(),
      hourlyRate: Number(settings.hourlyRate),
      reportEmail: settings.reportEmail.trim().toLowerCase(),
      baseWorkHour: settings.baseWorkHour.trim(),
      overtimeMultiplier: Number(settings.overtimeMultiplier),
      // P3: clamp 30-60. Si viene 15 o 90, se corrige, no se guarda ilegal.
      lunchDiscountMinutes: this.clampLunchMinutes(settings.lunchDiscountMinutes),
      standardLunchMinutes: this.clampLunchMinutes(settings.standardLunchMinutes),
      // P3: fijo 8. Se ignora cualquier valor distinto que venga de UI o DB vieja.
      overtimeThresholdHours: OVERTIME_THRESHOLD_HOURS,
      geofenceRadius: this.clampGeofenceRadius(settings.geofenceRadius),
      dailyReminder: settings.dailyReminder,
      workdayAlerts: settings.workdayAlerts,
      reportReady: settings.reportReady,
      language: settings.language,
      currency: (settings.currency ?? "USD").trim() || "USD",
      allowMultiDestination: settings.allowMultiDestination ?? false,
      payTransferTime: settings.payTransferTime ?? true,
      destinationLimit: Number(settings.destinationLimit),
      hasCompletedOnboarding: settings.hasCompletedOnboarding,
      adminPin: null,
      phone: (settings.phone ?? "").trim(),
      emergencyContact: (settings.emergencyContact ?? "").trim(),
      emergencyPhone: (settings.emergencyPhone ?? "").trim(),
      preferredStartTime: (settings.preferredStartTime ?? "06:00").trim(),
      lunchPreferenceMinutes: this.clampLunchMinutes(
        settings.lunchPreferenceMinutes,
      ),
      entryReminderEnabled: settings.entryReminderEnabled ?? true,
      soundEnabled: settings.soundEnabled ?? true,
      vibrationEnabled: settings.vibrationEnabled ?? true,
      timeFormat: settings.timeFormat ?? "12h",
      address: (settings.address ?? "").trim(),
      employeeId: (settings.employeeId ?? "").trim(),
      company: (settings.company ?? "").trim(),
      position: (settings.position ?? "").trim(),
      startDate: (settings.startDate ?? "").trim(),
      principalAddress: (settings.principalAddress ?? "").trim(),
      gracePeriodMinutes:
        settings.gracePeriodMinutes != null
          ? Number(settings.gracePeriodMinutes)
          : 0,
      entryToleranceMinutes:
        settings.entryToleranceMinutes != null
          ? Number(settings.entryToleranceMinutes)
          : 0,
      payDay: (settings.payDay ?? "").trim(),
      paymentMethod: (settings.paymentMethod ?? "").trim(),
      adminPinHash: settings.adminPinHash ?? null,
      adminPinSet: settings.adminPinSet ?? false,
      lastAdminChangeAt: settings.lastAdminChangeAt ?? null,
      lastAdminChangeBy: settings.lastAdminChangeBy ?? null,
    };
  }

  private normalizePersistedSettings(
    input: PersistedSettingsInput,
  ): UserSettings {
    return {
      name: this.toTrimmedString(input.name, DEFAULT_SETTINGS.name),
      hourlyRate: this.toFiniteNumber(
        input.hourlyRate,
        DEFAULT_SETTINGS.hourlyRate,
      ),
      reportEmail: this.toTrimmedString(
        input.reportEmail,
        DEFAULT_SETTINGS.reportEmail,
      ).toLowerCase(),
      baseWorkHour: this.toTrimmedString(
        input.baseWorkHour,
        DEFAULT_SETTINGS.baseWorkHour,
      ),
      overtimeMultiplier: this.toFiniteNumber(
        input.overtimeMultiplier,
        DEFAULT_SETTINGS.overtimeMultiplier,
      ),
      // P3: clamp 30-60. Migra valores viejos fuera de rango a un valor legal.
      lunchDiscountMinutes: this.clampLunchMinutes(input.lunchDiscountMinutes),
      standardLunchMinutes: this.clampLunchMinutes(input.standardLunchMinutes),
      // P3: fijo 8. Migra cualquier valor viejo distinto a 8.
      overtimeThresholdHours: OVERTIME_THRESHOLD_HOURS,
      geofenceRadius: this.clampGeofenceRadius(input.geofenceRadius),
      dailyReminder: this.toBoolean(
        input.dailyReminder,
        DEFAULT_SETTINGS.dailyReminder,
      ),
      workdayAlerts: this.toBoolean(
        input.workdayAlerts,
        DEFAULT_SETTINGS.workdayAlerts,
      ),
      reportReady: this.toBoolean(
        input.reportReady,
        DEFAULT_SETTINGS.reportReady,
      ),
      language: input.language === "en" ? "en" : "es",
      currency: this.toTrimmedString(
        input.currency,
        DEFAULT_SETTINGS.currency ?? "USD",
      ),
      allowMultiDestination: this.toBoolean(
        input.allowMultiDestination,
        DEFAULT_SETTINGS.allowMultiDestination ?? false,
      ),
      payTransferTime: this.toBoolean(
        input.payTransferTime,
        DEFAULT_SETTINGS.payTransferTime ?? true,
      ),
      destinationLimit: this.toInteger(
        input.destinationLimit,
        DEFAULT_SETTINGS.destinationLimit,
      ),
      hasCompletedOnboarding: this.toBoolean(
        input.hasCompletedOnboarding,
        DEFAULT_SETTINGS.hasCompletedOnboarding,
      ),
      adminPin: null,
      phone: this.toTrimmedString(input.phone, ""),
      emergencyContact: this.toTrimmedString(input.emergencyContact, ""),
      emergencyPhone: this.toTrimmedString(input.emergencyPhone, ""),
      preferredStartTime: this.toTrimmedString(
        input.preferredStartTime,
        DEFAULT_SETTINGS.preferredStartTime ?? "06:00",
      ),
      lunchPreferenceMinutes: this.clampLunchMinutes(input.lunchPreferenceMinutes),
      entryReminderEnabled: this.toBoolean(
        input.entryReminderEnabled,
        DEFAULT_SETTINGS.entryReminderEnabled ?? true,
      ),
      soundEnabled: this.toBoolean(
        input.soundEnabled,
        DEFAULT_SETTINGS.soundEnabled ?? true,
      ),
      vibrationEnabled: this.toBoolean(
        input.vibrationEnabled,
        DEFAULT_SETTINGS.vibrationEnabled ?? true,
      ),
      timeFormat:
        input.timeFormat === "24h" || input.timeFormat === "12h"
          ? input.timeFormat
          : "12h",
      address: this.toTrimmedString(input.address, ""),
      employeeId: this.toTrimmedString(input.employeeId, ""),
      company: this.toTrimmedString(input.company, ""),
      position: this.toTrimmedString(input.position, ""),
      startDate: this.toTrimmedString(input.startDate, ""),
      principalAddress: this.toTrimmedString(input.principalAddress, ""),
      gracePeriodMinutes: this.toInteger(
        input.gracePeriodMinutes,
        DEFAULT_SETTINGS.gracePeriodMinutes ?? 0,
      ),
      entryToleranceMinutes: this.toInteger(
        input.entryToleranceMinutes,
        DEFAULT_SETTINGS.entryToleranceMinutes ?? 0,
      ),
      payDay: this.toTrimmedString(input.payDay, ""),
      paymentMethod: this.toTrimmedString(input.paymentMethod, ""),
      adminPinHash:
        typeof input.adminPinHash === "string" && input.adminPinHash
          ? input.adminPinHash
          : null,
      adminPinSet: this.toBoolean(
        input.adminPinSet,
        Boolean(input.adminPinHash),
      ),
      lastAdminChangeAt:
        typeof input.lastAdminChangeAt === "string"
          ? input.lastAdminChangeAt
          : null,
      lastAdminChangeBy:
        typeof input.lastAdminChangeBy === "string"
          ? input.lastAdminChangeBy
          : null,
    };
  }

  private validateSettings(settings: UserSettings): void {
    if (!Number.isFinite(settings.hourlyRate) || settings.hourlyRate <= 0)
      throw new Error("La tarifa por hora debe ser mayor a cero.");
    if (settings.reportEmail && !this.isValidEmail(settings.reportEmail))
      throw new Error("Correo inválido.");
    if (!this.isValidTime(settings.baseWorkHour))
      throw new Error("Hora base inválida.");
    if (
      !Number.isFinite(settings.overtimeMultiplier) ||
      settings.overtimeMultiplier < 1
    )
      throw new Error("Multiplicador inválido.");
    // P3: almuerzo 30-60, pasos de 5.
    if (
      !Number.isInteger(settings.lunchDiscountMinutes) ||
      settings.lunchDiscountMinutes < LUNCH_MIN_MINUTES ||
      settings.lunchDiscountMinutes > LUNCH_MAX_MINUTES ||
      settings.lunchDiscountMinutes % LUNCH_STEP_MINUTES !== 0
    )
      throw new Error(
        `Descuento de almuerzo debe ser entre ${LUNCH_MIN_MINUTES} y ${LUNCH_MAX_MINUTES} min, en pasos de ${LUNCH_STEP_MINUTES} min.`,
      );
    if (
      settings.standardLunchMinutes != null &&
      (!Number.isInteger(settings.standardLunchMinutes) ||
        settings.standardLunchMinutes < LUNCH_MIN_MINUTES ||
        settings.standardLunchMinutes > LUNCH_MAX_MINUTES ||
        settings.standardLunchMinutes % LUNCH_STEP_MINUTES !== 0)
    )
      throw new Error(
        `Almuerzo estándar debe ser entre ${LUNCH_MIN_MINUTES} y ${LUNCH_MAX_MINUTES} min, en pasos de ${LUNCH_STEP_MINUTES} min.`,
      );
    // P3: fijo 8 por ley. No se acepta otro valor aunque llegue de DB vieja sin normalizar.
    if (settings.overtimeThresholdHours !== OVERTIME_THRESHOLD_HOURS)
      throw new Error(
        `Umbral de horas extra es fijo ${OVERTIME_THRESHOLD_HOURS} por ley. No se puede cambiar.`,
      );
    if (
      !Number.isInteger(settings.geofenceRadius) ||
      settings.geofenceRadius < GEOFENCE_RADIUS_MIN_METERS ||
      settings.geofenceRadius > GEOFENCE_RADIUS_MAX_METERS ||
      settings.geofenceRadius % GEOFENCE_RADIUS_STEP_METERS !== 0
    )
      throw new Error(
        `Radio GPS debe ser entre ${GEOFENCE_RADIUS_MIN_METERS} y ${GEOFENCE_RADIUS_MAX_METERS} m, en pasos de ${GEOFENCE_RADIUS_STEP_METERS} m.`,
      );
    if (
      !Number.isInteger(settings.destinationLimit) ||
      settings.destinationLimit <= 0
    )
      throw new Error("Límite de destinos inválido.");
    if (
      settings.gracePeriodMinutes != null &&
      (!Number.isInteger(settings.gracePeriodMinutes) ||
        settings.gracePeriodMinutes < 0)
    )
      throw new Error("Periodo de gracia inválido.");
    if (
      settings.entryToleranceMinutes != null &&
      (!Number.isInteger(settings.entryToleranceMinutes) ||
        settings.entryToleranceMinutes < 0)
    )
      throw new Error("Tolerancia de entrada inválida.");
    if (
      settings.preferredStartTime &&
      !this.isValidTime(settings.preferredStartTime)
    )
      throw new Error("Hora de inicio preferida inválida.");
    // P3: preferencia almuerzo también 30-60, pasos de 5.
    if (
      settings.lunchPreferenceMinutes != null &&
      (!Number.isInteger(settings.lunchPreferenceMinutes) ||
        settings.lunchPreferenceMinutes < LUNCH_MIN_MINUTES ||
        settings.lunchPreferenceMinutes > LUNCH_MAX_MINUTES ||
        settings.lunchPreferenceMinutes % LUNCH_STEP_MINUTES !== 0)
    )
      throw new Error(
        `Preferencia de almuerzo debe ser entre ${LUNCH_MIN_MINUTES} y ${LUNCH_MAX_MINUTES} min, en pasos de ${LUNCH_STEP_MINUTES} min.`,
      );
    if (
      settings.timeFormat &&
      settings.timeFormat !== "12h" &&
      settings.timeFormat !== "24h"
    )
      throw new Error("Formato de hora inválido.");
  }

  private async hashPin(pin: string): Promise<string> {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin,
    );
  }

  private isValidPinFormat(pin: string): boolean {
    return new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin);
  }

  private isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }
  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  private booleanToSQLite(value: boolean): 0 | 1 {
    return value ? 1 : 0;
  }

  private clampGeofenceRadius(value: unknown): number {
    if (value == null || value === "") return GEOFENCE_RADIUS_DEFAULT_METERS;
    const num = Number(value);
    if (!Number.isFinite(num)) return GEOFENCE_RADIUS_DEFAULT_METERS;
    const snapped =
      Math.round(num / GEOFENCE_RADIUS_STEP_METERS) *
      GEOFENCE_RADIUS_STEP_METERS;
    return Math.min(
      GEOFENCE_RADIUS_MAX_METERS,
      Math.max(GEOFENCE_RADIUS_MIN_METERS, snapped),
    );
  }

  // P3: mismo patrón que clampGeofenceRadius. Snap a pasos de 5 y clamp 30-60.
  private clampLunchMinutes(value: unknown): number {
    if (value == null || value === "") return LUNCH_DEFAULT_MINUTES;
    const num = Number(value);
    if (!Number.isFinite(num)) return LUNCH_DEFAULT_MINUTES;
    const snapped =
      Math.round(num / LUNCH_STEP_MINUTES) * LUNCH_STEP_MINUTES;
    return Math.min(
      LUNCH_MAX_MINUTES,
      Math.max(LUNCH_MIN_MINUTES, snapped),
    );
  }

  private toBoolean(value: unknown, fallback: boolean): boolean {
    const stored = value as StoredBoolean;
    if (stored === true || stored === 1 || stored === "1") return true;
    if (stored === false || stored === 0 || stored === "0") return false;
    return fallback;
  }

  private toFiniteNumber(value: unknown, fallback: number): number {
    if (value == null || value === "") return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  private toInteger(value: unknown, fallback: number): number {
    const num = this.toFiniteNumber(value, fallback);
    return Number.isInteger(num) ? num : fallback;
  }

  private toTrimmedString(value: unknown, fallback: string): string {
    return typeof value === "string" ? value.trim() : fallback;
  }

  private isRecord(value: unknown): value is PersistedSettingsInput {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private cloneDefaultSettings(): UserSettings {
    return { ...DEFAULT_SETTINGS };
  }
  private cloneSettings(settings: Readonly<UserSettings>): UserSettings {
    return { ...settings };
  }
}

export const settingsService = new SettingsService();
