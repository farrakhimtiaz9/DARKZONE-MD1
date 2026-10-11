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
import { Button, EmptyState, ErrorView, Fab, Icon, UText } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";

const EMPTY = "https://images.unsplash.com/photo-1598620617137-2ab990aadd37?crop=entropy&cs=srgb&fm=jpg&q=85&w=600";

export default function UdhaarScreen() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
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
      toast(`${name} کے ساتھ حساب برابر ہو گیا`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const removeEntry = async (id: string) => {
    try { await api.deleteUdhaar(id); qc.invalidateQueries(); } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <UText size="2xl" style={{ lineHeight: 52 }}>ادھار کا حساب</UText>
        {q.data ? (
          <View style={styles.totals}>
            <View style={[styles.total, { backgroundColor: colors.successSoft }]} testID="udhaar-total-lena">
              <UText size="sm" color={colors.success}>لینے ہیں</UText>
              <UText size="lg" color={colors.success}>{rs(q.data.total_lena)}</UText>
            </View>
            <View style={[styles.total, { backgroundColor: colors.errorSoft }]} testID="udhaar-total-dena">
              <UText size="sm" color={colors.error}>دینے ہیں</UText>
              <UText size="lg" color={colors.error}>{rs(q.data.total_dena)}</UText>
            </View>
          </View>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + 110, paddingTop: spacing.sm }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
      >
        {q.isLoading ? <ActivityIndicator style={{ marginTop: spacing["3xl"] }} color={colors.brandPrimary} /> : null}
        {q.isError ? <ErrorView message="ادھار کی معلومات نہیں آ سکیں" onRetry={() => q.refetch()} /> : null}
        {q.data && q.data.people.length === 0 ? (
          <EmptyState testID="udhaar-empty-state" image={EMPTY} title="کوئی ادھار نہیں" hint="کسی کو پیسے دیے یا کسی سے لیے؟ نیچے + دبا کر لکھ لیں" />
        ) : null}
        {q.data?.people.map((p, i) => {
          const lena = p.balance >= 0;
          const expanded = open === p.name;
          return (
            <Animated.View key={p.name} entering={FadeInDown.delay(i * 50)} style={styles.card}>
              <Pressable testID={`udhaar-person-${p.name}`} onPress={() => setOpen(expanded ? null : p.name)} style={styles.personRow}>
                <View style={styles.avatar}><UText size="lg" color={colors.onBrandTertiary} style={{ textAlign: "center" }}>{p.name.slice(0, 1)}</UText></View>
                <View style={{ flex: 1 }}>
                  <UText size="lg">{p.name}</UText>
                  <UText size="sm" color={colors.muted}>{p.balance === 0 ? "حساب برابر" : lena ? "انہوں نے آپ کو دینے ہیں" : "آپ نے انہیں دینے ہیں"}</UText>
                </View>
                <UText size="lg" color={lena ? colors.success : colors.error}>{rs(Math.abs(p.balance))}</UText>
                <Icon name={expanded ? "chevron-up" : "chevron-down"} color={colors.muted} />
              </Pressable>
              {expanded ? (
                <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
                  {p.entries.map((e) => (
                    <View key={e.id} style={styles.entry}>
                      <Icon name={e.kind === "lena" ? "arrow-up-left" : "arrow-down-right"} size={16} color={e.kind === "lena" ? colors.success : colors.error} />
                      <View style={{ flex: 1 }}>
                        <UText size="sm">{e.kind === "lena" ? "آپ نے دیے" : "آپ نے لیے"}{e.note ? ` — ${e.note}` : ""}</UText>
                        <UText size="sm" color={colors.muted}>{prettyDate(e.date)}</UText>
                      </View>
                      <UText>{rs(e.amount)}</UText>
                      <Pressable testID={`delete-udhaar-${e.id}`} onPress={() => removeEntry(e.id)} hitSlop={8} style={{ width: 32, height: 40, alignItems: "center", justifyContent: "center" }}>
                        <Icon name="trash-2" size={14} color={colors.muted} />
                      </Pressable>
                    </View>
                  ))}
                  <Button testID={`settle-${p.name}`} label="حساب برابر کریں" variant="secondary" icon="check" loading={busy === p.name} onPress={() => settle(p.name)} />
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

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  totals: { flexDirection: "row-reverse", gap: spacing.md, marginTop: spacing.sm },
  total: { flex: 1, borderRadius: radius.md, padding: spacing.md },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  personRow: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.md, minHeight: 48 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  entry: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: c.divider },
}));
