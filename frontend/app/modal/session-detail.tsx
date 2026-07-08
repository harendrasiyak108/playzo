import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, radius, stationTypeIcon } from "@/src/theme";
import { api, MenuItem, Session, SessionItem, money } from "@/src/api";
import { computeLiveCost, formatDuration, useNow } from "@/src/hooks/useNow";

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow(1000);
  const [session, setSession] = useState<Session | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [ending, setEnding] = useState(false);
  const [cart, setCart] = useState<Record<string, SessionItem>>({});

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([api.getSession(sessionId), api.listMenu()]);
    setSession(s as Session);
    setMenu(m);
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  if (!session) {
    return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  }

  const { ms, cost } = computeLiveCost(session.start_time, session.hourly_rate, now);
  const itemsCost = (session.items ?? []).reduce((s, i) => s + i.price * i.quantity, 0);
  const total = cost + itemsCost;

  const bump = (m: MenuItem, delta: number) => {
    setCart((prev) => {
      const cur = prev[m.id];
      const q = (cur?.quantity ?? 0) + delta;
      const next = { ...prev };
      if (q <= 0) delete next[m.id];
      else next[m.id] = { menu_item_id: m.id, name: m.name, price: m.price, quantity: q, emoji: m.emoji };
      return next;
    });
  };

  const confirmAdd = async () => {
    const items = Object.values(cart);
    if (items.length === 0) { setShowMenu(false); return; }
    const updated = await api.addItems(sessionId, items);
    setSession(updated);
    setCart({});
    setShowMenu(false);
  };

  const removeItem = async (id: string) => {
    const updated = await api.removeItem(sessionId, id);
    setSession(updated);
  };

  const end = async () => {
    setEnding(true);
    try {
      const done = await api.endSession(sessionId);
      router.replace({ pathname: "/modal/bill-view", params: { billId: done.id, kind: "session" } });
    } finally {
      setEnding(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} testID="close-btn" style={styles.iconBtn}>
          <Ionicons name="chevron-down" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Live Session</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200, gap: spacing.md }}>
        <View style={styles.hero}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={{ fontSize: 26 }}>{stationTypeIcon(session.station_type)}</Text>
              <View>
                <Text style={styles.station}>{session.station_name}</Text>
                <Text style={styles.customer}>{session.customer_name} · {session.customer_phone}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.timer} testID="live-timer">{formatDuration(ms)}</Text>
          <View style={styles.metricRow}>
            <View style={styles.metricBox}><Text style={styles.metricLbl}>Rate</Text><Text style={styles.metricVal}>{money(session.hourly_rate)}/hr</Text></View>
            <View style={styles.metricBox}><Text style={styles.metricLbl}>Time cost</Text><Text style={styles.metricVal}>{money(cost)}</Text></View>
            <View style={styles.metricBox}><Text style={styles.metricLbl}>F&B</Text><Text style={styles.metricVal}>{money(itemsCost)}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Add-ons</Text>
            <Pressable onPress={() => setShowMenu((s) => !s)} style={styles.addBtn} testID="toggle-menu-btn">
              <Ionicons name={showMenu ? "close" : "add"} size={18} color={colors.onBrand} />
              <Text style={styles.addBtnText}>{showMenu ? "Close" : "Add"}</Text>
            </Pressable>
          </View>

          {(session.items ?? []).length === 0 && !showMenu ? (
            <Text style={styles.empty}>No add-ons yet</Text>
          ) : null}

          {(session.items ?? []).map((it) => (
            <View key={it.menu_item_id} style={styles.lineItem}>
              <Text style={{ fontSize: 20 }}>{it.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemMeta}>{money(it.price)} × {it.quantity}</Text>
              </View>
              <Text style={styles.itemTotal}>{money(it.price * it.quantity)}</Text>
              <Pressable onPress={() => removeItem(it.menu_item_id)} testID={`remove-${it.name}`} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </Pressable>
            </View>
          ))}

          {showMenu && (
            <View style={{ marginTop: spacing.md }}>
              <FlatList
                data={menu}
                keyExtractor={(m) => m.id}
                scrollEnabled={false}
                numColumns={2}
                columnWrapperStyle={{ gap: spacing.sm }}
                contentContainerStyle={{ gap: spacing.sm }}
                renderItem={({ item }) => {
                  const q = cart[item.id]?.quantity || 0;
                  return (
                    <View style={[styles.menuTile, q > 0 && { borderColor: colors.brand }]}>
                      <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
                      <Text style={styles.menuName}>{item.name}</Text>
                      <Text style={styles.menuPrice}>{money(item.price)}</Text>
                      <View style={styles.qtyRow}>
                        <Pressable onPress={() => bump(item, -1)} style={styles.qtyBtn} testID={`sess-sub-${item.name}`}>
                          <Ionicons name="remove" size={14} color={colors.onBrand} />
                        </Pressable>
                        <Text style={styles.qtyText}>{q}</Text>
                        <Pressable onPress={() => bump(item, 1)} style={styles.qtyBtn} testID={`sess-add-${item.name}`}>
                          <Ionicons name="add" size={14} color={colors.onBrand} />
                        </Pressable>
                      </View>
                    </View>
                  );
                }}
              />
              <Pressable onPress={confirmAdd} style={styles.confirmAdd} testID="confirm-add-items">
                <Text style={styles.confirmAddText}>Add to bill</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.totalRow}>
          <Text style={styles.footerLbl}>Running Total</Text>
          <Text style={styles.footerVal} testID="running-total">{money(total)}</Text>
        </View>
        <Pressable onPress={end} disabled={ending} style={styles.endBtn} testID="end-session-btn">
          <Text style={styles.endText}>{ending ? "Ending…" : "End & Generate Bill"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: 1 },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  iconBtn: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  hero: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  station: { color: colors.onSurface, fontSize: 20, fontWeight: "900", letterSpacing: 0.8 },
  customer: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  timer: { color: colors.brand, fontSize: 52, fontWeight: "900", letterSpacing: 3, fontVariant: ["tabular-nums"], textAlign: "center", marginVertical: spacing.md },
  metricRow: { flexDirection: "row", gap: spacing.sm },
  metricBox: { flex: 1, backgroundColor: colors.surfaceTertiary, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  metricLbl: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: "700" },
  metricVal: { color: colors.onSurface, fontSize: 13, fontWeight: "800", marginTop: 2 },
  section: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  sectionTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  addBtnText: { color: colors.onBrand, fontWeight: "900", fontSize: 12 },
  empty: { color: colors.onSurfaceTertiary, fontSize: 12 },
  lineItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  itemName: { color: colors.onSurface, fontWeight: "700" },
  itemMeta: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  itemTotal: { color: colors.brand, fontWeight: "800" },
  removeBtn: { padding: 6 },
  menuTile: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 2 },
  menuName: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  menuPrice: { color: colors.brand, fontWeight: "800", fontSize: 13 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  qtyBtn: { backgroundColor: colors.brand, height: 22, width: 22, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  qtyText: { color: colors.onSurface, fontWeight: "800", minWidth: 14, textAlign: "center" },
  confirmAdd: { backgroundColor: colors.brand, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 12, marginTop: spacing.md },
  confirmAddText: { color: colors.onBrand, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.lg, gap: spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLbl: { color: colors.onSurfaceTertiary, letterSpacing: 0.8, textTransform: "uppercase", fontSize: 11, fontWeight: "700" },
  footerVal: { color: colors.brand, fontSize: 26, fontWeight: "900", letterSpacing: 1 },
  endBtn: { backgroundColor: colors.error, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  endText: { color: colors.onSurface, fontWeight: "900", fontSize: 15, letterSpacing: 0.8, textTransform: "uppercase" },
});
