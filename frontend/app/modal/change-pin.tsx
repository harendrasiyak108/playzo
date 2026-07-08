import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

export default function ChangePinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr(""); setMsg("");
    if (!/^\d{4,8}$/.test(next)) return setErr("New PIN must be 4-8 digits");
    try {
      await api.changePin(current, next);
      setMsg("PIN updated");
      setCurrent(""); setNext("");
      setTimeout(() => router.back(), 800);
    } catch (e: any) {
      setErr(e?.message?.includes("401") ? "Wrong current PIN" : "Update failed");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="close-btn">
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Change PIN</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={styles.label}>Current PIN</Text>
          <TextInput value={current} onChangeText={setCurrent} secureTextEntry keyboardType="number-pad" style={styles.input} testID="current-pin-input" />
          <Text style={styles.label}>New PIN (4-8 digits)</Text>
          <TextInput value={next} onChangeText={setNext} secureTextEntry keyboardType="number-pad" style={styles.input} testID="new-pin-input" />
          {err ? <Text style={styles.err} testID="pin-form-error">{err}</Text> : null}
          {msg ? <Text style={styles.ok}>{msg}</Text> : null}
          <Pressable style={styles.cta} onPress={submit} testID="submit-pin-btn">
            <Text style={styles.ctaText}>Update PIN</Text>
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
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  input: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15 },
  err: { color: colors.error, fontWeight: "700" },
  ok: { color: colors.success, fontWeight: "700" },
  cta: { backgroundColor: colors.brand, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 16, marginTop: spacing.md },
  ctaText: { color: colors.onBrand, fontWeight: "900", fontSize: 15, letterSpacing: 0.8, textTransform: "uppercase" },
});
