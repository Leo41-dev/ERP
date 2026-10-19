// Analiz merkezi hesapları (saf). Kovalar eski paneldekilerle aynı.
import { gunFarki, trKunye } from "./panoHesap";

export const YAS_KOVALARI: [number, number, string][] = [[0, 30, "0-30 gün"], [31, 60, "31-60 gün"], [61, 90, "61-90 gün"], [91, 180, "91-180 gün"], [181, 1e9, "180+ gün"]];
export const SURE_KOVALARI: [number, number, string][] = [[0, 15, "0-15 gün"], [16, 30, "16-30 gün"], [31, 60, "31-60 gün"], [61, 90, "61-90 gün"], [91, 180, "91-180 gün"], [181, 1e9, "180+ gün"]];
export const MARJ_KOVALARI: [number, number, string][] = [[-1e9, 0, "Zarar"], [0, 3, "%0-3"], [3, 6, "%3-6"], [6, 9, "%6-9"], [9, 12, "%9-12"], [12, 15, "%12-15"], [15, 20, "%15-20"], [20, 1e9, "%20+"]];
export const FIYAT_BANTLARI: [number, number, string][] = [[0, 100000, "0-100 bin"], [100000, 250000, "100-250 bin"], [250000, 500000, "250-500 bin"], [500000, 1000000, "500 bin-1 mn"], [1000000, 2000000, "1-2 mn"], [2000000, 1e12, "2 mn+"]];
const AY_AD = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export type AracVeri = {
  id: number; marka: string; model: string; konum: string; kondisyon: string; tedarikci: string;
  gelis: Date; maliyet: number; stokta: boolean;
  satis: { tarih: Date; net: number; otv: number; otvOrani: number; satici: string } | null;
};
export type TeklifVeri = { durum: string; gecerlilik: Date; tutar: number; retNedeni: string | null };

export type KolonTur = "metin" | "adet" | "tl" | "yuzde" | "gun";
export type Tablo = {
  anahtar: string; baslik: string; aciklama: string;
  kolonlar: { ad: string; tur: KolonTur }[];
  satirlar: (string | number | null)[][];
  cubuk?: number; // satır içi çubukla gösterilecek sütun
  maliyetli?: boolean; // maliyet/kâr içerir; yalnızca yönetici ve muhasebe görür
};

const gunKova = (k: [number, number, string][], g: number) => Math.max(0, k.findIndex(([a, b]) => g >= a && g <= b));
const aralikKova = (k: [number, number, string][], d: number) => { const i = k.findIndex(([a, b]) => d >= a && d < b); return i < 0 ? k.length - 1 : i; };
export function medyan(l: number[]) {
  if (!l.length) return null;
  const s = [...l].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
}
const yuzde = (v: number | null) => (v === null ? "-" : `%${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`);
const ort = (l: number[]) => (l.length ? l.reduce((t, x) => t + x, 0) / l.length : null);
const grupla = <T,>(l: T[], f: (x: T) => string) => { const m = new Map<string, T[]>(); for (const x of l) m.set(f(x), [...(m.get(f(x)) ?? []), x]); return m; };

