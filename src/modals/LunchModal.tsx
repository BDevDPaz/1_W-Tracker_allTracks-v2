// ============================================================
// MODAL: LunchModal — Selección de pausa de almuerzo (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint de Navegación — Sección 3.2 | Identidad V2
// Responsabilidad: Intercepta el cierre de jornada para aplicar el descuento no remunerado.
// REGLA: Se ejecuta SIEMPRE antes de liquidar la sesión.
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { Button } from '../components/atoms/Button';
import { Icon } from '../components/atoms/Icon';
import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../theme';
import { LunchModalPayload } from '../types';

export interface LunchModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (payload: LunchModalPayload) => void;
  loading?: boolean;
}

type LunchMinutes = 0 | 30 | 45 | 60;

const LUNCH_OPTIONS: Array<{ minutes: LunchMinutes; label: string; desc: string }> = [
  { minutes: 0, label: 'Sin descanso', desc: 'Jornada continua sin deducción de tiempo' },
  { minutes: 30, label: '30 Minutos', desc: 'Descuento estándar de media hora' },
  { minutes: 45, label: '45 Minutos', desc: 'Pausa intermedia para comida' },
  { minutes: 60, label: '60 Minutos', desc: 'Descuento completo de una hora' },
];

export const LunchModal: React.FC<LunchModalProps> = React.memo(({
  visible,
  onCancel,
  onConfirm,
  loading = false,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState<LunchMinutes>(30);

  useEffect(() => {
    if (visible) {
      setSelectedMinutes(30);
    }
  }, [visible]);

  const handleConfirm = () => {
    onConfirm({ minutes: selectedMinutes });
  };

  const activeColor = PALETTE.amberWarning || '#F57C00';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Handle Bar Superior */}
              <View style={styles.handleBar} />

              {/* Cabecera del Modal */}
              <View style={styles.header}>
                <View style={[styles.iconBadge, { borderColor: activeColor }]}>
                  <Icon name="coffee" size={20} color={activeColor} strokeWidth={2.5} />
                </View>
                <View style={styles.headerTitleGroup}>
                  <Text style={styles.title}>DESCUENTO DE ALMUERZO</Text>
                  <Text style={styles.subtitle}>Selecciona el tiempo de pausa no remunerado</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onCancel}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Icon name="close" size={18} color={TEXT.muted} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Opciones de Selección */}
              <View style={styles.optionsList}>
                {LUNCH_OPTIONS.map((opt) => {
                  const isSelected = selectedMinutes === opt.minutes;

                  return (
                    <TouchableOpacity
                      key={`lunch-opt-${opt.minutes}`}
                      style={[
                        styles.optionCard,
                        isSelected && { borderColor: activeColor, backgroundColor: 'rgba(245, 124, 0, 0.12)' },
                      ]}
                      onPress={() => setSelectedMinutes(opt.minutes)}
                      activeOpacity={0.8}
                      disabled={loading}
                    >
                      <View style={[styles.radioCircle, isSelected && { borderColor: activeColor }]}>
                        {isSelected && <View style={[styles.radioDot, { backgroundColor: activeColor }]} />}
                      </View>

                      <View style={styles.optionTexts}>
                        <Text style={[styles.optionLabel, isSelected && { color: activeColor }]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.optionDesc}>{opt.desc}</Text>
                      </View>

                      <Icon
                        name={isSelected ? 'check-circle' : 'chevron-right'}
                        size={18}
                        color={isSelected ? activeColor : TEXT.muted}
                        strokeWidth={2}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Resumen dinámico */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>
                  Se descontarán <Text style={[styles.summaryAccent, { color: activeColor }]}>{selectedMinutes} min</Text> del cómputo total de la jornada.
                </Text>
              </View>

              {/* Acciones */}
              <View style={styles.actionGroup}>
                <Button
                  label="Cancelar"
                  variant="secondary"
                  size="md"
                  onPress={onCancel}
                  disabled={loading}
                  style={styles.cancelButton}
                />
                <Button
                  label="Cerrar Jornada"
                  variant="primary"
                  size="md"
                  onPress={handleConfirm}
                  loading={loading}
                  loadingText="Cerrando..."
                  iconName="stop"
                  style={styles.confirmButton}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: PALETTE.carbonMist,
    borderTopLeftRadius: RADIUS.modals,
    borderTopRightRadius: RADIUS.modals,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: PALETTE.steelLineLight || '#333333',
    borderRadius: RADIUS.pills,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(245, 124, 0, 0.12)',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerTitleGroup: {
    flex: 1,
  },
  title: {
    color: TEXT.primary,
    fontSize: FONT.h3.size - 2,
    fontWeight: '700',
    fontFamily: 'Montserrat',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: TEXT.secondary,
    fontSize: FONT.caption.size,
    fontFamily: 'Montserrat',
    marginTop: 2,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  optionsList: {
    gap: SPACING.sm + 2,
    marginBottom: SPACING.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.graphite,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    borderRadius: RADIUS.inputs,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: PALETTE.steelLineLight || '#555555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionTexts: {
    flex: 1,
  },
  optionLabel: {
    color: TEXT.primary,
    fontSize: FONT.bodyStrong.size,
    fontWeight: '600',
    fontFamily: 'Montserrat',
  },
  optionDesc: {
    color: TEXT.muted,
    fontSize: FONT.caption.size,
    fontFamily: 'Montserrat',
    marginTop: 2,
  },
  summaryBox: {
    backgroundColor: PALETTE.graphite,
    borderRadius: RADIUS.inputs,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
  },
  summaryText: {
    color: TEXT.secondary,
    fontSize: FONT.caption.size + 1,
    fontFamily: 'Montserrat',
    textAlign: 'center',
  },
  summaryAccent: {
    fontWeight: '700',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1.5,
  },
});
