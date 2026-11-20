import React from "react";
import type { ViewStyle, StyleProp } from "react-native";
import { View } from "react-native";
import { PALETTE, RADIUS, SPACING } from "@/theme";

interface SurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "base" | "elevated" | "highlight";
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
      case "base":
      default:
        return PALETTE.graphite;
    }
  };

  return (
    <View
      style={[
        {
          backgroundColor: getBackgroundColor(),
          borderRadius: RADIUS[radius],
          padding: SPACING[padding],
          borderWidth: 1,
          borderColor: PALETTE.steelLine,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};
