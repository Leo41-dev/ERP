"use server";
import { randomUUID } from "node:crypto";
import { Prisma, type HesapTur, type ParaBirimi } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Hatalar } from "@/lib/dogrulama/cari";
import { sayi } from "@/lib/normalize";
import { yetkiIste } from "@/lib/oturum";

export type FinansDurum = { hatalar?: Hatalar; genel?: string; tamam?: string } | undefined;

const dec = (n: number) => new Prisma.Decimal(n);
const metin = (f: FormData, a: string) => String(f.get(a) ?? "").trim();
const TURLER: HesapTur[] = ["KASA", "BANKA", "POS", "KREDI_KARTI"];
const PARALAR: ParaBirimi[] = ["TRY", "EUR", "USD"];
const gun = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);

/** Kasa, banka hesabı, POS ya da kredi kartı tanımı */
export async function hesapKaydet(id: number | null, _: FinansDurum, f: FormData): Promise<FinansDurum> {
  const k = await yetkiIste("MUHASEBE");
  const h: Hatalar = {};
  const ad = metin(f, "ad");
  const tur = TURLER.find((x) => x === metin(f, "tur"));
  const paraBirimi = PARALAR.find((x) => x === metin(f, "paraBirimi")) ?? "TRY";
  const acilis = metin(f, "acilisBakiye") ? sayi(f.get("acilisBakiye")) : 0;
  const acilisTarihi = gun(metin(f, "acilisTarihi")) ?? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const iban = metin(f, "iban").replace(/\s/g, "").toUpperCase();
  const firmaId = Number(f.get("firmaId")) || null;
  if (!ad) h.ad = "Hesap adı yazılmalı.";
  if (!tur) h.tur = "Hesap türü seçilmeli.";
  if (acilis === null) h.acilisBakiye = "Açılış bakiyesi geçersiz.";
  if (iban && !/^TR\d{24}$/.test(iban) && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) h.iban = "IBAN geçersiz (TR ile başlayan 26 karakter).";
  if (Object.keys(h).length) return { hatalar: h };
  const data = {
    ad, tur: tur!, paraBirimi, firmaId,
    banka: metin(f, "banka") || null, sube: metin(f, "sube") || null, hesapNo: metin(f, "hesapNo") || null, iban: iban || null,
    acilisBakiye: dec(acilis ?? 0), acilisTarihi, aciklama: metin(f, "aciklama") || null,
    ...(id ? { aktif: f.get("aktif") === "on" } : {}),
  };
  let yeniId = id;
  try {
    if (id) await db.finansHesabi.update({ where: { id }, data });
    else yeniId = (await db.finansHesabi.create({ data })).id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { hatalar: { ad: "Bu adla bir hesap var." } };
    throw e;
  }
  await db.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: id ? "GUNCELLE" : "EKLE", tablo: "FinansHesabi", kayitId: String(yeniId) } });
  revalidatePath("/finans", "layout");
  if (!id) redirect(`/finans/${yeniId}`);
  return { tamam: "Kaydedildi." };
}

/**
 * Elle hareket: giriş (diğer gelir, cariden para), çıkış (masraf, tedarikçiye ödeme) ya da virman.
 * Cari seçilirse cari hesaba da yazılır: giriş cariyi alacaklandırır, çıkış borçlandırır.
 * Müşteriden satış tahsilatı için Tahsilat ekranı kullanılır (makbuz ve satış eşlemesi orada).
 */
