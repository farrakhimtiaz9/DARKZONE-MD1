import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "@/src/utils/storage";

export type Lang = "ur" | "en";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  tr: (ur: string, en: string) => string;
  row: "row" | "row-reverse";
  start: "left" | "right";
  isRTL: boolean;
};

let currentLang: Lang = "ur";
export const getLang = () => currentLang;

const make = (lang: Lang, setLang: (l: Lang) => void): Ctx => ({
  lang,
  setLang,
  tr: (ur, en) => (lang === "ur" ? ur : en),
  row: lang === "ur" ? "row-reverse" : "row",
  start: lang === "ur" ? "right" : "left",
  isRTL: lang === "ur",
});

const LangCtx = createContext<Ctx>(make("ur", () => {}));

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ur");
  useEffect(() => {
    storage.getItem<string>("lang", "ur").then((l) => {
      const v = l === "en" ? "en" : "ur";
      currentLang = v;
      setLangState(v);
    });
  }, []);
  const setLang = useCallback((l: Lang) => {
    currentLang = l;
    setLangState(l);
    storage.setItem("lang", l);
  }, []);
  const value = useMemo(() => make(lang, setLang), [lang, setLang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export const useI18n = () => useContext(LangCtx);
