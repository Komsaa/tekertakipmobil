import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, Vibration, Linking, Platform,
} from "react-native";
import { authFetch } from "../api/client";

type Passenger = {
  id: string;
  name: string;
  phone: string | null;
  attendances: { status: string }[];
};

type Stop = {
  id: string;
  name: string;
  estimatedTime: string;
  order: number;
  lat: number | null;
  lng: number | null;
  passengers: Passenger[];
};

type Route = {
  id: string;
  name: string;
  stops: Stop[];
};

type Props = {
  onBack: () => void;
};

export default function SeferScreen({ onBack }: Props) {
  const [route, setRoute] = useState<Route | null>(null);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stopIndex, setStopIndex] = useState(0);

  // Sadece "boarded" set — tıklanmayan = otomatik absent (Devam'da sunucuya gönderilir)
  const [boarded, setBoarded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchRoute = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/mobile/sefer");
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Hata"); setLoading(false); return; }
      setRoute(data.route);
      setToday(data.today);
      // Önceden kaydedilmiş "boarded" yoklamaları yükle
      const pre = new Set<string>();
      for (const stop of data.route.stops) {
        for (const p of stop.passengers) {
          if (p.attendances[0]?.status === "boarded") pre.add(p.id);
        }
      }
      setBoarded(pre);
    } catch {
      setError("Bağlantı hatası");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  function toggleBoarded(passengerId: string) {
    Vibration.vibrate(40);
    setBoarded((prev) => {
      const next = new Set(prev);
      if (next.has(passengerId)) next.delete(passengerId);
      else next.add(passengerId);
      return next;
    });
  }

  async function openNavigation(stop: Stop) {
    const hasCoords = stop.lat && stop.lng;

    // 1) Yandex Navigator — Türkiye'de en yaygın navigasyon
    if (hasCoords) {
      const yandexNavi = `yandexnavi://build_route_on_map?lat_to=${stop.lat}&lon_to=${stop.lng}`;
      if (await Linking.canOpenURL(yandexNavi)) {
        Linking.openURL(yandexNavi);
        return;
      }
      // 2) Yandex Haritalar (Navi kurulu değilse)
      const yandexMaps = `yandexmaps://maps.yandex.ru/?rtext=~${stop.lat},${stop.lng}&rtt=auto`;
      if (await Linking.canOpenURL(yandexMaps)) {
        Linking.openURL(yandexMaps);
        return;
      }
    }

    // 3) Google Maps — koordinatlı veya isimle
    if (hasCoords) {
      const gmapNavi = Platform.OS === "ios"
        ? `maps://?ll=${stop.lat},${stop.lng}&q=${encodeURIComponent(stop.name)}`
        : `google.navigation:q=${stop.lat},${stop.lng}`;
      if (await Linking.canOpenURL(gmapNavi)) {
        Linking.openURL(gmapNavi);
        return;
      }
    }

    // 4) Web fallback (hiçbir uygulama kurulu değilse)
    const dest = hasCoords
      ? `${stop.lat},${stop.lng}`
      : encodeURIComponent(stop.name);
    Linking.openURL(
      `https://yandex.com.tr/maps/?rtext=~${dest}&rtt=auto`
    );
  }

  async function handleDevam() {
    if (!route) return;
    const stop = route.stops[stopIndex];
    const isLast = stopIndex === route.stops.length - 1;
    const nextStop = !isLast ? route.stops[stopIndex + 1] : null;

    // Kaç kişi işaretlenmedi?
    const unmarked = stop.passengers.filter((p) => !boarded.has(p.id));
    if (unmarked.length > 0) {
      const names = unmarked.map((p) => p.name.split(" ")[0]).join(", ");
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Emin misin?",
          `${names} ${unmarked.length === 1 ? "işaretlenmedi" : "işaretlenmedi"} — gelmedi sayılacak.`,
          [
            { text: "Geri Dön", style: "cancel", onPress: () => resolve(false) },
            { text: "Devam Et", style: "destructive", onPress: () => resolve(true) },
          ]
        );
      });
      if (!confirmed) return;
    }

    setSaving(true);
    const attendances = stop.passengers.map((p) => ({
      passengerId: p.id,
      status: boarded.has(p.id) ? "boarded" : "absent",
    }));
    try {
      await authFetch("/api/mobile/sefer/attendance", {
        method: "POST",
        body: JSON.stringify({
          routeId: route.id,
          date: today,
          attendances,
          isFirst: stopIndex === 0,
          nextStopId: nextStop?.id ?? null,
        }),
      });
    } catch { /* offline — devam et */ }
    setSaving(false);

    if (!isLast) {
      setStopIndex((i) => i + 1);
    } else {
      Alert.alert("Sefer Tamamlandı ✓", "Tüm duraklar geçildi.", [
        { text: "Ana Ekran", onPress: onBack },
      ]);
    }
  }

  function goBack() {
    if (stopIndex > 0) setStopIndex((i) => i - 1);
    else onBack();
  }

  // ─── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#DC2626" style={{ marginTop: 80 }} />
        <Text style={styles.loadingText}>Güzergah yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  if (error || !route) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error || "Güzergah bulunamadı"}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRoute}>
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={onBack}>
            <Text style={styles.backLinkText}>← Geri</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main UI ───────────────────────────────────────────────────────────────

  const stop = route.stops[stopIndex];
  const totalStops = route.stops.length;
  const isLast = stopIndex === totalStops - 1;
  const boardedCount = stop.passengers.filter((p) => boarded.has(p.id)).length;
  const totalCount = stop.passengers.length;

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Üst bar ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
          <Text style={styles.stopCounter}>{stopIndex + 1}. durak / {totalStops}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* ── İlerleme çubuğu ── */}
      <View style={styles.progressBar}>
        {route.stops.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              i < stopIndex && styles.progressDone,
              i === stopIndex && styles.progressCurrent,
            ]}
          />
        ))}
      </View>

      {/* ── Durak kartı ── */}
      <View style={styles.stopCard}>
        <Text style={styles.stopTime}>{stop.estimatedTime}</Text>
        <Text style={styles.stopName}>{stop.name}</Text>

        {/* Navigasyon butonu */}
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => openNavigation(stop)}
          activeOpacity={0.75}
        >
          <Text style={styles.navBtnIcon}>🧭</Text>
          <Text style={styles.navBtnText}>Navigasyonu Aç</Text>
        </TouchableOpacity>

        {totalCount > 0 ? (
          <View style={styles.stopBadgeRow}>
            <View style={[styles.badge, styles.badgeGreen]}>
              <Text style={styles.badgeText}>✓ {boardedCount} bindi</Text>
            </View>
            {totalCount - boardedCount > 0 && (
              <View style={[styles.badge, styles.badgeGrey]}>
                <Text style={styles.badgeTextGrey}>{totalCount - boardedCount} işaretlenmedi</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.noPassText}>Bu durağa yolcu yok</Text>
        )}
      </View>

      {/* ── Yolcu listesi ── */}
      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 12 }}>
        {totalCount === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🚏</Text>
            <Text style={styles.emptyText}>Yolcu kaydedilmemiş.</Text>
            <Text style={styles.emptyHint}>Devam et butonuna bas.</Text>
          </View>
        ) : (
          stop.passengers.map((p) => {
            const isBoarded = boarded.has(p.id);
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.passengerRow, isBoarded && styles.passengerRowBoarded]}
                onPress={() => toggleBoarded(p.id)}
                activeOpacity={0.65}
              >
                {/* Sol ikon */}
                <View style={[styles.checkCircle, isBoarded && styles.checkCircleBoarded]}>
                  {isBoarded
                    ? <Text style={styles.checkMark}>✓</Text>
                    : <Text style={styles.checkMarkEmpty}>—</Text>
                  }
                </View>

                {/* İsim */}
                <Text style={[styles.passengerName, isBoarded && styles.passengerNameBoarded]}>
                  {p.name}
                </Text>

                {/* Sağ durum etiketi */}
                {isBoarded
                  ? <View style={styles.pillGreen}><Text style={styles.pillTextGreen}>Bindi</Text></View>
                  : <View style={styles.pillGrey}><Text style={styles.pillTextGrey}>Bekliyor</Text></View>
                }
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── Alt buton ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.devamBtn, saving && styles.devamBtnDisabled]}
          onPress={handleDevam}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="large" />
            : (
              <Text style={styles.devamBtnText}>
                {isLast ? "Seferi Tamamla ✓" : `Sonraki Durak →`}
              </Text>
            )
          }
        </TouchableOpacity>
        {!isLast && route.stops[stopIndex + 1] && (
          <TouchableOpacity
            style={styles.nextStopRow}
            onPress={() => openNavigation(route.stops[stopIndex + 1])}
            activeOpacity={0.7}
          >
            <Text style={styles.nextStopHint}>
              Sıradaki: {route.stops[stopIndex + 1].name} · {route.stops[stopIndex + 1].estimatedTime}
            </Text>
            <Text style={styles.nextStopNav}>🧭 Yol Tarifi</Text>
          </TouchableOpacity>
        )}
      </View>

    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  loadingText: { textAlign: "center", color: "#94a3b8", marginTop: 16, fontSize: 15 },

  // Header
  header: {
    backgroundColor: "#1B2437",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  backBtn: { width: 44, alignItems: "flex-start" },
  backBtnText: { color: "#94a3b8", fontSize: 26 },
  headerCenter: { flex: 1, alignItems: "center" },
  routeName: { color: "#fff", fontSize: 17, fontWeight: "700" },
  stopCounter: { color: "#64748b", fontSize: 12, marginTop: 3 },

  // Progress
  progressBar: {
    backgroundColor: "#1B2437",
    flexDirection: "row",
    gap: 4,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#334155",
    maxWidth: 48,
  },
  progressDone: { backgroundColor: "#16a34a" },
  progressCurrent: { backgroundColor: "#DC2626" },

  // Stop card
  stopCard: {
    backgroundColor: "#1B2437",
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
  },
  stopTime: { color: "#DC2626", fontSize: 36, fontWeight: "900", letterSpacing: 1 },
  stopName: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 6, textAlign: "center", lineHeight: 28 },
  stopBadgeRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeGreen: { backgroundColor: "#166534" },
  badgeGrey: { backgroundColor: "#334155" },
  badgeText: { color: "#86efac", fontSize: 13, fontWeight: "700" },
  badgeTextGrey: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  noPassText: { color: "#64748b", fontSize: 14, marginTop: 8 },

  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DC2626",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 14,
    marginBottom: 4,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  navBtnIcon: { fontSize: 18 },
  navBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  // Passenger list
  list: { flex: 1, marginTop: 12, paddingHorizontal: 14 },

  emptyWrap: { alignItems: "center", paddingTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#64748b", fontSize: 16, fontWeight: "600" },
  emptyHint: { color: "#94a3b8", fontSize: 13, marginTop: 4 },

  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderWidth: 2.5,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  passengerRowBoarded: {
    backgroundColor: "#f0fdf4",
    borderColor: "#4ade80",
  },

  checkCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  checkCircleBoarded: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  checkMark: { color: "#fff", fontSize: 20, fontWeight: "900" },
  checkMarkEmpty: { color: "#94a3b8", fontSize: 16, fontWeight: "600" },

  passengerName: {
    flex: 1,
    fontSize: 19,
    fontWeight: "700",
    color: "#1e293b",
    lineHeight: 24,
  },
  passengerNameBoarded: { color: "#15803d" },

  pillGreen: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillGrey: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillTextGreen: { color: "#15803d", fontSize: 12, fontWeight: "700" },
  pillTextGrey: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },

  // Footer
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 28,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  devamBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 18,
    paddingVertical: 22,
    alignItems: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  devamBtnDisabled: { opacity: 0.5 },
  devamBtnText: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 0.5 },
  nextStopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 4,
  },
  nextStopHint: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  nextStopNav: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },

  // Error
  errorBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorText: { color: "#dc2626", fontSize: 16, textAlign: "center", marginBottom: 24, fontWeight: "600" },
  retryBtn: { backgroundColor: "#1B2437", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, marginBottom: 12 },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backLink: { marginTop: 8 },
  backLinkText: { color: "#94a3b8", fontSize: 14 },
});
