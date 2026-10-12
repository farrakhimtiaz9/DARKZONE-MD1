import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { prettyDate, rs, tap } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { Button, EmptyState, ErrorView, Fab, Icon, ScreenHeader, UText } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";

const EMPTY = "https://images.unsplash.com/photo-1598620617137-2ab990aadd37?crop=entropy&cs=srgb&fm=jpg&q=85&w=600";

export default function UdhaarScreen() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["udhaar"], queryFn: api.udhaar });
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const settle = async (name: string) => {
    tap(true);
    setBusy(name);
    try {
      await api.settle(name);
      qc.invalidateQueries();
      toast(tr(`${name} کے ساتھ حساب برابر ہو گیا`, `All settled with ${name}`));
    } catch {
      toast(tr("حساب برابر نہیں ہو سکا", "Couldn't settle up"), "error");
    } finally {
      setBusy(null);
    }
  };
  const removeEntry = async (id: string) => {
    try { await api.deleteUdhaar(id); qc.invalidateQueries(); } catch { toast(tr("نہیں ہٹ سکا", "Couldn't remove"), "error"); }
  };

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + spacing.sm }}>
        <ScreenHeader title={tr("ادھار کا حساب", "Udhaar ledger")}>
          {q.data ? (
            <View style={styles.totals}>
              <View style={[styles.total, { backgroundColor: colors.successSoft }]} testID="udhaar-total-lena">
                <UText size="sm" color={colors.success}>{tr("لینے ہیں", "To receive")}</UText>
                <UText size="lg" bold color={colors.success}>{rs(q.data.total_lena, lang)}</UText>
              </View>
              <View style={[styles.total, { backgroundColor: colors.errorSoft }]} testID="udhaar-total-dena">
                <UText size="sm" color={colors.error}>{tr("دینے ہیں", "To pay back")}</UText>
                <UText size="lg" bold color={colors.error}>{rs(q.data.total_dena, lang)}</UText>
              </View>
            </View>
          ) : null}
        </ScreenHeader>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + 110, paddingTop: spacing.sm }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
      >
        {q.isLoading ? <ActivityIndicator style={{ marginTop: spacing["3xl"] }} color={colors.brandPrimary} /> : null}
        {q.isError ? <ErrorView message={tr("ادھار کی معلومات نہیں آ سکیں", "Couldn't load udhaar")} onRetry={() => q.refetch()} /> : null}
        {q.data && q.data.people.length === 0 ? (
          <EmptyState testID="udhaar-empty-state" image={EMPTY} title={tr("کوئی ادھار نہیں", "No udhaar")} hint={tr("کسی کو پیسے دیے یا کسی سے لیے؟ + دبا کر لکھ لیں", "Lent or borrowed money? Tap + to note it")} />
        ) : null}
        {q.data?.people.map((p, i) => {
          const lena = p.balance >= 0;
          const expanded = open === p.name;
          return (
            <Animated.View key={p.name} entering={FadeInDown.delay(i * 50)} style={styles.card}>
              <Pressable testID={`udhaar-person-${p.name}`} onPress={() => setOpen(expanded ? null : p.name)} style={styles.personRow}>
                <View style={styles.avatar}><UText size="lg" color={colors.onBrandTertiary} center>{p.name.slice(0, 1)}</UText></View>
                <View style={{ flex: 1 }}>
                  <UText size="lg" bold>{p.name}</UText>
                  <UText size="sm" color={colors.muted}>{p.balance === 0 ? tr("حساب برابر", "Settled") : lena ? tr("انہوں نے آپ کو دینے ہیں", "They owe you") : tr("آپ نے انہیں دینے ہیں", "You owe them")}</UText>
                </View>
                <UText size="lg" bold color={lena ? colors.success : colors.error}>{rs(Math.abs(p.balance), lang)}</UText>
                <Icon name={expanded ? "chevron-up" : "chevron-down"} color={colors.muted} />
              </Pressable>
              {expanded ? (
                <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
                  {p.entries.map((e) => (
                    <View key={e.id} style={styles.entry}>
                      <Icon name={e.kind === "lena" ? "arrow-up-left" : "arrow-down-right"} size={16} color={e.kind === "lena" ? colors.success : colors.error} />
                      <View style={{ flex: 1 }}>
                        <UText size="sm">{e.kind === "lena" ? tr("آپ نے دیے", "You gave") : tr("آپ نے لیے", "You took")}{e.note ? ` — ${e.note}` : ""}</UText>
                        <UText size="sm" color={colors.muted}>{prettyDate(e.date, lang)}</UText>
                      </View>
                      <UText>{rs(e.amount, lang)}</UText>
                      <Pressable testID={`delete-udhaar-${e.id}`} onPress={() => removeEntry(e.id)} hitSlop={8} style={{ width: 32, height: 40, alignItems: "center", justifyContent: "center" }}>
                        <Icon name="trash-2" size={14} color={colors.muted} />
                      </Pressable>
                    </View>
                  ))}
                  <Button testID={`settle-${p.name}`} label={tr("حساب برابر کریں", "Settle up")} variant="secondary" icon="check" loading={busy === p.name} onPress={() => settle(p.name)} />
                </View>
              ) : null}
            </Animated.View>
          );
        })}
      </ScrollView>
      <Fab testID="add-udhaar-fab" bottom={bottomChrome + spacing.lg} onPress={() => { tap(true); router.push("/add-udhaar"); }} />
    </View>
  );
}

const useStyles = makeStyles((c, d) => ({
  root: { flex: 1, backgroundColor: c.surface },
  totals: { flexDirection: d.row, gap: spacing.md, marginTop: spacing.sm },
  total: { flex: 1, borderRadius: radius.md, padding: spacing.md },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  personRow: { flexDirection: d.row, alignItems: "center", gap: spacing.md, minHeight: 48 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  entry: { flexDirection: d.row, alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: c.divider },
}));
