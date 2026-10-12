import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { api, Parsed } from "@/src/api";
import { CATEGORIES, METHODS, tap } from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { Button, Chip, ChipRow, Field, Label, UText } from "@/src/components/ui";
import { ModalHeader } from "@/src/components/ModalHeader";
import { VoiceButton } from "@/src/components/VoiceButton";
import { ReceiptButtons } from "@/src/components/ReceiptButtons";
import { useToast } from "@/src/components/Toast";

export default function AddExpense() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr, lang } = useI18n();
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
  const [catTouched, setCatTouched] = useState(false);
  const [autoCat, setAutoCat] = useState(false);
  const catTurn = useRef(0);

  // Smart helper picks the category from the note as the user types (unless they chose one themselves).
  useEffect(() => {
    const text = note.trim();
    if (catTouched || text.length < 2) return;
    const myTurn = ++catTurn.current;
    const t = setTimeout(async () => {
      try {
        const r = await api.categorize(text);
        if (myTurn !== catTurn.current || !r.category || r.confidence < 0.4) return;
        setCategory(r.category);
        setAutoCat(true);
      } catch { /* keep the current category */ }
    }, 600);
    return () => clearTimeout(t);
  }, [note, catTouched]);

  const smsKindMsg: Record<string, string> = {
    received: tr("یہ پیغام رقم ملنے کا ہے، خرچ نہیں — اسے نہیں لکھا", "This message is money received, not a spend — not added"),
    otp: tr("یہ تصدیقی کوڈ کا پیغام ہے، اس میں کوئی خرچ نہیں", "This is a verification code, there's no spend in it"),
    balance: tr("یہ صرف بیلنس کی اطلاع ہے، کوئی نیا خرچ نہیں", "This is only a balance alert, no new spend"),
    promo: tr("یہ اشتہار یا اطلاع لگتی ہے، اس میں کوئی خرچ نہیں", "This looks like an ad or notice, no spend in it"),
  };
  const spendMsg: Record<string, string> = {
    slightly_high: tr("خرچ محفوظ ہو گیا — آج کی حد سے تھوڑا زیادہ ہے، کوئی بات نہیں", "Saved — a bit above today's limit, that's okay"),
    unusual: tr("خرچ محفوظ ہو گیا — یہ معمول سے بڑا خرچ ہے، باقی دن ذرا ہاتھ روک کر", "Saved — a bigger spend than usual, maybe go easy for the rest of the day"),
  };

  const apply = (p: Parsed) => {
    if (p.amount > 0) setAmount(String(Math.round(p.amount)));
    setCategory(p.category);
    setMethod(p.payment_method);
    if (p.note) setNote(p.note);
    if (p.member) setMember(p.member);
    toast(p.amount > 0 ? tr("مددگار نے خرچ بھر دیا، دیکھ کر محفوظ کریں", "Your helper filled it in — check and save") : tr("رقم سمجھ نہیں آئی، خود لکھ دیں", "Couldn't find the amount, please type it"));
  };

  const understand = async (text: string, source: "voice" | "sms") => {
    setParsing(true);
    setErr("");
    try {
      const p = await api.parse(text, source);
      if (!p.is_spend) {
        toast(smsKindMsg[p.sms_kind ?? ""] ?? tr("اس پیغام میں کوئی خرچ نہیں ملا", "No spend found in this message"), "error");
        return;
      }
      apply(p);
    } catch {
      toast(tr("مددگار ابھی دستیاب نہیں، تھوڑی دیر بعد کوشش کریں", "Helper is busy, please try again shortly"), "error");
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    const n = Number(amount.replace(/[^\d.]/g, ""));
    if (!n || n <= 0) { setErr(tr("براہِ کرم رقم لکھیں", "Please enter an amount")); return; }
    tap(true);
    setSaving(true);
    try {
      const saved = await api.addExpense({ amount: n, category, payment_method: method, member, note: note.trim() });
      qc.invalidateQueries();
      toast(spendMsg[saved.spend_level ?? ""] ?? tr("خرچ محفوظ ہو گیا", "Expense saved"));
      router.back();
    } catch {
      toast(tr("خرچ محفوظ نہیں ہو سکا", "Couldn't save the expense"), "error");
    } finally {
      setSaving(false);
    }
  };

  const members = settings.data?.members ?? [];

  return (
    <View style={styles.root}>
      <ModalHeader title={tr("خرچ لکھیں", "Add expense")} />
      <KeyboardAwareScrollView bottomOffset={100} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <VoiceButton onText={(t) => { setHeard(t); understand(t, "voice"); }} onError={(m) => toast(m, "error")} />
        {heard ? (
          <View style={styles.heard} testID="voice-transcript">
            <UText size="sm" color={colors.muted}>{tr("آپ نے کہا:", "You said:")}</UText>
            <UText>{heard}</UText>
          </View>
        ) : null}

        <View style={styles.box}>
          <UText size="lg" bold>{tr("رسید سے", "From a receipt")}</UText>
          <ReceiptButtons onParsed={apply} onError={(m) => toast(m, "error")} />
        </View>

        <View style={styles.box}>
          <UText size="lg" bold>{tr("بینک / جاز کیش / ایزی پیسہ کا پیغام", "Bank / JazzCash / Easypaisa SMS")}</UText>
          <UText size="sm" color={colors.muted}>{tr("پیغام کاپی کر کے یہاں چسپاں کریں، مددگار خود خرچ نکال لے گا", "Paste the message here and the helper will pull out the expense")}</UText>
          <Field testID="sms-paste-input" value={sms} onChangeText={setSms} placeholder={tr("یہاں پیغام چسپاں کریں…", "Paste the message here…")} multiline style={{ minHeight: 80, backgroundColor: colors.surface }} />
          <Button testID="sms-parse-button" label={tr("پیغام سمجھیں", "Read message")} icon="message-square" variant="secondary" loading={parsing} disabled={!sms.trim()} onPress={() => understand(sms, "sms")} />
        </View>

        <Label>{tr("رقم (روپے)", "Amount (Rs)")}</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="expense-amount-input" value={amount} onChangeText={(t) => { setAmount(t); setErr(""); }} placeholder={tr("مثلاً 500", "e.g. 500")} keyboardType="numeric" style={{ fontSize: 24, minHeight: 68 }} />
          {err ? <UText testID="expense-amount-error" size="sm" color={colors.error}>{err}</UText> : null}
        </View>

        <Label>{tr("تفصیل", "Note")}</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="expense-note-input" value={note} onChangeText={setNote} placeholder={tr("مثلاً آٹا اور چینی", "e.g. flour and sugar")} />
        </View>

        <Label>{tr("کس چیز پر؟", "Category")}</Label>
        {autoCat && !catTouched ? (
          <UText testID="auto-category-hint" size="sm" color={colors.success} style={{ paddingHorizontal: spacing.lg }}>{tr("مددگار نے تفصیل دیکھ کر قسم چن لی — چاہیں تو بدل دیں", "Picked from your note — change it if you like")}</UText>
        ) : null}
        <ChipRow>
          {CATEGORIES.map((c) => <Chip key={c.key} testID={`category-chip-${c.key}`} label={c[lang]} icon={c.icon} selected={category === c.key} onPress={() => { setCategory(c.key); setCatTouched(true); }} />)}
        </ChipRow>

        <Label>{tr("کیسے ادا کیا؟", "Paid with")}</Label>
        <ChipRow>
          {METHODS.map((m) => <Chip key={m.key} testID={`method-chip-${m.key}`} label={m[lang]} icon={m.icon} selected={method === m.key} onPress={() => setMethod(m.key)} />)}
        </ChipRow>

        {members.length ? (
          <>
            <Label>{tr("کس نے خرچ کیا؟", "Who spent?")}</Label>
            <ChipRow>
              {members.map((m) => <Chip key={m} testID={`member-chip-${m}`} label={m} selected={member === m} onPress={() => setMember(member === m ? "" : m)} />)}
            </ChipRow>
          </>
        ) : null}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button testID="save-expense-button" label={tr("محفوظ کریں", "Save")} icon="check" loading={saving} onPress={save} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  heard: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.brandTertiary },
  box: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
}));
