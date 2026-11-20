import React from "react";
import type { StyleProp, ViewStyle, TextStyle } from "react-native";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { PALETTE, RADIUS, SHADOWS, SPACING } from "@/theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case "secondary":
        return {
          container: {
            backgroundColor: PALETTE.carbonMist,
            borderWidth: 1,
            borderColor: PALETTE.steelLine,
          },
          text: { color: PALETTE.mutedGold },
        };
      case "outline":
        return {
          container: {
            backgroundColor: "transparent",
            borderWidth: 1.2,
            borderColor: PALETTE.mutedGold,
          },
          text: { color: PALETTE.mutedGold },
        };
      case "danger":
        return {
          container: {
            backgroundColor: PALETTE.deepRedBg,
            borderWidth: 1,
            borderColor: PALETTE.deepRed,
          },
          text: { color: "#FF8A8A" },
        };
      case "primary":
      default:
        return {
          container: {
            backgroundColor: PALETTE.mutedGold,
            borderWidth: 0,
            ...SHADOWS.goldGlow,
          },
          text: { color: PALETTE.obsidian, fontWeight: "800" },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case "sm":
        return {
          container: { paddingVertical: SP8, paddingHorizontal: SPACING.md },
          text: { fontSize: 12 },
        };
      case "lg":
        return {
          container: {
            paddingVertical: SPACING.md + 4,
            paddingHorizontal: SPACING.xxl,
          },
          text: { fontSize: 16 },
        };
      case "md":
      default:
        return {
          container: {
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.xl,
          },
          text: { fontSize: 14 },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
      style={[
        styles.base,
        variantStyles.container,
        sizeStyles.container,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? PALETTE.obsidian : PALETTE.mutedGold}
          size="small"
        />
      ) : (
        <Text
          style={[styles.text, variantStyles.text, sizeStyles.text, textStyle]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const SP8 = 8;

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.inputs,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
