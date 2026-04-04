import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { authFetch, authFetchMultipart } from "../api/client";

type Props = { onBack: () => void };

export default function ArizaScreen({ onBack }: Props) {
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickPhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("İzin gerekli"); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) setPhoto({ uri: result.assets[0].uri });
  }

  async function handleSubmit() {
    if (!description.trim()) { Alert.alert("Açıklama girin"); return; }
    setLoading(true);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        const fd = new FormData();
        fd.append("file", { uri: photo.uri, name: `ariza_${Date.now()}.jpg`, type: "image/jpeg" } as any);
        const up = await authFetchMultipart("/api/mobile/upload", fd);
        if (up.ok) photoUrl = (await up.json()).url;
      }
      const res = await authFetch("/api/mobile/ariza", {
        method: "POST",
        body: JSON.stringify({ description, photoUrl }),
      });
      if (!res.ok) { Alert.alert("Hata", "Gönderilemedi"); return; }
      Alert.alert("Gönderildi", "Arıza bildirimi yöneticiye iletildi.", [
        { text: "Tamam", onPress: onBack },
      ]);
    } catch {
      Alert.alert("Bağlantı Hatası", "Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>Arıza Bildirimi</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.label}>SORUN NE?</Text>
          <TextInput
            style={[s.input, { height: 120, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Arıza veya sorunu kısaca açıklayın..."
            placeholderTextColor="#94a3b8"
            multiline
          />

          <Text style={s.label}>FOTOĞRAF (opsiyonel)</Text>
          <TouchableOpacity style={s.photoBtn} onPress={pickPhoto}>
            <Text style={s.photoBtnText}>{photo ? "✓ Fotoğraf eklendi — değiştir" : "📷 Fotoğraf Çek"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.submitBtn, (!description.trim() || loading) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!description.trim() || loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>🔧 Bildir</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { backgroundColor: "#1B2437", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 20 },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backText: { color: "#fff", fontSize: 22 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  content: { padding: 24, gap: 12 },
  label: { fontSize: 11, fontWeight: "700", color: "#94a3b8", letterSpacing: 1.5, marginTop: 8 },
  input: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 12, padding: 14, fontSize: 16, color: "#1e293b" },
  photoBtn: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 12, padding: 16, alignItems: "center" },
  photoBtnText: { color: "#475569", fontWeight: "600", fontSize: 15 },
  submitBtn: { backgroundColor: "#DC2626", borderRadius: 14, padding: 18, alignItems: "center", marginTop: 16 },
  submitBtnDisabled: { backgroundColor: "#fca5a5" },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
