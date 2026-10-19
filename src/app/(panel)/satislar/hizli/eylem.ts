"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Hatalar } from "@/lib/dogrulama/cari";
import { hizliSatisDogrula } from "@/lib/dogrulama/hizliSatis";
import { yetkiIste } from "@/lib/oturum";
import { kalemHesapla, odemeFarki } from "@/lib/satis/hesap";
import { stokHareketYaz } from "@/lib/stok";
import { stokYetersiz } from "@/lib/stokHesap";

export type HizliSatisDurum = { hatalar?: Hatalar; genel?: string; uyari?: string; onayIste?: boolean; eksiUyari?: string; eksiOnay?: boolean } | undefined;

const dec = (n: number) => new Prisma.Decimal(n);
const PERAKENDE = "PERAKENDE MÜŞTERİ";

export async function hizliSatisKaydet(_: HizliSatisDurum, form: FormData): Promise<HizliSatisDurum> {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const { veri: v, hatalar } = hizliSatisDogrula(form);
  if (Object.keys(hatalar).length) return { hatalar };
  const h = kalemHesapla(v.kalemler);
  const { fark } = odemeFarki(h.genelToplam, v.odemeler);
  if (Math.abs(fark) >= 0.01 && form.get("farkOnay") !== "1") {
    return { uyari: `Ödemeler toplamdan ${Math.abs(fark).toLocaleString("tr-TR")} ₺ ${fark > 0 ? "eksik" : "fazla"}. Yine de kaydetmek için tekrar Kaydet'e basın.`, onayIste: true, eksiOnay: form.get("eksiOnay") === "1" };
  }
  // stok kartı seçilen satırlar: yetmeyen stok yalnızca yönetici onayıyla eksiye düşer
  const urunIds = [...new Set(v.kalemler.map((x) => x.urunId).filter((x): x is number => !!x))];
  const urunler = await db.urun.findMany({ where: { id: { in: urunIds } }, select: { id: true, ad: true, miktar: true, birim: true, tur: true, aktif: true } });
  if (urunler.length !== urunIds.length) return { genel: "Seçilen ürünlerden biri bulunamadı, sayfayı yenileyin." };
  const yetmeyen = stokYetersiz(
    v.kalemler.filter((x) => x.urunId).map((x) => ({ urunId: x.urunId!, miktar: x.miktar })),
    urunler.map((u) => ({ id: u.id, ad: u.ad, miktar: Number(u.miktar), birim: u.birim, hizmet: u.tur === "HIZMET" })),
  );
  if (yetmeyen.length) {
    const liste = yetmeyen.map((x) => `${x.ad}: istenen ${x.istenen.toLocaleString("tr-TR")}, stokta ${x.mevcut.toLocaleString("tr-TR")} ${x.birim}`).join("\n");
    if (k.rol !== "YONETICI") return { genel: `Stok yetersiz:\n${liste}\nÖnce stok girişi yapılmalı ya da yöneticinin onaylaması gerekir.` };
    if (form.get("eksiOnay") !== "1") return { eksiUyari: `Stok yetersiz:\n${liste}\nOnaylarsanız bu ürünler eksi stoğa düşer. Onaylamak için tekrar Kaydet'e basın.`, eksiOnay: true, onayIste: form.get("farkOnay") === "1" };
  }
  if (v.firmaId && !(await db.firma.findFirst({ where: { id: v.firmaId, aktif: true } }))) return { genel: "Firma geçersiz." };

  const id = await db.$transaction(async (tx) => {
    // müşteri: kimlik no ile, yoksa telefonla bulunur; hiçbiri yoksa perakende müşteri. Var olan bilgilerin üzerine yazılmaz.
    const m = v.musteri;
    let cari = m.kimlikNo
      ? await tx.cari.findFirst({ where: m.kimlikNo.length === 11 ? { tckn: m.kimlikNo } : { vkn: m.kimlikNo } })
      : m.telefon
        ? await tx.cari.findFirst({ where: { telefon: m.telefon }, orderBy: { id: "asc" } })
        : await tx.cari.findFirst({ where: { unvan: PERAKENDE, tckn: null, vkn: null } });
    if (cari && m.telefon && !cari.telefon) cari = await tx.cari.update({ where: { id: cari.id }, data: { telefon: m.telefon } });
    if (!cari) {
      cari = await tx.cari.create({
        data: m.kimlikNo || m.telefon
          ? {
              unvan: m.unvan,
              tip: m.kimlikNo.length === 10 ? "KURUMSAL" : "BIREYSEL",
              ...(m.kimlikNo.length === 11 ? { tckn: m.kimlikNo } : m.kimlikNo ? { vkn: m.kimlikNo } : {}),
              telefon: m.telefon || null,
            }
          : { unvan: PERAKENDE },
      });
    }

    const firmaId = v.firmaId ?? (await tx.firma.findFirst({ where: { varsayilan: true, aktif: true }, select: { id: true } }))?.id ?? null;
    const s = await tx.satis.create({
      data: {
        tur: "HIZLI",
        firmaId,
        cariId: cari.id,
        saticiId: k.id,
        tarih: new Date(),
        durum: "KAYITLI",
        araToplam: dec(h.matrah),
        otvToplam: dec(0),
        kdvToplam: dec(h.kdv),
        genelToplam: dec(h.genelToplam),
        teslimTarihi: new Date(),
        // perakende satışta yazılan ad fişte görünsün diye nota eklenir
        not: [!m.kimlikNo && !m.telefon && m.unvan ? `Müşteri: ${m.unvan}` : null, v.not].filter(Boolean).join("\n") || null,
        kalemler: {
          create: h.satirlar.map((x) => ({ urunId: x.urunId ?? null, aciklama: x.aciklama, miktar: dec(x.miktar), birimFiyat: dec(x.birimMatrah), kdvOrani: dec(x.kdvOrani), tutar: dec(x.tutar) })),
        },
      },
      include: { kalemler: { orderBy: { id: "asc" }, select: { id: true, urunId: true, miktar: true } } },
    });
    for (const x of s.kalemler) {
      const u = urunler.find((y) => y.id === x.urunId);
      if (u && u.tur !== "HIZMET") await stokHareketYaz(tx, { urunId: u.id, tur: "SATIS", miktar: -Number(x.miktar), satisId: s.id, satisKalemiId: x.id, tarih: s.tarih, kaydeden: k.adSoyad });
    }
    await tx.cariHareket.create({ data: { cariId: cari.id, tarih: s.tarih, borc: dec(h.genelToplam), aciklama: `Hızlı satış ${s.formNo}`, satisId: s.id } });
    const teklifId = Number(form.get("teklifId")) || null;
    if (teklifId) {
      await tx.teklif.updateMany({
        where: { id: teklifId, durum: "ACIK", satisId: null, ...(k.rol === "SATIS" ? { saticiId: k.id } : {}) },
        data: { durum: "KABUL", satisId: s.id, cariId: cari.id },
      });
    }
    for (const o of v.odemeler) {
      const t = await tx.tahsilat.create({ data: { cariId: cari.id, satisId: s.id, yontem: o.yontem, tutar: dec(o.tutar), taksit: o.taksit, vade: o.vade, aciklama: o.aciklama, kaydeden: k.adSoyad } });
      await tx.cariHareket.create({ data: { cariId: cari.id, tarih: t.tarih, alacak: dec(o.tutar), aciklama: `Tahsilat (satış ${s.formNo})`, satisId: s.id, tahsilatId: t.id } });
    }
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "HIZLI_SATIS", tablo: "Satis", kayitId: String(s.id), detay: { formNo: s.formNo, tutar: h.genelToplam } } });
    return s.id;
  });
  revalidatePath("/satislar");
  revalidatePath("/teklifler");
  redirect(`/satislar/hizli?kayit=${id}`);
}
