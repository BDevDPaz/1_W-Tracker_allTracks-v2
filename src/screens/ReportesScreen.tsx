import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header, Surface, Icon, Button, MetricTile } from "@/components";
import {
  sessionRepository,
  PDFService,
  settingsService,
  ToastService,
} from "@/services";
import { PALETTE, FONT, SPACING, TEXT, RADIUS } from "@/theme";
import type { Session, WeeklySummary, PDFReport } from "@/types/contracts";
import {
  getWeekStart,
  formatWeekRange,
  formatCurrency,
  formatHours,
} from "@/utils";

export const ReportesScreen: React.FC = () => {
  // ── ESTADO LOCAL ─────────────────────────────────────────────────────────
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [periodLabel, setPeriodLabel] = useState("");

  // ── CARGA DE DATOS (POR SEMANA) ──────────────────────────────────────────
  const loadWeeklyData = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const weekStart = getWeekStart(offset);

      // Calcular el final de la semana (6 días después del lunes/inicio)
      const startDate = new Date(weekStart + "T00:00:00");
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      const weekEnd = endDate.toISOString().split("T")[0]!;

      const summaryData = await sessionRepository.getWeeklySummary(
        weekStart,
        weekEnd,
      );
      const sessionsData = await sessionRepository.getByPeriod(
        weekStart,
        weekEnd,
      );

      setSummary(summaryData);
      setSessions(sessionsData);
      setPeriodLabel(formatWeekRange(weekStart));
    } catch (error) {
      console.error("[ReportesScreen Error]", error);
      ToastService.push({
        type: "error",
        text: "Error al cargar el resumen semanal.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWeeklyData(weekOffset);
  }, [weekOffset, loadWeeklyData]);

  // ── HANDLERS DE NAVEGACIÓN ───────────────────────────────────────────────
  const handlePrevWeek = () => setWeekOffset((prev) => prev - 1);
  const handleNextWeek = () => setWeekOffset((prev) => prev + 1);

  // ── EXPORTACIÓN PDF ──────────────────────────────────────────────────────
  const buildReportObject = (): PDFReport | null => {
    if (!summary) return null;
    return {
      filePath: "", // Se genera internamente en PDFService
      generatedAt: new Date().toISOString(),
      workDaysIncluded: sessions.length,
      periodLabel,
      summary,
      sessions,
    };
  };

  const handleAction = async (action: "preview" | "share" | "email") => {
    const report = buildReportObject();
    if (!report || sessions.length === 0) {
      ToastService.push({
        type: "warning",
        text: "No hay jornadas para exportar en este periodo.",
      });
      return;
    }

    setGenerating(true);
    try {
      const filePath = await PDFService.generate(report);

      if (action === "preview") {
        await PDFService.preview(filePath);
      } else if (action === "share") {
        await PDFService.share(filePath);
      } else if (action === "email") {
        const settings = await settingsService.load();
        await PDFService.sendByEmail(filePath, settings.reportEmail);
      }
    } catch (error) {
      console.error(`[ReportesScreen Action Error - ${action}]`, error);
      ToastService.push({
        type: "error",
        text: `No se pudo completar la acción: ${action}.`,
      });
    } finally {
      setGenerating(false);
    }
  };

  // ── RENDERIZADO ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="REPORTES" subtitle="AUDITORÍA Y NÓMINA" />

      {/* Navegador de Semanas */}
      <View style={styles.weekNavigator}>
        <TouchableOpacity
          onPress={handlePrevWeek}
          style={styles.navButton}
          disabled={loading || generating}
        >
          <Icon name="chevron-right" size={24} color={PALETTE.mutedGold} />
          {/* Usamos un truco de rotación para reusar el ícono o podríamos usar un chevron-left si lo tuviéramos */}
          <View
            style={{ position: "absolute", transform: [{ rotate: "180deg" }] }}
          >
            <Icon name="chevron-right" size={24} color={PALETTE.mutedGold} />
          </View>
        </TouchableOpacity>

        <View style={styles.periodContainer}>
          <Text style={styles.periodText}>
            {loading ? "Cargando..." : periodLabel}
          </Text>
          {weekOffset === 0 && (
            <Text style={styles.currentWeekBadge}>SEMANA ACTUAL</Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleNextWeek}
          style={styles.navButton}
          disabled={loading || generating || weekOffset >= 0}
        >
          <Icon
            name="chevron-right"
            size={24}
            color={weekOffset >= 0 ? TEXT.muted : PALETTE.mutedGold}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Resumen de Rendimiento */}
        <Surface variant="base" padding="lg" style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Resumen Financiero</Text>

          <View style={styles.metricsGrid}>
            <View style={styles.metricColumn}>
              <MetricTile
                label="Horas Base"
                value={formatHours(
                  summary?.totalHours
                    ? Math.max(
                        0,
                        summary.totalHours - (summary.overtimeHours || 0),
                      )
                    : 0,
                )}
              />
            </View>
            <View style={styles.metricColumn}>
              <MetricTile
                label="Horas Extra"
                value={formatHours(summary?.overtimeHours || 0)}
                highlight={(summary?.overtimeHours || 0) > 0}
              />
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricColumn}>
              <MetricTile
                label="Días Trabajados"
                value={String(summary?.workDaysCount || 0)}
                icon="calendar"
              />
            </View>
            <View style={styles.metricColumn}>
              <MetricTile
                label="Total Estimado"
                value={formatCurrency(summary?.totalEarnings || 0)}
                icon="dollar-sign"
                highlight
              />
            </View>
          </View>

          {(summary?.manualAdjustments || 0) > 0 && (
            <View style={styles.alertBox}>
              <Icon
                name="alert-triangle"
                size={14}
                color={PALETTE.amberWarning}
              />
              <Text style={styles.alertText}>
                Este reporte contiene {summary?.manualAdjustments} ajuste(s)
                manual(es) etiquetados.
              </Text>
            </View>
          )}
        </Surface>

        {/* Acciones de Exportación */}
        <Surface variant="elevated" padding="lg" style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Exportar Auditoría (PDF)</Text>
          <Text style={styles.description}>
            Genera un documento con validez forense que incluye la línea de
            tiempo de geocercas y cálculos de nómina.
          </Text>

          {generating ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PALETTE.mutedGold} />
              <Text style={styles.loadingText}>Procesando documento...</Text>
            </View>
          ) : (
            <View style={styles.buttonGroup}>
              <Button
                title="Previsualizar"
                variant="outline"
                onPress={() => void handleAction("preview")}
                disabled={!summary || summary.workDaysCount === 0}
                style={styles.actionBtn}
              />
              <Button
                title="Compartir"
                variant="secondary"
                onPress={() => void handleAction("share")}
                disabled={!summary || summary.workDaysCount === 0}
                style={styles.actionBtn}
              />
              <Button
                title="Enviar por Correo"
                variant="primary"
                onPress={() => void handleAction("email")}
                disabled={!summary || summary.workDaysCount === 0}
                style={{ marginTop: SPACING.md }}
              />
            </View>
          )}
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
    paddingTop: Platform.OS === "android" ? 24 : 0,
  },
  weekNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: PALETTE.graphite,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.steelLine,
  },
  navButton: {
    padding: SPACING.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  periodContainer: {
    alignItems: "center",
  },
  periodText: {
    fontSize: FONT.bodyStrong.size,
    fontWeight: "700",
    color: TEXT.primary,
  },
  currentWeekBadge: {
    fontSize: 9,
    fontWeight: "700",
    color: PALETTE.mutedGold,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  summaryCard: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT.h3.size,
    fontWeight: "700",
    color: TEXT.primary,
    marginBottom: SPACING.md,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  metricColumn: {
    flex: 1,
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PALETTE.amberWarningBg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: PALETTE.amberWarning,
    gap: SPACING.sm,
  },
  alertText: {
    fontSize: FONT.caption.size,
    color: PALETTE.amberWarning,
    flex: 1,
  },
  actionsCard: {
    borderColor: PALETTE.mutedGoldDark,
  },
  description: {
    fontSize: FONT.body.size,
    color: TEXT.secondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  buttonGroup: {
    flexDirection: "column",
    gap: SPACING.sm,
  },
  actionBtn: {
    width: "100%",
  },
  loadingContainer: {
    paddingVertical: SPACING.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: TEXT.muted,
    marginTop: SPACING.md,
    fontSize: FONT.body.size,
  },
});
