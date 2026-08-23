// ============================================================
// MODAL: DailySetupModal — Configuración de inicio de jornada (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint de Navegación — Sección 3.1 | Identidad V2
// Responsabilidad: Solicita el destino de trabajo y alias opcional.
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { Button } from '../components/atoms/Button';
import { Icon } from '../components/atoms/Icon';
import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../theme';
import { DailySetupPayload } from '../types';

export interface DailySetupModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (payload: DailySetupPayload) => Promise<void> | void;
  loading?: boolean;
}

export const DailySetupModal: React.FC<DailySetupModalProps> = React.memo(({
  visible,
  onCancel,
  onConfirm,
  loading = false,
}) => {
  const [destination, setDestination] = useState('');
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDestination('');
      setAlias('');
      setError(null);
    }
  }, [visible]);

  const handleConfirm = async () => {
    const trimmedDest = destination.trim();
    if (!trimmedDest) {
      setError('Ingresa la dirección o el nombre del destino');
      return;
    }

    setError(null);
    await onConfirm({
      destination: trimmedDest,
      alias: alias.trim() ? alias.trim() : undefined,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <View style={styles.sheetContainer}>
              {/* Handle Bar Superior */}
              <View style={styles.handleBar} />

              {/* Cabecera del Modal */}
              <View style={styles.header}>
                <View style={styles.iconBadge}>
                  <Icon name="navigation" size={20} color={PALETTE.mutedGold} strokeWidth={2.5} />
                </View>
                <View style={styles.headerTitleGroup}>
                  <Text style={styles.title}>INICIAR JORNADA</Text>
                  <Text style={styles.subtitle}>Configura tu destino operativo de trabajo</Text>
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

              {/* Formulario */}
              <View style={styles.formContainer}>
                {/* Campo Destino */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>DIRECCIÓN O LUGAR DE TRABAJO *</Text>
                  <View style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}>
                    <Icon name="map-pin" size={18} color={TEXT.muted} strokeWidth={2} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ej: 123 Main St, Miami FL"
                      placeholderTextColor={TEXT.muted}
                      value={destination}
                      onChangeText={(text) => {
                        setDestination(text);
                        if (error) setError(null);
                      }}
                      editable={!loading}
                      autoCapitalize="words"
                    />
                  </View>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>

                {/* Campo Alias Opcional */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>ALIAS O NOMBRE DEL CLIENTE (OPCIONAL)</Text>
                  <View style={styles.inputWrapper}>
                    <Icon name="briefcase" size={18} color={TEXT.muted} strokeWidth={2} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ej: Oficina central, Cliente A"
                      placeholderTextColor={TEXT.muted}
                      value={alias}
                      onChangeText={setAlias}
                      editable={!loading}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
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
                  label="Iniciar"
                  variant="primary"
                  size="md"
                  onPress={handleConfirm}
                  loading={loading}
                  loadingText="Activando..."
                  iconName="play"
                  disabled={destination.trim().length === 0}
                  style={styles.confirmButton}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
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
  keyboardContainer: {
    width: '100%',
  },
  sheetContainer: {
    backgroundColor: PALETTE.carbonMist,
    borderTopLeftRadius: RADIUS.modals,
    borderTopRightRadius: RADIUS.modals,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxxl : SPACING.xl,
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
    marginBottom: SPACING.xl,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(197, 160, 89, 0.12)',
    borderColor: PALETTE.mutedGold,
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
  formContainer: {
    gap: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  fieldGroup: {
    gap: SPACING.xs + 2,
  },
  label: {
    color: TEXT.secondary,
    fontSize: FONT.label.size,
    fontWeight: FONT.label.weight,
    letterSpacing: FONT.label.letterSpacing,
    fontFamily: 'Montserrat',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.graphite,
    borderColor: PALETTE.steelLine,
    borderWidth: 1,
    borderRadius: RADIUS.inputs,
    paddingHorizontal: SPACING.md,
    height: 48,
    gap: SPACING.sm,
  },
  inputWrapperError: {
    borderColor: PALETTE.deepRed,
  },
  input: {
    flex: 1,
    color: TEXT.primary,
    fontSize: FONT.body.size,
    fontFamily: 'Montserrat',
  },
  errorText: {
    color: PALETTE.deepRed,
    fontSize: FONT.caption.size,
    fontFamily: 'Montserrat',
    marginTop: SPACING.xxs,
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
