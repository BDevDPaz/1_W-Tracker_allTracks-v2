import React from "react";
import type { ViewStyle, StyleProp } from "react-native";
import { View } from "react-native";
import { PALETTE, RADIUS, SHADOWS, SPACING } from "@/theme";

interface SurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "base" | "elevated" | "highlight" | "gold";
  padding?: keyof typeof SPACING;
  radius?: keyof typeof RADIUS;
}

export const Surface: React.FC<SurfaceProps> = ({
  children,
  style,
  variant = "base",
  padding = "lg",
  radius = "cards",
}) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case "elevated":
        return PALETTE.carbonMist;
      case "highlight":
        return "#202020";
      case "gold":
        return PALETTE.graphite;
      case "base":
      default:
        return PALETTE.graphite;
    }
  };

  const getBorderColor = () => {
    if (variant === "gold") return PALETTE.mutedGold;
    return PALETTE.steelLine;
  };

  const getShadow = () => {
    if (variant === "gold") return SHADOWS.goldGlow;
    if (variant === "elevated" || variant === "highlight") return SHADOWS.card;
    return undefined;
  };

  return (
    <View
      style={[
        {
          backgroundColor: getBackgroundColor(),
          borderRadius: RADIUS[radius],
          padding: SPACING[padding],
          borderWidth: variant === "gold" ? 1.2 : 1,
          borderColor: getBorderColor(),
          ...getShadow(),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};
