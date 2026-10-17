// Türkçe veri temizleme yardımcıları. Aktarım betiği ve uygulama ortak kullanır.

/** Boşlukları sadeleştirip Türkçe kurallarla büyük harfe çevirir. */
export function metin(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR");
}

/** Karşılaştırma anahtarı: İ/I/ı farkını ve noktalamayı yok sayar. */
export function anahtar(v: unknown): string {
  return metin(v)
    .replace(/İ/g, "I")
    .replace(/[^0-9A-ZÇĞÖŞÜ]/g, "");
}

/** "1.234,56", "62,5", 1234.5 gibi değerleri sayıya çevirir. Çözülemezse null. */
export function sayi(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[^\d,.\-]/g, "");
  if (!s || s === "-") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Vergi oranını kesre çevirir: "20" -> 0.2, 0.2 -> 0.2, "%8" -> 0.08.
 * 0-100 aralığı dışındaki (bozuk) değerler için null döner.
 */
export function oran(v: unknown): number | null {
  const n = sayi(v);
  if (n === null || n < 0) return null;
  if (n <= 1) return n;
  if (n <= 100) return Math.round(n * 100) / 10000;
  return null;
}

/** TC kimlik numarası algoritma kontrolü. */
export function tcknGecerli(t: string): boolean {
  if (!/^\d{11}$/.test(t) || t[0] === "0") return false;
  const d = t.split("").map(Number);
  const tek = d[0] + d[2] + d[4] + d[6] + d[8];
  const cift = d[1] + d[3] + d[5] + d[7];
  if ((((tek * 7 - cift) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

/** Telefonu 10 haneye (5xxxxxxxxx) indirger. Geçersizse null. */
export function telefon(v: unknown): string | null {
  let t = String(v ?? "").replace(/\D/g, "");
  if (t.startsWith("90") && t.length === 12) t = t.slice(2);
  else if (t.startsWith("0") && t.length === 11) t = t.slice(1);
  return t.length === 10 ? t : null;
}

/** Şase numarası: büyük harf, boşluksuz. */
export function sase(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, "").toUpperCase();
}

/** 17 haneli standart şase (VIN) biçiminde mi? (I, O, Q harfleri kullanılmaz) */
export function vinMi(s: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(s);
}

export function eposta(v: unknown): string | null {
  const e = String(v ?? "").trim().toLocaleLowerCase("tr-TR").replace(/\s/g, "");
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}

/** Kimlik/vergi numarasını sınıflar. */
export function kimlikAyir(v: unknown): { tckn?: string; vkn?: string; gecersiz?: string } {
  const n = String(v ?? "").replace(/\D/g, "");
  if (!n) return {};
  if (n.length === 11) return tcknGecerli(n) ? { tckn: n } : { gecersiz: n };
  if (n.length === 10) return { vkn: n };
  return { gecersiz: n };
}

/** Para değerini 2 haneye yuvarlar. */
export function para(n: number): number {
  return Math.round(n * 100) / 100;
}
