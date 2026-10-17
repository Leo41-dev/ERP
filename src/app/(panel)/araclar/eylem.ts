"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { aracDogrula } from "@/lib/dogrulama/arac";
import { formNesne, type Hatalar } from "@/lib/dogrulama/cari";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";

export type AracDurum = { hatalar?: Hatalar; genel?: string } | undefined;

const dec = (n: number | null) => (n === null ? null : new Prisma.Decimal(n));

export async function aracKaydet(id: number | null, _: AracDurum, form: FormData): Promise<AracDurum> {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const { veri, maliyetler, hatalar } = aracDogrula(formNesne(form));
  if (Object.keys(hatalar).length) return { hatalar };
  const ayni = await db.arac.findFirst({ where: { sase: veri.sase, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (ayni) return { hatalar: { sase: "Bu şase numarasıyla kayıtlı araç var." } };

  const data = { ...veri, kdvOrani: dec(veri.kdvOrani), otvOrani: dec(veri.otvOrani) };
  const maliyetYaz = maliyetGorur(k);
  const arac = await db.$transaction(async (tx) => {
    let a;
    if (id) {
      const eski = await tx.arac.findUniqueOrThrow({ where: { id } });
      a = await tx.arac.update({ where: { id }, data });
      if (eski.konumId !== a.konumId && a.konumId) {
        await tx.konumTransferi.create({ data: { aracId: id, eskiKonumId: eski.konumId, yeniKonumId: a.konumId, yapan: k.adSoyad } });
      }
      if (maliyetYaz) await tx.aracMaliyet.deleteMany({ where: { aracId: id } });
    } else {
      a = await tx.arac.create({ data });
    }
    if (maliyetYaz && maliyetler.length) {
      await tx.aracMaliyet.createMany({ data: maliyetler.map((m) => ({ aracId: a.id, tur: m.tur, tutar: new Prisma.Decimal(m.tutar) })) });
    }
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: id ? "GUNCELLE" : "EKLE", tablo: "Arac", kayitId: String(a.id) } });
    return a;
  });
  revalidatePath("/araclar");
  redirect(`/araclar/${arac.id}`);
}

export async function konumDegistir(aracId: number, form: FormData) {
  const k = await yetkiIste("DEPO", "SATIS", "SERVIS");
  const yeniKonumId = Number(form.get("konumId"));
  const arac = await db.arac.findUnique({ where: { id: aracId } });
  if (!arac || !Number.isInteger(yeniKonumId) || arac.konumId === yeniKonumId) return;
  await db.$transaction([
    db.arac.update({ where: { id: aracId }, data: { konumId: yeniKonumId } }),
    db.konumTransferi.create({ data: { aracId, eskiKonumId: arac.konumId, yeniKonumId, yapan: k.adSoyad } }),
  ]);
  revalidatePath(`/araclar/${aracId}`);
}
