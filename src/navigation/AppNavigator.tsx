// ============================================================
// NAVIGATION: AppNavigator
// Ruta: src/navigation/AppNavigator.tsx
// Versión: 2.2.0 (Workday Tracking Design System)
//
// Responsabilidades:
// - Navegación raíz según el estado del onboarding.
// - Navegación principal mediante Bottom Tabs.
// - Eliminación del flujo de onboarding del historial.
// - Tipado estricto de Root Stack y Bottom Tabs.
// - Soporte para futuras pantallas de nivel raíz.
//
// Regla de diseño:
// - La Tab Bar funciona como un ancla pasiva.
// - No utiliza sombras flotantes.
// - No contiene FABs anidados.
// ============================================================

import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';

import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import React from 'react';

import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { Icon } from '../components';

import type {
  IconName,
} from '../components/atoms/Icon';

import {
  AjustesScreen,
  HistorialScreen,
  HoyScreen,
  ReportesScreen,
} from '../screens';

import OnboardingScreen from '../screens/OnboardingScreen';

import { useSessionStore } from '../stores/sessionStore';

import {
  PALETTE,
  RADIUS,
  SPACING,
  TEXT,
} from '../theme';

import type {
  RootStackParamList,
  RootTabParamList,
} from '../types';

// ── NAVEGADORES ─────────────────────────────────────────────

const Tab =
  createBottomTabNavigator<RootTabParamList>();

const Stack =
  createNativeStackNavigator<RootStackParamList>();

type TabRouteName = keyof RootTabParamList;

// ── CONFIGURACIÓN DE TABS ───────────────────────────────────

const TAB_ICONS: Readonly<
  Record<TabRouteName, IconName>
> = Object.freeze({
  Hoy: 'navigation',
  Historial: 'history',
  Reportes: 'file-text',
  Ajustes: 'settings',
});

const TAB_LABELS: Readonly<
  Record<TabRouteName, string>
> = Object.freeze({
  Hoy: 'HOY',
  Historial: 'HISTORIAL',
  Reportes: 'REPORTES',
  Ajustes: 'AJUSTES',
});

const ROOT_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'fade',
  contentStyle: {
    backgroundColor: PALETTE.obsidian,
  },
};

// ── BOTTOM TAB NAVIGATOR ────────────────────────────────────

function MainTabNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      initialRouteName="Hoy"
      backBehavior="history"
      screenOptions={({
        route,
      }): BottomTabNavigationOptions => {
        const iconName = TAB_ICONS[route.name];

        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarHideOnKeyboard: true,

          tabBarActiveTintColor:
            PALETTE.mutedGold,

          tabBarInactiveTintColor:
            TEXT.muted,

          tabBarStyle:
            styles.tabBar,

          tabBarItemStyle:
            styles.tabItem,

          tabBarLabelStyle:
            styles.tabLabel,

          tabBarIcon: ({
            focused,
            color,
          }) => (
            <View
              style={[
                styles.iconContainer,
                focused
                  ? styles.iconContainerActive
                  : undefined,
              ]}
            >
              <Icon
                name={iconName}
                size={focused ? 20 : 18}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            </View>
          ),
        };
      }}
    >
      <Tab.Screen
        name="Hoy"
        component={HoyScreen}
        options={{
          tabBarLabel: TAB_LABELS.Hoy,
          title: 'Hoy',
        }}
      />

      <Tab.Screen
        name="Historial"
        component={HistorialScreen}
        options={{
          tabBarLabel: TAB_LABELS.Historial,
          title: 'Historial',
        }}
      />

      <Tab.Screen
        name="Reportes"
        component={ReportesScreen}
        options={{
          tabBarLabel: TAB_LABELS.Reportes,
          title: 'Reportes',
        }}
      />

      <Tab.Screen
        name="Ajustes"
        component={AjustesScreen}
        options={{
          tabBarLabel: TAB_LABELS.Ajustes,
          title: 'Ajustes',
        }}
      />
    </Tab.Navigator>
  );
}

// ── ROOT STACK NAVIGATOR ────────────────────────────────────

export function AppNavigator(): React.JSX.Element {
  const hasCompletedOnboarding = useSessionStore(
    (state) => state.hasCompletedOnboarding
  );

  /*
   * Cada estado de onboarding produce un árbol de navegación
   * independiente.
   *
   * Al completarse el onboarding:
   * 1. Se desmonta OnboardingScreen.
   * 2. Se elimina su historial.
   * 3. Se monta MainTabNavigator.
   * 4. El botón Atrás no puede regresar al onboarding.
   */
  const navigatorKey = hasCompletedOnboarding
    ? 'main-navigation'
    : 'onboarding-navigation';

  return (
    <Stack.Navigator
      key={navigatorKey}
      initialRouteName={
        hasCompletedOnboarding
          ? 'MainTabs'
          : 'Onboarding'
      }
      screenOptions={ROOT_SCREEN_OPTIONS}
    >
      {hasCompletedOnboarding ? (
        <Stack.Screen
          name="MainTabs"
          component={MainTabNavigator}
        />
      ) : (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
        />
      )}
    </Stack.Navigator>
  );
}

// ── ESTILOS ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: PALETTE.graphite,

    borderTopColor: PALETTE.steelLine,
    borderTopWidth: StyleSheet.hairlineWidth,

    height:
      Platform.OS === 'ios'
        ? 88
        : 72,

    paddingTop: SPACING.xs,

    paddingBottom:
      Platform.OS === 'ios'
        ? SPACING.xl
        : SPACING.sm,

    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
  },

  tabItem: {
    paddingVertical: SPACING.xxs,
  },

  tabLabel: {
    marginTop: SPACING.xxs,
    fontFamily: 'Montserrat',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  iconContainer: {
    width: 36,
    height: 36,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: RADIUS.xs,
  },

  iconContainerActive: {
    backgroundColor:
      'rgba(197, 160, 89, 0.12)',
  },
});

export default AppNavigator;

