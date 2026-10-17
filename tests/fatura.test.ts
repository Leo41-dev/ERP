import { describe, expect, it } from "vitest";
import { esle, eslemeAnahtari, type ModelSatiri } from "../src/lib/fatura/esle";
import { faturaOku } from "../src/lib/fatura/oku";

const fatura = (govde: string, notlar = "") => `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>ABC2026000000123</cbc:ID>
  <cbc:IssueDate>2026-10-10</cbc:IssueDate>
  ${notlar}
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification>
    <cac:PartyIdentification><cbc:ID schemeID="MERSISNO">0123</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>UĞUR MOTORLU ARAÇLAR A.Ş.</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingSupplierParty>
  ${govde}
</Invoice>`;

const satir = (ic: string, adet = 1, fiyat = 100000, otv = "") => `
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    ${ic.includes("<cbc:Note>") ? ic.split("@@")[0] : ""}
    <cbc:InvoicedQuantity unitCode="C62">${adet}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">${adet * fiyat}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cac:TaxSubtotal><cbc:Percent>20</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
      ${otv}
    </cac:TaxTotal>
    <cac:Item>${ic.includes("@@") ? ic.split("@@")[1] : ic}</cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="TRY">${fiyat}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;

describe("faturaOku", () => {
  it("satır notundaki şase, motor, yıl ve rengi okur", () => {
    const xml = fatura(satir(`<cbc:Note>ACK:RENK:SIYAH-GRI - M.N: 172MM2CRE055022 - S.N: LCEPDNLM4T7003264 - M.Y: 2026</cbc:Note>@@<cbc:Name>CFMOTO CFORCE 625 TOURING</cbc:Name>`));
    const s = faturaOku(xml, "a.xml");
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.faturaNo).toBe("ABC2026000000123");
    expect(s.saticiVkn).toBe("1234567890");
    expect(s.araclar).toHaveLength(1);
    expect(s.araclar[0]).toMatchObject({ sase: "LCEPDNLM4T7003264", motor: "172MM2CRE055022", yil: "2026", renk: "SIYAH-GRI", birimFiyat: 100000, kdvOrani: 0.2, otvOrani: null });
    expect(s.araclar[0].uyarilar).toEqual([]);
  });

  it("adet kadar SerialID okur, ÖTV oranını alır ve eksik şaseyi uyarır", () => {
    const otv = `<cac:TaxSubtotal><cbc:Percent>37</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>0071</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`;
    const ic = `<cbc:Name>SEGWAY SNARLER AT6</cbc:Name><cac:ItemInstance><cbc:SerialID>LSGAT6000000000A1</cbc:SerialID></cac:ItemInstance><cac:ItemInstance><cbc:SerialID>LSGAT6000000000A2</cbc:SerialID></cac:ItemInstance>`;
    const s = faturaOku(fatura(satir(ic, 3, 50000, otv)));
    if (!s.ok) throw new Error(s.hata);
    expect(s.araclar.map((a) => a.sase)).toEqual(["LSGAT6000000000A1", "LSGAT6000000000A2"]);
    expect(s.araclar[0].otvOrani).toBe(0.37);
    expect(s.uyarilar.some((u) => u.includes("3 adet var ama 2 şase"))).toBe(true);
  });

  it("başlık notlarındaki numaralı araç bloklarını okur", () => {
    const notlar = `<cbc:Note>1.Marka: TGB  Şasi No: RFCTGB00000000001 Motor No: M1 Model Yılı: 2025 Renk: KIRMIZI
2.Marka: TGB  Şasi No: RFCTGB00000000002 Motor No: M2 Model Yılı: 2025 Renk: MAVİ</cbc:Note>`;
    const s = faturaOku(fatura(satir(`<cbc:Name>TGB BLADE 600</cbc:Name>`, 2), notlar));
    if (!s.ok) throw new Error(s.hata);
    expect(s.araclar.map((a) => [a.sase, a.motor, a.renk])).toEqual([
      ["RFCTGB00000000001", "M1", "KIRMIZI"],
      ["RFCTGB00000000002", "M2", "MAVİ"],
    ]);
  });

  it("fatura olmayan XML'i reddeder", () => {
    const s = faturaOku("<Siparis/>");
    expect(s.ok).toBe(false);
  });
});

describe("esle", () => {
  const modeller: ModelSatiri[] = [
    { id: 1, marka: "CFMOTO", model: "CFORCE", alt: "625 TOURING", tip: "ATV" },
    { id: 2, marka: "CFMOTO", model: "CFORCE", alt: "1000 OVERLAND", tip: "ATV" },
    { id: 3, marka: "BRP", model: "OUTLANDER", alt: "MAX XT-P 1000R T ABS", tip: "ATV" },
    { id: 4, marka: "BRP", model: "OUTLANDER", alt: "MAX XT-P 1000R T ABS SAS", tip: "ATV" },
  ];
  const arac = (urunAdi: string) => ({ satirNo: "1", sase: "X", motor: "", yil: "", renk: "", markaHam: "", urunAdi, aciklama: "", tipHam: "", birimFiyat: 1, kdvOrani: 0.2, otvOrani: null, kaynak: "", uyarilar: [] });

  it("alt model adı geçiyorsa yüksek güvenle eşler", () => {
    const a = arac("CFMOTO CFORCE 625 TOURING");
    expect(esle(a, "k", modeller, new Map())).toMatchObject({ modelId: 1, guven: "yuksek" });
  });

  it("BRP'de en özgül alt modeli seçer ve onay ister", () => {
    const a = arac("BRP CAN-AM_ATV OUTL MAX XTP 1000R GY ABS SAS TR 26_T3");
    expect(esle(a, "k", modeller, new Map())).toMatchObject({ modelId: 4, guven: "kontrol" });
  });

  it("kayıtlı eşlemeyi önceliklendirir", () => {
    const a = arac("ÖZEL ADLI ÜRÜN");
    const anahtar = eslemeAnahtari("1234567890", a);
    expect(esle(a, anahtar, modeller, new Map([[anahtar, 2]]))).toMatchObject({ modelId: 2, guven: "kayitli" });
  });

  it("marka yoksa öneri yapmaz", () => {
    expect(esle(arac("BILINMEYEN MARKA X"), "k", modeller, new Map())).toMatchObject({ modelId: null, guven: "yok" });
  });
});
