"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Hatalar } from "@/lib/dogrulama/cari";
import { teklifDogrula } from "@/lib/dogrulama/teklif";
import { yetkiIste, type OturumKullanici } from "@/lib/oturum";
import { teklifHesapla } from "@/lib/satis/hesap";

export type TeklifDurumu = { hatalar?: Hatalar; genel?: string } | undefined;

const dec = (n: number) => new Prisma.Decimal(n);
const ROLLER = ["SATIS", "MUHASEBE", "SERVIS"] as const;

async function teklifGetir(k: OturumKullanici, id: number) {
  const t = await db.teklif.findUnique({ where: { id } });
  if (!t) throw new Error("Teklif bulunamadı.");
  if (k.rol === "SATIS" && t.saticiId !== k.id) throw new Error("Bu teklif üzerinde yetkiniz yok.");
  return t;
}

/** teklifId verilirse açık teklif güncellenir, yoksa yeni teklif açılır. */
export async function teklifKaydet(teklifId: number | null, _: TeklifDurumu, form: FormData): Promise<TeklifDurumu> {
  const k = await yetkiIste(...ROLLER);
  if (teklifId) {
    const t = await teklifGetir(k, teklifId);
    if (t.durum !== "ACIK") return { genel: "Yalnızca açık teklif düzenlenebilir." };
  }
  const { veri: v, hatalar } = teklifDogrula(form);
  if (Object.keys(hatalar).length) return { hatalar };
  const modelIdler = [...new Set(v.kalemler.map((x) => x.modelId).filter((x): x is number => x !== null))];
  if (modelIdler.length && (await db.aracModeli.count({ where: { id: { in: modelIdler } } })) !== modelIdler.length) return { genel: "Seçilen araç modeli bulunamadı." };
  if (v.firmaId && !(await db.firma.findFirst({ where: { id: v.firmaId, aktif: true } }))) return { genel: "Firma geçersiz." };

  // kayıtlı müşteri varsa bağlanır; teklif için yeni cari açılmaz
  const cari = v.kimlikNo
    ? await db.cari.findFirst({ where: v.kimlikNo.length === 11 ? { tckn: v.kimlikNo } : { vkn: v.kimlikNo } })
    : v.telefon
      ? await db.cari.findFirst({ where: { telefon: v.telefon }, orderBy: { id: "asc" } })
      : null;
  const hs = teklifHesapla(v.kalemler);
  const firmaId = v.firmaId ?? (await db.firma.findFirst({ where: { varsayilan: true, aktif: true }, select: { id: true } }))?.id ?? null;
  const veri = {
    firmaId,
    cariId: cari?.id ?? null,
    musteriAd: v.musteriAd,
    telefon: v.telefon,
    eposta: v.eposta,
    kimlikNo: v.kimlikNo,
    gecerlilik: v.gecerlilik,
    araToplam: dec(hs.matrah),
    otvToplam: dec(hs.otv),
    kdvToplam: dec(hs.kdv),
    genelToplam: dec(hs.genelToplam),
    odemeKosullari: v.odemeKosullari,
    not: v.not,
  };
  const kalemler = hs.satirlar.map((x, i) => ({
    sira: i + 1,
    modelId: x.modelId,
    aciklama: x.aciklama,
    miktar: dec(x.miktar),
    birimFiyat: dec(x.birimFiyat),
    otvOrani: dec(x.otvOrani),
    kdvOrani: dec(x.kdvOrani),
    tutar: dec(x.tutar),
  }));

  const id = await db.$transaction(async (tx) => {
    let id: number;
    if (teklifId) {
      await tx.teklifKalemi.deleteMany({ where: { teklifId } });
      id = (await tx.teklif.update({ where: { id: teklifId }, data: { ...veri, kalemler: { create: kalemler } } })).id;
    } else {
      id = (await tx.teklif.create({ data: { ...veri, saticiId: k.id, kalemler: { create: kalemler } } })).id;
    }
    await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: teklifId ? "GUNCELLE" : "TEKLIF", tablo: "Teklif", kayitId: String(id), detay: { tutar: hs.genelToplam } } });
    return id;
  });
  revalidatePath("/teklifler");
  redirect(`/teklifler/${id}`);
}

export async function teklifReddet(id: number, _: TeklifDurumu, form: FormData): Promise<TeklifDurumu> {
  const k = await yetkiIste(...ROLLER);
  const neden = String(form.get("neden") ?? "").trim();
  if (!neden) return { genel: "Ret nedeni yazılmalı (fiyat, başka bayi, vazgeçti...)." };
  const t = await teklifGetir(k, id);
  if (t.durum !== "ACIK") return { genel: "Yalnızca açık teklif reddedilebilir." };
  await db.teklif.update({ where: { id }, data: { durum: "RET", retNedeni: neden } });
  await db.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "RET", tablo: "Teklif", kayitId: String(id), detay: { neden } } });
  revalidatePath(`/teklifler/${id}`);
  return undefined;
}

export async function teklifYenidenAc(id: number) {
  const k = await yetkiIste(...ROLLER);
  const t = await teklifGetir(k, id);
  if (t.durum !== "RET") return;
  await db.teklif.update({ where: { id }, data: { durum: "ACIK", retNedeni: null } });
  revalidatePath(`/teklifler/${id}`);
}
