import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ChipRow } from "@/src/components/ChipRow";
import { colors, spacing, radius } from "@/src/theme";
import { api, Bill, money } from "@/src/api";

type Filter = "all" | "unpaid";

export default function BillsScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      setBills(await api.listBills(filter === "unpaid"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unpaidCount = bills.filter((b) => b.payment_status === "unpaid").length;
  const unpaidAmount = bills.filter((b) => b.payment_status === "unpaid").reduce((a, b) => a + b.total, 0);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Bill History"
        subtitle={filter === "unpaid" ? `${unpaidCount} unpaid · ${money(unpaidAmount)}` : `${bills.length} bills`}
      />
      <ChipRow
        options={[{ key: "all", label: "All" }, { key: "unpaid", label: "Unpaid" }] as any}
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        testIDPrefix="bills-filter"
      />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : bills.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={48} color={colors.onSurfaceTertiary} />
          <Text style={styles.empty}>{filter === "unpaid" ? "No unpaid bills. All caught up!" : "No bills yet"}</Text>
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(b) => `${b.kind}-${b.id}`}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => {
            const paid = item.payment_status === "paid";
            const payColor = paid ? colors.success : colors.warning;
            return (
              <Pressable
                onPress={() => router.push({ pathname: "/modal/bill-view", params: { billId: item.id, kind: item.kind } })}
                style={[styles.card, !paid && { borderLeftWidth: 3, borderLeftColor: colors.warning }]}
                testID={`bill-${item.id}`}
              >
                <View style={styles.headerRow}>
                  <View style={[styles.tag, { backgroundColor: item.kind === "session" ? colors.brand + "22" : colors.info + "22", borderColor: item.kind === "session" ? colors.brand : colors.info }]}>
                    <Text style={[styles.tagText, { color: item.kind === "session" ? colors.brand : colors.info }]}>{item.kind === "session" ? "SESSION" : "POS"}</Text>
                  </View>
                  <View style={[styles.payTag, { backgroundColor: payColor + "22", borderColor: payColor }]}>
                    <Text style={[styles.tagText, { color: payColor }]}>
                      {paid ? `PAID · ${(item.payment_method || "").toUpperCase()}` : "UNPAID"}
                    </Text>
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
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  empty: { color: colors.onSurfaceTertiary, textAlign: "center", paddingHorizontal: spacing.xl },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  payTag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, marginLeft: "auto", marginRight: spacing.sm },
  tagText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  total: { color: colors.brand, fontSize: 20, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: colors.onSurface, fontSize: 15, fontWeight: "700", marginTop: spacing.xs },
  metaRow: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap", marginTop: 2 },
  meta: { color: colors.onSurfaceSecondary, fontSize: 12 },
  date: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: spacing.xs },
});
