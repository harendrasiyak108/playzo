import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, radius } from "@/src/theme";
import { api, MenuItem, money } from "@/src/api";

export default function MenuManageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.listMenu());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    setDeleting(id);
    try {
      await api.deleteMenu(id);
      await load();
    } finally {
      setDeleting(null);
    }
  };

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, m) => {
    (acc[m.category] ||= []).push(m);
    return acc;
  }, {});

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} testID="close-btn" style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage Menu</Text>
        <Pressable
          onPress={() => router.push("/modal/menu-item")}
          style={[styles.iconBtn, { backgroundColor: colors.brand, borderColor: colors.brand }]}
          testID="add-menu-item-btn"
        >
          <Ionicons name="add" size={22} color={colors.onBrand} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={Object.entries(grouped)}
          keyExtractor={([cat]) => cat}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item: [cat, arr] }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{cat}</Text>
              {arr.map((m) => (
                <View key={m.id} style={styles.row}>
                  <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.name}</Text>
                    <Text style={styles.price}>{money(m.price)}</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: "/modal/menu-item", params: { itemId: m.id } })}
                    style={styles.actionBtn}
                    testID={`edit-menu-${m.name}`}
                  >
                    <Ionicons name="pencil" size={16} color={colors.onSurface} />
                  </Pressable>
                  <Pressable
                    onPress={() => remove(m.id)}
                    style={[styles.actionBtn, { borderColor: colors.error }]}
                    testID={`delete-menu-${m.name}`}
                    disabled={deleting === m.id}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No items — tap + to add</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  empty: { color: colors.onSurfaceTertiary },
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: 1,
  },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  iconBtn: {
    height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  section: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  sectionTitle: { color: colors.brand, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceTertiary, padding: spacing.md, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  name: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  price: { color: colors.brand, fontWeight: "800", marginTop: 2 },
  actionBtn: {
    height: 36, width: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
});
