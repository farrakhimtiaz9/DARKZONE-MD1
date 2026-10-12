// Design tokens for گھر کھاتہ (Hand-Drawn / Journal personality).
// Keys match the "color" block of /app/design_guidelines.json. "paper" is the
// design-guideline theme; the others are user-selectable variants with the same keys.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { storage } from "@/src/utils/storage";
import { useI18n } from "@/src/i18n";

export type ColorScheme = "light" | "dark";

const paper = {
  surface: "#FDFBF7", onSurface: "#2D2B2A",
  surfaceSecondary: "#F4F1EA", onSurfaceSecondary: "#3E3B3A",
  surfaceTertiary: "#EBE6DC", onSurfaceTertiary: "#4A4746",
  surfaceInverse: "#2D2B2A", onSurfaceInverse: "#FDFBF7",
  muted: "#8A8580",
  brand: "#C68763", onBrand: "#FFFFFF",
  brandPrimary: "#C68763", onBrandPrimary: "#FFFFFF",
  brandSecondary: "#8B9D83", onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E8D8CE", onBrandTertiary: "#6B442E",
  success: "#6B8E6B", onSuccess: "#FFFFFF",
  warning: "#D4A373", onWarning: "#FFFFFF",
  error: "#B85C5C", onError: "#FFFFFF",
  info: "#8B9D83", onInfo: "#FFFFFF",
  border: "#E0DCD3", borderStrong: "#C2BCB0", divider: "#EAE6DF",
  scrim: "rgba(45,43,42,0.75)", scrimClear: "rgba(45,43,42,0)",
  successSoft: "#E3ECE1", errorSoft: "#F3E1E0", warningSoft: "#F6EADB",
};

export type ThemeColors = typeof paper;

const night: ThemeColors = {
  surface: "#1C1A19", onSurface: "#F2EDE6",
  surfaceSecondary: "#262321", onSurfaceSecondary: "#E2DCD3",
  surfaceTertiary: "#312D2A", onSurfaceTertiary: "#D3CCC2",
  surfaceInverse: "#F2EDE6", onSurfaceInverse: "#1C1A19",
  muted: "#A09890",
  brand: "#D99A74", onBrand: "#1C1A19",
  brandPrimary: "#D99A74", onBrandPrimary: "#1C1A19",
  brandSecondary: "#9CB094", onBrandSecondary: "#1C1A19",
  brandTertiary: "#3A2C24", onBrandTertiary: "#F0C9AE",
  success: "#8DB58D", onSuccess: "#1C1A19",
  warning: "#E0B07F", onWarning: "#1C1A19",
  error: "#D98080", onError: "#1C1A19",
  info: "#9CB094", onInfo: "#1C1A19",
  border: "#3A3532", borderStrong: "#524B46", divider: "#2E2A27",
  scrim: "rgba(0,0,0,0.75)", scrimClear: "rgba(0,0,0,0)",
  successSoft: "#24322A", errorSoft: "#3A2626", warningSoft: "#3A3022",
};

const mehndi: ThemeColors = {
  surface: "#F7FAF4", onSurface: "#1F2A1E",
  surfaceSecondary: "#ECF2E6", onSurfaceSecondary: "#2F3B2D",
  surfaceTertiary: "#DFE8D7", onSurfaceTertiary: "#3B4838",
  surfaceInverse: "#1F2A1E", onSurfaceInverse: "#F7FAF4",
  muted: "#7D8A78",
  brand: "#4F7A3A", onBrand: "#FFFFFF",
  brandPrimary: "#4F7A3A", onBrandPrimary: "#FFFFFF",
  brandSecondary: "#B58A2E", onBrandSecondary: "#FFFFFF",
  brandTertiary: "#DCE8CF", onBrandTertiary: "#2E4A22",
  success: "#4F7A3A", onSuccess: "#FFFFFF",
  warning: "#B58A2E", onWarning: "#FFFFFF",
  error: "#B5524A", onError: "#FFFFFF",
  info: "#4F7A3A", onInfo: "#FFFFFF",
  border: "#D5DFCB", borderStrong: "#B5C3A8", divider: "#E3EADC",
  scrim: "rgba(31,42,30,0.75)", scrimClear: "rgba(31,42,30,0)",
  successSoft: "#DCE8CF", errorSoft: "#F2DEDB", warningSoft: "#F3E9D2",
};

const gulabi: ThemeColors = {
  surface: "#FFF8F8", onSurface: "#2E2224",
  surfaceSecondary: "#FBEDEE", onSurfaceSecondary: "#3E2E31",
  surfaceTertiary: "#F4DFE1", onSurfaceTertiary: "#4A383B",
  surfaceInverse: "#2E2224", onSurfaceInverse: "#FFF8F8",
  muted: "#937F82",
  brand: "#B5556B", onBrand: "#FFFFFF",
  brandPrimary: "#B5556B", onBrandPrimary: "#FFFFFF",
  brandSecondary: "#6F8696", onBrandSecondary: "#FFFFFF",
  brandTertiary: "#F6D9DF", onBrandTertiary: "#6E2A3B",
  success: "#5E8C6A", onSuccess: "#FFFFFF",
  warning: "#C98B5A", onWarning: "#FFFFFF",
  error: "#B5524A", onError: "#FFFFFF",
  info: "#6F8696", onInfo: "#FFFFFF",
  border: "#EDD7DA", borderStrong: "#D9B9BE", divider: "#F2E3E5",
  scrim: "rgba(46,34,36,0.75)", scrimClear: "rgba(46,34,36,0)",
  successSoft: "#E0EDE3", errorSoft: "#F5DCDA", warningSoft: "#F6E6D8",
};

export type ThemeName = "paper" | "night" | "mehndi" | "gulabi";
export const themes: Record<ThemeName, { ur: string; en: string; scheme: ColorScheme; colors: ThemeColors }> = {
  paper: { ur: "کاغذ", en: "Paper", scheme: "light", colors: paper },
  night: { ur: "رات", en: "Night", scheme: "dark", colors: night },
  mehndi: { ur: "مہندی", en: "Mehndi", scheme: "light", colors: mehndi },
  gulabi: { ur: "گلابی", en: "Rose", scheme: "light", colors: gulabi },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
export const fontSize = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24 };
export const FONTS = { ur: "NotoNastaliqUrdu", en: "Nunito" };

type ThemeCtx = { scheme: ColorScheme; colors: ThemeColors; themeName: ThemeName; setTheme: (t: ThemeName) => void };
const Ctx = createContext<ThemeCtx>({ scheme: "light", colors: paper, themeName: "paper", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setName] = useState<ThemeName>("paper");
  useEffect(() => {
    storage.getItem("theme", "paper").then((t) => {
      if (t && t in themes) setName(t as ThemeName);
    });
  }, []);
  const setTheme = useCallback((t: ThemeName) => {
    setName(t);
    storage.setItem("theme", t);
  }, []);
  const value = useMemo(() => ({ scheme: themes[themeName].scheme, colors: themes[themeName].colors, themeName, setTheme }), [themeName, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}

type Dir = { row: "row" | "row-reverse"; start: "left" | "right" };

// Themed + direction-aware StyleSheet hook.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors, d: Dir) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    const { row, start } = useI18n();
    return useMemo(() => StyleSheet.create(factory(colors, { row, start })), [colors, row, start]);
  };
}
