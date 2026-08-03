import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import { authFetch, authFetchMultipart } from "../api/client";
import { parseReceiptText } from "../lib/parseReceiptText";

type Props = { onBack: () => void; onSuccess: () => void };

export default function FuelEntryScreen({ onBack, onSuccess }: Props) {
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseHint, setParseHint] = useState<string | null>(null);
  const [odometer, setOdometer] = useState("");
  const [liters, setLiters] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paymentType, setPaymentType] = useState("veresiye");
  const [loading, setLoading] = useState(false);

  async function uploadAndParse(uri: string) {
    setParsing(true);
    setParseHint(null);
    try {
      // 1. Cihazda ML Kit ile metni oku
      const result = await TextRecognition.recognize(uri);
      const rawText = result.text ?? "";

      // 2. Fotoğrafı sunucuya yükle (depolama için)
      const fd = new FormData();
      fd.append("file", { uri, name: `receipt_${Date.now()}.jpg`, type: "image/jpeg" } as any);
      const up = await authFetchMultipart("/api/mobile/upload", fd);
      if (up.ok) {
        const { url } = await up.json();
        setUploadedUrl(url);
      }

      // 3. Ham metni parse et
      if (!rawText.trim()) {
        setParseHint("Fiş okunamadı, lütfen elle girin.");
        return;
      }

      const parsed = parseReceiptText(rawText);
      const filled: string[] = [];
      if (parsed.liters != null) { setLiters(String(parsed.liters)); filled.push("litre"); }
      if (parsed.totalAmount != null) { setTotalAmount(String(parsed.totalAmount)); filled.push("tutar"); }
      if (parsed.odometer != null) { setOdometer(String(parsed.odometer)); filled.push("KM"); }
      setParseHint(filled.length > 0 ? `Otomatik dolduruldu: ${filled.join(", ")}` : "Fiş okundu ama veri çıkarılamadı, lütfen elle girin.");
    } catch {
      setParseHint("Okuma başarısız, lütfen elle girin.");
    } finally {
      setParsing(false);
    }
  }

  async function pickPhoto(source: "camera" | "gallery") {
    const perm = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("İzin Gerekli", "Fotoğraf erişimi için izin verin."); return; }

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ["images"] });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPhoto({ uri });
      setUploadedUrl(null);
      setParseHint(null);
      uploadAndParse(uri);
    }
  }

  async function handleSubmit() {
    if (!odometer) {
      Alert.alert("Eksik Bilgi", "KM girişi zorunludur.");
      return;
    }
    if (!liters || !totalAmount) {
      Alert.alert("Eksik Bilgi", "Litre ve toplam tutar zorunludur.");
      return;
    }
    setLoading(true);
    try {
      // Fotoğraf parse sırasında zaten yüklendiyse tekrar yükleme
      let receiptPhoto: string | null = uploadedUrl;
      if (photo && !receiptPhoto) {
        const fd = new FormData();
        fd.append("file", { uri: photo.uri, name: `receipt_${Date.now()}.jpg`, type: "image/jpeg" } as any);
        const up = await authFetchMultipart("/api/mobile/upload", fd);
        if (up.ok) receiptPhoto = (await up.json()).url;
      }

      const res = await authFetch("/api/mobile/fuel", {
        method: "POST",
        body: JSON.stringify({
          liters, totalAmount, odometer, paymentType, receiptPhoto,
          date: new Date().toISOString(),
        }),
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

  const canSubmit = !!odometer && !!liters && !!totalAmount && !loading && !parsing;

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>

        <View style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>Yakıt Girişi</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* Fiş fotoğrafı */}
          <Text style={s.label}>FİŞ / KM FOTOĞRAFI</Text>
          {photo ? (
            <View style={s.previewWrap}>
              <Image source={{ uri: photo.uri }} style={s.preview} />
              {parsing && (
                <View style={s.parsingOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.parsingText}>Fiş okunuyor...</Text>
                </View>
              )}
              <TouchableOpacity style={s.removeBtn} onPress={() => { setPhoto(null); setUploadedUrl(null); setParseHint(null); }}>
                <Text style={s.removeBtnText}>✕ Kaldır</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.photoRow}>
              <TouchableOpacity style={[s.photoBtn, { flex: 1 }]} onPress={() => pickPhoto("camera")}>
                <Text style={s.photoBtnText}>📷  Fotoğraf Çek</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.photoBtn, { flex: 1 }]} onPress={() => pickPhoto("gallery")}>
                <Text style={s.photoBtnText}>🖼️  Galeriden</Text>
              </TouchableOpacity>
            </View>
          )}

          {parseHint && (
            <Text style={[s.hint, parseHint.startsWith("Otomatik") ? s.hintOk : s.hintWarn]}>
              {parseHint.startsWith("Otomatik") ? "✓ " : "⚠ "}{parseHint}
            </Text>
          )}

          {/* KM */}
          <Text style={s.label}>KM (GÖSTERGE) *</Text>
          <TextInput
            style={s.input}
            value={odometer}
            onChangeText={setOdometer}
            keyboardType="number-pad"
            placeholder="125400"
            placeholderTextColor="#94a3b8"
          />

          {/* Litre */}
          <Text style={s.label}>LİTRE *</Text>
          <TextInput
            style={s.input}
            value={liters}
            onChangeText={setLiters}
            keyboardType="decimal-pad"
            placeholder="56.95"
            placeholderTextColor="#94a3b8"
          />

          {/* Toplam Tutar */}
          <Text style={s.label}>TOPLAM TUTAR (₺) *</Text>
          <TextInput
            style={[s.input, s.inputBig]}
            value={totalAmount}
            onChangeText={setTotalAmount}
            keyboardType="decimal-pad"
            placeholder="3837.86"
            placeholderTextColor="#94a3b8"
          />

          {/* Ödeme tipi */}
          <Text style={s.label}>ÖDEME TİPİ</Text>
          <View style={s.paymentRow}>
            {(["veresiye", "nakit", "kart"] as const).map((pt) => (
              <TouchableOpacity
                key={pt}
                style={[s.paymentOpt, paymentType === pt && s.paymentOptActive]}
                onPress={() => setPaymentType(pt)}
              >
                <Text style={[s.paymentOptText, paymentType === pt && s.paymentOptTextActive]}>
                  {pt.charAt(0).toUpperCase() + pt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitBtnText}>⛽  Kaydet</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: "#1B2437", flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", padding: 16, paddingTop: 20,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backText: { color: "#fff", fontSize: 22 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  content: { padding: 24, gap: 10 },
  label: { fontSize: 11, fontWeight: "700", color: "#94a3b8", letterSpacing: 1.5, marginTop: 8 },
  photoRow: { flexDirection: "row", gap: 10 },
  photoBtn: {
    backgroundColor: "#fff", borderRadius: 14, padding: 18,
    alignItems: "center", borderWidth: 1.5, borderColor: "#e2e8f0", borderStyle: "dashed",
  },
  photoBtnText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  previewWrap: { borderRadius: 14, overflow: "hidden", position: "relative" },
  preview: { width: "100%", height: 180, borderRadius: 14 },
  removeBtn: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  removeBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  input: {
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 12, padding: 14, fontSize: 16, color: "#1e293b",
  },
  inputBig: { fontSize: 22, fontWeight: "700", color: "#DC2626" },
  paymentRow: { flexDirection: "row", gap: 10 },
  paymentOpt: {
    flex: 1, borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#fff",
  },
  paymentOptActive: { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
  paymentOptText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  paymentOptTextActive: { color: "#DC2626" },
  submitBtn: { backgroundColor: "#DC2626", borderRadius: 16, padding: 18, alignItems: "center", marginTop: 16 },
  submitBtnDisabled: { backgroundColor: "#fca5a5" },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  parsingOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.6)", padding: 10,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  parsingText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  hint: { borderRadius: 10, padding: 10, fontSize: 13, fontWeight: "600" },
  hintOk: { backgroundColor: "#f0fdf4", color: "#16a34a" },
  hintWarn: { backgroundColor: "#fff7ed", color: "#ea580c" },
});
