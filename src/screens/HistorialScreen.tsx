// ============================================================
// SCREEN: HistorialScreen — Auditoría forense de jornadas (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint Pantalla Historial | Identidad V2
// Ruta: src/screens/HistorialScreen.tsx
// Responsabilidad: Búsqueda, filtrado por períodos, resumen financiero y edición manual.
// ============================================================

import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Icon, SessionCard } from '../components';
import { EditSessionModal } from '../modals';
import { useSessionStore } from '../stores/sessionStore';
import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../theme';
import { Session } from '../types';
import { formatCurrency, formatHours } from '../utils/formatters';

// ── TIPOS Y CONSTANTES DE FILTRADO ──────────────────────────

export type SessionFilter = 'TODO' | 'SEMANA' | 'MES' | 'PENDIENTES' | 'AJUSTADAS' | 'AUTO_CERRADAS';

const FILTER_LABELS: Record<SessionFilter, string> = {
  TODO: 'Historial Completo',
  SEMANA: 'Esta Semana',
  MES: 'Este Mes',
  PENDIENTES: 'En Curso',
  AJUSTADAS: 'Ajuste Manual',
  AUTO_CERRADAS: 'Cierre Auto',
};

const FILTERS: SessionFilter[] = ['SEMANA', 'MES', 'TODO', 'PENDIENTES', 'AJUSTADAS', 'AUTO_CERRADAS'];

// ── DATE HELPERS (Mitigación de Timezones) ──────────────────

const parseSessionDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return new Date(dateStr);
  return new Date(year, month - 1, day);
};

