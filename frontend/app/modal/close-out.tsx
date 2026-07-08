import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { colors, spacing, radius } from "@/src/theme";
import { api, CloseOut, money } from "@/src/api";

export default function CloseOutScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<CloseOut | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(date || todayISO());
  const [busy, setBusy] = useState<null | "pdf" | "wa" | "sms">(null);

  const load = useCallback(async () => {
    setData(null);
    setData(await api.closeOut(selectedDate));
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  const receiptText = useMemo(() => (data ? formatText(data) : ""), [data]);
  const receiptHtml = useMemo(() => (data ? formatHtml(data) : ""), [data]);

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const shareWhatsApp = () => {
    setBusy("wa");
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(receiptText)}`).finally(() => setBusy(null));
  };

  const shareSMS = () => {
    setBusy("sms");
    const sep = Platform.OS === "ios" ? "&" : "?";
    Linking.openURL(`sms:${sep}body=${encodeURIComponent(receiptText)}`).finally(() => setBusy(null));
  };

  const printPdf = async () => {
    setBusy("pdf");
    try {
      if (Platform.OS === "web") {
        await Print.printAsync({ html: receiptHtml });
      } else {
        const { uri } = await Print.printToFileAsync({ html: receiptHtml });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Shift Close-Out" });
        }
      }
    } catch (e) {
      console.log("pdf err", e);
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  }

  const isToday = selectedDate === todayISO();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="close-btn">
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Shift Close-Out</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.dateRow}>
        <Pressable onPress={() => shiftDay(-1)} style={styles.dateArrow} testID="date-prev">
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.dateBig}>{prettyDate(selectedDate)}</Text>
          <Text style={styles.dateSub}>{isToday ? "TODAY" : ""}</Text>
        </View>
        <Pressable onPress={() => shiftDay(1)} style={styles.dateArrow} testID="date-next" disabled={isToday}>
          <Ionicons name="chevron-forward" size={20} color={isToday ? colors.onSurfaceTertiary : colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 220, gap: spacing.md }}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLbl}>Collected</Text>
          <Text style={styles.heroVal} testID="collected-total">{money(data.collected)}</Text>
          <Text style={styles.heroSub}>Total billed {money(data.total_billed)}</Text>
        </View>

        <View style={styles.methodRow}>
          <MethodCard label="Cash" value={money(data.cash_total)} icon="cash-outline" color={colors.success} />
          <MethodCard label="UPI" value={money(data.upi_total)} icon="phone-portrait-outline" color={colors.info} />
          <MethodCard label="Unpaid" value={money(data.unpaid_total)} icon="alert-circle" color={colors.warning} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Revenue Mix</Text>
          <Row label="Time cost" value={money(data.time_revenue)} />
          <Row label="Food & Beverage" value={money(data.fnb_revenue)} />
          <View style={styles.divider} />
          <Row label="Sessions completed" value={String(data.session_count)} />
          <Row label="POS orders" value={String(data.pos_count)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Outstanding · {data.unpaid_bills.length}</Text>
          {data.unpaid_bills.length === 0 ? (
            <Text style={styles.empty}>All bills settled ✅</Text>
          ) : (
            data.unpaid_bills.map((b) => (
              <View key={`${b.kind}-${b.id}`} style={styles.unpaidRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unpaidTitle} numberOfLines={1}>{b.title}</Text>
                  <Text style={styles.unpaidMeta}>
                    {b.customer_phone || "—"} · {new Date(b.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                <Text style={styles.unpaidAmt}>{money(b.total)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable style={styles.smsBtn} onPress={shareSMS} disabled={!!busy} testID="close-out-sms">
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.onSurface} />
          <Text style={styles.smsText}>SMS</Text>
        </Pressable>
        <Pressable style={styles.pdfBtn} onPress={printPdf} disabled={!!busy} testID="close-out-pdf">
          <Ionicons name="document-text" size={18} color={colors.onSurface} />
          <Text style={styles.smsText}>{busy === "pdf" ? "…" : "PDF"}</Text>
        </Pressable>
        <Pressable style={styles.waBtn} onPress={shareWhatsApp} disabled={!!busy} testID="close-out-wa">
          <Ionicons name="logo-whatsapp" size={18} color={colors.onBrand} />
          <Text style={styles.waText}>WhatsApp</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MethodCard({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={[styles.methodCard, { borderColor: color }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.methodLbl, { color }]}>{label}</Text>
      <Text style={styles.methodVal}>{value}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLbl}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

function todayISO() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function prettyDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function formatText(d: CloseOut): string {
  const lines: string[] = [];
  lines.push("*PLAYZO GAMEZONE HUB*");
  lines.push(`Shift Close-Out · ${prettyDate(d.date)}`);
  lines.push("--------------------------");
  lines.push(`Collected: ₹${d.collected.toFixed(2)}`);
  lines.push(`  Cash:  ₹${d.cash_total.toFixed(2)}`);
  lines.push(`  UPI:   ₹${d.upi_total.toFixed(2)}`);
  lines.push(`Unpaid: ₹${d.unpaid_total.toFixed(2)}`);
  lines.push(`Total billed: ₹${d.total_billed.toFixed(2)}`);
  lines.push("");
  lines.push(`Time cost: ₹${d.time_revenue.toFixed(2)}`);
  lines.push(`F&B: ₹${d.fnb_revenue.toFixed(2)}`);
  lines.push(`Sessions: ${d.session_count}  ·  POS: ${d.pos_count}`);
  if (d.unpaid_bills.length) {
    lines.push("");
    lines.push(`Outstanding (${d.unpaid_bills.length}):`);
    for (const b of d.unpaid_bills) {
      lines.push(`  ${b.title} — ₹${b.total.toFixed(2)}${b.customer_phone ? ` (${b.customer_phone})` : ""}`);
    }
  }
  lines.push("");
  lines.push("End of shift.");
  return lines.join("\n");
}

function formatHtml(d: CloseOut): string {
  const rows = d.unpaid_bills
    .map((b) => `<tr><td>${escape(b.title)}</td><td>${escape(b.customer_phone || "—")}</td><td style="text-align:right">₹${b.total.toFixed(2)}</td></tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:32px;color:#111}
    h1{margin:0 0 4px 0;letter-spacing:2px;color:#606a00}
    .sub{color:#666;font-size:12px;letter-spacing:1px;text-transform:uppercase}
    .hero{background:#111;color:#ccff00;padding:24px;border-radius:16px;margin:24px 0}
    .hero .lbl{color:#999;font-size:12px;letter-spacing:1px;text-transform:uppercase}
    .hero .val{font-size:44px;font-weight:900;letter-spacing:2px}
    .grid{display:flex;gap:12px;margin:16px 0}
    .cell{flex:1;border:1px solid #eee;border-radius:12px;padding:12px}
    .cell .l{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#666}
    .cell .v{font-size:20px;font-weight:800;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{padding:8px 6px;border-bottom:1px solid #eee;font-size:13px;text-align:left}
    .section-title{margin:24px 0 8px 0;font-size:14px;letter-spacing:1px;text-transform:uppercase;color:#333}
    .foot{margin-top:32px;color:#999;font-size:11px;text-align:center;letter-spacing:1px}
  </style></head><body>
    <h1>PLAYZO</h1>
    <div class="sub">Shift Close-Out · ${prettyDate(d.date)}</div>
    <div class="hero">
      <div class="lbl">Collected</div>
      <div class="val">₹${d.collected.toFixed(2)}</div>
      <div class="lbl" style="margin-top:8px">Total billed ₹${d.total_billed.toFixed(2)}</div>
    </div>
    <div class="grid">
      <div class="cell"><div class="l">Cash</div><div class="v">₹${d.cash_total.toFixed(2)}</div></div>
      <div class="cell"><div class="l">UPI</div><div class="v">₹${d.upi_total.toFixed(2)}</div></div>
      <div class="cell"><div class="l">Unpaid</div><div class="v">₹${d.unpaid_total.toFixed(2)}</div></div>
    </div>
    <div class="section-title">Revenue Mix</div>
    <table>
      <tr><td>Time cost</td><td style="text-align:right">₹${d.time_revenue.toFixed(2)}</td></tr>
      <tr><td>Food & Beverage</td><td style="text-align:right">₹${d.fnb_revenue.toFixed(2)}</td></tr>
      <tr><td>Sessions completed</td><td style="text-align:right">${d.session_count}</td></tr>
      <tr><td>POS orders</td><td style="text-align:right">${d.pos_count}</td></tr>
    </table>
    <div class="section-title">Outstanding (${d.unpaid_bills.length})</div>
    ${d.unpaid_bills.length
      ? `<table><thead><tr><th>Bill</th><th>Phone</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p style="color:#666">All bills settled.</p>`}
    <div class="foot">Generated ${new Date().toLocaleString()}</div>
  </body></html>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: 1 },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  iconBtn: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border },
  dateArrow: { height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  dateBig: { color: colors.onSurface, fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  dateSub: { color: colors.brand, fontSize: 10, letterSpacing: 1.4, fontWeight: "900", marginTop: 2 },
  heroCard: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.xl, alignItems: "center" },
  heroLbl: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  heroVal: { color: colors.brand, fontSize: 44, fontWeight: "900", letterSpacing: 1, marginTop: spacing.xs },
  heroSub: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: spacing.xs },
  methodRow: { flexDirection: "row", gap: spacing.sm },
  methodCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  methodLbl: { fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "800" },
  methodVal: { color: colors.onSurface, fontSize: 18, fontWeight: "900" },
  card: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  cardTitle: { color: colors.onSurface, fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowLbl: { color: colors.onSurfaceSecondary, fontSize: 13 },
  rowVal: { color: colors.onSurface, fontWeight: "800", fontSize: 13, fontVariant: ["tabular-nums"] },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  empty: { color: colors.success, fontWeight: "700", textAlign: "center", paddingVertical: spacing.md },
  unpaidRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: spacing.sm },
  unpaidTitle: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  unpaidMeta: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  unpaidAmt: { color: colors.warning, fontWeight: "900", fontSize: 15 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.lg, flexDirection: "row", gap: spacing.sm },
  smsBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  pdfBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  smsText: { color: colors.onSurface, fontWeight: "800", letterSpacing: 0.6 },
  waBtn: { flex: 1.2, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14 },
  waText: { color: colors.onBrand, fontWeight: "900", letterSpacing: 0.6 },
});
