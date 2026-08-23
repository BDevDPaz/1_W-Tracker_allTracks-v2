// ============================================================
// ORGANISM: SystemHealthBlock — Diagnóstico y salud operativa (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint Pantalla Hoy — Sección 2.3 | Identidad V2
// Monitorea permisos GPS, geocercas activas, notificaciones y estado background.
// REGLA: Prohibido mostrar detalles de implementación técnica (schedulers, mutex, etc.)
// ============================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../../theme';
import { SystemHealth, SystemHealthStatus } from '../../types/contracts';
import { Icon, IconName } from '../atoms/Icon';

export interface SystemHealthBlockProps {
  health: SystemHealth;
}

interface HealthItem {
  key: string;
  title: string;
  subtitle: string;
  status: SystemHealthStatus;
  iconName: IconName;
}

const STATUS_COLORS: Record<SystemHealthStatus, { main: string; bg: string; label: string }> = {
  OK: {
    main: PALETTE.successGreen,
    bg: 'rgba(46, 125, 50, 0.12)',
    label: 'Activo',
  },
  WARNING: {
    main: PALETTE.amberWarning,
    bg: 'rgba(245, 124, 0, 0.12)',
    label: 'Revisar',
  },
  ERROR: {
    main: PALETTE.deepRed,
    bg: 'rgba(211, 47, 47, 0.12)',
    label: 'Inactivo',
  },
};

export const SystemHealthBlock: React.FC<SystemHealthBlockProps> = React.memo(({ health }) => {
  const items: HealthItem[] = [
    {
      key: 'location',
      title: 'Ubicación',
      subtitle: health.locationPermission === 'OK' ? 'Permiso concedido' : 'Verificar GPS',
      status: health.locationPermission || 'OK',
      iconName: 'map-pin',
    },
    {
      key: 'background',
      title: 'Segundo Plano',
      subtitle: (health.backgroundLocation || health.locationPermission) === 'OK' ? 'Monitoreo activo' : 'Requiere permiso',
      status: health.backgroundLocation || health.locationPermission || 'OK',
      iconName: 'navigation',
    },
    {
      key: 'geofence',
      title: 'Geocerca Nativa',
      subtitle: health.geofenceActive === 'OK' ? 'Área monitoreada' : 'En pausa',
      status: health.geofenceActive || 'OK',
      iconName: 'shield-check',
    },
    {
      key: 'notifications',
      title: 'Notificaciones',
      subtitle: health.notificationsReady === 'OK' ? 'Alertas activas' : 'Desactivadas',
      status: health.notificationsReady || 'OK',
      iconName: 'clock',
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>DIAGNÓSTICO Y SALUD DEL SISTEMA</Text>

      <View style={styles.grid}>
        {items.map((item) => {
          const statusConfig = STATUS_COLORS[item.status] || STATUS_COLORS.OK;

          return (
            <View key={item.key} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: statusConfig.bg }]}>
                  <Icon name={item.iconName} size={14} color={statusConfig.main} strokeWidth={2.5} />
                </View>
                <View style={[styles.statusDot, { backgroundColor: statusConfig.main }]} />
              </View>

              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>

              <Text style={[styles.statusLabel, { color: statusConfig.main }]}>
                {statusConfig.label.toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    color: TEXT.secondary,
    fontSize: FONT.label.size,
    fontWeight: FONT.label.weight,
    letterSpacing: FONT.label.letterSpacing,
    fontFamily: 'Montserrat',
    marginBottom: SPACING.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  card: {
    width: '47.5%',
    backgroundColor: PALETTE.graphite,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    borderRadius: RADIUS.inputs,
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  itemTitle: {
    color: TEXT.primary,
    fontSize: FONT.captionStrong.size,
    fontWeight: '600',
    fontFamily: 'Montserrat',
    marginBottom: 2,
  },
  itemSubtitle: {
    color: TEXT.muted,
    fontSize: FONT.label.size - 1,
    fontFamily: 'Montserrat',
    marginBottom: SPACING.xs,
  },
  statusLabel: {
    fontSize: FONT.label.size - 2,
    fontWeight: FONT.label.weight,
    letterSpacing: 1,
    fontFamily: 'Montserrat',
  },
});
