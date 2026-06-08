import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, Platform, Modal,
} from "react-native";
import { WebView } from "react-native-webview";
import { LogoIcon } from "../components/Logo";
import { getSecure, deleteSecureMany } from "../lib/secureStorage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { authFetch } from "../api/client";
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
  const [mapVisible, setMapVisible] = useState(false);
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

  // Push token kaydet
  useEffect(() => {
    registerPushToken();
  }, []);

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
    const veliToken = await getSecure("veliToken");
    if (!veliToken) return;
    fetch(`${API_BASE}/api/mobile/veli/push-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${veliToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pushToken: token }),
    }).catch(() => {});
  }

  async function handleLogout() {
    Alert.alert("Çıkış", "Oturumu kapatmak istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap", style: "destructive",
        onPress: async () => {
          await deleteSecureMany(["veliToken", "veliData"]);
          onLogout();
        },
      },
    ]);
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Hesabı Sil",
      "Servis takip erişiminiz silinecek. Yöneticinizden yeni giriş bilgisi almanız gerekecek. Devam edilsin mi?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Hesabı Sil", style: "destructive",
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
        <ActivityIndicator size="large" color="#DC2626" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!status) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
          <Text style={{ color: "#64748b", fontSize: 15 }}>Durum alınamadı</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchStatus}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { statusType, statusMessage, showLocation, minutesToPickup, missedBoarding, myAttendanceStatus } = status;

  const statusColors = {
    waiting:  { bg: "#1e293b", text: "#94a3b8", icon: "🕐" },
    enroute:  { bg: "#1d4ed8", text: "#bfdbfe", icon: "🚌" },
    arrived:  { bg: "#15803d", text: "#bbf7d0", icon: "✅" },
    passed:   { bg: "#374151", text: "#9ca3af", icon: "✓" },
    missed:   { bg: "#7f1d1d", text: "#fca5a5", icon: "🚨" },
  };
  const sc = statusColors[statusType];
  const stopsAway = status.myStop.order - 1 - status.currentStopIndex;

  return (
    <SafeAreaView style={styles.container}>
      {/* Üst bar */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerBrandRow}>
            <LogoIcon size={22} color="#fff" />
            <Text style={styles.headerBrand}>teker<Text style={styles.headerBrandRed}>takip</Text></Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Çıkış</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.routeName}>{status.route.name}</Text>
        <Text style={styles.passengerName}>{status.passenger.name}</Text>
      </View>

      <View style={styles.content}>

        {/* 🔴 Durak geçildi, binmedi uyarısı */}
        {missedBoarding && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertIcon}>🚨</Text>
            <Text style={styles.alertText}>Durağınız geçildi — {status.passenger.name} servise binmedi!</Text>
          </View>
        )}

        {/* ✅ Bindi bildirimi */}
        {myAttendanceStatus === "boarded" && (
          <View style={styles.boardedBanner}>
            <Text style={styles.alertIcon}>✅</Text>
            <Text style={styles.boardedText}>{status.passenger.name} servise bindi</Text>
          </View>
        )}

        {/* Ana durum kartı */}
        <View style={[styles.statusCard, { backgroundColor: sc.bg }]}>
          <Text style={styles.statusIcon}>{sc.icon}</Text>
          <Text style={[styles.statusMessage, { color: sc.text }]}>{statusMessage}</Text>
          {minutesToPickup !== null && minutesToPickup > 0 && (
            <Text style={[styles.statusSub, { color: sc.text }]}>
              ≈ {minutesToPickup} dakika içinde durağınızda
            </Text>
          )}
          {statusType === "enroute" && stopsAway > 0 && minutesToPickup === null && (
            <Text style={[styles.statusSub, { color: sc.text }]}>
              {stopsAway} durak sonra sizin durak
            </Text>
          )}
        </View>

        {/* Konum penceresi kapalıysa bilgi */}
        {!showLocation && (
          <View style={styles.noLocationCard}>
            <Text style={styles.noLocationText}>
              🕐 Servis saatine yakın konum gösterimi aktif olacak
            </Text>
          </View>
        )}

        {/* Durak bilgisi */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📍 Durağınız</Text>
            <View style={styles.infoValueBox}>
              <Text style={styles.infoValue}>{status.myStop.name}</Text>
              <Text style={styles.infoTime}>{status.myStop.estimatedTime}</Text>
            </View>
          </View>
          {status.seferStarted && status.currentStop && (
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: "#f1f5f9", marginTop: 12, paddingTop: 12 }]}>
              <Text style={styles.infoLabel}>🚌 Şu an</Text>
              <View style={styles.infoValueBox}>
                <Text style={styles.infoValue}>{status.currentStop.name}</Text>
                <Text style={styles.infoTime}>{status.currentStop.estimatedTime}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Güzergah ilerleme */}
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Güzergah İlerlemesi</Text>
          <View style={styles.progressTrack}>
            {Array.from({ length: status.route.totalStops }).map((_, i) => {
              const myIdx = status.myStop.order - 1;
              const done = i < status.currentStopIndex;
              const current = i === status.currentStopIndex && status.seferStarted;
              const isMyStop = i === myIdx;
              return (
                <View key={i} style={[
                  styles.progressDot,
                  done && styles.dotDone,
                  current && styles.dotCurrent,
                  isMyStop && (missedBoarding ? styles.dotMissed : styles.dotMine),
                ]} />
              );
            })}
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabelText}>Başlangıç</Text>
            <Text style={[styles.progressLabelText, { color: missedBoarding ? "#DC2626" : "#DC2626", fontWeight: "700" }]}>
              {missedBoarding ? "⚠ " : "★ "}Durağınız ({status.myStop.order}. durak)
            </Text>
            <Text style={styles.progressLabelText}>Bitiş</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={fetchStatus}>
          <Text style={styles.refreshText}>↻ Yenile</Text>
        </TouchableOpacity>

        {status?.seferStarted && status?.driverLocation?.isTracking && veliToken && (
          <TouchableOpacity style={styles.mapBtn} onPress={() => setMapVisible(true)}>
            <Text style={styles.mapBtnText}>🗺  Canlı Haritada Gör</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleDeleteAccount} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Hesabı Sil</Text>
        </TouchableOpacity>

        {status.driverLocation?.isTracking && showLocation && (
          <Text style={styles.trackingNote}>● GPS takibi aktif</Text>
        )}
      </View>

      {/* Canlı Harita Modal */}
      <Modal visible={mapVisible} animationType="slide" onRequestClose={() => setMapVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#1B2437" }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Canlı Harita</Text>
            <TouchableOpacity onPress={() => setMapVisible(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕ Kapat</Text>
            </TouchableOpacity>
          </View>
          {veliToken && (
            <WebView
              source={{ uri: `${API_BASE}/sefer-harita?token=${encodeURIComponent(veliToken)}` }}
              style={{ flex: 1 }}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webviewLoading}>
                  <ActivityIndicator size="large" color="#DC2626" />
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { backgroundColor: "#1B2437", padding: 20, paddingTop: 24 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerBrandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBrand: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  headerBrandRed: { color: "#DC2626" },
  routeName: { color: "#94a3b8", fontSize: 12, marginBottom: 2 },
  passengerName: { color: "#fff", fontSize: 22, fontWeight: "800" },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#334155", borderRadius: 8 },
  logoutText: { color: "#94a3b8", fontSize: 13 },

  content: { flex: 1, padding: 16, gap: 12 },

  statusCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginTop: 4,
  },
  statusIcon: { fontSize: 52, marginBottom: 10 },
  statusMessage: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  statusSub: { fontSize: 14, marginTop: 6, textAlign: "center", opacity: 0.8 },

  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoLabel: { fontSize: 14, color: "#64748b", fontWeight: "600" },
  infoValueBox: { alignItems: "flex-end" },
  infoValue: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  infoTime: { fontSize: 13, color: "#DC2626", fontWeight: "700", marginTop: 2 },

  progressCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  progressLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 10 },
  progressTrack: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  progressDot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#e2e8f0", minWidth: 12, maxWidth: 32 },
  dotDone: { backgroundColor: "#16a34a" },
  dotCurrent: { backgroundColor: "#2563eb" },
  dotMine: { backgroundColor: "#DC2626" },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  progressLabelText: { fontSize: 11, color: "#94a3b8" },

  refreshBtn: {
    backgroundColor: "#1B2437",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  refreshText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  trackingNote: { textAlign: "center", color: "#16a34a", fontSize: 12 },

  alertBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#DC2626",
    borderRadius: 14, padding: 14,
  },
  alertIcon: { fontSize: 20 },
  alertText: { flex: 1, color: "#DC2626", fontWeight: "700", fontSize: 14, lineHeight: 20 },

  boardedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f0fdf4", borderWidth: 1.5, borderColor: "#16a34a",
    borderRadius: 14, padding: 14,
  },
  boardedText: { flex: 1, color: "#15803d", fontWeight: "700", fontSize: 14 },

  noLocationCard: {
    backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0",
    borderRadius: 12, padding: 12, alignItems: "center",
  },
  noLocationText: { color: "#64748b", fontSize: 13, textAlign: "center" },

  dotMissed: { backgroundColor: "#f97316" },

  retryBtn: { backgroundColor: "#1B2437", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },

  mapBtn: {
    backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginTop: 4,
  },
  mapBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  modalHeader: {
    backgroundColor: "#1B2437", flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12,
  },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  modalClose: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#334155", borderRadius: 8 },
  modalCloseText: { color: "#94a3b8", fontSize: 13 },
  webviewLoading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  deleteBtn: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  deleteBtnText: { color: "#94a3b8", fontSize: 12, textDecorationLine: "underline" },
});
