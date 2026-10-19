export type Birim = "adet" | "tl" | "gun" | "yuzde";

/** eksen ve etiketler için kısa sayı: 1,2 mn ₺, 350 bin ₺, 45 gün */
export function kisa(n: number, birim: Birim) {
  const a = Math.abs(n), isaret = n < 0 ? "−" : "";
  if (birim === "tl") {
    if (a >= 1e6) return `${isaret}${(a / 1e6).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} mn ₺`;
    if (a >= 1e3) return `${isaret}${Math.round(a / 1e3).toLocaleString("tr-TR")} bin ₺`;
    return `${isaret}${Math.round(a).toLocaleString("tr-TR")} ₺`;
  }
  if (birim === "gun") return `${Math.round(n).toLocaleString("tr-TR")} gün`;
  if (birim === "yuzde") return `${isaret}%${a.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}
