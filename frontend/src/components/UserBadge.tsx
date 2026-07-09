import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

export function UserBadge() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = (user.name || user.email || "U").split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={{ marginLeft: 8 }}>
        <Text style={styles.name}>{user.name || user.email}</Text>
      </View>
      <Pressable onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center" },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  initials: { color: colors.onSurface, fontWeight: "900" },
  name: { color: colors.onSurface, fontSize: 12 },
  logout: { marginLeft: spacing.sm, padding: 6 },
  logoutText: { color: colors.brand, fontSize: 12, fontWeight: "700" },
});
