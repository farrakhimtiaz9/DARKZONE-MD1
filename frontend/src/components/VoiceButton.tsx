import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from "react-native-reanimated";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { radius, spacing, useTheme } from "@/src/theme";
import { api } from "@/src/api";
import { tap } from "@/src/constants";
import { useI18n } from "@/src/i18n";
import { Button, Icon, UText } from "./ui";

type Phase = "idle" | "listening" | "thinking";
type Perm = "ok" | "explain" | "blocked";

export function VoiceButton({ onText, onError }: { onText: (t: string) => void; onError: (m: string) => void }) {
  const { colors } = useTheme();
  const { tr } = useI18n();
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
      onError(tr("ریکارڈنگ شروع نہیں ہو سکی", "Couldn't start recording"));
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
      if (!uri || Date.now() - startedAt.current < 600) { onError(tr("آواز بہت مختصر تھی، دوبارہ بولیں", "That was too short, please speak again")); return; }
      const text = await api.transcribe(uri);
      if (!text) { onError(tr("آواز سنائی نہیں دی، ذرا اونچا بولیں", "Couldn't hear you, please speak a little louder")); return; }
      onText(text);
    } catch {
      onError(tr("آواز سمجھ نہیں آئی", "Couldn't understand the audio"));
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

  const label = phase === "listening" ? tr("سن رہے ہیں… بولنے کے بعد دبائیں", "Listening… tap when done")
    : phase === "thinking" ? tr("سمجھ رہے ہیں…", "Understanding…")
    : tr("بولیے… جیسے «دودھ پانچ سو روپے»", "Speak… like “milk 500 rupees”");

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
          <UText>{tr("بول کر خرچ لکھنے کے لیے مائیک کی اجازت چاہیے۔ آپ کی آواز صرف خرچ سمجھنے کے لیے استعمال ہوگی۔", "Microphone access lets you speak expenses. Your voice is only used to understand the expense.")}</UText>
          <Button testID="mic-permission-allow-button" label={tr("اجازت دیں", "Allow microphone")} icon="mic" onPress={requestAndStart} />
        </View>
      ) : null}
      {perm === "blocked" ? (
        <View testID="mic-permission-blocked" style={{ backgroundColor: colors.warningSoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, alignSelf: "stretch", marginHorizontal: spacing.lg }}>
          <UText>{tr("مائیک کی اجازت بند ہے۔ ترتیبات میں جا کر اجازت دے دیں، یا نیچے ہاتھ سے لکھ لیں۔", "Microphone access is off. Enable it in Settings, or type below.")}</UText>
          <Button testID="mic-open-settings-button" label={tr("ترتیبات کھولیں", "Open Settings")} variant="secondary" icon="settings" onPress={() => Linking.openSettings()} />
        </View>
      ) : null}
    </View>
  );
}
