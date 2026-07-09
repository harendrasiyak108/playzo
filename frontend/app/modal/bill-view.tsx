import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking, Platform, TextInput, KeyboardAvoidingView, Modal,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, radius } from "@/src/theme";
import { api, Bill, money } from "@/src/api";
import { formatDuration } from "@/src/hooks/useNow";

export default function BillView() {
  const { billId, kind } = useLocalSearchParams<{ billId: string; kind: "session" | "pos" }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bill, setBill] = useState<Bill | null>(null);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempPhone, setTempPhone] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const load = useCallback(async () => {
    const list = await api.listBills();
    const foundBill = list.find((b) => b.id === billId && b.kind === kind) || null;
    setBill(foundBill);
    if (foundBill) {
      setTempName(foundBill.customer_name || "");
      setTempPhone(foundBill.customer_phone || "");
    }
  }, [billId, kind]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const receiptText = useMemo(() => {
    if (!bill) return "";
    const lines: string[] = [];
    lines.push("*PLAYZO GAMEZONE HUB*");
    lines.push(`Receipt #${bill.id.slice(0, 8)}`);
    lines.push(new Date(bill.created_at).toLocaleString());
    lines.push("--------------------------");
    lines.push(bill.title);
    if (bill.customer_phone) lines.push(`Phone: ${bill.customer_phone}`);
    lines.push("");
    if (bill.duration_minutes > 0) {
      lines.push(`Play time: ${formatDuration(bill.duration_minutes * 60000)}`);
      lines.push(`Time cost: ${money(bill.time_cost)}`);
      lines.push("");
    }
    if (bill.items.length) {
      lines.push("Items:");
      for (const it of bill.items) {
        lines.push(`  ${it.name} x${it.quantity}  ${money(it.price * it.quantity)}`);
      }
      lines.push("");
    }
    lines.push(`TOTAL: ${money(bill.total)}`);
    lines.push("Thanks for playing!");
    return lines.join("\n");
  }, [bill]);

  const shareWhatsApp = () => {
    if (!bill) return;
    const digits = (bill.customer_phone || "").replace(/\D/g, "");
    const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
    Linking.openURL(`${base}?text=${encodeURIComponent(receiptText)}`).catch(() => {});
  };

  const saveCustomerDetails = async () => {
    if (!bill || !tempName.trim() || !tempPhone.trim()) return;
    setSavingCustomer(true);
    try {
      if (kind === "session") {
        await api.updateSessionCustomer(billId, {
          customer_name: tempName.trim(),
          customer_phone: tempPhone.trim(),
        });
      } else {
        await api.updatePOSCustomer(billId, {
          customer_name: tempName.trim(),
          customer_phone: tempPhone.trim(),
        });
      }
      await load();
      setEditingCustomer(false);
    } catch (e) {
      console.log("save customer err", e);
    } finally {
      setSavingCustomer(false);
    }
  };

  const shareSMS = () => {
    if (!bill) return;
    const digits = (bill.customer_phone || "").replace(/\D/g, "");
    const sep = Platform.OS === "ios" ? "&" : "?";
    const url = digits ? `sms:${digits}${sep}body=${encodeURIComponent(receiptText)}` : `sms:?body=${encodeURIComponent(receiptText)}`;
    Linking.openURL(url).catch(() => {});
  };

  if (!bill) {
    return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.replace("/(tabs)/bills")} testID="close-bill-btn" style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Bill</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 220 }}>
        <View style={styles.receipt}>
          <Text style={styles.brand}>PLAYZO</Text>
          <Text style={styles.brandSub}>Gamezone Hub · Receipt</Text>
          <Text style={styles.receiptMeta}>#{bill.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.receiptMeta}>{new Date(bill.created_at).toLocaleString()}</Text>

          <View style={styles.divider} />

          <View style={styles.customerSection}>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerLine}>{bill.title}</Text>
              {bill.customer_phone ? <Text style={styles.customerLine}>Phone: {bill.customer_phone}</Text> : null}
              {!bill.customer_name && !bill.customer_phone && <Text style={styles.emptyCustomer}>Customer details not added</Text>}
            </View>
            {bill.payment_status !== "paid" && (
              <Pressable onPress={() => setEditingCustomer(true)} style={styles.editBtn} testID="edit-customer-btn">
                <Ionicons name="pencil" size={16} color={colors.brand} />
              </Pressable>
            )}
          </View>

          <View style={styles.divider} />

          {bill.duration_minutes > 0 && (
            <>
              <View style={styles.line}>
                <Text style={styles.lineLbl}>Play time</Text>
                <Text style={styles.lineVal}>{formatDuration(bill.duration_minutes * 60000)}</Text>
              </View>
              <View style={styles.line}>
                <Text style={styles.lineLbl}>Time cost</Text>
                <Text style={styles.lineVal}>{money(bill.time_cost)}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}

          {bill.items.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Add-ons</Text>
              {bill.items.map((it) => (
                <View key={it.menu_item_id} style={styles.line}>
                  <Text style={styles.lineLbl}>{it.emoji} {it.name} × {it.quantity}</Text>
                  <Text style={styles.lineVal}>{money(it.price * it.quantity)}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.line}>
                <Text style={styles.lineLbl}>F&B subtotal</Text>
                <Text style={styles.lineVal}>{money(bill.items_cost)}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}

          <View style={styles.totalLine}>
            <Text style={styles.totalLbl}>TOTAL</Text>
            <Text style={styles.totalVal} testID="bill-total">{money(bill.total)}</Text>
          </View>

          <View style={[styles.paidPill, { backgroundColor: (bill.payment_status === "paid" ? colors.success : colors.warning) + "22", borderColor: bill.payment_status === "paid" ? colors.success : colors.warning }]}>
            <Ionicons name={bill.payment_status === "paid" ? "checkmark-circle" : "alert-circle"} size={14} color={bill.payment_status === "paid" ? colors.success : colors.warning} />
            <Text style={[styles.paidPillText, { color: bill.payment_status === "paid" ? colors.success : colors.warning }]}>
              {bill.payment_status === "paid" ? `PAID · ${(bill.payment_method || "").toUpperCase()}` : "UNPAID"}
            </Text>
          </View>

          {bill.payment_status === "paid" && bill.payments.length > 1 && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.sectionTitle}>Split</Text>
              {bill.payments.map((p, i) => (
                <View key={i} style={styles.line}>
                  <Text style={styles.lineLbl}>{p.name || `Payer ${i + 1}`} · {p.method.toUpperCase()}</Text>
                  <Text style={styles.lineVal}>{money(p.amount)}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.thanks}>Thanks for playing at Playzo!</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {bill.payment_status !== "paid" && (
          <Pressable
            style={styles.payBtn}
            onPress={() => router.push({ pathname: "/modal/pay", params: { billId: bill.id, kind: bill.kind, total: String(bill.total) } })}
            testID="mark-paid-btn"
          >
            <Ionicons name="wallet" size={18} color="#02120a" />
            <Text style={styles.payText}>Mark as Paid</Text>
          </Pressable>
        )}
        <Pressable style={styles.smsBtn} onPress={shareSMS} testID="share-sms-btn">
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.onSurface} />
          <Text style={styles.smsText}>SMS</Text>
        </Pressable>
        <Pressable style={styles.waBtn} onPress={shareWhatsApp} testID="share-wa-btn">
          <Ionicons name="logo-whatsapp" size={18} color={colors.onBrand} />
          <Text style={styles.waText}>WhatsApp</Text>
        </Pressable>
      </View>

      <Modal visible={editingCustomer} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={[styles.modalOverlay, { paddingTop: insets.top + spacing.md }]}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.md }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Customer Details</Text>
                <Pressable onPress={() => setEditingCustomer(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={colors.onSurface} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={{ gap: spacing.md, padding: spacing.lg }} keyboardShouldPersistTaps="handled">
                <View>
                  <Text style={styles.label}>Customer Name</Text>
                  <TextInput
                    value={tempName}
                    onChangeText={setTempName}
                    placeholder="e.g. Rahul Kumar"
                    placeholderTextColor={colors.onSurfaceTertiary}
                    style={styles.input}
                    testID="modal-customer-name"
                  />
                </View>

                <View>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    value={tempPhone}
                    onChangeText={setTempPhone}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor={colors.onSurfaceTertiary}
                    style={styles.input}
                    keyboardType="phone-pad"
                    testID="modal-customer-phone"
                  />
                </View>

                <Pressable
                  onPress={saveCustomerDetails}
                  disabled={savingCustomer || !tempName.trim() || !tempPhone.trim()}
                  style={[styles.saveBtn, (savingCustomer || !tempName.trim() || !tempPhone.trim()) && { opacity: 0.5 }]}
                  testID="save-customer-btn"
                >
                  <Text style={styles.saveBtnText}>{savingCustomer ? "Saving…" : "Save Details"}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: 1 },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  iconBtn: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  receipt: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: "stretch" },
  brand: { color: colors.brand, fontSize: 32, fontWeight: "900", letterSpacing: 3, textAlign: "center" },
  brandSub: { color: colors.onSurfaceTertiary, textAlign: "center", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 2 },
  receiptMeta: { color: colors.onSurfaceTertiary, textAlign: "center", fontSize: 11, marginTop: 4, fontVariant: ["tabular-nums"] },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md, borderStyle: "dashed" },
  customerSection: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  customerLine: { color: colors.onSurface, fontSize: 13, marginTop: 2 },
  emptyCustomer: { color: colors.onSurfaceTertiary, fontSize: 13, fontStyle: "italic", marginTop: 2 },
  editBtn: { padding: spacing.sm, backgroundColor: colors.brand + "18", borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
  sectionTitle: { color: colors.onSurface, fontWeight: "800", marginBottom: spacing.sm, letterSpacing: 0.6, textTransform: "uppercase", fontSize: 12 },
  line: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  lineLbl: { color: colors.onSurfaceSecondary, flex: 1, fontSize: 13 },
  lineVal: { color: colors.onSurface, fontWeight: "700", fontVariant: ["tabular-nums"] },
  totalLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  totalLbl: { color: colors.onSurface, fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  totalVal: { color: colors.brand, fontSize: 32, fontWeight: "900", letterSpacing: 1 },
  thanks: { color: colors.onSurfaceTertiary, textAlign: "center", marginTop: spacing.lg, fontSize: 11, letterSpacing: 0.8 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.lg, flexDirection: "row", gap: spacing.md },
  smsBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  smsText: { color: colors.onSurface, fontWeight: "800", letterSpacing: 0.6 },
  waBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14 },
  waText: { color: colors.onBrand, fontWeight: "900", letterSpacing: 0.6 },
  payBtn: { flex: 1.4, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: 14 },
  payText: { color: "#02120a", fontWeight: "900", letterSpacing: 0.6, fontSize: 14 },
  paidPill: {
    alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6,
    marginTop: spacing.md,
  },
  paidPillText: { fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: "80%", flexShrink: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, borderBottomColor: colors.divider, borderBottomWidth: 1 },
  modalTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  closeBtn: { height: 40, width: 40, alignItems: "center", justifyContent: "center" },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  input: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, color: colors.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15 },
  saveBtn: { backgroundColor: colors.brand, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 16, marginTop: spacing.md },
  saveBtnText: { color: colors.onBrand, fontWeight: "900", fontSize: 16, letterSpacing: 1, textTransform: "uppercase" },
});
