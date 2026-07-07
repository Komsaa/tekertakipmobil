import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { setSecure } from "../lib/secureStorage";
import { API_BASE } from "../api/config";
import { LogoIcon } from "../components/Logo";

type Props = {
  onDriverLogin: () => void;
  onManagerLogin: () => void;
  onVeliLogin: () => void;
};

export default function LoginScreen({ onDriverLogin, onManagerLogin, onVeliLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length > 0 && password.trim().length > 0;

  async function handleLogin() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/mobile/unified-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Giriş Hatası", data.error || "Kullanıcı adı veya şifre hatalı");
        return;
      }

      if (data.role === "driver") {
        await setSecure("mobileToken", data.token);
        await setSecure("driverData", JSON.stringify(data.driver));
        onDriverLogin();
      } else if (data.role === "veli") {
        await setSecure("veliToken", data.token);
        await setSecure("veliData", JSON.stringify({ passenger: data.passenger, stop: data.stop, route: data.route }));
        onVeliLogin();
      } else if (data.role === "manager") {
        await setSecure("managerToken", data.token);
        await setSecure("managerUsername", data.username);
        onManagerLogin();
      }
    } catch {
      Alert.alert("Bağlantı Hatası", "Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoGlow}>
              <LogoIcon size={64} color="#fff" />
            </View>
            <Text style={styles.brand}>
              teker<Text style={styles.brandRed}>takip</Text>
            </Text>
            <Text style={styles.tagline}>Servis Yönetim Platformu</Text>
          </View>

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Giriş Yap</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Kullanıcı Adı</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Kullanıcı adınız"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Şifre / PIN</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                keyboardType="number-pad"
              />
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, (!canSubmit || loading) && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.loginBtnText}>Giriş Yap →</Text>
              }
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

  logoArea: { alignItems: "center", marginBottom: 40 },
  logoGlow: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: "rgba(220,38,38,0.12)",
    borderWidth: 1.5, borderColor: "rgba(220,38,38,0.2)",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  brand: { fontSize: 36, fontWeight: "900", color: "#fff", letterSpacing: 2 },
  brandRed: { color: "#DC2626" },
  tagline: { color: "#475569", fontSize: 13, marginTop: 4, letterSpacing: 0.5 },

  card: {
    backgroundColor: "#fff", borderRadius: 24, padding: 28,
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
  },
  cardTitle: { fontSize: 20, fontWeight: "800", color: "#1B2437", marginBottom: 24 },

  field: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: "#94a3b8",
    marginBottom: 8, textTransform: "uppercase", letterSpacing: 1,
  },
  input: {
    borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 14,
    padding: 14, fontSize: 16, color: "#1e293b", backgroundColor: "#f8fafc",
  },
  loginBtn: { backgroundColor: "#DC2626", borderRadius: 14, padding: 17, alignItems: "center", marginTop: 4 },
  loginBtnDisabled: { backgroundColor: "#fca5a5" },
  loginBtnText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },

  footer: { textAlign: "center", color: "#1e3a5f", fontSize: 12, marginTop: 28 },
});
