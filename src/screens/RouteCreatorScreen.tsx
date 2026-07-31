import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { authFetch } from "../api/client";

type Stop = {
  name: string;
  lat: number;
  lng: number;
  timestamp: string;
};

type Props = {
  onBack: () => void;
};

export default function RouteCreatorScreen({ onBack }: Props) {
  const [routeName, setRouteName] = useState("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [marking, setMarking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);

  async function handleMarkStop() {
    setMarking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("İzin Gerekli", "Konum izni verilmedi.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPendingLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setPendingName("");
      setShowNameInput(true);
    } catch {
      Alert.alert("Hata", "Konum alınamadı, tekrar dene.");
    } finally {
      setMarking(false);
    }
  }

  function confirmStop() {
    if (!pendingLocation) return;
    const stop: Stop = {
      name: pendingName.trim() || `Durak ${stops.length + 1}`,
      lat: pendingLocation.lat,
      lng: pendingLocation.lng,
      timestamp: new Date().toISOString(),
    };
    setStops((prev) => [...prev, stop]);
    setShowNameInput(false);
    setPendingLocation(null);
    setPendingName("");
  }

  function removeStop(index: number) {
    Alert.alert("Durağı Sil", `"${stops[index].name}" silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => setStops((prev) => prev.filter((_, i) => i !== index)) },
    ]);
  }

  async function handleSave() {
    if (stops.length < 2) {
      Alert.alert("Uyarı", "En az 2 durak işaretlemeniz gerekiyor.");
      return;
    }
    Alert.alert(
      "Teklif Gönder",
      `${stops.length} duraklı güzergah yöneticiye gönderilecek. Onaylayınca aktif olacak.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Gönder", onPress: async () => {
            setSaving(true);
            try {
              const res = await authFetch("/api/mobile/route-proposal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: routeName.trim() || null, stops }),
              });
              if (res.ok) {
                Alert.alert("Gönderildi", "Güzergah teklifiniz yöneticiye iletildi.", [
                  { text: "Tamam", onPress: onBack },
                ]);
              } else {
                const err = await res.json();
                Alert.alert("Hata", err.error ?? "Gönderilemedi");
              }
            } catch {
              Alert.alert("Hata", "Bağlantı hatası");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Güzergah Oluştur</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Güzergah adı */}
        <View style={styles.section}>
          <Text style={styles.label}>Güzergah Adı (isteğe bağlı)</Text>
          <TextInput
            style={styles.input}
            value={routeName}
            onChangeText={setRouteName}
            placeholder="Örn: Sabah Okul Servisi"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Açıklama */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Her durağa geldiğinizde <Text style={styles.infoBold}>"Durak İşaretle"</Text> butonuna basın.
            Konum ve saat otomatik kaydedilir. İsterseniz durak adı girebilirsiniz.
          </Text>
        </View>

        {/* Durak işaretleme butonu */}
        {!showNameInput && (
          <TouchableOpacity
            style={[styles.markBtn, marking && styles.markBtnDisabled]}
            onPress={handleMarkStop}
            disabled={marking}
            activeOpacity={0.85}
          >
            {marking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.markBtnIcon}>📍</Text>
                <Text style={styles.markBtnText}>Durak İşaretle</Text>
                <Text style={styles.markBtnSub}>Bulunduğunuz konum kaydedilir</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Durak adı giriş */}
        {showNameInput && (
          <View style={styles.nameInputBox}>
            <Text style={styles.nameInputLabel}>📍 Konum alındı — Durak adı girin</Text>
            <TextInput
              style={styles.input}
              value={pendingName}
              onChangeText={setPendingName}
              placeholder={`Durak ${stops.length + 1}`}
              placeholderTextColor="#94a3b8"
              autoFocus
            />
            <View style={styles.nameInputBtns}>
              <TouchableOpacity
                style={styles.cancelSmallBtn}
                onPress={() => { setShowNameInput(false); setPendingLocation(null); }}
              >
                <Text style={styles.cancelSmallText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmStop}>
                <Text style={styles.confirmBtnText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Durak listesi */}
        {stops.length > 0 && (
          <View style={styles.stopList}>
            <Text style={styles.stopListTitle}>Duraklar ({stops.length})</Text>
            {stops.map((s, i) => (
              <View key={i} style={styles.stopItem}>
                <View style={[styles.stopBadge, i === 0 && styles.stopFirst, i === stops.length - 1 && styles.stopLast]}>
                  <Text style={styles.stopBadgeText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName}>{s.name}</Text>
                  <Text style={styles.stopCoord}>{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</Text>
                  <Text style={styles.stopTime}>{new Date(s.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
                <TouchableOpacity onPress={() => removeStop(i)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Gönder butonu */}
        {stops.length >= 2 && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.88}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Yöneticiye Gönder ({stops.length} durak)</Text>}
          </TouchableOpacity>
        )}

        {stops.length > 0 && stops.length < 2 && (
          <Text style={styles.hintText}>En az 1 durak daha işaretleyin</Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#1B2437",
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  backBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  backText: { color: "#94a3b8", fontSize: 14 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },

  section: { gap: 6 },
  label: { fontSize: 12, fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: "#1e293b", borderWidth: 1, borderColor: "#e2e8f0",
  },

  infoBox: {
    backgroundColor: "#eff6ff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#bfdbfe",
  },
  infoText: { fontSize: 13, color: "#1d4ed8", lineHeight: 20 },
  infoBold: { fontWeight: "700" },

  markBtn: {
    backgroundColor: "#DC2626", borderRadius: 18, padding: 22,
    alignItems: "center", gap: 4,
  },
  markBtnDisabled: { opacity: 0.6 },
  markBtnIcon: { fontSize: 32 },
  markBtnText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  markBtnSub: { color: "#fca5a5", fontSize: 13 },

  nameInputBox: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 2, borderColor: "#DC2626",
  },
  nameInputLabel: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  nameInputBtns: { flexDirection: "row", gap: 10 },
  cancelSmallBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center",
  },
  cancelSmallText: { color: "#64748b", fontWeight: "600" },
  confirmBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 12,
    backgroundColor: "#DC2626", alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  stopList: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 2 },
  stopListTitle: { fontSize: 13, fontWeight: "700", color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  stopItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  stopBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#94a3b8", alignItems: "center", justifyContent: "center",
  },
  stopFirst: { backgroundColor: "#3b82f6" },
  stopLast: { backgroundColor: "#DC2626" },
  stopBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stopName: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  stopCoord: { fontSize: 11, color: "#94a3b8", fontFamily: "monospace" },
  stopTime: { fontSize: 11, color: "#64748b" },
  removeBtn: { padding: 8 },
  removeBtnText: { color: "#cbd5e1", fontSize: 16 },

  saveBtn: {
    backgroundColor: "#16a34a", borderRadius: 16, paddingVertical: 18,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  hintText: { textAlign: "center", color: "#94a3b8", fontSize: 13 },
});
