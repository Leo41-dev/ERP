"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { esle, eslemeAnahtari, type EslemeSonucu, type ModelSatiri } from "@/lib/fatura/esle";
import { faturaOku, type FaturaArac } from "@/lib/fatura/oku";
import { metin } from "@/lib/normalize";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";

const ROLLER = ["DEPO", "MUHASEBE"] as const;
const DOSYA_LIMIT = 50;

export type OnizlemeFatura = { dosya: string; faturaNo: string; faturaTarihi: string; saticiUnvan: string; saticiVkn: string; iskontoOrani: number; uyarilar: string[] };
export type OnizlemeSatiri = Omit<FaturaArac, "birimFiyat"> & {
  dosya: string;
  faturaNo: string;
  esleme: EslemeSonucu;
  stoktaVar: boolean;
  maliyet: number | null; // yalnızca maliyet görebilene dolu
};
export type Onizleme = { hata?: string; faturalar: OnizlemeFatura[]; satirlar: OnizlemeSatiri[]; okunamayan: { dosya: string; hata: string }[] };

async function modelSatirlari(): Promise<ModelSatiri[]> {
  const m = await db.aracModeli.findMany({ include: { marka: true, tip: true } });
  return m.map((x) => ({ id: x.id, marka: x.marka.ad, model: x.model, alt: x.altModel, tip: x.tip?.ad ?? "" }));
}

async function dosyalariOku(f: FormData) {
  const dosyalar = f.getAll("dosya").filter((x): x is File => x instanceof File && x.size > 0);
  return Promise.all(dosyalar.slice(0, DOSYA_LIMIT).map(async (d) => faturaOku(await d.text(), d.name)));
}

/** Alış maliyeti: birim fiyat, fatura geneli iskonto düşülerek */
const alisMaliyeti = (a: FaturaArac, iskonto: number) => (a.birimFiyat === null ? null : Math.round(a.birimFiyat * (1 - iskonto) * 100) / 100);

export async function faturaOnizle(f: FormData): Promise<Onizleme> {
  const k = await yetkiIste(...ROLLER);
  const sonuclar = await dosyalariOku(f);
  if (!sonuclar.length) return { hata: "XML dosyası seçin.", faturalar: [], satirlar: [], okunamayan: [] };
  const [modeller, eslemeler] = await Promise.all([modelSatirlari(), db.faturaEsleme.findMany()]);
  const kayitli = new Map(eslemeler.map((e) => [e.anahtar, e.modelId]));
  const tumSaseler = sonuclar.flatMap((s) => (s.ok ? s.araclar.map((a) => a.sase) : []));
  const mevcut = new Set((await db.arac.findMany({ where: { sase: { in: tumSaseler } }, select: { sase: true } })).map((x) => x.sase));
  const maliyet = maliyetGorur(k);

  const faturalar: OnizlemeFatura[] = [];
  const satirlar: OnizlemeSatiri[] = [];
  const okunamayan: { dosya: string; hata: string }[] = [];
  for (const s of sonuclar) {
    if (!s.ok) {
      okunamayan.push({ dosya: s.dosya, hata: s.hata });
      continue;
    }
    faturalar.push({ dosya: s.dosya, faturaNo: s.faturaNo, faturaTarihi: s.faturaTarihi, saticiUnvan: s.saticiUnvan, saticiVkn: s.saticiVkn, iskontoOrani: s.iskontoOrani, uyarilar: s.uyarilar });
    for (const a of s.araclar) {
      const { birimFiyat: _, ...gerisi } = a;
      satirlar.push({
        ...gerisi,
        dosya: s.dosya,
        faturaNo: s.faturaNo,
        esleme: esle(a, eslemeAnahtari(s.saticiVkn, a), modeller, kayitli),
        stoktaVar: mevcut.has(a.sase),
        maliyet: maliyet ? alisMaliyeti(a, s.iskontoOrani) : null,
      });
    }
  }
  // birden çok dosyada aynı şase
  const gor = new Set<string>();
  for (const x of satirlar) {
    if (gor.has(x.sase)) x.uyarilar.push("Başka bir seçili faturada da var");
    gor.add(x.sase);
  }
  return { faturalar, satirlar, okunamayan };
}

export type StogaAlSonucu = { hata?: string; eklenen?: { id: number; sase: string }[]; atlanan?: string[] };

/**
 * Dosyalar yeniden okunur; tarayıcıdan yalnızca hangi şasenin hangi modelle alınacağı ve konum gelir.
 * Fiyat, vergi ve araç bilgileri her zaman faturadan alınır.
 */