export function analizHesapla(araclar: AracVeri[], teklifler: TeklifVeri[], o: { bas: Date; bit: Date; bugun: Date }): Tablo[] {
  const stok = araclar.filter((a) => a.stokta).map((a) => ({ ...a, gun: gunFarki(a.gelis, o.bugun) }));
  const satilan = araclar
    .filter((a) => a.satis && a.satis.tarih >= o.bas && a.satis.tarih < o.bit)
    .map((a) => {
      const s = a.satis!;
      const kar = a.maliyet > 0 ? s.net - a.maliyet : null;
      return { ...a, s, sure: gunFarki(a.gelis, s.tarih), kar, marj: kar !== null && s.net ? (kar / s.net) * 100 : null };
    });
  const maliyetli = satilan.filter((x) => x.marj !== null);
  const tablolar: Tablo[] = [];

  // 1. stok yaşlandırma
  const yas = YAS_KOVALARI.map(() => ({ adet: 0, deger: 0 }));
  for (const a of stok) { const k = yas[gunKova(YAS_KOVALARI, a.gun)]; k.adet++; k.deger += a.maliyet; }
  tablolar.push({
    anahtar: "yaslandirma", baslik: "Stok yaşlandırma", aciklama: "Stoktaki ve rezerve araçların geliş tarihinden bugüne geçen süre.", maliyetli: true,
    kolonlar: [{ ad: "Bekleme", tur: "metin" }, { ad: "Araç", tur: "adet" }, { ad: "Pay", tur: "yuzde" }, { ad: "Değer (maliyet)", tur: "tl" }],
    satirlar: YAS_KOVALARI.map(([, , ad], i) => [ad, yas[i].adet, stok.length ? (yas[i].adet / stok.length) * 100 : 0, yas[i].deger]),
    cubuk: 1,
  });
  tablolar.push({
    anahtar: "yaslandirma-marka", baslik: "Marka ve modele göre bekleme", aciklama: "Her modelin stoktaki adedi ve yaş kovalarına dağılımı; en yaşlı stok üstte.",
    kolonlar: [{ ad: "Model", tur: "metin" }, ...YAS_KOVALARI.map(([, , ad]) => ({ ad, tur: "adet" as const })), { ad: "Toplam", tur: "adet" }, { ad: "Ort. bekleme", tur: "gun" }],
    satirlar: [...grupla(stok, (a) => a.model).entries()]
      .map(([ad, l]) => [ad, ...YAS_KOVALARI.map((_, i) => l.filter((a) => gunKova(YAS_KOVALARI, a.gun) === i).length || null), l.length, ort(l.map((a) => a.gun))] as (string | number | null)[])
      .sort((a, b) => Number(b[b.length - 1]) - Number(a[a.length - 1])),
  });

  // 2. satış süresi
  const sure = SURE_KOVALARI.map(() => 0);
  for (const x of satilan) sure[gunKova(SURE_KOVALARI, x.sure)]++;
  tablolar.push({
    anahtar: "satis-suresi", baslik: "Satış süresi", aciklama: `Dönemde satılan araçların stokta kaldığı süre. Medyan ${medyan(satilan.map((x) => x.sure))?.toLocaleString("tr-TR") ?? "-"} gün.`,
    kolonlar: [{ ad: "Süre", tur: "metin" }, { ad: "Araç", tur: "adet" }, { ad: "Pay", tur: "yuzde" }],
    satirlar: SURE_KOVALARI.map(([, , ad], i) => [ad, sure[i], satilan.length ? (sure[i] / satilan.length) * 100 : 0]),
    cubuk: 1,
  });
  tablolar.push({
    anahtar: "satis-suresi-model", baslik: "Modele göre satış süresi", aciklama: "En hızlı satılan model üstte.",
    kolonlar: [{ ad: "Model", tur: "metin" }, { ad: "Satılan", tur: "adet" }, { ad: "Medyan", tur: "gun" }, { ad: "Ortalama", tur: "gun" }, { ad: "Stokta", tur: "adet" }],
    satirlar: [...grupla(satilan, (x) => x.model).entries()]
      .map(([ad, l]) => [ad, l.length, medyan(l.map((x) => x.sure)), ort(l.map((x) => x.sure)), stok.filter((a) => a.model === ad).length] as (string | number | null)[])
      .sort((a, b) => Number(a[2]) - Number(b[2])),
  });

  // 3. marj dağılımı
  const marj = MARJ_KOVALARI.map(() => ({ adet: 0, kar: 0 }));
  for (const x of maliyetli) { const k = marj[aralikKova(MARJ_KOVALARI, x.marj!)]; k.adet++; k.kar += x.kar!; }
  tablolar.push({
    anahtar: "marj", baslik: "Kârlılık dağılımı", maliyetli: true,
    aciklama: `Maliyeti girilmiş ${maliyetli.length} satış. Ortalama ${yuzde(ort(maliyetli.map((x) => x.marj!)))}, medyan ${yuzde(medyan(maliyetli.map((x) => x.marj!)))}.`,
    kolonlar: [{ ad: "Kârlılık", tur: "metin" }, { ad: "Satış", tur: "adet" }, { ad: "Toplam kâr", tur: "tl" }],
    satirlar: MARJ_KOVALARI.map(([, , ad], i) => [ad, marj[i].adet, marj[i].kar]),
    cubuk: 1,
  });

  // 4. ABC (Pareto): ciroya göre modeller
  const modelCiro = [...grupla(satilan, (x) => x.model).entries()].map(([ad, l]) => ({ ad, adet: l.length, ciro: l.reduce((t, x) => t + x.s.net, 0), kar: l.reduce((t, x) => t + (x.kar ?? 0), 0) })).sort((a, b) => b.ciro - a.ciro);
  const toplamCiro = modelCiro.reduce((t, x) => t + x.ciro, 0);
  let birikim = 0;
  tablolar.push({
    anahtar: "abc", baslik: "ABC analizi (ciro)", aciklama: "Cironun %80'ini getiren modeller A, sonraki %15 B, kalanı C sınıfı.", maliyetli: true,
    kolonlar: [{ ad: "Model", tur: "metin" }, { ad: "Sınıf", tur: "metin" }, { ad: "Adet", tur: "adet" }, { ad: "Ciro", tur: "tl" }, { ad: "Pay", tur: "yuzde" }, { ad: "Birikimli", tur: "yuzde" }, { ad: "Kâr", tur: "tl" }],
    satirlar: modelCiro.map((m) => {
      const onceki = birikim;
      birikim += toplamCiro ? (m.ciro / toplamCiro) * 100 : 0;
      return [m.ad, onceki < 80 ? "A" : onceki < 95 ? "B" : "C", m.adet, m.ciro, toplamCiro ? (m.ciro / toplamCiro) * 100 : 0, birikim, m.kar];
    }),
    cubuk: 3,
  });

  // 5. mevsimsellik: son 24 ay araç satışı (dönemden bağımsız)
  const ayAnahtar = (d: Date) => trKunye(d).toISOString().slice(0, 7);
  const simdi = trKunye(o.bugun);
  const aylar = [...Array(24)].map((_, i) => new Date(Date.UTC(simdi.getUTCFullYear(), simdi.getUTCMonth() - 23 + i, 1)).toISOString().slice(0, 7));
  const tumSatis = araclar.filter((a) => a.satis);
  tablolar.push({
    anahtar: "mevsimsellik", baslik: "Mevsimsellik", aciklama: "Son 24 ayın aylık araç satışı (dönem filtresinden bağımsız). Geçen yılın aynı ayıyla karşılaştırma için.",
    kolonlar: [{ ad: "Ay", tur: "metin" }, { ad: "Araç", tur: "adet" }, { ad: "Ciro", tur: "tl" }, { ad: "Geçen yıl aynı ay", tur: "adet" }],
    satirlar: aylar.slice(12).map((ay, i) => {
      const bu = tumSatis.filter((a) => ayAnahtar(a.satis!.tarih) === ay);
      return [`${AY_AD[Number(ay.slice(5)) - 1]} ${ay.slice(0, 4)}`, bu.length, bu.reduce((t, a) => t + a.satis!.net, 0), tumSatis.filter((a) => ayAnahtar(a.satis!.tarih) === aylar[i]).length];
    }),
    cubuk: 1,
  });

  // 6. konum × marka
  const markalar = [...new Set(stok.map((a) => a.marka))].sort();
  tablolar.push({
    anahtar: "konum-marka", baslik: "Konum × marka (stok)", aciklama: "Hangi şubede hangi markadan kaç araç var.",
    kolonlar: [{ ad: "Konum", tur: "metin" }, ...markalar.map((m) => ({ ad: m, tur: "adet" as const })), { ad: "Toplam", tur: "adet" }],
    satirlar: [...grupla(stok, (a) => a.konum).entries()].map(([k, l]) => [k, ...markalar.map((m) => l.filter((a) => a.marka === m).length || null), l.length]),
  });

  // 7. fiyat bandı: stok (maliyet) ve satış (net fiyat)
  const bant = FIYAT_BANTLARI.map(() => ({ stok: 0, satis: 0 }));
  for (const a of stok) if (a.maliyet > 0) bant[aralikKova(FIYAT_BANTLARI, a.maliyet)].stok++;
  for (const x of satilan) bant[aralikKova(FIYAT_BANTLARI, x.s.net)].satis++;
  tablolar.push({
    anahtar: "fiyat-bandi", baslik: "Fiyat bandı", aciklama: "Stok maliyete, satış satış fiyatına göre bantlanır. Stoğu çok, satışı az olan bant için alım ya da kampanya gözden geçirilebilir.", maliyetli: true,
    kolonlar: [{ ad: "Bant", tur: "metin" }, { ad: "Stokta", tur: "adet" }, { ad: "Dönemde satılan", tur: "adet" }, { ad: "Stok / satış", tur: "metin" }],
    satirlar: FIYAT_BANTLARI.map(([, , ad], i) => [ad, bant[i].stok, bant[i].satis, bant[i].satis ? (bant[i].stok / bant[i].satis).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : bant[i].stok ? "satış yok" : "-"]),
  });

  // 8. ÖTV yükü
  tablolar.push({
    anahtar: "otv", baslik: "ÖTV yükü", aciklama: "Dönemde satılan araçların ÖTV oranına göre dağılımı.",
    kolonlar: [{ ad: "ÖTV oranı", tur: "metin" }, { ad: "Araç", tur: "adet" }, { ad: "Ciro", tur: "tl" }, { ad: "ÖTV", tur: "tl" }, { ad: "Cirodaki payı", tur: "yuzde" }],
    satirlar: [...grupla(satilan, (x) => String(x.s.otvOrani)).entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([oran, l]) => { const c = l.reduce((t, x) => t + x.s.net, 0), v = l.reduce((t, x) => t + x.s.otv, 0); return [`%${Math.round(Number(oran) * 100)}`, l.length, c, v, c ? (v / c) * 100 : 0]; }),
  });

  // 9. tedarikçi
  tablolar.push({
    anahtar: "tedarikci", baslik: "Tedarikçi performansı", aciklama: "Tedarikçiden gelen araçların satış hızı ve kârlılığı (satışlar dönem içinden).", maliyetli: true,
    kolonlar: [{ ad: "Tedarikçi", tur: "metin" }, { ad: "Stokta", tur: "adet" }, { ad: "Dönemde satılan", tur: "adet" }, { ad: "Ort. satış süresi", tur: "gun" }, { ad: "Ort. kârlılık", tur: "yuzde" }],
    satirlar: [...grupla(araclar, (a) => a.tedarikci).entries()]
      .map(([ad, l]) => {
        const s = satilan.filter((x) => x.tedarikci === ad);
        return [ad, l.filter((a) => a.stokta).length, s.length, ort(s.map((x) => x.sure)), ort(s.filter((x) => x.marj !== null).map((x) => x.marj!))] as (string | number | null)[];
      })
      .sort((a, b) => Number(b[2]) - Number(a[2])),
  });

  // 10. teklif hunisi
  const gun = trKunye(o.bugun);
  const huni = [
    ["Verilen teklif", teklifler],
    ["Açık (süresi geçmemiş)", teklifler.filter((t) => t.durum === "ACIK" && t.gecerlilik >= gun)],
    ["Süresi dolan", teklifler.filter((t) => t.durum === "ACIK" && t.gecerlilik < gun)],
    ["Reddedilen", teklifler.filter((t) => t.durum === "RET")],
    ["Satışa dönen", teklifler.filter((t) => t.durum === "KABUL")],
  ] as const;
  tablolar.push({
    anahtar: "teklif", baslik: "Teklif hunisi", aciklama: "Dönemde verilen tekliflerin bugünkü durumu.",
    kolonlar: [{ ad: "Aşama", tur: "metin" }, { ad: "Teklif", tur: "adet" }, { ad: "Pay", tur: "yuzde" }, { ad: "Tutar", tur: "tl" }],
    satirlar: huni.map(([ad, l]) => [ad, l.length, teklifler.length ? (l.length / teklifler.length) * 100 : 0, l.reduce((t, x) => t + x.tutar, 0)]),
    cubuk: 1,
  });
  const nedenler = [...grupla(teklifler.filter((t) => t.durum === "RET"), (t) => (t.retNedeni ?? "-").toLocaleLowerCase("tr-TR")).entries()].sort((a, b) => b[1].length - a[1].length);
  tablolar.push({
    anahtar: "ret-nedenleri", baslik: "Ret nedenleri", aciklama: "Reddedilen tekliflerde yazılan nedenler.",
    kolonlar: [{ ad: "Neden", tur: "metin" }, { ad: "Teklif", tur: "adet" }, { ad: "Tutar", tur: "tl" }],
    satirlar: nedenler.slice(0, 10).map(([n, l]) => [n, l.length, l.reduce((t, x) => t + x.tutar, 0)]),
    cubuk: 1,
  });

  return tablolar;
}

/** Tabloyu Excel'in Türkçe ayarıyla açılan CSV'ye çevirir (; ayraç, virgüllü ondalık, BOM) */
export function csv(t: Tablo) {
  const hucre = (v: string | number | null) => {
    if (v === null) return "";
    const s = typeof v === "number" ? (Math.round(v * 100) / 100).toString().replace(".", ",") : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [t.kolonlar.map((k) => hucre(k.ad)), ...t.satirlar.map((r) => r.map(hucre))].map((r) => r.join(";")).join("\r\n");
}
