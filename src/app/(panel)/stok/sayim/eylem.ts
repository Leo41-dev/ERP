"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sayi } from "@/lib/normalize";
import { yetkiIste } from "@/lib/oturum";
import { stokHareketYaz } from "@/lib/stok";
import { miktarYuvarla, sayimFarki } from "@/lib/stokHesap";

export type SayimDurum = { genel?: string; tamam?: string; anahtar?: number } | undefined;

const acikSayim = (id: number) => db.sayim.findFirst({ where: { id, durum: "ACIK" }, select: { id: true } });

export async function sayimBaslat(_: SayimDurum, form: FormData): Promise<SayimDurum> {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const aciklama = String(form.get("aciklama") ?? "").trim();
  if (!aciklama) return { genel: "Sayıma bir ad verin (ör. Ekim 2026 genel sayım, Yağ rafı)." };
  const s = await db.sayim.create({ data: { aciklama, kaydeden: k.adSoyad } });
  redirect(`/stok/sayim/${s.id}`);
}

/** Sayılan miktarı yazar; "ekle" modunda (barkodla tek tek okutma) mevcut sayıma ekler. */
export async function sayimSatirYaz(sayimId: number, _: SayimDurum, form: FormData): Promise<SayimDurum> {
  await yetkiIste("DEPO", "MUHASEBE");
  if (!(await acikSayim(sayimId))) return { genel: "Sayım kapanmış." };
  const urunId = Number(form.get("urunId"));
  const miktar = sayi(form.get("miktar"));
  const ekle = form.get("mod") === "ekle";
  if (!urunId) return { genel: "Ürün seçin ya da barkod okutun." };
  if (miktar === null || miktar < 0 || (ekle && miktar === 0)) return { genel: "Miktar geçersiz." };
  const u = await db.urun.findUnique({ where: { id: urunId }, select: { tur: true, ad: true, birim: true } });
  if (!u || u.tur === "HIZMET" || u.tur === "ARAC") return { genel: "Bu ürün sayılamaz." };
  const s = await db.sayimSatiri.upsert({
    where: { sayimId_urunId: { sayimId, urunId } },
    create: { sayimId, urunId, sayilan: new Prisma.Decimal(miktar) },
    update: { sayilan: ekle ? { increment: new Prisma.Decimal(miktar) } : new Prisma.Decimal(miktar) },
  });
  revalidatePath(`/stok/sayim/${sayimId}`);
  return { tamam: `${u.ad}: ${Number(s.sayilan).toLocaleString("tr-TR")} ${u.birim}`, anahtar: Date.now() };
}

export async function sayimSatirSil(sayimId: number, satirId: number) {
  await yetkiIste("DEPO", "MUHASEBE");
  if (!(await acikSayim(sayimId))) return;
  await db.sayimSatiri.deleteMany({ where: { id: satirId, sayimId } });
  revalidatePath(`/stok/sayim/${sayimId}`);
}

/** Sayımı kapatır: her sayılan ürün için sistemdeki miktarla fark kadar SAYIM hareketi yazılır. */
export async function sayimKapat(sayimId: number, _: SayimDurum): Promise<SayimDurum> {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const sayim = await db.sayim.findFirst({ where: { id: sayimId, durum: "ACIK" }, include: { satirlar: true } });
  if (!sayim) return { genel: "Sayım bulunamadı ya da kapanmış." };
  if (!sayim.satirlar.length) return { genel: "Sayılmış ürün yok." };
  await db.$transaction(async (tx) => {
    for (const x of sayim.satirlar) {
      const u = await tx.urun.findUniqueOrThrow({ where: { id: x.urunId }, select: { miktar: true } });
      const sistem = Number(u.miktar);
      const fark = sayimFarki(Number(x.sayilan), sistem);
      await tx.sayimSatiri.update({ where: { id: x.id }, data: { sistem: new Prisma.Decimal(miktarYuvarla(sistem)) } });
      if (fark !== 0) await stokHareketYaz(tx, { urunId: x.urunId, tur: "SAYIM", miktar: fark, sayimId, aciklama: `Sayım ${sayim.sayimNo}: ${sayim.aciklama}`, kaydeden: k.adSoyad });
    }
    await tx.sayim.update({ where: { id: sayimId }, data: { durum: "KAPALI", kapanis: new Date() } });
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "SAYIM_KAPAT", tablo: "Sayim", kayitId: String(sayimId), detay: { satir: sayim.satirlar.length } } });
  }, { timeout: 60_000 });
  revalidatePath("/stok");
  redirect(`/stok/sayim/${sayimId}`);
}
