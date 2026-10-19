import { describe, expect, it } from "vitest";
import { analizHesapla, csv, medyan, type AracVeri } from "../src/lib/analizHesap";

const bugun = new Date("2026-10-18T09:00:00Z");
const gun = (n: number) => new Date(bugun.getTime() - n * 86_400_000);
const arac = (o: Partial<AracVeri>): AracVeri => ({ id: 1, marka: "CFMOTO", model: "CFMOTO CFORCE 450", konum: "Atölye", kondisyon: "SIFIR", tedarikci: "T", gelis: gun(10), maliyet: 100, stokta: true, satis: null, ...o });
const tablo = (l: ReturnType<typeof analizHesapla>, a: string) => l.find((t) => t.anahtar === a)!;

describe("analiz", () => {
  const veri = [
    arac({ id: 1, gelis: gun(10) }),
    arac({ id: 2, gelis: gun(200), maliyet: 300 }),
    arac({ id: 3, gelis: gun(50), stokta: false, maliyet: 1000, satis: { tarih: gun(5), net: 1200, otv: 80, otvOrani: 0.08, satici: "A" } }),
    arac({ id: 4, gelis: gun(40), stokta: false, maliyet: 1000, model: "BRP X3", satis: { tarih: gun(2), net: 950, otv: 70, otvOrani: 0.37, satici: "A" } }),
  ];
  const t = analizHesapla(veri, [{ durum: "RET", gecerlilik: gun(1), tutar: 10, retNedeni: "Fiyat" }, { durum: "KABUL", gecerlilik: gun(1), tutar: 20, retNedeni: null }], { bas: gun(30), bit: bugun, bugun });
  it("yaşlandırma kovaları", () => {
    const y = tablo(t, "yaslandirma");
    expect(y.satirlar[0][1]).toBe(1);
    expect(y.satirlar[4][1]).toBe(1);
    expect(y.satirlar[4][3]).toBe(300);
  });
  it("satış süresi ve marj", () => {
    expect(tablo(t, "satis-suresi").satirlar[2][1]).toBe(2); // 31-60 gün
    const m = tablo(t, "marj");
    expect(m.satirlar[0][1]).toBe(1); // zarar
    expect(m.satirlar[6][1]).toBe(1); // %16,7 -> %15-20
  });
  it("ABC birikimli payı 100'e ulaşır", () => {
    const a = tablo(t, "abc");
    expect(a.satirlar[0][1]).toBe("A");
    expect(Number(a.satirlar.at(-1)![5])).toBeCloseTo(100);
  });
  it("teklif hunisi ve ret nedeni", () => {
    expect(tablo(t, "teklif").satirlar[4][1]).toBe(1);
    expect(tablo(t, "ret-nedenleri").satirlar[0][0]).toBe("fiyat");
  });
  it("medyan ve CSV", () => {
    expect(medyan([3, 1, 2, 10])).toBe(2.5);
    const c = csv({ anahtar: "x", baslik: "", aciklama: "", kolonlar: [{ ad: "A;B", tur: "metin" }, { ad: "T", tur: "tl" }], satirlar: [["x", 1234.567]] });
    expect(c).toBe('﻿"A;B";T\r\nx;1234,57');
  });
});
