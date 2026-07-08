import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, radius } from "@/src/theme";
import { api, Station } from "@/src/api";

type StationType = "pc" | "console" | "table";
type StationStatus = "available" | "occupied" | "maintenance";

export default function StationForm() {
  const { stationId } = useLocalSearchParams<{ stationId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("80");
  const [type, setType] = useState<StationType>("pc");
  const [status, setStatus] = useState<StationStatus>("available");
  const [current, setCurrent] = useState<Station | null>(null);
  const [err, setErr] = useState("");
  const isEdit = !!stationId;

  useEffect(() => {
    if (!stationId) return;
    (async () => {
      const list = await api.listStations();
      const s = list.find((x) => x.id === stationId);
      if (s) {
        setCurrent(s);
        setName(s.name);
        setRate(String(s.hourly_rate));
        setType(s.type);
        setStatus(s.status);
      }
    })();
  }, [stationId]);

  const save = async () => {
    setErr("");
    if (!name.trim()) return setErr("Name is required");
    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum <= 0) return setErr("Hourly rate must be > 0");
    try {
      if (isEdit && stationId) {
        await api.updateStation(stationId, { name: name.trim(), hourly_rate: rateNum, type, status });
      } else {
        await api.createStation({ name: name.trim(), hourly_rate: rateNum, type });
      }
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    }
  };

  const remove = async () => {
    if (!stationId) return;
    try {
      await api.deleteStation(stationId);
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} testID="close-btn" style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>{isEdit ? "Edit Station" : "Add Station"}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Name</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="PC-05" placeholderTextColor={colors.onSurfaceTertiary} testID="station-name-input" />

          <Text style={styles.label}>Type</Text>
          <View style={styles.row}>
            {(["pc", "console", "table"] as StationType[]).map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[styles.segment, type === t && styles.segmentActive]} testID={`type-${t}`}>
                <Text style={[styles.segmentText, type === t && styles.segmentTextActive]}>{t.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Hourly Rate (₹)</Text>
          <TextInput value={rate} onChangeText={setRate} keyboardType="numeric" style={styles.input} testID="station-rate-input" />

          {isEdit && current?.status !== "occupied" && (
            <>
              <Text style={styles.label}>Status</Text>
              <View style={styles.row}>
                {(["available", "maintenance"] as StationStatus[]).map((s) => (
                  <Pressable key={s} onPress={() => setStatus(s)} style={[styles.segment, status === s && styles.segmentActive]} testID={`status-${s}`}>
                    <Text style={[styles.segmentText, status === s && styles.segmentTextActive]}>{s.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {isEdit && current?.status === "occupied" && (
            <Text style={styles.warn}>Station is currently occupied. End the session before editing status or deleting.</Text>
          )}

          {err ? <Text style={styles.err} testID="form-error">{err}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          {isEdit && (
            <Pressable style={styles.deleteBtn} onPress={remove} testID="delete-station-btn">
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </Pressable>
          )}
          <Pressable style={styles.cta} onPress={save} testID="save-station-btn">
            <Text style={styles.ctaText}>{isEdit ? "Save Changes" : "Create Station"}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: 1 },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  iconBtn: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700", marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15 },
  row: { flexDirection: "row", gap: spacing.sm },
  segment: { flex: 1, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: "center" },
  segmentActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  segmentText: { color: colors.onSurfaceSecondary, fontWeight: "800", letterSpacing: 0.6, fontSize: 12 },
  segmentTextActive: { color: colors.onBrand },
  warn: { color: colors.warning, marginTop: spacing.sm, fontSize: 12 },
  err: { color: colors.error, marginTop: spacing.sm, fontWeight: "700" },
  footer: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderTopColor: colors.divider, borderTopWidth: 1 },
  deleteBtn: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error, height: 52, width: 52, alignItems: "center", justifyContent: "center" },
  cta: { flex: 1, backgroundColor: colors.brand, borderRadius: radius.md, alignItems: "center", justifyContent: "center", height: 52 },
  ctaText: { color: colors.onBrand, fontWeight: "900", fontSize: 15, letterSpacing: 0.8, textTransform: "uppercase" },
});
