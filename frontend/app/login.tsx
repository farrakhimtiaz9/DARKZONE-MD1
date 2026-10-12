import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { radius, spacing, useTheme } from "@/src/theme";
import { Button, Icon, UText } from "@/src/components/ui";
import type { IconName } from "@/src/constants";

const HERO = "https://images.unsplash.com/photo-1721015942330-294bee912c90?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Login() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { tr, lang, setLang, row } = useI18n();
  const { signIn, busy, error } = useAuth();

  const points: { icon: IconName; text: string }[] = [
    { icon: "mic", text: tr("بول کر خرچ لکھیں — اردو یا انگریزی میں", "Speak your expenses — in Urdu or English") },
    { icon: "camera", text: tr("رسید کی تصویر سے خرچ خود بھر جائے", "Snap a receipt, the expense fills itself") },
    { icon: "users", text: tr("پورا گھر ایک ہی کھاتے میں", "The whole family on one shared ledger") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceInverse }}>
      <Image source={{ uri: HERO }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
      <LinearGradient colors={[colors.scrimClear, colors.scrim, colors.surfaceInverse]} locations={[0, 0.45, 0.85]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, flexDirection: row }}>
        <Pressable testID="login-language-toggle" onPress={() => setLang(lang === "ur" ? "en" : "ur")}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, backgroundColor: colors.scrim }}>
          <Icon name="globe" size={16} color={colors.onSurfaceInverse} />
          <UText size="sm" color={colors.onSurfaceInverse} style={{ lineHeight: lang === "ur" ? 24 : 18 }}>{lang === "ur" ? "English" : "اردو"}</UText>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <Animated.View entering={FadeInDown.duration(500)}>
          <UText fs={44} color={colors.onSurfaceInverse} bold style={{ lineHeight: lang === "ur" ? 96 : 54 }}>{tr("گھر کھاتہ", "Ghar Khata")}</UText>
          <UText size="xl" color={colors.onSurfaceInverse}>{tr("تھوڑا حساب، پورا سکون", "A little counting, a lot of calm")}</UText>
        </Animated.View>
        {points.map((p, i) => (
          <Animated.View key={p.icon} entering={FadeInDown.delay(150 + i * 120).duration(450)} style={{ flexDirection: row, alignItems: "center", gap: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
              <Icon name={p.icon} size={18} color={colors.onBrandPrimary} />
            </View>
            <UText style={{ flex: 1 }} color={colors.onSurfaceInverse}>{p.text}</UText>
          </Animated.View>
        ))}
        <Animated.View entering={FadeInDown.delay(560).duration(450)} style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Button testID="google-signin-button" label={tr("Google سے جاری رکھیں", "Continue with Google")} icon="log-in" loading={busy} onPress={signIn} />
          {error ? <UText testID="signin-error" size="sm" color={colors.warning} center>{tr("سائن ان نہیں ہو سکا، دوبارہ کوشش کریں", "Sign-in didn't complete, please try again")}</UText> : null}
          <UText size="sm" color={colors.onSurfaceInverse} center style={{ opacity: 0.8 }}>{tr("آپ کا حساب صرف آپ کے گھر والوں کے لیے ہے", "Your ledger is private to your family")}</UText>
        </Animated.View>
      </View>
    </View>
  );
}
