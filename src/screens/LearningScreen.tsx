import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator } from "react-native";
import { authFetch } from "../api/client";
import { beginLearning, finishLearning, recordingStatus } from "../lib/learningTask";

export default function LearningScreen({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof recordingStatus>> | null>(null);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string }[]>([]);
  const [vehicle, setVehicle] = useState("");
  const [days, setDays] = useState(0);
  const [weekEnd, setWeekEnd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function refresh() {
    setStatus(await recordingStatus());
    const res = await authFetch("/api/mobile/learning");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Öğrenme bilgisi alınamadı");
    setVehicles(data.vehicles); setVehicle(v => v || data.vehicles[0]?.id || "");
    setDays(data.days); setWeekEnd(data.weekEndsAt);
  }
  useEffect(() => {
    refresh().catch(e => setError(e.message));
    const timer = setInterval(() => recordingStatus().then(setStatus).catch(() => setError("Kayıt durumu okunamadı")), 5000);
    return () => clearInterval(timer);
  }, []);
  async function act(finish: boolean) {
    setBusy(true); setError("");
    try {
      if (finish) await finishLearning(); else await beginLearning(vehicle);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "İşlem tamamlanamadı"); setStatus(await recordingStatus()); }
    finally { setBusy(false); }
  }
  const recording = status?.state, active = recording && !recording.endedAt;
  const expired = weekEnd && Date.now() >= +new Date(weekEnd);
  return <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}><ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
    <Text style={{ fontSize: 26, fontWeight: "800", color: "#1B2437" }}>Güzergâh öğrenme</Text>
    <Text>Servis yolculuğunuzu başlatın. Durak seçmeniz gerekmez. Beş farklı günün benzer seferlerinden güzergâh taslağı hazırlanır; bir hafta boyunca iyileştirilir.</Text>
    <Text style={{ fontWeight: "700" }}>{days} servis günü kaydedildi</Text>
    {!recording && vehicles.map(v => <TouchableOpacity key={v.id} disabled={busy} onPress={() => setVehicle(v.id)} style={{ padding: 16, borderWidth: 2, borderColor: vehicle === v.id ? "#DC2626" : "#ddd", borderRadius: 12 }}><Text>{v.plate} {vehicle === v.id ? "✓" : ""}</Text></TouchableOpacity>)}
    {recording && <View style={{ padding: 20, backgroundColor: "#fff", borderRadius: 16, gap: 12 }}>
      <Text style={{ fontWeight: "800", fontSize: 20 }}>{active ? status?.running ? "Konum kaydı açık" : "Konum kaydı kesildi" : "Kayıt durdu"}</Text>
      <Text>{recording.uploaded} konum gönderildi • {status?.pending} konum telefonda bekliyor</Text>
      <Text>{recording.last ? `Son GPS kaydı: ${new Date(recording.last.timestamp).toLocaleTimeString("tr-TR")}` : "GPS konumu bekleniyor"}</Text>
      {recording.error && <Text style={{ color: "#b45309" }}>{recording.error}</Text>}
      {active && !status?.running && <Text>Seferi bitirip yeniden başlatın.</Text>}
      {active && <Text>Ekranı kilitleyebilirsiniz. Servis bittiğinde aşağıdaki düğmeye basın.</Text>}
    </View>}
    {!!error && <Text style={{ color: "#b91c1c" }}>{error}</Text>}
    {expired && !recording && <Text>Bir haftalık kayıt tamamlandı. Taslaklar firma panelindeki güzergâh tekliflerinde. Yeterli benzer sefer yoksa taslak oluşturulmaz.</Text>}
    {(!expired || recording) && <TouchableOpacity disabled={busy || (!recording && (!vehicle || !status))} onPress={() => act(!!recording)} style={{ padding: 22, backgroundColor: "#DC2626", borderRadius: 16, opacity: busy ? 0.5 : 1 }}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "white", textAlign: "center", fontWeight: "800", fontSize: 20 }}>{recording ? active ? "Güzergâhı Bitir" : "Bekleyen Kaydı Gönder" : "Güzergâha Başla"}</Text>}
    </TouchableOpacity>}
    {!recording && <TouchableOpacity disabled={busy} onPress={onBack}><Text style={{ textAlign: "center", padding: 16 }}>Ana ekrana dön</Text></TouchableOpacity>}
    {recording && <Text>Kayıt açıkken geri tuşu seferi bitirmez. Bitir düğmesi, internet olmasa da konum toplamayı durdurur.</Text>}
  </ScrollView></SafeAreaView>;
}
