import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { api } from "@/src/api";
import { BILL_KINDS, tap } from "@/src/constants";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { Button, Chip, ChipRow, Field, Label, UText } from "@/src/components/ui";
import { ModalHeader } from "@/src/components/ModalHeader";
import { useToast } from "@/src/components/Toast";

export default function AddBill() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState("electricity");
  const [name, setName] = useState(BILL_KINDS[0][lang]);
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const pickKind = (k: string) => {
    const prev = BILL_KINDS.find((b) => b.key === kind);
    const next = BILL_KINDS.find((b) => b.key === k);
    setKind(k);
    if (!name || name === prev?.ur || name === prev?.en) setName(k === "other" || !next ? "" : next[lang]);
  };

  const save = async () => {
    const d = parseInt(day, 10);
    const n = Number(amount.replace(/[^\d.]/g, "")) || 0;
    if (!name.trim()) return setErr(tr("بل کا نام لکھیں", "Enter a bill name"));
    if (!d || d < 1 || d > 31) return setErr(tr("آخری تاریخ 1 سے 31 کے درمیان لکھیں", "Due day must be between 1 and 31"));
    tap(true);
    setSaving(true);
    try {
      await api.addBill({ name: name.trim(), amount: n, due_day: d, kind });
      qc.invalidateQueries();
      toast(tr("بل شامل ہو گیا", "Bill added"));
      router.back();
    } catch {
      toast(tr("بل محفوظ نہیں ہو سکا", "Couldn't save the bill"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ModalHeader title={tr("نیا بل", "New bill")} />
      <KeyboardAwareScrollView bottomOffset={100} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Label>{tr("بل کی قسم", "Bill type")}</Label>
        <ChipRow>
          {BILL_KINDS.map((b) => <Chip key={b.key} testID={`bill-kind-chip-${b.key}`} label={b[lang]} icon={b.icon} selected={kind === b.key} onPress={() => pickKind(b.key)} />)}
        </ChipRow>
        <Label>{tr("نام", "Name")}</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="bill-name-input" value={name} onChangeText={(t) => { setName(t); setErr(""); }} placeholder={tr("مثلاً کے الیکٹرک", "e.g. K-Electric")} />
        </View>
        <Label>{tr("اندازاً رقم (روپے)", "Approx. amount (Rs)")}</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="bill-amount-input" value={amount} onChangeText={setAmount} placeholder={tr("مثلاً 6000", "e.g. 6000")} keyboardType="numeric" />
        </View>
        <Label>{tr("ہر مہینے کی آخری تاریخ", "Due day each month")}</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="bill-due-day-input" value={day} onChangeText={(t) => { setDay(t); setErr(""); }} placeholder={tr("مثلاً 10", "e.g. 10")} keyboardType="number-pad" maxLength={2} />
          {err ? <UText testID="bill-error" size="sm" color={colors.error}>{err}</UText> : null}
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button testID="save-bill-button" label={tr("محفوظ کریں", "Save")} icon="check" loading={saving} onPress={save} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
}));
