import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { api, Parsed } from "@/src/api";
import { CATEGORIES, METHODS, tap } from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Chip, ChipRow, Field, Label, UText } from "@/src/components/ui";
import { ModalHeader } from "@/src/components/ModalHeader";
import { VoiceButton } from "@/src/components/VoiceButton";
import { useToast } from "@/src/components/Toast";

export default function AddExpense() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("grocery");
  const [method, setMethod] = useState("cash");
  const [member, setMember] = useState("");
  const [note, setNote] = useState("");
  const [sms, setSms] = useState("");
  const [heard, setHeard] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const apply = (p: Parsed) => {
    if (p.amount > 0) setAmount(String(Math.round(p.amount)));
    setCategory(p.category);
    setMethod(p.payment_method);
    if (p.note) setNote(p.note);
    if (p.member) setMember(p.member);
  };

  const understand = async (text: string) => {
    setParsing(true);
    setErr("");
    try {
      const p = await api.parse(text);
      apply(p);
      toast(p.amount > 0 ? "مددگار نے خرچ بھر دیا، دیکھ کر محفوظ کریں" : "رقم سمجھ نہیں آئی، خود لکھ دیں");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    const n = Number(amount.replace(/[^\d.]/g, ""));
    if (!n || n <= 0) { setErr("براہِ کرم رقم لکھیں"); return; }
    tap(true);
    setSaving(true);
    try {
      await api.addExpense({ amount: n, category, payment_method: method, member, note: note.trim() });
      qc.invalidateQueries();
      toast("خرچ محفوظ ہو گیا");
      router.back();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const members = settings.data?.members ?? [];

  return (
    <View style={styles.root}>
      <ModalHeader title="خرچ لکھیں" />
      <KeyboardAwareScrollView bottomOffset={100} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <VoiceButton onText={(t) => { setHeard(t); understand(t); }} onError={(m) => toast(m, "error")} />
        {heard ? (
          <View style={styles.heard} testID="voice-transcript">
            <UText size="sm" color={colors.muted}>آپ نے کہا:</UText>
            <UText>{heard}</UText>
          </View>
        ) : null}

        <View style={styles.smsBox}>
          <UText size="lg">بینک / جاز کیش / ایزی پیسہ کا پیغام</UText>
          <UText size="sm" color={colors.muted}>پیغام کاپی کر کے یہاں چسپاں کریں، مددگار خود خرچ نکال لے گا</UText>
          <Field testID="sms-paste-input" value={sms} onChangeText={setSms} placeholder="یہاں پیغام چسپاں کریں…" multiline style={{ minHeight: 80, backgroundColor: colors.surface }} />
          <Button testID="sms-parse-button" label="پیغام سمجھیں" icon="message-square" variant="secondary" loading={parsing} disabled={!sms.trim()} onPress={() => understand(sms)} />
        </View>

        <Label>رقم (روپے)</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="expense-amount-input" value={amount} onChangeText={(t) => { setAmount(t); setErr(""); }} placeholder="مثلاً 500" keyboardType="numeric" style={{ fontSize: 24, minHeight: 68 }} />
          {err ? <UText testID="expense-amount-error" size="sm" color={colors.error}>{err}</UText> : null}
        </View>

        <Label>کس چیز پر؟</Label>
        <ChipRow>
          {CATEGORIES.map((c) => <Chip key={c.key} testID={`category-chip-${c.key}`} label={c.label} icon={c.icon} selected={category === c.key} onPress={() => setCategory(c.key)} />)}
        </ChipRow>

        <Label>کیسے ادا کیا؟</Label>
        <ChipRow>
          {METHODS.map((m) => <Chip key={m.key} testID={`method-chip-${m.key}`} label={m.label} icon={m.icon} selected={method === m.key} onPress={() => setMethod(m.key)} />)}
        </ChipRow>

        {members.length ? (
          <>
            <Label>کس نے خرچ کیا؟</Label>
            <ChipRow>
              {members.map((m) => <Chip key={m} testID={`member-chip-${m}`} label={m} selected={member === m} onPress={() => setMember(member === m ? "" : m)} />)}
            </ChipRow>
          </>
        ) : null}

        <Label>تفصیل (اختیاری)</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="expense-note-input" value={note} onChangeText={setNote} placeholder="مثلاً آٹا اور چینی" />
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button testID="save-expense-button" label="محفوظ کریں" icon="check" loading={saving} onPress={save} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  heard: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.brandTertiary },
  smsBox: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
}));
