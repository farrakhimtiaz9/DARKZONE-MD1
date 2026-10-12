import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useTheme } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { Icon, UText } from "./ui";

export function ModalHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { row } = useI18n();
  return (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: row, alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
      <UText size="xl" bold>{title}</UText>
      <Pressable testID="modal-close-button" onPress={() => router.back()} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Icon name="x" size={24} />
      </Pressable>
    </View>
  );
}
