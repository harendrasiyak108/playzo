import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuth } from "@/src/contexts/AuthContext";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "@/src/theme";

export function UserBadge() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) {
    return (
      <Pressable onPress={() => router.push('/login')} style={{ padding: 6 }}>
        <Text style={{ color: colors.brand, fontWeight: '700' }}>Sign in</Text>
      </Pressable>
    );
  }
  const initials = (user.name || user.email || "U").split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => router.push('/profile')} style={styles.badge}>
        <Text style={styles.initials}>{initials}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/profile')} style={{ marginLeft: 8 }}>
        <Text style={styles.name}>{user.name || user.email}</Text>
      </Pressable>
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
