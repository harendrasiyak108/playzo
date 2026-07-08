import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, radius, stationTypeIcon } from "@/src/theme";
import { api, CustomerLookup, Station, money } from "@/src/api";

export default function StartSessionScreen() {
  const { stationId } = useLocalSearchParams<{ stationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [station, setStation] = useState<Station | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState<CustomerLookup | null>(null);

  useEffect(() => {
    (async () => {
      const list = await api.listStations();
      setStation(list.find((s) => s.id === stationId) || null);
    })();
  }, [stationId]);

  const checkPhone = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return setLookup(null);
    try {
      const info = await api.customerLookup(digits);
      setLookup(info);
      if (info.visit_count > 0 && !name && info.last_name) {
        setName(info.last_name);
      }
    } catch {
      setLookup(null);
    }
  };

  const start = async () => {
    setErr("");
    if (!name.trim()) return setErr("Customer name required");
    if (!/^\d{7,15}$/.test(phone.replace(/\s/g, ""))) return setErr("Enter a valid phone");
    setBusy(true);
    try {
      const sess = await api.startSession({
        station_id: stationId,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
      });
      router.replace({ pathname: "/modal/session-detail", params: { sessionId: sess.id } });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} testID="close-btn" style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Start Session</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          {station && (
            <View style={styles.stationCard}>
              <Text style={{ fontSize: 44 }}>{stationTypeIcon(station.type)}</Text>
              <View>
                <Text style={styles.stationName}>{station.name}</Text>
                <Text style={styles.stationRate}>{money(station.hourly_rate)}/hr</Text>
              </View>
            </View>
          )}

          <Text style={styles.label}>Customer Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Rahul Kumar"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.input}
            testID="customer-name-input"
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            onBlur={checkPhone}
            placeholder="e.g. 9876543210"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.input}
            keyboardType="phone-pad"
            testID="customer-phone-input"
          />

          {lookup && lookup.visit_count > 0 && (
            <View style={styles.loyaltyBanner} testID="loyalty-banner">
              <Ionicons name="star" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.loyaltyTitle}>Returning customer</Text>
                <Text style={styles.loyaltyMeta}>
                  {lookup.visit_count} {lookup.visit_count === 1 ? "visit" : "visits"} · Spent {money(lookup.total_spent)}
                  {lookup.last_visit_at ? ` · Last ${new Date(lookup.last_visit_at).toLocaleDateString()}` : ""}
                </Text>
              </View>
            </View>
          )}

          {err ? <Text style={styles.err} testID="start-error">{err}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable onPress={start} disabled={busy} style={styles.cta} testID="confirm-start-btn">
            <Text style={styles.ctaText}>{busy ? "Starting…" : "Start Session"}</Text>
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
  stationCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md },
  stationName: { color: colors.onSurface, fontSize: 20, fontWeight: "900", letterSpacing: 0.8 },
  stationRate: { color: colors.brand, fontSize: 14, fontWeight: "700", marginTop: 2 },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700", marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15 },
  err: { color: colors.error, fontWeight: "700", marginTop: spacing.sm },
  loyaltyBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.brand + "18", borderColor: colors.brand,
    borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm,
  },
  loyaltyTitle: { color: colors.brand, fontWeight: "900", fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase" },
  loyaltyMeta: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  footer: { padding: spacing.lg, borderTopColor: colors.divider, borderTopWidth: 1, backgroundColor: colors.surface },
  cta: { backgroundColor: colors.brand, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  ctaText: { color: colors.onBrand, fontWeight: "900", fontSize: 16, letterSpacing: 1, textTransform: "uppercase" },
});
