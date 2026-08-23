// ============================================================
// APP ENTRY POINT: W Tracker V2.0.1
// Responsabilidad: Secuencia de arranque + Migración en Caliente
// ============================================================

import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useState } from 'react';
import { LogBox, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { AppNavigator } from './src/navigation/AppNavigator';
import { PALETTE, TEXT } from './src/theme';
import { DatabaseService, databaseService, geofenceService, sessionEngine, settingsService, ToastProvider, ToastService } from './src/services';
import { useSessionStore } from './src/stores/sessionStore';

LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);
SplashScreen.preventAutoHideAsync().catch(() => {});

type AppBootState = 'BOOTING' | 'READY' | 'ERROR';
type BootStatus = 'INICIALIZANDO MOTOR OPERATIVO' | 'CARGANDO BASE DE DATOS' | 'LEYENDO PREFERENCIAS' | 'RECUPERANDO SESIÓN' | 'SINCRONIZANDO ESTADO' | 'VERIFICANDO PERMISOS' | 'REACTIVANDO GEOCERCA' | 'SISTEMA OPERATIVO LISTO';

const CUSTOM_DARK_THEME: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: PALETTE.mutedGold, background: PALETTE.obsidian, card: PALETTE.graphite, text: TEXT.primary, border: PALETTE.steelLine, notification: PALETTE.amberWarning },
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}

