import { metin, oran, sayi } from "../normalize";
import type { Hatalar } from "./cari";

export type GirisSatiri = {
  urunId: number | null; // boşsa yeni kart açılır
  yeniAd: string;
  yeniTur: "YEDEK_PARCA" | "AKSESUAR" | "DIGER";
  birim: string;
  barkod: string | null;
  faturaAdi: string | null;
  anahtar: string | null; // XML eşleme anahtarı
  miktar: number;
  birimFiyat: number; // KDV hariç
  kdvOrani: number;
};

export type GirisVeri = {
  tedarikciId: number | null;
  tedarikciUnvan: string;
  tedarikciVkn: string;
  faturaNo: string | null;
  tarih: Date;
  not: string | null;
  kaynak: "ELLE" | "XML";
  satirlar: GirisSatiri[];
};

const YENI_TUR = ["YEDEK_PARCA", "AKSESUAR", "DIGER"] as const;

/** Satır alanları: s_urun, s_ad, s_tur, s_birim, s_barkod, s_faturaAdi, s_anahtar, s_miktar, s_fiyat (KDV hariç), s_kdv */
export function girisDogrula(f: FormData, bugun: string): { veri: GirisVeri; hatalar: Hatalar } {
  const h: Hatalar = {};
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const hepsi = (k: string) => f.getAll(k).map((x) => String(x).trim());
  const [urun, ad, tur, birim, barkod, faturaAdi, anahtar, miktar, fiyat, kdv] = ["s_urun", "s_ad", "s_tur", "s_birim", "s_barkod", "s_faturaAdi", "s_anahtar", "s_miktar", "s_fiyat", "s_kdv"].map(hepsi);
  const satirlar: GirisSatiri[] = [];
  ad.forEach((a, i) => {
    const urunId = Number(urun[i]) || null;
    const yeniAd = metin(a);
    if (!urunId && !yeniAd && !miktar[i] && !fiyat[i]) return;
    const n = i + 1;
    const m = sayi(miktar[i]);
    const p = sayi(fiyat[i]);
    const k = oran(kdv[i] || "0.2");
    if (!urunId && !yeniAd) h.satirlar = `${n}. satırda ürün seçin ya da yeni ürünün adını yazın.`;
    else if (!m || m <= 0) h.satirlar = `${n}. satırda miktar geçersiz.`;
    else if (p === null || p < 0) h.satirlar = `${n}. satırda birim fiyat geçersiz.`;
    else if (k === null) h.satirlar = `${n}. satırda KDV oranı geçersiz.`;
    else
      satirlar.push({
        urunId,
        yeniAd,
        yeniTur: (YENI_TUR as readonly string[]).includes(tur[i]) ? (tur[i] as GirisSatiri["yeniTur"]) : "YEDEK_PARCA",
        birim: birim[i] || "Adet",
        barkod: barkod[i]?.replace(/\s+/g, "") || null,
        faturaAdi: faturaAdi[i] || null,
        anahtar: anahtar[i] || null,
        miktar: m,
        birimFiyat: p,
        kdvOrani: k,
      });
  });
  if (!satirlar.length && !h.satirlar) h.satirlar = "En az bir satır girilmeli.";

  const tedarikciId = Number(s("tedarikciId")) || null;
  const tedarikciUnvan = metin(s("tedarikciUnvan"));
  const tedarikciVkn = s("tedarikciVkn").replace(/\D/g, "");
  if (!tedarikciId && tedarikciVkn && tedarikciVkn.length !== 10 && tedarikciVkn.length !== 11) h.tedarikci = "VKN 10, TCKN 11 haneli olmalı.";
  if (!tedarikciId && tedarikciVkn && !tedarikciUnvan) h.tedarikci = "Yeni tedarikçinin ünvanı yazılmalı.";

  const t = s("tarih") || bugun;
  const tarih = new Date(`${t}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(tarih.getTime())) h.tarih = "Tarih geçersiz.";
  else if (t > bugun) h.tarih = "İleri tarihli giriş yapılamaz.";

  return {
    veri: { tedarikciId, tedarikciUnvan, tedarikciVkn, faturaNo: metin(s("faturaNo")).replace(/\s+/g, "") || null, tarih, not: s("not") || null, kaynak: s("kaynak") === "XML" ? "XML" : "ELLE", satirlar },
    hatalar: h,
  };
}

/** Satır ve belge toplamları (KDV hariç fiyattan) */
export function girisToplam(satirlar: Pick<GirisSatiri, "miktar" | "birimFiyat" | "kdvOrani">[]) {
  const p = (n: number) => Math.round(n * 100) / 100;
  const l = satirlar.map((x) => { const tutar = p(x.miktar * x.birimFiyat); return { tutar, kdv: p(tutar * x.kdvOrani) }; });
  const ara = p(l.reduce((t, x) => t + x.tutar, 0));
  const kdv = p(l.reduce((t, x) => t + x.kdv, 0));
  return { satirlar: l, araToplam: ara, kdvToplam: kdv, genelToplam: p(ara + kdv) };
}
