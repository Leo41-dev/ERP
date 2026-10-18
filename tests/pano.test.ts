import { describe, expect, it } from "vitest";
import { donemAraligi, gunFarki, hedefHesapla, trKunye } from "../src/lib/panoHesap";

describe("dönem aralığı (Türkiye saati)", () => {
  // 18.10.2026 01:30 TR = 17.10.2026 22:30 UTC
  const simdi = new Date("2026-10-17T22:30:00Z");
  it("bugünü Türkiye takvimine göre alır", () => {
    expect(trKunye(simdi).toISOString().slice(0, 10)).toBe("2026-10-18");
    const r = donemAraligi("bugun", simdi);
    expect(r.bas.toISOString()).toBe("2026-10-17T21:00:00.000Z");
    expect(r.bit.toISOString()).toBe("2026-10-18T21:00:00.000Z");
  });
  it("geçen ay", () => {
    const r = donemAraligi("gecenay", simdi);
    expect(r.bas.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(r.bit.toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });
  it("özel aralık bitiş gününü dahil eder", () => {
    const r = donemAraligi("ozel", simdi, { bas: "2026-10-01", bit: "2026-10-05" });
    expect(r.bit.toISOString()).toBe("2026-10-05T21:00:00.000Z");
  });
});

describe("gün farkı ve hedef", () => {
  it("gece yarısını geçen satış bir gün sayılır", () => {
    expect(gunFarki(new Date("2026-10-01T20:00:00Z"), new Date("2026-10-01T22:00:00Z"))).toBe(1);
  });
  it("son 3 ay ortalaması × 1,10", () => {
    const h = hedefHesapla([...Array(9)].map(() => ({ arac: true, tutar: 500000 })).concat([{ arac: false, tutar: 30000 }]));
    expect(h.adet).toBe(3);
    expect(h.ciro).toBe(1661000);
  });
  it("geçmiş yoksa en az 1 adet", () => {
    expect(hedefHesapla([]).adet).toBe(1);
  });
});
