import { describe, expect, it } from "vitest";
import { girisDogrula, girisToplam } from "../src/lib/dogrulama/stokGiris";
import { faturaUrunOku, urunEslemeAnahtari } from "../src/lib/fatura/urunOku";
import { kodOner, kritikDurum, sayimFarki, stokYetersiz, yeniOrtalama } from "../src/lib/stokHesap";

describe("ortalama maliyet", () => {
  it("ağırlıklı ortalama", () => {
    expect(yeniOrtalama(10, 100, 10, 200)).toBe(150);
    expect(yeniOrtalama(3, 90, 1, 130)).toBe(100);
  });
  it("stok sıfır ya da eksiyken giriş maliyeti esas alınır", () => {
    expect(yeniOrtalama(0, 100, 5, 120)).toBe(120);
    expect(yeniOrtalama(-2, 100, 5, 120)).toBe(120);
    expect(yeniOrtalama(4, null, 5, 120)).toBe(120);
  });
});

describe("stok durumu", () => {
  it("kritik durum", () => {
    expect(kritikDurum(-1, 5)).toBe("eksi");
    expect(kritikDurum(0, null)).toBe("yok");
    expect(kritikDurum(3, 5)).toBe("kritik");
    expect(kritikDurum(5, 5)).toBe("kritik");
    expect(kritikDurum(6, 5)).toBe("normal");
    expect(kritikDurum(2, null)).toBe("normal");
  });
  it("aynı ürün iki satırda istenirse toplam kontrol edilir, hizmet atlanır", () => {
    const urunler = [{ id: 1, ad: "YAĞ", miktar: 3, birim: "Litre", hizmet: false }, { id: 2, ad: "İŞÇİLİK", miktar: 0, birim: "Saat", hizmet: true }];
    expect(stokYetersiz([{ urunId: 1, miktar: 2 }, { urunId: 2, miktar: 5 }], urunler)).toEqual([]);
    expect(stokYetersiz([{ urunId: 1, miktar: 2 }, { urunId: 1, miktar: 2 }], urunler)).toEqual([{ ad: "YAĞ", istenen: 4, mevcut: 3, birim: "Litre" }]);
  });
  it("sayım farkı ve kod önerisi", () => {
    expect(sayimFarki(7, 9.5)).toBe(-2.5);
    expect(sayimFarki(0.3, 0.1)).toBe(0.2);
    expect(kodOner("YP", 41)).toBe("YP-00042");
  });
});

const fatura = (satirlar: string, alt = "") => `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:ID>ABC2026000000123</cbc:ID><cbc:IssueDate>2026-10-15</cbc:IssueDate><cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>Motul Yağ A.Ş.</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="TRY">1000</cbc:LineExtensionAmount>${alt}</cac:LegalMonetaryTotal>
${satirlar}
</Invoice>`;
const satir = (no: number, ad: string, adet: string, birim: string, tutar: number, ek = "") => `<cac:InvoiceLine><cbc:ID>${no}</cbc:ID><cbc:InvoicedQuantity unitCode="${birim}">${adet}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">${tutar}</cbc:LineExtensionAmount>
<cac:TaxTotal><cac:TaxSubtotal><cbc:Percent>20</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
<cac:Item><cbc:Name>${ad}</cbc:Name>${ek}</cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">0</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`;

describe("e-fatura parça satırları", () => {
  it("satırları, birimi, kodu ve barkodu okur", () => {
    const s = faturaUrunOku(fatura(
      satir(1, "Motul 7100 10w40 1 lt", "12", "LTR", 600, "<cac:SellersItemIdentification><cbc:ID>MT-7100</cbc:ID></cac:SellersItemIdentification><cac:StandardItemIdentification><cbc:ID>3374650247</cbc:ID></cac:StandardItemIdentification>") +
      satir(2, "Yağ filtresi", "4", "C62", 400),
    ));
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.saticiVkn).toBe("1234567890");
    expect(s.satirlar[0]).toMatchObject({ ad: "MOTUL 7100 10W40 1 LT", saticiKodu: "MT-7100", barkod: "3374650247", miktar: 12, birim: "Litre", birimFiyat: 50, kdvOrani: 0.2, tutar: 600 });
    expect(s.satirlar[1]).toMatchObject({ birim: "Adet", birimFiyat: 100 });
    expect(urunEslemeAnahtari(s.saticiVkn, s.satirlar[0])).toBe("1234567890|K:MT7100");
    expect(urunEslemeAnahtari(s.saticiVkn, s.satirlar[1])).toBe("1234567890|YAGFILTRESI");
  });
  it("fatura altı iskontoyu satırlara dağıtır", () => {
    const s = faturaUrunOku(fatura(satir(1, "Kask", "2", "C62", 1000), `<cbc:AllowanceTotalAmount currencyID="TRY">100</cbc:AllowanceTotalAmount>`));
    if (!s.ok) throw new Error();
    expect(s.satirlar[0]).toMatchObject({ tutar: 900, birimFiyat: 450 });
    expect(s.uyarilar.some((u) => u.includes("iskonto"))).toBe(true);
  });
  it("fatura olmayan dosyayı reddeder", () => {
    expect(faturaUrunOku("<a/>").ok).toBe(false);
  });
});

