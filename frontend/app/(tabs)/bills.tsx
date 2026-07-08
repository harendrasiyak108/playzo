import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, spacing, radius } from "@/src/theme";
import { api, Bill, money } from "@/src/api";

export default function BillsScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      setBills(await api.listBills());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.root}>
      <ScreenHeader title="Bill History" subtitle={`${bills.length} completed`} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : bills.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={48} color={colors.onSurfaceTertiary} />
          <Text style={styles.empty}>No bills yet</Text>
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(b) => `${b.kind}-${b.id}`}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/modal/bill-view", params: { billId: item.id, kind: item.kind } })}
              style={styles.card}
              testID={`bill-${item.id}`}
            >
              <View style={styles.headerRow}>
                <View style={[styles.tag, { backgroundColor: item.kind === "session" ? colors.brand + "22" : colors.info + "22", borderColor: item.kind === "session" ? colors.brand : colors.info }]}>
                  <Text style={[styles.tagText, { color: item.kind === "session" ? colors.brand : colors.info }]}>{item.kind === "session" ? "SESSION" : "POS"}</Text>
                </View>
                <Text style={styles.total}>{money(item.total)}</Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <View style={styles.metaRow}>
                {item.duration_minutes > 0 && (
                  <Text style={styles.meta}>{Math.round(item.duration_minutes)} min · {money(item.time_cost)} time</Text>
                )}
                {item.items_cost > 0 && <Text style={styles.meta}>{money(item.items_cost)} F&B</Text>}
              </View>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  empty: { color: colors.onSurfaceTertiary },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  tagText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  total: { color: colors.brand, fontSize: 20, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: colors.onSurface, fontSize: 15, fontWeight: "700", marginTop: spacing.xs },
  metaRow: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap", marginTop: 2 },
  meta: { color: colors.onSurfaceSecondary, fontSize: 12 },
  date: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: spacing.xs },
});
