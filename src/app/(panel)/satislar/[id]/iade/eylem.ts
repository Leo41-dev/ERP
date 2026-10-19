"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Hatalar } from "@/lib/dogrulama/cari";
import { odemeSatirlari } from "@/lib/dogrulama/satis";
import { para, sayi } from "@/lib/normalize";
import { yetkiIste } from "@/lib/oturum";
import { iadeCariTutari, iadeKalemleri, satisKalani } from "@/lib/satis/iade";
import { stokHareketYaz } from "@/lib/stok";

export type IadeDurumu = { hatalar?: Hatalar; genel?: string } | undefined;

const dec = (n: number) => new Prisma.Decimal(n);

export async function iadeKaydet(satisId: number, _: IadeDurumu, form: FormData): Promise<IadeDurumu> {
  const k = await yetkiIste("SATIS", "MUHASEBE");
  const s = await db.satis.findUnique({
    where: { id: satisId },
    include: { kalemler: { include: { iadeler: true, urun: { select: { tur: true } } } }, iadeler: { include: { geriOdemeler: true } }, tahsilatlar: true },
  });
  if (!s) return { genel: "Satış bulunamadı." };
  if (k.rol === "SATIS" && s.saticiId !== k.id) return { genel: "Bu satış üzerinde yetkiniz yok." };
  if (s.durum !== "KAYITLI" && s.durum !== "FATURALANDI") return { genel: "Bu satıştan iade alınamaz." };
  if (s.tur === "ARAC" && s.durum === "KAYITLI") return { genel: "Faturası kesilmemiş araç satışı iade yerine iptal edilir." };

  const h: Hatalar = {};
  const durumlar = s.kalemler.map((x) => ({ id: x.id, miktar: Number(x.miktar), tutar: Number(x.tutar), iadeEdilen: x.iadeler.reduce((t, i) => t + Number(i.miktar), 0) }));
  const secim = Object.fromEntries(s.kalemler.map((x) => [x.id, sayi(form.get(`iade_${x.id}`)) ?? 0]));
  const kalem = iadeKalemleri(durumlar, secim);
  if ("hata" in kalem) h.kalemler = kalem.hata;
  const neden = String(form.get("neden") ?? "").trim();
  if (!neden) h.neden = "İade nedeni yazılmalı.";
  // araç iadesinde kesinti olabilir; tutar elle düşürülebilir ama hesaplanan tutarı aşamaz
  const elle = String(form.get("tutar") ?? "").trim();
  let tutar = "hata" in kalem ? 0 : kalem.toplam;
  if (elle) {
    const t = sayi(elle);
    if (!t || t <= 0) h.tutar = "İade tutarı geçersiz.";
    else if (t - tutar > 0.005) h.tutar = `İade tutarı seçilen kalemlerin tutarını (${tutar.toLocaleString("tr-TR")} ₺) aşamaz.`;
    else tutar = para(t);
  }
  const geriOdemeler = odemeSatirlari(form, h);
  const tahsil = s.tahsilatlar.filter((t) => !t.iptalZamani).reduce((a, t) => a + Number(t.tutar), 0);
  const oncekiGeri = s.iadeler.reduce((a, i) => a + i.geriOdemeler.reduce((b, g) => b + Number(g.tutar), 0), 0);
  const geriToplam = para(geriOdemeler.reduce((a, g) => a + g.tutar, 0));
  if (geriToplam - (tahsil - oncekiGeri) > 0.005) h.odemeler = `Geri ödeme, müşteriden alınan tutarı (${para(tahsil - oncekiGeri).toLocaleString("tr-TR")} ₺) aşamaz.`;
  if (Object.keys(h).length || "hata" in kalem) return { hatalar: h };

  const oran = tutar / Number(s.genelToplam);
  const faturaNo = String(form.get("faturaNo") ?? "").trim().toUpperCase() || null;
  const ikinciEl = form.get("ikinciEl") === "on";
  const aracIdler = s.kalemler.filter((x) => x.aracId && (secim[x.id] ?? 0) > 0).map((x) => x.aracId!);

  const iadeId = await db.$transaction(async (tx) => {
    const iade = await tx.iade.create({
      data: {
        satisId,
        tutar: dec(tutar),
        otvToplam: dec(para(Number(s.otvToplam ?? 0) * oran)),
        kdvToplam: dec(para(Number(s.kdvToplam ?? 0) * oran)),
        neden,
        faturaNo,
        kaydeden: k.adSoyad,
        kalemler: { create: kalem.satirlar.map((x) => ({ satisKalemiId: x.satisKalemiId, miktar: dec(x.miktar), tutar: dec(x.tutar) })) },
      },
    });
    await tx.cariHareket.create({ data: { cariId: s.cariId, tarih: iade.tarih, alacak: dec(iadeCariTutari(tutar, Number(s.genelToplam), Number(s.kesintiToplam))), aciklama: `İade ${iade.iadeNo} (satış ${s.formNo})`, satisId, iadeId: iade.id } });
    for (const g of geriOdemeler) {
      const go = await tx.geriOdeme.create({ data: { iadeId: iade.id, yontem: g.yontem, tutar: dec(g.tutar), aciklama: g.aciklama } });
      await tx.cariHareket.create({ data: { cariId: s.cariId, tarih: iade.tarih, borc: dec(g.tutar), aciklama: `İade ödemesi ${iade.iadeNo} (satış ${s.formNo})`, satisId, iadeId: iade.id, geriOdemeId: go.id } });
    }
    // iade edilen araç stoğa döner; tescilli/kullanılmış araç 2. el olarak alınabilir
    if (aracIdler.length) {
      await tx.arac.updateMany({ where: { id: { in: aracIdler }, durum: { in: ["SATILDI", "REZERVE"] } }, data: { durum: "STOKTA", ...(ikinciEl ? { kondisyon: "IKINCI_EL" } : {}) } });
    }
    // stok kartlı kalemler satıştaki maliyetle stoğa döner; kusurlu ürün için bu adım kapatılabilir
    if (form.get("stogaAl") === "on") {
      const cikislar = await tx.stokHareketi.findMany({ where: { satisId, tur: "SATIS" }, select: { satisKalemiId: true, birimMaliyet: true } });
      for (const x of kalem.satirlar) {
        const sk = s.kalemler.find((y) => y.id === x.satisKalemiId);
        if (!sk?.urunId || sk.urun?.tur === "HIZMET") continue;
        const c = cikislar.find((y) => y.satisKalemiId === sk.id);
        await stokHareketYaz(tx, { urunId: sk.urunId, tur: "IADE", miktar: x.miktar, birimMaliyet: c?.birimMaliyet ? Number(c.birimMaliyet) : null, satisId, satisKalemiId: sk.id, iadeId: iade.id, kaydeden: k.adSoyad });
      }
    }
    if (kalem.tamami) await tx.satis.update({ where: { id: satisId }, data: { durum: "IADE" } });
    await tx.denetimKaydi.create({
      data: { kullanici: k.kullaniciAdi, islem: "IADE", tablo: "Satis", kayitId: String(satisId), detay: { iadeNo: iade.iadeNo, tutar, neden, geriOdeme: geriToplam, kalan: satisKalani({ genelToplam: Number(s.genelToplam), iade: s.iadeler.reduce((a, i) => a + Number(i.tutar), 0) + tutar, tahsil, geriOdeme: oncekiGeri + geriToplam, kesinti: Number(s.kesintiToplam) }) } },
    });
    return iade.id;
  });
  revalidatePath(`/satislar/${satisId}`);
  revalidatePath("/satislar");
  revalidatePath("/araclar");
  revalidatePath("/stok");
  redirect(`/satislar/${satisId}?iade=${iadeId}`);
}
