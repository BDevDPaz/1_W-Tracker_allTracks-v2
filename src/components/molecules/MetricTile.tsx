import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { IconName } from "@/components/atoms/Icon";
import { Icon } from "@/components/atoms/Icon";
import { Surface } from "@/components/atoms/Surface";
import { PALETTE, FONT, SHADOWS, SPACING, TEXT } from "@/theme";

interface MetricTileProps {
  label: string;
  value: string;
  icon?: IconName;
  highlight?: boolean;
}

export const MetricTile: React.FC<MetricTileProps> = ({
  label,
  value,
  icon,
  highlight = false,
}) => {
  return (
    <Surface
      variant={highlight ? "gold" : "base"}
      padding="md"
      style={[styles.card, highlight && SHADOWS.goldGlow]}
    >
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {icon && (
          <Icon
            name={icon}
            size={14}
            color={highlight ? PALETTE.mutedGold : TEXT.muted}
          />
        )}
      </View>
      <Text style={[styles.value, highlight && styles.goldValue]}>{value}</Text>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 120,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: FONT.label.size,
    fontWeight: "700",
    color: TEXT.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  value: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: TEXT.primary,
    letterSpacing: -0.3,
  },
  goldValue: {
    color: PALETTE.mutedGold,
  },
});
