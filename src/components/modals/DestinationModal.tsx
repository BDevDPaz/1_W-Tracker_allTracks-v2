import React, { useState } from "react";
import {
  View,
  Modal,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Input } from "@/components/atoms/Input";
import { Surface } from "@/components/atoms/Surface";
import { PALETTE, SPACING, FONT, TEXT } from "@/theme";

interface DestinationModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (destination: string, alias?: string) => Promise<void>;
}

export const DestinationModal: React.FC<DestinationModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [destination, setDestination] = useState("");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!destination.trim()) return;

    setLoading(true);
    try {
      await onSubmit(destination.trim(), alias.trim() || undefined);
      setDestination("");
      setAlias("");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDestination("");
    setAlias("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Surface variant="elevated" style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Icon name="truck" size={24} color={PALETTE.royalBlue} />
              <Text style={styles.title}>Iniciar Traslado</Text>
            </View>
            <Text style={styles.subtitle}>
              Registraremos tu movimiento hacia una nueva ubicación.
            </Text>
          </View>

          <ScrollView
            style={styles.formContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Input
              label="Dirección del Nuevo Destino"
              placeholder="Ej: 5320 Newcastle Ave"
              value={destination}
              onChangeText={setDestination}
              autoCapitalize="words"
            />

            <Input
              label="Alias / Cliente (Opcional)"
              placeholder="Ej: Proyecto Vallejo"
              value={alias}
              onChangeText={setAlias}
              autoCapitalize="words"
              containerStyle={{ marginBottom: 0 }}
            />
          </ScrollView>

          <View style={styles.actions}>
            <Button
              title="Cancelar"
              variant="outline"
              onPress={handleClose}
              disabled={loading}
              style={styles.flexBtn}
            />
            <Button
              title="Iniciar Traslado"
              variant="primary"
              onPress={handleSubmit}
              loading={loading}
              disabled={!destination.trim()}
              style={styles.flexBtn}
            />
          </View>
        </Surface>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    paddingBottom: Platform.OS === "ios" ? 40 : SPACING.xl,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT.h2.size,
    fontWeight: "800",
    color: TEXT.primary,
  },
  subtitle: {
    fontSize: FONT.body.size,
    color: TEXT.secondary,
  },
  formContainer: {
    maxHeight: 300,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  flexBtn: {
    flex: 1,
  },
});
