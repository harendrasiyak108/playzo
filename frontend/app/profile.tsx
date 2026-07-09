import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useAuth } from "@/src/contexts/AuthContext";
import { api } from "@/src/api";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
  }, [user]);

  const save = async () => {
    setLoading(true);
    try {
      const updated = await api.updateMe({ name: name || undefined, email: email || undefined });
      await setUser(updated);
      Alert.alert("Saved", "Profile updated");
    } catch (e: any) {
      Alert.alert("Save failed", e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Not signed in</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/login')}>
          <Text style={styles.buttonText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TouchableOpacity style={styles.button} onPress={save} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, { backgroundColor: '#333' }]} onPress={async () => { await logout(); router.replace('/login'); }}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#0F0F11' },
  title: { color: '#fff', fontSize: 24, marginBottom: 20 },
  input: { backgroundColor: '#111', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 },
  button: { backgroundColor: '#1E90FF', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
