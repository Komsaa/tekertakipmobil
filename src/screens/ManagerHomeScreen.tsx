import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, RefreshControl, TextInput, Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import { getSecure, deleteSecureMany } from "../lib/secureStorage";
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
  const [tab, setTab] = useState<"dashboard" | "fuel" | "reports" | "expense" | "panel">("dashboard");

  // Gider formu
  const [expCategory, setExpCategory] = useState("diğer");
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expPhoto, setExpPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [expSaving, setExpSaving] = useState(false);
  const [recentExpenses, setRecentExpenses] = useState<{ id: string; category: string; amount: number; description: string | null; date: string }[]>([]);
  const [panelUrl, setPanelUrl] = useState<string | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const panelSessionReady = useRef(false);

  useEffect(() => {
    getSecure("managerUsername").then((u) => u && setUsername(u));
    load();
    loadExpenses();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  async function silentLogout() {
    await deleteSecureMany(["managerToken", "managerUsername"]);
    onLogout();
  }

  async function load() {
    try {
      const token = await getSecure("managerToken");
      const res = await fetch(`${API_BASE}/api/mobile/manager/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        await silentLogout();
        return;
      }
      if (res.ok) setData(await res.json());
    } catch { /* sessiz */ }
    finally { setLoading(false); setRefreshing(false); }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  async function loadExpenses() {
    try {
      const token = await getSecure("managerToken");
      const res = await fetch(`${API_BASE}/api/mobile/manager/expense`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRecentExpenses(await res.json());
    } catch { /* sessiz */ }
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("İzin Gerekli", "Galeri erişim izni verilmedi.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const ext = asset.uri.split(".").pop() ?? "jpg";
      setExpPhoto({ uri: asset.uri, name: `receipt.${ext}`, type: `image/${ext}` });
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("İzin Gerekli", "Kamera erişim izni verilmedi.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const ext = asset.uri.split(".").pop() ?? "jpg";
      setExpPhoto({ uri: asset.uri, name: `receipt.${ext}`, type: `image/${ext}` });
    }
  }

  async function submitExpense() {
    if (!expAmount || parseFloat(expAmount) <= 0) {
      Alert.alert("Hata", "Geçerli bir tutar girin");
      return;
    }
    setExpSaving(true);
    try {
      const token = await getSecure("managerToken");
      const form = new FormData();
      form.append("category", expCategory);
      form.append("amount", expAmount);
      form.append("description", expDesc);
      form.append("date", expDate);
      if (expPhoto) {
        form.append("photo", { uri: expPhoto.uri, name: expPhoto.name, type: expPhoto.type } as any);
      }
      const res = await fetch(`${API_BASE}/api/mobile/manager/expense`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        Alert.alert("Kaydedildi", "Gider başarıyla eklendi.");
        setExpAmount(""); setExpDesc(""); setExpPhoto(null); setExpCategory("diğer");
        loadExpenses();
      } else {
        const e = await res.json();
        Alert.alert("Hata", e.error ?? "Kaydedilemedi");
      }
    } catch {
      Alert.alert("Bağlantı Hatası", "Sunucuya ulaşılamadı.");
    } finally {
      setExpSaving(false);
    }
  }

  async function openPanel() {
    if (panelUrl) { setTab("panel"); return; }
    setPanelLoading(true);
    setTab("panel");
    try {
      const token = await getSecure("managerToken");
      const res = await fetch(`${API_BASE}/api/mobile/manager/web-token`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { Alert.alert("Hata", "Panel açılamadı"); setTab("dashboard"); return; }
      const { token: exchangeToken } = await res.json();
      setPanelUrl(`${API_BASE}/api/panel/mobile-session?t=${exchangeToken}`);
    } catch {
      Alert.alert("Bağlantı Hatası", "Panel açılamadı.");
      setTab("dashboard");
    } finally {
      setPanelLoading(false);
    }
  }

  async function handleLogout() {
    Alert.alert("Çıkış", "Oturumu kapatmak istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap", style: "destructive",
        onPress: silentLogout,
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
        {([["dashboard", "📊 Özet"], ["fuel", "⛽ Yakıt"], ["reports", "🔧 Arıza"], ["expense", "💰 Gider"]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key as any)}>
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.tab, tab === "panel" && s.tabActive]} onPress={openPanel}>
          <Text style={[s.tabText, tab === "panel" && s.tabTextActive]}>🌐 Panel</Text>
        </TouchableOpacity>
      </View>

      {/* Panel WebView — kalıcı mount, tab dışındayken gizli */}
      <View style={{ flex: tab === "panel" ? 1 : 0, overflow: "hidden" }}>
        {panelLoading && (
          <View style={s.panelLoading}>
            <ActivityIndicator size="large" color="#DC2626" />
            <Text style={s.panelLoadingText}>Panel yükleniyor...</Text>
          </View>
        )}
        {panelUrl && !panelLoading && (
          <WebView
            source={{ uri: panelUrl }}
            style={{ flex: 1 }}
            onNavigationStateChange={(state) => {
              if (!panelSessionReady.current && state.url.includes("/mobil") && !state.url.includes("mobile-session")) {
                panelSessionReady.current = true;
                setPanelUrl(`${API_BASE}/mobil`);
              }
            }}
          />
        )}
      </View>

      <ScrollView
        style={[s.scroll, { display: tab !== "panel" ? "flex" : "none" }]}
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

        {tab === "expense" && (
          <>
            <View style={s.expenseForm}>
              <Text style={s.sectionTitle}>Yeni Gider Ekle</Text>

              <Text style={s.fieldLabel}>Kategori</Text>
              <View style={s.catRow}>
                {["yakıt", "bakım", "maaş", "sigorta", "diğer"].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catBtn, expCategory === cat && s.catBtnActive]}
                    onPress={() => setExpCategory(cat)}
                  >
                    <Text style={[s.catText, expCategory === cat && s.catTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>Tutar (₺)</Text>
              <TextInput
                style={s.input}
                value={expAmount}
                onChangeText={setExpAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
              />

              <Text style={s.fieldLabel}>Tarih</Text>
              <TextInput
                style={s.input}
                value={expDate}
                onChangeText={setExpDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />

              <Text style={s.fieldLabel}>Açıklama</Text>
              <TextInput
                style={[s.input, { height: 72, textAlignVertical: "top" }]}
                value={expDesc}
                onChangeText={setExpDesc}
                multiline
                placeholder="İsteğe bağlı..."
                placeholderTextColor="#94a3b8"
              />

              <Text style={s.fieldLabel}>Fiş / Belge</Text>
              <View style={s.photoRow}>
                <TouchableOpacity style={s.photoBtn} onPress={takePhoto}>
                  <Text style={s.photoBtnText}>📷 Fotoğraf Çek</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.photoBtn} onPress={pickPhoto}>
                  <Text style={s.photoBtnText}>🖼️ Galeriden Seç</Text>
                </TouchableOpacity>
              </View>
              {expPhoto && (
                <Image source={{ uri: expPhoto.uri }} style={s.photoPreview} />
              )}

              <TouchableOpacity
                style={[s.submitBtn, expSaving && { opacity: 0.6 }]}
                onPress={submitExpense}
                disabled={expSaving}
                activeOpacity={0.85}
              >
                {expSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>Gideri Kaydet</Text>
                }
              </TouchableOpacity>
            </View>

            {recentExpenses.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Son Giderler</Text>
                {recentExpenses.map((e) => (
                  <View key={e.id} style={s.card}>
                    <View style={s.cardRow}>
                      <Text style={s.cardTime}>{new Date(e.date).toLocaleDateString("tr-TR")}</Text>
                      <Text style={[s.fuelAmount, { color: "#7c3aed" }]}>₺{e.amount.toLocaleString("tr-TR", { minimumFractionDigits: 0 })}</Text>
                    </View>
                    <Text style={s.cardTitle}>{e.category}</Text>
                    {e.description && <Text style={s.cardSub}>{e.description}</Text>}
                  </View>
                ))}
              </>
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
  panelLoading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  panelLoadingText: { marginTop: 12, color: "#64748b", fontSize: 15, fontWeight: "600" },

  // Expense form
  expenseForm: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: "#1e293b", borderWidth: 1, borderColor: "#e2e8f0" },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  catBtnActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  catText: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  catTextActive: { color: "#fff" },
  photoRow: { flexDirection: "row", gap: 10 },
  photoBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: "#e2e8f0", alignItems: "center", backgroundColor: "#f8fafc" },
  photoBtnText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  photoPreview: { width: "100%", height: 140, borderRadius: 12, marginTop: 10, resizeMode: "cover" },
  submitBtn: { backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 16 },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
