import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from "react-native-reanimated";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { radius, spacing, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import { tap } from "@/src/constants";
import { Button, Icon, UText } from "./ui";

type Phase = "idle" | "listening" | "thinking";
type Perm = "ok" | "explain" | "blocked";

export function VoiceButton({ onText, onError }: { onText: (t: string) => void; onError: (m: string) => void }) {
  const { colors } = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>("idle");
  const [perm, setPerm] = useState<Perm>("ok");
  const preparing = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (phase === "listening") pulse.value = withRepeat(withTiming(1.12, { duration: 700 }), -1, true);
    else { cancelAnimation(pulse); pulse.value = withTiming(1); }
  }, [phase, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useFocusEffect(useCallback(() => () => {
    if (watchdog.current) clearTimeout(watchdog.current);
    try { if (recorder.isRecording) recorder.stop().catch(() => {}); } catch { /* released */ }
  }, [recorder]));

  const begin = async () => {
    if (preparing.current) return;
    preparing.current = true;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setPhase("listening");
      watchdog.current = setTimeout(() => { finish(); }, 45000);
    } catch {
      onError("ریکارڈنگ شروع نہیں ہو سکی");
      setPhase("idle");
    } finally {
      preparing.current = false;
    }
  };

  const finish = async () => {
    if (watchdog.current) clearTimeout(watchdog.current);
    setPhase("thinking");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || Date.now() - startedAt.current < 600) { onError("آواز بہت مختصر تھی، دوبارہ بولیں"); return; }
      const text = await api.transcribe(uri);
      if (!text) { onError("آواز سنائی نہیں دی، ذرا اونچا بولیں"); return; }
      onText(text);
    } catch (e) {
      onError((e as Error).message || "آواز سمجھ نہیں آئی");
    } finally {
      setPhase("idle");
    }
  };

  const requestAndStart = async () => {
    const res = await AudioModule.requestRecordingPermissionsAsync();
    if (res.granted) { setPerm("ok"); begin(); }
    else setPerm(res.canAskAgain ? "explain" : "blocked");
  };

  const onPress = async () => {
    tap(true);
    if (phase === "listening") return finish();
    if (phase === "thinking") return;
    const cur = await AudioModule.getRecordingPermissionsAsync();
    if (cur.granted) { setPerm("ok"); return begin(); }
    if (cur.status === "undetermined" || cur.canAskAgain) return setPerm("explain");
    setPerm("blocked");
  };

  const label = phase === "listening" ? "سن رہے ہیں… بولنے کے بعد دبائیں" : phase === "thinking" ? "سمجھ رہے ہیں…" : "بولیے… جیسے «دودھ پانچ سو روپے»";

  return (
    <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg }}>
      <Animated.View style={[{ borderRadius: 60, padding: 8, backgroundColor: phase === "listening" ? colors.brandTertiary : "transparent" }, ring]}>
        <Pressable
          testID="voice-record-button"
          onPress={onPress}
          style={({ pressed }) => ({ width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center",
            backgroundColor: phase === "listening" ? colors.error : colors.brandPrimary, transform: [{ scale: pressed ? 0.94 : 1 }] })}
        >
          {phase === "thinking" ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Icon name={phase === "listening" ? "square" : "mic"} size={38} color={colors.onBrandPrimary} />}
        </Pressable>
      </Animated.View>
      <UText testID="voice-status-text" color={colors.muted} style={{ textAlign: "center" }}>{label}</UText>

      {perm === "explain" ? (
        <View testID="mic-permission-explain" style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, alignSelf: "stretch", marginHorizontal: spacing.lg }}>
          <UText>بول کر خرچ لکھنے کے لیے مائیک کی اجازت چاہیے۔ آپ کی آواز صرف خرچ سمجھنے کے لیے استعمال ہوگی۔</UText>
          <Button testID="mic-permission-allow-button" label="اجازت دیں" icon="mic" onPress={requestAndStart} />
        </View>
      ) : null}
      {perm === "blocked" ? (
        <View testID="mic-permission-blocked" style={{ backgroundColor: colors.warningSoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, alignSelf: "stretch", marginHorizontal: spacing.lg }}>
          <UText>مائیک کی اجازت بند ہے۔ ترتیبات میں جا کر اجازت دے دیں، یا نیچے ہاتھ سے لکھ لیں۔</UText>
          <Button testID="mic-open-settings-button" label="ترتیبات کھولیں" variant="secondary" icon="settings" onPress={() => Linking.openSettings()} />
        </View>
      ) : null}
    </View>
  );
}
