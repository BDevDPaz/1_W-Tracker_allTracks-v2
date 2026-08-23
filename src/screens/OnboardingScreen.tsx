// ============================================================
// SCREEN: OnboardingScreen
// Ruta: src/screens/OnboardingScreen.tsx
// Versión: 2.2.0 (Workday Tracking Platform)
//
// Responsabilidades:
// - Explicar el funcionamiento general de W Tracker.
// - Informar sobre el uso de ubicación en segundo plano.
// - Solicitar permisos nativos de ubicación.
// - Informar sobre restricciones de batería.
// - Presentar el descargo de responsabilidad.
// - Persistir la finalización del onboarding.
// ============================================================

import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Animated, {
  FadeInRight,
  FadeOutLeft,
  Layout,
} from 'react-native-reanimated';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { Icon } from '../components/atoms/Icon';

import type {
  IconName,
} from '../components/atoms/Icon';

import {
  geofenceService,
  ToastService,
} from '../services';

import { useSessionStore } from '../stores/sessionStore';

import {
  PALETTE,
  RADIUS,
  TEXT,
} from '../theme';

// ── TIPOS ───────────────────────────────────────────────────

interface OnboardingSlide {
  id:
    | 'welcome'
    | 'location'
    | 'battery'
    | 'disclaimer';

  icon: IconName;
  title: string;
  description: string;
  actionText: string;
  accessibilityHint: string;
}

// ── CONTENIDO ───────────────────────────────────────────────

const SLIDES: ReadonlyArray<OnboardingSlide> =
  Object.freeze([
    {
      id: 'welcome',
      icon: 'shield-check',
      title: 'Motor Operativo V2.2',
      description:
        'W Tracker prepara los módulos de jornadas, ' +
        'geocercas y persistencia para ayudarte a ' +
        'registrar tus horas de trabajo.',
      actionText: 'Siguiente',
      accessibilityHint:
        'Avanza a la explicación sobre los permisos de ubicación.',
    },
    {
      id: 'location',
      icon: 'map-pin',
      title: 'Transparencia de Ubicación',
      description:
        'W Tracker utiliza la ubicación en segundo plano ' +
        'para detectar entradas y salidas de tus lugares ' +
        'de trabajo mediante geocercas. Puedes revisar ' +
        'o revocar este permiso desde la configuración ' +
        'del dispositivo.',
      actionText: 'Conceder permisos',
      accessibilityHint:
        'Abre las solicitudes nativas de permisos de ubicación.',
    },
    {
      id: 'battery',
      icon: 'alert-triangle',
      title: 'Uso de Batería',
      description:
        Platform.OS === 'android'
          ? 'Algunos dispositivos Android restringen la ubicación ' +
            'cuando el ahorro de batería está activo. Revisa la ' +
            'configuración de batería del dispositivo si las ' +
            'geocercas dejan de responder.'
          : 'El ahorro de batería y las restricciones del sistema ' +
            'pueden afectar la entrega de eventos de ubicación. ' +
            'Revisa la configuración del dispositivo si las ' +
            'geocercas dejan de responder.',
      actionText: 'Entendido',
      accessibilityHint:
        'Avanza al descargo de responsabilidad.',
    },
    {
      id: 'disclaimer',
      icon: 'file-text',
      title: 'Descargo de Responsabilidad',
      description:
        'W Tracker es una herramienta de apoyo para registrar ' +
        'jornadas y estimar ingresos. Los datos de ubicación ' +
        'pueden verse afectados por permisos, batería o hardware. ' +
        'Revisa siempre tus jornadas y reportes antes de utilizarlos.',
      actionText: 'Aceptar y finalizar',
      accessibilityHint:
        'Guarda la aceptación y finaliza la configuración inicial.',
    },
  ]);

// ── SCREEN ──────────────────────────────────────────────────

