import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

import type { ComponentProps } from "react";
import type { Feather } from "@react-native-vector-icons/feather";

export type IconName = ComponentProps<typeof Feather>["name"];

export const CATEGORIES: { key: string; label: string; icon: IconName }[] = [
  { key: "grocery", label: "سودا سلف", icon: "shopping-cart" },
  { key: "milk_veg", label: "دودھ سبزی", icon: "droplet" },
  { key: "bills", label: "بل", icon: "zap" },
  { key: "transport", label: "سفر", icon: "navigation" },
  { key: "health", label: "دوا علاج", icon: "heart" },
  { key: "education", label: "تعلیم", icon: "book" },
  { key: "guests", label: "مہمان داری", icon: "coffee" },
  { key: "clothes", label: "کپڑے", icon: "scissors" },
  { key: "other", label: "دیگر", icon: "more-horizontal" },
];

export const METHODS: { key: string; label: string; icon: IconName }[] = [
  { key: "cash", label: "نقد", icon: "dollar-sign" },
  { key: "jazzcash", label: "جاز کیش", icon: "smartphone" },
  { key: "easypaisa", label: "ایزی پیسہ", icon: "phone" },
  { key: "bank", label: "بینک", icon: "credit-card" },
];

export const BILL_KINDS: { key: string; label: string; icon: IconName }[] = [
  { key: "electricity", label: "بجلی", icon: "zap" },
  { key: "gas", label: "گیس", icon: "wind" },
  { key: "internet", label: "انٹرنیٹ", icon: "wifi" },
  { key: "mobile", label: "موبائل", icon: "smartphone" },
  { key: "water", label: "پانی", icon: "droplet" },
  { key: "other", label: "دیگر", icon: "file-text" },
];

export const URDU_MONTHS = ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"];

export const findIn = (list: { key: string; label: string; icon: IconName }[], key: string) =>
  list.find((x) => x.key === key) ?? list[list.length - 1];

export const rs = (n: number) => `${Math.round(n).toLocaleString("en-US")} روپے`;

export const tap = (heavy = false) => {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export const prettyDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${URDU_MONTHS[m - 1]} ${y}`;
};
