// Akaryakıt fişi ham metninden litre, tutar, KM çıkarır
// ML Kit'ten gelen raw text üzerinde çalışır, API gerektirmez

export interface ParsedReceipt {
  liters: number | null;
  totalAmount: number | null;
  pricePerLiter: number | null;
  odometer: number | null;
  station: string | null;
}

function parseNumber(s: string): number | null {
  // Türkçe format: nokta binlik ayraç, virgül ondalık (3.400,38 → 3400.38)
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const upper = text.toUpperCase();

  let liters: number | null = null;
  let totalAmount: number | null = null;
  let pricePerLiter: number | null = null;
  let odometer: number | null = null;
  let station: string | null = null;

  // --- Litre ---
  // "43,07 LT" veya "43.07 L" veya "LİTRE: 56,95" gibi
  const literPatterns = [
    /(\d{1,3}(?:[.,]\d+)?)\s*(?:LT|L\.?T\.?|LİTRE|LITRE)\b/i,
    /(?:MİKTAR|MIKTAR|LİTRE|LITRE)\s*[:\-]?\s*(\d{1,3}(?:[.,]\d+)?)/i,
  ];
  for (const pat of literPatterns) {
    const m = text.match(pat);
    if (m) { liters = parseNumber(m[1]); break; }
  }

  // --- Toplam tutar ---
  // "TOPLAM: 3.400,38" veya "KDV DAHİL 3400.38" veya "TUTAR 3.837,86"
  const totalPatterns = [
    /(?:TOPLAM\s*TUTAR|KDV\s*DAH[İI]L|GENEL\s*TOPLAM|TOPLAM)[^\d]*(\d{1,5}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i,
    /(?:TUTAR|TAHSILAT)[^\d]*(\d{1,5}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i,
  ];
  for (const pat of totalPatterns) {
    const m = text.match(pat);
    if (m) {
      const val = parseNumber(m[1]);
      // Makul akaryakıt tutarı: 50₺ ile 50.000₺ arası
      if (val && val >= 50 && val <= 50000) { totalAmount = val; break; }
    }
  }

  // Toplam bulunamadıysa sayfadaki en büyük makul sayıyı al
  if (!totalAmount) {
    const allNumbers = [...text.matchAll(/\d{1,5}(?:[.,]\d{3})*[.,]\d{2}/g)]
      .map((m) => parseNumber(m[0]))
      .filter((n): n is number => n !== null && n >= 50 && n <= 50000);
    if (allNumbers.length > 0) totalAmount = Math.max(...allNumbers);
  }

  // --- Litre fiyatı ---
  // "BİRİM FİYAT: 89,95" veya "FİYAT 89,95 TL/LT"
  const ppPattern = /(?:BİRİM\s*F[İI]YAT|F[İI]YAT\s*(?:TL\/LT|₺\/L)?)[^\d]*(\d{1,3}(?:[.,]\d+)?)/i;
  const ppMatch = text.match(ppPattern);
  if (ppMatch) pricePerLiter = parseNumber(ppMatch[1]);

  // --- Kilometre (odometer) ---
  // "KM: 125.400" veya "463958" gibi büyük bir sayı
  // Önce açıkça etiketlenmiş KM ara
  const kmPattern = /(?:KM|KİLOMETRE|ODOMETER|OD)[^\d]*(\d{3,6}(?:[.,]\d{3})*)/i;
  const kmMatch = text.match(kmPattern);
  if (kmMatch) {
    odometer = parseInt(kmMatch[1].replace(/[.,]/g, ""));
  } else {
    // Etiket yoksa: 5-6 basamaklı sayıları bul (90000-999999 arası = olası km)
    const bigNums = [...text.matchAll(/\b(\d{5,6})\b/g)]
      .map((m) => parseInt(m[1]))
      .filter((n) => n >= 10000 && n <= 999999);
    if (bigNums.length === 1) odometer = bigNums[0];
    else if (bigNums.length > 1) {
      // Birden fazlaysa litre/tutar olmayan ilkini al
      odometer = bigNums[0];
    }
  }

  // --- İstasyon adı ---
  // Genellikle ilk 1-2 satırda
  const stationKeywords = ["PETROL", "OPET", "SHELL", "BP", "TOTAL", "MOİL", "AYTEMIZ", "PO", "LUKOIL", "ALPET"];
  for (const line of lines.slice(0, 5)) {
    if (stationKeywords.some((k) => line.toUpperCase().includes(k))) {
      station = line; break;
    }
  }

  return { liters, totalAmount, pricePerLiter, odometer, station };
}
