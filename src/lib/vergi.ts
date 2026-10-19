import type { Prisma } from "@prisma/client";

type Db = Pick<Prisma.TransactionClient, "kdvOrani" | "otvOrani">;

/** Ayarlar → Satış'taki aktif KDV oranları ("0.2" biçiminde, büyükten küçüğe) */
export async function kdvOranlari(db: Db) {
  return (await db.kdvOrani.findMany({ where: { aktif: true }, orderBy: { oran: "desc" } })).map((x) => String(Number(x.oran)));
}

/** Aktif ÖTV oranları ("0.37" biçiminde, küçükten büyüğe) */
export async function otvOranlariYazi(db: Db) {
  return (await db.otvOrani.findMany({ where: { aktif: true }, orderBy: { oran: "asc" } })).map((x) => String(Number(x.oran)));
}

/** Kayıttaki oran sonradan pasif yapıldıysa listede yine görünsün, düzenlerken sessizce değişmesin */
export const secenekli = (liste: string[], mevcut?: string | null) => (mevcut && !liste.includes(mevcut) ? [...liste, mevcut] : liste);
