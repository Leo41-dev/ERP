"use server";
import { Prisma, type Rol } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BELGE_AYARLARI, type BelgeAyarAnahtari } from "@/lib/belgeAyarlari";
import { db } from "@/lib/db";
import { eposta as epostaNormalize, metin, sayi } from "@/lib/normalize";
import { yetkiIste } from "@/lib/oturum";
import { sifreKurali, sifreOzetle } from "@/lib/sifre";

export type AyarDurum = { hata?: string; tamam?: string } | undefined;

const ROLLER: Rol[] = ["YONETICI", "SATIS", "DEPO", "SERVIS", "MUHASEBE"];
const yazi = (f: FormData, ad: string) => String(f.get(ad) ?? "").replace(/\s+/g, " ").trim();

async function denetim(kullanici: string, islem: string, tablo: string, kayitId: number | string) {
  await db.denetimKaydi.create({ data: { kullanici, islem, tablo, kayitId: String(kayitId) } });
}

/** Benzersizlik ihlalini okunur mesaja çevirir, diğer hataları yeniden fırlatır. */
function benzersiz(e: unknown, mesaj: string): AyarDurum {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { hata: mesaj };
  throw e;
}

/* ---------- kullanıcılar ---------- */

export async function kullaniciKaydet(id: number | null, _: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const kullaniciAdi = yazi(f, "kullaniciAdi").toLocaleLowerCase("tr-TR");
  const adSoyad = yazi(f, "adSoyad");
  const epostaHam = yazi(f, "eposta");
  const eposta = epostaHam ? epostaNormalize(epostaHam) : null;
  const rol = String(f.get("rol")) as Rol;
  const aktif = f.get("aktif") === "on";
  const sifre = String(f.get("sifre") ?? "");

  if (!/^[a-z0-9._-]{3,32}$/.test(kullaniciAdi)) return { hata: "Kullanıcı adı 3-32 karakter olmalı; küçük harf, rakam, nokta, tire kullanılabilir." };
  if (!adSoyad) return { hata: "Ad soyad gerekli." };
  if (epostaHam && !eposta) return { hata: "E-posta geçersiz." };
  if (!ROLLER.includes(rol)) return { hata: "Rol seçin." };
  if (!id || sifre) {
    const h = sifreKurali(sifre);
    if (h) return { hata: h };
  }
  if (id === k.id && (rol !== "YONETICI" || !aktif)) return { hata: "Kendi yönetici yetkinizi kaldıramaz veya hesabınızı pasif yapamazsınız." };

  const veri = { kullaniciAdi, adSoyad, eposta, rol, aktif, ...(sifre ? { sifreOzet: await sifreOzetle(sifre), hataliDeneme: 0, kilitBitis: null } : {}) };
  let kayitId: number;
  try {
    const kayit = id ? await db.kullanici.update({ where: { id }, data: veri }) : await db.kullanici.create({ data: veri });
    kayitId = kayit.id;
  } catch (e) {
    return benzersiz(e, "Bu kullanıcı adı kullanılıyor.");
  }
  // şifre değiştiyse veya hesap pasif olduysa açık oturumlar kapanır
  if (id && (sifre || !aktif)) await db.oturum.deleteMany({ where: { kullaniciId: id } });
  await denetim(k.kullaniciAdi, id ? "GUNCELLE" : "EKLE", "Kullanici", kayitId);
  revalidatePath("/ayarlar/kullanicilar");
  redirect("/ayarlar/kullanicilar");
}

/* ---------- firma ---------- */

export async function firmaKaydet(_: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const id = Number(f.get("id")) || null;
  const unvan = yazi(f, "unvan");
  const vkn = yazi(f, "vkn").replace(/\D/g, "");
  if (!unvan) return { hata: "Unvan gerekli." };
  if (!/^\d{10,11}$/.test(vkn)) return { hata: "VKN 10, TCKN 11 haneli olmalı." };
  const veri = { unvan, vkn, vergiDairesi: yazi(f, "vergiDairesi") || null, adres: yazi(f, "adres") || null, varsayilan: f.get("varsayilan") === "on" };
  try {
    const kayit = await db.$transaction(async (tx) => {
      if (veri.varsayilan) await tx.firma.updateMany({ where: { varsayilan: true }, data: { varsayilan: false } });
      return id ? tx.firma.update({ where: { id }, data: veri }) : tx.firma.create({ data: veri });
    });
    await denetim(k.kullaniciAdi, id ? "GUNCELLE" : "EKLE", "Firma", kayit.id);
  } catch (e) {
    return benzersiz(e, "Bu vergi numarasıyla bir firma var.");
  }
  revalidatePath("/ayarlar", "layout");
  return { tamam: "Kaydedildi." };
}

/* ---------- basit tanımlar ---------- */

