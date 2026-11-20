import {
  DatabaseService,
  sessionRepository,
} from "../database/DatabaseService";
import { sessionEngineService } from "./SessionEngineService";

// 1. Creamos una ÚNICA instancia del objeto mock para no perder la referencia.
// El prefijo "mock" es obligatorio para que Jest permita usar la variable dentro de jest.mock()
const mockDb = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
  getAllAsync: jest.fn(),
};

// 2. Mockeamos el servicio y aseguramos que getDb siempre devuelva la misma referencia
jest.mock("../database/DatabaseService", () => ({
  DatabaseService: {
    getDb: jest.fn(() => mockDb),
  },
  sessionRepository: {
    getActive: jest.fn(),
  },
}));

// Mockeamos la Geocerca para evitar llamadas nativas en las pruebas
jest.mock("../geofence/GeofenceService", () => ({
  geofenceService: {
    register: jest.fn(),
    unregister: jest.fn(),
  },
}));

jest.mock("../settings/SettingsService", () => ({
  settingsService: {
    load: jest.fn(() =>
      Promise.resolve({
        hourlyRate: 25,
        geofenceRadius: 100,
      }),
    ),
  },
}));

describe("SessionEngineService (Máquina de Estados)", () => {
  beforeEach(() => {
    // Limpiamos los contadores antes de cada prueba
    jest.clearAllMocks();
  });

  it("debe permitir iniciar una sesión si no existe una activa", async () => {
    // Simulamos que NO hay sesión activa en la base de datos
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    mockDb.runAsync.mockResolvedValue(undefined);

    // Evitamos errores secundarios al notificar estado a la UI
    (sessionRepository.getActive as jest.Mock).mockResolvedValueOnce(null);

    await sessionEngineService.startSession("123 Main St", "Casa Principal");

    // Ahora SÍ detectará la llamada exacta al objeto mockDb unificado
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sessions"),
      expect.any(Array),
    );
  });

  it("debe rechazar iniciar una sesión si ya existe una activa", async () => {
    // Simulamos que SÍ hay sesión activa en la BD
    mockDb.getFirstAsync.mockResolvedValueOnce({ id: "existing-session-id" });

    // Esperamos que la promesa sea rechazada con el mensaje exacto
    await expect(
      sessionEngineService.startSession("456 Market St"),
    ).rejects.toThrow("Ya existe una sesión activa.");
  });

  it("debe cambiar el estado a PAUSADA al iniciar una pausa / fuera de servicio", async () => {
    // Simulamos que hay una sesión ACTIVA
    mockDb.getFirstAsync.mockResolvedValueOnce({ id: "active-session-id" });
    mockDb.runAsync.mockResolvedValue(undefined);
    (sessionRepository.getActive as jest.Mock).mockResolvedValueOnce(null);

    await sessionEngineService.startLunch();

    // Verificamos que guardó el registro del break (Pausa)
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO breaks"),
      expect.any(Array),
    );
    // Verificamos que actualizó el estado de la sesión
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE sessions SET state = 'PAUSADA'"),
      expect.any(Array),
    );
  });
});
