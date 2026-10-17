const BIRLER = ["", "BİR", "İKİ", "ÜÇ", "DÖRT", "BEŞ", "ALTI", "YEDİ", "SEKİZ", "DOKUZ"];
const ONLAR = ["", "ON", "YİRMİ", "OTUZ", "KIRK", "ELLİ", "ALTMIŞ", "YETMİŞ", "SEKSEN", "DOKSAN"];
const GRUPLAR = ["", "BİN", "MİLYON", "MİLYAR"];

function ucHane(n: number): string {
  const y = Math.floor(n / 100);
  const o = Math.floor((n % 100) / 10);
  const b = n % 10;
  return `${y ? (y > 1 ? BIRLER[y] : "") + "YÜZ" : ""}${ONLAR[o]}${BIRLER[b]}`;
}

/** Tam sayıyı Türkçe yazıya çevirir: 1250 -> "BİNİKİYÜZELLİ" (makbuzlardaki gibi bitişik) */
export function sayiYazi(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "SIFIR";
  const parcalar: string[] = [];
  for (let g = 0; n > 0; g++, n = Math.floor(n / 1000)) {
    const uc = n % 1000;
    if (!uc) continue;
    // "BİRBİN" denmez, "BİN" denir
    parcalar.unshift((g === 1 && uc === 1 ? "" : ucHane(uc)) + GRUPLAR[g]);
  }
  return parcalar.join("");
}

/** Makbuz için: "YALNIZ BİNİKİYÜZELLİ TL OTUZ KURUŞ" */
export function tutarYazi(tutar: number): string {
  const kurus = Math.round(tutar * 100) % 100;
  return `YALNIZ ${sayiYazi(tutar)} TL${kurus ? ` ${sayiYazi(kurus)} KURUŞ` : ""}`;
}
