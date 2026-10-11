import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { CATEGORIES, METHODS, findIn, prettyDate, rs, tap } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, ErrorView, Fab, Icon, IconBadge, UText } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";

const HERO = "https://images.unsplash.com/photo-1721015942330-294bee912c90?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";

export default function Home() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["summary"], queryFn: api.summary });
  const s = q.data;

  const remove = async (id: string) => {
    try {
      await api.deleteExpense(id);
      qc.invalidateQueries();
      toast("خرچ ہٹا دیا گیا");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const pct = s && s.daily_limit > 0 ? Math.min(s.today_spent / s.daily_limit, 1) : 0;
  const over = s ? s.today_left < 0 : false;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <UText size="2xl" style={{ lineHeight: 52 }}>گھر کھاتہ</UText>
          <UText size="sm" color={colors.muted}>آپ کا گھریلو ساتھی</UText>
        </View>
        <Pressable testID="open-settings-button" onPress={() => router.push("/settings")} style={styles.iconBtn}>
          <Icon name="settings" size={22} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + 110 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
      >
        {q.isLoading ? <ActivityIndicator style={{ marginTop: spacing["3xl"] }} color={colors.brandPrimary} /> : null}
        {q.isError ? <ErrorView message="معلومات نہیں آ سکیں" onRetry={() => q.refetch()} /> : null}
        {s ? (
          <>
            <Animated.View entering={FadeInDown.duration(400)} style={styles.hero} testID="home-hero-card">
              <Image source={{ uri: HERO }} style={StyleSheetAbs} contentFit="cover" />
              <LinearGradient colors={[colors.scrimClear, colors.scrim]} style={StyleSheetAbs} />
              <View style={{ padding: spacing.xl, gap: spacing.xs }}>
                <UText color={colors.onSurfaceInverse}>{over ? "آج کی حد سے کچھ زیادہ ہو گیا" : "آج آپ آرام سے خرچ کر سکتے ہیں"}</UText>
                <UText testID="today-left-amount" size="2xl" color={colors.onSurfaceInverse} style={{ fontSize: 34, lineHeight: 72 }}>
                  {rs(Math.abs(s.today_left))}
                </UText>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? colors.warning : colors.onSurfaceInverse }]} />
                </View>
                <View style={styles.heroRow}>
                  <UText size="sm" color={colors.onSurfaceInverse} testID="today-spent-text">آج کا خرچ: {rs(s.today_spent)}</UText>
                  <UText size="sm" color={colors.onSurfaceInverse}>روزانہ حد: {rs(s.daily_limit)}</UText>
                </View>
              </View>
            </Animated.View>

            <View style={styles.statsRow}>
              <View style={styles.stat} testID="month-spent-card">
                <UText size="sm" color={colors.muted}>اس مہینے خرچ</UText>
                <UText size="lg">{rs(s.month_spent)}</UText>
              </View>
              <View style={styles.stat} testID="month-budget-card">
                <UText size="sm" color={colors.muted}>مہینے کا بجٹ</UText>
                <UText size="lg">{rs(s.monthly_budget)}</UText>
              </View>
            </View>

            {s.upcoming_bills.length ? (
              <Pressable testID="upcoming-bills-banner" onPress={() => router.push("/bills")} style={styles.billBanner}>
                <Icon name="bell" color={colors.onBrandTertiary} />
                <UText style={{ flex: 1 }} color={colors.onBrandTertiary}>
                  {s.upcoming_bills.length} بل قریب ہیں — {s.upcoming_bills.map((b) => b.name).join("، ")}
                </UText>
              </Pressable>
            ) : null}

            <UText size="xl" style={styles.section}>حالیہ خرچ</UText>
            {s.recent.length === 0 ? (
              <EmptyState testID="home-empty-state" title="ابھی کوئی خرچ نہیں لکھا" hint="نیچے + دبائیں اور بول کر یا لکھ کر خرچ شامل کریں" />
            ) : (
              s.recent.map((e, i) => {
                const c = findIn(CATEGORIES, e.category);
                const m = findIn(METHODS, e.payment_method);
                return (
                  <Animated.View key={e.id} entering={FadeInDown.delay(i * 50)} style={styles.row} testID={`expense-row-${e.id}`}>
                    <IconBadge name={c.icon} />
                    <View style={{ flex: 1 }}>
                      <UText>{e.note || c.label}</UText>
                      <UText size="sm" color={colors.muted}>
                        {c.label} · {m.label}{e.member ? ` · ${e.member}` : ""} · {prettyDate(e.date)}
                      </UText>
                    </View>
                    <UText size="lg">{rs(e.amount)}</UText>
                    <Pressable testID={`delete-expense-${e.id}`} onPress={() => remove(e.id)} hitSlop={8} style={styles.iconBtnSm}>
                      <Icon name="trash-2" size={16} color={colors.muted} />
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>

      <Fab testID="add-expense-fab" bottom={bottomChrome + spacing.lg} onPress={() => { tap(true); qc.invalidateQueries({ queryKey: ["settings"] }); router.push("/add-expense"); }} />
    </View>
  );
}

const StyleSheetAbs = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: c.surface },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  iconBtnSm: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  hero: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surfaceInverse, minHeight: 210, justifyContent: "flex-end" },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden", flexDirection: "row-reverse" },
  fill: { height: 8, borderRadius: radius.pill },
  heroRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: spacing.xs },
  statsRow: { flexDirection: "row-reverse", gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  stat: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  billBanner: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.brandTertiary },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
}));
