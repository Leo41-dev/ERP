"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Hatalar } from "@/lib/dogrulama/cari";
import { girisDogrula, girisToplam } from "@/lib/dogrulama/stokGiris";
import { bugunTr } from "@/lib/dogrulama/teklif";
import { norm } from "@/lib/fatura/esle";
import { faturaUrunOku, urunEslemeAnahtari, type FaturaUrun } from "@/lib/fatura/urunOku";
import { yetkiIste } from "@/lib/oturum";
import { stokHareketYaz, yeniUrunKodu } from "@/lib/stok";
import { marjliFiyat } from "@/lib/stokHesap";
import { URUN_VERGILERI, ekVergi } from "@/lib/urunVergi";
import type { UrunBulunan } from "../ara/route";

export type GirisDurum = { hatalar?: Hatalar; genel?: string; uyari?: string; onayIste?: boolean } | undefined;

export type XmlSatir = FaturaUrun & { anahtar: string; urun: UrunBulunan | null; eslesme: "kayitli" | "barkod" | "kod" | "ad" | "yok" };
export type XmlSonuc =
  | { hata: string }
  | { faturaNo: string; tarih: string; tedarikci: { id: number | null; unvan: string; vkn: string }; satirlar: XmlSatir[]; uyarilar: string[] };

const dec = (n: number) => new Prisma.Decimal(n);
const bulunan = (u: { id: number; kod: string; ad: string; birim: string; tur: string; miktar: Prisma.Decimal; satisFiyati: Prisma.Decimal | null; kdvOrani: Prisma.Decimal; otvOrani: Prisma.Decimal; barkod: string | null }): UrunBulunan => ({
  id: u.id, kod: u.kod, ad: u.ad, birim: u.birim, tur: u.tur, miktar: Number(u.miktar), satisFiyati: u.satisFiyati === null ? null : Number(u.satisFiyati), kdvOrani: Number(u.kdvOrani), otvOrani: Number(u.otvOrani), barkod: u.barkod,
});

/** Yüklenen e-fatura XML'ini okuyup satırları stok kartlarıyla eşler; kayıt yapmaz. */
export async function xmlOku(form: FormData): Promise<XmlSonuc> {
  await yetkiIste("DEPO", "MUHASEBE");
  const dosya = form.get("dosya");
  if (!(dosya instanceof File) || !dosya.size) return { hata: "XML dosyası seçin." };
  if (dosya.size > 5_000_000) return { hata: "Dosya çok büyük." };
  const s = faturaUrunOku(await dosya.text());
  if (!s.ok) return { hata: s.hata };
  const uyarilar = [...s.uyarilar];

  const tedarikci = s.saticiVkn ? await db.cari.findFirst({ where: s.saticiVkn.length === 11 ? { tckn: s.saticiVkn } : { vkn: s.saticiVkn }, select: { id: true, unvan: true, rol: true } }) : null;
  if (tedarikci && s.faturaNo) {
    const once = await db.stokGiris.findFirst({ where: { tedarikciId: tedarikci.id, faturaNo: s.faturaNo }, select: { girisNo: true } });
    if (once) uyarilar.unshift(`Bu fatura daha önce ${once.girisNo} numaralı girişle kaydedilmiş.`);
  }
  const anahtarlar = s.satirlar.map((x) => urunEslemeAnahtari(s.saticiVkn, x));
  const [eslemeler, adaylar] = await Promise.all([
    db.urunEsleme.findMany({ where: { anahtar: { in: anahtarlar } }, include: { urun: true } }),
    db.urun.findMany({
      where: {
        tur: { not: "ARAC" },
        OR: [
          { barkod: { in: s.satirlar.map((x) => x.barkod).filter(Boolean) } },
          { kod: { in: s.satirlar.map((x) => x.saticiKodu.toLocaleUpperCase("tr-TR")).filter(Boolean) } },
          { ad: { in: s.satirlar.map((x) => x.ad) } },
        ],
      },
    }),
  ]);
  const satirlar: XmlSatir[] = s.satirlar.map((x, i) => {
    const e = eslemeler.find((y) => y.anahtar === anahtarlar[i]);
    if (e) return { ...x, anahtar: anahtarlar[i], urun: bulunan(e.urun), eslesme: "kayitli" };
    const b = x.barkod && adaylar.find((u) => u.barkod === x.barkod);
    if (b) return { ...x, anahtar: anahtarlar[i], urun: bulunan(b), eslesme: "barkod" };
    const k = x.saticiKodu && adaylar.find((u) => norm(u.kod) === norm(x.saticiKodu));
    if (k) return { ...x, anahtar: anahtarlar[i], urun: bulunan(k), eslesme: "kod" };
    const a = adaylar.find((u) => u.ad === x.ad);
    if (a) return { ...x, anahtar: anahtarlar[i], urun: bulunan(a), eslesme: "ad" };
    return { ...x, anahtar: anahtarlar[i], urun: null, eslesme: "yok" };
  });
  const tarih = /^\d{4}-\d{2}-\d{2}$/.test(s.faturaTarihi) ? s.faturaTarihi : bugunTr();
  return { faturaNo: s.faturaNo, tarih, tedarikci: { id: tedarikci && tedarikci.rol !== "MUSTERI" ? tedarikci.id : null, unvan: tedarikci?.unvan ?? s.saticiUnvan.toLocaleUpperCase("tr-TR"), vkn: s.saticiVkn }, satirlar, uyarilar };
}

