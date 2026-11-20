import { create } from "zustand";
import {
  sessionEngineService,
  geofenceService,
  settingsService,
} from "@/services";
import {
  DatabaseService,
  sessionRepository,
} from "@/services/database/DatabaseService";
import type { Session, SessionState } from "@/types/contracts";

export interface SystemHealthMetrics {
  locationPermission: string;
  backgroundTask: string;
  geofenceActive: string;
  dbIntegrity: string;
  lastSync: string;
}

export interface HistoryFilters {
  search: string;
  startDate: string | null;
  endDate: string | null;
}

interface SessionStore {
  activeSession: Session | null;
  sessionState: SessionState;
  elapsedTime: string;
  systemHealth: SystemHealthMetrics;

  isInitialized: boolean;
  hasCompletedOnboarding: boolean;

  todaySessions: Session[];
  sessions: Session[];
  isLoadingSessions: boolean;
  historyFilters: HistoryFilters;

  initialize: () => Promise<void>;
  validateForegroundExit: () => Promise<void>;
  completeOnboarding: () => Promise<void>;

  startSession: (destination: string, alias?: string) => Promise<void>;
  confirmArrival: () => Promise<void>;
  startTransfer: (destination: string, alias?: string) => Promise<void>;
  cancelTransfer: () => Promise<void>;
  startLunch: () => Promise<void>;
  endLunch: () => Promise<void>;
  finishWorkDay: (lunchDeductedMinutes: number) => Promise<void>;
  confirmExit: () => Promise<void>;
  stayWorking: () => Promise<void>;
  cancelSession: () => Promise<void>;

