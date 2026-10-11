// Design tokens for گھر کھاتہ. Light theme only (Hand-Drawn / Journal personality).
// Keys match the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FDFBF7",
  onSurface: "#2D2B2A",
  surfaceSecondary: "#F4F1EA",
  onSurfaceSecondary: "#3E3B3A",
  surfaceTertiary: "#EBE6DC",
  onSurfaceTertiary: "#4A4746",
  surfaceInverse: "#2D2B2A",
  onSurfaceInverse: "#FDFBF7",
  muted: "#8A8580",

  brand: "#C68763",
  onBrand: "#FFFFFF",
  brandPrimary: "#C68763",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#8B9D83",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E8D8CE",
  onBrandTertiary: "#6B442E",

  success: "#6B8E6B",
  onSuccess: "#FFFFFF",
  warning: "#D4A373",
  onWarning: "#FFFFFF",
  error: "#B85C5C",
  onError: "#FFFFFF",
  info: "#8B9D83",
  onInfo: "#FFFFFF",

  border: "#E0DCD3",
  borderStrong: "#C2BCB0",
  divider: "#EAE6DF",

  scrim: "rgba(45,43,42,0.72)",
  scrimClear: "rgba(45,43,42,0)",
  successSoft: "#E3ECE1",
  errorSoft: "#F3E1E0",
  warningSoft: "#F6EADB",
};

export type ThemeColors = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
export const fontSize = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24 };
export const FONT = "NotoNastaliqUrdu";

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export const colors = light;

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
