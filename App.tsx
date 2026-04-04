import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import FuelEntryScreen from "./src/screens/FuelEntryScreen";
import ArizaScreen from "./src/screens/ArizaScreen";

type Screen = "login" | "home" | "fuel" | "ariza";

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("mobileToken")
      .then((token) => setScreen(token ? "home" : "login"))
      .catch(() => setScreen("login"));
  }, []);

  if (screen === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1B2437" }}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  if (screen === "login") return <LoginScreen onLogin={() => setScreen("home")} />;
  if (screen === "fuel") return <FuelEntryScreen onBack={() => setScreen("home")} onSuccess={() => setScreen("home")} />;
  if (screen === "ariza") return <ArizaScreen onBack={() => setScreen("home")} />;
  return <HomeScreen onLogout={() => setScreen("login")} onFuelEntry={() => setScreen("fuel")} onAriza={() => setScreen("ariza")} />;
}
