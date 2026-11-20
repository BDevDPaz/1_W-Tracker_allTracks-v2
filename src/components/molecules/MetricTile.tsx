import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { IconName } from "@/components/atoms/Icon";
import { Icon } from "@/components/atoms/Icon";
import { Surface } from "@/components/atoms/Surface";
import { PALETTE, FONT, SPACING, TEXT } from "@/theme";

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
      variant={highlight ? "highlight" : "base"}
      padding="md"
      style={styles.card}
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
    marginBottom: SPACING.xs,
  },
  label: {
    fontSize: FONT.label.size,
    fontWeight: "700",
    color: TEXT.muted,
    textTransform: "uppercase",
  },
  value: {
    fontSize: FONT.h3.size,
    fontWeight: "700",
    color: TEXT.primary,
  },
  goldValue: {
    color: PALETTE.mutedGold,
  },
});
