import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PALETTE, FONT, SPACING, TEXT } from "@/theme";
import type { SystemHealthStatus } from "@/types/contracts";

interface HeaderProps {
  title: string;
  subtitle?: string;
  healthStatus?: SystemHealthStatus;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  healthStatus,
}) => {
  const getHealthColor = () => {
    switch (healthStatus) {
      case "OK":
        return PALETTE.successGreen;
      case "ERROR":
        return PALETTE.deepRed;
      case "WARNING":
      default:
        return PALETTE.amberWarning;
    }
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {healthStatus && (
        <View style={styles.healthContainer}>
          <View
            style={[styles.healthDot, { backgroundColor: getHealthColor() }]}
          />
          <Text style={styles.healthText}>SISTEMA {healthStatus}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: PALETTE.obsidian,
  },
  title: {
    fontSize: FONT.h2.size,
    fontWeight: "700",
    color: TEXT.primary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FONT.caption.size,
    color: TEXT.muted,
    marginTop: 2,
  },
  healthContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PALETTE.graphite,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs + 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.steelLine,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthText: {
    fontSize: 9,
    fontWeight: "700",
    color: TEXT.secondary,
  },
});
