// ============================================================
// MODAL: ExitDetectionModal — Decision Hub por salida de geocerca (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint de Navegación — Sección 3.3 | Identidad V2
// Responsabilidad: Se activa automáticamente al detectar abandono del perímetro de trabajo.
// REGLA: CTAs equilibradas para prevenir cierres involuntarios de la jornada.
// ============================================================

import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { Button } from '../components/atoms/Button';
import { Icon } from '../components/atoms/Icon';
import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../theme';

export interface ExitDetectionModalProps {
  visible: boolean;
  exitTime: string; // Formato HH:MM
  onConfirmExit: () => void;
  onStayWorking: () => void;
  loading?: boolean;
}

export const ExitDetectionModal: React.FC<ExitDetectionModalProps> = React.memo(({
  visible,
  exitTime,
  onConfirmExit,
  onStayWorking,
  loading = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onStayWorking}
    >
      <TouchableWithoutFeedback onPress={onStayWorking}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Ícono de Alerta de Salida */}
              <View style={styles.iconContainer}>
                <Icon name="alert-triangle" size={28} color={PALETTE.amberWarning} strokeWidth={2.5} />
              </View>

              {/* Título y Mensaje Explicativo */}
              <Text style={styles.title}>SALIDA DETECTADA</Text>
              <Text style={styles.exitTimeLabel}>Detección a las {exitTime}</Text>

              <Text style={styles.description}>
                Se detectó que saliste del radio de la geocerca de tu destino activo.
                {'\n\n'}
                ¿Deseas finalizar tu jornada laboral ahora o continuar trabajando?
              </Text>

              {/* Botones de Decisión */}
              <View style={styles.actionGroup}>
                <Button
                  label="Cerrar Jornada"
                  variant="danger"
                  size="md"
                  onPress={onConfirmExit}
                  loading={loading}
                  loadingText="Cerrando..."
                  iconName="stop"
                  style={styles.actionButton}
                />

                <Button
                  label="Sigo Trabajando"
                  variant="secondary"
                  size="md"
                  onPress={onStayWorking}
                  disabled={loading}
                  iconName="play"
                  style={styles.actionButton}
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
    backgroundColor: 'rgba(5, 5, 5, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: PALETTE.carbonMist,
    borderRadius: RADIUS.modals,
    borderColor: PALETTE.amberWarning,
    borderWidth: 1.5,
    padding: SPACING.xl,
    alignItems: 'center',
    shadowColor: PALETTE.amberWarning,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 124, 0, 0.12)',
    borderColor: PALETTE.amberWarning,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    color: TEXT.primary,
    fontSize: FONT.h3.size,
    fontWeight: '700',
    fontFamily: 'Montserrat',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  exitTimeLabel: {
    color: PALETTE.amberWarning,
    fontSize: FONT.captionStrong.size,
    fontWeight: '600',
    fontFamily: 'Montserrat',
    marginTop: SPACING.xxs,
    marginBottom: SPACING.md,
  },
  description: {
    color: TEXT.secondary,
    fontSize: FONT.body.size - 1,
    lineHeight: FONT.body.lineHeight + 2,
    fontFamily: 'Montserrat',
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  actionGroup: {
    width: '100%',
    gap: SPACING.md,
  },
  actionButton: {
    width: '100%',
  },
});
