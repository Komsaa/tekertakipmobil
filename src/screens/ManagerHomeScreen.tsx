import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, RefreshControl,
  TextInput, Image, Linking, Platform, FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
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
type Driver = {
  id: string; name: string; phone: string | null; status: string;
  latitude: number | null; longitude: number | null; lastLocationAt: string | null;
  isTracking: boolean; plate: string | null;
};
type AdvanceEntry = { id: string; category: string; amount: number; description: string | null; date: string; driverName: string | null };

type Tab = "dashboard" | "drivers" | "payment" | "fuel" | "reports";
type Props = { onLogout: () => void };

const ADV_CATS = ["avans", "maaş", "ikramiye", "diğer"] as const;
const EXP_CATS = ["yakıt", "bakım", "sigorta", "kira", "diğer"] as const;
const PAY_MODES = ["driver", "expense"] as const;

export default function ManagerHomeScreen({ onLogout }: Props) {
  const [username, setUsername] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");

  // Şöförler
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversLoaded, setDriversLoaded] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");

  // Ödeme
  const [payMode, setPayMode] = useState<"driver" | "expense">("driver");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [driverPickerSearch, setDriverPickerSearch] = useState("");
  const [advCategory, setAdvCategory] = useState<string>("avans");
  const [advAmount, setAdvAmount] = useState("");
  const [advDesc, setAdvDesc] = useState("");
  const [advDate, setAdvDate] = useState(today());
  const [advSaving, setAdvSaving] = useState(false);
  const [recentAdvances, setRecentAdvances] = useState<AdvanceEntry[]>([]);

  // Gider
  const [expCategory, setExpCategory] = useState("diğer");
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expDate, setExpDate] = useState(today());
  const [expPhoto, setExpPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [expSaving, setExpSaving] = useState(false);

  function today() { return new Date().toISOString().slice(0, 10); }

  useEffect(() => {
    getSecure("managerUsername").then((u) => u && setUsername(u));
    loadDashboard();
    const iv = setInterval(loadDashboard, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (tab === "drivers" && !driversLoaded) loadDrivers();
    if (tab === "payment") { loadAdvances(); if (!driversLoaded) loadDrivers(); }
  }, [tab]);

  async function authHeader() {
    const token = await getSecure("managerToken");
    return { Authorization: `Bearer ${token}` };
  }

  async function silentLogout() {
    await deleteSecureMany(["managerToken", "managerUsername"]);
    onLogout();
  }

  async function loadDashboard() {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/manager/dashboard`, { headers: await authHeader() });
      if (res.status === 401) { await silentLogout(); return; }
      if (res.ok) setData(await res.json());
    } catch { /* sessiz */ } finally { setLoading(false); setRefreshing(false); }
  }

  async function loadDrivers() {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/manager/drivers`, { headers: await authHeader() });
      if (res.ok) { setDrivers(await res.json()); setDriversLoaded(true); }
    } catch { /* sessiz */ }
  }

  async function loadAdvances() {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/manager/advance`, { headers: await authHeader() });
      if (res.ok) setRecentAdvances(await res.json());
    } catch { /* sessiz */ }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
    if (tab === "drivers") loadDrivers();
    if (tab === "payment") { loadAdvances(); loadDrivers(); }
  }, [tab]);

  function openMaps(lat: number, lng: number, name: string) {
    const label = encodeURIComponent(name);
    const url = Platform.OS === "ios"
      ? `maps:0,0?q=${label}@${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    Linking.openURL(url).catch(() => Alert.alert("Hata", "Harita uygulaması açılamadı."));
  }

  async function submitAdvance() {
    if (!selectedDriver) { Alert.alert("Uyarı", "Bir şöför seçin"); return; }
    if (!advAmount || parseFloat(advAmount) <= 0) { Alert.alert("Uyarı", "Geçerli bir tutar girin"); return; }
    setAdvSaving(true);
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_BASE}/api/mobile/manager/advance`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: selectedDriver.id, amount: advAmount, description: advDesc, date: advDate, category: advCategory }),
      });
      const json = await res.json();
      if (res.ok) {
        Alert.alert("Kaydedildi", `${json.driverName} için ${advCategory} kaydedildi.`);
        setAdvAmount(""); setAdvDesc(""); setSelectedDriver(null); setAdvDate(today());
        loadAdvances();
      } else {
        Alert.alert("Hata", json.error ?? "Kaydedilemedi");
      }
    } catch { Alert.alert("Bağlantı Hatası", "Sunucuya ulaşılamadı."); }
    finally { setAdvSaving(false); }
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("İzin Gerekli", "Galeri erişim izni verilmedi."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const ext = a.uri.split(".").pop() ?? "jpg";
      setExpPhoto({ uri: a.uri, name: `receipt.${ext}`, type: `image/${ext}` });
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("İzin Gerekli", "Kamera erişim izni verilmedi."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const ext = a.uri.split(".").pop() ?? "jpg";
      setExpPhoto({ uri: a.uri, name: `receipt.${ext}`, type: `image/${ext}` });
    }
  }

  async function submitExpense() {
    if (!expAmount || parseFloat(expAmount) <= 0) { Alert.alert("Uyarı", "Geçerli bir tutar girin"); return; }
    setExpSaving(true);
    try {
      const token = await getSecure("managerToken");
      const form = new FormData();
      form.append("category", expCategory);
      form.append("amount", expAmount);
      form.append("description", expDesc);
      form.append("date", expDate);
      if (expPhoto) form.append("photo", { uri: expPhoto.uri, name: expPhoto.name, type: expPhoto.type } as any);
      const res = await fetch(`${API_BASE}/api/mobile/manager/expense`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        Alert.alert("Kaydedildi", "Gider eklendi.");
        setExpAmount(""); setExpDesc(""); setExpPhoto(null); setExpCategory("diğer"); setExpDate(today());
      } else {
        const e = await res.json();
        Alert.alert("Hata", e.error ?? "Kaydedilemedi");
      }
    } catch { Alert.alert("Bağlantı Hatası", "Sunucuya ulaşılamadı."); }
    finally { setExpSaving(false); }
  }

  async function handleLogout() {
    Alert.alert("Çıkış", "Oturumu kapatmak istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      { text: "Çıkış Yap", style: "destructive", onPress: silentLogout },
    ]);
  }

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" }}>
      <ActivityIndicator size="large" color="#DC2626" />
    </View>
  );

  const d = data;
  const activeJobs = d?.today.jobs.filter((j) => j.status === "active") ?? [];
  const filteredDrivers = drivers.filter((dr) =>
    dr.name.toLowerCase().includes(driverSearch.toLowerCase()) ||
    (dr.plate ?? "").toLowerCase().includes(driverSearch.toLowerCase())
  );
  const pickerDrivers = drivers.filter((dr) =>
    dr.status !== "deleted" &&
    (dr.name.toLowerCase().includes(driverPickerSearch.toLowerCase()) ||
     (dr.plate ?? "").toLowerCase().includes(driverPickerSearch.toLowerCase()))
  );

  const TABS: [Tab, string][] = [
    ["dashboard", "📊 Özet"],
    ["drivers", "📍 Şöförler"],
    ["payment", "💳 Ödeme"],
    ["fuel", "⛽ Yakıt"],
    ["reports", "🔧 Arıza"],
  ];

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarWrap} contentContainerStyle={s.tabBar}>
        {TABS.map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && d && (
          <>
            {/* Acil: Açık arıza uyarısı */}
            {d.openReports.length > 0 && (
              <TouchableOpacity style={s.alertBanner} onPress={() => setTab("reports")}>
                <Text style={s.alertBannerText}>⚠️  {d.openReports.length} açık arıza bildirimi var</Text>
                <Text style={s.alertBannerSub}>Görüntülemek için dokun</Text>
              </TouchableOpacity>
            )}

            {/* Aktif seferler — anlık durum */}
            {activeJobs.length > 0 && (
              <>
                <Text style={s.sectionTitle}>🟢 Aktif Seferler</Text>
                {activeJobs.map((j) => (
                  <View key={j.id} style={[s.card, s.cardActive]}>
                    <View style={s.cardRow}>
                      <View style={s.activeDot} />
                      <Text style={s.activeTime}>{j.startTime}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={s.activePlate}>{j.plate}</Text>
                    </View>
                    <Text style={s.activeTitle}>{j.title}</Text>
                    <Text style={s.cardSub}>{j.driver}</Text>
                  </View>
                ))}
              </>
            )}

            {/* İstatistikler */}
            <View style={s.statRow}>
              <View style={[s.stat, { backgroundColor: "#1B2437" }]}>
                <Text style={s.statVal}>{d.today.jobCount}</Text>
                <Text style={s.statLbl}>Bugün Sefer</Text>
              </View>
              <View style={[s.stat, { backgroundColor: "#16a34a" }]}>
                <Text style={s.statVal}>{d.activeDriverCount}</Text>
                <Text style={s.statLbl}>Yolda Şöför</Text>
              </View>
            </View>
            <View style={s.statRow}>
              <View style={[s.stat, { backgroundColor: "#DC2626" }]}>
                <Text style={s.statVal}>₺{Math.round(d.monthFuel.totalAmount).toLocaleString("tr-TR")}</Text>
                <Text style={s.statLbl}>Bu Ay Yakıt</Text>
              </View>
              <View style={[s.stat, { backgroundColor: d.openReports.length > 0 ? "#d97706" : "#475569" }]}>
                <Text style={s.statVal}>{d.openReports.length}</Text>
                <Text style={s.statLbl}>Açık Arıza</Text>
              </View>
            </View>

            {/* Tüm bugünkü seferler */}
            <Text style={s.sectionTitle}>📋 Bugünkü Seferler</Text>
            <Text style={s.dateLabel}>{d.today.date}</Text>
            {d.today.jobs.length === 0 ? (
              <Text style={s.empty}>Bugün sefer yok</Text>
            ) : (
              d.today.jobs.map((j) => (
                <View key={j.id} style={s.card}>
                  <View style={s.cardRow}>
                    <Text style={s.cardTime}>{j.startTime}</Text>
                    <View style={[s.badge,
                      j.status === "active" ? s.badgeGreen :
                      j.status === "completed" ? s.badgeBlue :
                      j.status === "cancelled" ? s.badgeRed : s.badgeGray
                    ]}>
                      <Text style={s.badgeText}>
                        {j.status === "active" ? "Aktif" : j.status === "completed" ? "Tamamlandı" : j.status === "cancelled" ? "İptal" : "Planlandı"}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.cardTitle}>{j.title}</Text>
                  <Text style={s.cardSub}>{j.driver} · {j.plate}</Text>
                </View>
              ))
            )}
          </>
        )}

        {/* ── ŞOFÖRLER + KONUM ── */}
        {tab === "drivers" && (
          <>
            <TextInput
              style={s.searchInput}
              placeholder="Şöför veya plaka ara..."
              placeholderTextColor="#94a3b8"
              value={driverSearch}
              onChangeText={setDriverSearch}
            />
            {!driversLoaded ? (
              <ActivityIndicator color="#DC2626" style={{ marginTop: 40 }} />
            ) : filteredDrivers.length === 0 ? (
              <Text style={s.empty}>Şöför bulunamadı</Text>
            ) : (
              filteredDrivers.map((dr) => {
                const hasLocation = dr.latitude != null && dr.longitude != null;
                const minsAgo = dr.lastLocationAt
                  ? Math.floor((Date.now() - new Date(dr.lastLocationAt).getTime()) / 60000)
                  : null;
                return (
                  <View key={dr.id} style={s.driverCard}>
                    <View style={s.driverCardLeft}>
                      <View style={[s.trackingDot, dr.isTracking ? s.trackingDotOn : s.trackingDotOff]} />
                      <View>
                        <Text style={s.driverName}>{dr.name}</Text>
                        <Text style={s.driverSub}>
                          {dr.plate ?? "Araç yok"}
                          {dr.phone ? ` · ${dr.phone}` : ""}
                        </Text>
                        {hasLocation && minsAgo !== null && (
                          <Text style={s.locationTime}>
                            {minsAgo < 1 ? "Az önce konum güncellendi" :
                             minsAgo < 60 ? `${minsAgo} dk önce konum güncellendi` :
                             `${Math.floor(minsAgo / 60)} sa önce konum güncellendi`}
                          </Text>
                        )}
                      </View>
                    </View>
                    {hasLocation ? (
                      <TouchableOpacity
                        style={s.mapBtn}
                        onPress={() => openMaps(dr.latitude!, dr.longitude!, dr.name)}
                      >
                        <Text style={s.mapBtnText}>📍 Haritada Gör</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={s.noLocationBadge}>
                        <Text style={s.noLocationText}>Konum yok</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ── ÖDEME / AVANS ── */}
        {tab === "payment" && (
          <>
            {/* Mod seçimi */}
            <View style={s.modeRow}>
              <TouchableOpacity
                style={[s.modeBtn, payMode === "driver" && s.modeBtnActive]}
                onPress={() => setPayMode("driver")}
              >
                <Text style={[s.modeBtnText, payMode === "driver" && s.modeBtnTextActive]}>Şöföre Ödeme</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, payMode === "expense" && s.modeBtnActive]}
                onPress={() => setPayMode("expense")}
              >
                <Text style={[s.modeBtnText, payMode === "expense" && s.modeBtnTextActive]}>Genel Gider</Text>
              </TouchableOpacity>
            </View>

            {payMode === "driver" && (
              <View style={s.payForm}>
                {/* Şöför seçici */}
                <Text style={s.fieldLabel}>Şöför *</Text>
                <TouchableOpacity
                  style={s.driverSelector}
                  onPress={() => { setDriverPickerOpen(true); setDriverPickerSearch(""); }}
                >
                  <Text style={selectedDriver ? s.driverSelectorSelected : s.driverSelectorPlaceholder}>
                    {selectedDriver ? `${selectedDriver.name}${selectedDriver.plate ? " · " + selectedDriver.plate : ""}` : "Şöför seçin..."}
                  </Text>
                  <Text style={s.driverSelectorArrow}>▼</Text>
                </TouchableOpacity>

                {/* Şöför seçici dropdown */}
                {driverPickerOpen && (
                  <View style={s.pickerDropdown}>
                    <TextInput
                      style={s.pickerSearch}
                      placeholder="Şöför ara..."
                      placeholderTextColor="#94a3b8"
                      value={driverPickerSearch}
                      onChangeText={setDriverPickerSearch}
                      autoFocus
                    />
                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                      {pickerDrivers.map((dr) => (
                        <TouchableOpacity
                          key={dr.id}
                          style={s.pickerItem}
                          onPress={() => { setSelectedDriver(dr); setDriverPickerOpen(false); }}
                        >
                          <Text style={s.pickerItemName}>{dr.name}</Text>
                          <Text style={s.pickerItemSub}>{dr.plate ?? "Araç yok"}</Text>
                        </TouchableOpacity>
                      ))}
                      {pickerDrivers.length === 0 && (
                        <Text style={s.empty}>Şöför bulunamadı</Text>
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* Kategori */}
                <Text style={s.fieldLabel}>Tür</Text>
                <View style={s.catRow}>
                  {ADV_CATS.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[s.catBtn, advCategory === cat && s.catBtnActive]}
                      onPress={() => setAdvCategory(cat)}
                    >
                      <Text style={[s.catText, advCategory === cat && s.catTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.fieldLabel}>Tutar (₺) *</Text>
                <TextInput
                  style={s.input}
                  value={advAmount}
                  onChangeText={setAdvAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                />

                <Text style={s.fieldLabel}>Tarih</Text>
                <TextInput
                  style={s.input}
                  value={advDate}
                  onChangeText={setAdvDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                />

                <Text style={s.fieldLabel}>Açıklama</Text>
                <TextInput
                  style={[s.input, { height: 64, textAlignVertical: "top" }]}
                  value={advDesc}
                  onChangeText={setAdvDesc}
                  multiline
                  placeholder="İsteğe bağlı..."
                  placeholderTextColor="#94a3b8"
                />

                <TouchableOpacity
                  style={[s.submitBtn, advSaving && { opacity: 0.6 }]}
                  onPress={submitAdvance}
                  disabled={advSaving}
                >
                  {advSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.submitBtnText}>Kaydet</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {payMode === "expense" && (
              <View style={s.payForm}>
                <Text style={s.fieldLabel}>Kategori</Text>
                <View style={s.catRow}>
                  {EXP_CATS.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[s.catBtn, expCategory === cat && s.catBtnActive]}
                      onPress={() => setExpCategory(cat)}
                    >
                      <Text style={[s.catText, expCategory === cat && s.catTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.fieldLabel}>Tutar (₺) *</Text>
                <TextInput style={s.input} value={expAmount} onChangeText={setExpAmount} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />

                <Text style={s.fieldLabel}>Tarih</Text>
                <TextInput style={s.input} value={expDate} onChangeText={setExpDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />

                <Text style={s.fieldLabel}>Açıklama</Text>
                <TextInput style={[s.input, { height: 64, textAlignVertical: "top" }]} value={expDesc} onChangeText={setExpDesc} multiline placeholder="İsteğe bağlı..." placeholderTextColor="#94a3b8" />

                <Text style={s.fieldLabel}>Fiş / Belge</Text>
                <View style={s.photoRow}>
                  <TouchableOpacity style={s.photoBtn} onPress={takePhoto}>
                    <Text style={s.photoBtnText}>📷 Çek</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.photoBtn} onPress={pickPhoto}>
                    <Text style={s.photoBtnText}>🖼️ Galeriden</Text>
                  </TouchableOpacity>
                </View>
                {expPhoto && <Image source={{ uri: expPhoto.uri }} style={s.photoPreview} />}

                <TouchableOpacity
                  style={[s.submitBtn, { backgroundColor: "#7c3aed" }, expSaving && { opacity: 0.6 }]}
                  onPress={submitExpense}
                  disabled={expSaving}
                >
                  {expSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Gideri Kaydet</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Son şöför ödemeleri */}
            {recentAdvances.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Son Ödemeler</Text>
                {recentAdvances.map((e) => (
                  <View key={e.id} style={s.card}>
                    <View style={s.cardRow}>
                      <Text style={s.cardTime}>{new Date(e.date).toLocaleDateString("tr-TR")}</Text>
                      <Text style={[s.fuelAmount, { color: "#7c3aed" }]}>₺{e.amount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</Text>
                    </View>
                    <Text style={s.cardTitle}>{e.driverName ?? "—"}</Text>
                    <Text style={s.cardSub}>{e.category}{e.description ? ` · ${e.description}` : ""}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ── YAKIT ── */}
        {tab === "fuel" && d && (
          <>
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Bu Ay Yakıt</Text>
              <Text style={s.summaryBig}>₺{d.monthFuel.totalAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</Text>
              <Text style={s.summarySub}>{d.monthFuel.liters.toFixed(0)} litre</Text>
            </View>
            <Text style={s.sectionTitle}>Son Girişler</Text>
            {d.recentFuel.map((f) => (
              <View key={f.id} style={s.card}>
                <View style={s.cardRow}>
                  <Text style={s.cardTime}>{new Date(f.date).toLocaleDateString("tr-TR")}</Text>
                  <Text style={s.fuelAmount}>₺{f.totalAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</Text>
                </View>
                <Text style={s.cardTitle}>{f.driver} · {f.plate}</Text>
                <Text style={s.cardSub}>{f.liters} lt{f.station ? ` · ${f.station}` : ""} · {f.paymentType}</Text>
              </View>
            ))}
          </>
        )}

        {/* ── ARIZA ── */}
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

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: { backgroundColor: "#1B2437", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { color: "#94a3b8", fontSize: 13 },
  name: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#334155", borderRadius: 8 },
  logoutText: { color: "#94a3b8", fontSize: 13 },

  tabBarWrap: { backgroundColor: "#1B2437", flexGrow: 0 },
  tabBar: { paddingHorizontal: 12, paddingBottom: 12, flexDirection: "row", gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  tabActive: { backgroundColor: "#DC2626" },
  tabText: { color: "#94a3b8", fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: "#fff" },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Alerts
  alertBanner: { backgroundColor: "#fef3c7", borderRadius: 14, padding: 14, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: "#f59e0b" },
  alertBannerText: { fontWeight: "700", color: "#92400e", fontSize: 14 },
  alertBannerSub: { color: "#b45309", fontSize: 12, marginTop: 2 },

  // Active jobs
  cardActive: { borderLeftWidth: 4, borderLeftColor: "#16a34a", backgroundColor: "#f0fdf4" },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a", marginRight: 8 },
  activeTime: { fontSize: 12, color: "#16a34a", fontWeight: "700" },
  activePlate: { fontSize: 13, fontWeight: "800", color: "#1B2437", fontFamily: "monospace" },
  activeTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginTop: 4 },

  // Stats
  statRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  stat: { flex: 1, borderRadius: 16, padding: 16, alignItems: "center" },
  statVal: { color: "#fff", fontSize: 22, fontWeight: "900" },
  statLbl: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 4, fontWeight: "600" },

  dateLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 8, marginTop: -6 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#64748b", marginBottom: 10, marginTop: 8, textTransform: "uppercase", letterSpacing: 1 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardWarning: { borderLeftWidth: 3, borderLeftColor: "#f59e0b" },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTime: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  cardSub: { fontSize: 13, color: "#64748b", marginTop: 2 },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeGreen: { backgroundColor: "#dcfce7" },
  badgeBlue: { backgroundColor: "#dbeafe" },
  badgeRed: { backgroundColor: "#fee2e2" },
  badgeGray: { backgroundColor: "#f1f5f9" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#374151" },
  warnBadge: { fontSize: 11, fontWeight: "700", color: "#d97706", backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  fuelAmount: { fontSize: 15, fontWeight: "800", color: "#DC2626" },

  empty: { textAlign: "center", color: "#94a3b8", padding: 20 },
  emptyState: { alignItems: "center", padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#64748b", fontWeight: "600" },

  summaryCard: { backgroundColor: "#DC2626", borderRadius: 20, padding: 20, marginBottom: 16, alignItems: "center" },
  summaryTitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  summaryBig: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 4 },
  summarySub: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 2 },

  // Şöförler tab
  searchInput: { backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#1e293b", marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  driverCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  driverCardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  trackingDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  trackingDotOn: { backgroundColor: "#16a34a" },
  trackingDotOff: { backgroundColor: "#cbd5e1" },
  driverName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  driverSub: { fontSize: 13, color: "#64748b", marginTop: 1 },
  locationTime: { fontSize: 11, color: "#16a34a", marginTop: 2, fontWeight: "600" },
  mapBtn: { backgroundColor: "#eff6ff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#bfdbfe" },
  mapBtnText: { fontSize: 12, fontWeight: "700", color: "#2563eb" },
  noLocationBadge: { backgroundColor: "#f8fafc", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#e2e8f0" },
  noLocationText: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },

  // Ödeme tab
  modeRow: { flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 14, padding: 4, marginBottom: 16 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  modeBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  modeBtnText: { fontSize: 14, fontWeight: "600", color: "#94a3b8" },
  modeBtnTextActive: { color: "#1e293b" },

  payForm: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },

  driverSelector: { backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  driverSelectorPlaceholder: { fontSize: 15, color: "#94a3b8" },
  driverSelectorSelected: { fontSize: 15, color: "#1e293b", fontWeight: "600" },
  driverSelectorArrow: { fontSize: 12, color: "#94a3b8" },

  pickerDropdown: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", marginTop: 4, marginBottom: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  pickerSearch: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#1e293b" },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f8fafc" },
  pickerItemName: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  pickerItemSub: { fontSize: 13, color: "#64748b", marginTop: 1 },

  input: { backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: "#1e293b", borderWidth: 1, borderColor: "#e2e8f0" },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  catBtnActive: { backgroundColor: "#1B2437", borderColor: "#1B2437" },
  catText: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  catTextActive: { color: "#fff" },

  photoRow: { flexDirection: "row", gap: 10 },
  photoBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: "#e2e8f0", alignItems: "center", backgroundColor: "#f8fafc" },
  photoBtnText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  photoPreview: { width: "100%", height: 130, borderRadius: 12, marginTop: 10, resizeMode: "cover" },

  submitBtn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 16 },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
