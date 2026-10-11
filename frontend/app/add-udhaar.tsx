import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { api } from "@/src/api";
import { tap } from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Field, Icon, Label, UText } from "@/src/components/ui";
import { ModalHeader } from "@/src/components/ModalHeader";
import { useToast } from "@/src/components/Toast";

export default function AddUdhaar() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState<"lena" | "dena">("lena");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = Number(amount.replace(/[^\d.]/g, ""));
    if (!person.trim()) return setErr("نام لکھیں");
    if (!n) return setErr("رقم لکھیں");
    tap(true);
    setSaving(true);
    try {
      await api.addUdhaar({ person: person.trim(), amount: n, kind, note: note.trim() });
      qc.invalidateQueries();
      toast("ادھار لکھ لیا گیا");
      router.back();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const Option = ({ k, title, hint, icon, color }: { k: "lena" | "dena"; title: string; hint: string; icon: string; color: string }) => (
    <Pressable testID={`udhaar-kind-${k}`} onPress={() => setKind(k)} style={[styles.option, kind === k && { borderColor: color, backgroundColor: k === "lena" ? colors.successSoft : colors.errorSoft }]}>
      <Icon name={icon} color={color} />
      <UText size="lg" color={kind === k ? color : colors.onSurface}>{title}</UText>
      <UText size="sm" color={colors.muted} style={{ textAlign: "center" }}>{hint}</UText>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <ModalHeader title="ادھار لکھیں" />
      <KeyboardAwareScrollView bottomOffset={100} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.options}>
          <Option k="lena" title="میں نے دیے" hint="یہ پیسے واپس لینے ہیں" icon="arrow-up-left" color={colors.success} />
          <Option k="dena" title="میں نے لیے" hint="یہ پیسے واپس دینے ہیں" icon="arrow-down-right" color={colors.error} />
        </View>
        <Label>کس کے ساتھ؟</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="udhaar-person-input" value={person} onChangeText={(t) => { setPerson(t); setErr(""); }} placeholder="مثلاً خالہ، دکاندار، پڑوسی" />
        </View>
        <Label>رقم (روپے)</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="udhaar-amount-input" value={amount} onChangeText={(t) => { setAmount(t); setErr(""); }} placeholder="مثلاً 2000" keyboardType="numeric" />
        </View>
        <Label>یاد کے لیے (اختیاری)</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="udhaar-note-input" value={note} onChangeText={setNote} placeholder="مثلاً عید کے لیے" />
          {err ? <UText testID="udhaar-error" size="sm" color={colors.error}>{err}</UText> : null}
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button testID="save-udhaar-button" label="محفوظ کریں" icon="check" loading={saving} onPress={save} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  options: { flexDirection: "row-reverse", gap: spacing.md, padding: spacing.lg },
  option: { flex: 1, alignItems: "center", gap: spacing.xs, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
}));
