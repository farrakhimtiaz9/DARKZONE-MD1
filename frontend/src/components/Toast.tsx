import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, useTheme } from "@/src/theme";
import { UText } from "./ui";

type Kind = "success" | "error";
const ToastCtx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: Kind; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const show = useCallback((msg: string, kind: Kind = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, kind, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      <View style={{ flex: 1 }}>
        {children}
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={FadeInUp}
            exiting={FadeOutUp}
            testID="toast-message"
            style={{ pointerEvents: "none", position: "absolute", top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
              backgroundColor: toast.kind === "error" ? colors.error : colors.surfaceInverse }}
          >
            <UText color={toast.kind === "error" ? colors.onError : colors.onSurfaceInverse}>{toast.msg}</UText>
          </Animated.View>
        ) : null}
      </View>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
