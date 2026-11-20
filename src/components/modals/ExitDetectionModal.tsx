import React from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Input } from "@/components/atoms/Input";
import { Surface } from "@/components/atoms/Surface";
import { PALETTE, FONT, SPACING, TEXT } from "@/theme";

interface ExitDetectionModalProps {
  visible: boolean;
  onConfirmExit: () => void;
  onStayWorking: () => void;
  loading?: boolean;
}

export const ExitDetectionModal: React.FC<ExitDetectionModalProps> = ({
  visible,
  onConfirmExit,
  onStayWorking,
  loading = false,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Surface variant="elevated" style={styles.content}>
          <View style={styles.iconCircle}>
            <Icon
              name="alert-triangle"
              size={32}
              color={PALETTE.amberWarning}
            />
          </View>

          <Text style={styles.title}>Salida Detectada</Text>
          <Text style={styles.description}>
            El sistema GPS indica que te has alejado del radio de tu destino
            activo. ¿Deseas cerrar la jornada o iniciar tu traslado?
          </Text>

          <View style={styles.actions}>
            <Button
              title="Sigo Trabajando (Falsa Alarma)"
              variant="outline"
              onPress={onStayWorking}
              disabled={loading}
              style={styles.actionButtonFull}
            />
            <Button
              title="Confirmar Salida Definitiva"
              variant="danger"
              onPress={onConfirmExit}
              loading={loading}
              style={styles.actionButtonFull}
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
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  content: {
    padding: SPACING.xxl,
    width: "100%",
    borderColor: PALETTE.amberWarning,
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PALETTE.amberWarningBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT.h2.size,
    fontWeight: "700",
    color: PALETTE.amberWarning,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  description: {
    fontSize: FONT.body.size,
    color: TEXT.secondary,
    textAlign: "center",
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  actions: { width: "100%", gap: SPACING.md },
  actionButtonFull: { width: "100%" },
});
