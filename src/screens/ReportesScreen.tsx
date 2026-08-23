// ============================================================
// SCREEN: ReportesScreen — Exportación y finanzas (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint Pantalla Reportes | Identidad V2
// Responsabilidad: Cálculo financiero semanal y generación de auditorías PDF.
// ============================================================

import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button, SummaryBlock } from '../components';
import { PDFService } from '../services/pdf/PDFService';
import { settingsService } from '../services/settings/SettingsService';
import { useSessionStore } from '../stores/sessionStore';
import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../theme';
import { PDFReport, Session } from '../types';
import { formatCurrency, formatHours } from '../utils/formatters';

// ── TIPOS Y ESTADOS ─────────────────────────────────────────

type ReportAction = 'generate' | 'share' | 'email' | 'preview' | null;

interface WeeklySummaryModel {
  periodLabel: string;
  totalHours: number;
  totalEarnings: number;
  sessionCount: number;
  manualAdjustments: number;
  overtimeHours: number;
  baseEarnings: number;
  overtimeEarnings: number;
  baseRate: number;
  overtimeMultiplier: number;
}

// ── UTILERÍAS DE FECHA ──────────────────────────────────────

const getStartOfWeek = (offset: number): Date => {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day; // Semana inicia lunes

  start.setDate(start.getDate() + diffToMonday + offset * 7);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getEndOfWeek = (startOfWeek: Date): Date => {
  const end = new Date(startOfWeek);
  end.setDate(startOfWeek.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

const toDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0] ?? '';
};

const parseSessionDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return new Date(dateStr);
  return new Date(year, month - 1, day);
};

const formatPeriodLabel = (startDate: Date, endDate: Date): string => {
  const startStr = startDate.toLocaleDateString('es-US', { month: 'short', day: 'numeric' });
  const endStr = endDate.toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
};

const isSessionInRange = (session: Session, startDate: Date, endDate: Date): boolean => {
  const date = parseSessionDate(session.date);
  date.setHours(12, 0, 0, 0);
  return date >= startDate && date <= endDate;
};

// ── COMPONENTE PRINCIPAL ────────────────────────────────────