export async function stogaAl(f: FormData): Promise<StogaAlSonucu> {
  const k = await yetkiIste(...ROLLER);
  const secim = JSON.parse(String(f.get("secim") ?? "{}")) as Record<string, number>;
  const konumId = Number(f.get("konumId")) || null;
  if (!Object.keys(secim).length) return { hata: "Stoğa alınacak araç seçilmedi." };
  if (konumId && !(await db.konum.findFirst({ where: { id: konumId, aktif: true } }))) return { hata: "Konum geçersiz." };

  const sonuclar = (await dosyalariOku(f)).filter((s) => s.ok);
  const modeller = new Map((await db.aracModeli.findMany({ include: { tip: true } })).map((m) => [m.id, m]));
  const eklenen: { id: number; sase: string }[] = [];
  const atlanan: string[] = [];

  try {
    await db.$transaction(async (tx) => {
      for (const s of sonuclar) {
        if (!s.ok) continue;
        const secilenler = s.araclar.filter((a) => a.sase in secim);
        if (!secilenler.length) continue;

        // tedarikçi: VKN ile bulunur, yoksa açılır; var olan kaydın bilgileri değiştirilmez
        let tedarikciId: number | null = null;
        if (s.saticiVkn) {
          const alan = s.saticiVkn.length === 11 ? { tckn: s.saticiVkn } : { vkn: s.saticiVkn };
          const var_ = await tx.cari.findFirst({ where: alan });
          if (var_) {
            tedarikciId = var_.id;
            if (var_.rol === "MUSTERI") await tx.cari.update({ where: { id: var_.id }, data: { rol: "MUSTERI_TEDARIKCI" } });
          } else {
            tedarikciId = (await tx.cari.create({ data: { ...alan, tip: "KURUMSAL", rol: "TEDARIKCI", unvan: metin(s.saticiUnvan) || "TEDARİKÇİ" } })).id;
          }
        }

        for (const a of secilenler) {
          const model = modeller.get(secim[a.sase]);
          if (!model) throw new Error(`HATA:${a.sase} için model seçin.`);
          if (await tx.arac.findUnique({ where: { sase: a.sase }, select: { id: true } })) {
            atlanan.push(a.sase);
            continue;
          }
          const maliyet = alisMaliyeti(a, s.iskontoOrani);
          const arac = await tx.arac.create({
            data: {
              sase: a.sase,
              motorNo: a.motor || null,
              modelId: model.id,
              yil: Number(a.yil) || null,
              renk: metin(a.renk) || null,
              kondisyon: "SIFIR",
              durum: "STOKTA",
              konumId,
              gelisTarihi: /^\d{4}-\d{2}-\d{2}$/.test(s.faturaTarihi) ? new Date(s.faturaTarihi) : new Date(),
              tedarikciId,
              alisFaturaNo: s.faturaNo || null,
              alisSekli: "FATURA",
              kdvOrani: a.kdvOrani ?? 0.2,
              // ÖTV oranı faturada yoksa model tipinin önerilen oranı; satışta yine elle seçilir
              otvOrani: a.otvOrani ?? model.tip?.varsayilanOtvOrani ?? null,
              maliyetler: maliyet !== null ? { create: [{ tur: "ALIS", tutar: maliyet, aciklama: `Fatura ${s.faturaNo}${s.iskontoOrani ? ", fatura iskontosu düşüldü" : ""}` }] } : undefined,
            },
          });
          eklenen.push({ id: arac.id, sase: a.sase });

          // seçilen model bu ürün adı için hatırlanır
          if (s.saticiVkn) {
            const anahtar = eslemeAnahtari(s.saticiVkn, a);
            await tx.faturaEsleme.upsert({ where: { anahtar }, update: { modelId: model.id }, create: { anahtar, modelId: model.id } });
          }
        }
      }
      await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "FATURA_GIRIS", tablo: "Arac", kayitId: eklenen.map((x) => x.id).join(",").slice(0, 190) || "-" } });
    });
  } catch (e) {
    const m = (e as Error).message;
    if (m.startsWith("HATA:")) return { hata: m.slice(5) };
    throw e;
  }
  revalidatePath("/araclar");
  return { eklenen, atlanan };
}

/** Fatura girişinde listede olmayan modeli hızlıca tanımlamak için (eski paneldeki "yeni model ekle") */
export async function hizliModelEkle(f: FormData): Promise<{ hata?: string; model?: ModelSatiri }> {
  await yetkiIste(...ROLLER);
  const markaAd = metin(f.get("marka"));
  const model = metin(f.get("model"));
  const altModel = metin(f.get("altModel"));
  const tipId = Number(f.get("tipId")) || null;
  if (!markaAd || !model) return { hata: "Marka ve model gerekli." };
  const marka = await db.marka.upsert({ where: { ad: markaAd }, update: {}, create: { ad: markaAd } });
  const var_ = await db.aracModeli.findUnique({ where: { markaId_model_altModel: { markaId: marka.id, model, altModel } }, include: { tip: true } });
  const m = var_ ?? (await db.aracModeli.create({ data: { markaId: marka.id, model, altModel, tipId }, include: { tip: true } }));
  return { model: { id: m.id, marka: marka.ad, model: m.model, alt: m.altModel, tip: m.tip?.ad ?? "" } };
}
