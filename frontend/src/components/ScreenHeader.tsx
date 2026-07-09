import { View, Text, StyleSheet } from "react-native";
import { UserBadge } from "@/src/components/UserBadge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} testID="screen-title">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
      <UserBadge />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
  },
  title: {
    color: colors.onSurface,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  subtitle: {
    color: colors.onSurfaceTertiary,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontWeight: "700",
  },
});
