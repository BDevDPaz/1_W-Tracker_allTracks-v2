import { PALETTE } from "@/theme/tokens";
import type { Session, Transfer, Break, SessionState } from "@/types/contracts";
import type { UIState, TimelineEventUI } from "@/types/ui";

// Helper para extraer la hora (HH:mm) de un ISO string o usar la cadena directa
const formatTime = (timeStr: string | null | undefined): string => {
  if (!timeStr) return "--:--";
  if (timeStr.includes("T")) {
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return timeStr;
};

export const getUIState = (sessionState: SessionState): UIState => {
  switch (sessionState) {
    case "NO_INICIADA":
      return {
        name: "NO_INICIADA",
        theme: {
          color: PALETTE.neutralGray,
          bgColor: PALETTE.slateBlueBg,
          icon: "clock",
        },
        copy: {
          title: "Jornada no iniciada",
          subtext: "Configura tu jornada para comenzar.",
        },
        actions: {
          primary: {
            label: "Iniciar jornada",
            actionKey: "START_SESSION",
            variant: "primary",
          },
          secondary: [],
        },
        visibility: {
          showTimer: false,
          showEarnings: false,
          showDestination: false,
          showHours: false,
        },
      };

    case "ESPERANDO":
      return {
        name: "ESPERANDO_LLEGADA",
        theme: {
          color: PALETTE.amberWarning,
          bgColor: PALETTE.amberWarningBg,
          icon: "map-pin",
        },
        copy: {
          title: "Esperando llegada",
          subtext: "Esperando llegada física al destino.",
        },
        actions: {
          primary: {
            label: "Confirmar llegada",
            actionKey: "CONFIRM_ARRIVAL",
            variant: "primary",
          },
          secondary: [
            {
              label: "Cancelar jornada",
              actionKey: "CANCEL_SESSION",
              variant: "outline",
            },
          ],
        },
        visibility: {
          showTimer: false,
          showEarnings: true,
          showDestination: true,
          showHours: false,
        },
      };

    case "TRASLADO":
      return {
        name: "TRASLADO",
        theme: {
          color: PALETTE.royalBlue,
          bgColor: PALETTE.royalBlueBg,
          icon: "truck",
        },
        copy: {
          title: "En traslado",
          subtext: "Transitando (Logística/Cambio de Destino).",
        },
        actions: {
          primary: {
            label: "Confirmar llegada",
            actionKey: "CONFIRM_ARRIVAL",
            variant: "primary",
          },
          secondary: [
            {
              label: "Cancelar traslado",
              actionKey: "CANCEL_TRANSFER",
              variant: "outline",
            },
          ],
        },
        visibility: {
          showTimer: true,
          showEarnings: true,
          showDestination: true,
          showHours: true,
        },
      };

    case "ACTIVA":
      return {
        name: "ACTIVA",
        theme: {
          color: PALETTE.successGreen,
          bgColor: PALETTE.successGreenBg,
          icon: "shield-check",
        },
        copy: {
          title: "Jornada activa",
          subtext: "Trabajando en destino validado.",
        },
        actions: {
          primary: {
            label: "Finalizar jornada",
            actionKey: "FINISH_SESSION",
            variant: "primary",
          },
          secondary: [
            {
              label: "Fuera de Servicio",
              actionKey: "START_LUNCH",
              variant: "secondary",
            },
            {
              label: "Iniciar traslado",
              actionKey: "START_TRANSFER",
              variant: "outline",
            },
          ],
        },
        visibility: {
          showTimer: true,
          showEarnings: true,
          showDestination: true,
          showHours: true,
        },
      };

    case "PAUSADA":
      return {
        name: "PAUSADA",
        theme: {
          color: PALETTE.lunchOrange,
          bgColor: PALETTE.lunchOrangeBg,
          icon: "coffee",
        },
        copy: {
          title: "Fuera de Servicio",
          subtext: "Tiempo personal (No remunerado).",
        },
        actions: {
          primary: {
            label: "Reanudar Jornada",
            actionKey: "FINISH_LUNCH",
            variant: "primary",
          },
          secondary: [],
        },
        visibility: {
          showTimer: true,
          showEarnings: true,
          showDestination: true,
          showHours: true,
        },
      };

    case "SALIDA":
      return {
        name: "SALIDA_DETECTADA",
        theme: {
          color: PALETTE.amberWarning,
          bgColor: PALETTE.amberWarningBg,
          icon: "alert-triangle",
        },
        copy: {
          title: "Salida detectada",
          subtext: "Fuera del radio de la geocerca.",
        },
        actions: {
          primary: {
            label: "Confirmar salida",
            actionKey: "CONFIRM_EXIT",
            variant: "danger",
          },
          secondary: [
            {
              label: "Sigo trabajando",
              actionKey: "STAY_WORKING",
              variant: "outline",
            },
          ],
        },
        visibility: {
          showTimer: true,
          showEarnings: true,
          showDestination: true,
          showHours: true,
        },
      };

    case "CERRADA":
    default:
      return {
        name: "CERRADA",
        theme: {
          color: PALETTE.neutralGray,
          bgColor: PALETTE.slateBlueBg,
          icon: "check",
        },
        copy: { title: "Jornada cerrada", subtext: "Auditoría completada." },
        actions: {
          primary: {
            label: "Revisar jornada",
            actionKey: "REVIEW_JOURNEY",
            variant: "primary",
          },
          secondary: [
            {
              label: "Ver historial",
              actionKey: "REVIEW_HISTORY",
              variant: "secondary",
            },
          ],
        },
        visibility: {
          showTimer: false,
          showEarnings: true,
          showDestination: false,
          showHours: true,
        },
      };
  }
};

export const buildTimeline = (session: Session | null): TimelineEventUI[] => {
  if (!session) return [];

  const events: TimelineEventUI[] = [];

  // 1. EL BUG DE LA HORA CORREGIDO: Usamos createdAt (inmutable)
  events.push({
    id: "start",
    time: formatTime(session.createdAt || session.startTime),
    title: "Jornada configurada",
    description: `Destino: ${session.alias || session.destination}`,
    icon: "clock",
    color: PALETTE.neutralGray,
  });

  // 2. Llegada confirmada: Usamos startTime (se actualiza con la geocerca/llegada real)
  if (session.state !== "NO_INICIADA" && session.state !== "ESPERANDO") {
    events.push({
      id: "arrival",
      time: formatTime(session.startTime),
      title: "Llegada al destino",
      description: "Llegada física confirmada",
      icon: "map-pin",
      color: PALETTE.successGreen,
    });
  }

  (session.transfers || []).forEach((transfer: Transfer, index: number) => {
    events.push({
      id: `transfer_start_${index}`,
      time: formatTime(transfer.startTime),
      title: "Traslado iniciado",
      description: `Hacia: ${transfer.targetDestination || transfer.toDestination || transfer.destination || "Nuevo destino"}`,
      icon: "truck",
      color: PALETTE.royalBlue,
    });

    if (transfer.endTime) {
      events.push({
        id: `transfer_end_${index}`,
        time: formatTime(transfer.endTime),
        title: "Traslado completado",
        description: `Destino validado`,
        icon: "map-pin",
        color: PALETTE.successGreen,
      });
    }
  });

  (session.breaks || []).forEach((brk: Break, index: number) => {
    events.push({
      id: `break_start_${index}`,
      time: formatTime(brk.startTime),
      title: "Fuera de Servicio",
      description: "Pausa iniciada (Tiempo personal)",
      icon: "coffee",
      color: PALETTE.lunchOrange,
    });

    if (brk.endTime) {
      events.push({
        id: `break_end_${index}`,
        time: formatTime(brk.endTime),
        title: "Jornada Reanudada",
        description: "Retorno a labores",
        icon: "coffee",
        color: PALETTE.successGreen,
      });
    }
  });

  if (session.state === "SALIDA") {
    events.push({
      id: "exit_detected",
      time: "Ahora",
      title: "Salida detectada",
      description: "Cruzo el perímetro de la geocerca",
      icon: "alert-triangle",
      color: PALETTE.amberWarning,
    });
  }

  if (session.state === "CERRADA") {
    if (session.lunchDeductedMinutes && session.lunchDeductedMinutes > 0) {
      events.push({
        id: "lunch_deducted",
        time: formatTime(session.endTime),
        title: "Pausas consolidadas",
        description: `${session.lunchDeductedMinutes} min. deducidos del total`,
        icon: "coffee",
        color: PALETTE.mutedGold,
      });
    }

    events.push({
      id: "end",
      time: formatTime(session.endTime),
      title: "Jornada cerrada",
      description: `Auditoría ${session.integrityType}`,
      icon: "check",
      color: PALETTE.neutralGray,
    });
  }

  return events;
};

export const buildDailyTimeline = (sessions: Session[]): TimelineEventUI[] => {
  if (!sessions || sessions.length === 0) return [];

  let dailyEvents: TimelineEventUI[] = [];

  sessions.forEach((session) => {
    const sessionEvents = buildTimeline(session);
    const uniqueEvents = sessionEvents.map((event) => ({
      ...event,
      id: `${session.id}-${event.id}`,
    }));
    dailyEvents = [...dailyEvents, ...uniqueEvents];
  });

  return dailyEvents;
};
