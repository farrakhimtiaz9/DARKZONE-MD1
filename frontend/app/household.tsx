import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api, ApiError } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { tap } from "@/src/constants";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";
import { Button, Field, Icon, UText } from "@/src/components/ui";

export default function HouseholdSetup() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr, row } = useI18n();
  const { user, refresh, signOut } = useAuth();
  const first = (user?.name || "").split(" ")[0];
  const [name, setName] = useState(first ? tr(`${first} کا گھر`, `${first}'s home`) : "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [err, setErr] = useState("");

  const create = async () => {
    if (!name.trim()) return setErr(tr("گھر کا نام لکھیں", "Enter a household name"));
    tap(true);
    setBusy("create");
    try { await api.createHousehold(name.trim()); await refresh(); }
    catch { setErr(tr("گھر نہیں بن سکا، دوبارہ کوشش کریں", "Couldn't create household, try again")); }
    finally { setBusy(null); }
  };
  const join = async () => {
    if (code.trim().length < 6) return setErr(tr("6 حرفی کوڈ لکھیں", "Enter the 6-letter code"));
    tap(true);
    setBusy("join");
    try { await api.joinHousehold(code.trim()); await refresh(); }
    catch (e) { setErr(e instanceof ApiError && e.status === 404 ? tr("یہ کوڈ نہیں ملا، دوبارہ دیکھیں", "Code not found, please check it") : tr("شامل نہیں ہو سکے", "Couldn't join")); }
    finally { setBusy(null); }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <Animated.View entering={FadeInDown}>
          <UText size="2xl" bold>{tr(`خوش آمدید${first ? `، ${first}` : ""}`, `Welcome${first ? `, ${first}` : ""}`)}</UText>
          <UText color={colors.muted}>{tr("اپنا گھر بنائیں یا گھر والوں کے کوڈ سے شامل ہوں", "Create your household or join your family's with a code")}</UText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100)} style={styles.card}>
          <View style={{ flexDirection: row, alignItems: "center", gap: spacing.sm }}>
            <Icon name="home" color={colors.brandPrimary} />
            <UText size="lg" bold>{tr("نیا گھر بنائیں", "Create a household")}</UText>
          </View>
          <Field testID="household-name-input" value={name} onChangeText={(t) => { setName(t); setErr(""); }} placeholder={tr("مثلاً احمد صاحب کا گھر", "e.g. The Ahmed family")} />
          <Button testID="create-household-button" label={tr("گھر بنائیں", "Create")} icon="plus" loading={busy === "create"} onPress={create} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
          <View style={{ flexDirection: row, alignItems: "center", gap: spacing.sm }}>
            <Icon name="users" color={colors.brandSecondary} />
            <UText size="lg" bold>{tr("کوڈ سے شامل ہوں", "Join with a code")}</UText>
          </View>
          <UText size="sm" color={colors.muted}>{tr("گھر کے کسی فرد سے ترتیبات میں لکھا کوڈ لیں", "Ask a family member for the code in their Settings")}</UText>
          <Field testID="invite-code-input" value={code} onChangeText={(t) => { setCode(t.toUpperCase()); setErr(""); }} placeholder="ABCDEF" autoCapitalize="characters" maxLength={6}
            style={{ textAlign: "center", letterSpacing: 6, fontSize: 22, fontFamily: "Nunito" }} />
          <Button testID="join-household-button" label={tr("شامل ہوں", "Join")} variant="secondary" icon="log-in" loading={busy === "join"} onPress={join} />
        </Animated.View>

        {err ? <UText testID="household-error" color={colors.error} center>{err}</UText> : null}
        <Pressable testID="household-signout-button" onPress={signOut} style={{ alignSelf: "center", minHeight: 44, justifyContent: "center" }}>
          <UText color={colors.muted}>{tr("دوسرے اکاؤنٹ سے سائن ان کریں", "Sign in with another account")}</UText>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  card: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
}));
