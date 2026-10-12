import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { api } from "@/src/api";
import { tap } from "@/src/constants";
import { makeStyles, radius, spacing, themes, ThemeName, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/auth";
import { shareText } from "@/src/share";
import { Button, Field, Icon, Label, UText } from "@/src/components/ui";
import { ModalHeader } from "@/src/components/ModalHeader";
import { useToast } from "@/src/components/Toast";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors, themeName, setTheme } = useTheme();
  const { tr, lang, setLang, row } = useI18n();
  const { signOut, refresh } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["household"], queryFn: api.household });
  const [hname, setHname] = useState("");
  const [budget, setBudget] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) { setHname(q.data.name); setBudget(String(Math.round(q.data.monthly_budget))); setMembers(q.data.members); }
  }, [q.data]);

  const add = () => {
    const m = newMember.trim();
    if (m && !members.includes(m)) setMembers([...members, m]);
    setNewMember("");
  };

  const save = async () => {
    tap(true);
    setSaving(true);
    try {
      await api.saveSettings({ name: hname, monthly_budget: Number(budget.replace(/[^\d.]/g, "")) || 0, members });
      qc.invalidateQueries();
      toast(tr("ترتیبات محفوظ ہو گئیں", "Settings saved"));
      router.back();
    } catch {
      toast(tr("محفوظ نہیں ہو سکا", "Couldn't save"), "error");
    } finally {
      setSaving(false);
    }
  };

  const invite = () => q.data && shareText(tr(
    `آئیں، ہمارے گھر کا حساب مل کر رکھیں! «گھر کھاتہ» ایپ میں سائن ان کریں اور یہ کوڈ لکھیں: ${q.data.invite_code}`,
    `Let's keep our home budget together! Sign in to the Ghar Khata app and enter this code: ${q.data.invite_code}`,
  ));
  const shareApp = () => shareText(tr(
    "میں گھر کا حساب «گھر کھاتہ» سے رکھتی/رکھتا ہوں — بول کر خرچ لکھیں، بل کی یاد دہانی، ادھار کا حساب۔ تھوڑا حساب، پورا سکون۔ آپ بھی آزمائیں!",
    "I run our home budget with Ghar Khata — speak your expenses, bill reminders, udhaar tracking. A little counting, a lot of calm. Try it!",
  ));
  const leave = async () => {
    try { await api.leaveHousehold(); qc.clear(); await refresh(); } catch { toast(tr("نہیں ہو سکا", "Couldn't leave"), "error"); }
  };

  return (
    <View style={styles.root}>
      <ModalHeader title={tr("ترتیبات", "Settings")} />
      {q.isLoading ? <ActivityIndicator style={{ marginTop: spacing["3xl"] }} color={colors.brandPrimary} /> : (
        <KeyboardAwareScrollView bottomOffset={100} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {q.data ? (
            <View style={styles.inviteCard} testID="invite-card">
              <UText size="sm" color={colors.onBrandTertiary}>{tr("گھر والوں کے لیے دعوتی کوڈ", "Family invite code")}</UText>
              <UText testID="invite-code-text" fs={30} bold color={colors.onBrandTertiary} style={{ fontFamily: "Nunito", letterSpacing: 6, lineHeight: 42 }} center>{q.data.invite_code}</UText>
              <Button testID="share-invite-button" label={tr("کوڈ بھیجیں", "Share invite")} icon="share-2" onPress={invite} />
              <View style={{ flexDirection: row, flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
                {q.data.users.map((u) => (
                  <View key={u.email} style={[styles.userPill, { flexDirection: row }]}>
                    {u.picture ? <Image source={{ uri: u.picture }} style={{ width: 22, height: 22, borderRadius: 11 }} /> : <Icon name="user" size={14} />}
                    <UText size="sm" style={{ lineHeight: lang === "ur" ? 22 : 18 }}>{u.name || u.email}</UText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Label>{tr("زبان", "Language")}</Label>
          <View style={[styles.seg, { flexDirection: row }]}>
            {(["ur", "en"] as const).map((l) => (
              <Pressable key={l} testID={`language-${l}`} onPress={() => setLang(l)} style={[styles.segItem, lang === l && { backgroundColor: colors.brandPrimary }]}>
                <UText color={lang === l ? colors.onBrandPrimary : colors.onSurface} center style={{ fontFamily: l === "ur" ? "NotoNastaliqUrdu" : "Nunito" }}>{l === "ur" ? "اردو" : "English"}</UText>
              </Pressable>
            ))}
          </View>

          <Label>{tr("رنگ", "Theme")}</Label>
          <View style={[styles.themes, { flexDirection: row }]}>
            {(Object.keys(themes) as ThemeName[]).map((k) => {
              const t = themes[k];
              const sel = themeName === k;
              return (
                <Pressable key={k} testID={`theme-${k}`} onPress={() => { tap(); setTheme(k); }} style={[styles.themeItem, { borderColor: sel ? colors.brandPrimary : colors.border }]}>
                  <View style={[styles.swatch, { backgroundColor: t.colors.surface }]}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: t.colors.brandPrimary }} />
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.colors.brandSecondary }} />
                  </View>
                  <UText size="sm" center>{t[lang]}</UText>
                </Pressable>
              );
            })}
          </View>

          <Label>{tr("گھر کا نام", "Household name")}</Label>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Field testID="settings-household-name-input" value={hname} onChangeText={setHname} />
          </View>

          <Label>{tr("مہینے کا گھریلو بجٹ (روپے)", "Monthly household budget (Rs)")}</Label>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Field testID="settings-budget-input" value={budget} onChangeText={setBudget} keyboardType="numeric" placeholder={tr("مثلاً 60000", "e.g. 60000")} />
            <UText size="sm" color={colors.muted}>{tr("اسی سے روزانہ کی آرام دہ حد نکالی جاتی ہے", "Your comfortable daily limit is worked out from this")}</UText>
          </View>

          <Label>{tr("خرچ کرنے والے افراد", "Family members")}</Label>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {members.map((m) => (
              <View key={m} style={[styles.member, { flexDirection: row }]}>
                <UText style={{ flex: 1 }}>{m}</UText>
                <Pressable testID={`remove-member-${m}`} onPress={() => setMembers(members.filter((x) => x !== m))} hitSlop={8} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="x" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            <View style={{ flexDirection: row, gap: spacing.sm }}>
              <Field testID="new-member-input" value={newMember} onChangeText={setNewMember} placeholder={tr("نیا نام، مثلاً دادی", "New name, e.g. Dadi")} style={{ flex: 1 }} onSubmitEditing={add} returnKeyType="done" />
              <Button testID="add-member-button" label={tr("شامل", "Add")} variant="ghost" icon="plus" onPress={add} style={{ minHeight: 56 }} />
            </View>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.xl }}>
            <Button testID="share-app-button" label={tr("دوستوں کو بتائیں", "Tell your friends")} icon="heart" variant="ghost" onPress={shareApp} />
            <Button testID="leave-household-button" label={tr("یہ گھر چھوڑیں", "Leave this household")} icon="log-out" variant="ghost" onPress={leave} />
            <Button testID="signout-button" label={tr("سائن آؤٹ", "Sign out")} icon="power" variant="danger" onPress={signOut} />
          </View>
        </KeyboardAwareScrollView>
      )}
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button testID="save-settings-button" label={tr("محفوظ کریں", "Save")} icon="check" loading={saving} onPress={save} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  inviteCard: { margin: spacing.lg, padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg, backgroundColor: c.brandTertiary },
  userPill: { alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, minHeight: 32, borderRadius: radius.pill, backgroundColor: c.surface },
  seg: { marginHorizontal: spacing.lg, padding: 4, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, gap: 4 },
  segItem: { flex: 1, minHeight: 44, borderRadius: radius.sm, justifyContent: "center" },
  themes: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  themeItem: { flex: 1, borderWidth: 2, borderRadius: radius.md, padding: spacing.xs, gap: 2 },
  swatch: { height: 48, borderRadius: radius.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  member: { alignItems: "center", paddingHorizontal: spacing.lg, minHeight: 52, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
}));
