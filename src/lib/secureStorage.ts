import * as SecureStore from "expo-secure-store";

// Token anahtarları
export const KEYS = {
  mobileToken: "mobileToken",
  managerToken: "managerToken",
  managerUsername: "managerUsername",
  veliToken: "veliToken",
  driverData: "driverData",
  veliData: "veliData",
} as const;

export async function getSecure(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setSecure(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecure(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

export async function deleteSecureMany(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => SecureStore.deleteItemAsync(k)));
}
