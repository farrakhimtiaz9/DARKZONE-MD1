import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, Group } from "@/src/api";
import { CATEGORIES, METHODS, URDU_MONTHS, findIn, rs } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, ErrorView, Icon, UText } from "@/src/components/ui";

const EMPTY = "https://images.unsplash.com/photo-1627123424574-724758594e93?crop=entropy&cs=srgb&fm=jpg&q=85&w=600";

function ym(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Bars({ title, items, total, labelOf, testID }: { title: string; items: Group[]; total: number; labelOf: (k: string) => string; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const palette = [colors.brandPrimary, colors.brandSecondary, colors.warning, colors.onBrandTertiary, colors.borderStrong];
  return (
    <View style={styles.card} testID={testID}>
      <UText size="lg">{title}</UText>
      {items.map((g, i) => {
        const pct = total ? g.amount / total : 0;
        return (
          <Animated.View key={g.key || i} entering={FadeInDown.delay(i * 60)} style={{ gap: spacing.xs, marginTop: spacing.sm }}>
            <View style={styles.rowBetween}>
              <UText>{labelOf(g.key)}</UText>
              <UText color={colors.muted}>{rs(g.amount)} · {Math.round(pct * 100)}٪</UText>
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
  const [date, setDate] = useState(() => new Date());
  const month = ym(date);
  const q = useQuery({ queryKey: ["report", month], queryFn: () => api.report(month) });
  const r = q.data;
  const shift = (n: number) => setDate((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));
  const isCurrent = month === ym(new Date());

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <UText size="2xl" style={{ lineHeight: 52 }}>ماہانہ رپورٹ</UText>
        <View style={styles.monthRow}>
          <Pressable testID="report-prev-month" onPress={() => shift(-1)} style={styles.arrow}><Icon name="chevron-right" /></Pressable>
          <UText size="lg" testID="report-month-label">{URDU_MONTHS[date.getMonth()]} {date.getFullYear()}</UText>
          <Pressable testID="report-next-month" disabled={isCurrent} onPress={() => shift(1)} style={[styles.arrow, isCurrent && { opacity: 0.3 }]}><Icon name="chevron-left" /></Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
      >
        {q.isLoading ? <ActivityIndicator style={{ marginTop: spacing["3xl"] }} color={colors.brandPrimary} /> : null}
        {q.isError ? <ErrorView message="رپورٹ نہیں آ سکی" onRetry={() => q.refetch()} /> : null}
        {r && r.count === 0 ? <EmptyState testID="report-empty-state" image={EMPTY} title="اس مہینے کوئی خرچ نہیں لکھا" /> : null}
        {r && r.count > 0 ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.brandTertiary, borderColor: colors.brandTertiary }]} testID="report-total-card">
              <UText color={colors.onBrandTertiary}>کل خرچ ({r.count} خرچ)</UText>
              <UText size="2xl" color={colors.onBrandTertiary} style={{ fontSize: 30, lineHeight: 64 }} testID="report-total-amount">{rs(r.total)}</UText>
              <UText size="sm" color={colors.onBrandTertiary}>
                {r.total <= r.budget ? `بجٹ میں سے ${rs(r.budget - r.total)} بچے — شاباش!` : `بجٹ سے ${rs(r.total - r.budget)} زیادہ — اگلے مہینے تھوڑا دھیان رکھیں`}
              </UText>
            </View>
            <Bars testID="report-by-category" title="کس چیز پر خرچ ہوا" items={r.by_category} total={r.total} labelOf={(k) => findIn(CATEGORIES, k).label} />
            <Bars testID="report-by-method" title="کیسے ادا کیا" items={r.by_method} total={r.total} labelOf={(k) => findIn(METHODS, k).label} />
            {r.by_member.some((g) => g.key) ? (
              <Bars testID="report-by-member" title="گھر میں کس نے خرچ کیا" items={r.by_member} total={r.total} labelOf={(k) => k || "نامعلوم"} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  monthRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  arrow: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  rowBetween: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, overflow: "hidden", flexDirection: "row-reverse" },
}));
