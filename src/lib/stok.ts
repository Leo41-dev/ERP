import { Prisma, type StokHareketTur } from "@prisma/client";
import { KOD_ONEK } from "./dogrulama/urun";
import { kodOner, miktarYuvarla, yeniOrtalama } from "./stokHesap";

type Tx = Prisma.TransactionClient;
const dec = (n: number) => new Prisma.Decimal(n);

export type HareketGirdisi = {
  urunId: number;
  tur: StokHareketTur;
  miktar: number; // giriş +, çıkış -
  birimMaliyet?: number | null; // yalnızca girişte; verilmezse çıkışta ortalama maliyet yazılır
  tarih?: Date;
  satisId?: number;
  satisKalemiId?: number;
  iadeId?: number;
  stokGirisId?: number;
  sayimId?: number;
  aciklama?: string | null;
  kaydeden?: string;
};

/**
 * Tek yazım noktası: hareketi kaydeder, ürünün miktarını ve ortalama maliyetini aynı işlemde günceller.
 * Ürün satırı kilitlenir, aynı anda yapılan iki satış miktarı bozmaz.
 */
export async function stokHareketYaz(tx: Tx, h: HareketGirdisi) {
  const [u] = await tx.$queryRaw<{ miktar: Prisma.Decimal; ortMaliyet: Prisma.Decimal | null }[]>`
    SELECT "miktar", "ortMaliyet" FROM "Urun" WHERE "id" = ${h.urunId} FOR UPDATE`;
  if (!u) throw new Error(`Ürün bulunamadı: ${h.urunId}`);
  const eski = Number(u.miktar);
  const eskiOrt = u.ortMaliyet === null ? null : Number(u.ortMaliyet);
  const bakiye = miktarYuvarla(eski + h.miktar);
  let ort = eskiOrt;
  let birimMaliyet = h.birimMaliyet ?? null;
  if (h.miktar > 0 && birimMaliyet !== null) ort = yeniOrtalama(eski, eskiOrt, h.miktar, birimMaliyet);
  if (birimMaliyet === null) birimMaliyet = eskiOrt;
  await tx.urun.update({ where: { id: h.urunId }, data: { miktar: dec(bakiye), ortMaliyet: ort === null ? null : dec(Math.round(ort * 10000) / 10000) } });
  return tx.stokHareketi.create({
    data: {
      urunId: h.urunId,
      tur: h.tur,
      miktar: dec(h.miktar),
      birimMaliyet: birimMaliyet === null ? null : dec(Math.round(birimMaliyet * 10000) / 10000),
      bakiye: dec(bakiye),
      tarih: h.tarih ?? new Date(),
      satisId: h.satisId,
      satisKalemiId: h.satisKalemiId,
      iadeId: h.iadeId,
      stokGirisId: h.stokGirisId,
      sayimId: h.sayimId,
      aciklama: h.aciklama ?? null,
      kaydeden: h.kaydeden,
    },
  });
}

/** İptal edilen satışın stok çıkışlarını geri alır (yalnızca iade edilmemiş kısmı). */
export async function satisStoguGeriAl(tx: Tx, satisId: number, kaydeden: string) {
  const hareketler = await tx.stokHareketi.findMany({ where: { satisId, tur: { in: ["SATIS", "IADE", "IPTAL"] } } });
  const net = new Map<number, { miktar: number; maliyet: number | null }>();
  for (const h of hareketler) {
    const x = net.get(h.urunId) ?? { miktar: 0, maliyet: null };
    x.miktar += Number(h.miktar);
    if (h.tur === "SATIS" && h.birimMaliyet !== null) x.maliyet = Number(h.birimMaliyet);
    net.set(h.urunId, x);
  }
  for (const [urunId, x] of net) {
    const geri = miktarYuvarla(-x.miktar);
    if (geri > 0) await stokHareketYaz(tx, { urunId, tur: "IPTAL", miktar: geri, birimMaliyet: x.maliyet, satisId, aciklama: "Satış iptali", kaydeden });
  }
}

/** Türün ön ekiyle ("YP-00012") sıradaki boş ürün kodu */
export async function yeniUrunKodu(tx: Tx, tur: string) {
  const onEk = KOD_ONEK[tur] ?? "DG";
  const son = await tx.urun.findFirst({ where: { kod: { startsWith: `${onEk}-` } }, orderBy: { kod: "desc" }, select: { kod: true } });
  let no = Number(son?.kod.slice(onEk.length + 1)) || 0;
  for (;;) {
    const kod = kodOner(onEk, no);
    if (!(await tx.urun.findUnique({ where: { kod }, select: { id: true } }))) return kod;
    no++;
  }
}

/** Pano ve stok listesi için: kritik seviyedeki ya da eksideki ürünler, en acil olan üstte */
export async function kritikStoklar(db: Tx, sinir = 10) {
  const [liste, ozet] = await Promise.all([
    db.$queryRaw<{ id: number; kod: string; ad: string; birim: string; miktar: number; kritik: number | null }[]>`
      SELECT "id", "kod", "ad", "birim", "miktar"::float AS miktar, "kritikStok"::float AS kritik FROM "Urun"
      WHERE "aktif" AND "tur" NOT IN ('ARAC', 'HIZMET') AND ("miktar" < 0 OR ("kritikStok" IS NOT NULL AND "miktar" <= "kritikStok"))
      ORDER BY ("miktar" < 0) DESC, "miktar" / NULLIF("kritikStok", 0) ASC NULLS FIRST, "ad" LIMIT ${sinir}`,
    db.$queryRaw<{ kritik: bigint; eksi: bigint; deger: number | null }[]>`
      SELECT count(*) FILTER (WHERE "kritikStok" IS NOT NULL AND "miktar" <= "kritikStok" AND "miktar" >= 0) AS kritik,
             count(*) FILTER (WHERE "miktar" < 0) AS eksi,
             sum(CASE WHEN "miktar" > 0 THEN "miktar" * coalesce("ortMaliyet", 0) END)::float AS deger
      FROM "Urun" WHERE "aktif" AND "tur" NOT IN ('ARAC', 'HIZMET')`,
  ]);
  return { liste, kritik: Number(ozet[0].kritik), eksi: Number(ozet[0].eksi), deger: ozet[0].deger ?? 0 };
}
