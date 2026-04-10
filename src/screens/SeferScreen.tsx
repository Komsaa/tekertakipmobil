import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert,
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
  // attendance: passengerId -> "boarded" | "absent" | undefined
  const [attendance, setAttendance] = useState<Record<string, string>>({});
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
      // Mevcut yoklamaları yükle
      const init: Record<string, string> = {};
      for (const stop of data.route.stops) {
        for (const p of stop.passengers) {
          if (p.attendances[0]) init[p.id] = p.attendances[0].status;
        }
      }
      setAttendance(init);
    } catch {
      setError("Bağlantı hatası");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  function togglePassenger(passengerId: string) {
    setAttendance((prev) => {
      const cur = prev[passengerId];
      return { ...prev, [passengerId]: cur === "boarded" ? "absent" : "boarded" };
    });
  }

  async function saveAndNext() {
    if (!route) return;
    const stop = route.stops[stopIndex];
    const isLast = stopIndex === route.stops.length - 1;
    const nextStop = !isLast ? route.stops[stopIndex + 1] : null;

    setSaving(true);
    const attendances = stop.passengers.map((p) => ({
      passengerId: p.id,
      status: attendance[p.id] ?? "absent",
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
      Alert.alert("Sefer Tamamlandı", "Tüm duraklar geçildi.", [
        { text: "Tamam", onPress: onBack },
      ]);
    }
  }

  function goBack() {
    if (stopIndex > 0) setStopIndex((i) => i - 1);
    else onBack();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#DC2626" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (error || !route) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorBox}>
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

  const stop = route.stops[stopIndex];
  const totalStops = route.stops.length;
  const isLast = stopIndex === totalStops - 1;
  const boardedCount = stop.passengers.filter((p) => attendance[p.id] === "boarded").length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Üst bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.routeName}>{route.name}</Text>
          <Text style={styles.stopCounter}>Durak {stopIndex + 1} / {totalStops}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Durak ilerleme çubuğu */}
      <View style={styles.progressBar}>
        {route.stops.map((s, i) => (
          <View
            key={s.id}
            style={[
              styles.progressDot,
              i < stopIndex && styles.progressDone,
              i === stopIndex && styles.progressCurrent,
            ]}
          />
        ))}
      </View>

      {/* Durak bilgisi */}
      <View style={styles.stopCard}>
        <Text style={styles.stopTime}>{stop.estimatedTime}</Text>
        <Text style={styles.stopName}>{stop.name}</Text>
        {stop.passengers.length > 0 && (
          <Text style={styles.stopSummary}>{boardedCount} / {stop.passengers.length} bindi</Text>
        )}
      </View>

      {/* Yolcu listesi */}
      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 20 }}>
        {stop.passengers.length === 0 ? (
          <Text style={styles.emptyText}>Bu durağa kayıtlı yolcu yok.</Text>
        ) : (
          stop.passengers.map((p) => {
            const status = attendance[p.id];
            const boarded = status === "boarded";
            const absent = status === "absent";
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.passengerRow,
                  boarded && styles.passengerBoarded,
                  absent && styles.passengerAbsent,
                ]}
                onPress={() => togglePassenger(p.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.statusDot, boarded && styles.dotBoarded, absent && styles.dotAbsent]} />
                <Text style={[styles.passengerName, boarded && styles.nameBoarded, absent && styles.nameAbsent]}>
                  {p.name}
                </Text>
                <Text style={styles.statusLabel}>
                  {boarded ? "✓ Bindi" : absent ? "✗ Gelmedi" : "—"}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* İleri butonu */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
          onPress={saveAndNext}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.nextBtnText}>{isLast ? "Seferi Tamamla ✓" : "Sonraki Durak →"}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    backgroundColor: "#1B2437",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  backBtn: { width: 40, alignItems: "flex-start" },
  backBtnText: { color: "#94a3b8", fontSize: 24 },
  headerCenter: { flex: 1, alignItems: "center" },
  routeName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  stopCounter: { color: "#94a3b8", fontSize: 12, marginTop: 2 },

  progressBar: {
    backgroundColor: "#1B2437",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#334155",
    maxWidth: 40,
  },
  progressDone: { backgroundColor: "#16a34a" },
  progressCurrent: { backgroundColor: "#DC2626" },

  stopCard: {
    backgroundColor: "#1B2437",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  stopTime: { color: "#DC2626", fontSize: 28, fontWeight: "800" },
  stopName: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 4, textAlign: "center" },
  stopSummary: { color: "#94a3b8", fontSize: 13, marginTop: 6 },

  list: { flex: 1, marginTop: 12, paddingHorizontal: 16 },
  emptyText: { textAlign: "center", color: "#94a3b8", marginTop: 40, fontSize: 15 },

  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  passengerBoarded: { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  passengerAbsent: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },

  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#cbd5e1", marginRight: 12 },
  dotBoarded: { backgroundColor: "#16a34a" },
  dotAbsent: { backgroundColor: "#dc2626" },

  passengerName: { flex: 1, fontSize: 17, fontWeight: "600", color: "#1e293b" },
  nameBoarded: { color: "#15803d" },
  nameAbsent: { color: "#b91c1c" },

  statusLabel: { fontSize: 13, color: "#94a3b8", fontWeight: "600" },

  footer: { padding: 16, paddingBottom: 24, backgroundColor: "#f8fafc" },
  nextBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: "#fff", fontSize: 18, fontWeight: "800" },

  errorBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  errorText: { color: "#dc2626", fontSize: 16, textAlign: "center", marginBottom: 20 },
  retryBtn: { backgroundColor: "#1B2437", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginBottom: 12 },
  retryText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  backLink: { marginTop: 8 },
  backLinkText: { color: "#94a3b8", fontSize: 14 },
});
