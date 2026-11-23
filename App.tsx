import { NavigationContainer } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppNavigator } from "@/navigation/AppNavigator";
import { ToastProvider } from "@/services";
import { sessionEngineService } from "@/services/sessionEngine/SessionEngineService";
import { useSessionStore } from "@/stores/sessionStore";
import { PALETTE } from "@/theme";

// Prevenir que la pantalla de carga nativa se oculte prematuramente
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App(): React.JSX.Element | null {
  const [appIsReady, setAppIsReady] = useState(false);
  const initializeStore = useSessionStore((state) => state.initialize);

  useEffect(() => {
    let isMounted = true;

    async function prepareApp() {
      try {
        // Inicializar la base de datos, WAL, rehidratación y servicios
        await initializeStore();
      } catch (error) {
        console.error("[App Initialization Fatal Error]:", error);
      } finally {
        if (isMounted) {
          setAppIsReady(true);
          await SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    void prepareApp();

    return () => {
      isMounted = false;
    };
  }, [initializeStore]);

  // Intervalo de validación periódica para el Auto-Check-Out de 15 minutos (Foreground)
  useEffect(() => {
    if (!appIsReady) return;

    const interval = setInterval(() => {
      void sessionEngineService.evaluatePendingExits().catch(() => {
        // Fallos silenciosos se manejan de forma segura en el motor
      });
    }, 30000); // Evalúa cada 30 segundos

    return () => clearInterval(interval);
  }, [appIsReady]);

  if (!appIsReady) {
    return (
      <View style={[styles.container, styles.splashFallback]}>
        {/* El splash nativo cubre esta vista mientras inicializa */}
      </View>
    );
  }

  return (
    <SafeAreaProvider style={styles.container}>
      <ToastProvider>
        <NavigationContainer
          theme={{
            dark: true,
            colors: {
              primary: PALETTE.mutedGold,
              background: PALETTE.obsidian,
              card: PALETTE.graphite,
              text: PALETTE.mutedGold,
              border: PALETTE.steelLine,
              notification: PALETTE.mutedGold,
            },
          }}
        >
          <AppNavigator />
        </NavigationContainer>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.obsidian,
  },
  splashFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
});
