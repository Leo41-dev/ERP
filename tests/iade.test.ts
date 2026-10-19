import { describe, expect, it } from "vitest";
import { iadeKalemleri, satisKalani } from "../src/lib/satis/iade";

const kalemler = [
  { id: 1, miktar: 2, tutar: 7000, iadeEdilen: 0 },
  { id: 2, miktar: 1, tutar: 1500, iadeEdilen: 0 },
];

describe("iadeKalemleri", () => {
  it("kısmi iadeyi birim fiyattan hesaplar", () => {
    const r = iadeKalemleri(kalemler, { 1: 1 });
    expect("hata" in r).toBe(false);
    if ("hata" in r) return;
    expect(r.toplam).toBe(3500);
    expect(r.tamami).toBe(false);
  });
  it("tamamı iade edilince bildirir", () => {
    const r = iadeKalemleri(kalemler, { 1: 2, 2: 1 });
    expect("tamami" in r && r.tamami).toBe(true);
  });
  it("önceki iadeyle birlikte satılan miktarı aşamaz", () => {
    const r = iadeKalemleri([{ id: 1, miktar: 2, tutar: 7000, iadeEdilen: 1 }], { 1: 2 });
    expect("hata" in r).toBe(true);
  });
  it("seçim yoksa hata", () => {
    expect("hata" in iadeKalemleri(kalemler, {})).toBe(true);
  });
});

describe("satisKalani", () => {
  it("tam ödenmiş satış tam iade ve geri ödemeyle sıfırlanır", () => {
    expect(satisKalani({ genelToplam: 100, iade: 100, tahsil: 100, geriOdeme: 100 })).toBe(0);
  });
  it("geri ödeme yapılmadıysa müşteriye borç eksi görünür", () => {
    expect(satisKalani({ genelToplam: 100, iade: 40, tahsil: 100, geriOdeme: 0 })).toBe(-40);
  });
});
