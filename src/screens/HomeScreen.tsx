import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ScrollView,
} from "react-native";
import { getSecure, deleteSecureMany } from "../lib/secureStorage";
import { authFetch } from "../api/client";
import { LogoIcon } from "../components/Logo";

type Driver = {
  id: string;
  name: string;
  vehicle: { id: string; plate: string } | null;
};

type Props = {
  onLogout: () => void;
  onFuelEntry: () => void;
  onAriza: () => void;
  onSefer: () => void;
};

export default function HomeScreen({ onLogout, onFuelEntry, onAriza, onSefer }: Props) {
  const [driver, setDriver] = useState<Driver | null>(null);

  useEffect(() => {
    getSecure("driverData").then((s) => {
      if (s) setDriver(JSON.parse(s));
    });
  }, []);

  async function handleLogout() {
    Alert.alert("Çıkış", "Oturumu kapatmak istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap", style: "destructive",
        onPress: async () => {
          await deleteSecureMany(["mobileToken", "driverData"]);
          onLogout();
        },
      },
    ]);
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Hesabı Sil",
      "Mobil erişiminiz kalıcı olarak silinecek. Yöneticiniz size yeni giriş bilgisi vermeden uygulamayı kullanamazsınız. Devam edilsin mi?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Hesabı Sil", style: "destructive",
          onPress: async () => {
            await stopTracking();
            await authFetch("/api/mobile/account/delete?role=driver", { method: "DELETE" });
            await deleteSecureMany(["mobileToken", "driverData"]);
            onLogout();
          },
        },
      ]
    );
  }

  const initials = driver?.name
    ? driver.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LogoIcon size={36} color="#fff" />
          <Text style={styles.headerBrand}>teker<Text style={styles.headerBrandRed}>takip</Text></Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Şöför kartı */}
        <View style={styles.driverCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverGreeting}>Merhaba,</Text>
            <Text style={styles.driverName}>{driver?.name ?? "..."}</Text>
            {driver?.vehicle && (
              <View style={styles.plateBadge}>
                <Text style={styles.plateText}>{driver.vehicle.plate}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Sefer Başlat — hero buton */}
        <TouchableOpacity style={styles.seferHero} onPress={onSefer} activeOpacity={0.88}>
          <Text style={styles.seferHeroIcon}>🚌</Text>
          <Text style={styles.seferHeroTitle}>Sefer Başlat</Text>
          <Text style={styles.seferHeroSub}>Durak yoklama ve navigasyon</Text>
        </TouchableOpacity>

        {/* İkincil butonlar */}
        <Text style={styles.sectionLabel}>DİĞER İŞLEMLER</Text>
        <View style={styles.grid}>

          <TouchableOpacity style={[styles.actionCard, styles.actionFuel]} onPress={onFuelEntry} activeOpacity={0.85}>
            <View style={styles.actionIconWrap}>
              <Text style={styles.actionIcon}>⛽</Text>
            </View>
            <Text style={styles.actionTitle}>Yakıt Girişi</Text>
            <Text style={styles.actionSub}>Fiş + KM</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, styles.actionAriza]} onPress={onAriza} activeOpacity={0.85}>
            <View style={styles.actionIconWrap}>
              <Text style={styles.actionIcon}>🔧</Text>
            </View>
            <Text style={styles.actionTitle}>Arıza Bildir</Text>
            <Text style={styles.actionSub}>Yöneticiye ilet</Text>
          </TouchableOpacity>

        </View>

        <TouchableOpacity onPress={handleDeleteAccount} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Hesabı Sil</Text>
        </TouchableOpacity>

      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  header: {
    backgroundColor: "#1B2437",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerBrand: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  headerBrandRed: { color: "#DC2626" },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#334155", borderRadius: 8 },
  logoutText: { color: "#94a3b8", fontSize: 13 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },

  driverCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 18,
    flexDirection: "row", alignItems: "center", gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#1B2437", alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  driverGreeting: { color: "#94a3b8", fontSize: 12 },
  driverName: { color: "#1B2437", fontWeight: "800", fontSize: 18, marginTop: 1 },
  plateBadge: {
    marginTop: 6, alignSelf: "flex-start",
    backgroundColor: "#DC2626", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  plateText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 1 },

  seferHero: {
    backgroundColor: "#DC2626",
    borderRadius: 24, padding: 32,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#DC2626", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
    minHeight: 180,
  },
  seferHeroIcon: { fontSize: 56, marginBottom: 12 },
  seferHeroTitle: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: 0.5 },
  seferHeroSub: { color: "rgba(255,255,255,0.75)", fontSize: 14, marginTop: 6 },

  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#94a3b8", letterSpacing: 1.5, marginBottom: -4 },

  grid: { flexDirection: "row", gap: 12 },
  actionCard: {
    flex: 1, borderRadius: 20, padding: 18,
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  actionFuel:  { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#fecaca" },
  actionAriza: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#fed7aa" },
  actionIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
  },
  actionIcon: { fontSize: 26 },
  actionTitle: { fontSize: 13, fontWeight: "800", color: "#1e293b", textAlign: "center" },
  actionSub:   { fontSize: 11, color: "#94a3b8", marginTop: 3, textAlign: "center" },
  deleteBtn: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  deleteBtnText: { color: "#94a3b8", fontSize: 12, textDecorationLine: "underline" },
});
