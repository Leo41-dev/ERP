import "server-only";
import type { Prisma } from "@prisma/client";
import { belgeAyarlari } from "@/lib/belgeAyarlari";
import { db } from "@/lib/db";
import { bugunTr } from "@/lib/dogrulama/teklif";
import type { ModelSecenek, TeklifBaslangic } from "./TeklifFormu";

export const modelEtiket = (m: { marka: { ad: string }; model: string; altModel: string }) => [m.marka.ad, m.model, m.altModel].filter(Boolean).join(" ");

/** Teklif formunun seçenekleri: araç modelleri (stok adediyle), ÖTV oranları, önceki kalem adları, firmalar */
export async function formVerisi() {
  const [modeller, stok, otv, oncekiler, firmalar, ayar] = await Promise.all([
    db.aracModeli.findMany({ include: { marka: true, tip: true }, orderBy: [{ marka: { ad: "asc" } }, { model: "asc" }, { altModel: "asc" }] }),
    db.arac.groupBy({ by: ["modelId"], where: { durum: "STOKTA" }, _count: true }),
    db.otvOrani.findMany({ where: { aktif: true }, orderBy: { oran: "asc" } }),
    db.teklifKalemi.findMany({ where: { modelId: null }, distinct: ["aciklama"], orderBy: { id: "desc" }, take: 200, select: { aciklama: true } }),
    db.firma.findMany({ where: { aktif: true }, orderBy: { id: "asc" }, select: { id: true, unvan: true, varsayilan: true } }),
    belgeAyarlari(),
  ]);
  const gun = Math.max(1, Number(ayar["belge.teklifGun"]) || 7);
  const gecerlilik = new Date(Date.parse(bugunTr()) + gun * 86_400_000).toISOString().slice(0, 10);
  return {
    modeller: modeller.map((m): ModelSecenek => ({
      id: m.id,
      etiket: modelEtiket(m),
      otv: m.tip?.varsayilanOtvOrani ? Number(m.tip.varsayilanOtvOrani) : null,
      stok: stok.find((s) => s.modelId === m.id)?._count ?? 0,
    })),
    otvOranlari: otv.map((o) => Number(o.oran)),
    oneriler: oncekiler.map((x) => x.aciklama),
    firmalar,
    gecerlilik,
  };
}

type TeklifTam = Prisma.TeklifGetPayload<{ include: { kalemler: true } }>;

const virgul = (v: Prisma.Decimal) => Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 3, useGrouping: false });

/** Var olan tekliften form başlangıcı; kopyada geçerlilik tarihi yenilenir. */
export function baslangicYap(t: TeklifTam | null, gecerlilik: string): TeklifBaslangic {
  return {
    musteriAd: t?.musteriAd ?? "",
    telefon: t?.telefon ?? "",
    eposta: t?.eposta ?? "",
    kimlikNo: t?.kimlikNo ?? "",
    gecerlilik,
    odemeKosullari: t?.odemeKosullari ?? "",
    not: t?.not ?? "",
    firmaId: t?.firmaId ?? null,
    kalemler: (t?.kalemler ?? [])
      .sort((a, b) => a.sira - b.sira)
      .map((x) => ({ aciklama: x.aciklama, modelId: x.modelId, miktar: virgul(x.miktar), fiyat: virgul(x.birimFiyat), kdv: String(Number(x.kdvOrani)), otv: String(Number(x.otvOrani)) })),
  };
}
