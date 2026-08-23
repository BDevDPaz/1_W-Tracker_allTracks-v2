// ============================================================
// STORE: sessionStore — Estado global reactivo Zustand V2.2
// Ruta: src/stores/sessionStore.ts
// Versión: 2.2.0 (Workday Tracking Store)
//
// Responsabilidades:
// - Inicializar SQLite, configuración y motor de jornadas.
// - Rehidratar una jornada interrumpida.
// - Proyectar el estado canónico del motor hacia la UI.
// - Mantener relaciones multi-destino.
// - Calcular el tiempo transcurrido para presentación.
// - Gestionar onboarding, historial y salud del sistema.
// - Centralizar notificaciones y errores de operaciones.
// - Liberar suscripciones y temporizadores.
//
// Flujo:
// DatabaseService
//   → SettingsService
//   → SessionEngineService
//   → Zustand Store
//   → UI
//
// IMPORTANTE:
// SessionEngineService ya está suscrito a GeofenceService.
// Este store no vuelve a suscribirse para evitar procesar
// dos veces cada evento ENTER o EXIT.
// ============================================================

import { create } from 'zustand';

import type {
  Break,
  DestinationVisit,
  Session,
  SessionState,
  SystemHealth,
  Transfer,
} from '../types';

import {
  DatabaseService,
  geofenceService,
  sessionEngine,
  sessionRepository,
  settingsService,
  ToastService,
} from '../services';

// ── RECURSOS DEL MÓDULO ─────────────────────────────────────

let engineUnsubscribe: (() => void) | null = null;

let initializationPromise: Promise<void> | null = null;

let sessionClockInterval:
  | ReturnType<typeof setInterval>
  | null = null;

let sessionsLoadPromise: Promise<void> | null = null;

// ── TIPOS AUXILIARES ────────────────────────────────────────

export type PendingToastType =
  | 'success'
  | 'info'
  | 'warning'
  | 'error';

export interface PendingToast {
  type: PendingToastType;
  text: string;
}

interface SessionStoreState {
  // ── Inicialización ────────────────────────────────────────

  isInitialized: boolean;
  isInitializing: boolean;
  initializationError: string | null;

  // ── Onboarding ────────────────────────────────────────────

  hasCompletedOnboarding: boolean;

  // ── Jornada activa ────────────────────────────────────────

  sessionState: SessionState;
  activeSession: Session | null;

  /**
   * Tiempo transcurrido presentado como HH:MM:SS.
   */
  elapsedTime: string;

  currentDestination: string | null;
  visitedDestinations: DestinationVisit[];
  transfers: Transfer[];
  breaks: Break[];

  // ── Historial ─────────────────────────────────────────────

  sessions: Session[];
  isLoadingSessions: boolean;

  // ── Infraestructura ───────────────────────────────────────

  systemHealth: SystemHealth;
  pendingToast: PendingToast | null;
}

interface SessionStoreActions {
  // ── Inicialización ────────────────────────────────────────

  initialize: () => Promise<void>;
  dispose: () => void;
  syncWithEngine: () => void;

  // ── Onboarding ────────────────────────────────────────────

  completeOnboarding: () => Promise<void>;

  // ── Jornada principal ─────────────────────────────────────

  startSession: (
    destination: string,
    alias?: string
  ) => Promise<void>;

  confirmArrival: () => Promise<void>;

  startLunch: () => Promise<void>;
  endLunch: () => Promise<void>;

  startTransfer: (
    destination: string,
    alias?: string
  ) => Promise<void>;

  completeTransfer: () => Promise<void>;

  closeCurrentDestination: () => Promise<void>;

  finishWorkDay: (
    lunchMinutes: number
  ) => Promise<void>;

  /**
   * Alias de compatibilidad.
   */
  closeSession: (
    lunchDiscountMinutes: number
  ) => Promise<void>;

  confirmExit: () => Promise<void>;
  stayWorking: () => void;

  cancelSession: () => Promise<void>;

  addNote: (
    note: string
  ) => Promise<void>;

  validateForegroundExit: () => Promise<void>;

  // ── Historial ─────────────────────────────────────────────

  loadSessions: (
    silent?: boolean
  ) => Promise<void>;

  deleteSession: (
    id: string
  ) => Promise<void>;

