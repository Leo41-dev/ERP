import { describe, expect, it } from "vitest";
import { odemeFarki, vergiKirilimi } from "../src/lib/satis/hesap";

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
      { yontem: "HAVALE", tutar: 600_000, taksit: null, aciklama: null },
      { yontem: "KART", tutar: 350_000, taksit: 6, aciklama: null },
    ]);
    expect(o).toEqual({ toplam: 950_000, fark: 50_000 });
  });
});
