import { useState } from "react";
import { Linking, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/src/api";
import { radius, spacing, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import type { Parsed } from "@/src/api";
import { Button, UText } from "./ui";

type Perm = "ok" | "explain" | "blocked";

// Snap or pick a receipt; the photo is only read, never stored.
export function ReceiptButtons({ onParsed, onError }: { onParsed: (p: Parsed) => void; onError: (m: string) => void }) {
  const { colors } = useTheme();
  const { tr, row } = useI18n();
  const [busy, setBusy] = useState<"camera" | "library" | null>(null);
  const [perm, setPerm] = useState<Perm>("ok");

  const read = async (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled || !res.assets?.[0]?.base64) return;
    try {
      const p = await api.receipt(res.assets[0].base64);
      onParsed(p);
    } catch {
      onError(tr("رسید پڑھی نہیں جا سکی، صاف تصویر لے کر دوبارہ کوشش کریں", "Couldn't read the receipt — try a clearer photo"));
    }
  };
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.5, base64: true, allowsEditing: false };

  const openCamera = async () => {
    setBusy("camera");
    try { await read(await ImagePicker.launchCameraAsync(opts)); } finally { setBusy(null); }
  };
  const requestCamera = async () => {
    const r = await ImagePicker.requestCameraPermissionsAsync();
    if (r.granted) { setPerm("ok"); openCamera(); } else setPerm(r.canAskAgain ? "explain" : "blocked");
  };
  const onCamera = async () => {
    const cur = await ImagePicker.getCameraPermissionsAsync();
    if (cur.granted) { setPerm("ok"); return openCamera(); }
    setPerm(cur.status === "undetermined" || cur.canAskAgain ? "explain" : "blocked");
  };
  const onLibrary = async () => {
    setBusy("library");
    try { await read(await ImagePicker.launchImageLibraryAsync(opts)); } finally { setBusy(null); }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: row, gap: spacing.sm }}>
        <Button testID="receipt-camera-button" label={tr("رسید کی تصویر", "Snap receipt")} icon="camera" variant="secondary" loading={busy === "camera"} disabled={!!busy} onPress={onCamera} style={{ flex: 1 }} />
        <Button testID="receipt-library-button" label={tr("گیلری سے", "From gallery")} icon="image" variant="ghost" loading={busy === "library"} disabled={!!busy} onPress={onLibrary} style={{ flex: 1 }} />
      </View>
      {busy ? <UText testID="receipt-reading-text" size="sm" color={colors.muted} center>{tr("مددگار رسید پڑھ رہا ہے…", "Your helper is reading the receipt…")}</UText> : null}
      {perm === "explain" ? (
        <View testID="camera-permission-explain" style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }}>
          <UText size="sm">{tr("رسید کی تصویر لینے کے لیے کیمرے کی اجازت چاہیے۔ تصویر محفوظ نہیں کی جاتی۔", "Camera access lets you snap receipts. Photos are not stored.")}</UText>
          <Button testID="camera-permission-allow-button" label={tr("اجازت دیں", "Allow camera")} icon="camera" onPress={requestCamera} />
        </View>
      ) : null}
      {perm === "blocked" ? (
        <View testID="camera-permission-blocked" style={{ backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }}>
          <UText size="sm">{tr("کیمرے کی اجازت بند ہے۔ ترتیبات میں اجازت دیں، یا گیلری سے تصویر چنیں۔", "Camera access is off. Enable it in Settings, or pick from the gallery.")}</UText>
          <Button testID="camera-open-settings-button" label={tr("ترتیبات کھولیں", "Open Settings")} variant="secondary" icon="settings" onPress={() => Linking.openSettings()} />
        </View>
      ) : null}
    </View>
  );
}
