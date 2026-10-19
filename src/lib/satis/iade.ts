import { para } from "../normalize";

export type IadeKalemDurumu = { id: number; miktar: number; tutar: number; iadeEdilen: number };

/** Satış kalemlerinden seçilen miktarların iade tutarı (birim fiyat satır tutarından oranlanır). Aşan miktar hata döner. */
type IadeSatiri = { satisKalemiId: number; miktar: number; tutar: number };
export function iadeKalemleri(kalemler: IadeKalemDurumu[], secim: Record<number, number>): { hata: string } | { satirlar: IadeSatiri[]; toplam: number; tamami: boolean } {
  const satirlar: IadeSatiri[] = [];
  for (const k of kalemler) {
    const m = secim[k.id] ?? 0;
    if (!m) continue;
    const kalan = k.miktar - k.iadeEdilen;
    if (m < 0 || m - kalan > 1e-9) return { hata: `İade miktarı satılan miktarı aşıyor (en çok ${kalan.toLocaleString("tr-TR")}).` };
    satirlar.push({ satisKalemiId: k.id, miktar: m, tutar: para((k.tutar / k.miktar) * m) });
  }
  if (!satirlar.length) return { hata: "İade edilecek kalem seçilmeli." };
  // bu iadeyle tüm kalemler tamamen iade edilmiş olur mu
  const tamami = kalemler.every((k) => k.miktar - k.iadeEdilen - (secim[k.id] ?? 0) <= 1e-9);
  return { satirlar, toplam: para(satirlar.reduce((t, s) => t + s.tutar, 0)), tamami };
}

/** Kesintili satışta (stopaj, tevkifat) cariye yazılan iade: iade tutarının alıcıda kalan kesinti payı düşülmüş hali */
export function iadeCariTutari(iade: number, genelToplam: number, kesinti = 0) {
  return genelToplam > 0 ? para(iade * (1 - kesinti / genelToplam)) : iade;
}

/** Satışın kalan alacağı: tahsil edilecek − iadeler − tahsilat + müşteriye geri ödenen. Eksi ise müşteriye borçluyuz. */
export function satisKalani(x: { genelToplam: number; iade: number; tahsil: number; geriOdeme: number; kesinti?: number }) {
  const k = x.kesinti ?? 0;
  return para(x.genelToplam - k - iadeCariTutari(x.iade, x.genelToplam, k) - x.tahsil + x.geriOdeme);
}
