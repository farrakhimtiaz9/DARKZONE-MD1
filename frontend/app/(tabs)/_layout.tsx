import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Feather } from "@react-native-vector-icons/feather";
import { usesNativeTabs } from "@/src/navigation";
import { FONT, useTheme } from "@/src/theme";

const TABS = [
  { name: "index", label: "گھر", icon: "home", sf: "house.fill" },
  { name: "udhaar", label: "ادھار", icon: "users", sf: "person.2.fill" },
  { name: "bills", label: "بل", icon: "bell", sf: "bell.fill" },
  { name: "report", label: "رپورٹ", icon: "pie-chart", sf: "chart.pie.fill" },
] as const;

export default function TabsLayout() {
  const { colors } = useTheme();
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        {TABS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <NativeTabs.Trigger.Icon sf={t.sf} />
            <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onBrandTertiary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: FONT, fontSize: 12 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, size }) => <Feather name={t.icon} size={size - 2} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
