import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { API_BASE } from "../api/config";

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

export async function startBackgroundLocation(): Promise<void> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== "granted") throw new Error("foreground_denied");

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== "granted") throw new Error("background_denied");

  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
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
}

export async function stopBackgroundLocation(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}