  editSession: (
    id: string,
    patch: Partial<Session>
  ) => Promise<void>;

  // ── Salud y notificaciones ────────────────────────────────

  refreshSystemHealth: () => Promise<void>;

  updateSystemHealth: (
    health: Partial<SystemHealth>
  ) => void;

  setPendingToast: (
    toast: PendingToast | null
  ) => void;

  clearPendingToast: () => void;
}

export type SessionStore =
  SessionStoreState & SessionStoreActions;

// ── ESTADO INICIAL ──────────────────────────────────────────

const INITIAL_HEALTH: Readonly<SystemHealth> =
  Object.freeze({
    locationPermission: 'WARNING',
    backgroundLocation: 'WARNING',
    geofenceActive: 'WARNING',
    notificationsReady: 'OK',
    storageIntegrity: 'WARNING',
    lastValidationMinutes: 0,
  });

const INITIAL_STORE_STATE: SessionStoreState = {
  isInitialized: false,
  isInitializing: false,
  initializationError: null,

  hasCompletedOnboarding: false,

  sessionState: 'NO_INICIADA',
  activeSession: null,
  elapsedTime: '00:00:00',

  currentDestination: null,
  visitedDestinations: [],
  transfers: [],
  breaks: [],

  sessions: [],
  isLoadingSessions: false,

  systemHealth: {
    ...INITIAL_HEALTH,
  },

  pendingToast: null,
};

// ── HELPERS PUROS ───────────────────────────────────────────

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (
    error instanceof Error &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return fallback;
}

function cloneSession(
  session: Session | null
): Session | null {
  if (!session) {
    return null;
  }

  return {
    ...session,

    timelineEvents:
      session.timelineEvents?.map((event) => ({
        ...event,
      })) ?? [],

    visits:
      session.visits?.map((visit) => ({
        ...visit,
      })) ?? [],

    transfers:
      session.transfers?.map((transfer) => ({
        ...transfer,
      })) ?? [],

    breaks:
      session.breaks?.map((workBreak) => ({
        ...workBreak,
      })) ?? [],
  };
}

function createSessionStatePatch(
  state: SessionState,
  session: Session | null
): Pick<
  SessionStoreState,
  | 'sessionState'
  | 'activeSession'
  | 'currentDestination'
  | 'visitedDestinations'
  | 'transfers'
  | 'breaks'
  | 'elapsedTime'
> {
  const clonedSession = cloneSession(session);

  return {
    sessionState: state,

    activeSession: clonedSession,

    currentDestination:
      clonedSession?.destination ?? null,

    visitedDestinations:
      clonedSession?.visits ?? [],

    transfers:
      clonedSession?.transfers ?? [],

    breaks:
      clonedSession?.breaks ?? [],

    elapsedTime:
      clonedSession
        ? calculateElapsedTime(clonedSession)
        : '00:00:00',
  };
}

function calculateElapsedTime(
  session: Session,
  now = new Date()
): string {
  if (
    session.state === 'NO_INICIADA' ||
    session.state === 'ESPERANDO'
  ) {
    return '00:00:00';
  }

  const startTimestamp =
    resolveSessionTimestamp(
      session.date,
      session.startTime
    );

  if (startTimestamp === null) {
    return '00:00:00';
  }

  let endTimestamp: number;

  if (
    session.state === 'CERRADA' &&
    session.endTime
  ) {
    endTimestamp =
      resolveSessionTimestamp(
        session.date,
        session.endTime
      ) ?? now.getTime();

    if (endTimestamp < startTimestamp) {
      endTimestamp += 24 * 60 * 60 * 1000;
    }
  } else {
    endTimestamp = now.getTime();

    if (endTimestamp < startTimestamp) {
      return '00:00:00';
    }
  }

  const elapsedMilliseconds = Math.max(
    0,
    endTimestamp - startTimestamp
  );

  const totalSeconds = Math.floor(
    elapsedMilliseconds / 1000
  );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

function resolveSessionTimestamp(
  date: string,
  time: string
): number | null {
  if (!date || !time) {
    return null;
  }

  if (time.includes('T')) {
    const timestamp = Date.parse(time);

    return Number.isFinite(timestamp)
      ? timestamp
      : null;
  }

  const matchedTime =
    /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(
      time
    );

  if (!matchedTime) {
    return null;
  }

  const matchedDate =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!matchedDate) {
    return null;
  }

  const year = Number(matchedDate[1]);
  const month = Number(matchedDate[2]) - 1;
  const day = Number(matchedDate[3]);

  const hours = Number(matchedTime[1]);
  const minutes = Number(matchedTime[2]);
  const seconds = Number(
    matchedTime[3] ?? 0
  );

  return new Date(
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    0
  ).getTime();
}

