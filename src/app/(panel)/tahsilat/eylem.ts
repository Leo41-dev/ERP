"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Hatalar } from "@/lib/dogrulama/cari";
import { odemeSatirlari } from "@/lib/dogrulama/satis";
import { yetkiIste } from "@/lib/oturum";
import { YONTEM_AD_KISA } from "./ortak";
import { tahsilatHareketleriniIptalEt, tahsilatHesabaYaz } from "@/lib/finans";

export type TahsilatDurum = { hatalar?: Hatalar; genel?: string } | undefined;

const dec = (n: number) => new Prisma.Decimal(n);

export async function tahsilatKaydet(_: TahsilatDurum, f: FormData): Promise<TahsilatDurum> {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const h: Hatalar = {};
  const cariId = Number(f.get("cariId"));
  const satisId = Number(f.get("satisId")) || null;
  const tarihHam = String(f.get("tarih") ?? "");
  const aciklama = String(f.get("aciklama") ?? "").trim() || null;
  const odemeler = odemeSatirlari(f, h);
  if (!odemeler.length && !h.odemeler) h.odemeler = "Tahsil edilen tutarı girin.";
  if (Object.keys(h).length) return { hatalar: h };

  const cari = Number.isInteger(cariId) ? await db.cari.findUnique({ where: { id: cariId } }) : null;
  if (!cari) return { genel: "Müşteri bulunamadı." };
  const satis = satisId ? await db.satis.findFirst({ where: { id: satisId, cariId } }) : null;
  if (satisId && (!satis || satis.durum === "IPTAL")) return { genel: "Seçilen satış bu müşteriye ait değil ya da iptal edilmiş." };
  // geçmiş tarihli tahsilat girilebilir, ileri tarihli girilemez
  const tarih = /^\d{4}-\d{2}-\d{2}$/.test(tarihHam) && tarihHam !== new Date().toISOString().slice(0, 10) ? new Date(`${tarihHam}T12:00:00Z`) : new Date();
  if (tarih.getTime() > Date.now() + 86_400_000) return { genel: "İleri tarihli tahsilat girilemez; senet ve çek için vade kullanın." };

  const idler = await db.$transaction(async (tx) => {
    const idler: number[] = [];
    for (const o of odemeler) {
      const t = await tx.tahsilat.create({
        data: { cariId, satisId: satis?.id ?? null, tarih, yontem: o.yontem, tutar: dec(o.tutar), taksit: o.taksit, vade: o.vade, aciklama: [o.aciklama, aciklama].filter(Boolean).join(" · ") || null, kaydeden: k.adSoyad },
      });
      const metin = `Tahsilat (${YONTEM_AD_KISA[o.yontem]})${satis ? `, satış ${satis.formNo}` : ""}`;
      await tx.cariHareket.create({ data: { cariId, tarih, alacak: dec(o.tutar), aciklama: metin, satisId: satis?.id ?? null, tahsilatId: t.id } });
      await tahsilatHesabaYaz(tx, t, o.hesapId, k.adSoyad, `${metin} · ${cari.unvan}`);
      idler.push(t.id);
    }
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "TAHSILAT", tablo: "Tahsilat", kayitId: idler.join(","), detay: { cariId, satisId, toplam: odemeler.reduce((t, o) => t + o.tutar, 0) } } });
    return idler;
  });
  revalidatePath("/tahsilat");
  revalidatePath(`/musteriler/${cariId}`);
  if (satis) revalidatePath(`/satislar/${satis.id}`);
  redirect(`/tahsilat?makbuz=${idler.join(",")}`);
}

/** Tahsilat silinmez: iptal edilir ve cariye ters kayıt atılır. */
export async function tahsilatIptal(id: number, neden: string): Promise<{ hata?: string }> {
  const k = await yetkiIste("MUHASEBE");
  neden = neden.trim();
  if (!neden) return { hata: "İptal nedeni yazılmalı." };
  const t = await db.tahsilat.findUnique({ where: { id }, include: { satis: { select: { durum: true } } } });
  if (!t) return { hata: "Tahsilat bulunamadı." };
  if (t.iptalZamani) return { hata: "Bu tahsilat zaten iptal edilmiş." };
  // iptal edilen satışın cari kayıtları satış iptalinde zaten ters çevrildi
  if (t.satis?.durum === "IPTAL") return { hata: "Satış iptal edildiği için tahsilatı da kapatıldı." };
  await db.$transaction(async (tx) => {
    const g = await tx.tahsilat.updateMany({ where: { id, iptalZamani: null }, data: { iptalZamani: new Date(), iptalEden: k.adSoyad, iptalNedeni: neden } });
    if (g.count !== 1) throw new Error("Bu tahsilat zaten iptal edilmiş.");
    await tahsilatHareketleriniIptalEt(tx, [id], k.adSoyad, neden);
    await tx.cariHareket.create({ data: { cariId: t.cariId, tarih: new Date(), borc: t.tutar, aciklama: `Tahsilat iptali (${YONTEM_AD_KISA[t.yontem]}): ${neden}`, satisId: t.satisId } });
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "IPTAL", tablo: "Tahsilat", kayitId: String(id), detay: { neden } } });
  });
  revalidatePath("/tahsilat");
  revalidatePath(`/musteriler/${t.cariId}`);
  if (t.satisId) revalidatePath(`/satislar/${t.satisId}`);
  return {};
}

/** Senet / çek vadesinde tahsil edildi olarak işaretlenir (cari zaten alındığında alacaklandırıldı). */
export async function senetTahsilEdildi(id: number, hesapId?: number | null): Promise<{ hata?: string }> {
  const k = await yetkiIste("MUHASEBE");
  // tahsil edilen senet / çek varsayılan hesabına (Ayarlar → Finans) giriş yazar
  const hata = await db.$transaction(async (tx) => {
    const g = await tx.tahsilat.updateMany({ where: { id, yontem: { in: ["SENET", "CEK"] }, tahsilTarihi: null, iptalZamani: null }, data: { tahsilTarihi: new Date() } });
    if (g.count !== 1) return "Senet / çek bulunamadı ya da zaten işlenmiş.";
    const t = await tx.tahsilat.findUniqueOrThrow({ where: { id }, include: { cari: { select: { unvan: true } } } });
    await tahsilatHesabaYaz(tx, { ...t, tarih: new Date() }, hesapId, k.adSoyad, `${YONTEM_AD_KISA[t.yontem]} tahsili · ${t.cari.unvan}`, true);
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "SENET_TAHSIL", tablo: "Tahsilat", kayitId: String(id) } });
    return null;
  });
  if (hata) return { hata };
  revalidatePath("/tahsilat");
  return {};
}