  loadTodaySessions: () => Promise<void>;
  loadSessions: () => Promise<void>;
  setHistoryFilters: (filters: Partial<HistoryFilters>) => void;
  deleteSession: (id: string) => Promise<void>;
  editSession: (id: string, updates: Partial<Session>) => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => {
  let timerInterval: NodeJS.Timeout | null = null;

  const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const { activeSession, sessionState } = get();
      if (!activeSession) return set({ elapsedTime: "00:00:00" });

      if (
        sessionState === "NO_INICIADA" ||
        sessionState === "ESPERANDO" ||
        sessionState === "CERRADA"
      ) {
        return set({ elapsedTime: "00:00:00" });
      }

      let diff = Date.now() - new Date(activeSession.startTime).getTime();

      // Temporizador para auto-checkout (Foreground 15 min)
      if (sessionState === "SALIDA") {
        const exitTime = new Date(
          activeSession.updatedAt || Date.now(),
        ).getTime();
        if (Date.now() - exitTime >= 15 * 60 * 1000) {
          void sessionEngineService.evaluatePendingExits();
        }
      }

      if (sessionState === "PAUSADA") {
        const currentBreak = activeSession.breaks?.find((b) => !b.endTime);
        if (currentBreak)
          diff = Date.now() - new Date(currentBreak.startTime).getTime();
      } else if (sessionState === "TRASLADO") {
        const currentTransfer = activeSession.transfers?.find(
          (t) => !t.endTime,
        );
        if (currentTransfer)
          diff = Date.now() - new Date(currentTransfer.startTime).getTime();
      }

      if (diff < 0) diff = 0;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      set({
        elapsedTime: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
      });
    }, 1000);
  };

  const syncHealth = async () => {
    const activeSession = get().activeSession;
    if (
      !activeSession ||
      activeSession.state === "NO_INICIADA" ||
      activeSession.state === "CERRADA"
    ) {
      return set({
        systemHealth: {
          locationPermission: "OK",
          backgroundTask: "OK",
          geofenceActive: "NOT_REQUIRED",
          dbIntegrity: "OK",
          lastSync: new Date().toISOString(),
        },
      });
    }

    const perm = await geofenceService.getPermissionStatus();
    set({
      systemHealth: {
        locationPermission: perm === "GRANTED" ? "OK" : "ERROR",
        backgroundTask: perm === "GRANTED" ? "OK" : "ERROR",
        geofenceActive: activeSession.state === "ACTIVA" ? "OK" : "WARNING",
        dbIntegrity: "OK",
        lastSync: new Date().toISOString(),
      },
    });
  };

  return {
    activeSession: null,
    sessionState: "NO_INICIADA",
    elapsedTime: "00:00:00",
    systemHealth: {
      locationPermission: "OK",
      backgroundTask: "OK",
      geofenceActive: "NOT_REQUIRED",
      dbIntegrity: "OK",
      lastSync: new Date().toISOString(),
    },
    isInitialized: false,
    hasCompletedOnboarding: false,

    todaySessions: [],
    sessions: [],
    isLoadingSessions: false,
    historyFilters: { search: "", startDate: null, endDate: null },

    initialize: async () => {
      try {
        await DatabaseService.initialize();
        await sessionEngineService.evaluatePendingExits();

        const settings = await settingsService.load();
        set({
          hasCompletedOnboarding: settings.hasCompletedOnboarding || false,
        });

        sessionEngineService.subscribe(async (session) => {
          set({
            activeSession: session,
            sessionState: session?.state || "NO_INICIADA",
          });
          await syncHealth();
          await get().loadTodaySessions();
        });
        startTimer();
        await get().loadTodaySessions();
        set({ isInitialized: true });
      } catch (error) {
        console.error("Store Init Error:", error);
      }
    },

    completeOnboarding: async () => {
      try {
        const settings = await settingsService.load();
        await settingsService.save({
          ...settings,
          hasCompletedOnboarding: true,
        });
        set({ hasCompletedOnboarding: true });
      } catch (error) {
        console.error("Error completando onboarding:", error);
      }
    },

    validateForegroundExit: async () => {},

    startSession: async (dest, alias) =>
      await sessionEngineService.startSession(dest, alias),
    confirmArrival: async () => await sessionEngineService.confirmArrival(),
    startTransfer: async (dest, alias) =>
      await sessionEngineService.startTransfer(dest, alias),
    cancelTransfer: async () => await sessionEngineService.cancelTransfer(),
    startLunch: async () => await sessionEngineService.startLunch(),
    endLunch: async () => await sessionEngineService.endLunch(),
    finishWorkDay: async (mins) =>
      await sessionEngineService.finishWorkDay(mins),
    confirmExit: async () => await sessionEngineService.confirmExit(),
    stayWorking: async () => await sessionEngineService.stayWorking(),
    cancelSession: async () => await sessionEngineService.cancelSession(),

    loadTodaySessions: async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const docs = await sessionRepository.getByFilters("", today, today);
        const sorted = docs.sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );
        set({ todaySessions: sorted });
      } catch (error) {
        console.error("Error cargando sesiones de hoy:", error);
      }
    },

    loadSessions: async () => {
      set({ isLoadingSessions: true });
      try {
        const { historyFilters } = get();
        const docs = await sessionRepository.getByFilters(
          historyFilters.search,
          historyFilters.startDate || undefined,
          historyFilters.endDate || undefined,
        );
        set({ sessions: docs });
      } catch (error) {
        console.error("Error cargando historial:", error);
      } finally {
        set({ isLoadingSessions: false });
      }
    },

    setHistoryFilters: (filters) => {
      set((state) => ({
        historyFilters: { ...state.historyFilters, ...filters },
      }));
      get().loadSessions();
    },

    deleteSession: async (id: string) => {
      try {
        await sessionRepository.delete(id);
        get().loadSessions();
        get().loadTodaySessions();
      } catch (error) {
        console.error("Error borrando sesión:", error);
      }
    },

    editSession: async (id: string, updates: Partial<Session>) => {
      try {
        await sessionRepository.update(id, updates);
        get().loadSessions();
        get().loadTodaySessions();
      } catch (error) {
        console.error("Error editando sesión:", error);
      }
    },
  };
});
