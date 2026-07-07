import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { LogoIcon } from "../components/Logo";
import { getSecure, deleteSecureMany } from "../lib/secureStorage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { API_BASE } from "../api/config";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Status = {
  passenger: { id: string; name: string };
  myStop: { name: string; estimatedTime: string; order: number };
  route: { name: string; totalStops: number };
  currentStopIndex: number;
  currentStop: { name: string; estimatedTime: string } | null;
  driverLocation: { lat: number | null; lng: number | null; isTracking: boolean } | null;
  seferStarted: boolean;
  statusMessage: string;
  statusType: "waiting" | "enroute" | "arrived" | "passed" | "missed";
  showLocation: boolean;
  minutesToPickup: number | null;
  missedBoarding: boolean;
  myAttendanceStatus: "boarded" | "absent" | null;
};

type Props = { onLogout: () => void };

export default function VeliHomeScreen({ onLogout }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [veliToken, setVeliToken] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const token = await getSecure("veliToken");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/mobile/veli/status`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) setStatus(await res.json());
    } catch { /* sessiz */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 30_000);
    getSecure("veliToken").then(setVeliToken);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStatus]);

  useEffect(() => { registerPushToken(); }, []);

  async function registerPushToken() {
    if (!Device.isDevice) return;
    const { status: perm } = await Notifications.requestPermissionsAsync();
    if (perm !== "granted") return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default", importance: Notifications.AndroidImportance.MAX,
      });
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: "a59269a7-9936-4592-8720-e20c0b305ce8" })).data;
    const vt = await getSecure("veliToken");
    if (!vt) return;
    fetch(`${API_BASE}/api/mobile/veli/push-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pushToken: token }),
    }).catch(() => {});
  }

  async function handleLogout() {
    Alert.alert("Cikis", "Oturumu kapatmak istiyor musunuz?", [
      { text: "Iptal", style: "cancel" },
      {
        text: "Cikis Yap", style: "destructive",
        onPress: async () => {
          await deleteSecureMany(["veliToken", "veliData"]);
          onLogout();
        },
      },
    ]);
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Hesabi Sil",
      "Servis takip eriisiminiz silinecek. Yoneticinizden yeni giris bilgisi almaniz gerekecek. Devam edilsin mi?",
      [
        { text: "Vazgec", style: "cancel" },
        {
          text: "Hesabi Sil", style: "destructive",
          onPress: async () => {
            const token = await getSecure("veliToken");
            if (token) {
              await fetch(`${API_BASE}/api/mobile/account/delete?role=veli`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              }).catch(() => {});
            }
            await deleteSecureMany(["veliToken", "veliData"]);
            onLogout();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Yukleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!status) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerBrandRow}>
            <LogoIcon size={20} color="#fff" />
            <Text style={styles.headerBrand}>teker<Text style={styles.headerBrandRed}>takip</Text></Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Cikis</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
          <Text style={{ color: "#64748b", fontSize: 15 }}>Durum alinamadi</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchStatus}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { statusType, statusMessage, minutesToPickup, missedBoarding, myAttendanceStatus } = status;

  const statusConfig = {
    waiting: { bg: "#1e293b", text: "#94a3b8", border: "#334155", icon: "SS", label: "Bekliyor" },
    enroute: { bg: "#1e3a8a", text: "#bfdbfe", border: "#2563eb", icon: ">>", label: "Yolda" },
    arrived: { bg: "#14532d", text: "#bbf7d0", border: "#16a34a", icon: "OK", label: "Duraginizda" },
    passed:  { bg: "#1e293b", text: "#94a3b8", border: "#475569", icon: "V",  label: "Gecti" },
    missed:  { bg: "#7f1d1d", text: "#fca5a5", border: "#DC2626", icon: "!!", label: "Binmedi" },
  };
  const sc = statusConfig[statusType];

  const mapUri = veliToken
    ? `${API_BASE}/sefer-harita?token=${encodeURIComponent(veliToken)}`
    : null;

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerBrandRow}>
            <LogoIcon size={18} color="#fff" />
            <Text style={styles.headerBrand}>teker<Text style={styles.headerBrandRed}>takip</Text></Text>
          </View>
          <Text style={styles.routeLabel}>{status.route.name}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Cikis</Text>
        </TouchableOpacity>
      </View>

      {/* Cocuk adi banner */}
      <View style={styles.childBanner}>
        <View style={styles.childAvatarBox}>
          <Text style={styles.childAvatarText}>
            {status.passenger.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.childInfo}>
          <Text style={styles.childName}>{status.passenger.name}</Text>
          <Text style={styles.childStopLabel}>
            {status.myStop.order}. durak  •  {status.myStop.estimatedTime}
          </Text>
        </View>
        {/* Durum badge */}
        <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <Text style={[styles.statusBadgeText, { color: sc.text }]}>{sc.label}</Text>
        </View>
      </View>

      {/* Uyari bantlari */}
      {missedBoarding && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>Duraginiz gecildi — {status.passenger.name} servise binmedi!</Text>
        </View>
      )}
      {myAttendanceStatus === "boarded" && (
        <View style={styles.boardedBanner}>
          <Text style={styles.boardedText}>{status.passenger.name} servise bindi</Text>
        </View>
      )}

      {/* Harita — her zaman gorunur */}
      <View style={styles.mapContainer}>
        {mapUri ? (
          <WebView
            source={{ uri: mapUri }}
            style={styles.map}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color="#DC2626" />
                <Text style={styles.mapLoadingText}>Harita yukleniyor...</Text>
              </View>
            )}
          />
        ) : (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color="#DC2626" />
          </View>
        )}

        {/* Sefer durumu overlay — sol ust kose */}
        <View style={[styles.mapOverlay, { borderColor: sc.border, backgroundColor: sc.bg + "ee" }]}>
          <Text style={[styles.mapOverlayText, { color: sc.text }]}>{statusMessage}</Text>
          {minutesToPickup !== null && minutesToPickup > 0 && statusType === "enroute" && (
            <Text style={[styles.mapOverlaySub, { color: sc.text }]}>≈ {minutesToPickup} dk</Text>
          )}
        </View>

        {/* GPS aktif dot */}
        {status.driverLocation?.isTracking && (
          <View style={styles.gpsIndicator}>
            <View style={styles.gpsDot} />
            <Text style={styles.gpsText}>Canli GPS</Text>
          </View>
        )}
      </View>

      {/* Alt panel */}
      <View style={styles.bottomPanel}>
        {/* Durak bilgisi */}
        <View style={styles.stopRow}>
          <View style={styles.stopLeft}>
            <Text style={styles.stopLabel}>Duraginiz</Text>
            <Text style={styles.stopName} numberOfLines={1}>{status.myStop.name}</Text>
          </View>
          <View style={styles.stopTimeBox}>
            <Text style={styles.stopTime}>{status.myStop.estimatedTime}</Text>
          </View>
        </View>

        {/* Sefer aktifse su anki durak */}
        {status.seferStarted && status.currentStop && (
          <View style={[styles.stopRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" }]}>
            <View style={styles.stopLeft}>
              <Text style={styles.stopLabel}>Arac simdi</Text>
              <Text style={styles.stopName} numberOfLines={1}>{status.currentStop.name}</Text>
            </View>
            <View style={[styles.stopTimeBox, { backgroundColor: "#eff6ff" }]}>
              <Text style={[styles.stopTime, { color: "#2563eb" }]}>{status.currentStop.estimatedTime}</Text>
            </View>
          </View>
        )}

        {/* Yenile */}
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchStatus}>
          <Text style={styles.refreshText}>Yenile</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleDeleteAccount} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Hesabi Sil</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1B2437" },

  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#64748b", fontSize: 14 },

  /* Header */
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  headerLeft: { gap: 2 },
  headerBrandRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerBrand: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 1 },
  headerBrandRed: { color: "#DC2626" },
  routeLabel: { color: "#475569", fontSize: 11, marginLeft: 1 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#334155", borderRadius: 8 },
  logoutText: { color: "#64748b", fontSize: 12 },

  /* Cocuk banner */
  childBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111827", paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#1e293b",
  },
  childAvatarBox: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center",
  },
  childAvatarText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  childInfo: { flex: 1 },
  childName: { color: "#fff", fontSize: 18, fontWeight: "800" },
  childStopLabel: { color: "#475569", fontSize: 12, marginTop: 1 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },

  /* Uyari bantlari */
  alertBanner: {
    backgroundColor: "#FEF2F2", borderLeftWidth: 3, borderLeftColor: "#DC2626",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  alertText: { color: "#DC2626", fontWeight: "700", fontSize: 13 },
  boardedBanner: {
    backgroundColor: "#f0fdf4", borderLeftWidth: 3, borderLeftColor: "#16a34a",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  boardedText: { color: "#15803d", fontWeight: "700", fontSize: 13 },

  /* Harita */
  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1 },
  mapLoading: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a", gap: 10,
  },
  mapLoadingText: { color: "#475569", fontSize: 13 },

  mapOverlay: {
    position: "absolute", top: 10, left: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 12, borderWidth: 1,
  },
  mapOverlayText: { fontSize: 12, fontWeight: "700" },
  mapOverlaySub: { fontSize: 11, marginTop: 1, opacity: 0.85 },

  gpsIndicator: {
    position: "absolute", top: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#14532dee", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: "#16a34a",
  },
  gpsDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ade80" },
  gpsText: { color: "#bbf7d0", fontSize: 11, fontWeight: "700" },

  /* Alt panel */
  bottomPanel: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
  },

  stopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stopLeft: { flex: 1, marginRight: 12 },
  stopLabel: { fontSize: 11, color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  stopName: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginTop: 2 },
  stopTimeBox: {
    backgroundColor: "#fef2f2", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
  },
  stopTime: { fontSize: 16, fontWeight: "900", color: "#DC2626" },

  refreshBtn: {
    backgroundColor: "#1B2437", borderRadius: 12, paddingVertical: 13,
    alignItems: "center", marginTop: 14,
  },
  refreshText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  deleteBtn: { alignItems: "center", paddingVertical: 10 },
  deleteBtnText: { color: "#cbd5e1", fontSize: 12, textDecorationLine: "underline" },

  retryBtn: { backgroundColor: "#1B2437", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
});
