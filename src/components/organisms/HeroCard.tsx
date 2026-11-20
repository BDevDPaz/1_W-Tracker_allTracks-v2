import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Surface } from "@/components/atoms/Surface";
import { FONT, SPACING, TEXT } from "@/theme";
import type { UIState, UIActionKey } from "@/types/ui";

// Helper seguro para opacidad en React Native
const hexToRgba = (hex: string, alpha: number) => {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface HeroCardProps {
  ui: UIState;
  elapsedTime: string;
  destination: string | null;
  onAction: (actionKey: UIActionKey) => void;
  loading?: boolean;
}

export const HeroCard: React.FC<HeroCardProps> = ({
  ui,
  elapsedTime,
  destination,
  onAction,
  loading = false,
}) => {
  const badgeBgColor = hexToRgba(ui.theme.color, 0.15);

  return (
    <Surface
      variant="elevated"
      padding="xl"
      style={[styles.card, { borderColor: ui.theme.color }]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.badge,
            { backgroundColor: badgeBgColor, borderColor: ui.theme.color },
          ]}
        >
          <Icon name={ui.theme.icon} size={14} color={ui.theme.color} />
          <Text style={[styles.badgeText, { color: ui.theme.color }]}>
            {ui.copy.title.toUpperCase()}
          </Text>
        </View>

        {ui.visibility.showDestination && destination ? (
          <Text style={styles.destinationText} numberOfLines={1}>
            {destination}
          </Text>
        ) : null}
      </View>

      <View style={styles.centerContent}>
        {ui.visibility.showTimer ? (
          <>
            <Text style={[styles.timerText, { color: ui.theme.color }]}>
              {elapsedTime}
            </Text>
            <Text style={styles.timerSubtext}>{ui.copy.subtext}</Text>
          </>
        ) : (
          <Text style={styles.staticSubtext}>{ui.copy.subtext}</Text>
        )}
      </View>

      <View style={styles.actionsContainer}>
        {ui.actions.primary ? (
          <Button
            title={ui.actions.primary.label}
            variant={ui.actions.primary.variant}
            size="lg"
            onPress={() => onAction(ui.actions.primary!.actionKey)}
            loading={loading}
            style={styles.actionButton}
          />
        ) : null}

        {ui.actions.secondary && ui.actions.secondary.length > 0 ? (
          <View style={styles.secondaryActionsWrapper}>
            {ui.actions.secondary.map((action) => (
              <Button
                key={action.actionKey}
                title={action.label}
                variant={action.variant}
                size="md"
                onPress={() => onAction(action.actionKey)}
                disabled={loading}
                // CORRECCIÓN: React Native soporta arreglos de estilos de forma nativa sin usar 'any'
                style={[styles.actionButton, styles.flexButton]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  destinationText: {
    fontSize: FONT.captionStrong.size,
    color: TEXT.secondary,
    fontWeight: "600",
    maxWidth: "45%",
  },
  centerContent: { alignItems: "center", marginVertical: SPACING.md },
  timerText: {
    fontSize: 44,
    fontWeight: "800",
    fontFamily: "Courier New",
    letterSpacing: 2,
  },
  timerSubtext: {
    fontSize: FONT.caption.size,
    color: TEXT.muted,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
  staticSubtext: {
    fontSize: FONT.body.size,
    color: TEXT.secondary,
    textAlign: "center",
    marginVertical: SPACING.md,
  },
  actionsContainer: { gap: SPACING.sm, marginTop: SPACING.md },
  secondaryActionsWrapper: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  actionButton: { width: "100%" },
  flexButton: { flex: 1 },
});
