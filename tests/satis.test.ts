import { describe, expect, it } from "vitest";
import { hizliSatisDogrula } from "../src/lib/dogrulama/hizliSatis";
import { kalemHesapla, odemeFarki, vergiKirilimi } from "../src/lib/satis/hesap";

describe("vergiKirilimi", () => {
  it("KDV dahil tutardan ÖTV ve KDV'yi ayırır", () => {
    const k = vergiKirilimi(1_200_000, 0.2, 0.25);
    expect(k.kdv).toBe(200_000);
    expect(k.otv).toBe(200_000);
    expect(k.matrah).toBe(800_000);
    expect(k.matrah + k.otv + k.kdv).toBe(1_200_000);
  });
  it("ÖTV'siz araçta yalnızca KDV ayrılır", () => {
    expect(vergiKirilimi(120_000, 0.2, 0)).toEqual({ matrah: 100_000, otv: 0, kdv: 20_000 });
  });
  it("kuruş yuvarlamasında toplamı korur", () => {
    const k = vergiKirilimi(333_333.33, 0.2, 0.08);
    expect(Math.round((k.matrah + k.otv + k.kdv) * 100) / 100).toBe(333_333.33);
  });
});

describe("odemeFarki", () => {
  it("ödeme toplamı ile satış tutarı farkını verir", () => {
    const o = odemeFarki(1_000_000, [
      { yontem: "HAVALE", tutar: 600_000, taksit: null, vade: null, aciklama: null },
      { yontem: "KART", tutar: 350_000, taksit: 6, vade: null, aciklama: null },
    ]);
    expect(o).toEqual({ toplam: 950_000, fark: 50_000 });
  });
});

describe("kalemHesapla", () => {
  it("KDV dahil fiyatlardan satır ve genel toplamları çıkarır", () => {
    const h = kalemHesapla([
      { aciklama: "KASK", miktar: 2, birimFiyat: 1200, kdvOrani: 0.2 },
      { aciklama: "KİTAP", miktar: 1, birimFiyat: 110, kdvOrani: 0.1 },
    ]);
    expect(h.genelToplam).toBe(2510);
    expect(h.satirlar[0]).toMatchObject({ tutar: 2400, matrah: 2000, kdv: 400, birimMatrah: 1000 });
    expect(h.matrah + h.kdv).toBe(2510);
  });
});

describe("hizliSatisDogrula", () => {
  const form = (alanlar: [string, string][]) => {
    const f = new FormData();
    for (const [a, d] of alanlar) f.append(a, d);
    return f;
  };
  it("boş satırları atlar, taksiti yalnızca kartta alır", () => {
    const { veri, hatalar } = hizliSatisDogrula(
      form([
        ["kalem_aciklama", "kask"], ["kalem_miktar", "1"], ["kalem_fiyat", "1.500,50"], ["kalem_kdv", "0.2"],
        ["kalem_aciklama", ""], ["kalem_miktar", "1"], ["kalem_fiyat", ""], ["kalem_kdv", "0.2"],
        ["odeme_yontem", "NAKIT"], ["odeme_tutar", "500"], ["odeme_taksit", ""], ["odeme_aciklama", ""],
        ["odeme_yontem", "KART"], ["odeme_tutar", "1000,50"], ["odeme_taksit", "3"], ["odeme_aciklama", ""],
      ]),
    );
    expect(hatalar).toEqual({});
    expect(veri.kalemler).toEqual([{ aciklama: "KASK", miktar: 1, birimFiyat: 1500.5, kdvOrani: 0.2 }]);
    expect(veri.odemeler.map((o) => [o.yontem, o.tutar, o.taksit])).toEqual([["NAKIT", 500, null], ["KART", 1000.5, 3]]);
  });
  it("kalem yoksa ve telefon girilip ad yoksa hata verir", () => {
    const { hatalar } = hizliSatisDogrula(form([["telefon", "0532 111 22 33"], ["odeme_yontem", "KART"], ["odeme_tutar", "10"], ["odeme_taksit", ""], ["odeme_aciklama", ""]]));
    expect(hatalar.kalemler).toBeTruthy();
    expect(hatalar.unvan).toBeTruthy();
  });
});

describe("teklifHesapla", () => {
  it("araç ve aksesuar satırlarının vergisini ayrı hesaplar", async () => {
    const { teklifHesapla } = await import("../src/lib/satis/hesap");
    const h = teklifHesapla([
      { aciklama: "CFMOTO CFORCE 625", modelId: 1, miktar: 1, birimFiyat: 450000, kdvOrani: 0.2, otvOrani: 0.08 },
      { aciklama: "KASK", modelId: null, miktar: 2, birimFiyat: 3000, kdvOrani: 0.2, otvOrani: 0 },
    ]);
    expect(h.genelToplam).toBe(456000);
    expect(h.satirlar[1].otv).toBe(0);
    expect(h.satirlar[1].kdv).toBe(1000);
    expect(h.matrah + h.otv + h.kdv).toBeCloseTo(456000, 2);
    expect(h.otv).toBeCloseTo(27777.78, 2);
  });
});