export default function OnboardingScreen():
  React.JSX.Element {
  const insets = useSafeAreaInsets();

  const completeOnboarding = useSessionStore(
    (state) => state.completeOnboarding
  );

  const updateSystemHealth = useSessionStore(
    (state) => state.updateSystemHealth
  );

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [feedbackMessage, setFeedbackMessage] =
    useState<string | null>(null);

  const currentSlide =
    SLIDES[currentIndex] ?? SLIDES[0];

  const isLastSlide =
    currentIndex === SLIDES.length - 1;

  const progressDescription = useMemo(
    () =>
      `Paso ${currentIndex + 1} de ${SLIDES.length}`,
    [currentIndex]
  );

  const advanceToNextSlide = useCallback(() => {
    setFeedbackMessage(null);

    setCurrentIndex((previousIndex) =>
      Math.min(
        previousIndex + 1,
        SLIDES.length - 1
      )
    );
  }, []);

  const requestLocationPermissions =
    useCallback(async (): Promise<void> => {
      const granted =
        await geofenceService.requestPermissions();

      const permissionStatus =
        await geofenceService.getPermissionStatus();

      if (
        granted &&
        permissionStatus === 'GRANTED'
      ) {
        updateSystemHealth({
          locationPermission: 'OK',
          backgroundLocation: 'OK',
        });

        ToastService.push({
          type: 'success',
          text:
            'Permisos de ubicación concedidos correctamente.',
        });

        setFeedbackMessage(
          'Permisos de ubicación concedidos.'
        );

        return;
      }

      updateSystemHealth({
        locationPermission:
          permissionStatus === 'DENIED'
            ? 'ERROR'
            : 'WARNING',

        backgroundLocation: 'WARNING',
        geofenceActive: 'WARNING',
      });

      setFeedbackMessage(
        'No se concedió el acceso completo a la ubicación. ' +
          'Podrás continuar, pero el monitoreo automático ' +
          'puede no estar disponible.'
      );

      ToastService.push({
        type: 'warning',
        text:
          'Permisos incompletos. Puedes habilitarlos después ' +
          'desde la configuración del dispositivo.',
      });
    }, [updateSystemHealth]);

  const handleNext =
    useCallback(async (): Promise<void> => {
      if (isProcessing) {
        return;
      }

      setIsProcessing(true);
      setFeedbackMessage(null);

      try {
        if (currentSlide.id === 'location') {
          await requestLocationPermissions();
          advanceToNextSlide();
          return;
        }

        if (!isLastSlide) {
          advanceToNextSlide();
          return;
        }

        await completeOnboarding();
      } catch (error) {
        console.error(
          '[OnboardingScreen Action Error]',
          error
        );

        const message =
          error instanceof Error &&
          error.message.trim()
            ? error.message
            : 'No se pudo completar la configuración inicial.';

        setFeedbackMessage(message);

        ToastService.push({
          type: 'error',
          text: message,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [
      advanceToNextSlide,
      completeOnboarding,
      currentSlide.id,
      isLastSlide,
      isProcessing,
      requestLocationPermissions,
    ]);

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
    >
      <View
        style={styles.progressSection}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={progressDescription}
        accessibilityValue={{
          min: 1,
          max: SLIDES.length,
          now: currentIndex + 1,
          text: progressDescription,
        }}
      >
        <Text style={styles.progressText}>
          {progressDescription}
        </Text>

        <View
          style={styles.progressContainer}
          importantForAccessibility="no-hide-descendants"
        >
          {SLIDES.map((slide, index) => {
            const isActive =
              currentIndex === index;

            const isCompleted =
              index < currentIndex;

            return (
              <Animated.View
                key={slide.id}
                layout={Layout.duration(200)}
                style={[
                  styles.progressDot,
                  isCompleted
                    ? styles.progressDotCompleted
                    : undefined,
                  isActive
                    ? styles.progressDotActive
                    : undefined,
                ]}
              />
            );
          })}
        </View>
      </View>

      <Animated.View
        key={currentSlide.id}
        entering={FadeInRight.duration(350)}
        exiting={FadeOutLeft.duration(250)}
        style={styles.content}
      >
        <View
          style={styles.iconBox}
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            `Ilustración de ${currentSlide.title}`
          }
        >
          <Icon
            name={currentSlide.icon}
            size={56}
            color={PALETTE.mutedGold}
            strokeWidth={1.5}
          />
        </View>

        <Text
          style={styles.title}
          accessibilityRole="header"
        >
          {currentSlide.title}
        </Text>

        <Text style={styles.description}>
          {currentSlide.description}
        </Text>

        {feedbackMessage ? (
          <Animated.View
            entering={FadeInRight.duration(250)}
            style={styles.feedbackContainer}
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Icon
              name="alert-triangle"
              size={18}
              color={PALETTE.mutedGold}
              strokeWidth={2}
            />

            <Text style={styles.feedbackText}>
              {feedbackMessage}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>

      <View
        style={[
          styles.footer,
          {
            paddingBottom:
              Math.max(insets.bottom, 24),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            currentSlide.actionText
          }
          accessibilityHint={
            currentSlide.accessibilityHint
          }
          accessibilityState={{
            disabled: isProcessing,
            busy: isProcessing,
          }}
          disabled={isProcessing}
          onPress={() => {
            void handleNext();
          }}
          style={({ pressed }) => [
            styles.button,
            pressed && !isProcessing
              ? styles.buttonPressed
              : undefined,
            isProcessing
              ? styles.buttonDisabled
              : undefined,
          ]}
        >
          {isProcessing ? (
            <>
              <ActivityIndicator
                size="small"
                color={PALETTE.obsidian}
              />

              <Text style={styles.buttonText}>
                Procesando...
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.buttonText}>
                {currentSlide.actionText}
              </Text>

              <Icon
                name="chevron-right"
                size={20}
                color={PALETTE.obsidian}
                strokeWidth={2.5}
              />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── ESTILOS ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
  },

  progressSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 24,
  },

  progressText: {
    marginBottom: 12,
    color: TEXT.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PALETTE.carbonMist,
  },

  progressDotCompleted: {
    backgroundColor:
      'rgba(197, 160, 89, 0.45)',
  },

  progressDotActive: {
    width: 24,
    backgroundColor: PALETTE.mutedGold,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },

  iconBox: {
    width: 120,
    height: 120,
    marginBottom: 32,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1,
    borderColor:
      'rgba(197, 160, 89, 0.20)',
    borderRadius: 60,

    backgroundColor:
      'rgba(197, 160, 89, 0.10)',
  },

  title: {
    marginBottom: 16,

    color: TEXT.primary,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
    textAlign: 'center',
  },

  description: {
    maxWidth: 440,

    color: TEXT.secondary,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },

  feedbackContainer: {
    width: '100%',
    maxWidth: 440,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,

    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,

    borderWidth: 1,
    borderColor:
      'rgba(197, 160, 89, 0.25)',
    borderRadius: RADIUS.xs,

    backgroundColor:
      'rgba(197, 160, 89, 0.08)',
  },

  feedbackText: {
    flex: 1,
    color: TEXT.secondary,
    fontSize: 13,
    lineHeight: 19,
  },

  footer: {
    paddingTop: 16,
    paddingHorizontal: 24,
  },

  button: {
    width: '100%',
    maxWidth: 520,
    minHeight: 56,
    alignSelf: 'center',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,

    borderRadius: RADIUS.pills,
    backgroundColor: PALETTE.mutedGold,
  },

  buttonPressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: PALETTE.obsidian,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});

