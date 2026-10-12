import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Feather } from "@react-native-vector-icons/feather";
import { usesNativeTabs } from "@/src/navigation";
import { FONTS, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";

const TABS = [
  { name: "index", ur: "گھر", en: "Home", icon: "home", sf: "house.fill" },
  { name: "udhaar", ur: "ادھار", en: "Udhaar", icon: "users", sf: "person.2.fill" },
  { name: "bills", ur: "بل", en: "Bills", icon: "bell", sf: "bell.fill" },
  { name: "report", ur: "رپورٹ", en: "Report", icon: "pie-chart", sf: "chart.pie.fill" },
] as const;

export default function TabsLayout() {
  const { colors } = useTheme();
  const { lang } = useI18n();
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        {TABS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <NativeTabs.Trigger.Icon sf={t.sf} />
            <NativeTabs.Trigger.Label>{t[lang]}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: FONTS[lang], fontSize: 12 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t[lang],
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, size }) => <Feather name={t.icon} size={size - 2} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
