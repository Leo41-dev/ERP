import "server-only";
import { db } from "./db";
import { para } from "./normalize";
import { ayBasi, ayKaydir, hedefHesapla } from "./panoHesap";

/** Satış personelinin bir ay için hedef tablosu: önceki 3 ayın gerçekleşeni, öneri, kayıtlı hedef ve o ayın gerçekleşeni */
export async function hedefTablosu(ay: string) {
  const ilk = ayKaydir(ay, -3);
  const [kullanicilar, satislar, kayitlar] = await Promise.all([
    db.kullanici.findMany({ where: { aktif: true, rol: "SATIS" }, select: { id: true, adSoyad: true }, orderBy: { adSoyad: "asc" } }),
    db.satis.findMany({
      where: { durum: { in: ["KAYITLI", "FATURALANDI"] }, tarih: { gte: ayBasi(ilk), lt: ayBasi(ayKaydir(ay, 1)) } },
      select: { saticiId: true, tur: true, tarih: true, genelToplam: true, iadeler: { select: { tutar: true } } },
    }),
    db.satisHedefi.findMany({ where: { ay } }),
  ]);
  const aylar = [ilk, ayKaydir(ay, -2), ayKaydir(ay, -1)];
  const ayiBul = (d: Date) => new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 7);
  return {
    aylar,
    satirlar: kullanicilar.map((u) => {
      const kendi = satislar.filter((s) => s.saticiId === u.id).map((s) => ({ ay: ayiBul(s.tarih), arac: s.tur === "ARAC", tutar: Number(s.genelToplam) - s.iadeler.reduce((t, i) => t + Number(i.tutar), 0) }));
      const ozet = (a: string) => {
        const l = kendi.filter((s) => s.ay === a);
        return { adet: l.filter((s) => s.arac).length, ciro: para(l.reduce((t, s) => t + s.tutar, 0)) };
      };
      const kayit = kayitlar.find((k) => k.kullaniciId === u.id);
      return {
        id: u.id,
        ad: u.adSoyad,
        gecmis: aylar.map(ozet),
        oneri: hedefHesapla(kendi.filter((s) => s.ay !== ay)),
        kayit: kayit ? { adet: kayit.hedefAdet, ciro: Number(kayit.hedefCiro), baz: kayit.bazDonem } : null,
        gerceklesen: ozet(ay),
      };
    }),
  };
}
