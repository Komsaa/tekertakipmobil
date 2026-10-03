import React from "react";
import { Alert, Linking, SafeAreaView, Text, TouchableOpacity } from "react-native";

export default function PrivacyLinks() {
  function open(path: string) {
    Linking.openURL(`https://tekertakip.com${path}`).catch(() =>
      Alert.alert("Bağlantı açılamadı", `Tarayıcınızdan https://tekertakip.com${path} adresini açabilirsiniz.`));
  }
  return (
    <SafeAreaView style={{ backgroundColor: "#f8fafc", flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
      <TouchableOpacity accessibilityRole="link" onPress={() => open("/gizlilik")} style={{ minHeight: 44, padding: 12 }}>
        <Text style={{ color: "#334155", textDecorationLine: "underline" }}>Gizlilik politikası</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="link" onPress={() => open("/gizlilik#hesap-silme")} style={{ minHeight: 44, padding: 12 }}>
        <Text style={{ color: "#334155", textDecorationLine: "underline" }}>Hesap ve veri silme talebi</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
