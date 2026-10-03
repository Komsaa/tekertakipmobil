import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { API_BASE } from "../api/config";
import { Alert } from "react-native";

export const LOCATION_TASK = "tekertakip-location";

// Background task — uygulama arka planda/kapalıyken de çalışır
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  if (error) return;
  const locations = data?.locations;
  if (!locations?.length) return;

  const { latitude, longitude } = locations[locations.length - 1].coords;

  try {
    const token = await SecureStore.getItemAsync("mobileToken");
    if (!token) return;

    await fetch(`${API_BASE}/api/mobile/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ latitude, longitude }),
    });
  } catch { /* ağ hatası — sessizce geç */ }
});

export async function startBackgroundLocation(isCancelled: () => boolean = () => false): Promise<void> {
  const accepted = await new Promise<boolean>((resolve) => {
    Alert.alert("Sefer sırasında konum paylaşımı",
      "TekerTakip, canlı servis takibi için cihazınızın konumunu toplar ve sunucuya gönderir. Takip açıkken uygulama arka planda veya ekran kilitliyken de devam eder. Konumunuz firma yöneticisi ve ilgili velilerle paylaşılır; güzergah geçmişi saklanır. Sefer ekranından çıkarak takibi durdurabilir, cihaz ayarlarından izni kaldırabilirsiniz. Reddederseniz konum paylaşmadan devam edebilirsiniz.",
      [{ text: "Şimdi değil", style: "cancel", onPress: () => resolve(false) },
       { text: "Kabul et ve devam et", onPress: () => resolve(true) }],
      { cancelable: true, onDismiss: () => resolve(false) });
  });
  if (!accepted || isCancelled()) return;
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (isCancelled()) return;
  if (fg !== "granted") throw new Error("foreground_denied");

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (isCancelled()) return;
  if (bg !== "granted") throw new Error("background_denied");

  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (isCancelled()) return;
  if (already) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 10_000,       // en az 10 saniyede bir
    distanceInterval: 30,       // veya 30 metre hareket edince
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "TekerTakip",
      notificationBody: "Konum takibi aktif",
      notificationColor: "#DC2626",
    },
  });
  if (isCancelled()) await stopBackgroundLocation();
}

export async function stopBackgroundLocation(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}
