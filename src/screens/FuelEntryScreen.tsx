import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { authFetch, authFetchMultipart } from "../api/client";

type Props = {
  onBack: () => void;
  onSuccess: () => void;
};

export default function FuelEntryScreen({ onBack, onSuccess }: Props) {
  const [receipt, setReceipt] = useState<{ uri: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [form, setForm] = useState({
    odometer: "",
    liters: "",
    pricePerLiter: "",
    totalAmount: "",
    station: "",
    paymentType: "veresiye",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "liters" || field === "pricePerLiter") {
        const l = parseFloat(field === "liters" ? value : prev.liters);
        const p = parseFloat(field === "pricePerLiter" ? value : prev.pricePerLiter);
        if (!isNaN(l) && !isNaN(p)) next.totalAmount = (l * p).toFixed(2);
      }
      if (field === "totalAmount" && next.liters) {
        const l = parseFloat(next.liters);
        const t = parseFloat(value);
        if (!isNaN(l) && !isNaN(t) && l > 0) next.pricePerLiter = (t / l).toFixed(4);
      }
      return next;
    });
  }

  async function pickImage(source: "camera" | "gallery") {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert("İzin Gerekli", "Fotoğraf erişimi için izin verin.");
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.8, base64: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setReceipt({ uri });
      await uploadAndParse(uri);
    }
  }

  async function uploadAndParse(uri: string) {
    setParsing(true);
    try {
      // 1. Fotoğrafı yükle
      const formData = new FormData();
      formData.append("file", { uri, name: `receipt_${Date.now()}.jpg`, type: "image/jpeg" } as any);
      const uploadRes = await authFetchMultipart("/api/mobile/upload", formData);
      if (!uploadRes.ok) return;
      const { url: photoUrl } = await uploadRes.json();

      // 2. Fişi AI ile oku
      const parseRes = await authFetch("/api/mobile/parse-receipt", {
        method: "POST",
        body: JSON.stringify({ photoUrl }),
      });
      if (!parseRes.ok) return;
      const { parsed } = await parseRes.json();
      if (!parsed) return;

      // 3. Formu doldur
      if (parsed) {
        setForm((prev) => ({
          ...prev,
          liters: parsed.liters != null ? String(parsed.liters) : prev.liters,
          totalAmount: parsed.totalAmount != null ? String(parsed.totalAmount) : prev.totalAmount,
          pricePerLiter: parsed.pricePerLiter != null ? String(parsed.pricePerLiter) : prev.pricePerLiter,
          station: parsed.station || prev.station,
        }));
      } else {
        Alert.alert("Fiş okunamadı", "Bilgileri manuel olarak girin.");
      }
    } catch {
      Alert.alert("Fiş okunamadı", "Bilgileri manuel olarak girin.");
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit() {
    if (!form.liters || !form.totalAmount) {
      Alert.alert("Eksik Bilgi", "Litre ve toplam tutar zorunludur.");
      return;
    }
    setLoading(true);
    try {
      let receiptPhoto: string | null = null;
      if (receipt) {
        const formData = new FormData();
        formData.append("file", { uri: receipt.uri, name: `receipt_${Date.now()}.jpg`, type: "image/jpeg" } as any);
        const uploadRes = await authFetchMultipart("/api/mobile/upload", formData);
        if (uploadRes.ok) receiptPhoto = (await uploadRes.json()).url;
      }

      const res = await authFetch("/api/mobile/fuel", {
        method: "POST",
        body: JSON.stringify({ ...form, receiptPhoto, date: new Date().toISOString() }),
      });

      if (!res.ok) {
        const err = await res.json();
        Alert.alert("Hata", err.error || "Kayıt yapılamadı");
        return;
      }

      Alert.alert("Kaydedildi!", "Yakıt girişi başarıyla kaydedildi.", [
        { text: "Tamam", onPress: onSuccess },
      ]);
    } catch {
      Alert.alert("Bağlantı Hatası", "Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Yakıt Girişi</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

          {/* Fiş fotoğrafı */}
          <Text style={styles.sectionLabel}>FİŞ FOTOĞRAFI</Text>
          <View style={styles.photoRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage("camera")} disabled={parsing}>
              <Text style={styles.photoBtnIcon}>📷</Text>
              <Text style={styles.photoBtnText}>Fotoğraf Çek</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage("gallery")} disabled={parsing}>
              <Text style={styles.photoBtnIcon}>🖼️</Text>
              <Text style={styles.photoBtnText}>Galeriden Seç</Text>
            </TouchableOpacity>
          </View>

          {receipt && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: receipt.uri }} style={styles.preview} />
              {parsing && (
                <View style={styles.parsingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.parsingText}>Fiş okunuyor...</Text>
                </View>
              )}
              {!parsing && (
                <TouchableOpacity style={styles.removePhoto} onPress={() => setReceipt(null)}>
                  <Text style={styles.removePhotoText}>✕ Kaldır</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* KM */}
          <Text style={styles.sectionLabel}>ARAÇ BİLGİSİ</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>KM (Gösterge)</Text>
            <TextInput
              style={styles.input}
              value={form.odometer}
              onChangeText={(v) => set("odometer", v)}
              keyboardType="number-pad"
              placeholder="125400"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {/* Yakıt bilgileri */}
          <Text style={styles.sectionLabel}>
            YAKIT BİLGİSİ {parsing ? "— 🤖 Okunuyor..." : form.liters ? "— ✓ Otomatik dolduruldu" : ""}
          </Text>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.fieldLabel}>Litre *</Text>
              <TextInput
                style={styles.input}
                value={form.liters}
                onChangeText={(v) => set("liters", v)}
                keyboardType="decimal-pad"
                placeholder="56.95"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.fieldLabel}>₺ / Litre</Text>
              <TextInput
                style={styles.input}
                value={form.pricePerLiter}
                onChangeText={(v) => set("pricePerLiter", v)}
                keyboardType="decimal-pad"
                placeholder="67.39"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Toplam Tutar (₺) *</Text>
            <TextInput
              style={[styles.input, styles.inputBig]}
              value={form.totalAmount}
              onChangeText={(v) => set("totalAmount", v)}
              keyboardType="decimal-pad"
              placeholder="3837.86"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <Text style={styles.sectionLabel}>DİĞER</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>İstasyon</Text>
            <TextInput
              style={styles.input}
              value={form.station}
              onChangeText={(v) => set("station", v)}
              placeholder="İstasyon adı"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Ödeme Tipi</Text>
            <View style={styles.paymentRow}>
              {["veresiye", "nakit", "kart"].map((pt) => (
                <TouchableOpacity
                  key={pt}
                  style={[styles.paymentOpt, form.paymentType === pt && styles.paymentOptActive]}
                  onPress={() => set("paymentType", pt)}
                >
                  <Text style={[styles.paymentOptText, form.paymentType === pt && styles.paymentOptTextActive]}>
                    {pt.charAt(0).toUpperCase() + pt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Not (opsiyonel)</Text>
            <TextInput
              style={[styles.input, { height: 72, textAlignVertical: "top" }]}
              value={form.notes}
              onChangeText={(v) => set("notes", v)}
              multiline
              placeholder="Varsa notunuzu yazın..."
              placeholderTextColor="#94a3b8"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (loading || parsing) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading || parsing}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>⛽ Kaydet</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { backgroundColor: "#1B2437", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 20 },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backText: { color: "#fff", fontSize: 22, fontWeight: "300" },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#94a3b8", letterSpacing: 1.5, marginBottom: 10, marginTop: 20 },
  photoRow: { flexDirection: "row", gap: 12 },
  photoBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 20, alignItems: "center", borderWidth: 1.5, borderColor: "#e2e8f0", borderStyle: "dashed" },
  photoBtnIcon: { fontSize: 28, marginBottom: 6 },
  photoBtnText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  previewWrap: { marginTop: 12, borderRadius: 14, overflow: "hidden", position: "relative" },
  preview: { width: "100%", height: 200, borderRadius: 14 },
  parsingOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", gap: 8 },
  parsingText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  removePhoto: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  removePhotoText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 },
  input: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 12, padding: 12, fontSize: 16, color: "#1e293b" },
  inputBig: { fontSize: 20, fontWeight: "700", color: "#DC2626" },
  row: { flexDirection: "row" },
  paymentRow: { flexDirection: "row", gap: 10 },
  paymentOpt: { flex: 1, borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, alignItems: "center", backgroundColor: "#fff" },
  paymentOptActive: { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
  paymentOptText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  paymentOptTextActive: { color: "#DC2626" },
  submitBtn: { backgroundColor: "#DC2626", borderRadius: 16, padding: 18, alignItems: "center", marginTop: 24 },
  submitBtnDisabled: { backgroundColor: "#fca5a5" },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
