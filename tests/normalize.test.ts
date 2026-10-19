import { describe, expect, it } from "vitest";
import { anahtar, kimlikAyir, oran, sayi, tcknGecerli, telefon, vinMi } from "../src/lib/normalize";

describe("sayi", () => {
  it("Türkçe ondalık ve binlik ayraçlarını çözer", () => {
    expect(sayi("62,5")).toBe(62.5);
    expect(sayi("1.234,56")).toBe(1234.56);
    expect(sayi("1.234")).toBe(1234);
    expect(sayi(935299)).toBe(935299);
    expect(sayi("1.500.000 ₺")).toBe(1500000);
  });
  it("boş ve bozuk değerlerde null döner", () => {
    expect(sayi("")).toBeNull();
    expect(sayi(null)).toBeNull();
    expect(sayi("-")).toBeNull();
  });
});

describe("oran", () => {
  it("yüzde ve kesir girişlerini kesre çevirir", () => {
    expect(oran("20")).toBe(0.2);
    expect(oran(0.08)).toBe(0.08);
    expect(oran("%25")).toBe(0.25);
    expect(oran("0")).toBe(0);
  });
  it("Bilsoft'taki bozuk KDV değerlerini reddeder", () => {
    expect(oran("1914,64")).toBeNull();
    expect(oran("2026")).toBeNull();
  });
});

describe("kimlik", () => {
  it("TCKN algoritmasını uygular", () => {
    expect(tcknGecerli("10000000146")).toBe(true);
    expect(tcknGecerli("12345678901")).toBe(false);
    expect(tcknGecerli("01234567890")).toBe(false);
  });
  it("TCKN / VKN / geçersiz ayrımı yapar", () => {
    expect(kimlikAyir("10000000146")).toEqual({ tckn: "10000000146" });
    expect(kimlikAyir("1950932354")).toEqual({ vkn: "1950932354" });
    expect(kimlikAyir("123")).toEqual({ gecersiz: "123" });
    expect(kimlikAyir(null)).toEqual({});
  });
});

describe("telefon", () => {
  it("10 haneye indirger", () => {
    expect(telefon("05467810299")).toBe("5467810299");
    expect(telefon("+90 546 781 02 99")).toBe("5467810299");
    expect(telefon("5310297087")).toBe("5310297087");
    expect(telefon("12345")).toBeNull();
  });
});

describe("diğer", () => {
  it("anahtar İ/I farkını yok sayar", () => {
    expect(anahtar("Arctic Cat")).toBe(anahtar("ARCTİC CAT"));
  });
  it("VIN biçimini tanır", () => {
    expect(vinMi("2BXBMDD11SV000242")).toBe(true);
    expect(vinMi("YDV33483L526")).toBe(false);
  });
});