describe("stok girişi doğrulama", () => {
  const form = (o: Record<string, string | string[]>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
    return f;
  };
  it("kayıtlı ürün ve yeni kart satırı", () => {
    const { veri, hatalar } = girisDogrula(form({ s_urun: ["5", ""], s_ad: ["", "zincir yağı"], s_tur: ["", "AKSESUAR"], s_birim: ["", "Adet"], s_barkod: ["", ""], s_faturaAdi: ["", ""], s_anahtar: ["", ""], s_miktar: ["2", "1,5"], s_fiyat: ["100", "1.200,50"], s_kdv: ["0.2", "0.2"], tarih: "2026-10-18" }), "2026-10-19");
    expect(hatalar).toEqual({});
    expect(veri.satirlar[0]).toMatchObject({ urunId: 5, miktar: 2, birimFiyat: 100 });
    expect(veri.satirlar[1]).toMatchObject({ urunId: null, yeniAd: "ZİNCİR YAĞI", yeniTur: "AKSESUAR", miktar: 1.5, birimFiyat: 1200.5 });
  });
  it("ileri tarih, boş satır ve hatalı VKN", () => {
    const { hatalar } = girisDogrula(form({ s_urun: [""], s_ad: [""], s_miktar: [""], s_fiyat: [""], tarih: "2026-10-20", tedarikciVkn: "123" }), "2026-10-19");
    expect(hatalar.tarih).toBeTruthy();
    expect(hatalar.satirlar).toBeTruthy();
    expect(hatalar.tedarikci).toBeTruthy();
  });
  it("toplamlar", () => {
    expect(girisToplam([{ miktar: 3, birimFiyat: 33.333, kdvOrani: 0.2 }, { miktar: 1, birimFiyat: 10, kdvOrani: 0.1 }])).toMatchObject({ araToplam: 110, kdvToplam: 21, genelToplam: 131 });
  });
});

describe("buyukHarfler", () => {
  it("yabancı marka adlarını hem Türkçe hem düz büyük harfle arar", async () => {
    const { buyukHarfler } = await import("../src/lib/stokTanim");
    expect(buyukHarfler("maxxis")).toEqual(["MAXXİS", "MAXXIS"]);
    expect(buyukHarfler("yağ")).toEqual(["YAĞ"]);
  });
});

describe("kâr oranıyla fiyat", () => {
  it("maliyet × (1 + kâr) üzerine ÖTV ve KDV ekler", async () => {
    const { marjliFiyat, fiyattanKarOrani } = await import("../src/lib/stokHesap");
    expect(marjliFiyat(100, 0.3, 0.2)).toBe(156);
    expect(marjliFiyat(100, 0.3, 0.2, 0.25)).toBe(195);
    expect(fiyattanKarOrani(195, 100, 0.2, 0.25)).toBeCloseTo(0.3, 10);
    expect(fiyattanKarOrani(195, null, 0.2)).toBeNull();
  });
  it("hızlı satışta ürün ÖTV'si kırılıma girer", async () => {
    const { kalemHesapla } = await import("../src/lib/satis/hesap");
    const h = kalemHesapla([{ aciklama: "X", miktar: 1, birimFiyat: 195, kdvOrani: 0.2, otvOrani: 0.25 }]);
    expect(h).toMatchObject({ genelToplam: 195, matrah: 130, otv: 32.5, kdv: 32.5 });
  });
});
