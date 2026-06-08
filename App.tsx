import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, BackHandler } from "react-native";
import { getSecure } from "./src/lib/secureStorage";
import { API_BASE } from "./src/api/config";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import FuelEntryScreen from "./src/screens/FuelEntryScreen";
import ArizaScreen from "./src/screens/ArizaScreen";
import ManagerHomeScreen from "./src/screens/ManagerHomeScreen";
import SeferScreen from "./src/screens/SeferScreen";
import VeliHomeScreen from "./src/screens/VeliHomeScreen";

type Screen = "login" | "home" | "fuel" | "ariza" | "manager" | "sefer" | "veli";

async function validateToken(token: string, endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status !== 401;
  } catch {
    return true; // Offline ise token'ı geçerli say
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [driverToken, managerToken, veliToken] = await Promise.all([
          getSecure("mobileToken"),
          getSecure("managerToken"),
          getSecure("veliToken"),
        ]);

        if (managerToken && await validateToken(managerToken, "/api/mobile/manager/dashboard")) {
          setScreen("manager");
        } else if (driverToken && await validateToken(driverToken, "/api/mobile/sefer")) {
          setScreen("home");
        } else if (veliToken && await validateToken(veliToken, "/api/mobile/veli/status")) {
          setScreen("veli");
        } else {
          setScreen("login");
        }
      } catch {
        setScreen("login");
      }
    })();
  }, []);

  // Android fiziksel geri tuşu — alt ekranlarda ana ekrana dön
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen === "fuel" || screen === "ariza" || screen === "sefer") {
        setScreen("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen]);

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
