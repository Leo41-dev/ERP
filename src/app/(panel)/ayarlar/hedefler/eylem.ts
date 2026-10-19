"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sayi } from "@/lib/normalize";
import { yetkiIste } from "@/lib/oturum";

export type HedefDurum = { hata?: string; tamam?: string } | undefined;

/** Satır başına hedef_adet_{id}, hedef_ciro_{id}; ikisi de boşsa kayıt silinir ve panoda öneri kullanılır. */
export async function hedefleriKaydet(ay: string, _: HedefDurum, f: FormData): Promise<HedefDurum> {
  const k = await yetkiIste("YONETICI");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ay)) return { hata: "Ay geçersiz." };
  const kullanicilar = await db.kullanici.findMany({ where: { rol: "SATIS" }, select: { id: true, adSoyad: true } });
  const islemler: Prisma.PrismaPromise<unknown>[] = [];
  let kayit = 0, silinen = 0;
  for (const u of kullanicilar) {
    const adetHam = String(f.get(`hedef_adet_${u.id}`) ?? "").trim();
    const ciroHam = String(f.get(`hedef_ciro_${u.id}`) ?? "").trim();
    if (!f.has(`hedef_adet_${u.id}`)) continue;
    if (!adetHam && !ciroHam) {
      islemler.push(db.satisHedefi.deleteMany({ where: { kullaniciId: u.id, ay } }));
      silinen++;
      continue;
    }
    const adet = Number(adetHam);
    const ciro = sayi(ciroHam);
    if (!Number.isInteger(adet) || adet < 0) return { hata: `${u.adSoyad}: araç hedefi tam sayı olmalı.` };
    if (ciro === null || ciro < 0) return { hata: `${u.adSoyad}: ciro hedefi geçersiz.` };
    const veri = { hedefAdet: adet, hedefCiro: new Prisma.Decimal(ciro), bazDonem: `elle · ${k.adSoyad}` };
    islemler.push(db.satisHedefi.upsert({ where: { kullaniciId_ay: { kullaniciId: u.id, ay } }, update: veri, create: { kullaniciId: u.id, ay, ...veri } }));
    kayit++;
  }
  islemler.push(db.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "GUNCELLE", tablo: "SatisHedefi", kayitId: ay, detay: { kayit, silinen } } }));
  await db.$transaction(islemler);
  revalidatePath("/ayarlar/hedefler");
  revalidatePath("/");
  return { tamam: "Hedefler kaydedildi." };
}
