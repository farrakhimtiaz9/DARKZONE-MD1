import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { api } from "@/src/api";
import { tap } from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Field, Icon, Label, UText } from "@/src/components/ui";
import { ModalHeader } from "@/src/components/ModalHeader";
import { useToast } from "@/src/components/Toast";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [budget, setBudget] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) { setBudget(String(Math.round(q.data.monthly_budget))); setMembers(q.data.members); }
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
      await api.saveSettings({ monthly_budget: Number(budget.replace(/[^\d.]/g, "")) || 0, members });
      qc.invalidateQueries();
      toast("ترتیبات محفوظ ہو گئیں");
      router.back();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ModalHeader title="گھر کی ترتیبات" />
      {q.isLoading ? <ActivityIndicator style={{ marginTop: spacing["3xl"] }} color={colors.brandPrimary} /> : (
        <KeyboardAwareScrollView bottomOffset={100} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Label>مہینے کا گھریلو بجٹ (روپے)</Label>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Field testID="settings-budget-input" value={budget} onChangeText={setBudget} keyboardType="numeric" placeholder="مثلاً 60000" />
            <UText size="sm" color={colors.muted}>اسی سے روزانہ کی آرام دہ حد نکالی جاتی ہے</UText>
          </View>

          <Label>گھر کے افراد (مشترکہ کھاتہ)</Label>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {members.map((m) => (
              <View key={m} style={styles.member}>
                <UText style={{ flex: 1 }}>{m}</UText>
                <Pressable testID={`remove-member-${m}`} onPress={() => setMembers(members.filter((x) => x !== m))} hitSlop={8} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="x" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            <View style={{ flexDirection: "row-reverse", gap: spacing.sm }}>
              <Field testID="new-member-input" value={newMember} onChangeText={setNewMember} placeholder="نیا نام، مثلاً دادی" style={{ flex: 1 }} onSubmitEditing={add} returnKeyType="done" />
              <Button testID="add-member-button" label="شامل" variant="ghost" icon="plus" onPress={add} style={{ minHeight: 56 }} />
            </View>
          </View>
        </KeyboardAwareScrollView>
      )}
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button testID="save-settings-button" label="محفوظ کریں" icon="check" loading={saving} onPress={save} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  member: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: spacing.lg, minHeight: 52, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
}));
