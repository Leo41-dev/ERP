"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cariDogrula, formNesne, type Hatalar } from "@/lib/dogrulama/cari";
import { satisDogrula } from "@/lib/dogrulama/satis";
import { yetkiIste, type OturumKullanici } from "@/lib/oturum";
import { odemeFarki, vergiKirilimi } from "@/lib/satis/hesap";

export type SatisDurum = { hatalar?: Hatalar; genel?: string; uyari?: string; onayIste?: boolean } | undefined;

const dec = (n: number) => new Prisma.Decimal(n);

/** Kimlik numarasıyla kayıtlı müşteriyi forma doldurmak için getirir. */
export async function musteriBul(kimlik: string) {
  await yetkiIste("SATIS");
  const n = kimlik.replace(/\D/g, "");
  if (n.length !== 10 && n.length !== 11) return null;
  const c = await db.cari.findFirst({ where: n.length === 11 ? { tckn: n } : { vkn: n } });
  if (!c) return null;
  return {
    unvan: c.unvan, telefon: c.telefon ?? "", eposta: c.eposta ?? "", il: c.il ?? "", ilce: c.ilce ?? "", acikAdres: c.acikAdres ?? "",
    tckkSeriNo: c.tckkSeriNo ?? "", dogumTarihi: c.dogumTarihi?.toISOString().slice(0, 10) ?? "", vergiDairesi: c.vergiDairesi ?? "",
  };
}

export async function satisKaydet(_: SatisDurum, form: FormData): Promise<SatisDurum> {
  const k = await yetkiIste("SATIS");
  const musteri = cariDogrula(formNesne(form), true);
  const satis = satisDogrula(form);
  const hatalar = { ...musteri.hatalar, ...satis.hatalar };
  if (Object.keys(hatalar).length) return { hatalar };
  const v = satis.veri;
  const { fark } = odemeFarki(v.genelToplam, v.odemeler);
  // ödeme toplamı tutmuyorsa satıcıdan bir kez onay istenir
  if (Math.abs(fark) >= 0.5 && form.get("farkOnay") !== "1") {
    const yon = fark > 0 ? "eksik" : "fazla";
    return { uyari: `Ödemeler satış tutarından ${Math.abs(fark).toLocaleString("tr-TR")} ₺ ${yon}. Yine de kaydetmek için tekrar Kaydet'e basın.`, onayIste: true };
  }
  try {
    const id = await satisOlustur(k, musteri.veri, v, Number(form.get("teklifId")) || null);
    revalidatePath("/satislar");
    revalidatePath("/araclar");
    revalidatePath("/teklifler");
    redirect(`/satislar/${id}`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("ARAC:")) return { genel: e.message.slice(5) };
    throw e;
  }
}

async function satisOlustur(k: OturumKullanici, m: ReturnType<typeof cariDogrula>["veri"], v: ReturnType<typeof satisDogrula>["veri"], teklifId: number | null) {
  const vergi = vergiKirilimi(v.genelToplam, v.kdvOrani, v.otvOrani);
  return db.$transaction(async (tx) => {
    // aracı yalnızca hâlâ stoktaysa rezerve et (aynı aracın iki kez satılmasını önler)
    const rez = await tx.arac.updateMany({ where: { id: v.aracId, durum: "STOKTA" }, data: { durum: "REZERVE", otvOrani: dec(v.otvOrani) } });
    if (rez.count !== 1) throw new Error("ARAC:Bu araç artık stokta değil; başka bir satışa bağlanmış olabilir.");
    const arac = await tx.arac.findUniqueOrThrow({ where: { id: v.aracId }, include: { model: { include: { marka: true } } } });

    // kimlik numarası kayıtlıysa o müşteri kullanılır; mevcut bilgilerin üzerine yazılmaz, yalnızca boş alanlar doldurulur
    const kimlik = m.tckn ? { tckn: m.tckn } : m.vkn ? { vkn: m.vkn } : null;
    const mevcut = kimlik ? await tx.cari.findFirst({ where: kimlik }) : null;
    let cariId: number;
    if (mevcut) {
      const bosAlanlar = Object.fromEntries(
        Object.entries(m).filter(([alan, deger]) => deger !== null && deger !== false && (mevcut as Record<string, unknown>)[alan] === null),
      );
      if (Object.keys(bosAlanlar).length) await tx.cari.update({ where: { id: mevcut.id }, data: bosAlanlar });
      cariId = mevcut.id;
    } else {
      cariId = (await tx.cari.create({ data: m })).id;
    }

    const aciklama = arac.model ? `${arac.model.marka.ad} ${[arac.model.model, arac.model.altModel].filter(Boolean).join(" ")}` : "Araç";
    const firma = await tx.firma.findFirst({ where: { varsayilan: true, aktif: true }, select: { id: true } });
    const s = await tx.satis.create({
      data: {
        firmaId: firma?.id,
        cariId,
        saticiId: k.id,
        tarih: new Date(),
        durum: "KAYITLI",
        araToplam: dec(vergi.matrah),
        otvToplam: dec(vergi.otv),
        kdvToplam: dec(vergi.kdv),
        genelToplam: dec(v.genelToplam),
        teslimTarihi: v.teslimTarihi,
        aksesuarlar: v.aksesuarlar,
        hizmetler: v.hizmetler,
        not: v.not,
        kalemler: {
          create: {
            aracId: arac.id,
            aciklama,
            birimFiyat: dec(vergi.matrah),
            otvOrani: dec(v.otvOrani),
            kdvOrani: dec(v.kdvOrani),
            tutar: dec(v.genelToplam),
          },
        },
      },
    });
    await tx.cariHareket.create({ data: { cariId, tarih: s.tarih, borc: dec(v.genelToplam), aciklama: `Satış ${s.formNo}`, satisId: s.id } });
    if (teklifId) {
      const t = await tx.teklif.updateMany({
        where: { id: teklifId, durum: "ACIK", satisId: null, ...(k.rol === "SATIS" ? { saticiId: k.id } : {}) },
        data: { durum: "KABUL", satisId: s.id, cariId },
      });
      if (t.count !== 1) throw new Error("ARAC:Teklif artık açık değil; başka bir satışa dönüşmüş olabilir.");
    }
    for (const o of v.odemeler) {
      const t = await tx.tahsilat.create({
        data: { cariId, satisId: s.id, yontem: o.yontem, tutar: dec(o.tutar), taksit: o.taksit, vade: o.vade, aciklama: o.aciklama, kaydeden: k.adSoyad },
      });
      await tx.cariHareket.create({ data: { cariId, tarih: t.tarih, alacak: dec(o.tutar), aciklama: `Tahsilat (satış ${s.formNo})`, satisId: s.id, tahsilatId: t.id } });
    }
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "SATIS", tablo: "Satis", kayitId: String(s.id), detay: { formNo: s.formNo, sase: arac.sase, tutar: v.genelToplam } } });
    return s.id;
  });
}

