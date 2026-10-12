import { Pressable, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, Expense } from "@/src/api";
import { CATEGORIES, METHODS, NEED, findIn, prettyDate, rs, tap } from "@/src/constants";
import { radius, spacing, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { Icon, IconBadge, UText } from "./ui";
import { useToast } from "./Toast";

export function ExpenseRow({ e, index }: { e: Expense; index: number }) {
  const { colors } = useTheme();
  const { lang, row, tr } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const c = findIn(CATEGORIES, e.category);
  const m = findIn(METHODS, e.payment_method);
  const need = e.need_type;

  const toggleNeed = async () => {
    tap();
    try {
      await api.setNeed(e.id, need === "need" ? "want" : "need");
      qc.invalidateQueries();
    } catch {
      toast(tr("تبدیلی محفوظ نہیں ہو سکی", "Couldn't save the change"), "error");
    }
  };
  const remove = async () => {
    try {
      await api.deleteExpense(e.id);
      qc.invalidateQueries();
      toast(tr("خرچ ہٹا دیا گیا", "Expense removed"));
    } catch {
      toast(tr("خرچ نہیں ہٹ سکا", "Couldn't remove expense"), "error");
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 40)} testID={`expense-row-${e.id}`}
      style={{ flexDirection: row, alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
      <IconBadge name={c.icon} />
      <View style={{ flex: 1 }}>
        <UText numberOfLines={1}>{e.note || c[lang]}</UText>
        <UText size="sm" color={colors.muted} numberOfLines={1}>
          {c[lang]} · {m[lang]}{e.member ? ` · ${e.member}` : ""} · {prettyDate(e.date, lang)}
        </UText>
      </View>
      <View style={{ alignItems: "center", gap: 2 }}>
        <UText size="lg" bold>{rs(e.amount, lang)}</UText>
        <Pressable testID={`need-toggle-${e.id}`} onPress={toggleNeed} hitSlop={6}
          style={{ paddingHorizontal: spacing.sm, borderRadius: radius.pill, minHeight: 24, justifyContent: "center",
            backgroundColor: need === "want" ? colors.warningSoft : need === "need" ? colors.successSoft : colors.surfaceTertiary }}>
          <UText size="sm" color={need === "want" ? colors.onSurface : need === "need" ? colors.success : colors.muted} style={{ lineHeight: lang === "ur" ? 22 : 18 }}>
            {need ? NEED[need][lang] : tr("ضرورت؟", "Need?")}
          </UText>
        </Pressable>
      </View>
      <Pressable testID={`delete-expense-${e.id}`} onPress={remove} hitSlop={8} style={{ width: 28, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Icon name="trash-2" size={16} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
}
