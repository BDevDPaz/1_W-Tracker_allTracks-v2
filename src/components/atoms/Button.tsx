// ============================================================
// ATOM: Button — Botón atómico de acción (CONSOLIDADO V2.0)
// Versión: 2.0.0 (Workday Tracking Design System)
// Fuente: Guía Técnica — Sección 2.1 | Refactor de Identidad V2
// Variantes: primary, secondary, danger, outline, ghost
// REGLA: Solo 1 botón variant="primary" por pantalla simultáneamente
// ============================================================

import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { FONT, PALETTE, RADIUS, SPACING, TEXT } from '../../theme';
import { Icon, IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconName?: IconName;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
}

const HEIGHT_BY_SIZE: Record<ButtonSize, number> = {
  sm: 38,
  md: 48,
  lg: 56,
};

export const Button: React.FC<ButtonProps> = React.memo(({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  loadingText,
  fullWidth = false,
  icon,
  iconName,
  iconPosition = 'left',
  style,
}) => {
  const isInteractive = !disabled && !loading;

  const getContainerStyle = (): ViewStyle => {
    let bg: string = PALETTE.mutedGold;
    let border: string = 'transparent';

    switch (variant) {
      case 'primary':
        bg = PALETTE.mutedGold;
        break;
      case 'secondary':
        bg = PALETTE.graphite;
        border = PALETTE.steelLine;
        break;
      case 'danger':
        bg = PALETTE.deepRed;
        break;
      case 'outline':
        bg = 'transparent';
        border = PALETTE.steelLine;
        break;
      case 'ghost':
        bg = 'transparent';
        break;
    }

    let paddingHorizontal: number = SPACING.xl;
    if (size === 'sm') paddingHorizontal = SPACING.md;
    if (size === 'lg') paddingHorizontal = SPACING.xxl;

    return {
      backgroundColor: bg,
      borderColor: border,
      borderWidth: border !== 'transparent' ? 1 : 0,
      borderRadius: RADIUS.inputs,
      height: HEIGHT_BY_SIZE[size],
      paddingHorizontal,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      opacity: disabled ? 0.45 : 1,
      width: fullWidth ? '100%' : undefined,
    };
  };

  const getTextStyle = (): TextStyle => {
    let color: string = PALETTE.obsidian;

    switch (variant) {
      case 'primary':
        color = PALETTE.obsidian;
        break;
      case 'secondary':
      case 'outline':
        color = TEXT.primary;
        break;
      case 'danger':
        color = '#FFFFFF';
        break;
      case 'ghost':
        color = TEXT.secondary;
        break;
    }

    if (disabled) {
      color = PALETTE.neutralGray;
    }

    let fontSize: number = FONT.bodyStrong.size;
    if (size === 'sm') fontSize = FONT.caption.size + 1;
    if (size === 'lg') fontSize = FONT.bodyLarge.size;

    return {
      color,
      fontSize,
      fontWeight: '600',
      fontFamily: 'Montserrat',
      letterSpacing: 0.3,
    };
  };

  const textStyle = getTextStyle();

  const renderIcon = () => {
    if (icon) {
      return <View style={styles.iconWrapper}>{icon}</View>;
    }
    if (iconName) {
      return (
        <View style={styles.iconWrapper}>
          <Icon
            name={iconName}
            size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18}
            color={textStyle.color as string}
            strokeWidth={2.5}
          />
        </View>
      );
    }
    return null;
  };

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style]}
      onPress={onPress}
      disabled={!isInteractive}
      activeOpacity={0.82}
    >
      {loading ? (
        <View style={styles.contentContainer}>
          <ActivityIndicator
            size="small"
            color={textStyle.color as string}
            style={styles.spinner}
          />
          <Text style={textStyle}>{loadingText ?? label}</Text>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          {iconPosition === 'left' && renderIcon()}
          <Text style={textStyle}>{label}</Text>
          {iconPosition === 'right' && renderIcon()}
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: SPACING.xs + 2,
  },
  iconWrapper: {
    marginHorizontal: SPACING.xs,
  },
});
