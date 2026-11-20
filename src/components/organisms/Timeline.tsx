import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/atoms/Icon";
import { Surface } from "@/components/atoms/Surface";
import { PALETTE, FONT, SPACING, TEXT } from "@/theme";
import type { TimelineEventUI } from "@/types/ui";

interface TimelineProps {
  events: TimelineEventUI[];
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
  return (
    <Surface variant="base" padding="lg" style={styles.container}>
      <Text style={styles.headerTitle}>Bitácora de la Jornada</Text>

      {events.length === 0 ? (
        <Text style={styles.emptyText}>
          Sin registros de actividad para esta jornada.
        </Text>
      ) : (
        <View style={styles.timelineWrapper}>
          {events.map((event, index) => {
            const isLast = index === events.length - 1;
            return (
              <View key={event.id} style={styles.eventRow}>
                <View style={styles.iconColumn}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        borderColor: event.color,
                        backgroundColor: `${event.color}25`,
                      },
                    ]}
                  >
                    <Icon name={event.icon} size={12} color={event.color} />
                  </View>
                  {!isLast ? <View style={styles.line} /> : null}
                </View>

                <View style={styles.contentColumn}>
                  <Text style={styles.timeText}>{event.time}</Text>
                  <Text style={[styles.titleText, { color: event.color }]}>
                    {event.title}
                  </Text>
                  {event.description ? (
                    <Text style={styles.descriptionText}>
                      {event.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: PALETTE.steelLine,
  },
  headerTitle: {
    fontSize: FONT.h3.size,
    fontWeight: "700",
    color: TEXT.primary,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONT.body.size,
    color: TEXT.muted,
    fontStyle: "italic",
  },
  timelineWrapper: { marginTop: SPACING.xs },
  eventRow: { flexDirection: "row", minHeight: 50 },
  iconColumn: { alignItems: "center", width: 30, marginRight: SPACING.md },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  line: {
    width: 1,
    flex: 1,
    backgroundColor: PALETTE.steelLine,
    marginTop: 4,
    marginBottom: 4,
  },
  contentColumn: { flex: 1, paddingBottom: SPACING.lg },
  timeText: {
    fontSize: 10,
    fontWeight: "700",
    color: TEXT.muted,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  titleText: {
    fontSize: FONT.bodyStrong.size,
    fontWeight: "700",
    marginBottom: 2,
  },
  descriptionText: { fontSize: FONT.caption.size, color: TEXT.secondary },
});
