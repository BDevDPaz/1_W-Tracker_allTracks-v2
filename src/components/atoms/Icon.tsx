import { Feather } from "@expo/vector-icons";
import React from "react";
import { PALETTE } from "@/theme";
import type { IconName } from "@/types/ui";

// 1. Re-exportamos el tipo para no romper los imports de MetricTile, AppNavigator, etc.
export type { IconName };

// 2. Añadimos strokeWidth al contrato para satisfacer a AppNavigator
interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

type FeatherGlyph = React.ComponentProps<typeof Feather>["name"];

// Nombres de IconName que no existen en Feather -> equivalente real en Feather.
// Si agregas otro nombre estilo Lucide, agrégalo aquí, no con un cast genérico.
const FEATHER_FALLBACKS: Record<string, FeatherGlyph> = {
  "shield-check": "shield",
  pencil: "edit-2",
  history: "clock",
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = PALETTE.neutralGray,
  strokeWidth,
}) => {
  const featherName = (FEATHER_FALLBACKS[name] ?? name) as FeatherGlyph;

  return (
    <Feather name={featherName} size={size} color={color} strokeWidth={strokeWidth} />
  );
};
