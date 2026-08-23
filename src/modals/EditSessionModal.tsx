// ============================================================
// MODAL: EditSessionModal — Ajuste manual forense de jornada (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Blueprint Pantalla Historial — Sección 5 | Identidad V2
// Responsabilidad: Ajuste manual de horarios e ingreso de notas de justificación.
// REGLA: Toda edición asigna automáticamente integrityType → 'MANUAL'.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
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
import { Session } from '../types';

export interface EditSessionModalProps {
  visible: boolean;
  session: Session | null;
  onCancel: () => void;
  onConfirm?: (patch: { startTime: string; endTime: string; notes: string }) => Promise<void> | void;
  onSave?: (id: string, patch: { startTime?: string; endTime?: string; notes?: string }) => void;
  loading?: boolean;
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (timeStr: string): number => {
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
};

export const EditSessionModal: React.FC<EditSessionModalProps> = React.memo(({
  visible,
  session,
  onCancel,
  onConfirm,
  onSave,
  loading = false,
}) => {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session && visible) {
      setStartTime(session.startTime || '');
      setEndTime(session.endTime || '');
      setNotes(session.notes || '');
      setError(null);
    }
  }, [session, visible]);

  const handleSave = useCallback(async () => {
    if (!session) return;

    const trimmedStart = startTime.trim();
    const trimmedEnd = endTime.trim();

    // 1. Validar formato HH:MM
    if (!TIME_REGEX.test(trimmedStart)) {
      setError('Hora de entrada inválida. Usa formato HH:MM (ej. 08:30)');
      return;
    }

    if (trimmedEnd && !TIME_REGEX.test(trimmedEnd)) {
      setError('Hora de salida inválida. Usa formato HH:MM (ej. 17:00)');
      return;
    }

    // 2. Validar secuencia lógica de tiempo
    if (trimmedEnd) {
      const startMin = toMinutes(trimmedStart);
      const endMin = toMinutes(trimmedEnd);

      if (startMin >= endMin) {
        setError('La hora de entrada debe ser anterior a la hora de salida');
        return;
      }
    }

    setError(null);

    const patch = {
      startTime: trimmedStart,
      endTime: trimmedEnd,
      notes: notes.trim(),
    };

    if (onConfirm) {
      await onConfirm(patch);
    } else if (onSave) {
      onSave(session.id, patch);
    }
  }, [session, startTime, endTime, notes, onConfirm, onSave]);

  if (!session) return null;

  const hasChanges =
    startTime !== (session.startTime || '') ||
    endTime !== (session.endTime || '') ||
    notes !== (session.notes || '');

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

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Cabecera del Modal */}
                <View style={styles.header}>
                  <View style={styles.iconBadge}>
                    <Icon name="pencil" size={20} color={PALETTE.mutedGold} strokeWidth={2.5} />
                  </View>
                  <View style={styles.headerTitleGroup}>
                    <Text style={styles.title}>AJUSTE MANUAL FORENSE</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {session.alias || session.destination} · {session.date}
                    </Text>
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

                {/* Banner de marca manual */}
                <View style={styles.integrityNotice}>
                  <Icon name="shield-check" size={16} color={PALETTE.amberWarning} strokeWidth={2} />
                  <Text style={styles.integrityNoticeText}>
                    Guardar cambios marcará esta jornada como{' '}
                    <Text style={styles.boldText}>Ajuste Manual (MANUAL)</Text> en los reportes de auditoría.
                  </Text>
                </View>

                {/* Banner de error */}
                {error ? (
                  <View style={styles.errorBanner}>
                    <Icon name="alert-triangle" size={16} color={PALETTE.deepRed} strokeWidth={2} />
                    <Text style={styles.errorBannerText}>{error}</Text>
                  </View>
                ) : null}

                {/* Formulario de Tiempos */}
                <View style={styles.formContainer}>
                  <View style={styles.timeRow}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.label}>HORA ENTRADA (HH:MM) *</Text>
                      <View style={[styles.inputWrapper, error && !TIME_REGEX.test(startTime) ? styles.inputError : null]}>
                        <Icon name="clock" size={16} color={TEXT.muted} strokeWidth={2} />
                        <TextInput
                          style={styles.input}
                          placeholder="08:00"
                          placeholderTextColor={TEXT.muted}
                          value={startTime}
                          onChangeText={(v) => {
                            setStartTime(v);
                            if (error) setError(null);
                          }}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          editable={!loading}
                        />
                      </View>
                    </View>

                    <Text style={styles.timeSeparator}>—</Text>

                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.label}>HORA SALIDA (HH:MM)</Text>
                      <View style={[styles.inputWrapper, error && endTime && !TIME_REGEX.test(endTime) ? styles.inputError : null]}>
                        <Icon name="clock" size={16} color={TEXT.muted} strokeWidth={2} />
                        <TextInput
                          style={styles.input}
                          placeholder="17:00"
                          placeholderTextColor={TEXT.muted}
                          value={endTime}
                          onChangeText={(v) => {
                            setEndTime(v);
                            if (error) setError(null);
                          }}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          editable={!loading}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Campo de Notas */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>NOTA / JUSTIFICACIÓN DEL AJUSTE</Text>
                    <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Escribe una nota justificativa sobre esta edición..."
                        placeholderTextColor={TEXT.muted}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        editable={!loading}
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
                    label="Guardar Cambios"
                    variant="primary"
                    size="md"
                    onPress={handleSave}
                    disabled={!hasChanges || loading}
                    loading={loading}
                    loadingText="Guardando..."
                    iconName="shield-check"
                    style={styles.confirmButton}
                  />
                </View>
              </ScrollView>
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
    maxHeight: '88%',
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
    marginBottom: SPACING.md,
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
  integrityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 124, 0, 0.12)',
    borderColor: PALETTE.amberWarning,
    borderWidth: 1,
    borderRadius: RADIUS.inputs,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  integrityNoticeText: {
    color: TEXT.secondary,
    fontSize: FONT.caption.size,
    fontFamily: 'Montserrat',
    flex: 1,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: TEXT.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 47, 47, 0.12)',
    borderColor: PALETTE.deepRed,
    borderWidth: 1,
    borderRadius: RADIUS.inputs,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  errorBannerText: {
    color: PALETTE.deepRed,
    fontSize: FONT.caption.size,
    fontFamily: 'Montserrat',
    fontWeight: '600',
    flex: 1,
  },
  formContainer: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  timeSeparator: {
    color: TEXT.muted,
    fontSize: 18,
    paddingBottom: 12,
  },
  fieldGroup: {
    gap: SPACING.xs,
  },
  label: {
    color: TEXT.secondary,
    fontSize: FONT.label.size - 1,
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
  inputError: {
    borderColor: PALETTE.deepRed,
  },
  textAreaWrapper: {
    height: 84,
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
  input: {
    flex: 1,
    color: TEXT.primary,
    fontSize: FONT.body.size,
    fontFamily: 'Montserrat',
  },
  textArea: {
    height: '100%',
    textAlignVertical: 'top',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1.5,
  },
});
