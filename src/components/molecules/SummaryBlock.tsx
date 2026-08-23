// ============================================================
// MOLECULE: SummaryBlock — Bloque de resumen financiero y métricas (CONSOLIDADO)
// Versión: 2.0.0 (Workday Tracking Platform - V2 Design Tokens)
// Fuente: Guía Técnica — Sección 2.3 | Blueprint Pantalla Hoy — 2.2
// Previene advertencias de React keys mediante identificadores deterministas.
// ============================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../../theme';

export interface MetricItem {
  title: string;
  subtitle?: string;
  value: string | number;
  unit?: string;
  accentValue?: boolean; // true para resaltar totales financieros (color dorado)
  trend?: 'up' | 'down' | 'neutral';
  conditional?: boolean; // true = se oculta si value es 0
}

export interface SummaryBlockProps {
  metrics: MetricItem[];
}

export const SummaryBlock: React.FC<SummaryBlockProps> = React.memo(({ metrics }) => {
  // Filtrar métricas condicionales que tengan valor 0
  const visibleMetrics = metrics.filter(
    (m) => !(m.conditional && (m.value === 0 || m.value === '0' || m.value === '$0' || m.value === '0.00'))
  );

  return (
    <View style={styles.container}>
      {visibleMetrics.map((metric, index) => {
        const uniqueKey = `metric-${metric.title.toLowerCase().replace(/\s+/g, '-')}-${index}`;

        return (
          <View key={uniqueKey} style={styles.metricCard}>
            <View style={styles.titleContainer}>
              <Text style={styles.titleText}>{metric.title}</Text>
              {metric.subtitle ? (
                <Text style={styles.subtitleText}>{metric.subtitle}</Text>
              ) : null}
            </View>

            <Text
              style={[styles.valueText, metric.accentValue && styles.accentValueText]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {metric.value}
              {metric.unit ? <Text style={styles.unitText}> {metric.unit}</Text> : null}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: PALETTE.graphite,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    borderRadius: RADIUS.inputs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.xs,
    gap: SPACING.xxs + 2,
  },
  titleText: {
    color: TEXT.secondary,
    fontSize: FONT.label.size,
    fontWeight: FONT.label.weight,
    letterSpacing: FONT.label.letterSpacing,
    fontFamily: 'Montserrat',
    textTransform: 'uppercase',
  },
  subtitleText: {
    color: TEXT.muted,
    fontSize: FONT.label.size - 1,
    fontWeight: '500',
    fontFamily: 'Montserrat',
  },
  valueText: {
    color: TEXT.primary,
    fontSize: FONT.h3.size + 4,
    fontWeight: '700',
    fontFamily: 'Montserrat',
  },
  accentValueText: {
    color: PALETTE.mutedGold,
  },
  unitText: {
    fontSize: FONT.body.size,
    fontWeight: '400',
    color: TEXT.secondary,
  },
});
