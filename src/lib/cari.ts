import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { para } from "./normalize";
import { satisKalani } from "./satis/iade";

/** Cari bakiye: borç − alacak. Artı ise müşteri bize borçlu. */
export async function cariBakiye(cariId: number) {
  const t = await db.cariHareket.aggregate({ where: { cariId }, _sum: { borc: true, alacak: true } });
  const borc = Number(t._sum.borc ?? 0);
  const alacak = Number(t._sum.alacak ?? 0);
  return { borc, alacak, bakiye: para(borc - alacak) };
}

/** Tarih sırasıyla hareketler ve yürüyen bakiye */
export async function cariEkstre(cariId: number, basla?: Date, bitis?: Date) {
  const devir = basla
    ? await db.cariHareket.aggregate({ where: { cariId, tarih: { lt: basla } }, _sum: { borc: true, alacak: true } })
    : null;
  let bakiye = devir ? Number(devir._sum.borc ?? 0) - Number(devir._sum.alacak ?? 0) : 0;
  const acilis = para(bakiye);
  const hareketler = await db.cariHareket.findMany({
    where: { cariId, tarih: { ...(basla ? { gte: basla } : {}), ...(bitis ? { lte: bitis } : {}) } },
    orderBy: [{ tarih: "asc" }, { id: "asc" }],
    include: { satis: { select: { id: true, formNo: true } }, tahsilat: { select: { id: true, yontem: true, iptalZamani: true } } },
  });
  const satirlar = hareketler.map((h) => {
    bakiye += Number(h.borc) - Number(h.alacak);
    return { ...h, borc: Number(h.borc), alacak: Number(h.alacak), bakiye: para(bakiye) };
  });
  return { acilis, satirlar, kapanis: para(bakiye) };
}

/** İptal edilmemiş satışların tahsil edilmemiş kısmı (iadeler düşülür, müşteriye geri ödenen eklenir) */
export async function acikSatislar(filtre: { cariId?: number; saticiId?: number } = {}) {
  const rows = await db.$queryRaw<{ id: number; formNo: number; cariId: number; unvan: string; tarih: Date; genelToplam: Prisma.Decimal; tahsil: Prisma.Decimal; iade: Prisma.Decimal; geri: Prisma.Decimal; kesinti: Prisma.Decimal }[]>`
    SELECT * FROM (
      SELECT s.id, s."formNo", s."cariId", c.unvan, s.tarih, s."genelToplam", s."kesintiToplam" AS kesinti,
             (SELECT COALESCE(SUM(t.tutar), 0) FROM "Tahsilat" t WHERE t."satisId" = s.id AND t."iptalZamani" IS NULL) AS tahsil,
             (SELECT COALESCE(SUM(i.tutar), 0) FROM "Iade" i WHERE i."satisId" = s.id) AS iade,
             (SELECT COALESCE(SUM(g.tutar), 0) FROM "GeriOdeme" g JOIN "Iade" i ON i.id = g."iadeId" WHERE i."satisId" = s.id) AS geri
      FROM "Satis" s
      JOIN "Cari" c ON c.id = s."cariId"
      WHERE s.durum IN ('KAYITLI', 'FATURALANDI')
        ${filtre.cariId ? Prisma.sql`AND s."cariId" = ${filtre.cariId}` : Prisma.empty}
        ${filtre.saticiId ? Prisma.sql`AND s."saticiId" = ${filtre.saticiId}` : Prisma.empty}
    ) x
    WHERE x."genelToplam" - x.kesinti - CASE WHEN x."genelToplam" > 0 THEN x.iade * (1 - x.kesinti / x."genelToplam") ELSE x.iade END - x.tahsil + x.geri >= 0.01
    ORDER BY x.tarih ASC`;
  return rows.map((r) => {
    const genelToplam = Number(r.genelToplam);
    const tahsil = Number(r.tahsil) - Number(r.geri);
    const kesinti = Number(r.kesinti);
    return { ...r, genelToplam, kesinti, iade: Number(r.iade), tahsil, kalan: satisKalani({ genelToplam, iade: Number(r.iade), tahsil, geriOdeme: 0, kesinti }) };
  });
}

/** Bakiyesi borçlu müşteriler (tedarikçi hesapları hariç) */
export async function borcluCariler() {
  const rows = await db.$queryRaw<{ id: number; unvan: string; telefon: string | null; bakiye: Prisma.Decimal; son: Date }[]>`
    SELECT c.id, c.unvan, c.telefon, SUM(h.borc) - SUM(h.alacak) AS bakiye, MAX(h.tarih) AS son
    FROM "CariHareket" h JOIN "Cari" c ON c.id = h."cariId"
    WHERE c.rol IN ('MUSTERI', 'MUSTERI_TEDARIKCI')
    GROUP BY c.id
    HAVING SUM(h.borc) - SUM(h.alacak) >= 0.01
    ORDER BY bakiye DESC`;
  return rows.map((r) => ({ ...r, bakiye: Number(r.bakiye) }));
}
