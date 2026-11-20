import React, { useState, useEffect } from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Input } from "@/components/atoms/Input";
import { Surface } from "@/components/atoms/Surface";
import { PALETTE, FONT, SPACING, TEXT } from "@/theme";
import type { Session } from "@/types/contracts";

interface EditSessionModalProps {
  visible: boolean;
  session: Session | null;
  onClose: () => void;
  onSubmit: (id: string, patch: Partial<Session>) => Promise<void>;
}

export const EditSessionModal: React.FC<EditSessionModalProps> = ({
  visible,
  session,
  onClose,
  onSubmit,
}) => {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (visible && session) {
      setStartTime(session.startTime);
      setEndTime(session.endTime || "");
      setNotes(session.notes || "");
      setError(undefined);
    }
  }, [visible, session]);

  const isValidTime = (val: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(val);

  const handleSubmit = async () => {
    if (!session) return;
    const startT = startTime.trim();
    const endT = endTime.trim();

    if (!isValidTime(startT)) {
      setError("Hora de inicio inválida (Usa HH:MM)");
      return;
    }
    if (endT && !isValidTime(endT)) {
      setError("Hora final inválida (Usa HH:MM)");
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      await onSubmit(session.id, {
        startTime: startT,
        endTime: endT || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar ajuste");
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Surface variant="elevated" style={styles.content}>
          <View style={styles.header}>
            <Icon name="pencil" size={24} color={PALETTE.neutralGray} />
            <Text style={styles.title}>Ajuste Manual</Text>
          </View>

          <Text style={styles.description}>
            Cualquier modificación marcará la auditoría forense de esta jornada
            como "Ajuste Manual".
          </Text>

          <View style={styles.row}>
            <Input
              label="Inicio (HH:MM)"
              placeholder="08:00"
              value={startTime}
              onChangeText={setStartTime}
              containerStyle={styles.halfInput}
            />
            <Input
              label="Fin (HH:MM)"
              placeholder="17:00"
              value={endTime}
              onChangeText={setEndTime}
              containerStyle={styles.halfInput}
            />
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <Input
            label="Notas / Justificación"
            placeholder="Razón del ajuste..."
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ height: 80 }}
          />

          <View style={styles.actions}>
            <Button
              title="Cancelar"
              variant="outline"
              onPress={onClose}
              disabled={loading}
              style={styles.actionButton}
            />
            <Button
              title="Aplicar"
              variant="secondary"
              onPress={handleSubmit}
              loading={loading}
              style={styles.actionButton}
            />
          </View>
        </Surface>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  content: {
    padding: SPACING.xl,
    width: "100%",
    borderColor: PALETTE.neutralGray,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: { fontSize: FONT.h3.size, fontWeight: "700", color: TEXT.primary },
  description: {
    fontSize: FONT.caption.size,
    color: TEXT.muted,
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },
  row: { flexDirection: "row", gap: SPACING.md, width: "100%" },
  halfInput: { flex: 1 },
  actions: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.md },
  actionButton: { flex: 1 },
  errorText: {
    color: PALETTE.deepRed,
    fontSize: FONT.caption.size,
    marginBottom: SPACING.sm,
    marginTop: -SPACING.sm,
  },
});
