import React from "react";
import type { ViewStyle } from "react-native";
import { View, Text, StyleSheet } from "react-native";
import { STATE_COLORS, RADIUS, SPACING } from "@/theme";
import type { SessionState, IntegrityType } from "@/types/contracts";
import { getIntegrityConfig } from "@/utils";

interface PillProps {
  state?: SessionState;
  integrityType?: IntegrityType;
  label?: string;
  style?: ViewStyle;
}

export const Pill: React.FC<PillProps> = ({
  state,
  integrityType,
  label,
  style,
}) => {
  let mainColor = "#777";
  let bgColor = "rgba(119, 119, 119, 0.15)";
  let displayText = label || "Estado";

  if (state) {
    const colorConfig = STATE_COLORS[state];
    if (colorConfig) {
      mainColor = colorConfig.main;
      bgColor = colorConfig.bg;
    }
    displayText = state.replace("_", " ");
  } else if (integrityType) {
    const integrityConfig = getIntegrityConfig(integrityType);
    if (integrityConfig) {
      mainColor = integrityConfig.textColor;
      bgColor = `${integrityConfig.textColor}26`; // 15% opacity hex roughly
      displayText = integrityConfig.label;
    }
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgColor, borderColor: mainColor },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: mainColor }]} />
      <Text style={[styles.text, { color: mainColor }]}>{displayText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xxs + 2,
    borderRadius: RADIUS.pills,
    borderWidth: 1,
    alignSelf: "flex-start",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
