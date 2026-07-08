import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ChipRow } from "@/src/components/ChipRow";
import { colors, spacing, radius } from "@/src/theme";
import { api, Analytics, money } from "@/src/api";

type Range = "daily" | "monthly";

export default function ManagerScreen() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [range, setRange] = useState<Range>("daily");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    if (!unlocked) return;
    setLoading(true);
    try {
      setData(await api.analytics(range));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [unlocked, range]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitPin = async () => {
    setPinError("");
    try {
      const res = await api.verifyPin(pin);
      if (res.ok) {
        setUnlocked(true);
        setPin("");
      } else {
        setPinError("Wrong PIN");
        setPin("");
      }
    } catch {
      setPinError("Wrong PIN");
      setPin("");
    }
  };

  const onKey = (k: string) => {
    setPinError("");
    if (k === "del") return setPin((p) => p.slice(0, -1));
    if (k === "ok") return submitPin();
    if (pin.length < 8) setPin((p) => p + k);
  };

  if (!unlocked) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Manager" subtitle="Enter PIN to unlock" />
        <View style={styles.pinArea}>
          <Ionicons name="lock-closed" size={44} color={colors.brand} />
          <View style={styles.pinDots}>
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotActive]} />
            ))}
          </View>
          {pinError ? <Text style={styles.pinError} testID="pin-error">{pinError}</Text> : <Text style={styles.pinHint}>Default: 1234</Text>}
          <View style={styles.pinPad}>
            {["1","2","3","4","5","6","7","8","9","del","0","ok"].map((k) => (
              <Pressable
                key={k}
                onPress={() => onKey(k)}
                style={[styles.padKey, k === "ok" && styles.padOk]}
                testID={`pin-key-${k}`}
              >
                {k === "del" ? (
                  <Ionicons name="backspace-outline" size={22} color={colors.onSurface} />
                ) : k === "ok" ? (
                  <Ionicons name="arrow-forward" size={22} color={colors.onBrand} />
                ) : (
                  <Text style={styles.padDigit}>{k}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const maxVal = Math.max(1, ...(data?.time_series ?? [1]).map((v, i) => v + (data?.fnb_series[i] ?? 0)));

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Dashboard"
        subtitle={range === "daily" ? "Today's performance" : "This month"}
        right={
          <Pressable
            testID="change-pin-btn"
            onPress={() => router.push("/modal/change-pin")}
            style={styles.headerBtn}
          >
            <Ionicons name="key-outline" size={20} color={colors.onSurface} />
          </Pressable>
        }
      />
      <ChipRow
        options={[{ key: "daily", label: "Daily" }, { key: "monthly", label: "Monthly" }] as any}
        value={range}
        onChange={(v) => setRange(v as Range)}
        testIDPrefix="range"
      />

      {loading || !data ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total Revenue</Text>
            <Text style={styles.heroValue} testID="total-revenue">{money(data.total_revenue)}</Text>
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
              <MetricPill label="Time" value={money(data.time_revenue)} color={colors.brand} />
              <MetricPill label="F&B" value={money(data.fnb_revenue)} color={colors.info} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <StatCard label="Sessions" value={String(data.session_count)} icon="game-controller-outline" />
            <StatCard label="POS Orders" value={String(data.pos_count)} icon="fast-food-outline" />
            <StatCard label="Play Time" value={`${Math.round(data.total_minutes / 60)}h`} icon="time-outline" />
          </View>

          <Pressable
            onPress={() => router.push("/modal/close-out")}
            style={styles.shiftCard}
            testID="open-close-out"
          >
            <View style={styles.shiftIcon}>
              <Ionicons name="print" size={22} color={colors.onBrand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shiftTitle}>Shift Close-Out</Text>
              <Text style={styles.shiftSub}>Cash vs UPI totals · outstanding list · PDF / WhatsApp handover</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
          </Pressable>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Revenue Breakdown</Text>
            <View style={styles.legendRow}>
              <LegendDot color={colors.brand} label="Time" />
              <LegendDot color={colors.info} label="F&B" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: spacing.md, paddingBottom: spacing.xs }}>
              {data.labels.map((lbl, i) => {
                const t = data.time_series[i];
                const f = data.fnb_series[i];
                const tH = (t / maxVal) * 140;
                const fH = (f / maxVal) * 140;
                return (
                  <View key={lbl} style={styles.barCol}>
                    <View style={styles.barStack}>
                      {fH > 0 && <View style={{ height: fH, width: 16, backgroundColor: colors.info, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />}
                      {tH > 0 && <View style={{ height: tH, width: 16, backgroundColor: colors.brand, borderTopLeftRadius: fH > 0 ? 0 : 3, borderTopRightRadius: fH > 0 ? 0 : 3 }} />}
                      {tH === 0 && fH === 0 && <View style={{ height: 3, width: 16, backgroundColor: colors.border }} />}
                    </View>
                    <Text style={styles.barLbl}>{lbl}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <Text style={styles.chartAxis}>{range === "daily" ? "Hour (UTC)" : "Day of month"}</Text>
          </View>

          <Pressable
            onPress={() => { setUnlocked(false); }}
            style={styles.lockBtn}
            testID="manager-lock"
          >
            <Ionicons name="lock-closed" size={16} color={colors.onSurface} />
            <Text style={styles.lockText}>Lock dashboard</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.metricPill, { borderColor: color }]}>
      <View style={[styles.metricDot, { backgroundColor: color }]} />
      <View>
        <Text style={styles.metricLbl}>{label}</Text>
        <Text style={styles.metricVal}>{value}</Text>
      </View>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={colors.brand} />
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginRight: 12 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: colors.onSurfaceSecondary, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerBtn: {
    backgroundColor: colors.surfaceTertiary,
    height: 40,
    width: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinArea: { alignItems: "center", padding: spacing.xl, gap: spacing.lg },
  pinDots: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.borderStrong },
  dotActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  pinHint: { color: colors.onSurfaceTertiary, fontSize: 12 },
  pinError: { color: colors.error, fontWeight: "700" },
  pinPad: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "center", width: 280 },
  padKey: {
    width: 80, height: 60, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  padOk: { backgroundColor: colors.brand, borderColor: colors.brand },
  padDigit: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
  heroCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  heroLabel: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  heroValue: { color: colors.brand, fontSize: 36, fontWeight: "900", letterSpacing: 1, marginTop: spacing.xs },
  metricPill: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, flex: 1,
  },
  metricDot: { width: 8, height: 8, borderRadius: 4 },
  metricLbl: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "700" },
  metricVal: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  statCard: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4,
  },
  statVal: { color: colors.onSurface, fontSize: 20, fontWeight: "900" },
  statLbl: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "700" },
  chartCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  chartTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  legendRow: { flexDirection: "row", marginTop: spacing.sm },
  barCol: { alignItems: "center", width: 22 },
  barStack: { height: 150, justifyContent: "flex-end" },
  barLbl: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 4 },
  chartAxis: { color: colors.onSurfaceTertiary, fontSize: 10, textAlign: "center", marginTop: spacing.xs },
  lockBtn: {
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12,
  },
  lockText: { color: colors.onSurface, fontWeight: "700" },
  shiftCard: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.brand,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  shiftIcon: {
    height: 44,
    width: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  shiftTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  shiftSub: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
});
