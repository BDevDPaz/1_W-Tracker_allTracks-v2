import { PALETTE } from "../theme/tokens";
import type { Session } from "../types/contracts";
import { getUIState, buildTimeline } from "./uiMapper";

describe("UI Mapper Utils", () => {
  describe("getUIState", () => {
    it("debe mapear el estado ACTIVA con el color y acciones correctas", () => {
      const uiConfig = getUIState("ACTIVA");

      expect(uiConfig.name).toBe("ACTIVA");
      expect(uiConfig.theme.bgColor).toBe(PALETTE.successGreenBg);
      expect(uiConfig.copy.title).toBe("Jornada activa");
      expect(uiConfig.actions.primary?.actionKey).toBe("FINISH_SESSION");
    });

    it("debe mapear el estado PAUSADA (Almuerzo) sin opciones secundarias", () => {
      const uiConfig = getUIState("PAUSADA");

      expect(uiConfig.theme.icon).toBe("coffee");
      expect(uiConfig.actions.primary?.actionKey).toBe("FINISH_LUNCH");
      expect(uiConfig.actions.secondary.length).toBe(0);
    });

    it("debe mapear el estado CERRADA ocultando el temporizador", () => {
      const uiConfig = getUIState("CERRADA");

      expect(uiConfig.theme.bgColor).toBe(PALETTE.slateBlueBg);
      expect(uiConfig.visibility.showTimer).toBe(false);
      expect(uiConfig.actions.primary?.actionKey).toBe("REVIEW_JOURNEY");
    });
  });

  describe("buildTimeline", () => {
    it("debe crear los eventos base (configuración y llegada) para una sesión ACTIVA", () => {
      const mockSession = {
        id: "1",
        state: "ACTIVA",
        createdAt: "2026-08-27T08:00:00.000Z",
        startTime: "2026-08-27T08:15:00.000Z",
        destination: "Sede Principal",
        transfers: [],
        breaks: [],
      } as unknown as Session; // Usamos un casteo para no tener que llenar todas las propiedades

      const timeline = buildTimeline(mockSession);

      expect(timeline.length).toBe(2);
      expect(timeline[0]!.id).toBe("start");
      expect(timeline[0]!.title).toBe("Jornada configurada");
      expect(timeline[1]!.id).toBe("arrival");
      expect(timeline[1]!.title).toBe("Llegada al destino");
    });

    it("debe agregar eventos de Traslado a la línea de tiempo", () => {
      const mockSession = {
        id: "2",
        state: "TRASLADO",
        createdAt: "2026-08-27T08:00:00.000Z",
        startTime: "2026-08-27T08:00:00.000Z",
        destination: "Sede A",
        transfers: [
          {
            startTime: "2026-08-27T10:00:00.000Z",
            targetDestination: "Sede B",
          },
        ],
        breaks: [],
      } as unknown as Session;

      const timeline = buildTimeline(mockSession);

      // Debe tener inicio, llegada, y el traslado
      expect(timeline.length).toBe(3);
      expect(timeline[2]!.id).toBe("transfer_start_0");
      expect(timeline[2]!.title).toBe("Traslado iniciado");
    });
  });
});
