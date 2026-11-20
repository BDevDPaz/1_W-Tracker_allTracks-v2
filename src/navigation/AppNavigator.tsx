import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Icon } from "@/components";
import type { IconName } from "@/components/atoms/Icon";
import { AjustesScreen } from "@/screens/AjustesScreen";
import { HistorialScreen } from "@/screens/HistorialScreen";
import { HoyScreen } from "@/screens/HoyScreen";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { ReportesScreen } from "@/screens/ReportesScreen";
import { useSessionStore } from "@/stores/sessionStore";
import { PALETTE, RADIUS, SPACING, TEXT } from "@/theme";
import type { RootStackParamList, RootTabParamList } from "@/types/contracts";

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
type TabRouteName = keyof RootTabParamList;

const TAB_ICONS: Readonly<Record<TabRouteName, IconName>> = Object.freeze({
  Hoy: "navigation",
  Historial: "history",
  Reportes: "file-text",
  Ajustes: "settings",
  Resumen: "file-text",
});

const TAB_LABELS: Readonly<Record<TabRouteName, string>> = Object.freeze({
  Hoy: "HOY",
  Historial: "HISTORIAL",
  Reportes: "REPORTES",
  Ajustes: "AJUSTES",
  Resumen: "RESUMEN",
});

const ROOT_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  headerShown: false,
  animation: "fade",
  contentStyle: { backgroundColor: PALETTE.obsidian },
};

function MainTabNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      initialRouteName="Hoy"
      backBehavior="history"
      screenOptions={({ route }): BottomTabNavigationOptions => {
        const iconName = TAB_ICONS[route.name] || "navigation";
        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: PALETTE.mutedGold,
          tabBarInactiveTintColor: TEXT.muted,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ focused, color }) => (
            <View
              style={[
                styles.iconContainer,
                focused ? styles.iconContainerActive : undefined,
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
        options={{ tabBarLabel: TAB_LABELS.Hoy, title: "Hoy" }}
      />
      <Tab.Screen
        name="Historial"
        component={HistorialScreen}
        options={{ tabBarLabel: TAB_LABELS.Historial, title: "Historial" }}
      />
      <Tab.Screen
        name="Reportes"
        component={ReportesScreen}
        options={{ tabBarLabel: TAB_LABELS.Reportes, title: "Reportes" }}
      />
      <Tab.Screen
        name="Ajustes"
        component={AjustesScreen}
        options={{ tabBarLabel: TAB_LABELS.Ajustes, title: "Ajustes" }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator(): React.JSX.Element {
  const hasCompletedOnboarding = useSessionStore(
    (state) => state.hasCompletedOnboarding,
  );
  const navigatorKey = hasCompletedOnboarding
    ? "main-navigation"
    : "onboarding-navigation";

  return (
    <Stack.Navigator
      key={navigatorKey}
      initialRouteName={hasCompletedOnboarding ? "MainTabs" : "Onboarding"}
      screenOptions={ROOT_SCREEN_OPTIONS}
    >
      {hasCompletedOnboarding ? (
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: PALETTE.graphite,
    borderTopColor: PALETTE.steelLine,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === "ios" ? 88 : 72,
    paddingTop: SPACING.xs,
    paddingBottom: Platform.OS === "ios" ? SPACING.xl : SPACING.sm,
    elevation: 0,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  tabItem: { paddingVertical: SPACING.xxs },
  tabLabel: {
    marginTop: SPACING.xxs,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  iconContainer: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.xs,
  },
  iconContainerActive: { backgroundColor: "rgba(197, 160, 89, 0.12)" },
});

export default AppNavigator;
