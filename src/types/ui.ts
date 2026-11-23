// src/types/ui.ts
import type { IntegrityType } from "./contracts";

export type IconName =
  | "clock"
  | "map-pin"
  | "truck"
  | "shield-check"
  | "coffee"
  | "alert-triangle"
  | "check"
  | "dollar-sign"
  | "pencil"
  | "chevron-right"
  | "home"
  | "file-text"
  | "settings"
  | "list"
  | "user"
  | (string & {}); // Truco TS: Mantiene el autocompletado pero permite cualquier otro string

export type UIStateName =
  | "NO_INICIADA"
  | "ESPERANDO_LLEGADA"
  | "TRASLADO"
  | "ACTIVA"
  | "PAUSADA"
  | "SALIDA_DETECTADA"
  | "CERRADA";

export type UIActionKey =
  | "START_SESSION"
  | "CONFIRM_ARRIVAL"
  | "CANCEL_SESSION"
  | "START_TRANSFER"
  | "CANCEL_TRANSFER"
  | "FINISH_SESSION"
  | "START_LUNCH"
  | "FINISH_LUNCH"
  | "CONFIRM_EXIT"
  | "STAY_WORKING"
  | "REVIEW_JOURNEY"
  | "REVIEW_HISTORY";

export interface UIAction {
  label: string;
  actionKey: UIActionKey;
  variant: "primary" | "secondary" | "danger" | "outline";
}

export interface UIVisibility {
  showTimer: boolean;
  showEarnings: boolean;
  showDestination: boolean;
  showHours: boolean;
}

export interface UITheme {
  color: string;
  bgColor: string;
  icon: IconName;
}

export interface UICopy {
  title: string;
  subtext: string;
}

export interface UIState {
  name: UIStateName;
  theme: UITheme;
  copy: UICopy;
  actions: {
    primary: UIAction | null;
    secondary: UIAction[];
  };
  visibility: UIVisibility;
}

export interface TimelineEventUI {
  id: string;
  time: string;
  title: string;
  description?: string;
  icon: IconName;
  color: string;
}

export interface IntegrityBadgeUI {
  label: string;
  color: string;
  bgColor: string;
  icon: IconName;
  type: IntegrityType;
}