export async function konumEkle(_: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const ad = yazi(f, "ad");
  if (!ad) return { hata: "Konum adı gerekli." };
  try {
    const x = await db.konum.create({ data: { ad } });
    await denetim(k.kullaniciAdi, "EKLE", "Konum", x.id);
  } catch (e) {
    return benzersiz(e, "Bu konum zaten var.");
  }
  revalidatePath("/ayarlar", "layout");
  return { tamam: "Eklendi." };
}

export async function otvEkle(_: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const n = sayi(f.get("oran"));
  if (n === null || n < 0 || n > 100) return { hata: "Oranı yüzde olarak girin (0-100)." };
  try {
    const x = await db.otvOrani.create({ data: { oran: Math.round(n * 100) / 10000 } });
    await denetim(k.kullaniciAdi, "EKLE", "OtvOrani", x.id);
  } catch (e) {
    return benzersiz(e, "Bu oran listede var.");
  }
  revalidatePath("/ayarlar", "layout");
  return { tamam: "Eklendi." };
}

export async function kdvEkle(_: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const n = sayi(f.get("oran"));
  if (n === null || n < 0 || n > 100) return { hata: "Oranı yüzde olarak girin (0-100)." };
  try {
    const x = await db.kdvOrani.create({ data: { oran: Math.round(n * 100) / 10000 } });
    await denetim(k.kullaniciAdi, "EKLE", "KdvOrani", x.id);
  } catch (e) {
    return benzersiz(e, "Bu oran listede var.");
  }
  revalidatePath("/ayarlar", "layout");
  return { tamam: "Eklendi." };
}

export async function maddeEkle(_: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const ad = yazi(f, "ad");
  if (!ad) return { hata: "Madde gerekli." };
  const son = await db.kontrolMaddesi.aggregate({ _max: { sira: true } });
  try {
    const x = await db.kontrolMaddesi.create({ data: { ad, sira: (son._max.sira ?? 0) + 1 } });
    await denetim(k.kullaniciAdi, "EKLE", "KontrolMaddesi", x.id);
  } catch (e) {
    return benzersiz(e, "Bu madde zaten var.");
  }
  revalidatePath("/ayarlar", "layout");
  return { tamam: "Eklendi." };
}

export async function tipEkle(_: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const ad = metin(f.get("ad"));
  if (!ad) return { hata: "Tip adı gerekli." };
  const otv = String(f.get("otv") ?? "");
  try {
    const x = await db.aracTipi.create({ data: { ad, varsayilanOtvOrani: otv === "" ? null : Number(otv) } });
    await denetim(k.kullaniciAdi, "EKLE", "AracTipi", x.id);
  } catch (e) {
    return benzersiz(e, "Bu tip zaten var.");
  }
  revalidatePath("/ayarlar", "layout");
  return { tamam: "Eklendi." };
}

export async function markaEkle(_: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const ad = metin(f.get("ad"));
  if (!ad) return { hata: "Marka adı gerekli." };
  try {
    const x = await db.marka.create({ data: { ad } });
    await denetim(k.kullaniciAdi, "EKLE", "Marka", x.id);
  } catch (e) {
    return benzersiz(e, "Bu marka zaten var.");
  }
  revalidatePath("/ayarlar", "layout");
  return { tamam: "Eklendi." };
}

export async function modelEkle(_: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const markaId = Number(f.get("markaId"));
  const model = metin(f.get("model"));
  const altModel = metin(f.get("altModel"));
  const tipId = Number(f.get("tipId")) || null;
  if (!markaId) return { hata: "Marka seçin." };
  if (!model) return { hata: "Model adı gerekli." };
  try {
    const x = await db.aracModeli.create({ data: { markaId, model, altModel, tipId } });
    await denetim(k.kullaniciAdi, "EKLE", "AracModeli", x.id);
  } catch (e) {
    return benzersiz(e, "Bu model zaten var.");
  }
  revalidatePath("/ayarlar", "layout");
  return { tamam: "Eklendi." };
}

/* ---------- ürün grupları ve markaları ---------- */

type UrunTanim = "urunGrubu" | "urunMarkasi";
const TANIM_AD: Record<UrunTanim, { ad: string; tablo: string }> = { urunGrubu: { ad: "grup", tablo: "UrunGrubu" }, urunMarkasi: { ad: "marka", tablo: "UrunMarkasi" } };
const tanimAdi = (f: FormData) => yazi(f, "ad").toLocaleUpperCase("tr-TR");

export async function urunTanimEkle(tur: UrunTanim, _: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const ad = tanimAdi(f);
  if (!ad) return { hata: `${TANIM_AD[tur].ad[0].toLocaleUpperCase("tr-TR")}${TANIM_AD[tur].ad.slice(1)} adı gerekli.` };
  try {
    const x = tur === "urunGrubu" ? await db.urunGrubu.create({ data: { ad } }) : await db.urunMarkasi.create({ data: { ad } });
    await denetim(k.kullaniciAdi, "EKLE", TANIM_AD[tur].tablo, x.id);
  } catch (e) {
    return benzersiz(e, `Bu ${TANIM_AD[tur].ad} zaten var.`);
  }
  revalidatePath("/ayarlar", "layout");
  revalidatePath("/stok");
  return { tamam: "Eklendi." };
}

