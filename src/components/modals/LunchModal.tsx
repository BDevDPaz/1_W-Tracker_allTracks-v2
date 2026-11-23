import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Input } from "@/components/atoms/Input";
import { Surface } from "@/components/atoms/Surface";
import { PALETTE, FONT, RADIUS, SHADOWS, SPACING, TEXT } from "@/theme";

interface LunchModalProps {
  visible: boolean;
  defaultMinutes?: number;
  onClose: () => void;
  onSubmit: (minutes: number) => Promise<void>;
}

export const LunchModal: React.FC<LunchModalProps> = ({
  visible,
  defaultMinutes = 30,
  onClose,
  onSubmit,
}) => {
  const [minutes, setMinutes] = useState(String(defaultMinutes));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (visible) setMinutes(String(defaultMinutes));
  }, [visible, defaultMinutes]);

  const handleSubmit = async () => {
    const mins = parseInt(minutes, 10);
    if (!Number.isInteger(mins) || mins < 0) {
      setError("Ingresa un número válido mayor o igual a 0.");
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      await onSubmit(mins);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar jornada");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.overlay}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Surface
            variant="elevated"
            radius="hero"
            style={[styles.content, SHADOWS.hero]}
          >
            <View style={styles.header}>
              <Icon name="coffee" size={24} color={PALETTE.amberWarning} />
              <Text style={styles.title}>Cierre de Jornada</Text>
            </View>

            <Text style={styles.description}>
              Confirma el tiempo de almuerzo o descansos no pagados que deben
              descontarse del total de hoy. El valor viene de Ajustes, pero aquí
              pones lo real de hoy.
            </Text>

            <Input
              label="Minutos a descontar"
              placeholder="0"
              keyboardType="number-pad"
              value={minutes}
              onChangeText={(text) => {
                setMinutes(text);
                setError(undefined);
              }}
              error={error}
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
                title="Consolidar"
                variant="primary"
                onPress={handleSubmit}
                loading={loading}
                style={styles.actionButton}
              />
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flexGrow: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  content: {
    padding: SPACING.xl,
    width: "100%",
    borderColor: PALETTE.amberWarning,
    borderRadius: RADIUS.hero,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: { fontSize: FONT.h3.size, fontWeight: "800", color: TEXT.primary, letterSpacing: -0.2 },
  description: {
    fontSize: FONT.body.size,
    color: TEXT.secondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  actions: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.md },
  actionButton: { flex: 1 },
});
