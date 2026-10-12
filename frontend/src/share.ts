import { Platform, Share } from "react-native";
import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

// Shares a rendered card as an image on native; falls back to text sharing.
export async function shareCard(ref: RefObject<View | null>, message: string): Promise<boolean> {
  if (Platform.OS !== "web" && ref.current) {
    try {
      const uri = await captureRef(ref, { format: "png", quality: 0.95 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Ghar Khata" });
        return true;
      }
    } catch { /* fall through to text */ }
  }
  return shareText(message);
}

export async function shareText(message: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) { await nav.share({ text: message }); return true; }
      if (nav?.clipboard) { await nav.clipboard.writeText(message); return true; }
      return false;
    }
    await Share.share({ message });
    return true;
  } catch {
    return false;
  }
}
