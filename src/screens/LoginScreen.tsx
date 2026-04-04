import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../api/config";

type Props = {
  onLogin: () => void;
};

export default function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  async function handleLogin() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/mobile/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Giriş Hatası", data.error || "Bilgiler hatalı");
        return;
      }
      await AsyncStorage.setItem("mobileToken", data.token);
      await AsyncStorage.setItem("driverData", JSON.stringify(data.driver));
      onLogin();
    } catch {
      Alert.alert("Bağlantı Hatası", "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoArea}>
            <Text style={styles.brand}>
              {"teker"}<Text style={styles.brandRed}>{"takip"}</Text>
            </Text>
            <Text style={styles.tagline}>Şöför Girişi</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Kullanıcı Adı</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="mertbudak"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Şifre</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, (!canSubmit || loading) && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginBtnText}>Giriş Yap</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>tekertakip.com</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1B2437" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoArea: { alignItems: "center", marginBottom: 36 },
  brand: { fontSize: 40, fontWeight: "900", color: "#fff", letterSpacing: 2 },
  brandRed: { color: "#DC2626" },
  tagline: { fontSize: 14, color: "#94a3b8", marginTop: 6, letterSpacing: 1 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 },
  input: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#1e293b",
    backgroundColor: "#f8fafc",
  },
  loginBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  loginBtnDisabled: { backgroundColor: "#fca5a5" },
  loginBtnText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
  footer: { textAlign: "center", color: "#334155", fontSize: 12, marginTop: 32, paddingBottom: 8 },
});
