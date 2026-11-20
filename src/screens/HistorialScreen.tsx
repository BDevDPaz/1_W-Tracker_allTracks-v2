import type { NavigationProp } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header, Input, Surface, Icon } from "@/components";
import { useSessionStore } from "@/stores/sessionStore";
import { PALETTE, SPACING, FONT, TEXT } from "@/theme";
import type { Session } from "@/types/contracts";
import { formatCurrency, formatHours } from "@/utils";

export const HistorialScreen: React.FC = () => {
  // CORRECCIÓN: Eliminamos el <any> usando Record<string, unknown>
  const navigation = useNavigation<NavigationProp<Record<string, unknown>>>();
  const {
    sessions,
    isLoadingSessions,
    loadSessions,
    historyFilters,
    setHistoryFilters,
  } = useSessionStore();
  const [searchInput, setSearchInput] = useState(historyFilters.search);

  // Recarga las sesiones cuando se monta la pantalla
  useEffect(() => {
    void loadSessions();
  }, []);

  // Búsqueda simple en tiempo real
  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    setHistoryFilters({ search: text });
  };

  const renderItem = ({ item }: { item: Session }) => {
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("Reportes", { sessionId: item.id })}
      >
        <Surface variant="elevated" padding="md" style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.dateText}>{item.date}</Text>
            <View style={styles.statusBadge}>
              <Icon name="check" size={12} color={PALETTE.successGreen} />
              <Text style={styles.statusText}>{item.integrityType}</Text>
            </View>
          </View>

          <Text style={styles.destinationText}>
            {item.alias || item.destination}
          </Text>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Icon name="clock" size={14} color={TEXT.muted} />
              <Text style={styles.metricText}>
                {formatHours(item.totalHours)}
              </Text>
            </View>
            <View style={styles.metric}>
              <Icon name="dollar-sign" size={14} color={TEXT.muted} />
              <Text style={styles.metricText}>
                {formatCurrency(item.totalEarnings)}
              </Text>
            </View>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="HISTORIAL" subtitle="SESIONES CERRADAS" />

      <View style={styles.filterContainer}>
        <Input
          placeholder="Buscar destino, alias o notas..."
          value={searchInput}
          onChangeText={handleSearchChange}
          containerStyle={{ marginBottom: 0 }}
        />
        {/* Aquí podrías agregar en el futuro 2 inputs/botones más para startDate y endDate */}
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isLoadingSessions
                ? "Cargando historial..."
                : "No se encontraron sesiones."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
    paddingTop: Platform.OS === "android" ? 24 : 0,
  },
  filterContainer: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  listContainer: {
    padding: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  card: { borderWidth: 1, borderColor: PALETTE.steelLine },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  dateText: {
    fontSize: FONT.caption.size,
    color: TEXT.muted,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${PALETTE.successGreen}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: { fontSize: 10, color: PALETTE.successGreen, fontWeight: "700" },
  destinationText: {
    fontSize: FONT.bodyStrong.size,
    color: TEXT.primary,
    fontWeight: "700",
    marginBottom: SPACING.md,
  },
  metricsRow: { flexDirection: "row", gap: SPACING.lg },
  metric: { flexDirection: "row", alignItems: "center", gap: 6 },
  metricText: {
    fontSize: FONT.body.size,
    color: TEXT.secondary,
    fontWeight: "600",
  },
  emptyContainer: { alignItems: "center", marginTop: SPACING.xxl },
  emptyText: { color: TEXT.muted, fontStyle: "italic" },
});
