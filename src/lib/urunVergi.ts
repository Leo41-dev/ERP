import type { Prisma, VergiTanimi } from "@prisma/client";
import { vergiDegerOku, type EkVergi } from "./vergiHesap";
import { sayi } from "./normalize";

/** Ürün kartındaki ek vergileri de getirmek için include */
export const URUN_VERGILERI = { vergiler: { include: { vergi: true }, orderBy: { vergi: { ad: "asc" } } } } satisfies Prisma.UrunInclude;

export const ekVergi = (x: { deger: Prisma.Decimal | number; vergi: Pick<VergiTanimi, "id" | "ad" | "kod" | "hesap" | "kdvMatrahina" | "kesinti"> }): EkVergi => ({
  vergiId: x.vergi.id,
  ad: x.vergi.ad,
  kod: x.vergi.kod,
  hesap: x.vergi.hesap,
  deger: Number(x.deger),
  kdvMatrahina: x.vergi.kdvMatrahina,
  kesinti: x.vergi.kesinti,
});

/**
 * Ürün formundaki ek vergi seçimi: "vergi" alanları seçili tanım id'leri, "vergi_<id>" o ürüne özel oran/tutar
 * (boşsa tanımdaki varsayılan). Formda "vergiFormu" yoksa null döner, kayıtlı vergiler korunur.
 */
export async function formVergileri(db: Pick<Prisma.TransactionClient, "vergiTanimi">, f: FormData): Promise<{ hata: string } | { vergiler: ({ deger: number; vergi: VergiTanimi })[] } | null> {
  if (!f.has("vergiFormu")) return null;
  const ids = [...new Set(f.getAll("vergi").map(Number).filter(Boolean))];
  const tanimlar = await db.vergiTanimi.findMany({ where: { id: { in: ids } } });
  const vergiler = [];
  for (const t of tanimlar) {
    const yazilan = String(f.get(`vergi_${t.id}`) ?? "").trim();
    const n = yazilan ? sayi(yazilan) : null;
    if (yazilan && (n === null || n < 0)) return { hata: `${t.ad}: geçerli bir oran ya da tutar yazın.` };
    vergiler.push({ deger: n === null ? Number(t.deger) : vergiDegerOku(t.hesap, n), vergi: t });
  }
  return { vergiler };
}
