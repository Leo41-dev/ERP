import "server-only";
import { db } from "./db";
import { analizHesapla, type AracVeri } from "./analizHesap";

/** Analiz merkezi: araçlar, satışları ve dönemdeki teklifler veritabanından okunup hesaplanır. */
export async function analizVerisi(bas: Date, bit: Date) {
  const [araclar, teklifler] = await Promise.all([
    db.arac.findMany({
      include: {
        model: { include: { marka: true } },
        konum: true,
        tedarikci: { select: { unvan: true } },
        maliyetler: { select: { tutar: true } },
        kalemler: {
          where: { satis: { durum: { in: ["KAYITLI", "FATURALANDI"] } } },
          include: { satis: { select: { tarih: true, genelToplam: true, otvToplam: true, satici: { select: { adSoyad: true } }, iadeler: { select: { tutar: true } } } } },
          orderBy: { id: "desc" },
          take: 1,
        },
      },
    }),
    db.teklif.findMany({ where: { tarih: { gte: bas, lt: bit } }, select: { durum: true, gecerlilik: true, genelToplam: true, retNedeni: true } }),
  ]);
  const veri: AracVeri[] = araclar.map((a) => {
    const k = a.kalemler[0];
    const genel = k ? Number(k.satis.genelToplam) : 0;
    const net = k ? genel - k.satis.iadeler.reduce((t, i) => t + Number(i.tutar), 0) : 0;
    return {
      id: a.id,
      marka: a.model?.marka.ad ?? "Markasız",
      model: a.model ? [a.model.marka.ad, a.model.model, a.model.altModel].filter(Boolean).join(" ") : "Modelsiz",
      konum: a.konum?.ad ?? "Konumsuz",
      kondisyon: a.kondisyon,
      tedarikci: a.tedarikci?.unvan ?? "Belirtilmemiş",
      gelis: a.gelisTarihi ?? a.olusturma,
      maliyet: a.maliyetler.reduce((t, m) => t + Number(m.tutar), 0),
      stokta: a.durum === "STOKTA" || a.durum === "REZERVE",
      satis: k && net > 0.01 && !(a.durum === "STOKTA")
        ? { tarih: k.satis.tarih, net, otv: genel ? Number(k.satis.otvToplam ?? 0) * (net / genel) : 0, otvOrani: Number(k.otvOrani), satici: k.satis.satici?.adSoyad ?? "-" }
        : null,
    };
  });
  return analizHesapla(veri, teklifler.map((t) => ({ durum: t.durum, gecerlilik: t.gecerlilik, tutar: Number(t.genelToplam), retNedeni: t.retNedeni })), { bas, bit, bugun: new Date() });
}
