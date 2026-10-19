"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Hatalar } from "@/lib/dogrulama/cari";
import { urunDogrula } from "@/lib/dogrulama/urun";
import { sayi } from "@/lib/normalize";
import { yetkiIste } from "@/lib/oturum";
import { stokHareketYaz, yeniUrunKodu } from "@/lib/stok";

export type UrunDurum = { hatalar?: Hatalar; genel?: string; tamam?: string } | undefined;

const dec = (n: number | null) => (n === null ? null : new Prisma.Decimal(n));

export async function urunKaydet(id: number | null, _: UrunDurum, form: FormData): Promise<UrunDurum> {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const { veri, hatalar } = urunDogrula(form);
  if (Object.keys(hatalar).length) return { hatalar };
  const kod = veri.kod || (await yeniUrunKodu(db, veri.tur));
  if (await db.urun.findFirst({ where: { kod, ...(id ? { NOT: { id } } : {}) }, select: { id: true } })) return { hatalar: { kod: "Bu kodla kayıtlı ürün var." } };
  if (veri.barkod) {
    const b = await db.urun.findFirst({ where: { barkod: veri.barkod, ...(id ? { NOT: { id } } : {}) }, select: { kod: true } });
    if (b) return { hatalar: { barkod: `Bu barkod ${b.kod} kodlu üründe kayıtlı.` } };
  }
  if (veri.grupId && !(await db.urunGrubu.findUnique({ where: { id: veri.grupId }, select: { id: true } }))) return { hatalar: { grupId: "Grup bulunamadı." } };
  if (veri.markaId && !(await db.urunMarkasi.findUnique({ where: { id: veri.markaId }, select: { id: true } }))) return { hatalar: { markaId: "Marka bulunamadı." } };
  if (id) {
    const eski = await db.urun.findUnique({ where: { id }, select: { tur: true, miktar: true } });
    if (!eski) return { genel: "Ürün bulunamadı." };
    if (veri.tur === "HIZMET" && eski.tur !== "HIZMET" && Number(eski.miktar) !== 0) return { hatalar: { tur: "Stokta miktarı olan ürün hizmete çevrilemez." } };
  }
  const data = {
    ...veri,
    kod,
    kdvOrani: new Prisma.Decimal(veri.kdvOrani),
    alisFiyati: dec(veri.alisFiyati),
    satisFiyati: dec(veri.satisFiyati),
    kdvDahil: true,
    kritikStok: dec(veri.kritikStok),
  };
  // alış fiyatını göremeyen kullanıcı kaydettiğinde mevcut değer korunur
  if (form.get("alisFiyati") === null) delete (data as Partial<typeof data>).alisFiyati;
  const u = await db.$transaction(async (tx) => {
    const u = id ? await tx.urun.update({ where: { id }, data }) : await tx.urun.create({ data });
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: id ? "GUNCELLE" : "EKLE", tablo: "Urun", kayitId: String(u.id) } });
    return u;
  });
  revalidatePath("/stok");
  redirect(`/stok/${u.id}?kayit=1`);
}

/** Elle stok hareketi: çıkış (fire, kayıp, iç kullanım) ya da açılış girişi */
export async function stokDuzelt(urunId: number, _: UrunDurum, form: FormData): Promise<UrunDurum> {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const tur = String(form.get("tur"));
  const miktar = sayi(form.get("miktar"));
  const aciklama = String(form.get("aciklama") ?? "").trim();
  if (tur !== "CIKIS" && tur !== "ACILIS") return { genel: "İşlem türü geçersiz." };
  if (!miktar || miktar <= 0) return { hatalar: { miktar: "Miktar sıfırdan büyük olmalı." } };
  if (tur === "CIKIS" && !aciklama) return { hatalar: { aciklama: "Çıkış nedeni yazılmalı (fire, kayıp, servis kullanımı...)." } };
  let maliyet: number | null = null;
  if (tur === "ACILIS") {
    maliyet = sayi(form.get("maliyet"));
    if (maliyet === null || maliyet < 0) return { hatalar: { maliyet: "Birim maliyet (KDV hariç) yazılmalı." } };
  }
  const u = await db.urun.findUnique({ where: { id: urunId }, select: { tur: true, miktar: true, birim: true } });
  if (!u) return { genel: "Ürün bulunamadı." };
  if (u.tur === "HIZMET") return { genel: "Hizmet kartları stok tutmaz." };
  if (tur === "CIKIS" && Number(u.miktar) - miktar < 0 && k.rol !== "YONETICI") return { genel: `Stokta ${Number(u.miktar).toLocaleString("tr-TR")} ${u.birim} var, daha fazlası çıkılamaz.` };
  await db.$transaction(async (tx) => {
    await stokHareketYaz(tx, { urunId, tur, miktar: tur === "CIKIS" ? -miktar : miktar, birimMaliyet: maliyet, aciklama: aciklama || null, kaydeden: k.adSoyad });
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: `STOK_${tur}`, tablo: "Urun", kayitId: String(urunId), detay: { miktar, aciklama } } });
  });
  revalidatePath(`/stok/${urunId}`);
  return { tamam: tur === "CIKIS" ? "Çıkış kaydedildi." : "Giriş kaydedildi." };
}
