"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Hatalar } from "@/lib/dogrulama/cari";
import { hizliSatisDogrula } from "@/lib/dogrulama/hizliSatis";
import { yetkiIste } from "@/lib/oturum";
import { kalemHesapla, odemeFarki } from "@/lib/satis/hesap";

export type HizliSatisDurum = { hatalar?: Hatalar; genel?: string; uyari?: string; onayIste?: boolean } | undefined;

const dec = (n: number) => new Prisma.Decimal(n);
const PERAKENDE = "PERAKENDE MÜŞTERİ";

export async function hizliSatisKaydet(_: HizliSatisDurum, form: FormData): Promise<HizliSatisDurum> {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const { veri: v, hatalar } = hizliSatisDogrula(form);
  if (Object.keys(hatalar).length) return { hatalar };
  const h = kalemHesapla(v.kalemler);
  const { fark } = odemeFarki(h.genelToplam, v.odemeler);
  if (Math.abs(fark) >= 0.01 && form.get("farkOnay") !== "1") {
    return { uyari: `Ödemeler toplamdan ${Math.abs(fark).toLocaleString("tr-TR")} ₺ ${fark > 0 ? "eksik" : "fazla"}. Yine de kaydetmek için tekrar Kaydet'e basın.`, onayIste: true };
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
          create: h.satirlar.map((x) => ({ aciklama: x.aciklama, miktar: dec(x.miktar), birimFiyat: dec(x.birimMatrah), kdvOrani: dec(x.kdvOrani), tutar: dec(x.tutar) })),
        },
      },
    });
    await tx.cariHareket.create({ data: { cariId: cari.id, tarih: s.tarih, borc: dec(h.genelToplam), aciklama: `Hızlı satış ${s.formNo}`, satisId: s.id } });
    for (const o of v.odemeler) {
      const t = await tx.tahsilat.create({ data: { cariId: cari.id, satisId: s.id, yontem: o.yontem, tutar: dec(o.tutar), taksit: o.taksit, aciklama: o.aciklama, kaydeden: k.adSoyad } });
      await tx.cariHareket.create({ data: { cariId: cari.id, tarih: t.tarih, alacak: dec(o.tutar), aciklama: `Tahsilat (satış ${s.formNo})`, satisId: s.id, tahsilatId: t.id } });
    }
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "HIZLI_SATIS", tablo: "Satis", kayitId: String(s.id), detay: { formNo: s.formNo, tutar: h.genelToplam } } });
    return s.id;
  });
  revalidatePath("/satislar");
  redirect(`/satislar/hizli?kayit=${id}`);
}
