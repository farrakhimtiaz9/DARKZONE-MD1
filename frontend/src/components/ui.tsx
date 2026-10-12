import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleProp, Text, TextInput, TextInputProps, TextProps, TextStyle, View, ViewStyle } from "react-native";
import { Feather } from "@react-native-vector-icons/feather";
import { Image } from "expo-image";
import { FONTS, fontSize, radius, spacing, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import type { IconName } from "@/src/constants";

type Size = keyof typeof fontSize;

// Language-aware text: Nastaliq + RTL for Urdu (needs ~2x line height), Nunito + LTR for English.
export function UText({ size = "base", fs, style, color, center, bold, ...rest }: TextProps & { size?: Size; fs?: number; color?: string; center?: boolean; bold?: boolean }) {
  const { colors } = useTheme();
  const { lang, start } = useI18n();
  const f = fs ?? fontSize[size];
  return (
    <Text
      {...rest}
      style={[{
        fontFamily: FONTS[lang], fontSize: f, lineHeight: Math.round(f * (lang === "ur" ? 2 : 1.4)),
        textAlign: center ? "center" : start, writingDirection: lang === "ur" ? "rtl" : "ltr", color: color ?? colors.onSurface,
        fontWeight: bold && lang === "en" ? "700" : undefined,
      }, style]}
    />
  );
}

export function Icon({ name, size = 20, color }: { name: IconName | string; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Feather name={name as IconName} size={size} color={color ?? colors.onSurface} />;
}

export function Button({ label, onPress, loading, variant = "primary", icon, testID, style, disabled }: {
  label: string; onPress: () => void; loading?: boolean; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: IconName; testID: string; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const { row } = useI18n();
  const bg = { primary: colors.brandPrimary, secondary: colors.brandSecondary, ghost: colors.surfaceTertiary, danger: colors.error }[variant];
  const fg = { primary: colors.onBrandPrimary, secondary: colors.onBrandSecondary, ghost: colors.onSurfaceTertiary, danger: colors.onError }[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        { minHeight: 52, borderRadius: radius.md, backgroundColor: bg, flexDirection: row, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Feather name={icon} size={18} color={fg} /> : null}
          <UText size="lg" color={fg} bold>{label}</UText>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, icon, selected, onPress, testID }: { label: string; icon?: IconName; selected: boolean; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  const { row, lang } = useI18n();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{ height: 36, flexShrink: 0, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: row, alignItems: "center", gap: spacing.xs,
        backgroundColor: selected ? colors.brandTertiary : colors.surface, borderWidth: 1, borderColor: selected ? colors.brandPrimary : colors.border }}
    >
      {icon ? <Feather name={icon} size={14} color={selected ? colors.onBrandTertiary : colors.muted} /> : null}
      <UText size="sm" color={selected ? colors.onBrandTertiary : colors.onSurfaceSecondary} style={{ lineHeight: lang === "ur" ? 22 : 18 }}>{label}</UText>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 56, flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}>
      {children}
    </ScrollView>
  );
}

export function Field(props: TextInputProps & { testID: string }) {
  const { colors } = useTheme();
  const { lang, start } = useI18n();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[{ fontFamily: FONTS[lang], fontSize: 16, minHeight: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, color: colors.onSurface, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, textAlign: start, writingDirection: lang === "ur" ? "rtl" : "ltr" }, props.style as StyleProp<TextStyle>]}
    />
  );
}

export function Label({ children }: { children: string }) {
  const { colors } = useTheme();
  return <UText size="base" color={colors.muted} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>{children}</UText>;
}

export function EmptyState({ image, title, hint, testID }: { image?: string; title: string; hint?: string; testID: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", padding: spacing.xl, gap: spacing.sm }}>
      {image ? <Image source={{ uri: image }} style={{ width: 160, height: 120, borderRadius: radius.lg, marginBottom: spacing.sm }} contentFit="cover" transition={300} /> : <Icon name="inbox" size={40} color={colors.muted} />}
      <UText size="lg" center>{title}</UText>
      {hint ? <UText size="sm" color={colors.muted} center>{hint}</UText> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors } = useTheme();
  const { tr } = useI18n();
  return (
    <View testID="error-view" style={{ alignItems: "center", padding: spacing.xl, gap: spacing.md }}>
      <UText color={colors.error} center>{message}</UText>
      <Button testID="retry-button" label={tr("دوبارہ کوشش کریں", "Try again")} variant="ghost" onPress={onRetry} />
    </View>
  );
}

export function Fab({ onPress, testID, bottom, icon = "plus" }: { onPress: () => void; testID: string; bottom: number; icon?: string }) {
  const { colors } = useTheme();
  const { isRTL } = useI18n();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({ position: "absolute", ...(isRTL ? { left: spacing.lg } : { right: spacing.lg }), bottom, width: 60, height: 60, borderRadius: radius.lg, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.92 : 1 }] })}
    >
      <Icon name={icon} size={26} color={colors.onBrandPrimary} />
    </Pressable>
  );
}

export function IconBadge({ name, bg, fg }: { name: IconName; bg?: string; fg?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: bg ?? colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
      <Feather name={name} size={20} color={fg ?? colors.onBrandTertiary} />
    </View>
  );
}

export function ScreenHeader({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children?: React.ReactNode }) {
  const { colors } = useTheme();
  const { row, lang } = useI18n();
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
      <View style={{ flexDirection: row, alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <UText size="2xl" bold style={{ lineHeight: lang === "ur" ? 52 : 32 }}>{title}</UText>
          {subtitle ? <UText size="sm" color={colors.muted}>{subtitle}</UText> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}