export const ReportesScreen: React.FC = () => {
  const { sessions, isLoadingSessions, loadSessions } = useSessionStore();

  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [reportFilePath, setReportFilePath] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<ReportAction>(null);

  // Recarga silenciosa al entrar en la pestaña
  useFocusEffect(
    useCallback(() => {
      loadSessions(true);
    }, [loadSessions])
  );

  // ── CÁLCULO DE PERÍODOS ───────────────────────────────────

  const startOfWeek = useMemo(() => getStartOfWeek(weekOffset), [weekOffset]);
  const endOfWeek = useMemo(() => getEndOfWeek(startOfWeek), [startOfWeek]);
  const periodLabel = useMemo(() => formatPeriodLabel(startOfWeek, endOfWeek), [startOfWeek, endOfWeek]);

  const weeklySessions = useMemo(() => {
    return sessions
      .filter((s) => s.state === 'CERRADA')
      .filter((s) => isSessionInRange(s, startOfWeek, endOfWeek))
      .sort((a, b) => {
        const aKey = `${a.date} ${a.startTime || '00:00'}`;
        const bKey = `${b.date} ${b.startTime || '00:00'}`;
        return aKey.localeCompare(bKey);
      });
  }, [sessions, startOfWeek, endOfWeek]);

  // ── RESUMEN FINANCIERO ────────────────────────────────────

  const summary = useMemo<WeeklySummaryModel>(() => {
    const settings = settingsService.getSettings();

    const totalHours = weeklySessions.reduce((acc, s) => acc + (s.totalHours ?? 0), 0);
    const totalEarnings = weeklySessions.reduce((acc, s) => acc + (s.totalEarnings ?? 0), 0);
    const overtimeHours = weeklySessions.reduce((acc, s) => acc + (s.overtimeHours ?? 0), 0);
    const manualAdjustments = weeklySessions.filter((s) => s.integrityType === 'MANUAL').length;

    const overtimeMultiplier = settings.overtimeMultiplier ?? 1.5;
    const baseRate = weeklySessions[0]?.snapshotRate ?? settings.hourlyRate ?? 20;
    const overtimeEarnings = overtimeHours * baseRate * overtimeMultiplier;
    const baseEarnings = Math.max(0, totalEarnings - overtimeEarnings);

    return {
      periodLabel,
      totalHours,
      totalEarnings,
      sessionCount: weeklySessions.length,
      manualAdjustments,
      overtimeHours,
      baseEarnings,
      overtimeEarnings,
      baseRate,
      overtimeMultiplier,
    };
  }, [weeklySessions, periodLabel]);

  const reportPayload = useMemo<PDFReport>(() => {
    return {
      periodLabel,
      weekStart: toDateKey(startOfWeek),
      weekEnd: toDateKey(endOfWeek),
      generatedAt: new Date().toISOString(),
      summary,
      sessions: weeklySessions,
    } as unknown as PDFReport;
  }, [periodLabel, startOfWeek, endOfWeek, summary, weeklySessions]);

  const hasReportData = weeklySessions.length > 0;

  // ── ACCIONES Y EXPORTACIÓN ────────────────────────────────

  const assertHasData = useCallback((): boolean => {
    if (hasReportData) return true;
    Alert.alert(
      'Sin sesiones para reportar',
      'No hay jornadas finalizadas (Cerradas) en la semana seleccionada. Cambia de semana o finaliza una jornada.'
    );
    return false;
  }, [hasReportData]);

  const ensureReportFile = useCallback(async (): Promise<string> => {
    if (!assertHasData()) throw new Error('No data');
    if (reportFilePath) return reportFilePath;

    const filePath = await PDFService.generate(reportPayload);
    setReportFilePath(filePath);
    return filePath;
  }, [assertHasData, reportFilePath, reportPayload]);

  const handleOffsetChange = (increment: number) => {
    setReportFilePath(null);
    setWeekOffset((prev) => Math.min(0, prev + increment)); // Bloquear semanas futuras
  };

  const executeAction = async (action: ReportAction, task: () => Promise<void>) => {
    if (!assertHasData()) return;
    try {
      setLoadingAction(action);
      await task();
    } catch (error) {
      console.error(`[Export Error - ${action}]`, error);
      Alert.alert('Error de exportación', 'No se pudo completar la operación. Intenta nuevamente.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePreviewReport = () =>
    executeAction('preview', async () => {
      const filePath = await ensureReportFile();
      await PDFService.preview(filePath);
    });

  const handleShareReport = () =>
    executeAction('share', async () => {
      const filePath = await ensureReportFile();
      await PDFService.share(filePath);
    });

  const handleEmailReport = () =>
    executeAction('email', async () => {
      const filePath = await ensureReportFile();
      const settings = settingsService.getSettings();
      await PDFService.sendByEmail(filePath, settings.reportEmail);
    });

  const isBusy = loadingAction !== null;

  // ── RENDERIZADO ───────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reportes</Text>
          <Text style={styles.headerSubtitle}>EXPORTACIÓN Y FINANZAS SEMANALES</Text>
        </View>

        {/* NAVEGADOR DE SEMANA */}
        <View style={styles.weekNavigatorCard}>
          <TouchableOpacity
            style={styles.weekButton}
            onPress={() => handleOffsetChange(-1)}
            disabled={isBusy}
          >
            <Text style={styles.weekButtonText}>← Atrás</Text>
          </TouchableOpacity>

          <View style={styles.weekInfoGroup}>
            <Text style={styles.weekLabel}>SEMANA SELECCIONADA</Text>
            <Text style={styles.weekRange}>{periodLabel}</Text>
          </View>

          <TouchableOpacity
            style={[styles.weekButton, weekOffset >= 0 && styles.weekButtonDisabled]}
            onPress={() => handleOffsetChange(1)}
            disabled={weekOffset >= 0 || isBusy}
          >
            <Text style={styles.weekButtonText}>Sig →</Text>
          </TouchableOpacity>
        </View>

        {/* CONTENIDO ESTADO DE CARGA */}
        {isLoadingSessions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PALETTE.mutedGold} />
            <Text style={styles.loadingText}>Calculando resumen de nómina...</Text>
          </View>
        ) : (
          <>
            {/* MÉTRICAS PRINCIPALES */}
            <SummaryBlock
              metrics={[
                { title: 'TOTAL HORAS', value: formatHours(summary.totalHours) },
                { title: 'INGRESOS', value: formatCurrency(summary.totalEarnings), accentValue: true },
                { title: 'JORNADAS', value: `${summary.sessionCount}` },
              ]}
            />

            {/* DESGLOSE FINANCIERO */}
            <View style={styles.breakdownCard}>
              <Text style={styles.cardSectionTitle}>DESGLOSE DE TARIFA Y OVERTIME</Text>
              
              <View style={styles.breakdownRow}>
                <Text style={styles.rowLabel}>Horas Ordinarias Base</Text>
                <Text style={styles.rowValue}>
                  {formatHours(Math.max(0, summary.totalHours - summary.overtimeHours))}
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.rowLabel}>Horas Extra (Overtime)</Text>
                <Text style={styles.rowValue}>{formatHours(summary.overtimeHours)}</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.rowLabel}>Tarifa Base Configurada</Text>
                <Text style={styles.rowValue}>{formatCurrency(summary.baseRate)} /h</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.rowLabel}>Multiplicador Overtime</Text>
                <Text style={styles.rowValue}>x{summary.overtimeMultiplier}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.breakdownRow}>
                <Text style={styles.totalLabel}>TOTAL CONSOLIDADO</Text>
                <Text style={styles.totalValue}>{formatCurrency(summary.totalEarnings)}</Text>
              </View>
            </View>

            {/* OPCIONES DE EXPORTACIÓN */}
            <View style={styles.exportSection}>
              <Text style={styles.cardSectionTitle}>EXPORTACIÓN Y COMPARTICIÓN (PDF)</Text>

              <View style={styles.exportBtnGroup}>
                <Button
                  label="Previsualizar Reporte"
                  variant="secondary"
                  size="md"
                  onPress={handlePreviewReport}
                  loading={loadingAction === 'preview'}
                  disabled={isBusy || !hasReportData}
                  iconName="file-text"
                />

                <Button
                  label="Compartir PDF"
                  variant="primary"
                  size="md"
                  onPress={handleShareReport}
                  loading={loadingAction === 'share'}
                  disabled={isBusy || !hasReportData}
                  iconName="file-text"
                />

                <Button
                  label="Enviar por Correo"
                  variant="outline"
                  size="md"
                  onPress={handleEmailReport}
                  loading={loadingAction === 'email'}
                  disabled={isBusy || !hasReportData}
                  iconName="file-text"
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ── ESTILOS ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
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
  weekNavigatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.carbonMist,
    borderRadius: RADIUS.cards,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    marginHorizontal: SPACING.xl,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  weekInfoGroup: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabel: {
    color: TEXT.muted,
    fontSize: FONT.label.size - 1,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'Montserrat',
  },
  weekRange: {
    color: TEXT.primary,
    fontSize: FONT.bodyStrong.size,
    fontWeight: '700',
    fontFamily: 'Montserrat',
    marginTop: 4,
  },
  weekButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: PALETTE.graphite,
    borderRadius: RADIUS.pills,
    borderWidth: 1,
    borderColor: PALETTE.steelLine,
  },
  weekButtonDisabled: {
    opacity: 0.3,
  },
  weekButtonText: {
    color: TEXT.secondary,
    fontSize: FONT.captionStrong.size,
    fontWeight: '600',
    fontFamily: 'Montserrat',
  },
  loadingContainer: {
    padding: SPACING.xxxl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    color: TEXT.secondary,
    fontSize: FONT.body.size,
    fontFamily: 'Montserrat',
  },
  breakdownCard: {
    backgroundColor: PALETTE.graphite,
    borderRadius: RADIUS.cards,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    marginHorizontal: SPACING.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  cardSectionTitle: {
    color: TEXT.secondary,
    fontSize: FONT.label.size,
    fontWeight: '700',
    letterSpacing: FONT.label.letterSpacing,
    fontFamily: 'Montserrat',
    marginBottom: SPACING.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs + 2,
  },
  rowLabel: {
    color: TEXT.muted,
    fontSize: FONT.body.size - 1,
    fontFamily: 'Montserrat',
  },
  rowValue: {
    color: TEXT.primary,
    fontSize: FONT.bodyStrong.size - 1,
    fontWeight: '600',
    fontFamily: 'Montserrat',
  },
  divider: {
    height: 1,
    backgroundColor: PALETTE.steelLine,
    marginVertical: SPACING.sm,
  },
  totalLabel: {
    color: TEXT.primary,
    fontSize: FONT.bodyStrong.size,
    fontWeight: '700',
    fontFamily: 'Montserrat',
  },
  totalValue: {
    color: PALETTE.mutedGold,
    fontSize: FONT.h3.size,
    fontWeight: '700',
    fontFamily: 'Montserrat',
  },
  exportSection: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  exportBtnGroup: {
    gap: SPACING.md,
  },
});
