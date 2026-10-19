import type { UrunTur } from "@prisma/client";
import { metin, oran, sayi } from "../normalize";
import type { Hatalar } from "./cari";

export type UrunVeri = {
  kod: string; // boşsa kaydederken türüne göre üretilir
  ad: string;
  tur: Exclude<UrunTur, "ARAC">;
  grupId: number | null;
  markaId: number | null;
  birim: string;
  barkod: string | null;
  kdvOrani: number;
  otvOrani: number;
  fiyatTipi: "SABIT" | "MARJ" | null; // null: formda fiyat alanları yok (maliyet göremeyen kullanıcı), mevcut fiyat korunur
  karOrani: number | null; // maliyet üzerine, 0,30 = %30
  alisFiyati: number | null; // KDV hariç
  satisFiyati: number | null; // KDV dahil
  raf: string | null;
  kritikStok: number | null;
  aktif: boolean;
  not: string | null;
};

export const URUN_TURLERI = ["YEDEK_PARCA", "AKSESUAR", "HIZMET", "DIGER"] as const;
export const KOD_ONEK: Record<string, string> = { YEDEK_PARCA: "YP", AKSESUAR: "AK", HIZMET: "HZ", DIGER: "DG" };
export const BIRIMLER = ["Adet", "Takım", "Çift", "Litre", "Kg", "Metre", "Paket", "Saat"];

export function urunDogrula(f: FormData): { veri: UrunVeri; hatalar: Hatalar } {
  const h: Hatalar = {};
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const kod = metin(s("kod")).replace(/\s+/g, "");
  const ad = metin(s("ad"));
  if (!ad) h.ad = "Ürün adı boş olamaz.";
  const tur = s("tur") as UrunVeri["tur"];
  if (!URUN_TURLERI.includes(tur)) h.tur = "Tür seçilmeli.";
  const kdvOrani = oran(s("kdvOrani") || "0.2");
  if (kdvOrani === null) h.kdvOrani = "KDV oranı geçersiz.";
  const para = (k: string) => {
    if (!s(k)) return null;
    const v = sayi(s(k));
    if (v === null || v < 0) h[k] = "Geçerli bir tutar yazın.";
    return v;
  };
  const otvOrani = oran(s("otvOrani") || "0");
  if (otvOrani === null) h.otvOrani = "ÖTV oranı geçersiz.";
  const fiyatTipi = f.has("fiyatTipi") ? (s("fiyatTipi") === "MARJ" ? "MARJ" : "SABIT") : null;
  let karOrani: number | null = null;
  if (fiyatTipi === "MARJ") {
    const k = sayi(s("karOrani"));
    if (k === null || k <= -100 || k > 10000) h.karOrani = "Kâr oranını yüzde olarak yazın (ör. 35).";
    else karOrani = k / 100;
  }
  const alisFiyati = para("alisFiyati");
  const satisFiyati = para("satisFiyati");
  let kritikStok: number | null = null;
  if (s("kritikStok")) {
    kritikStok = sayi(s("kritikStok"));
    if (kritikStok === null || kritikStok < 0) h.kritikStok = "Geçerli bir miktar yazın.";
  }
  return {
    veri: {
      kod,
      ad,
      tur,
      grupId: Number(s("grupId")) || null,
      markaId: Number(s("markaId")) || null,
      birim: s("birim") || "Adet",
      barkod: s("barkod").replace(/\s+/g, "") || null,
      kdvOrani: kdvOrani ?? 0.2,
      otvOrani: otvOrani ?? 0,
      fiyatTipi,
      karOrani,
      alisFiyati,
      satisFiyati,
      raf: metin(s("raf")) || null,
      kritikStok,
      aktif: f.get("aktif") !== null || f.get("yeni") === "1",
      not: s("not") || null,
    },
    hatalar: h,
  };
}
