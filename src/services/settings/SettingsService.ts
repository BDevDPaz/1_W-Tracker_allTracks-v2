import { DatabaseService } from "@/services/database/DatabaseService";
import type { ISettingsService, UserSettings } from "@/types/contracts";

const SETTINGS_ID = "user_settings";
const LEGACY_SETTINGS_KEY = "user_settings";
const MINIMUM_GEOFENCE_RADIUS_METERS = 10;

export const DEFAULT_SETTINGS: Readonly<UserSettings> = Object.freeze({
  name: "",
  hourlyRate: 20,
  reportEmail: "",
  baseWorkHour: "06:00",
  overtimeMultiplier: 1.5,
  lunchDiscountMinutes: 30,
  standardLunchMinutes: 30,
  overtimeThresholdHours: 8,
  geofenceRadius: 100,
  dailyReminder: true,
  workdayAlerts: true,
  reportReady: true,
  language: "es",
  currency: "USD",
  multiDestination: false,
  allowMultiDestination: false,
  paidTransfers: true,
  payTransferTime: true,
  destinationLimit: 5,
  hasCompletedOnboarding: false,
  adminPin: null,
});

interface DBSettingsRow {
  id: string;
  name: string | null;
  hourly_rate: number | null;
  report_email: string | null;
  base_work_hour: string | null;
  overtime_multiplier: number | null;
  lunch_discount_minutes: number | null;
  geofence_radius: number | null;
  daily_reminder: number | null;
  workday_alerts: number | null;
  report_ready: number | null;
  language: string | null;
  multi_destination: number | null;
  paid_transfers: number | null;
  destination_limit: number | null;
  has_completed_onboarding: number | null;
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

  async save(settings: UserSettings): Promise<void> {
    const normalizedSettings = this.normalizeSettings(settings);
    this.validateSettings(normalizedSettings);

    const database = DatabaseService.getDb();
    const updatedAt = new Date().toISOString();

    try {
      await database.runAsync(
        `INSERT INTO settings (
          id, name, hourly_rate, report_email, base_work_hour, overtime_multiplier,
          lunch_discount_minutes, geofence_radius, daily_reminder, workday_alerts,
          report_ready, language, multi_destination, paid_transfers, destination_limit,
          has_completed_onboarding, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, hourly_rate = excluded.hourly_rate, report_email = excluded.report_email,
          base_work_hour = excluded.base_work_hour, overtime_multiplier = excluded.overtime_multiplier,
          lunch_discount_minutes = excluded.lunch_discount_minutes, geofence_radius = excluded.geofence_radius,
          daily_reminder = excluded.daily_reminder, workday_alerts = excluded.workday_alerts,
          report_ready = excluded.report_ready, language = excluded.language,
          multi_destination = excluded.multi_destination, paid_transfers = excluded.paid_transfers,
          destination_limit = excluded.destination_limit, has_completed_onboarding = excluded.has_completed_onboarding,
          updated_at = excluded.updated_at`,
        [
          SETTINGS_ID,
          normalizedSettings.name,
          normalizedSettings.hourlyRate,
          normalizedSettings.reportEmail,
          normalizedSettings.baseWorkHour,
          normalizedSettings.overtimeMultiplier,
          normalizedSettings.lunchDiscountMinutes,
          normalizedSettings.geofenceRadius,
          this.booleanToSQLite(normalizedSettings.dailyReminder),
          this.booleanToSQLite(normalizedSettings.workdayAlerts),
          this.booleanToSQLite(normalizedSettings.reportReady),
          normalizedSettings.language,
          this.booleanToSQLite(normalizedSettings.multiDestination),
          this.booleanToSQLite(normalizedSettings.paidTransfers),
          normalizedSettings.destinationLimit,
          this.booleanToSQLite(normalizedSettings.hasCompletedOnboarding),
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
        const migratedSettings =
          this.normalizePersistedSettings(legacySettings);
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
      geofenceRadius: row.geofence_radius,
      dailyReminder: row.daily_reminder,
      workdayAlerts: row.workday_alerts,
      reportReady: row.report_ready,
      language: row.language,
      multiDestination: row.multi_destination,
      paidTransfers: row.paid_transfers,
      destinationLimit: row.destination_limit,
      hasCompletedOnboarding: row.has_completed_onboarding,
    });
  }

  private normalizeSettings(settings: UserSettings): UserSettings {
    return {
      name: settings.name.trim(),
      hourlyRate: Number(settings.hourlyRate),
      reportEmail: settings.reportEmail.trim().toLowerCase(),
      baseWorkHour: settings.baseWorkHour.trim(),
      overtimeMultiplier: Number(settings.overtimeMultiplier),
      lunchDiscountMinutes: Number(settings.lunchDiscountMinutes),
      geofenceRadius: Number(settings.geofenceRadius),
      dailyReminder: settings.dailyReminder,
      workdayAlerts: settings.workdayAlerts,
      reportReady: settings.reportReady,
      language: settings.language,
      multiDestination: settings.multiDestination,
      paidTransfers: settings.paidTransfers,
      destinationLimit: Number(settings.destinationLimit),
      hasCompletedOnboarding: settings.hasCompletedOnboarding,
      adminPin: settings.adminPin,
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
      lunchDiscountMinutes: this.toInteger(
        input.lunchDiscountMinutes,
        DEFAULT_SETTINGS.lunchDiscountMinutes,
      ),
      geofenceRadius: this.toInteger(
        input.geofenceRadius,
        DEFAULT_SETTINGS.geofenceRadius,
      ),
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
      multiDestination: this.toBoolean(
        input.multiDestination,
        DEFAULT_SETTINGS.multiDestination,
      ),
      paidTransfers: this.toBoolean(
        input.paidTransfers,
        DEFAULT_SETTINGS.paidTransfers,
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
    if (
      !Number.isInteger(settings.lunchDiscountMinutes) ||
      settings.lunchDiscountMinutes < 0
    )
      throw new Error("Descuento de almuerzo inválido.");
    if (
      !Number.isInteger(settings.geofenceRadius) ||
      settings.geofenceRadius < MINIMUM_GEOFENCE_RADIUS_METERS
    )
      throw new Error(`Radio mínimo: ${MINIMUM_GEOFENCE_RADIUS_METERS}m.`);
    if (
      !Number.isInteger(settings.destinationLimit) ||
      settings.destinationLimit <= 0
    )
      throw new Error("Límite de destinos inválido.");
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
