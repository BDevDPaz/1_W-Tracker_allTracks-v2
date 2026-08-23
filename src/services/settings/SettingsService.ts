// ============================================================
// SERVICE: SettingsService — Configuración del usuario V2.2
// Ruta: src/services/settings/SettingsService.ts
// Versión: 2.2.0 (Workday Tracking Platform)
//
// Responsabilidades:
// - Carga y persistencia de configuración en SQLite.
// - Caché defensiva en memoria.
// - Validación y normalización de valores.
// - Migración desde key_value_store.
// - Configuración multi-destino.
// - Snapshot de tarifa para nuevas jornadas.
//
// Persistencia canónica:
// - Tabla relacional `settings`.
//
// Compatibilidad heredada:
// - Tabla `key_value_store`.
//
// IMPORTANTE:
// - DatabaseService.initialize() debe ejecutarse durante el
//   arranque de la aplicación antes de utilizar este servicio.
// ============================================================

import type {
  ISettingsService,
  UserSettings,
} from '../../types/contracts';

import { DatabaseService } from '../database/DatabaseService';

const SETTINGS_ID = 'user_settings';
const LEGACY_SETTINGS_KEY = 'user_settings';

const DEFAULT_DESTINATION_LIMIT = 5;
const MINIMUM_GEOFENCE_RADIUS_METERS = 10;

