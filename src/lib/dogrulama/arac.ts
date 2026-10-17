import { metin, oran, sase as saseCoz, sayi } from "../normalize";
import type { Hatalar } from "./cari";

export const MALIYET_TURLERI = [
  ["ALIS", "Alış (iskontolu, KDV hariç)"],
  ["OTV", "ÖTV"],
  ["KDV_FARKI", "KDV farkı"],
  ["AKSESUAR", "Aksesuar"],
  ["POS", "POS masrafı"],
  ["NAKLIYE", "Nakliye"],
  ["DIGER", "Diğer"],
] as const;
export type MaliyetTurKod = (typeof MALIYET_TURLERI)[number][0];

export type AracVeri = {
  sase: string;
  motorNo: string | null;
  modelId: number | null;
  yil: number | null;
  renk: string | null;
  euroStandart: string | null;
  kondisyon: "SIFIR" | "IKINCI_EL" | "KONSINYE";
  konumId: number | null;
  gelisTarihi: Date | null;
  tedarikciId: number | null;
  alisFaturaNo: string | null;
  alisSekli: string | null;
  kdvOrani: number | null;
  otvOrani: number | null;
  tescilDurum: "TESCILSIZ" | "BASVURUDA" | "TESCILLI";
  plaka: string | null;
  ruhsatSeriNo: string | null;
  tescilTarihi: Date | null;
  not: string | null;
};

const bos = (v: string) => (v ? v : null);
const tamsayi = (v: string) => (/^\d+$/.test(v) ? Number(v) : null);
const gun = (v: string) => {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export function aracDogrula(g: Record<string, string | undefined>): { veri: AracVeri; maliyetler: { tur: MaliyetTurKod; tutar: number }[]; hatalar: Hatalar } {
  const h: Hatalar = {};
  const s = (k: string) => (g[k] ?? "").trim();
  const sase = saseCoz(s("sase"));
  if (!sase) h.sase = "Şase numarası boş olamaz.";
  else if (sase.length < 6) h.sase = "Şase numarası çok kısa.";
  const yil = tamsayi(s("yil"));
  if (s("yil") && (!yil || yil < 1980 || yil > new Date().getFullYear() + 1)) h.yil = "Model yılı geçersiz.";
  const gelisTarihi = gun(s("gelisTarihi"));
  if (gelisTarihi === undefined) h.gelisTarihi = "Tarih geçersiz.";
  const tescilTarihi = gun(s("tescilTarihi"));
  if (tescilTarihi === undefined) h.tescilTarihi = "Tarih geçersiz.";
  const kdvOrani = s("kdvOrani") ? oran(s("kdvOrani")) : null;
  if (s("kdvOrani") && kdvOrani === null) h.kdvOrani = "KDV oranı geçersiz.";
  const otvOrani = s("otvOrani") ? oran(s("otvOrani")) : null;
  const tescilDurum = (["TESCILSIZ", "BASVURUDA", "TESCILLI"] as const).find((t) => t === s("tescilDurum")) ?? "TESCILSIZ";
  const plaka = metin(s("plaka")).replace(/\s/g, "");
  if (tescilDurum === "TESCILLI" && !plaka) h.plaka = "Tescilli araç için plaka gerekli.";

  const maliyetler: { tur: MaliyetTurKod; tutar: number }[] = [];
  for (const [tur] of MALIYET_TURLERI) {
    const ham = s(`maliyet_${tur}`);
    if (!ham) continue;
    const n = sayi(ham);
    if (n === null) h[`maliyet_${tur}`] = "Tutar geçersiz.";
    else if (n !== 0) maliyetler.push({ tur, tutar: Math.round(n * 100) / 100 });
  }

  return {
    veri: {
      sase,
      motorNo: bos(saseCoz(s("motorNo"))),
      modelId: tamsayi(s("modelId")),
      yil,
      renk: bos(metin(s("renk"))),
      euroStandart: bos(metin(s("euroStandart"))),
      kondisyon: (["SIFIR", "IKINCI_EL", "KONSINYE"] as const).find((k) => k === s("kondisyon")) ?? "SIFIR",
      konumId: tamsayi(s("konumId")),
      gelisTarihi: gelisTarihi ?? null,
      tedarikciId: tamsayi(s("tedarikciId")),
      alisFaturaNo: bos(metin(s("alisFaturaNo"))),
      alisSekli: bos(metin(s("alisSekli"))),
      kdvOrani,
      otvOrani,
      tescilDurum,
      plaka: bos(plaka),
      ruhsatSeriNo: bos(metin(s("ruhsatSeriNo"))),
      tescilTarihi: tescilTarihi ?? null,
      not: bos(s("not")),
    },
    maliyetler,
    hatalar: h,
  };
}