const isSameMonth = (sessionDate: string): boolean => {
  const date = parseSessionDate(sessionDate);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

const isSameWeek = (sessionDate: string): boolean => {
  const date = parseSessionDate(sessionDate);
  const now = new Date();

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day; // Lunes como inicio de semana

  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return date >= startOfWeek && date <= endOfWeek;
};

// ── COMPONENTE PRINCIPAL ────────────────────────────────────

export const HistorialScreen: React.FC = () => {
  const {
    sessions,
    isLoadingSessions,
    loadSessions,
    deleteSession,
    editSession,
  } = useSessionStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SessionFilter>('SEMANA');
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Recargar sesiones al enfocar la pestaña
  useFocusEffect(
    useCallback(() => {
      loadSessions(true); // silent load
    }, [loadSessions])
  );

  // ── FILTRADO Y BÚSQUEDA EN MEMORIA ─────────────────────────

  const filteredSessions = useMemo(() => {
    let result = sessions.filter((s) => {
      switch (activeFilter) {
        case 'SEMANA':
          return isSameWeek(s.date);
        case 'MES':
          return isSameMonth(s.date);
        case 'PENDIENTES':
          return s.state !== 'CERRADA';
        case 'AJUSTADAS':
          return s.integrityType === 'MANUAL';
        case 'AUTO_CERRADAS':
          return s.integrityType === 'AUTO';
        case 'TODO':
        default:
          return true;
      }
    });

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.destination?.toLowerCase().includes(q) ||
          s.alias?.toLowerCase().includes(q) ||
          s.notes?.toLowerCase().includes(q)
      );
    }

    // Ordenar de más reciente a más antiguo
    return result.sort((a, b) => {
      const aKey = `${a.date} ${a.startTime || '00:00'}`;
      const bKey = `${b.date} ${b.startTime || '00:00'}`;
      return bKey.localeCompare(aKey);
    });
  }, [sessions, activeFilter, searchQuery]);

  // ── MÉTRICAS DEL RESUMEN ──────────────────────────────────

  const totalHours = filteredSessions.reduce((acc, s) => acc + (s.totalHours ?? 0), 0);
  const totalEarnings = filteredSessions.reduce((acc, s) => acc + (s.totalEarnings ?? 0), 0);

  // ── MANEJADORES DE ACCIÓN ─────────────────────────────────

  const handleEditRequest = useCallback((session: Session) => {
    if (session.state !== 'CERRADA') {
      Alert.alert(
        'Sesión en curso',
        'Solo puedes editar sesiones cerradas. Si necesitas modificar esta jornada, primero finalízala.'
      );
      return;
    }
    setEditingSession(session);
  }, []);

  const handleDeleteRequest = useCallback((session: Session) => {
    if (session.state !== 'CERRADA') {
      Alert.alert(
        'Sesión en curso',
        'No puedes eliminar una jornada activa o pendiente. Finalízala o cancélala desde el panel principal.'
      );
      return;
    }

    Alert.alert(
      'Eliminar registro de jornada',
      `¿Deseas eliminar permanentemente el registro del ${session.date}? Esta acción afectará el cálculo de nómina.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteSession(session.id);
          },
        },
      ]
    );
  }, [deleteSession]);

  const handleSaveEdit = useCallback(
    async (id: string, patch: { startTime?: string; endTime?: string; notes?: string }) => {
      try {
        setIsSavingEdit(true);
        await editSession(id, patch);
        setEditingSession(null);
      } catch (error) {
        console.error('[Edit Session Error]', error);
        Alert.alert('Error al guardar', 'No se pudo actualizar el registro.');
      } finally {
        setIsSavingEdit(false);
      }
    },
    [editSession]
  );

  // ── RENDERERS ─────────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* BARRA DE BÚSQUEDA */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={18} color={TEXT.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por destino o notas..."
          placeholderTextColor={TEXT.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
            <Icon name="close" size={16} color={TEXT.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* CHIPS DE FILTRADO HORIZONTAL */}
      <View style={styles.filterScrollWrapper}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(item) => `filter-chip-${item}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
          renderItem={({ item }) => {
            const isSelected = activeFilter === item;
            return (
              <TouchableOpacity
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                onPress={() => setActiveFilter(item)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                  {FILTER_LABELS[item]}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* BLOQUE DE RESUMEN FINANCIERO */}
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryLabel}>{FILTER_LABELS[activeFilter].toUpperCase()}</Text>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryHours}>{formatHours(totalHours)}</Text>
          <Text style={styles.summaryEarnings}>{formatCurrency(totalEarnings)}</Text>
        </View>
        <Text style={styles.summaryMeta}>
          {filteredSessions.length} jornada{filteredSessions.length !== 1 ? 's' : ''} encontrada{filteredSessions.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Auditoría</Text>
          <Text style={styles.headerSubtitle}>HISTORIAL Y REGISTROS FORENSES</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => loadSessions()}
          disabled={isLoadingSessions}
          activeOpacity={0.7}
        >
          {isLoadingSessions ? (
            <ActivityIndicator size="small" color={PALETTE.mutedGold} />
          ) : (
            <Icon name="history" size={18} color={PALETTE.mutedGold} />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => `session-card-${item.id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="file-text" size={36} color={TEXT.muted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Sin registros coincidentes</Text>
            <Text style={styles.emptySubtitle}>
              No se encontraron jornadas en el historial que cumplan con los filtros seleccionados.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onEdit={() => handleEditRequest(item)}
            onDelete={() => handleDeleteRequest(item)}
          />
        )}
      />

      {/* MODAL DE EDICIÓN FORENSE */}
      <EditSessionModal
        visible={editingSession !== null}
        session={editingSession}
        onCancel={() => setEditingSession(null)}
        onSave={handleSaveEdit}
        loading={isSavingEdit}
      />
    </SafeAreaView>
  );
};

// ── ESTILOS ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  headerTitle: {
    color: TEXT.primary,
    fontSize: FONT.h2.size,
    fontWeight: '700',
    fontFamily: 'Montserrat',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: TEXT.secondary,
    fontSize: FONT.label.size,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Montserrat',
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: PALETTE.carbonMist,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listHeaderContainer: {
    marginBottom: SPACING.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.graphite,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    borderRadius: RADIUS.inputs,
    marginHorizontal: SPACING.xl,
    paddingHorizontal: SPACING.md,
    height: 44,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    color: TEXT.primary,
    fontSize: FONT.body.size,
    fontFamily: 'Montserrat',
  },
  clearSearchBtn: {
    padding: SPACING.xs,
  },
  filterScrollWrapper: {
    marginBottom: SPACING.lg,
  },
  filterContainer: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  filterChip: {
    backgroundColor: PALETTE.carbonMist,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    borderRadius: RADIUS.pills,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    height: 36,
    justifyContent: 'center',
  },
  filterChipSelected: {
    backgroundColor: 'rgba(197, 160, 89, 0.12)',
    borderColor: PALETTE.mutedGold,
  },
  filterChipText: {
    color: TEXT.secondary,
    fontSize: FONT.captionStrong.size,
    fontWeight: '600',
    fontFamily: 'Montserrat',
  },
  filterChipTextSelected: {
    color: PALETTE.mutedGold,
  },
  summaryBlock: {
    marginHorizontal: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: RADIUS.cards,
    backgroundColor: PALETTE.graphite,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    color: TEXT.muted,
    fontSize: FONT.label.size,
    fontWeight: '700',
    letterSpacing: FONT.label.letterSpacing,
    textTransform: 'uppercase',
    fontFamily: 'Montserrat',
    marginBottom: SPACING.xs,
  },
  summaryMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: SPACING.xs,
  },
  summaryHours: {
    color: TEXT.primary,
    fontSize: FONT.h1.size - 2,
    fontWeight: '700',
    fontFamily: 'Montserrat',
  },
  summaryEarnings: {
    color: PALETTE.mutedGold,
    fontSize: FONT.h2.size,
    fontWeight: '700',
    fontFamily: 'Montserrat',
  },
  summaryMeta: {
    color: TEXT.muted,
    fontSize: FONT.caption.size,
    fontFamily: 'Montserrat',
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyState: {
    backgroundColor: PALETTE.carbonMist,
    borderRadius: RADIUS.cards,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    padding: SPACING.xxl,
    marginHorizontal: SPACING.xl,
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  emptyTitle: {
    color: TEXT.primary,
    fontSize: FONT.h3.size - 2,
    fontWeight: '700',
    fontFamily: 'Montserrat',
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    color: TEXT.muted,
    fontSize: FONT.body.size - 1,
    fontFamily: 'Montserrat',
    textAlign: 'center',
    lineHeight: FONT.body.lineHeight,
  },
});
