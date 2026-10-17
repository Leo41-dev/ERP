import { oran, sayi } from "../normalize";
import type { OdemeSatiri } from "../satis/hesap";
import type { Hatalar } from "./cari";

const YONTEMLER = ["HAVALE", "KART", "NAKIT", "SENET", "CEK", "DIGER"] as const;

export type SatisVeri = {
  aracId: number;
  genelToplam: number;
  kdvOrani: number;
  otvOrani: number;
  teslimTarihi: Date | null;
  aksesuarlar: string | null;
  hizmetler: string | null;
  not: string | null;
  odemeler: OdemeSatiri[];
};

export function satisDogrula(f: FormData): { veri: SatisVeri; hatalar: Hatalar } {
  const h: Hatalar = {};
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const aracId = Number(s("aracId"));
  if (!Number.isInteger(aracId) || aracId <= 0) h.aracId = "Araç seçilmeli.";
  const genelToplam = sayi(s("genelToplam")) ?? 0;
  if (!(genelToplam > 0)) h.genelToplam = "Satış tutarı girilmeli.";
  const kdvOrani = oran(s("kdvOrani"));
  if (kdvOrani === null) h.kdvOrani = "KDV oranı seçilmeli.";
  const otvOrani = s("otvOrani") === "" ? null : oran(s("otvOrani"));
  if (otvOrani === null) h.otvOrani = "ÖTV oranı seçilmeli (ÖTV yoksa %0).";
  let teslimTarihi: Date | null = null;
  if (s("teslimTarihi")) {
    teslimTarihi = new Date(`${s("teslimTarihi")}T00:00:00Z`);
    if (Number.isNaN(teslimTarihi.getTime())) h.teslimTarihi = "Tarih geçersiz.";
  }

  const odemeler = odemeSatirlari(f, h);
  return {
    veri: {
      aracId,
      genelToplam: Math.round(genelToplam * 100) / 100,
      kdvOrani: kdvOrani ?? 0.2,
      otvOrani: otvOrani ?? 0,
      teslimTarihi,
      aksesuarlar: s("aksesuarlar") || null,
      hizmetler: s("hizmetler") || null,
      not: s("not") || null,
      odemeler,
    },
    hatalar: h,
  };
}

/** Formdaki ödeme satırları (odeme_yontem, odeme_tutar, odeme_taksit, odeme_aciklama); boş satırlar atlanır. */
export function odemeSatirlari(f: FormData, h: Hatalar): OdemeSatiri[] {
  const yontemler = f.getAll("odeme_yontem").map(String);
  const tutarlar = f.getAll("odeme_tutar").map(String);
  const taksitler = f.getAll("odeme_taksit").map(String);
  const aciklamalar = f.getAll("odeme_aciklama").map(String);
  const odemeler: OdemeSatiri[] = [];
  yontemler.forEach((y, i) => {
    const tutarHam = (tutarlar[i] ?? "").trim();
    const aciklama = (aciklamalar[i] ?? "").trim() || null;
    if (!tutarHam && !aciklama) return;
    const tutar = sayi(tutarHam);
    if (!tutar || tutar <= 0) {
      h.odemeler = `${i + 1}. ödeme satırında tutar geçersiz.`;
      return;
    }
    const yontem = YONTEMLER.find((x) => x === y) ?? "DIGER";
    const taksit = Number(taksitler[i]);
    odemeler.push({ yontem, tutar, taksit: yontem === "KART" && taksit > 1 ? taksit : null, aciklama });
  });
  return odemeler;
}
