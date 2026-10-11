import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, Bill } from "@/src/api";
import { BILL_KINDS, findIn, rs, tap } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, ErrorView, Fab, Icon, IconBadge, UText } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";

const EMPTY = "https://images.unsplash.com/photo-1627123424574-724758594e93?crop=entropy&cs=srgb&fm=jpg&q=85&w=600";

function dueText(b: Bill) {
  if (b.paid_this_month) return "اس مہینے ادا ہو چکا";
  if (b.days_left > 1) return `${b.days_left} دن باقی (${b.due_day} تاریخ)`;
  if (b.days_left === 1) return "کل آخری تاریخ ہے";
  if (b.days_left === 0) return "آج آخری تاریخ ہے";
  return `تاریخ گزر گئی (${b.due_day} تاریخ)`;
}

export default function BillsScreen() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["bills"], queryFn: api.bills });
  const [busy, setBusy] = useState<string | null>(null);

  const pay = async (b: Bill) => {
    tap(true);
    setBusy(b.id);
    try {
      await api.payBill(b.id);
      qc.invalidateQueries();
      toast(`${b.name} کا بل ادا ہو گیا، خرچ میں بھی لکھ دیا`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (id: string) => {
    try { await api.deleteBill(id); qc.invalidateQueries(); toast("بل ہٹا دیا گیا"); } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <UText size="2xl" style={{ lineHeight: 52 }}>بل کی یاد دہانی</UText>
        <UText size="sm" color={colors.muted}>بجلی، گیس، انٹرنیٹ اور موبائل — کوئی تاریخ نہ چُوکے</UText>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + 110, paddingTop: spacing.sm }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
      >
        {q.isLoading ? <ActivityIndicator style={{ marginTop: spacing["3xl"] }} color={colors.brandPrimary} /> : null}
        {q.isError ? <ErrorView message="بل نہیں آ سکے" onRetry={() => q.refetch()} /> : null}
        {q.data && q.data.length === 0 ? (
          <EmptyState testID="bills-empty-state" image={EMPTY} title="کوئی بل نہیں" hint="اپنے ماہانہ بل شامل کریں، ہم وقت پر یاد دلائیں گے" />
        ) : null}
        {q.data?.map((b, i) => {
          const k = findIn(BILL_KINDS, b.kind);
          const urgent = !b.paid_this_month && b.days_left <= 3;
          return (
            <Animated.View key={b.id} entering={FadeInDown.delay(i * 50)} style={[styles.card, urgent && { borderColor: colors.warning, backgroundColor: colors.warningSoft }]} testID={`bill-card-${b.id}`}>
              <View style={styles.row}>
                <IconBadge name={k.icon} bg={b.paid_this_month ? colors.successSoft : undefined} fg={b.paid_this_month ? colors.success : undefined} />
                <View style={{ flex: 1 }}>
                  <UText size="lg">{b.name}</UText>
                  <UText size="sm" color={b.paid_this_month ? colors.success : urgent ? colors.onBrandTertiary : colors.muted}>{dueText(b)}</UText>
                </View>
                <UText size="lg">{rs(b.amount)}</UText>
                <Pressable testID={`delete-bill-${b.id}`} onPress={() => remove(b.id)} hitSlop={8} style={{ width: 32, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="trash-2" size={16} color={colors.muted} />
                </Pressable>
              </View>
              {!b.paid_this_month ? (
                <Button testID={`pay-bill-${b.id}`} label="ادا ہو گیا" icon="check-circle" variant="secondary" loading={busy === b.id} onPress={() => pay(b)} style={{ marginTop: spacing.md }} />
              ) : null}
            </Animated.View>
          );
        })}
      </ScrollView>
      <Fab testID="add-bill-fab" bottom={bottomChrome + spacing.lg} onPress={() => { tap(true); router.push("/add-bill"); }} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.md },
}));
