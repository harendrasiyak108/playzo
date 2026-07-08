import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Pressable, ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, spacing, radius, stationTypeIcon } from "@/src/theme";
import { api, Session, money } from "@/src/api";
import { computeLiveCost, formatDuration, useNow } from "@/src/hooks/useNow";

export default function ActiveSessionsScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const now = useNow(1000);

  const load = useCallback(async () => {
    try {
      setSessions(await api.activeSessions());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalRunning = sessions.reduce((acc, s) => {
    const { cost } = computeLiveCost(s.start_time, s.hourly_rate, now);
    const items = s.items.reduce((a, i) => a + i.price * i.quantity, 0);
    return acc + cost + items;
  }, 0);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Active"
        subtitle={`${sessions.length} live · ${money(totalRunning)} running`}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="pulse" size={48} color={colors.onSurfaceTertiary} />
          <Text style={styles.empty}>No active sessions right now</Text>
          <Pressable style={styles.emptyCta} onPress={() => router.push("/(tabs)/stations")}>
            <Text style={styles.emptyCtaText}>Go to stations</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => {
            const { ms, cost } = computeLiveCost(item.start_time, item.hourly_rate, now);
            const itemsCost = item.items.reduce((a, i) => a + i.price * i.quantity, 0);
            return (
              <Pressable
                onPress={() => router.push({ pathname: "/modal/session-detail", params: { sessionId: item.id } })}
                style={styles.card}
                testID={`active-session-${item.station_name}`}
              >
                <View style={styles.headerRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                    <Text style={{ fontSize: 26 }}>{stationTypeIcon(item.station_type)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.station}>{item.station_name}</Text>
                      <Text style={styles.customer} numberOfLines={1}>{item.customer_name} · {item.customer_phone}</Text>
                    </View>
                  </View>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>LIVE</Text>
                  </View>
                </View>

                <Text style={styles.timer} testID={`active-timer-${item.station_name}`}>{formatDuration(ms)}</Text>

                <View style={styles.metricRow}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLbl}>Rate</Text>
                    <Text style={styles.metricVal}>{money(item.hourly_rate)}/hr</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLbl}>Time</Text>
                    <Text style={styles.metricVal}>{money(cost)}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLbl}>F&B ({item.items.reduce((a, i) => a + i.quantity, 0)})</Text>
                    <Text style={styles.metricVal}>{money(itemsCost)}</Text>
                  </View>
                </View>

                <View style={styles.footerRow}>
                  <Text style={styles.totalLbl}>Running total</Text>
                  <Text style={styles.totalVal}>{money(cost + itemsCost)}</Text>
                </View>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  empty: { color: colors.onSurfaceTertiary },
  emptyCta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.md, marginTop: spacing.sm },
  emptyCtaText: { color: colors.onBrand, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  station: { color: colors.onSurface, fontSize: 17, fontWeight: "900", letterSpacing: 0.5 },
  customer: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  livePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.brandSecondary + "22", borderColor: colors.brandSecondary,
    borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandSecondary },
  livePillText: { color: colors.brandSecondary, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  timer: {
    color: colors.brand, fontSize: 38, fontWeight: "900", letterSpacing: 2.5,
    fontVariant: ["tabular-nums"], textAlign: "center", marginVertical: spacing.xs,
  },
  metricRow: { flexDirection: "row", gap: spacing.sm },
  metricBox: { flex: 1, backgroundColor: colors.surfaceTertiary, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  metricLbl: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: "700" },
  metricVal: { color: colors.onSurface, fontSize: 13, fontWeight: "800", marginTop: 2 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  totalLbl: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "700" },
  totalVal: { color: colors.brand, fontSize: 22, fontWeight: "900", letterSpacing: 1 },
});
