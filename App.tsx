import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import FuelEntryScreen from "./src/screens/FuelEntryScreen";
import ArizaScreen from "./src/screens/ArizaScreen";
import ManagerHomeScreen from "./src/screens/ManagerHomeScreen";
import SeferScreen from "./src/screens/SeferScreen";
import VeliHomeScreen from "./src/screens/VeliHomeScreen";

type Screen = "login" | "home" | "fuel" | "ariza" | "manager" | "sefer" | "veli";

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("mobileToken"),
      AsyncStorage.getItem("managerToken"),
      AsyncStorage.getItem("veliToken"),
    ]).then(([driverToken, managerToken, veliToken]) => {
      if (managerToken) setScreen("manager");
      else if (driverToken) setScreen("home");
      else if (veliToken) setScreen("veli");
      else setScreen("login");
    }).catch(() => setScreen("login"));
  }, []);

  if (screen === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1B2437" }}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  if (screen === "login") return (
    <LoginScreen
      onDriverLogin={() => setScreen("home")}
      onManagerLogin={() => setScreen("manager")}
      onVeliLogin={() => setScreen("veli")}
    />
  );
  if (screen === "fuel") return <FuelEntryScreen onBack={() => setScreen("home")} onSuccess={() => setScreen("home")} />;
  if (screen === "ariza") return <ArizaScreen onBack={() => setScreen("home")} />;
  if (screen === "manager") return <ManagerHomeScreen onLogout={() => setScreen("login")} />;
  if (screen === "sefer") return <SeferScreen onBack={() => setScreen("home")} />;
  if (screen === "veli") return <VeliHomeScreen onLogout={() => setScreen("login")} />;
  return <HomeScreen onLogout={() => setScreen("login")} onFuelEntry={() => setScreen("fuel")} onAriza={() => setScreen("ariza")} onSefer={() => setScreen("sefer")} />;
}
