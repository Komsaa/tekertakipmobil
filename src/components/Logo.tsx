import React from "react";
import Svg, { Path, Line, Circle } from "react-native-svg";
import { View, Text, StyleSheet } from "react-native";

type LogoIconProps = { size?: number; color?: string };

export function LogoIcon({ size = 36, color = "#fff" }: LogoIconProps) {
  const bg = color === "#fff" ? "rgba(255,255,255,0.15)" : "#1B2437";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 100 100" fill="none">
        {/* Dış direksiyon halkası */}
        <Circle cx="50" cy="50" r="35" stroke={color} strokeWidth="6" />
        {/* 3 kol (120° aralıklı) */}
        <Line x1="50" y1="38" x2="50" y2="15" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <Line x1="60.4" y1="56" x2="80.3" y2="67.5" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <Line x1="39.6" y1="56" x2="19.7" y2="67.5" stroke={color} strokeWidth="5" strokeLinecap="round" />
        {/* Merkez hub */}
        <Circle cx="50" cy="50" r="12" fill="#1B2437" stroke={color} strokeWidth="3" />
        {/* Kırmızı lokasyon pini */}
        <Path d="M 50,57 L 45,49.3 A 6,6 0 1,1 55,49.3 Z" fill="#DC2626" />
        {/* Beyaz iç nokta */}
        <Circle cx="50" cy="45" r="2" fill="white" />
      </Svg>
    </View>
  );
}

type LogoFullProps = { size?: number; textSize?: number };

export function LogoFull({ size = 36, textSize = 26 }: LogoFullProps) {
  return (
    <View style={styles.row}>
      <LogoIcon size={size} color="#fff" />
      <Text style={[styles.brand, { fontSize: textSize }]}>
        teker<Text style={styles.brandRed}>takip</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  brand: { fontWeight: "900", color: "#fff", letterSpacing: 1 },
  brandRed: { color: "#DC2626" },
});
