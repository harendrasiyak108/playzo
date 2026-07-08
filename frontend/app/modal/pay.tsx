import { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, radius } from "@/src/theme";
import { api, PaymentEntry, money } from "@/src/api";

type Mode = "cash" | "upi" | "split";

type Row = { name: string; method: "cash" | "upi"; amount: string };

export default function PayScreen() {
  const { billId, kind, total: totalStr } = useLocalSearchParams<{ billId: string; kind: "session" | "pos"; total: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const total = parseFloat(totalStr || "0");

  const [mode, setMode] = useState<Mode>("cash");
  const [rows, setRows] = useState<Row[]>([
    { name: "Player 1", method: "cash", amount: (total / 2).toFixed(2) },
    { name: "Player 2", method: "upi", amount: (total / 2).toFixed(2) },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sum = useMemo(() => rows.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0), [rows]);
  const diff = round(total - sum);
  const canConfirmSplit = Math.abs(diff) < 0.01 && rows.length >= 2 && rows.every((r) => parseFloat(r.amount) > 0);

  const setRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, { name: `Player ${prev.length + 1}`, method: "cash", amount: "0" }]);
  const removeRow = (idx: number) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };
  const splitEqually = () => {
    const each = round(total / rows.length);
    const remainder = round(total - each * rows.length);
    setRows((prev) => prev.map((r, i) => ({ ...r, amount: (i === 0 ? round(each + remainder) : each).toFixed(2) })));
  };

  const confirm = async () => {
    setErr(""); setBusy(true);
    try {
      let payments: PaymentEntry[] | undefined;
      if (mode === "split") {
        payments = rows.map((r) => ({ name: r.name.trim() || null, method: r.method, amount: parseFloat(r.amount) || 0 }));
      }
      await api.payBill(kind, billId, mode, payments);
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="close-btn">
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 220, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.heroLbl}>Amount Due</Text>
            <Text style={styles.heroVal} testID="pay-total">{money(total)}</Text>
          </View>

          <Text style={styles.label}>Payment Method</Text>
          <View style={styles.methodRow}>
            <MethodBtn active={mode === "cash"} onPress={() => setMode("cash")} icon="cash-outline" label="Cash" testID="method-cash" />
            <MethodBtn active={mode === "upi"} onPress={() => setMode("upi")} icon="phone-portrait-outline" label="UPI" testID="method-upi" />
            <MethodBtn active={mode === "split"} onPress={() => setMode("split")} icon="people-outline" label="Split" testID="method-split" />
          </View>

          {mode === "split" && (
            <View style={styles.splitBox}>
              <View style={styles.splitHead}>
                <Text style={styles.splitTitle}>Split between {rows.length}</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable onPress={splitEqually} style={styles.smallBtn} testID="split-equally">
                    <Text style={styles.smallBtnText}>Equal</Text>
                  </Pressable>
                  <Pressable onPress={addRow} style={[styles.smallBtn, { backgroundColor: colors.brand, borderColor: colors.brand }]} testID="split-add-row">
                    <Ionicons name="add" size={14} color={colors.onBrand} />
                  </Pressable>
                </View>
              </View>
              {rows.map((r, i) => (
                <View key={i} style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1.4 }]}
                    value={r.name}
                    onChangeText={(v) => setRow(i, { name: v })}
                    placeholderTextColor={colors.onSurfaceTertiary}
                    placeholder={`Player ${i + 1}`}
                    testID={`split-name-${i}`}
                  />
                  <View style={styles.methodMini}>
                    <Pressable onPress={() => setRow(i, { method: "cash" })} style={[styles.miniSeg, r.method === "cash" && styles.miniSegActive]} testID={`split-cash-${i}`}>
                      <Text style={[styles.miniText, r.method === "cash" && styles.miniTextActive]}>CASH</Text>
                    </Pressable>
                    <Pressable onPress={() => setRow(i, { method: "upi" })} style={[styles.miniSeg, r.method === "upi" && styles.miniSegActive]} testID={`split-upi-${i}`}>
                      <Text style={[styles.miniText, r.method === "upi" && styles.miniTextActive]}>UPI</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={r.amount}
                    onChangeText={(v) => setRow(i, { amount: v })}
                    keyboardType="numeric"
                    placeholderTextColor={colors.onSurfaceTertiary}
                    testID={`split-amount-${i}`}
                  />
                  {rows.length > 2 && (
                    <Pressable onPress={() => removeRow(i)} style={styles.removeBtn} testID={`split-remove-${i}`}>
                      <Ionicons name="close" size={16} color={colors.error} />
                    </Pressable>
                  )}
                </View>
              ))}
              <View style={styles.splitFoot}>
                <Text style={styles.splitFootLbl}>Sum {money(sum)} · Bill {money(total)}</Text>
                <Text style={[styles.diff, { color: Math.abs(diff) < 0.01 ? colors.success : colors.error }]}>
                  {Math.abs(diff) < 0.01 ? "MATCHED" : diff > 0 ? `Short ${money(diff)}` : `Over ${money(-diff)}`}
                </Text>
              </View>
            </View>
          )}

          {err ? <Text style={styles.err} testID="pay-error">{err}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            onPress={confirm}
            disabled={busy || (mode === "split" && !canConfirmSplit)}
            style={[styles.cta, (busy || (mode === "split" && !canConfirmSplit)) && { opacity: 0.5 }]}
            testID="confirm-pay-btn"
          >
            <Text style={styles.ctaText}>{busy ? "Saving…" : `Mark as Paid · ${money(total)}`}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MethodBtn({ active, onPress, icon, label, testID }: { active: boolean; onPress: () => void; icon: any; label: string; testID: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.methodBtn, active && styles.methodBtnActive]} testID={testID}>
      <Ionicons name={icon} size={22} color={active ? colors.onBrand : colors.onSurface} />
      <Text style={[styles.methodLbl, active && { color: colors.onBrand }]}>{label}</Text>
    </Pressable>
  );
}

function round(n: number) { return Math.round(n * 100) / 100; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: 1 },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  iconBtn: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  hero: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  heroLbl: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  heroVal: { color: colors.brand, fontSize: 40, fontWeight: "900", letterSpacing: 1, marginTop: spacing.xs },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  methodRow: { flexDirection: "row", gap: spacing.sm },
  methodBtn: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", gap: 6,
  },
  methodBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  methodLbl: { color: colors.onSurface, fontWeight: "800", fontSize: 12, letterSpacing: 0.6 },
  splitBox: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  splitHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  splitTitle: { color: colors.onSurface, fontWeight: "800", letterSpacing: 0.5 },
  smallBtn: { paddingHorizontal: spacing.md, height: 30, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 },
  smallBtnText: { color: colors.onSurface, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  input: { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, fontSize: 13 },
  methodMini: { flexDirection: "row", borderRadius: radius.sm, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  miniSeg: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.surfaceTertiary },
  miniSegActive: { backgroundColor: colors.brand },
  miniText: { color: colors.onSurfaceSecondary, fontWeight: "800", fontSize: 10, letterSpacing: 0.6 },
  miniTextActive: { color: colors.onBrand },
  removeBtn: { padding: 6 },
  splitFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  splitFootLbl: { color: colors.onSurfaceTertiary, fontSize: 11 },
  diff: { fontWeight: "900", fontSize: 12, letterSpacing: 0.6 },
  err: { color: colors.error, fontWeight: "700" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.lg },
  cta: { backgroundColor: colors.success, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  ctaText: { color: "#02120a", fontWeight: "900", fontSize: 15, letterSpacing: 0.8, textTransform: "uppercase" },
});
