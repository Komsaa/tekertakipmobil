export function passengerContact(type: string, passenger: { phone?: string | null; parentPhone?: string | null }) {
  const raw = type === "okul" ? passenger.parentPhone : passenger.phone;
  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return { label: type === "okul" ? "Veliyi ara" : "Personeli ara", phone: raw, uri: `tel:${raw.trim().startsWith("+") ? "+" : ""}${digits}` };
}
