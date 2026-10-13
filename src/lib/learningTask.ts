import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import { authFetch } from "../api/client";
import { stopBackgroundLocation } from "./locationTask";

const TASK = "tekertakip-learning";
type Sample = { latitude: number; longitude: number; accuracy: number; timestamp: number };
export type Recording = { id: string; startedAt: string; expiresAt: string; endedAt?: number; uploaded: number; last?: Sample; error?: string };
let connection: ReturnType<typeof SQLite.openDatabaseAsync> | undefined;
async function db() {
  if (!connection) connection = (async () => {
    const d = await SQLite.openDatabaseAsync("route-learning.db");
    await d.execAsync("PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS points (timestamp INTEGER PRIMARY KEY, value TEXT NOT NULL);");
    return d;
  })();
  return connection;
}
let serial: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = serial.then(fn, fn); serial = next.catch(() => {}); return next;
}
async function read() {
  const row = await (await db()).getFirstAsync<{ value: string }>("SELECT value FROM state WHERE id = 1");
  return row ? JSON.parse(row.value) as Recording : null;
}
async function save(state: Recording) {
  await (await db()).runAsync("INSERT OR REPLACE INTO state (id, value) VALUES (1, ?)", JSON.stringify(state));
}
async function post(body: unknown) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await authFetch("/api/mobile/learning", { method: "POST", body: JSON.stringify(body), signal: controller.signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Konum gönderilemedi");
    return data;
  } finally { clearTimeout(timeout); }
}
async function stopDevice() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(TASK);
}
async function sync(state: Recording, drain = false) {
  do {
    const rows = await (await db()).getAllAsync<{ timestamp: number; value: string }>("SELECT timestamp, value FROM points ORDER BY timestamp LIMIT 200");
    if (!rows.length) break;
    await post({ action: "points", sessionId: state.id, points: rows.map(r => JSON.parse(r.value)) });
    await (await db()).runAsync("DELETE FROM points WHERE timestamp <= ?", rows.at(-1)!.timestamp);
    state.uploaded += rows.length;
    await save(state);
    if (!drain) break;
  } while (true);
  if (state.endedAt && !(await (await db()).getFirstAsync("SELECT timestamp FROM points LIMIT 1"))) {
    await post({ action: "finish", sessionId: state.id, endedAt: state.endedAt });
    await (await db()).runAsync("DELETE FROM state WHERE id = 1");
    await SecureStore.deleteItemAsync("learningOwnerToken");
  }
}

TaskManager.defineTask(TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => exclusive(async () => {
  const state = await read();
  if (!state) { await stopDevice(); return; }
  const owner = await SecureStore.getItemAsync("learningOwnerToken"), token = await SecureStore.getItemAsync("mobileToken");
  if (!token || token !== owner) { state.endedAt ??= Date.now(); await save(state); await stopDevice(); return; }
  if (error) { state.error = "GPS konumu alınamıyor. Konum iznini kontrol edin."; await save(state); return; }
  if (state.endedAt) { await stopDevice(); return; }
  for (const location of [...(data?.locations ?? [])].sort((a, b) => a.timestamp - b.timestamp)) {
    const { latitude, longitude, accuracy, speed } = location.coords;
    if (location.timestamp < +new Date(state.startedAt) || location.timestamp > +new Date(state.expiresAt) || accuracy == null || accuracy > 50 || accuracy < 0) continue;
    const prev = state.last;
    const distance = prev ? Math.hypot((latitude - prev.latitude) * 111320, (longitude - prev.longitude) * 111320 * Math.cos(latitude * Math.PI / 180)) : Infinity;
    const interval = (speed ?? 0) > 1 || distance >= 5 ? 3000 : 15000;
    if (prev && location.timestamp - prev.timestamp < interval) continue;
    const point = { latitude, longitude, accuracy, timestamp: location.timestamp };
    await (await db()).runAsync("INSERT OR IGNORE INTO points (timestamp, value) VALUES (?, ?)", point.timestamp, JSON.stringify(point));
    state.last = point;
  }
  if (Date.now() >= +new Date(state.expiresAt)) { state.endedAt = +new Date(state.expiresAt); await stopDevice(); }
  state.error = undefined;
  await save(state);
  try { await sync(state); }
  catch { state.error = "Bağlantı bekleniyor. Konumlar telefonda saklanıyor."; await save(state); }
}));

export async function recordingStatus() {
  return exclusive(async () => {
    const state = await read();
    if (state && !state.endedAt && Date.now() >= +new Date(state.expiresAt)) {
      state.endedAt = +new Date(state.expiresAt); await save(state); await stopDevice();
    }
    const count = await (await db()).getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM points");
    const running = await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false);
    return { state, pending: count?.count ?? 0, running };
  });
}

export async function beginLearning(vehicleId: string) {
  const consent = await new Promise<boolean>(resolve => Alert.alert("Güzergâh öğrenme",
    "Başlattığınız servis boyunca konumunuz, ekran kilitliyken de kaydedilir ve firmanız için güzergâh taslağı oluşturmakta kullanılır. Hareket sırasında yaklaşık 3 saniyede bir kayıt alınır. Bitir düğmesi kaydı durdurur; güvenlik sınırı 8 saattir. İnternet kesilirse kayıtlar telefonda bekler.",
    [{ text: "Vazgeç", style: "cancel", onPress: () => resolve(false) }, { text: "Kabul et ve başla", onPress: () => resolve(true) }],
    { cancelable: true, onDismiss: () => resolve(false) }));
  if (!consent) return;
  if ((await Location.requestForegroundPermissionsAsync()).status !== "granted" || (await Location.requestBackgroundPermissionsAsync()).status !== "granted") throw new Error("Kayıt için ön ve arka plan konum izni gerekli.");
  return exclusive(async () => {
    if (await read()) throw new Error("Önce önceki seferin kayıtlarını gönderin.");
    const token = await SecureStore.getItemAsync("mobileToken");
    if (!token) throw new Error("Tekrar giriş yapın.");
    const { session } = await post({ action: "start", vehicleId });
    const state: Recording = { id: session.id, startedAt: session.startedAt, expiresAt: session.expiresAt, uploaded: 0 };
    await SecureStore.setItemAsync("learningOwnerToken", token);
    await save(state);
    try {
      await stopBackgroundLocation();
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 0,
        pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
        foregroundService: { notificationTitle: "TekerTakip • Öğrenme", notificationBody: "Servis konumu kaydediliyor. Bitirmek için uygulamayı açın.", notificationColor: "#DC2626" },
      });
    } catch (error) { state.endedAt = Date.now(); await save(state); throw error; }
  });
}
export async function finishLearning() {
  const requestedAt = Date.now();
  await stopDevice();
  return exclusive(async () => {
    const state = await read();
    if (!state) return;
    // Persist the stop before networking: an offline finish must stop collection too.
    state.endedAt ??= Math.min(requestedAt, +new Date(state.expiresAt));
    await save(state);
    await stopDevice();
    await sync(state, true);
  });
}
