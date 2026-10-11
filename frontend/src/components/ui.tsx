import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleProp, Text, TextInput, TextInputProps, TextProps, TextStyle, View, ViewStyle } from "react-native";
import { Feather } from "@react-native-vector-icons/feather";
import { Image } from "expo-image";
import { FONT, fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { IconName } from "@/src/constants";

type Size = keyof typeof fontSize;

export function UText({ size = "base", style, color, ...rest }: TextProps & { size?: Size; color?: string }) {
  const { colors } = useTheme();
  const fs = fontSize[size];
  return (
    <Text
      {...rest}
      style={[{ fontFamily: FONT, fontSize: fs, lineHeight: Math.round(fs * 2), textAlign: "right", writingDirection: "rtl", color: color ?? colors.onSurface }, style]}
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
  const bg = { primary: colors.brandPrimary, secondary: colors.brandSecondary, ghost: colors.surfaceTertiary, danger: colors.error }[variant];
  const fg = { primary: colors.onBrandPrimary, secondary: colors.onBrandSecondary, ghost: colors.onSurfaceTertiary, danger: colors.onError }[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        { minHeight: 52, borderRadius: radius.md, backgroundColor: bg, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Feather name={icon} size={18} color={fg} /> : null}
          <UText size="lg" color={fg}>{label}</UText>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, icon, selected, onPress, testID }: { label: string; icon?: IconName; selected: boolean; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{ height: 36, flexShrink: 0, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: "row-reverse", alignItems: "center", gap: spacing.xs,
        backgroundColor: selected ? colors.brandTertiary : colors.surface, borderWidth: 1, borderColor: selected ? colors.brandPrimary : colors.border }}
    >
      {icon ? <Feather name={icon} size={14} color={selected ? colors.onBrandTertiary : colors.muted} /> : null}
      <UText size="sm" color={selected ? colors.onBrandTertiary : colors.onSurfaceSecondary} style={{ lineHeight: 22 }}>{label}</UText>
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
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[{ fontFamily: FONT, fontSize: 16, minHeight: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, color: colors.onSurface, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, textAlign: "right", writingDirection: "rtl" }, props.style as StyleProp<TextStyle>]}
    />
  );
}

export function Label({ children }: { children: string }) {
  const { colors } = useTheme();
  return <UText size="base" color={colors.muted} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>{children}</UText>;
}

export function EmptyState({ image, title, hint, testID }: { image?: string; title: string; hint?: string; testID: string }) {
  const styles = useEmptyStyles();
  const { colors } = useTheme();
  return (
    <View testID={testID} style={styles.wrap}>
      {image ? <Image source={{ uri: image }} style={styles.img} contentFit="cover" transition={300} /> : <Icon name="inbox" size={40} color={colors.muted} />}
      <UText size="lg">{title}</UText>
      {hint ? <UText size="sm" color={colors.muted} style={{ textAlign: "center" }}>{hint}</UText> : null}
    </View>
  );
}

const useEmptyStyles = makeStyles(() => ({
  wrap: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  img: { width: 160, height: 120, borderRadius: radius.lg, marginBottom: spacing.sm },
}));

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View testID="error-view" style={{ alignItems: "center", padding: spacing.xl, gap: spacing.md }}>
      <UText color={colors.error} style={{ textAlign: "center" }}>{message}</UText>
      <Button testID="retry-button" label="دوبارہ کوشش کریں" variant="ghost" onPress={onRetry} />
    </View>
  );
}

export function Fab({ onPress, testID, bottom, icon = "plus" }: { onPress: () => void; testID: string; bottom: number; icon?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({ position: "absolute", left: spacing.lg, bottom, width: 60, height: 60, borderRadius: radius.lg, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.92 : 1 }] })}
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
