import { settingsService } from "./SettingsService";
import type { UserSettings } from "@/types/contracts";

const mockDb = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};

jest.mock("../database/DatabaseService", () => ({
  DatabaseService: {
    getDb: jest.fn(() => mockDb),
  },
}));

describe("SettingsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settingsService.clearCache(); // Limpiamos caché entre tests
  });

  it("debe retornar configuraciones por defecto si la base de datos está vacía", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null); // No hay datos relacionales
    mockDb.getFirstAsync.mockResolvedValueOnce(null); // No hay datos legacy

    const settings = await settingsService.load();
    expect(settings.hourlyRate).toBe(20);
    expect(settings.geofenceRadius).toBe(100);
  });

  it("debe parsear correctamente los enteros de SQLite a Booleanos y valores numéricos", async () => {
    // Entregamos un objeto row con snake_case tal como lo pide mapFromDatabase
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: "user_settings",
      name: "Byron",
      report_email: "byron@test.com",
      base_work_hour: "06:00",
      hourly_rate: 35,
      overtime_multiplier: 1.5,
      lunch_discount_minutes: 30,
      geofence_radius: 200,
      daily_reminder: 1, // true en SQLite
      workday_alerts: 1,
      report_ready: 1,
      language: "es",
      allow_multi_destination: 0, // false en SQLite
      pay_transfer_time: 1, // true en SQLite
      destination_limit: 5,
      has_completed_onboarding: 1,
      updated_at: "2026-08-27T10:00:00.000Z",
    });

    const settings = await settingsService.load();
    expect(settings.hourlyRate).toBe(35);
    expect(settings.geofenceRadius).toBe(200);
    expect(settings.dailyReminder).toBe(true);
    expect(settings.allowMultiDestination).toBe(false);
    expect(settings.payTransferTime).toBe(true);
  });

  it("al guardar, debe sanitizar textos y traducir booleanos a 1/0", async () => {
    mockDb.runAsync.mockResolvedValue(undefined);

    // CORRECCIÓN: Tipado estricto con UserSettings en lugar de any
    const fullSettings: UserSettings = {
      name: "  Byron   ",
      reportEmail: " BYRON@TEST.COM ",
      baseWorkHour: "08:00",
      hourlyRate: 30,
      overtimeMultiplier: 2,
      lunchDiscountMinutes: 45,
      geofenceRadius: 150,
      dailyReminder: true,
      workdayAlerts: true,
      reportReady: true,
      language: "es",
      currency: "USD",
      allowMultiDestination: false,
      payTransferTime: true,
      destinationLimit: 5,
      hasCompletedOnboarding: true,
      adminPin: null,
    };

    await settingsService.save(fullSettings);

    // Verificamos el UPSERT con el formato exacto que tu servicio ejecuta
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(id) DO UPDATE"),
      expect.arrayContaining([
        "Byron", // Trim aplicado
        "byron@test.com", // Trim y lowerCase aplicados
        30, // hourlyRate numérico
        1, // dailyReminder convertido a 1
        0, // allowMultiDestination convertido a 0
      ]),
    );
  });
});
