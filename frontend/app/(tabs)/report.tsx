import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, Group } from "@/src/api";
import { CATEGORIES, METHODS, findIn, monthName, rs, tap } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { shareCard } from "@/src/share";
import { Button, EmptyState, ErrorView, Icon, ScreenHeader, UText } from "@/src/components/ui";
import { ExpenseRow } from "@/src/components/ExpenseRow";
import { useToast } from "@/src/components/Toast";

const EMPTY = "https://images.unsplash.com/photo-1627123424574-724758594e93?crop=entropy&cs=srgb&fm=jpg&q=85&w=600";

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function Bars({ title, items, total, labelOf, testID }: { title: string; items: Group[]; total: number; labelOf: (k: string) => string; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { lang } = useI18n();
  const palette = [colors.brandPrimary, colors.brandSecondary, colors.warning, colors.onBrandTertiary, colors.borderStrong];
  return (
    <View style={styles.card} testID={testID}>
      <UText size="lg" bold>{title}</UText>
      {items.map((g, i) => {
        const pct = total ? g.amount / total : 0;
        return (
          <Animated.View key={g.key || i} entering={FadeInDown.delay(i * 60)} style={{ gap: spacing.xs, marginTop: spacing.sm }}>
            <View style={styles.rowBetween}>
              <UText>{labelOf(g.key)}</UText>
              <UText color={colors.muted}>{rs(g.amount, lang)} · {Math.round(pct * 100)}%</UText>
            </View>
            <View style={styles.track}>
              <View style={{ width: `${Math.max(pct * 100, 2)}%`, height: 10, borderRadius: radius.pill, backgroundColor: palette[i % palette.length] }} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr, lang } = useI18n();
  const toast = useToast();
  const [date, setDate] = useState(() => new Date());
  const month = ym(date);
  const q = useQuery({ queryKey: ["report", month], queryFn: () => api.report(month) });
  const list = useQuery({ queryKey: ["expenses", month], queryFn: () => api.expenses(month) });
  const r = q.data;
  const shift = (n: number) => setDate((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));
  const isCurrent = month === ym(new Date());
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const need = r?.by_need.find((g) => g.key === "need")?.amount ?? 0;
  const want = r?.by_need.find((g) => g.key === "want")?.amount ?? 0;
  const labelled = need + want;
  const needPct = labelled ? Math.round((need / labelled) * 100) : 0;
  const saved = r ? r.budget - r.total : 0;
  const mLabel = `${monthName(date.getMonth(), lang)} ${date.getFullYear()}`;

  const share = async () => {
    if (!r) return;
    tap(true);
    setSharing(true);
    const msg = tr(
      `${mLabel} کا گھریلو حساب: کل خرچ ${rs(r.total, "ur")}${saved > 0 ? `، بجٹ میں سے ${rs(saved, "ur")} بچے!` : ""}\nمیں «گھر کھاتہ» سے حساب رکھتی/رکھتا ہوں — تھوڑا حساب، پورا سکون۔`,
      `Our ${mLabel} home budget: spent ${rs(r.total, "en")}${saved > 0 ? `, saved ${rs(saved, "en")} from budget!` : ""}\nI track it with Ghar Khata — a little counting, a lot of calm.`,
    );
    const ok = await shareCard(cardRef, msg);
    setSharing(false);
    if (!ok) toast(tr("شیئر نہیں ہو سکا", "Couldn't share"), "error");
  };

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + spacing.sm }}>
        <ScreenHeader title={tr("ماہانہ رپورٹ", "Monthly report")}>
          <View style={styles.monthRow}>
            <Pressable testID="report-prev-month" onPress={() => shift(-1)} style={styles.arrow}><Icon name={lang === "ur" ? "chevron-right" : "chevron-left"} /></Pressable>
            <UText size="lg" bold testID="report-month-label">{mLabel}</UText>
            <Pressable testID="report-next-month" disabled={isCurrent} onPress={() => shift(1)} style={[styles.arrow, isCurrent && { opacity: 0.3 }]}><Icon name={lang === "ur" ? "chevron-left" : "chevron-right"} /></Pressable>
          </View>
        </ScreenHeader>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); list.refetch(); }} tintColor={colors.brandPrimary} />}
      >
        {q.isLoading ? <ActivityIndicator style={{ marginTop: spacing["3xl"] }} color={colors.brandPrimary} /> : null}
        {q.isError ? <ErrorView message={tr("رپورٹ نہیں آ سکی", "Couldn't load the report")} onRetry={() => q.refetch()} /> : null}
        {r && r.count === 0 ? <EmptyState testID="report-empty-state" image={EMPTY} title={tr("اس مہینے کوئی خرچ نہیں لکھا", "No expenses this month")} /> : null}
        {r && r.count > 0 ? (
          <>
            <View ref={cardRef} collapsable={false} style={styles.shareCard} testID="report-total-card">
              <View style={styles.rowBetween}>
                <UText size="sm" color={colors.onBrandTertiary}>{r.household_name}</UText>
                <UText size="sm" color={colors.onBrandTertiary}>{mLabel}</UText>
              </View>
              <UText color={colors.onBrandTertiary}>{tr(`کل خرچ (${r.count} خرچ)`, `Total spent (${r.count} expenses)`)}</UText>
              <UText fs={30} bold color={colors.onBrandTertiary} testID="report-total-amount">{rs(r.total, lang)}</UText>
              <UText size="sm" color={colors.onBrandTertiary}>
                {saved >= 0 ? tr(`بجٹ میں سے ${rs(saved, lang)} بچے — شاباش!`, `${rs(saved, lang)} left in the budget — well done!`) : tr(`بجٹ سے ${rs(-saved, lang)} زیادہ — اگلے مہینے تھوڑا دھیان`, `${rs(-saved, lang)} over budget — a little care next month`)}
              </UText>
              {labelled ? (
                <View style={{ gap: spacing.xs, marginTop: spacing.sm }} testID="report-need-want">
                  <View style={[styles.split]}>
                    <View style={{ flex: Math.max(need, 1), backgroundColor: colors.success }} />
                    <View style={{ flex: Math.max(want, labelled * 0.0001), backgroundColor: colors.warning }} />
                  </View>
                  <View style={styles.rowBetween}>
                    <UText size="sm" color={colors.onBrandTertiary}>{tr("ضرورت", "Needs")} {needPct}% · {rs(need, lang)}</UText>
                    <UText size="sm" color={colors.onBrandTertiary}>{tr("خواہش", "Wants")} {100 - needPct}% · {rs(want, lang)}</UText>
                  </View>
                </View>
              ) : null}
              <UText size="sm" color={colors.onBrandTertiary} style={{ opacity: 0.7, marginTop: spacing.xs }}>{tr("گھر کھاتہ — تھوڑا حساب، پورا سکون", "Ghar Khata — a little counting, a lot of calm")}</UText>
            </View>
            <Button testID="share-report-button" label={tr("رپورٹ شیئر کریں", "Share report")} icon="share-2" variant="ghost" loading={sharing} onPress={share} style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }} />

            <Bars testID="report-by-category" title={tr("کس چیز پر خرچ ہوا", "Where it went")} items={r.by_category} total={r.total} labelOf={(k) => findIn(CATEGORIES, k)[lang]} />
            <Bars testID="report-by-method" title={tr("کیسے ادا کیا", "How you paid")} items={r.by_method} total={r.total} labelOf={(k) => findIn(METHODS, k)[lang]} />
            {r.by_member.some((g) => g.key) ? (
              <Bars testID="report-by-member" title={tr("گھر میں کس نے خرچ کیا", "Who spent")} items={r.by_member} total={r.total} labelOf={(k) => k || tr("نامعلوم", "Unknown")} />
            ) : null}

            <UText size="xl" bold style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>{tr("اس مہینے کے خرچ", "This month's expenses")}</UText>
            <UText size="sm" color={colors.muted} style={{ paddingHorizontal: spacing.lg }}>{tr("ضرورت یا خواہش بدلنے کے لیے نشان پر ٹیپ کریں", "Tap the tag to switch between need and want")}</UText>
            {list.data?.map((e, i) => <ExpenseRow key={e.id} e={e} index={i} />)}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c, d) => ({
  root: { flex: 1, backgroundColor: c.surface },
  monthRow: { flexDirection: d.row, alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  arrow: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  shareCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: c.brandTertiary, gap: 2 },
  rowBetween: { flexDirection: d.row, justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, overflow: "hidden", flexDirection: d.row },
  split: { height: 12, borderRadius: radius.pill, overflow: "hidden", flexDirection: d.row, gap: 2 },
}));
