import "server-only";
import { db } from "@/lib/db";

/** Araç formunun seçim listeleri */
export async function aracFormListeleri() {
  const [modeller, konumlar, tedarikciler, otvOranlari] = await Promise.all([
    db.aracModeli.findMany({ include: { marka: true, tip: true }, orderBy: [{ marka: { ad: "asc" } }, { model: "asc" }, { altModel: "asc" }] }),
    db.konum.findMany({ where: { aktif: true }, orderBy: { ad: "asc" } }),
    db.cari.findMany({ where: { rol: { in: ["TEDARIKCI", "MUSTERI_TEDARIKCI"] } }, orderBy: { unvan: "asc" }, select: { id: true, unvan: true } }),
    db.otvOrani.findMany({ where: { aktif: true }, orderBy: { oran: "asc" } }),
  ]);
  return {
    modeller: modeller.map((m) => ({
      id: m.id,
      marka: m.marka.ad,
      ad: [m.model, m.altModel].filter(Boolean).join(" · "),
      tip: m.tip?.ad ?? null,
      otv: m.tip?.varsayilanOtvOrani ? Number(m.tip.varsayilanOtvOrani) : null,
    })),
    konumlar: konumlar.map((k) => ({ id: k.id, ad: k.ad })),
    tedarikciler,
    otvOranlari: otvOranlari.map((o) => Number(o.oran)),
  };
}
export type AracFormListeleri = Awaited<ReturnType<typeof aracFormListeleri>>;