/** Ad değişikliği bağlı tüm ürünlerde görünür; ürünlerde ad değil tanım kaydı tutulur. */
export async function urunTanimAdDegistir(tur: UrunTanim, id: number, _: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const ad = tanimAdi(f);
  if (!ad) return { hata: "Ad boş olamaz." };
  try {
    if (tur === "urunGrubu") await db.urunGrubu.update({ where: { id }, data: { ad } });
    else await db.urunMarkasi.update({ where: { id }, data: { ad } });
  } catch (e) {
    return benzersiz(e, `Bu ${TANIM_AD[tur].ad} zaten var.`);
  }
  await denetim(k.kullaniciAdi, "GUNCELLE", TANIM_AD[tur].tablo, id);
  revalidatePath("/ayarlar", "layout");
  revalidatePath("/stok");
  return { tamam: "Kaydedildi." };
}

/** Konum, ÖTV oranı, kontrol maddesi, ürün grubu ve markası silinmez; pasif yapılır ki eski kayıtlar bozulmasın. */
export async function aktiflikDegistir(tablo: "konum" | "otvOrani" | "kdvOrani" | "kontrolMaddesi" | UrunTanim, id: number) {
  const k = await yetkiIste("YONETICI");
  const where = { id };
  let aktif: boolean | undefined;
  if (tablo === "konum") {
    aktif = (await db.konum.findUnique({ where }))?.aktif;
    if (aktif !== undefined) await db.konum.update({ where, data: { aktif: !aktif } });
  } else if (tablo === "otvOrani") {
    aktif = (await db.otvOrani.findUnique({ where }))?.aktif;
    if (aktif !== undefined) await db.otvOrani.update({ where, data: { aktif: !aktif } });
  } else if (tablo === "kdvOrani") {
    aktif = (await db.kdvOrani.findUnique({ where }))?.aktif;
    if (aktif !== undefined) await db.kdvOrani.update({ where, data: { aktif: !aktif } });
  } else if (tablo === "urunGrubu") {
    aktif = (await db.urunGrubu.findUnique({ where }))?.aktif;
    if (aktif !== undefined) await db.urunGrubu.update({ where, data: { aktif: !aktif } });
  } else if (tablo === "urunMarkasi") {
    aktif = (await db.urunMarkasi.findUnique({ where }))?.aktif;
    if (aktif !== undefined) await db.urunMarkasi.update({ where, data: { aktif: !aktif } });
  } else {
    aktif = (await db.kontrolMaddesi.findUnique({ where }))?.aktif;
    if (aktif !== undefined) await db.kontrolMaddesi.update({ where, data: { aktif: !aktif } });
  }
  if (aktif === undefined) return;
  await denetim(k.kullaniciAdi, aktif ? "PASIF" : "AKTIF", tablo, id);
  revalidatePath("/ayarlar", "layout");
}

/* ---------- yazdırılan belgeler ---------- */

export async function belgeAyarKaydet(_: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  // her bölüm yalnızca kendi alanlarını gönderir; formda olmayan anahtara dokunulmaz
  for (const anahtar of Object.keys(BELGE_AYARLARI).filter((x) => f.has(x))) {
    const deger = String(f.get(anahtar) ?? "").trim();
    // varsayılanla aynı ya da boşsa kayıt tutulmaz; belge varsayılanı kullanır
    if (!deger || deger === BELGE_AYARLARI[anahtar as BelgeAyarAnahtari].varsayilan) await db.ayar.deleteMany({ where: { anahtar } });
    else await db.ayar.upsert({ where: { anahtar }, update: { deger }, create: { anahtar, deger } });
  }
  await denetim(k.kullaniciAdi, "GUNCELLE", "Ayar", "belge");
  revalidatePath("/ayarlar", "layout");
  return { tamam: "Kaydedildi." };
}

export async function maddeGuncelle(id: number, _: AyarDurum, f: FormData): Promise<AyarDurum> {
  const k = await yetkiIste("YONETICI");
  const ad = yazi(f, "ad");
  const sira = Number(f.get("sira"));
  if (!ad) return { hata: "Madde boş olamaz." };
  if (!Number.isInteger(sira) || sira < 1) return { hata: "Sıra 1 veya büyük bir tam sayı olmalı." };
  try {
    await db.kontrolMaddesi.update({ where: { id }, data: { ad, sira } });
  } catch (e) {
    return benzersiz(e, "Bu madde zaten var.");
  }
  await denetim(k.kullaniciAdi, "GUNCELLE", "KontrolMaddesi", id);
  revalidatePath("/ayarlar", "layout");
  return { tamam: "Kaydedildi." };
}