const BootScreen: React.FC<{ status: BootStatus; error?: string; onRetry?: () => void }> = ({ status, error, onRetry }) => {
  const pulseOpacity = useSharedValue(0.35);

  useEffect(() => {
    pulseOpacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [pulseOpacity]);

  const animatedStatusStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  return (
    <View style={bootStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PALETTE.obsidian} translucent={false} />
      <Animated.Text entering={FadeIn.duration(800)} style={bootStyles.brand}>W</Animated.Text>
      <Animated.Text entering={FadeIn.delay(250).duration(800)} style={bootStyles.brandSub}>TRACKER V2</Animated.Text>
      {error ? (
        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={bootStyles.errorBox}>
          <Text style={bootStyles.errorTitle}>Fallo de infraestructura</Text>
          <Text style={bootStyles.errorText}>{error}</Text>
          {onRetry && (
            <Pressable onPress={onRetry} style={({ pressed }) => [bootStyles.retryButton, pressed && bootStyles.retryButtonPressed]}>
              <Text style={bootStyles.retryButtonText}>REINTENTAR</Text>
            </Pressable>
          )}
        </Animated.View>
      ) : (
        <Animated.View style={[bootStyles.loadingBox, animatedStatusStyle]}>
          <Text style={bootStyles.loadingText}>{status}</Text>
        </Animated.View>
      )}
    </View>
  );
};

export default function App() {
  const [bootState, setBootState] = useState<AppBootState>('BOOTING');
  const [bootStatus, setBootStatus] = useState<BootStatus>('INICIALIZANDO MOTOR OPERATIVO');
  const [bootError, setBootError] = useState<string | undefined>();

  const bootstrap = useCallback(async () => {
    setBootState('BOOTING');
    setBootError(undefined);
    setBootStatus('INICIALIZANDO MOTOR OPERATIVO');

    try {
      setBootStatus('CARGANDO BASE DE DATOS');
      await DatabaseService.initialize();

      // ============================================================
      // 🚀 MIGRACIÓN EN CALIENTE V2.0.1 (Solución al Crash de SQLite)
      // Añade la columna si no existe, y falla silenciosamente si ya existe.
      // ============================================================
      try {
        const db = databaseService.getDB();
        await db.execAsync('ALTER TABLE settings ADD COLUMN has_completed_onboarding INTEGER DEFAULT 0;');
        console.log('[SQLite Migrator] Columna onboarding añadida exitosamente.');
      } catch (e) {
        // La columna ya existe, continuamos con seguridad.
      }

      setBootStatus('LEYENDO PREFERENCIAS');
      const settings = await settingsService.load();

      setBootStatus('RECUPERANDO SESIÓN');
      const recoveryResult = await sessionEngine.rehydrateFromWAL();

      if (recoveryResult === 'RECOVERED') ToastService.push({ type: 'info', text: 'La sesión operativa fue recuperada automáticamente.' });
      if (recoveryResult === 'CONFLICT') ToastService.push({ type: 'warning', text: 'Se detectó un conflicto al recuperar la sesión anterior.' });

      setBootStatus('SINCRONIZANDO ESTADO');
      const store = useSessionStore.getState();
      await store.initialize();

      setBootStatus('VERIFICANDO PERMISOS');
      const permissionStatus = await geofenceService.getPermissionStatus();
      store.updateSystemHealth({
        locationPermission: permissionStatus === 'GRANTED' ? 'OK' : permissionStatus === 'DENIED' ? 'ERROR' : 'WARNING',
        backgroundLocation: permissionStatus === 'GRANTED' ? 'OK' : 'WARNING',
      });

      if (recoveryResult === 'RECOVERED' && permissionStatus === 'GRANTED') {
        setBootStatus('REACTIVANDO GEOCERCA');
        const activeSession = sessionEngine.getActiveSession();
        if (activeSession && activeSession._lat != null && activeSession._lng != null) {
          try {
            await geofenceService.register({ identifier: activeSession.id, latitude: activeSession._lat, longitude: activeSession._lng, radius: settings.geofenceRadius || 100 });
            store.updateSystemHealth({ geofenceActive: 'OK' });
          } catch (geofenceError) {
            store.updateSystemHealth({ geofenceActive: 'WARNING' });
            ToastService.push({ type: 'warning', text: 'La sesión fue recuperada, pero no se pudo reactivar la geocerca automáticamente.' });
          }
        } else {
          store.updateSystemHealth({ geofenceActive: 'WARNING' });
        }
      }

      if (typeof store.syncWithEngine === 'function') store.syncWithEngine();

      setBootStatus('SISTEMA OPERATIVO LISTO');
      setBootState('READY');
    } catch (error) {
      console.error('[App Critical Boot Failure]', error);
      useSessionStore.getState().updateSystemHealth({ storageIntegrity: 'ERROR' });
      setBootError(getErrorMessage(error, 'Error grave al inicializar la infraestructura local.'));
      setBootState('ERROR');
    }
  }, []);

  useEffect(() => {
    void bootstrap();
    return () => {
      const store = useSessionStore.getState();
      if (typeof store.dispose === 'function') store.dispose();
    };
  }, [bootstrap]);

  useEffect(() => {
    if (bootState === 'BOOTING') return;
    SplashScreen.hideAsync().catch(() => {});
  }, [bootState]);

  if (bootState === 'BOOTING') return <BootScreen status={bootStatus} />;
  if (bootState === 'ERROR') return <BootScreen status={bootStatus} error={bootError} onRetry={() => void bootstrap()} />;

  return (
    <GestureHandlerRootView style={styles.appContainer}>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar barStyle="light-content" backgroundColor={PALETTE.obsidian} translucent={false} />
          <NavigationContainer theme={CUSTOM_DARK_THEME}>
            <AppNavigator />
          </NavigationContainer>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ appContainer: { flex: 1, backgroundColor: PALETTE.obsidian } });
const bootStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.obsidian, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  brand: { color: PALETTE.mutedGold, fontSize: 96, fontWeight: '900', letterSpacing: -4, fontFamily: 'System' },
  brandSub: { color: TEXT.muted, fontSize: 16, fontWeight: '700', letterSpacing: 8, marginTop: -10 },
  loadingBox: { position: 'absolute', bottom: 80, alignItems: 'center', backgroundColor: 'rgba(197, 160, 89, 0.10)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(197, 160, 89, 0.20)' },
  loadingText: { color: PALETTE.mutedGold, fontSize: 11, fontWeight: '700', letterSpacing: 2, textAlign: 'center', textTransform: 'uppercase' },
  errorBox: { marginTop: 48, width: '100%', maxWidth: 420, alignItems: 'center' },
  errorTitle: { color: PALETTE.deepRed, fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errorText: { color: TEXT.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retryButton: { marginTop: 28, minWidth: 160, minHeight: 44, paddingHorizontal: 24, borderWidth: 1, borderColor: PALETTE.mutedGold, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  retryButtonPressed: { opacity: 0.7 },
  retryButtonText: { color: PALETTE.mutedGold, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
});
