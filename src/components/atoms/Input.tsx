import React from "react";
import type { TextInputProps, ViewStyle } from "react-native";
import { TextInput, View, Text, StyleSheet } from "react-native";
import { PALETTE, RADIUS, SPACING, TEXT, FONT } from "@/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  ...props
}) => {
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={TEXT.muted}
        style={[styles.input, error ? styles.inputError : undefined, style]}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
    width: "100%",
  },
  label: {
    fontSize: FONT.captionStrong.size,
    color: TEXT.secondary,
    marginBottom: SPACING.xs,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: PALETTE.obsidian,
    borderWidth: 1,
    borderColor: PALETTE.steelLine,
    borderRadius: RADIUS.inputs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    color: TEXT.primary,
    fontSize: FONT.body.size,
  },
  inputError: {
    borderColor: PALETTE.deepRed,
  },
  errorText: {
    fontSize: FONT.caption.size,
    color: PALETTE.deepRed,
    marginTop: SPACING.xxs,
  },
});