function normalizeIdentifier(
  value: string,
  fieldName: string
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(
      `${fieldName} no puede estar vacío.`
    );
  }

  return normalized;
}

function startSessionClock(): void {
  if (sessionClockInterval) {
    return;
  }

  sessionClockInterval = setInterval(() => {
    const store = useSessionStore.getState();
    const session = store.activeSession;

    if (!session) {
      if (store.elapsedTime !== '00:00:00') {
        useSessionStore.setState({
          elapsedTime: '00:00:00',
        });
      }

      return;
    }

    const elapsedTime =
      calculateElapsedTime(session);

    if (elapsedTime !== store.elapsedTime) {
      useSessionStore.setState({
        elapsedTime,
      });
    }
  }, 1000);
}

function stopSessionClock(): void {
  if (!sessionClockInterval) {
    return;
  }

  clearInterval(sessionClockInterval);
  sessionClockInterval = null;
}

function pushToast(
  toast: PendingToast
): void {
  ToastService.push(toast);

  useSessionStore.setState({
    pendingToast: toast,
  });
}

// ── STORE ───────────────────────────────────────────────────

export const useSessionStore =
  create<SessionStore>()((set, get) => ({
    ...INITIAL_STORE_STATE,

    // ════════════════════════════════════════════════════════
    // INICIALIZACIÓN
    // ════════════════════════════════════════════════════════

    initialize: async () => {
      if (get().isInitialized) {
        get().syncWithEngine();
        return;
      }

      if (initializationPromise) {
        return initializationPromise;
      }

      initializationPromise = (async () => {
        set({
          isInitializing: true,
          initializationError: null,
        });

        try {
          /*
           * El orden es importante:
           *
           * 1. Inicializar SQLite.
           * 2. Cargar configuración real.
           * 3. Conectar el observer del motor.
           * 4. Rehidratar una jornada persistida.
           * 5. Cargar el historial.
           */
          await DatabaseService.initialize();

          const settings =
            await settingsService.load();

          if (!engineUnsubscribe) {
            engineUnsubscribe =
              sessionEngine.subscribe(
                (
                  state: SessionState,
                  session: Session | null
                ) => {
                  set(
                    createSessionStatePatch(
                      state,
                      session
                    )
                  );
                }
              );
          }

          const rehydrationResult =
            await sessionEngine.rehydrateFromWAL();

          set({
            hasCompletedOnboarding:
              settings.hasCompletedOnboarding,

            systemHealth: {
              ...get().systemHealth,
              storageIntegrity: 'OK',
            },
          });

          get().syncWithEngine();

          await Promise.all([
            get().loadSessions(true),
            get().refreshSystemHealth(),
          ]);

          startSessionClock();

          set({
            isInitialized: true,
            isInitializing: false,
            initializationError: null,
          });

          if (
            rehydrationResult === 'RECOVERED'
          ) {
            pushToast({
              type: 'info',
              text:
                'La jornada activa fue recuperada ' +
                'correctamente.',
            });
          }

          if (
            rehydrationResult === 'CONFLICT'
          ) {
            pushToast({
              type: 'warning',
              text:
                'La jornada fue recuperada con ' +
                'inconsistencias que deben revisarse.',
            });
          }
        } catch (error) {
          const message = getErrorMessage(
            error,
            'No se pudo inicializar la aplicación.'
          );

          console.error(
            '[SessionStore Initialization Error]',
            error
          );

          engineUnsubscribe?.();
          engineUnsubscribe = null;

          stopSessionClock();

          set({
            isInitialized: false,
            isInitializing: false,
            initializationError: message,

            systemHealth: {
              ...get().systemHealth,
              storageIntegrity: 'ERROR',
            },
          });

          pushToast({
            type: 'error',
            text: message,
          });

          throw error;
        } finally {
          initializationPromise = null;
        }
      })();

      return initializationPromise;
    },

    dispose: () => {
      engineUnsubscribe?.();
      engineUnsubscribe = null;

      initializationPromise = null;
      sessionsLoadPromise = null;

      stopSessionClock();

      set({
        ...INITIAL_STORE_STATE,
        systemHealth: {
          ...INITIAL_HEALTH,
        },
      });
    },

    syncWithEngine: () => {
      const session =
        sessionEngine.getActiveSession();

      const state =
        sessionEngine.getCurrentState();

      set(
        createSessionStatePatch(
          state,
          session
        )
      );
    },

    // ════════════════════════════════════════════════════════
    // ONBOARDING
    // ════════════════════════════════════════════════════════

    completeOnboarding: async () => {
      try {
        const currentSettings =
          await settingsService.load();

        await settingsService.save({
          ...currentSettings,
          hasCompletedOnboarding: true,
        });

        set({
          hasCompletedOnboarding: true,
        });
      } catch (error) {
        console.error(
          '[SessionStore Complete Onboarding Error]',
          error
        );

        pushToast({
          type: 'error',
          text:
            'No se pudo guardar el estado ' +
            'del proceso de configuración.',
        });

        throw error;
      }
    },

    // ════════════════════════════════════════════════════════
    // JORNADA
    // ════════════════════════════════════════════════════════

    startSession: async (
      destination,
      alias
    ) => {
      try {
        const normalizedDestination =
          normalizeIdentifier(
            destination,
            'El destino'
          );

        const normalizedAlias =
          alias?.trim() || undefined;

        await sessionEngine.startSession({
          destination: normalizedDestination,
          alias: normalizedAlias,
        });

        get().syncWithEngine();
        await get().loadSessions(true);
        await get().refreshSystemHealth();

        pushToast({
          type: 'success',
          text: 'Jornada configurada correctamente.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Start Session Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo iniciar la jornada.'
          ),
        });

        throw error;
      }
    },

    confirmArrival: async () => {
      try {
        await sessionEngine.confirmArrival();

        get().syncWithEngine();
        await get().loadSessions(true);

        pushToast({
          type: 'success',
          text: 'Llegada al destino confirmada.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Confirm Arrival Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo confirmar la llegada.'
          ),
        });

        throw error;
      }
    },

    startLunch: async () => {
      try {
        await sessionEngine.startLunch();

        get().syncWithEngine();
        await get().loadSessions(true);

        pushToast({
          type: 'info',
          text: 'Pausa iniciada.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Start Lunch Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo iniciar la pausa.'
          ),
        });

        throw error;
      }
    },

    endLunch: async () => {
      try {
        await sessionEngine.endLunch();

        get().syncWithEngine();
        await get().loadSessions(true);

        pushToast({
          type: 'success',
          text: 'Jornada reanudada.',
        });
      } catch (error) {
        console.error(
          '[SessionStore End Lunch Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo terminar la pausa.'
          ),
        });

        throw error;
      }
    },

    startTransfer: async (
      destination,
      alias
    ) => {
      try {
        const normalizedDestination =
          normalizeIdentifier(
            destination,
            'El próximo destino'
          );

        const normalizedAlias =
          alias?.trim() || undefined;

        /*
         * addDestination aplica la política completa:
         * multiDestination y destinationLimit.
         */
        await sessionEngine.addDestination(
          normalizedDestination,
          normalizedAlias
        );

        get().syncWithEngine();
        await get().loadSessions(true);
        await get().refreshSystemHealth();

        pushToast({
          type: 'info',
          text:
            `Traslado iniciado hacia ${
              normalizedAlias ??
              normalizedDestination
            }.`,
        });
      } catch (error) {
        console.error(
          '[SessionStore Start Transfer Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo iniciar el traslado.'
          ),
        });

        throw error;
      }
    },

    completeTransfer: async () => {
      try {
        await sessionEngine.completeTransfer();

        get().syncWithEngine();
        await get().loadSessions(true);

        pushToast({
          type: 'success',
          text:
            'Llegada al nuevo destino registrada.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Complete Transfer Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo completar el traslado.'
          ),
        });

        throw error;
      }
    },

    closeCurrentDestination: async () => {
      try {
        await sessionEngine.closeCurrentDestination();

        get().syncWithEngine();
        await get().loadSessions(true);

        pushToast({
          type: 'info',
          text: 'Destino actual finalizado.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Close Destination Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo finalizar el destino.'
          ),
        });

        throw error;
      }
    },

    finishWorkDay: async (
      lunchMinutes
    ) => {
      try {
        if (
          !Number.isInteger(lunchMinutes) ||
          lunchMinutes < 0
        ) {
          throw new Error(
            'El descuento de almuerzo debe ser ' +
              'un entero mayor o igual que cero.'
          );
        }

        /*
         * El motor consolida la sesión, persiste las
         * relaciones y elimina la geocerca.
         */
        await sessionEngine.finishWorkDay(
          lunchMinutes
        );

        get().syncWithEngine();
        await get().loadSessions(true);
        await get().refreshSystemHealth();

        pushToast({
          type: 'success',
          text:
            'Jornada finalizada y consolidada ' +
            'correctamente.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Finish Workday Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo finalizar la jornada.'
          ),
        });

        throw error;
      }
    },

    closeSession: async (
      lunchDiscountMinutes
    ) => {
      await get().finishWorkDay(
        lunchDiscountMinutes
      );
    },

    confirmExit: async () => {
      try {
        await sessionEngine.confirmExit();

        get().syncWithEngine();
        await get().loadSessions(true);
        await get().refreshSystemHealth();

        pushToast({
          type: 'success',
          text: 'Jornada cerrada correctamente.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Confirm Exit Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo confirmar el cierre.'
          ),
        });

        throw error;
      }
    },

    stayWorking: () => {
      try {
        sessionEngine.resumeFromExit();
        get().syncWithEngine();

        pushToast({
          type: 'info',
          text: 'Jornada reanudada.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Stay Working Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo reanudar la jornada.'
          ),
        });
      }
    },

    cancelSession: async () => {
      try {
        /*
         * cancelSession elimina la sesión, su geocerca
         * y sus relaciones. No debe delegar en closeSession.
         */
        await sessionEngine.cancelSession();

        get().syncWithEngine();
        await get().loadSessions(true);
        await get().refreshSystemHealth();

        pushToast({
          type: 'info',
          text: 'Jornada cancelada.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Cancel Session Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo cancelar la jornada.'
          ),
        });

        throw error;
      }
    },

    addNote: async (note) => {
      try {
        await sessionEngine.addNote(
          note.trim()
        );

        get().syncWithEngine();
        await get().loadSessions(true);

        pushToast({
          type: 'success',
          text: 'Nota guardada.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Add Note Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo guardar la nota.'
          ),
        });

        throw error;
      }
    },

    validateForegroundExit: async () => {
      try {
        const previousState =
          sessionEngine.getCurrentState();

        await sessionEngine.validateForegroundExit();

        const currentState =
          sessionEngine.getCurrentState();

        get().syncWithEngine();

        get().updateSystemHealth({
          lastValidationMinutes: 0,
        });

        if (
          previousState !== 'SALIDA' &&
          currentState === 'SALIDA'
        ) {
          pushToast({
            type: 'warning',
            text:
              'Salida del área de trabajo detectada.',
          });
        }
      } catch (error) {
        console.error(
          '[SessionStore Foreground Validation Error]',
          error
        );

        get().updateSystemHealth({
          geofenceActive: 'WARNING',
        });

        pushToast({
          type: 'error',
          text:
            'No se pudo validar la ubicación actual.',
        });

        throw error;
      }
    },

    // ════════════════════════════════════════════════════════
    // HISTORIAL
    // ════════════════════════════════════════════════════════

    loadSessions: async (
      silent = false
    ) => {
      if (sessionsLoadPromise) {
        return sessionsLoadPromise;
      }

      sessionsLoadPromise = (async () => {
        if (!silent) {
          set({
            isLoadingSessions: true,
          });
        }

        try {
          const sessions =
            await sessionRepository.getAll();

          set({
            sessions: sessions.map(
              (session) =>
                cloneSession(session) as Session
            ),
          });
        } catch (error) {
          console.error(
            '[SessionStore Load Sessions Error]',
            error
          );

          if (!silent) {
            pushToast({
              type: 'error',
              text:
                'No se pudo cargar el historial ' +
                'de jornadas.',
            });
          }

          throw error;
        } finally {
          set({
            isLoadingSessions: false,
          });

          sessionsLoadPromise = null;
        }
      })();

      return sessionsLoadPromise;
    },

    deleteSession: async (id) => {
      try {
        const normalizedId =
          normalizeIdentifier(
            id,
            'El identificador de la jornada'
          );

        const activeSession =
          sessionEngine.getActiveSession();

        if (
          activeSession?.id === normalizedId
        ) {
          throw new Error(
            'No se puede eliminar una jornada activa. ' +
              'Debes cancelarla primero.'
          );
        }

        await sessionRepository.delete(
          normalizedId
        );

        set((state) => ({
          sessions: state.sessions.filter(
            (session) =>
              session.id !== normalizedId
          ),
        }));

        pushToast({
          type: 'success',
          text: 'Jornada eliminada.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Delete Session Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo eliminar la jornada.'
          ),
        });

        throw error;
      }
    },

    editSession: async (
      id,
      patch
    ) => {
      try {
        const normalizedId =
          normalizeIdentifier(
            id,
            'El identificador de la jornada'
          );

        if (
          sessionEngine.getActiveSession()?.id ===
          normalizedId
        ) {
          throw new Error(
            'No se puede editar manualmente una ' +
              'jornada mientras está activa.'
          );
        }

        const updatedSession =
          await sessionRepository.update(
            normalizedId,
            {
              ...patch,
              integrityType: 'MANUAL',
            }
          );

        const clonedUpdatedSession =
          cloneSession(updatedSession);

        if (!clonedUpdatedSession) {
          throw new Error(
            'No se pudo obtener la jornada actualizada.'
          );
        }

        set((state) => ({
          sessions: state.sessions.map(
            (session) =>
              session.id === normalizedId
                ? clonedUpdatedSession
                : session
          ),
        }));

        pushToast({
          type: 'success',
          text: 'Ajuste manual guardado.',
        });
      } catch (error) {
        console.error(
          '[SessionStore Edit Session Error]',
          error
        );

        pushToast({
          type: 'error',
          text: getErrorMessage(
            error,
            'No se pudo guardar el ajuste manual.'
          ),
        });

        throw error;
      }
    },

    // ════════════════════════════════════════════════════════
    // SALUD DEL SISTEMA
    // ════════════════════════════════════════════════════════

    refreshSystemHealth: async () => {
      const healthPatch: Partial<SystemHealth> = {
        notificationsReady: 'OK',
        storageIntegrity: 'OK',
      };

      try {
        DatabaseService.getDb();
        healthPatch.storageIntegrity = 'OK';
      } catch {
        healthPatch.storageIntegrity = 'ERROR';
      }

      try {
        const permissionStatus =
          await geofenceService.getPermissionStatus();

        healthPatch.locationPermission =
          permissionStatus === 'GRANTED'
            ? 'OK'
            : permissionStatus === 'DENIED'
              ? 'ERROR'
              : 'WARNING';

        healthPatch.backgroundLocation =
          permissionStatus === 'GRANTED'
            ? 'OK'
            : 'WARNING';
      } catch (error) {
        console.warn(
          '[SessionStore Permission Health Warning]',
          error
        );

        healthPatch.locationPermission =
          'WARNING';

        healthPatch.backgroundLocation =
          'WARNING';
      }

      const activeSession =
        sessionEngine.getActiveSession();

      healthPatch.geofenceActive =
        activeSession?._lat !== undefined &&
        activeSession?._lng !== undefined &&
        healthPatch.locationPermission === 'OK'
          ? 'OK'
          : activeSession
            ? 'WARNING'
            : 'WARNING';

      set((state) => ({
        systemHealth: {
          ...state.systemHealth,
          ...healthPatch,
        },
      }));
    },

    updateSystemHealth: (
      health
    ) => {
      set((state) => ({
        systemHealth: {
          ...state.systemHealth,
          ...health,
        },
      }));
    },

    setPendingToast: (
      pendingToast
    ) => {
      set({
        pendingToast,
      });
    },

    clearPendingToast: () => {
      set({
        pendingToast: null,
      });
    },
  }));

