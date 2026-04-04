import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../api/config";

type Job = { id: string; title: string; startTime: string; driver: string; plate: string; status: string };
type Report = { id: string; description: string; driver: string; plate: string; createdAt: string };
type FuelEntry = { id: string; date: string; liters: number; totalAmount: number; driver: string; plate: string; station: string | null; paymentType: string };

type Dashboard = {
  today: { date: string; jobCount: number; jobs: Job[] };
  monthFuel: { totalAmount: number; liters: number };
  activeDriverCount: number;
  openReports: Report[];
  recentFuel: FuelEntry[];
};

type Props = { onLogout: () => void };

export default function ManagerHomeScreen({ onLogout }: Props) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [username, setUsername] = useState("");
  const [tab, setTab] = useState<"dashboard" | "fuel" | "reports">("dashboard");

  useEffect(() => {
    AsyncStorage.getItem("managerUsername").then((u) => u && setUsername(u));
    load();
  }, []);

  async function load() {
    try {
      const token = await AsyncStorage.getItem("managerToken");
      const res = await fetch(`${API_BASE}/api/mobile/manager/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        await handleLogout();
        return;
      }
      if (res.ok) setData(await res.json());
    } catch { /* sessiz */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  async function handleLogout() {
    Alert.alert("Çıkış", "Oturumu kapatmak istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap", style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["managerToken", "managerUsername"]);
          onLogout();
        },
      },
    ]);
  }

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
      <ActivityIndicator size="large" color="#DC2626" />
    </View>
  );

  const d = data;

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Merhaba,</Text>
          <Text style={s.name}>{username || "Yönetici"}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {([["dashboard", "📊 Özet"], ["fuel", "⛽ Yakıt"], ["reports", "🔧 Arızalar"]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tab === "dashboard" && d && (
          <>
            {/* Stat kartları */}
            <View style={s.statRow}>
              <View style={[s.stat, { backgroundColor: "#1B2437" }]}>
                <Text style={s.statVal}>{d.today.jobCount}</Text>
                <Text style={s.statLbl}>Bugün Sefer</Text>
              </View>
              <View style={[s.stat, { backgroundColor: "#DC2626" }]}>
                <Text style={s.statVal}>₺{Math.round(d.monthFuel.totalAmount).toLocaleString("tr-TR")}</Text>
                <Text style={s.statLbl}>Bu Ay Yakıt</Text>
              </View>
            </View>
            <View style={s.statRow}>
              <View style={[s.stat, { backgroundColor: "#16a34a" }]}>
                <Text style={s.statVal}>{d.activeDriverCount}</Text>
                <Text style={s.statLbl}>Aktif Şöför</Text>
              </View>
              <View style={[s.stat, { backgroundColor: "#d97706" }]}>
                <Text style={s.statVal}>{d.openReports.length}</Text>
                <Text style={s.statLbl}>Açık Arıza</Text>
              </View>
            </View>

            {/* Bugünkü seferler */}
            <Text style={s.sectionTitle}>📋 Bugünkü Seferler</Text>
            {d.today.jobs.length === 0 ? (
              <Text style={s.empty}>Bugün sefer yok</Text>
            ) : (
              d.today.jobs.map((j) => (
                <View key={j.id} style={s.card}>
                  <View style={s.cardRow}>
                    <Text style={s.cardTime}>{j.startTime}</Text>
                    <View style={[s.badge, j.status === "active" ? s.badgeGreen : s.badgeGray]}>
                      <Text style={s.badgeText}>{j.status}</Text>
                    </View>
                  </View>
                  <Text style={s.cardTitle}>{j.title}</Text>
                  <Text style={s.cardSub}>{j.driver} · {j.plate}</Text>
                </View>
              ))
            )}
          </>
        )}

        {tab === "fuel" && d && (
          <>
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Bu Ay Özet</Text>
              <Text style={s.summaryBig}>₺{d.monthFuel.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 0 })}</Text>
              <Text style={s.summarySub}>{d.monthFuel.liters.toFixed(0)} litre</Text>
            </View>
            <Text style={s.sectionTitle}>Son Girişler</Text>
            {d.recentFuel.map((f) => (
              <View key={f.id} style={s.card}>
                <View style={s.cardRow}>
                  <Text style={s.cardTime}>{new Date(f.date).toLocaleDateString("tr-TR")}</Text>
                  <Text style={s.fuelAmount}>₺{f.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 0 })}</Text>
                </View>
                <Text style={s.cardTitle}>{f.driver} · {f.plate}</Text>
                <Text style={s.cardSub}>{f.liters} lt{f.station ? ` · ${f.station}` : ""} · {f.paymentType}</Text>
              </View>
            ))}
          </>
        )}

        {tab === "reports" && d && (
          <>
            {d.openReports.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyIcon}>✅</Text>
                <Text style={s.emptyText}>Açık arıza yok</Text>
              </View>
            ) : (
              d.openReports.map((r) => (
                <View key={r.id} style={[s.card, s.cardWarning]}>
                  <View style={s.cardRow}>
                    <Text style={s.cardTime}>{new Date(r.createdAt).toLocaleDateString("tr-TR")}</Text>
                    <Text style={s.warnBadge}>Açık</Text>
                  </View>
                  <Text style={s.cardTitle}>{r.driver} · {r.plate}</Text>
                  <Text style={s.cardSub}>{r.description}</Text>
                </View>
              ))
            )}
          </>
        )}

        <Text style={s.footer}>tekertakip.com · {d?.today.date ?? ""}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: { backgroundColor: "#1B2437", padding: 20, paddingTop: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { color: "#94a3b8", fontSize: 13 },
  name: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#334155", borderRadius: 8 },
  logoutText: { color: "#94a3b8", fontSize: 13 },
  tabBar: { flexDirection: "row", backgroundColor: "#1B2437", paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  tabActive: { backgroundColor: "#DC2626" },
  tabText: { color: "#94a3b8", fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: "#fff" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  statRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  stat: { flex: 1, borderRadius: 16, padding: 16, alignItems: "center" },
  statVal: { color: "#fff", fontSize: 22, fontWeight: "900" },
  statLbl: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 4, fontWeight: "600" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748b", marginBottom: 10, marginTop: 8, textTransform: "uppercase", letterSpacing: 1 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardWarning: { borderLeftWidth: 3, borderLeftColor: "#f59e0b" },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTime: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  cardSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeGreen: { backgroundColor: "#dcfce7" },
  badgeGray: { backgroundColor: "#f1f5f9" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#374151" },
  warnBadge: { fontSize: 11, fontWeight: "700", color: "#d97706", backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  fuelAmount: { fontSize: 15, fontWeight: "800", color: "#DC2626" },
  summaryCard: { backgroundColor: "#DC2626", borderRadius: 20, padding: 20, marginBottom: 16, alignItems: "center" },
  summaryTitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  summaryBig: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 4 },
  summarySub: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 2 },
  empty: { textAlign: "center", color: "#94a3b8", padding: 20 },
  emptyState: { alignItems: "center", padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#64748b", fontWeight: "600" },
  footer: { textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 16 },
});
