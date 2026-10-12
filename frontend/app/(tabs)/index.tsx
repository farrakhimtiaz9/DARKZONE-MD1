import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { rs, tap } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/auth";
import { shareText } from "@/src/share";
import { EmptyState, ErrorView, Fab, Icon, UText } from "@/src/components/ui";
import { ExpenseRow } from "@/src/components/ExpenseRow";
import { useToast } from "@/src/components/Toast";

const HERO = "https://images.unsplash.com/photo-1721015942330-294bee912c90?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";
const ABS = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export default function Home() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr, lang, row } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["summary"], queryFn: api.summary });
  const hh = useQuery({ queryKey: ["household"], queryFn: api.household });
  const s = q.data;
  const first = (user?.name || "").split(" ")[0];

  const pct = s && s.daily_limit > 0 ? Math.min(s.today_spent / s.daily_limit, 1) : 0;
  const over = s ? s.today_left < 0 : false;
  const alone = hh.data ? hh.data.users.length < 2 : false;

  const invite = async () => {
    if (!hh.data) return;
    const ok = await shareText(tr(
      `آئیں، ہمارے گھر کا حساب مل کر رکھیں! «گھر کھاتہ» ایپ میں سائن ان کریں اور یہ کوڈ لکھیں: ${hh.data.invite_code}`,
      `Let's keep our home budget together! Sign in to the Ghar Khata app and enter this code: ${hh.data.invite_code}`,
    ));
    if (ok) toast(tr("دعوت بھیجنے کے لیے تیار", "Invite ready to send"));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <UText size="sm" color={colors.muted}>{tr(`السلام علیکم${first ? `، ${first}` : ""}`, `Hello${first ? `, ${first}` : ""}`)}</UText>
          <UText size="2xl" bold numberOfLines={1} style={{ lineHeight: lang === "ur" ? 52 : 32 }} testID="home-household-name">{s?.household_name ?? tr("گھر کھاتہ", "Ghar Khata")}</UText>
        </View>
        <Pressable testID="open-settings-button" onPress={() => router.push("/settings")} style={styles.iconBtn}>
          <Icon name="settings" size={22} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + 110 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); hh.refetch(); }} tintColor={colors.brandPrimary} />}
      >
        {q.isLoading ? <ActivityIndicator style={{ marginTop: spacing["3xl"] }} color={colors.brandPrimary} /> : null}
        {q.isError ? <ErrorView message={tr("معلومات نہیں آ سکیں", "Couldn't load your summary")} onRetry={() => q.refetch()} /> : null}
        {s ? (
          <>
            <Animated.View entering={FadeInDown.duration(400)} style={styles.hero} testID="home-hero-card">
              <Image source={{ uri: HERO }} style={ABS} contentFit="cover" />
              <LinearGradient colors={[colors.scrimClear, colors.scrim]} style={ABS} />
              <View style={{ padding: spacing.xl, gap: spacing.xs }}>
                <UText color="#FDFBF7">{over ? tr("آج کی حد سے کچھ زیادہ ہو گیا", "A little over today's limit") : tr("آج آپ آرام سے خرچ کر سکتے ہیں", "You can comfortably spend today")}</UText>
                <UText testID="today-left-amount" fs={34} color="#FDFBF7" bold>{rs(Math.abs(s.today_left), lang)}</UText>
                <View style={[styles.track, { flexDirection: row }]}>
                  <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? colors.warning : "#FDFBF7" }]} />
                </View>
                <View style={[styles.heroRow, { flexDirection: row }]}>
                  <UText size="sm" color="#FDFBF7" testID="today-spent-text">{tr("آج کا خرچ", "Spent today")}: {rs(s.today_spent, lang)}</UText>
                  <UText size="sm" color="#FDFBF7">{tr("روزانہ حد", "Daily limit")}: {rs(s.daily_limit, lang)}</UText>
                </View>
              </View>
            </Animated.View>

            <View style={styles.statsRow}>
              <Animated.View entering={FadeInDown.delay(80)} style={styles.stat} testID="month-spent-card">
                <UText size="sm" color={colors.muted}>{tr("اس مہینے خرچ", "Spent this month")}</UText>
                <UText size="lg" bold>{rs(s.month_spent, lang)}</UText>
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(140)} style={styles.stat} testID="month-budget-card">
                <UText size="sm" color={colors.muted}>{tr("مہینے کا بجٹ", "Monthly budget")}</UText>
                <UText size="lg" bold>{rs(s.monthly_budget, lang)}</UText>
              </Animated.View>
            </View>

            {alone ? (
              <Pressable testID="invite-family-banner" onPress={invite} style={[styles.banner, { backgroundColor: colors.successSoft }]}>
                <Icon name="user-plus" color={colors.success} />
                <View style={{ flex: 1 }}>
                  <UText bold color={colors.onSurface}>{tr("گھر والوں کو شامل کریں", "Invite your family")}</UText>
                  <UText size="sm" color={colors.muted}>{tr(`کوڈ ${hh.data?.invite_code} بھیجیں، سب مل کر حساب رکھیں`, `Share code ${hh.data?.invite_code} so everyone adds expenses`)}</UText>
                </View>
                <Icon name="share-2" size={18} color={colors.success} />
              </Pressable>
            ) : null}

            {s.upcoming_bills.length ? (
              <Pressable testID="upcoming-bills-banner" onPress={() => router.push("/bills")} style={[styles.banner, { backgroundColor: colors.brandTertiary }]}>
                <Icon name="bell" color={colors.onBrandTertiary} />
                <UText style={{ flex: 1 }} color={colors.onBrandTertiary}>
                  {tr(`${s.upcoming_bills.length} بل قریب ہیں`, `${s.upcoming_bills.length} bills due soon`)} — {s.upcoming_bills.map((b) => b.name).join(lang === "ur" ? "، " : ", ")}
                </UText>
              </Pressable>
            ) : null}

            <UText size="xl" bold style={styles.section}>{tr("حالیہ خرچ", "Recent expenses")}</UText>
            {s.recent.length === 0 ? (
              <EmptyState testID="home-empty-state" title={tr("ابھی کوئی خرچ نہیں لکھا", "No expenses yet")} hint={tr("+ دبائیں اور بول کر، لکھ کر یا رسید سے خرچ شامل کریں", "Tap + to add by voice, typing or a receipt photo")} />
            ) : (
              s.recent.map((e, i) => <ExpenseRow key={e.id} e={e} index={i} />)
            )}
          </>
        ) : null}
      </ScrollView>

      <Fab testID="add-expense-fab" bottom={bottomChrome + spacing.lg} onPress={() => { tap(true); qc.invalidateQueries({ queryKey: ["settings"] }); router.push("/add-expense"); }} />
    </View>
  );
}

const useStyles = makeStyles((c, d) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: d.row, alignItems: "center", justifyContent: "space-between", gap: spacing.md, backgroundColor: c.surface },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  hero: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#2D2B2A", minHeight: 210, justifyContent: "flex-end" },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
  heroRow: { justifyContent: "space-between", marginTop: spacing.xs },
  statsRow: { flexDirection: d.row, gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  stat: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  banner: { flexDirection: d.row, alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
}));
