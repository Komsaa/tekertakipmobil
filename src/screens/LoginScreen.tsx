import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../api/config";

type Props = {
  onDriverLogin: () => void;
  onManagerLogin: () => void;
  onVeliLogin: () => void;
};

export default function LoginScreen({ onDriverLogin, onManagerLogin, onVeliLogin }: Props) {
  const [role, setRole] = useState<"driver" | "manager" | "veli">("driver");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length > 0 && password.trim().length > 0;

  async function handleLogin() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      if (role === "veli") {
        const res = await fetch(`${API_BASE}/api/mobile/veli-auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyCode: username.trim().toUpperCase(), parentPhone: password.trim() }),
        });
        const data = await res.json();
        if (!res.ok) { Alert.alert("Giriş Hatası", data.error || "Bilgiler hatalı"); return; }
        await AsyncStorage.setItem("veliToken", data.token);
        await AsyncStorage.setItem("veliData", JSON.stringify({ passenger: data.passenger, stop: data.stop, route: data.route }));
        onVeliLogin();
        return;
      }

      const endpoint = role === "driver" ? "/api/mobile/auth" : "/api/mobile/manager-auth";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("Giriş Hatası", data.error || "Bilgiler hatalı"); return; }

      if (role === "driver") {
        await AsyncStorage.setItem("mobileToken", data.token);
        await AsyncStorage.setItem("driverData", JSON.stringify(data.driver));
        onDriverLogin();
      } else {
        await AsyncStorage.setItem("managerToken", data.token);
        await AsyncStorage.setItem("managerUsername", data.username);
        onManagerLogin();
      }
    } catch (err: any) {
      Alert.alert("Bağlantı Hatası", String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoArea}>
            <Text style={styles.brand}>teker<Text style={styles.brandRed}>takip</Text></Text>
          </View>

          {/* Rol seçimi */}
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleBtn, role === "driver" && styles.roleBtnActive]}
              onPress={() => { setRole("driver"); setUsername(""); setPassword(""); }}
            >
              <Text style={[styles.roleBtnText, role === "driver" && styles.roleBtnTextActive]}>🚌 Şöför</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, role === "veli" && styles.roleBtnActive]}
              onPress={() => { setRole("veli"); setUsername(""); setPassword(""); }}
            >
              <Text style={[styles.roleBtnText, role === "veli" && styles.roleBtnTextActive]}>👨‍👩‍👧 Veli</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, role === "manager" && styles.roleBtnActive]}
              onPress={() => { setRole("manager"); setUsername(""); setPassword(""); }}
            >
              <Text style={[styles.roleBtnText, role === "manager" && styles.roleBtnTextActive]}>👔 Yönetici</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{role === "veli" ? "İşletme Kodu" : "Kullanıcı Adı"}</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder={role === "veli" ? "MT2024" : role === "driver" ? "mertbudak" : "admin"}
                placeholderTextColor="#94a3b8"
                autoCapitalize={role === "veli" ? "characters" : "none"}
                autoCorrect={false}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{role === "veli" ? "Telefon Numaranız" : "Şifre"}</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={role === "veli" ? "05xx..." : "••••••"}
                placeholderTextColor="#94a3b8"
                secureTextEntry={role !== "veli"}
                keyboardType={role === "veli" ? "phone-pad" : "default"}
              />
            </View>
            {role === "veli" && (
              <Text style={styles.veliHint}>Telefon numaranız servis kaydında kayıtlı olmalıdır.</Text>
            )}

            <TouchableOpacity
              style={[styles.loginBtn, (!canSubmit || loading) && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit || loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
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
  logoArea: { alignItems: "center", marginBottom: 28 },
  brand: { fontSize: 40, fontWeight: "900", color: "#fff", letterSpacing: 2 },
  brandRed: { color: "#DC2626" },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: "#334155", alignItems: "center" },
  roleBtnActive: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  roleBtnText: { color: "#94a3b8", fontWeight: "700", fontSize: 15 },
  roleBtnTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 28, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 },
  input: { borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 12, padding: 14, fontSize: 16, color: "#1e293b", backgroundColor: "#f8fafc" },
  loginBtn: { backgroundColor: "#DC2626", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8 },
  loginBtnDisabled: { backgroundColor: "#fca5a5" },
  loginBtnText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
  footer: { textAlign: "center", color: "#334155", fontSize: 12, marginTop: 32, paddingBottom: 8 },
  veliHint: { fontSize: 12, color: "#94a3b8", marginBottom: 8, textAlign: "center" },
});
