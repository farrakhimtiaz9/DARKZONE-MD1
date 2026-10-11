import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { api } from "@/src/api";
import { BILL_KINDS, tap } from "@/src/constants";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { Button, Chip, ChipRow, Field, Label, UText } from "@/src/components/ui";
import { ModalHeader } from "@/src/components/ModalHeader";
import { useToast } from "@/src/components/Toast";

export default function AddBill() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState("electricity");
  const [name, setName] = useState("بجلی");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const pickKind = (k: string, label: string) => {
    const prevLabel = BILL_KINDS.find((b) => b.key === kind)?.label;
    setKind(k);
    if (!name || name === prevLabel) setName(k === "other" ? "" : label);
  };

  const save = async () => {
    const d = parseInt(day, 10);
    const n = Number(amount.replace(/[^\d.]/g, "")) || 0;
    if (!name.trim()) return setErr("بل کا نام لکھیں");
    if (!d || d < 1 || d > 31) return setErr("آخری تاریخ 1 سے 31 کے درمیان لکھیں");
    tap(true);
    setSaving(true);
    try {
      await api.addBill({ name: name.trim(), amount: n, due_day: d, kind });
      qc.invalidateQueries();
      toast("بل شامل ہو گیا");
      router.back();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ModalHeader title="نیا بل" />
      <KeyboardAwareScrollView bottomOffset={100} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Label>بل کی قسم</Label>
        <ChipRow>
          {BILL_KINDS.map((b) => <Chip key={b.key} testID={`bill-kind-chip-${b.key}`} label={b.label} icon={b.icon} selected={kind === b.key} onPress={() => pickKind(b.key, b.label)} />)}
        </ChipRow>
        <Label>نام</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="bill-name-input" value={name} onChangeText={(t) => { setName(t); setErr(""); }} placeholder="مثلاً کے الیکٹرک" />
        </View>
        <Label>اندازاً رقم (روپے)</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="bill-amount-input" value={amount} onChangeText={setAmount} placeholder="مثلاً 6000" keyboardType="numeric" />
        </View>
        <Label>ہر مہینے کی آخری تاریخ</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="bill-due-day-input" value={day} onChangeText={(t) => { setDay(t); setErr(""); }} placeholder="مثلاً 10" keyboardType="number-pad" maxLength={2} />
          {err ? <UText testID="bill-error" size="sm" color={colors.error}>{err}</UText> : null}
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button testID="save-bill-button" label="محفوظ کریں" icon="check" loading={saving} onPress={save} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
}));