// Fragmento relevante para DEFAULT_SETTINGS
export const DEFAULT_SETTINGS: Readonly<UserSettings> = Object.freeze({
  name: '',
  hourlyRate: 20,
  reportEmail: '',
  baseWorkHour: '06:00',
  overtimeMultiplier: 1.5,
  lunchDiscountMinutes: 30,
  standardLunchMinutes: 30,
  overtimeThresholdHours: 8,
  geofenceRadius: 100,
  dailyReminder: true,
  workdayAlerts: true,
  reportReady: true,
  language: 'es',
  currency: 'USD',
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

type StoredBoolean = boolean | 0 | 1 | '0' | '1';

type PersistedSettingsInput = {
  name?: unknown;
  hourlyRate?: unknown;
  reportEmail?: unknown;
  baseWorkHour?: unknown;
  overtimeMultiplier?: unknown;
  lunchDiscountMinutes?: unknown;
  geofenceRadius?: unknown;
  dailyReminder?: unknown;
  workdayAlerts?: unknown;
  reportReady?: unknown;
  language?: unknown;
  multiDestination?: unknown;
  paidTransfers?: unknown;
  destinationLimit?: unknown;
  hasCompletedOnboarding?: unknown;
};

/**
 * Servicio canónico de configuración.
 *
 * La configuración en memoria nunca se expone directamente.
 * Todos los valores devueltos son copias defensivas.
 */
export class SettingsService implements ISettingsService {
  private cachedSettings: UserSettings | null = null;

  private loadPromise: Promise<UserSettings> | null = null;

  /**
   * Carga la configuración utilizando el siguiente orden:
   *
   * 1. Caché en memoria.
   * 2. Tabla relacional `settings`.
   * 3. Tabla heredada `key_value_store`.
   * 4. Valores predeterminados.
   *
   * Las llamadas concurrentes comparten una misma promesa para
   * evitar lecturas y migraciones duplicadas.
   */
  async load(): Promise<UserSettings> {
    if (this.cachedSettings) {
      return this.cloneSettings(this.cachedSettings);
    }

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

  /**
   * Persiste la configuración completa después de normalizarla
   * y validarla.
   */
  async save(settings: UserSettings): Promise<void> {
    const normalizedSettings = this.normalizeSettings(settings);

    this.validateSettings(normalizedSettings);

    const database = DatabaseService.getDb();
    const updatedAt = new Date().toISOString();

    try {
      await database.runAsync(
        `INSERT INTO settings (
          id,
          name,
          hourly_rate,
          report_email,
          base_work_hour,
          overtime_multiplier,
          lunch_discount_minutes,
          geofence_radius,
          daily_reminder,
          workday_alerts,
          report_ready,
          language,
          multi_destination,
          paid_transfers,
          destination_limit,
          has_completed_onboarding,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          hourly_rate = excluded.hourly_rate,
          report_email = excluded.report_email,
          base_work_hour = excluded.base_work_hour,
          overtime_multiplier = excluded.overtime_multiplier,
          lunch_discount_minutes =
            excluded.lunch_discount_minutes,
          geofence_radius = excluded.geofence_radius,
          daily_reminder = excluded.daily_reminder,
          workday_alerts = excluded.workday_alerts,
          report_ready = excluded.report_ready,
          language = excluded.language,
          multi_destination = excluded.multi_destination,
          paid_transfers = excluded.paid_transfers,
          destination_limit = excluded.destination_limit,
          has_completed_onboarding =
            excluded.has_completed_onboarding,
          updated_at = excluded.updated_at`,
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
        this.booleanToSQLite(
          normalizedSettings.multiDestination
        ),
        this.booleanToSQLite(
          normalizedSettings.paidTransfers
        ),
        normalizedSettings.destinationLimit,
        this.booleanToSQLite(
          normalizedSettings.hasCompletedOnboarding
        ),
        updatedAt
      );

      this.cachedSettings =
        this.cloneSettings(normalizedSettings);
    } catch (error) {
      console.error(
        '[SettingsService Save Failed] Error guardando la configuración:',
        error
      );

      throw error;
    }
  }

  /**
   * Devuelve una copia defensiva de la configuración disponible
   * actualmente en memoria.
   *
   * Si load() aún no fue ejecutado, devuelve los valores
   * predeterminados sin consultar SQLite.
   */
  getSettings(): UserSettings {
    return this.cloneSettings(
      this.cachedSettings ?? DEFAULT_SETTINGS
    );
  }

  /**
   * Devuelve la tarifa que debe almacenarse en el snapshot de
   * una nueva jornada.
   */
  async getSnapshotRate(): Promise<number> {
    const settings = await this.load();
    return settings.hourlyRate;
  }

  /**
   * Invalida exclusivamente la caché en memoria.
   *
   * No modifica la configuración persistida.
   */
  clearCache(): void {
    this.cachedSettings = null;
    this.loadPromise = null;
  }

  // ── CARGA INTERNA ────────────────────────────────────────

  private async loadInternal(): Promise<UserSettings> {
    try {
      const database = DatabaseService.getDb();

      const relationalRow =
        await database.getFirstAsync<DBSettingsRow>(
          `SELECT *
           FROM settings
           WHERE id = ?
           LIMIT 1`,
          SETTINGS_ID
        );

      if (relationalRow) {
        const loadedSettings =
          this.mapFromDatabase(relationalRow);

        this.validateSettings(loadedSettings);

        this.cachedSettings =
          this.cloneSettings(loadedSettings);

        return this.cloneSettings(this.cachedSettings);
      }

      const legacySettings =
        await this.loadLegacySettings();

      if (legacySettings) {
        const migratedSettings =
          this.normalizePersistedSettings(legacySettings);

        this.validateSettings(migratedSettings);

        try {
          await this.save(migratedSettings);
          await this.removeLegacySettings();
        } catch (migrationError) {
          console.warn(
            '[SettingsService Migration Warning] ' +
              'No fue posible migrar la configuración heredada.',
            migrationError
          );

          this.cachedSettings =
            this.cloneSettings(migratedSettings);
        }

        return this.cloneSettings(
          this.cachedSettings ?? migratedSettings
        );
      }

      const defaults = this.cloneDefaultSettings();

      try {
        await this.save(defaults);
      } catch (persistenceError) {
        console.warn(
          '[SettingsService Defaults Warning] ' +
            'No fue posible persistir la configuración predeterminada.',
          persistenceError
        );

        this.cachedSettings =
          this.cloneSettings(defaults);
      }

      return this.cloneSettings(
        this.cachedSettings ?? defaults
      );
    } catch (error) {
      console.warn(
        '[SettingsService Load Warning] ' +
          'No fue posible cargar la configuración desde SQLite. ' +
          'Se utilizarán valores predeterminados durante esta sesión.',
        error
      );

      const defaults = this.cloneDefaultSettings();
      this.cachedSettings = defaults;

      return this.cloneSettings(defaults);
    }
  }

  // ── MIGRACIÓN HEREDADA ──────────────────────────────────

  /**
   * Recupera una configuración JSON de key_value_store.
   *
   * Este método no modifica la tabla heredada. La entrada se
   * elimina únicamente después de una migración satisfactoria.
   */
  private async loadLegacySettings():
    Promise<PersistedSettingsInput | null> {
    try {
      const database = DatabaseService.getDb();

      const row =
        await database.getFirstAsync<LegacySettingsRow>(
          `SELECT value
           FROM key_value_store
           WHERE key = ?
           LIMIT 1`,
          LEGACY_SETTINGS_KEY
        );

      if (!row?.value) {
        return null;
      }

      const parsed: unknown = JSON.parse(row.value);

      if (!this.isRecord(parsed)) {
        console.warn(
          '[SettingsService Legacy Warning] ' +
            'La configuración heredada no contiene un objeto JSON.'
        );

        return null;
      }

      return parsed;
    } catch (error) {
      console.warn(
        '[SettingsService Legacy Warning] ' +
          'No fue posible cargar la configuración heredada.',
        error
      );

      return null;
    }
  }

  /**
   * Elimina la entrada heredada después de persistir
   * satisfactoriamente la configuración canónica.
   */
  private async removeLegacySettings(): Promise<void> {
    try {
      const database = DatabaseService.getDb();

      await database.runAsync(
        `DELETE FROM key_value_store
         WHERE key = ?`,
        LEGACY_SETTINGS_KEY
      );
    } catch (error) {
      // La configuración canónica ya está guardada. Un fallo al
      // limpiar el registro heredado no debe invalidar la migración.
      console.warn(
        '[SettingsService Legacy Cleanup Warning] ' +
          'La configuración fue migrada, pero no pudo eliminarse ' +
          'la entrada heredada.',
        error
      );
    }
  }

  // ── MAPEO DE SQLITE ──────────────────────────────────────

  private mapFromDatabase(
    row: DBSettingsRow
  ): UserSettings {
    return this.normalizePersistedSettings({
      name: row.name,

      hourlyRate: row.hourly_rate,

      reportEmail: row.report_email,

      baseWorkHour: row.base_work_hour,

      overtimeMultiplier: row.overtime_multiplier,

      lunchDiscountMinutes:
        row.lunch_discount_minutes,

      geofenceRadius: row.geofence_radius,

      dailyReminder: row.daily_reminder,

      workdayAlerts: row.workday_alerts,

      reportReady: row.report_ready,

      language: row.language,

      multiDestination: row.multi_destination,

      paidTransfers: row.paid_transfers,

      destinationLimit: row.destination_limit,

      hasCompletedOnboarding:
        row.has_completed_onboarding,
    });
  }

  // ── NORMALIZACIÓN ────────────────────────────────────────

  /**
   * Normaliza una configuración completa proporcionada por la
   * capa de dominio.
   *
   * Los valores inválidos no se sustituyen silenciosamente por
   * defaults. La validación posterior debe rechazarlos.
   */
  private normalizeSettings(
    settings: UserSettings
  ): UserSettings {
    return {
      name: settings.name.trim(),

      hourlyRate: Number(settings.hourlyRate),

      reportEmail: settings.reportEmail
        .trim()
        .toLowerCase(),

      baseWorkHour: settings.baseWorkHour.trim(),

      overtimeMultiplier: Number(
        settings.overtimeMultiplier
      ),

      lunchDiscountMinutes: Number(
        settings.lunchDiscountMinutes
      ),

      geofenceRadius: Number(
        settings.geofenceRadius
      ),

      dailyReminder: settings.dailyReminder,

      workdayAlerts: settings.workdayAlerts,

      reportReady: settings.reportReady,

      language: settings.language,

      multiDestination: settings.multiDestination,

      paidTransfers: settings.paidTransfers,

      destinationLimit: Number(
        settings.destinationLimit
      ),

      hasCompletedOnboarding:
        settings.hasCompletedOnboarding,
    };
  }

  /**
   * Normaliza valores provenientes de SQLite o de una versión
   * heredada y aplica defaults cuando faltan o no pueden
   * convertirse de forma segura.
   */
  private normalizePersistedSettings(
    input: PersistedSettingsInput
  ): UserSettings {
    return {
      name: this.toTrimmedString(
        input.name,
        DEFAULT_SETTINGS.name
      ),

      hourlyRate: this.toFiniteNumber(
        input.hourlyRate,
        DEFAULT_SETTINGS.hourlyRate
      ),

      reportEmail: this.toTrimmedString(
        input.reportEmail,
        DEFAULT_SETTINGS.reportEmail
      ).toLowerCase(),

      baseWorkHour: this.toTrimmedString(
        input.baseWorkHour,
        DEFAULT_SETTINGS.baseWorkHour
      ),

      overtimeMultiplier: this.toFiniteNumber(
        input.overtimeMultiplier,
        DEFAULT_SETTINGS.overtimeMultiplier
      ),

      lunchDiscountMinutes: this.toInteger(
        input.lunchDiscountMinutes,
        DEFAULT_SETTINGS.lunchDiscountMinutes
      ),

      geofenceRadius: this.toInteger(
        input.geofenceRadius,
        DEFAULT_SETTINGS.geofenceRadius
      ),

      dailyReminder: this.toBoolean(
        input.dailyReminder,
        DEFAULT_SETTINGS.dailyReminder
      ),

      workdayAlerts: this.toBoolean(
        input.workdayAlerts,
        DEFAULT_SETTINGS.workdayAlerts
      ),

      reportReady: this.toBoolean(
        input.reportReady,
        DEFAULT_SETTINGS.reportReady
      ),

      language:
        input.language === 'en' ? 'en' : 'es',

      multiDestination: this.toBoolean(
        input.multiDestination,
        DEFAULT_SETTINGS.multiDestination
      ),

      paidTransfers: this.toBoolean(
        input.paidTransfers,
        DEFAULT_SETTINGS.paidTransfers
      ),

      destinationLimit: this.toInteger(
        input.destinationLimit,
        DEFAULT_SETTINGS.destinationLimit
      ),

      hasCompletedOnboarding: this.toBoolean(
        input.hasCompletedOnboarding,
        DEFAULT_SETTINGS.hasCompletedOnboarding
      ),
    };
  }

  // ── VALIDACIÓN ───────────────────────────────────────────

  private validateSettings(
    settings: UserSettings
  ): void {
    if (!Number.isFinite(settings.hourlyRate)) {
      throw new Error(
        'La tarifa por hora debe ser un número válido.'
      );
    }

    if (settings.hourlyRate <= 0) {
      throw new Error(
        'La tarifa por hora debe ser mayor que cero.'
      );
    }

    if (
      settings.reportEmail &&
      !this.isValidEmail(settings.reportEmail)
    ) {
      throw new Error(
        'El correo electrónico de reportes no tiene un formato válido.'
      );
    }

    if (!this.isValidTime(settings.baseWorkHour)) {
      throw new Error(
        'La hora base debe utilizar el formato HH:MM entre 00:00 y 23:59.'
      );
    }

    if (
      !Number.isFinite(settings.overtimeMultiplier) ||
      settings.overtimeMultiplier < 1
    ) {
      throw new Error(
        'El multiplicador de horas extra debe ser mayor o igual que 1.'
      );
    }

    if (
      !Number.isInteger(
        settings.lunchDiscountMinutes
      ) ||
      settings.lunchDiscountMinutes < 0
    ) {
      throw new Error(
        'El descuento de almuerzo debe ser un entero mayor o igual que cero.'
      );
    }

    if (
      !Number.isInteger(settings.geofenceRadius) ||
      settings.geofenceRadius <
        MINIMUM_GEOFENCE_RADIUS_METERS
    ) {
      throw new Error(
        `El radio de geocerca debe ser un entero de al menos ` +
          `${MINIMUM_GEOFENCE_RADIUS_METERS} metros.`
      );
    }

    if (
      !Number.isInteger(settings.destinationLimit) ||
      settings.destinationLimit <= 0
    ) {
      throw new Error(
        'El límite diario de destinos debe ser un entero mayor que cero.'
      );
    }

    if (
      settings.language !== 'es' &&
      settings.language !== 'en'
    ) {
      throw new Error(
        'El idioma debe ser "es" o "en".'
      );
    }

    this.assertBoolean(
      settings.dailyReminder,
      'dailyReminder'
    );

    this.assertBoolean(
      settings.workdayAlerts,
      'workdayAlerts'
    );

    this.assertBoolean(
      settings.reportReady,
      'reportReady'
    );

    this.assertBoolean(
      settings.multiDestination,
      'multiDestination'
    );

    this.assertBoolean(
      settings.paidTransfers,
      'paidTransfers'
    );

    this.assertBoolean(
      settings.hasCompletedOnboarding,
      'hasCompletedOnboarding'
    );
  }

  private assertBoolean(
    value: unknown,
    fieldName: string
  ): asserts value is boolean {
    if (typeof value !== 'boolean') {
      throw new Error(
        `La propiedad ${fieldName} debe ser booleana.`
      );
    }
  }

  private isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private isValidEmail(value: string): boolean {
    // Validación práctica para impedir espacios, múltiples @ y
    // dominios sin una extensión básica.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  // ── CONVERSIONES ─────────────────────────────────────────

  private booleanToSQLite(value: boolean): 0 | 1 {
    return value ? 1 : 0;
  }

  private toBoolean(
    value: unknown,
    fallback: boolean
  ): boolean {
    const storedValue = value as StoredBoolean;

    if (
      storedValue === true ||
      storedValue === 1 ||
      storedValue === '1'
    ) {
      return true;
    }

    if (
      storedValue === false ||
      storedValue === 0 ||
      storedValue === '0'
    ) {
      return false;
    }

    return fallback;
  }

  private toFiniteNumber(
    value: unknown,
    fallback: number
  ): number {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return fallback;
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue)
      ? numericValue
      : fallback;
  }

  private toInteger(
    value: unknown,
    fallback: number
  ): number {
    const numericValue = this.toFiniteNumber(
      value,
      fallback
    );

    return Number.isInteger(numericValue)
      ? numericValue
      : fallback;
  }

  private toTrimmedString(
    value: unknown,
    fallback: string
  ): string {
    return typeof value === 'string'
      ? value.trim()
      : fallback;
  }

  private isRecord(
    value: unknown
  ): value is PersistedSettingsInput {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  // ── COPIAS DEFENSIVAS ────────────────────────────────────

  private cloneDefaultSettings(): UserSettings {
    return { ...DEFAULT_SETTINGS };
  }

  private cloneSettings(
    settings: Readonly<UserSettings>
  ): UserSettings {
    return { ...settings };
  }
}

export const settingsService = new SettingsService();

