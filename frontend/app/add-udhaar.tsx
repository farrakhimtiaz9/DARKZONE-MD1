import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { api } from "@/src/api";
import { tap } from "@/src/constants";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { Button, Field, Icon, Label, UText } from "@/src/components/ui";
import { ModalHeader } from "@/src/components/ModalHeader";
import { useToast } from "@/src/components/Toast";

export default function AddUdhaar() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useI18n();
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
    if (!person.trim()) return setErr(tr("نام لکھیں", "Enter a name"));
    if (!n) return setErr(tr("رقم لکھیں", "Enter an amount"));
    tap(true);
    setSaving(true);
    try {
      await api.addUdhaar({ person: person.trim(), amount: n, kind, note: note.trim() });
      qc.invalidateQueries();
      toast(tr("ادھار لکھ لیا گیا", "Udhaar noted"));
      router.back();
    } catch {
      toast(tr("محفوظ نہیں ہو سکا", "Couldn't save"), "error");
    } finally {
      setSaving(false);
    }
  };

  const options = [
    { k: "lena" as const, title: tr("میں نے دیے", "I lent"), hint: tr("یہ پیسے واپس لینے ہیں", "I'll get this back"), icon: "arrow-up-left", color: colors.success, soft: colors.successSoft },
    { k: "dena" as const, title: tr("میں نے لیے", "I borrowed"), hint: tr("یہ پیسے واپس دینے ہیں", "I need to return this"), icon: "arrow-down-right", color: colors.error, soft: colors.errorSoft },
  ];

  return (
    <View style={styles.root}>
      <ModalHeader title={tr("ادھار لکھیں", "Add udhaar")} />
      <KeyboardAwareScrollView bottomOffset={100} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.options}>
          {options.map((o) => (
            <Pressable key={o.k} testID={`udhaar-kind-${o.k}`} onPress={() => setKind(o.k)} style={[styles.option, kind === o.k && { borderColor: o.color, backgroundColor: o.soft }]}>
              <Icon name={o.icon} color={o.color} />
              <UText size="lg" bold center color={kind === o.k ? o.color : colors.onSurface}>{o.title}</UText>
              <UText size="sm" color={colors.muted} center>{o.hint}</UText>
            </Pressable>
          ))}
        </View>
        <Label>{tr("کس کے ساتھ؟", "With whom?")}</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="udhaar-person-input" value={person} onChangeText={(t) => { setPerson(t); setErr(""); }} placeholder={tr("مثلاً خالہ، دکاندار، پڑوسی", "e.g. Aunt, shopkeeper, neighbour")} />
        </View>
        <Label>{tr("رقم (روپے)", "Amount (Rs)")}</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="udhaar-amount-input" value={amount} onChangeText={(t) => { setAmount(t); setErr(""); }} placeholder={tr("مثلاً 2000", "e.g. 2000")} keyboardType="numeric" />
        </View>
        <Label>{tr("یاد کے لیے (اختیاری)", "Note (optional)")}</Label>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field testID="udhaar-note-input" value={note} onChangeText={setNote} placeholder={tr("مثلاً عید کے لیے", "e.g. for Eid")} />
          {err ? <UText testID="udhaar-error" size="sm" color={colors.error}>{err}</UText> : null}
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button testID="save-udhaar-button" label={tr("محفوظ کریں", "Save")} icon="check" loading={saving} onPress={save} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((c, d) => ({
  root: { flex: 1, backgroundColor: c.surface },
  options: { flexDirection: d.row, gap: spacing.md, padding: spacing.lg },
  option: { flex: 1, alignItems: "center", gap: spacing.xs, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
}));
