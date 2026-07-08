import { ScrollView, Pressable, Text, StyleSheet, View } from "react-native";
import { colors, spacing, radius } from "@/src/theme";

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix = "chip",
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onChange(opt.key)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`${testIDPrefix}-${opt.key}`}
            >
              <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    backgroundColor: colors.surface,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  label: {
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  labelActive: {
    color: colors.onBrand,
  },
});
