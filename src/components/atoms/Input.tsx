import React, { useState } from "react";
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
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={TEXT.muted}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error ? styles.inputError : undefined,
          style,
        ]}
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
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: PALETTE.graphite,
    borderWidth: 1,
    borderColor: PALETTE.steelLine,
    borderRadius: RADIUS.inputs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    color: TEXT.primary,
    fontSize: FONT.body.size,
  },
  inputFocused: {
    borderColor: PALETTE.mutedGold,
    borderWidth: 1.2,
  },
  inputError: {
    borderColor: PALETTE.deepRed,
  },
  errorText: {
    fontSize: FONT.caption.size,
    color: PALETTE.deepRed,
    marginTop: SPACING.xs,
  },
});
