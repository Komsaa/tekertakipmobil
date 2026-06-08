import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { authFetch, authFetchMultipart } from "../api/client";

type Props = { onBack: () => void; onSuccess: () => void };

export default function FuelEntryScreen({ onBack, onSuccess }: Props) {
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);
  const [odometer, setOdometer] = useState("");
  const [liters, setLiters] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paymentType, setPaymentType] = useState("veresiye");
  const [loading, setLoading] = useState(false);

  async function pickPhoto(source: "camera" | "gallery") {
    const perm = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("İzin Gerekli", "Fotoğraf erişimi için izin verin."); return; }

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ["images"] });

    if (!result.canceled && result.assets[0]) setPhoto({ uri: result.assets[0].uri });
  }

  async function handleSubmit() {
    if (!photo) {
      Alert.alert("Eksik Bilgi", "Fiş fotoğrafı zorunludur.");
      return;
    }
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
      let receiptPhoto: string | null = null;
      if (photo) {
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

  const canSubmit = !!photo && !!odometer && !!liters && !!totalAmount && !loading;

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>

        <View style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>Yakıt Girişi</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.content}>

          {/* Fiş fotoğrafı */}
          <Text style={s.label}>FİŞ FOTOĞRAFI *</Text>
          {photo ? (
            <View style={s.previewWrap}>
              <Image source={{ uri: photo.uri }} style={s.preview} />
              <TouchableOpacity style={s.removeBtn} onPress={() => setPhoto(null)}>
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
});