export async function hareketKaydet(_: FinansDurum, f: FormData): Promise<FinansDurum> {
  const k = await yetkiIste("MUHASEBE");
  const h: Hatalar = {};
  const tur = metin(f, "tur");
  const hesapId = Number(f.get("hesapId"));
  const hedefId = Number(f.get("hedefId")) || null;
  const tutar = sayi(f.get("tutar"));
  const tarih = gun(metin(f, "tarih"));
  const kategoriId = Number(f.get("kategoriId")) || null;
  const cariId = Number(f.get("cariId")) || null;
  const aciklama = metin(f, "aciklama") || null;
  const belgeNo = metin(f, "belgeNo") || null;
  if (!["GIRIS", "CIKIS", "VIRMAN"].includes(tur)) h.tur = "İşlem türü seçilmeli.";
  if (!tutar || tutar <= 0) h.tutar = "Tutar sıfırdan büyük olmalı.";
  if (!tarih) h.tarih = "Tarih geçersiz.";
  else if (tarih.getTime() > Date.now() + 86_400_000) h.tarih = "İleri tarihli hareket girilemez.";
  const hesap = await db.finansHesabi.findFirst({ where: { id: hesapId, aktif: true } });
  if (!hesap) h.hesapId = "Hesap seçilmeli.";
  if (tur === "VIRMAN") {
    const hedef = hedefId ? await db.finansHesabi.findFirst({ where: { id: hedefId, aktif: true } }) : null;
    if (!hedef || hedefId === hesapId) h.hedefId = "Paranın gideceği farklı bir hesap seçilmeli.";
    else if (hesap && hedef.paraBirimi !== hesap.paraBirimi) h.hedefId = "Farklı para birimli hesaplar arasında virman henüz yapılamaz.";
  } else if (!kategoriId && !cariId) h.kategoriId = "Kategori ya da cari seçilmeli.";
  if (kategoriId && !(await db.finansKategori.findFirst({ where: { id: kategoriId, tur: tur === "GIRIS" ? "GELIR" : "GIDER" } }))) h.kategoriId = "Kategori bu işleme uymuyor.";
  const cari = cariId ? await db.cari.findUnique({ where: { id: cariId }, select: { id: true, unvan: true } }) : null;
  if (cariId && !cari) h.cariId = "Cari bulunamadı.";
  if (Object.keys(h).length) return { hatalar: h };

  const t = tarih!.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) ? new Date() : new Date(tarih!.getTime() + 12 * 3_600_000);
  await db.$transaction(async (tx) => {
    if (tur === "VIRMAN") {
      const virmanNo = randomUUID();
      const ortak = { tarih: t, aciklama: aciklama ?? "Virman", belgeNo, virmanNo, kaynak: "VIRMAN" as const, kaydeden: k.adSoyad };
      await tx.hesapHareketi.create({ data: { ...ortak, hesapId, cikis: dec(tutar!) } });
      await tx.hesapHareketi.create({ data: { ...ortak, hesapId: hedefId!, giris: dec(tutar!) } });
    } else {
      const x = await tx.hesapHareketi.create({ data: { hesapId, tarih: t, [tur === "GIRIS" ? "giris" : "cikis"]: dec(tutar!), aciklama, belgeNo, kategoriId, cariId, kaynak: "MANUEL", kaydeden: k.adSoyad } });
      if (cari) {
        await tx.cariHareket.create({
          data: { cariId: cari.id, tarih: t, [tur === "GIRIS" ? "alacak" : "borc"]: dec(tutar!), aciklama: `${tur === "GIRIS" ? "Hesaba giriş" : "Hesaptan ödeme"} (${hesap!.ad})${aciklama ? `: ${aciklama}` : ""}`, hesapHareketiId: x.id },
        });
      }
    }
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: `HESAP_${tur}`, tablo: "HesapHareketi", kayitId: String(hesapId), detay: { tutar, hedefId, cariId, kategoriId } } });
  });
  revalidatePath("/finans", "layout");
  if (cari) revalidatePath(`/musteriler/${cari.id}`);
  redirect(`/finans/${hesapId}?kayit=1`);
}

/**
 * Elle girilen hareket ve virman iptal edilir (silinmez); virmanın iki bacağı birlikte, cariye bağlıysa ters kayıt atılır.
 * Tahsilat ve iade ödemesinden gelen hareketler kendi ekranlarından iptal edilir.
 */
export async function hareketIptal(id: number, neden: string): Promise<{ hata?: string }> {
  const k = await yetkiIste("MUHASEBE");
  neden = neden.trim();
  if (!neden) return { hata: "İptal nedeni yazılmalı." };
  const x = await db.hesapHareketi.findUnique({ where: { id }, include: { cariHareket: true, hesap: { select: { ad: true } } } });
  if (!x || x.iptalZamani) return { hata: "Hareket bulunamadı ya da zaten iptal edilmiş." };
  if (x.kaynak === "TAHSILAT" || x.kaynak === "GERI_ODEME") return { hata: "Bu hareket tahsilattan ya da iade ödemesinden geliyor; o kayıttan iptal edin." };
  const veri = { iptalZamani: new Date(), iptalEden: k.adSoyad, iptalNedeni: neden };
  await db.$transaction(async (tx) => {
    await tx.hesapHareketi.updateMany({ where: x.virmanNo ? { virmanNo: x.virmanNo, iptalZamani: null } : { id, iptalZamani: null }, data: veri });
    if (x.cariHareket) {
      const c = x.cariHareket;
      await tx.cariHareket.create({ data: { cariId: c.cariId, tarih: new Date(), borc: c.alacak, alacak: c.borc, aciklama: `İptal (${x.hesap.ad}): ${neden}` } });
    }
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "IPTAL", tablo: "HesapHareketi", kayitId: String(id), detay: { neden } } });
  });
  revalidatePath("/finans", "layout");
  return {};
}
