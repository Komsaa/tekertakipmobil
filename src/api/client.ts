import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "./config";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("mobileToken");
}

export async function authFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

export async function authFetchMultipart(path: string, formData: FormData) {
  const token = await getToken();
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