async function satisGetir(k: OturumKullanici, id: number) {
  const s = await db.satis.findUnique({ where: { id }, include: { kalemler: true } });
  if (!s) throw new Error("Satış bulunamadı.");
  if (k.rol === "SATIS" && s.saticiId !== k.id) throw new Error("Bu satış üzerinde yetkiniz yok.");
  return s;
}

export async function satisIptal(id: number, _: SatisDurum, form: FormData): Promise<SatisDurum> {
  const k = await yetkiIste("SATIS");
  const neden = String(form.get("neden") ?? "").trim();
  if (!neden) return { genel: "İptal nedeni yazılmalı." };
  const s = await satisGetir(k, id);
  if (s.durum !== "KAYITLI") return { genel: "Yalnızca kayıtlı (faturası kesilmemiş) satış iptal edilebilir. Faturalı satış için iade yapılır." };
  await db.$transaction(async (tx) => {
    await tx.satis.update({ where: { id }, data: { durum: "IPTAL", iptalNedeni: neden, iptalEden: k.adSoyad, iptalZamani: new Date() } });
    const aracIdler = s.kalemler.map((x) => x.aracId).filter((x): x is number => x !== null);
    await tx.arac.updateMany({ where: { id: { in: aracIdler }, durum: "REZERVE" }, data: { durum: "STOKTA" } });
    // cari hareketleri silinmez; ters kayıtla kapatılır
    const hareketler = await tx.cariHareket.findMany({ where: { satisId: id } });
    const borc = hareketler.reduce((t, h) => t + Number(h.borc), 0);
    const alacak = hareketler.reduce((t, h) => t + Number(h.alacak), 0);
    await tx.cariHareket.create({ data: { cariId: s.cariId, tarih: new Date(), borc: dec(alacak), alacak: dec(borc), aciklama: `Satış ${s.formNo} iptali: ${neden}`, satisId: id } });
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "IPTAL", tablo: "Satis", kayitId: String(id), detay: { neden } } });
  });
  revalidatePath(`/satislar/${id}`);
  return undefined;
}

/** Uyumsoft entegrasyonu gelene kadar fatura numarası elle girilir. */
export async function faturaIsle(id: number, _: SatisDurum, form: FormData): Promise<SatisDurum> {
  const k = await yetkiIste("MUHASEBE");
  const faturaNo = String(form.get("faturaNo") ?? "").trim().toUpperCase();
  if (!faturaNo) return { genel: "Fatura numarası yazılmalı." };
  const s = await satisGetir(k, id);
  if (s.durum !== "KAYITLI") return { genel: "Bu satış faturalanamaz." };
  await db.$transaction(async (tx) => {
    await tx.satis.update({ where: { id }, data: { durum: "FATURALANDI", faturaNo, faturaTarihi: new Date() } });
    const aracIdler = s.kalemler.map((x) => x.aracId).filter((x): x is number => x !== null);
    await tx.arac.updateMany({ where: { id: { in: aracIdler } }, data: { durum: "SATILDI" } });
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "FATURA", tablo: "Satis", kayitId: String(id), detay: { faturaNo } } });
  });
  revalidatePath(`/satislar/${id}`);
  return undefined;
}

export async function teslimKontrolKaydet(id: number, _: SatisDurum, form: FormData): Promise<SatisDurum> {
  const k = await yetkiIste("SATIS", "SERVIS");
  await satisGetir(k.rol === "SERVIS" ? { ...k, rol: "YONETICI" } : k, id);
  const maddeler = await db.kontrolMaddesi.findMany({ where: { aktif: true }, orderBy: { sira: "asc" } });
  const kontrolEden = String(form.get("kontrolEden") ?? "").trim().toLocaleUpperCase("tr-TR");
  if (!kontrolEden) return { genel: "Kontrol eden kişi yazılmalı." };
  const liste = maddeler.map((m) => ({ ad: m.ad, tamam: form.get(`madde_${m.id}`) === "on" }));
  await db.teslimKontrol.upsert({
    where: { satisId: id },
    create: { satisId: id, maddeler: liste, kontrolEden },
    update: { maddeler: liste, kontrolEden, tarih: new Date() },
  });
  revalidatePath(`/satislar/${id}`);
  return undefined;
}
