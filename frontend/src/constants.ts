import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import type { ComponentProps } from "react";
import type { Feather } from "@react-native-vector-icons/feather";
import type { Lang } from "@/src/i18n";

export type IconName = ComponentProps<typeof Feather>["name"];
export type Item = { key: string; ur: string; en: string; icon: IconName };

export const CATEGORIES: Item[] = [
  { key: "grocery", ur: "سودا سلف", en: "Groceries", icon: "shopping-cart" },
  { key: "milk_veg", ur: "دودھ سبزی", en: "Milk & veg", icon: "droplet" },
  { key: "bills", ur: "بل", en: "Bills", icon: "zap" },
  { key: "transport", ur: "سفر", en: "Travel", icon: "navigation" },
  { key: "health", ur: "دوا علاج", en: "Health", icon: "heart" },
  { key: "education", ur: "تعلیم", en: "Education", icon: "book" },
  { key: "guests", ur: "مہمان داری", en: "Guests", icon: "coffee" },
  { key: "clothes", ur: "کپڑے", en: "Clothes", icon: "scissors" },
  { key: "other", ur: "دیگر", en: "Other", icon: "more-horizontal" },
];

export const METHODS: Item[] = [
  { key: "cash", ur: "نقد", en: "Cash", icon: "dollar-sign" },
  { key: "jazzcash", ur: "جاز کیش", en: "JazzCash", icon: "smartphone" },
  { key: "easypaisa", ur: "ایزی پیسہ", en: "Easypaisa", icon: "phone" },
  { key: "bank", ur: "بینک", en: "Bank", icon: "credit-card" },
];

export const BILL_KINDS: Item[] = [
  { key: "electricity", ur: "بجلی", en: "Electricity", icon: "zap" },
  { key: "gas", ur: "گیس", en: "Gas", icon: "wind" },
  { key: "internet", ur: "انٹرنیٹ", en: "Internet", icon: "wifi" },
  { key: "mobile", ur: "موبائل", en: "Mobile", icon: "smartphone" },
  { key: "water", ur: "پانی", en: "Water", icon: "droplet" },
  { key: "other", ur: "دیگر", en: "Other", icon: "file-text" },
];

export const NEED: Record<"need" | "want", { ur: string; en: string }> = {
  need: { ur: "ضرورت", en: "Need" },
  want: { ur: "خواہش", en: "Want" },
};

const MONTHS = {
  ur: ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
export const monthName = (m: number, lang: Lang) => MONTHS[lang][m];

export const findIn = (list: Item[], key: string) => list.find((x) => x.key === key) ?? list[list.length - 1];

export const rs = (n: number, lang: Lang) => {
  const v = Math.round(n).toLocaleString("en-US");
  return lang === "ur" ? `${v} روپے` : `Rs ${v}`;
};

export const tap = (heavy = false) => {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export const prettyDate = (d: string, lang: Lang) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[lang][m - 1]} ${y}`;
};
