import { describe, expect, it } from "vitest";
import { satirVergi, vergilerDahil, type EkVergi } from "../src/lib/vergiHesap";
import { kalemHesapla, vergiKirilimi } from "../src/lib/satis/hesap";
import { satisKalani } from "../src/lib/satis/iade";

const otv = (deger: number): EkVergi => ({ ad: "ÖTV", hesap: "YUZDE", deger, kdvMatrahina: true, kesinti: false });

describe("satirVergi", () => {
  it("yalnız KDV", () => {
    expect(satirVergi({ tutar: 120, miktar: 1, kdvOrani: 0.2 })).toMatchObject({ matrah: 100, kdv: 20, ekToplam: 0, tahsilEdilecek: 120 });
  });
  it("ÖTV'li satırda eski hesapla aynı sonucu verir", () => {
    const s = satirVergi({ tutar: 1_200_000, miktar: 1, kdvOrani: 0.2, ekler: [otv(0.25)] });
    const e = vergiKirilimi(1_200_000, 0.2, 0.25);
    expect([s.matrah, s.ekler[0].tutar, s.kdv]).toEqual([e.matrah, e.otv, e.kdv]);
  });
  it("birim başına tutar KDV matrahına girer", () => {
    // 10 adet, adet başı 2 TL maktu vergi, KDV %20: (M + 20) × 1,2 = 144 → M = 100
    const s = satirVergi({ tutar: 144, miktar: 10, kdvOrani: 0.2, ekler: [{ ad: "Maktu", hesap: "BIRIM_TUTAR", deger: 2, kdvMatrahina: true, kesinti: false }] });
    expect(s).toMatchObject({ matrah: 100, kdv: 24, ekToplam: 20 });
  });
  it("KDV matrahına girmeyen yüzde vergi", () => {
    // konaklama: M × 1,2 + M × 0,02 = 122 → M = 100
    const s = satirVergi({ tutar: 122, miktar: 1, kdvOrani: 0.2, ekler: [{ ad: "Konaklama", hesap: "YUZDE", deger: 0.02, kdvMatrahina: false, kesinti: false }] });
    expect(s).toMatchObject({ matrah: 100, kdv: 20, ekToplam: 2 });
  });
  it("tevkifat ve stopaj toplamı değiştirmez, tahsil edilecekten düşer", () => {
    const s = satirVergi({
      tutar: 120, miktar: 1, kdvOrani: 0.2,
      ekler: [{ ad: "KDV tevkifatı 5/10", hesap: "KDV_TEVKIFAT", deger: 0.5, kdvMatrahina: false, kesinti: true }, { ad: "Stopaj", hesap: "YUZDE", deger: 0.2, kdvMatrahina: false, kesinti: true }],
    });
    expect(s).toMatchObject({ matrah: 100, kdv: 20, kesinti: 30, tahsilEdilecek: 90 });
  });
  it("matrah ve vergiler toplamı kuruşu kuruşuna verir", () => {
    const s = satirVergi({ tutar: 333.33, miktar: 3, kdvOrani: 0.2, ekler: [otv(0.08)] });
    expect(Math.round((s.matrah + s.kdv + s.ekToplam) * 100) / 100).toBe(333.33);
  });
});

describe("vergilerDahil", () => {
  it("satirVergi'nin tersidir", () => {
    const ekler = [otv(0.25), { ad: "Maktu", hesap: "BIRIM_TUTAR" as const, deger: 5, kdvMatrahina: true, kesinti: false }];
    const fiyat = vergilerDahil(100, 1, 0.2, ekler);
    expect(satirVergi({ tutar: fiyat, miktar: 1, kdvOrani: 0.2, ekler }).matrah).toBe(100);
  });
});

describe("kesintili satış", () => {
  const tevkifat: EkVergi = { ad: "KDV tevkifatı 5/10", hesap: "KDV_TEVKIFAT", deger: 0.5, kdvMatrahina: false, kesinti: true };
  it("belge özeti kesintiyi ayrı gösterir, tahsil edilecekten düşer", () => {
    const h = kalemHesapla([{ aciklama: "Bakım", miktar: 2, birimFiyat: 60, kdvOrani: 0.2, ekler: [tevkifat] }, { aciklama: "Yağ", miktar: 1, birimFiyat: 120, kdvOrani: 0.2 }]);
    expect(h).toMatchObject({ genelToplam: 240, kdv: 40, kesinti: 10, tahsilEdilecek: 230 });
    expect(h.vergiOzeti).toEqual([{ ad: "KDV tevkifatı 5/10", tutar: 10, kesinti: true }]);
  });
  it("kalan alacak ve iade kesinti payı düşülerek hesaplanır", () => {
    expect(satisKalani({ genelToplam: 240, kesinti: 10, iade: 0, tahsil: 230, geriOdeme: 0 })).toBe(0);
    // yarısı iade: cariye 115 alacak, müşteriye 115 geri ödendi
    expect(satisKalani({ genelToplam: 240, kesinti: 10, iade: 120, tahsil: 230, geriOdeme: 115 })).toBe(0);
  });
});
