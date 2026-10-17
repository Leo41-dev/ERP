import { eposta as epostaNormalize, oran, sayi, telefon as telefonNormalize } from "../normalize";
import type { TeklifKalemGirdisi } from "../satis/hesap";
import type { Hatalar } from "./cari";

export type TeklifVeri = {
  firmaId: number | null;
  musteriAd: string;
  telefon: string | null;
  eposta: string | null;
  kimlikNo: string | null;
  gecerlilik: Date;
  kalemler: TeklifKalemGirdisi[];
  odemeKosullari: string | null;
  not: string | null;
};

/** Türkiye saatiyle bugünün tarihi (yyyy-MM-dd) */
export const bugunTr = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);

/** Kalem satırları: kalem_aciklama, kalem_model, kalem_miktar, kalem_fiyat (vergiler dahil birim), kalem_kdv, kalem_otv */
export function teklifDogrula(f: FormData): { veri: TeklifVeri; hatalar: Hatalar } {
  const h: Hatalar = {};
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const al = (k: string) => f.getAll(k).map(String);
  const [aciklamalar, modeller, miktarlar, fiyatlar, kdvler, otvler] = ["kalem_aciklama", "kalem_model", "kalem_miktar", "kalem_fiyat", "kalem_kdv", "kalem_otv"].map(al);
  const kalemler: TeklifKalemGirdisi[] = [];
  aciklamalar.forEach((a, i) => {
    const aciklama = a.replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR");
    const fiyatHam = (fiyatlar[i] ?? "").trim();
    if (!aciklama && !fiyatHam) return;
    const miktar = sayi(miktarlar[i] || "1");
    const birimFiyat = sayi(fiyatHam);
    const kdvOrani = oran(kdvler[i] ?? "0.2");
    const otvOrani = oran(otvler[i] || "0");
    const modelId = Number(modeller[i]) || null;
    if (!aciklama) h.kalemler = `${i + 1}. satırda araç, ürün ya da hizmet adı yazılmalı.`;
    else if (!miktar || miktar <= 0) h.kalemler = `${i + 1}. satırda adet geçersiz.`;
    else if (!birimFiyat || birimFiyat <= 0) h.kalemler = `${i + 1}. satırda fiyat geçersiz.`;
    else if (kdvOrani === null || otvOrani === null) h.kalemler = `${i + 1}. satırda vergi oranı geçersiz.`;
    else kalemler.push({ aciklama, modelId, miktar, birimFiyat, kdvOrani, otvOrani });
  });
  if (!kalemler.length && !h.kalemler) h.kalemler = "En az bir kalem girilmeli.";

  const musteriAd = s("musteriAd").replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
  if (!musteriAd) h.musteriAd = "Müşteri adı yazılmalı.";
  const telefon = s("telefon") ? telefonNormalize(s("telefon")) : null;
  if (s("telefon") && !telefon) h.telefon = "Telefon 10 haneli olmalı (5xx xxx xx xx).";
  const eposta = s("eposta") ? epostaNormalize(s("eposta")) : null;
  if (s("eposta") && !eposta) h.eposta = "E-posta geçersiz.";
  const kimlikNo = s("kimlikNo").replace(/\D/g, "") || null;
  if (kimlikNo && kimlikNo.length !== 10 && kimlikNo.length !== 11) h.kimlikNo = "TCKN 11, VKN 10 haneli olmalı.";

  const gecerlilik = new Date(`${s("gecerlilik")}T00:00:00Z`);
  if (Number.isNaN(gecerlilik.getTime())) h.gecerlilik = "Geçerlilik tarihi girilmeli.";
  else if (s("gecerlilik") < bugunTr()) h.gecerlilik = "Geçerlilik tarihi bugünden önce olamaz.";

  return {
    veri: { firmaId: Number(s("firmaId")) || null, musteriAd, telefon, eposta, kimlikNo, gecerlilik, kalemler, odemeKosullari: s("odemeKosullari") || null, not: s("not") || null },
    hatalar: h,
  };
}
