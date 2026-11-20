import React, { useState } from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Input } from "@/components/atoms/Input";
import { Surface } from "@/components/atoms/Surface";
import { PALETTE, FONT, SPACING, TEXT } from "@/theme";

interface DailySetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (destination: string, alias?: string) => Promise<void>;
}

export const DailySetupModal: React.FC<DailySetupModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [destination, setDestination] = useState("");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async () => {
    const destTrimmed = destination.trim();
    if (!destTrimmed) {
      setError("El destino principal es obligatorio.");
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      await onSubmit(destTrimmed, alias.trim() || undefined);
      setDestination("");
      setAlias("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al configurar jornada",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setDestination("");
    setAlias("");
    setError(undefined);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Surface variant="elevated" style={styles.content}>
          <View style={styles.header}>
            <Icon name="map-pin" size={24} color={PALETTE.mutedGold} />
            <Text style={styles.title}>Configurar Jornada</Text>
          </View>

          <Text style={styles.description}>
            Define la ubicación en la que trabajarás hoy para establecer la
            geocerca.
          </Text>

          <Input
            label="Destino Principal *"
            placeholder="Ej: 123 Main St, Los Angeles"
            value={destination}
            onChangeText={(text) => {
              setDestination(text);
              setError(undefined);
            }}
            error={error}
          />

          <Input
            label="Alias (Opcional)"
            placeholder="Ej: Casa de los Smith"
            value={alias}
            onChangeText={setAlias}
          />

          <View style={styles.actions}>
            <Button
              title="Cancelar"
              variant="outline"
              onPress={handleClose}
              disabled={loading}
              style={styles.actionButton}
            />
            <Button
              title="Iniciar"
              variant="primary"
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
    borderColor: PALETTE.mutedGoldDark,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: { fontSize: FONT.h3.size, fontWeight: "700", color: TEXT.primary },
  description: {
    fontSize: FONT.body.size,
    color: TEXT.secondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  actions: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.md },
  actionButton: { flex: 1 },
});
