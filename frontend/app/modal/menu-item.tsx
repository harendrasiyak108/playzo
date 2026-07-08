import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

const EMOJI_CHOICES = ["🍔", "🍕", "🍟", "🌭", "🥪", "🍿", "🍫", "🍩", "🍦", "🍪", "🍰", "🥤", "☕", "🧋", "🥛", "⚡", "🍺", "🍷", "🍹", "🥗"];
const CATEGORY_CHOICES = ["Snacks", "Meals", "Drinks", "Desserts", "Other"];

export default function MenuItemFormScreen() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isEdit = !!itemId;

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>("Snacks");
  const [emoji, setEmoji] = useState("🍔");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!itemId) return;
    (async () => {
      const items = await api.listMenu();
      const found = items.find((i) => i.id === itemId);
      if (found) {
        setName(found.name);
        setPrice(String(found.price));
        setCategory(found.category);
        setEmoji(found.emoji);
      }
    })();
  }, [itemId]);

  const save = async () => {
    setErr("");
    if (!name.trim()) return setErr("Name required");
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return setErr("Price must be > 0");
    try {
      if (isEdit && itemId) {
        await api.updateMenu(itemId, { name: name.trim(), price: p, category, emoji });
      } else {
        await api.createMenu({ name: name.trim(), price: p, category, emoji });
      }
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} testID="close-btn" style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>{isEdit ? "Edit Item" : "New Item"}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <View style={styles.preview}>
            <Text style={{ fontSize: 44 }}>{emoji}</Text>
            <Text style={styles.previewName}>{name || "New Item"}</Text>
            <Text style={styles.previewPrice}>{price ? `₹${price}` : "₹0"}</Text>
          </View>

          <Text style={styles.label}>Icon</Text>
          <View style={styles.emojiRow}>
            {EMOJI_CHOICES.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={[styles.emojiCell, emoji === e && styles.emojiCellActive]}
                testID={`emoji-${e}`}
              >
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Masala Chips"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.input}
            testID="menu-name-input"
          />

          <Text style={styles.label}>Price (₹)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. 40"
            placeholderTextColor={colors.onSurfaceTertiary}
            keyboardType="numeric"
            style={styles.input}
            testID="menu-price-input"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.catRow}>
            {CATEGORY_CHOICES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.catChip, category === c && styles.catChipActive]}
                testID={`cat-${c}`}
              >
                <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          {err ? <Text style={styles.err} testID="menu-form-error">{err}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable onPress={save} style={styles.cta} testID="save-menu-btn">
            <Text style={styles.ctaText}>{isEdit ? "Save Changes" : "Create Item"}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: 1,
  },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  iconBtn: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  preview: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, alignItems: "center", gap: 6,
  },
  previewName: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  previewPrice: { color: colors.brand, fontSize: 24, fontWeight: "900", letterSpacing: 1 },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700", marginTop: spacing.sm },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiCell: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  emojiCellActive: { borderColor: colors.brand, backgroundColor: colors.brand + "22" },
  input: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  catChipText: { color: colors.onSurfaceSecondary, fontWeight: "700", fontSize: 12, letterSpacing: 0.5 },
  catChipTextActive: { color: colors.onBrand },
  err: { color: colors.error, fontWeight: "700" },
  footer: { padding: spacing.lg, borderTopColor: colors.divider, borderTopWidth: 1, backgroundColor: colors.surface },
  cta: { backgroundColor: colors.brand, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  ctaText: { color: colors.onBrand, fontWeight: "900", fontSize: 15, letterSpacing: 0.8, textTransform: "uppercase" },
});