export async function girisKaydet(_: GirisDurum, form: FormData): Promise<GirisDurum> {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const { veri: v, hatalar } = girisDogrula(form, bugunTr());
  if (Object.keys(hatalar).length) return { hatalar };
  const ids = [...new Set(v.satirlar.map((x) => x.urunId).filter((x): x is number => x !== null))];
  const urunler = await db.urun.findMany({ where: { id: { in: ids } }, select: { id: true, tur: true, ad: true } });
  if (urunler.length !== ids.length) return { genel: "Seçilen ürünlerden biri bulunamadı, sayfayı yenileyin." };
  const hizmet = urunler.find((u) => u.tur === "HIZMET" || u.tur === "ARAC");
  if (hizmet) return { hatalar: { satirlar: `${hizmet.ad} hizmet kartı, stok girişi yapılamaz.` } };

  let tedarikciId = v.tedarikciId;
  if (!tedarikciId && v.tedarikciVkn) tedarikciId = (await db.cari.findFirst({ where: v.tedarikciVkn.length === 11 ? { tckn: v.tedarikciVkn } : { vkn: v.tedarikciVkn }, select: { id: true } }))?.id ?? null;
  if (tedarikciId && v.faturaNo && form.get("tekrarOnay") !== "1") {
    const once = await db.stokGiris.findFirst({ where: { tedarikciId, faturaNo: v.faturaNo }, select: { girisNo: true } });
    if (once) return { uyari: `Bu tedarikçinin ${v.faturaNo} numaralı faturası ${once.girisNo} numaralı girişle zaten kaydedilmiş. Yine de kaydetmek için tekrar Kaydet'e basın.`, onayIste: true };
  }

  const t = girisToplam(v.satirlar);
  const id = await db.$transaction(async (tx) => {
    if (!tedarikciId && (v.tedarikciVkn || v.tedarikciUnvan)) {
      const alan = v.tedarikciVkn.length === 11 ? { tckn: v.tedarikciVkn } : v.tedarikciVkn ? { vkn: v.tedarikciVkn } : {};
      tedarikciId = (await tx.cari.create({ data: { ...alan, tip: "KURUMSAL", rol: "TEDARIKCI", unvan: v.tedarikciUnvan || "TEDARİKÇİ" } })).id;
    }
    if (tedarikciId) {
      await tx.cari.updateMany({ where: { id: tedarikciId, rol: "MUSTERI" }, data: { rol: "MUSTERI_TEDARIKCI" } });
    }
    const g = await tx.stokGiris.create({
      data: { tedarikciId, faturaNo: v.faturaNo, tarih: v.tarih, araToplam: dec(t.araToplam), kdvToplam: dec(t.kdvToplam), genelToplam: dec(t.genelToplam), kaynak: v.kaynak, not: v.not, kaydeden: k.adSoyad },
    });
    // aynı belgede aynı yeni ürün iki satırda geçerse tek kart açılır
    const yeniKartlar = new Map<string, number>();
    for (const [i, x] of v.satirlar.entries()) {
      let urunId = x.urunId;
      if (!urunId) {
        const anahtar = `${x.yeniTur}|${x.yeniAd}`;
        urunId = yeniKartlar.get(anahtar) ?? null;
        if (!urunId) {
          const varOlan = await tx.urun.findFirst({ where: { ad: x.yeniAd, tur: { not: "ARAC" } }, select: { id: true } });
          urunId = varOlan?.id ?? (await tx.urun.create({
            data: {
              kod: await yeniUrunKodu(tx, x.yeniTur),
              ad: x.yeniAd,
              tur: x.yeniTur,
              birim: x.birim,
              barkod: x.barkod && !(await tx.urun.findFirst({ where: { barkod: x.barkod }, select: { id: true } })) ? x.barkod : null,
              kdvOrani: dec(x.kdvOrani),
              alisFiyati: dec(x.birimFiyat),
              kdvDahil: true,
            },
          })).id;
          yeniKartlar.set(anahtar, urunId);
        }
      } else {
        // kâr oranıyla fiyatlanan üründe yeni alış fiyatı satış fiyatını da günceller
        const u = await tx.urun.findUnique({ where: { id: urunId }, select: { fiyatTipi: true, karOrani: true, kdvOrani: true, otvOrani: true, ...URUN_VERGILERI } });
        const satis = u?.fiyatTipi === "MARJ" && u.karOrani !== null ? { satisFiyati: dec(marjliFiyat(x.birimFiyat, Number(u.karOrani), Number(u.kdvOrani), Number(u.otvOrani), u.vergiler.map(ekVergi))) } : {};
        await tx.urun.update({ where: { id: urunId }, data: { alisFiyati: dec(x.birimFiyat), ...satis } });
      }
      await tx.stokGirisKalemi.create({
        data: { girisId: g.id, sira: i + 1, urunId, faturaAdi: x.faturaAdi, miktar: dec(x.miktar), birimFiyat: dec(x.birimFiyat), kdvOrani: dec(x.kdvOrani), tutar: dec(t.satirlar[i].tutar) },
      });
      await stokHareketYaz(tx, { urunId, tur: "ALIS", miktar: x.miktar, birimMaliyet: x.birimFiyat, stokGirisId: g.id, kaydeden: k.adSoyad });
      if (x.anahtar) await tx.urunEsleme.upsert({ where: { anahtar: x.anahtar }, create: { anahtar: x.anahtar, urunId }, update: { urunId } });
    }
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "STOK_GIRIS", tablo: "StokGiris", kayitId: String(g.id), detay: { girisNo: g.girisNo, satir: v.satirlar.length, tutar: t.genelToplam } } });
    return g.id;
  }, { timeout: 60_000 });
  revalidatePath("/stok");
  redirect(`/stok/giris/${id}?kayit=1`);
}
