import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ChipRow } from "@/src/components/ChipRow";
import { colors, spacing, radius } from "@/src/theme";
import { api, MenuItem, SessionItem, money } from "@/src/api";

export default function POSScreen() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, SessionItem>>({});
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>("all");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      setMenu(await api.listMenu());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const set = new Set(menu.map((m) => m.category));
    return [{ key: "all", label: "All" }, ...Array.from(set).map((c) => ({ key: c, label: c }))];
  }, [menu]);

  const filtered = menu.filter((m) => cat === "all" || m.category === cat);
  const cartItems = Object.values(cart);
  const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = cartItems.reduce((s, i) => s + i.quantity, 0);

  const add = (m: MenuItem) => {
    setCart((prev) => {
      const existing = prev[m.id];
      const item: SessionItem = {
        menu_item_id: m.id,
        name: m.name,
        price: m.price,
        quantity: (existing?.quantity || 0) + 1,
        emoji: m.emoji,
      };
      return { ...prev, [m.id]: item };
    });
  };
  const sub = (m: MenuItem) => {
    setCart((prev) => {
      const existing = prev[m.id];
      if (!existing) return prev;
      const q = existing.quantity - 1;
      const next = { ...prev };
      if (q <= 0) delete next[m.id];
      else next[m.id] = { ...existing, quantity: q };
      return next;
    });
  };

  const checkout = async () => {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const order = await api.createPOS({
        items: cartItems,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
      });
      setCart({});
      setCustomerName("");
      setCustomerPhone("");
      setShowCustomer(false);
      router.push({ pathname: "/modal/bill-view", params: { billId: order.id, kind: "pos" } });
    } catch (e) {
      console.log("checkout err", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Walk-in POS"
        subtitle={`${count} items · ${money(total)}`}
        right={
          <Pressable
            testID="pos-manage-menu-btn"
            onPress={() => router.push("/modal/menu-manage")}
            style={styles.headerBtn}
          >
            <Ionicons name="restaurant" size={20} color={colors.onSurface} />
          </Pressable>
        }
      />
      <ChipRow options={categories as any} value={cat} onChange={setCat} testIDPrefix="pos-cat" />

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ paddingBottom: 220, paddingTop: spacing.sm, gap: spacing.md }}
        renderItem={({ item }) => {
          const q = cart[item.id]?.quantity || 0;
          return (
            <Pressable
              style={[styles.card, q > 0 && { borderColor: colors.brand }]}
              onPress={() => add(item)}
              testID={`menu-item-${item.name}`}
            >
              <Text style={{ fontSize: 32 }}>{item.emoji}</Text>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemCat}>{item.category}</Text>
              <View style={styles.itemFooter}>
                <Text style={styles.itemPrice}>{money(item.price)}</Text>
                {q > 0 ? (
                  <View style={styles.qty}>
                    <Pressable onPress={() => sub(item)} style={styles.qtyBtn} testID={`sub-${item.name}`}>
                      <Ionicons name="remove" size={16} color={colors.onBrand} />
                    </Pressable>
                    <Text style={styles.qtyText}>{q}</Text>
                    <Pressable onPress={() => add(item)} style={styles.qtyBtn} testID={`add-${item.name}`}>
                      <Ionicons name="add" size={16} color={colors.onBrand} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      {count > 0 && (
        <View style={[styles.cartBar, { paddingBottom: insets.bottom + 76 }]}>
          {showCustomer && (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 120 }}>
              <TextInput
                placeholder="Customer name (optional)"
                placeholderTextColor={colors.onSurfaceTertiary}
                value={customerName}
                onChangeText={setCustomerName}
                style={styles.input}
                testID="pos-customer-name"
              />
              <TextInput
                placeholder="Phone (optional)"
                placeholderTextColor={colors.onSurfaceTertiary}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                style={styles.input}
                keyboardType="phone-pad"
                testID="pos-customer-phone"
              />
            </ScrollView>
          )}
          <View style={styles.cartRow}>
            <View>
              <Text style={styles.cartLabel}>Total ({count} items)</Text>
              <Text style={styles.cartTotal} testID="pos-total">{money(total)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => setShowCustomer((s) => !s)}
                style={styles.altBtn}
                testID="pos-toggle-customer"
              >
                <Ionicons name="person" size={18} color={colors.onSurface} />
              </Pressable>
              <Pressable
                onPress={checkout}
                disabled={submitting}
                style={styles.checkoutBtn}
                testID="pos-checkout"
              >
                <Text style={styles.checkoutText}>{submitting ? "…" : "Checkout"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
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
  card: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 150,
  },
  itemName: { color: colors.onSurface, fontWeight: "800", fontSize: 15, marginTop: spacing.sm },
  itemCat: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2, letterSpacing: 0.6, textTransform: "uppercase" },
  itemFooter: { marginTop: spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemPrice: { color: colors.brand, fontSize: 16, fontWeight: "900" },
  qty: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  qtyBtn: { backgroundColor: colors.brand, borderRadius: radius.sm, height: 24, width: 24, alignItems: "center", justifyContent: "center" },
  qtyText: { color: colors.onSurface, fontWeight: "900", fontSize: 14, minWidth: 16, textAlign: "center" },
  cartBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cartRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cartLabel: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: "700" },
  cartTotal: { color: colors.brand, fontSize: 24, fontWeight: "900", letterSpacing: 1 },
  altBtn: { backgroundColor: colors.surfaceTertiary, height: 48, width: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  checkoutBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  checkoutText: { color: colors.onBrand, fontWeight: "900", fontSize: 15, letterSpacing: 0.8 },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.onSurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
});
