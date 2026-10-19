import { describe, expect, it } from "vitest";
import { sayiYazi, tutarYazi } from "../src/lib/sayiYazi";

describe("sayiYazi", () => {
  it.each([
    [0, "SIFIR"],
    [7, "YEDİ"],
    [100, "YÜZ"],
    [1000, "BİN"],
    [1250, "BİNİKİYÜZELLİ"],
    [101_001, "YÜZBİRBİNBİR"],
    [2_000_000, "İKİMİLYON"],
    [1_350_499, "BİRMİLYONÜÇYÜZELLİBİNDÖRTYÜZDOKSANDOKUZ"],
  ])("%i", (n, beklenen) => expect(sayiYazi(n)).toBe(beklenen));

  it("kuruşlu tutar", () => {
    expect(tutarYazi(3350.5)).toBe("YALNIZ ÜÇBİNÜÇYÜZELLİ TL ELLİ KURUŞ");
    expect(tutarYazi(600)).toBe("YALNIZ ALTIYÜZ TL");
  });
});
