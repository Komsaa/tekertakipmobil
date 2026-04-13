import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { authFetch } from "../api/client";

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
  const [tracking, setTracking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("driverData").then((s) => {
      if (s) setDriver(JSON.parse(s));
    });
  }, []);

  async function sendLocation() {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await authFetch("/api/mobile/location", {
        method: "POST",
        body: JSON.stringify({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        }),
      });
    } catch {
      // sessizce geç — bağlantı yoksa takip sürsün
    }
  }

  async function startTracking() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("İzin Gerekli", "Konum takibi için izin verin.");
      return;
    }
    setTracking(true);
    await sendLocation(); // hemen bir kez gönder
    intervalRef.current = setInterval(sendLocation, 5_000);
  }

  async function stopTracking() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setTracking(false);
    try {
      await authFetch("/api/mobile/location", { method: "DELETE" });
    } catch {/* */}
  }

  // Ekrandan çıkınca takibi durdur
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function handleLogout() {
    Alert.alert("Çıkış", "Oturumu kapatmak istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: async () => {
          await stopTracking();
          await AsyncStorage.multiRemove(["mobileToken", "driverData"]);
          onLogout();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Üst bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Merhaba,</Text>
          <Text style={styles.name}>{driver?.name ?? "..."}</Text>
          {driver?.vehicle && (
            <Text style={styles.plate}>{driver.vehicle.plate}</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      {/* Ana butonlar */}
      <View style={styles.content}>
        {/* Sefer / Yoklama */}
        <TouchableOpacity style={[styles.card, styles.cardSefer]} onPress={onSefer}>
          <Text style={styles.cardIcon}>🚌</Text>
          <Text style={styles.cardTitle}>Sefer Başlat</Text>
          <Text style={styles.cardSub}>Durak durak yoklama tut</Text>
        </TouchableOpacity>

        {/* GPS Takip */}
        <TouchableOpacity
          style={[styles.card, tracking ? styles.cardActive : styles.cardGps]}
          onPress={tracking ? stopTracking : startTracking}
        >
          <Text style={styles.cardIcon}>{tracking ? "📡" : "📍"}</Text>
          <Text style={[styles.cardTitle, tracking && styles.cardTitleActive]}>
            {tracking ? "Konum Takibi Aktif" : "Konum Takibini Başlat"}
          </Text>
          <Text style={[styles.cardSub, tracking && styles.cardSubActive]}>
            {tracking ? "Her 5 saniyede güncelleniyor · Durdurmak için dokun" : "Güzergah başlamadan önce aç"}
          </Text>
          {tracking && (
            <View style={styles.activeDot}>
              <View style={styles.activeDotInner} />
            </View>
          )}
        </TouchableOpacity>

        {/* Yakıt Girişi */}
        <TouchableOpacity style={[styles.card, styles.cardFuel]} onPress={onFuelEntry}>
          <Text style={styles.cardIcon}>⛽</Text>
          <Text style={styles.cardTitle}>Yakıt Girişi</Text>
          <Text style={styles.cardSub}>Fiş fotoğrafı + KM</Text>
        </TouchableOpacity>

        {/* Arıza Bildirimi */}
        <TouchableOpacity style={[styles.card, styles.cardAriza]} onPress={onAriza}>
          <Text style={styles.cardIcon}>🔧</Text>
          <Text style={styles.cardTitle}>Arıza Bildir</Text>
          <Text style={styles.cardSub}>Araçtaki sorunu yöneticiye ilet</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>tekertakip.com</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  topBar: {
    backgroundColor: "#1B2437",
    padding: 24,
    paddingTop: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: { color: "#94a3b8", fontSize: 13 },
  name: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 2 },
  plate: { color: "#DC2626", fontSize: 14, fontWeight: "700", marginTop: 4 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#334155", borderRadius: 8, marginTop: 4 },
  logoutText: { color: "#94a3b8", fontSize: 13 },
  content: { flex: 1, padding: 24, gap: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  cardSefer: { borderWidth: 2, borderColor: "#bfdbfe" },
  cardGps: { borderWidth: 2, borderColor: "#e2e8f0" },
  cardActive: { backgroundColor: "#052e16", borderWidth: 2, borderColor: "#16a34a" },
  cardFuel: { borderWidth: 2, borderColor: "#fecaca" },
  cardAriza: { borderWidth: 2, borderColor: "#fed7aa" },
  cardIcon: { fontSize: 48, marginBottom: 12 },
  cardTitle: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  cardTitleActive: { color: "#fff" },
  cardSub: { fontSize: 13, color: "#94a3b8", marginTop: 4, textAlign: "center" },
  cardSubActive: { color: "#86efac" },
  activeDot: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(22,163,74,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },
  footer: { textAlign: "center", color: "#94a3b8", fontSize: 12, paddingBottom: 16 },
});
