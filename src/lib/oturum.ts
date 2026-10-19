import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Rol } from "@prisma/client";
import { db } from "./db";
import { sifreDogrula } from "./sifre";

const CEREZ = "erp_oturum";
const SURE_SAAT = 12;
const DENEME_LIMIT = 5;
const KILIT_DAKIKA = 10;

const ozet = (token: string) => createHash("sha256").update(token).digest("hex");

export type OturumKullanici = { id: number; adSoyad: string; kullaniciAdi: string; rol: Rol };

export async function girisYap(kullaniciAdi: string, sifre: string): Promise<{ hata: string } | { ok: true }> {
  const genelHata = { hata: "Kullanıcı adı veya şifre hatalı." };
  const k = await db.kullanici.findUnique({ where: { kullaniciAdi: kullaniciAdi.trim().toLowerCase() } });
  if (!k || !k.aktif) return genelHata;
  if (k.kilitBitis && k.kilitBitis > new Date()) {
    return { hata: `Çok fazla hatalı deneme. ${KILIT_DAKIKA} dakika sonra tekrar deneyin.` };
  }
  if (!(await sifreDogrula(sifre, k.sifreOzet))) {
    const deneme = k.hataliDeneme + 1;
    await db.kullanici.update({
      where: { id: k.id },
      data: deneme >= DENEME_LIMIT
        ? { hataliDeneme: 0, kilitBitis: new Date(Date.now() + KILIT_DAKIKA * 60_000) }
        : { hataliDeneme: deneme },
    });
    return genelHata;
  }
  const token = randomBytes(32).toString("base64url");
  const bitis = new Date(Date.now() + SURE_SAAT * 3_600_000);
  await db.$transaction([
    db.oturum.create({ data: { id: ozet(token), kullaniciId: k.id, bitis } }),
    db.kullanici.update({ where: { id: k.id }, data: { hataliDeneme: 0, kilitBitis: null, sonGiris: new Date() } }),
  ]);
  (await cookies()).set(CEREZ, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: bitis,
  });
  return { ok: true };
}

export async function cikisYap() {
  const c = await cookies();
  const token = c.get(CEREZ)?.value;
  if (token) await db.oturum.deleteMany({ where: { id: ozet(token) } });
  c.delete(CEREZ);
}

export async function mevcutKullanici(): Promise<OturumKullanici | null> {
  const token = (await cookies()).get(CEREZ)?.value;
  if (!token) return null;
  const o = await db.oturum.findUnique({ where: { id: ozet(token) }, include: { kullanici: true } });
  if (!o || o.bitis < new Date() || !o.kullanici.aktif) return null;
  const { id, adSoyad, kullaniciAdi, rol } = o.kullanici;
  return { id, adSoyad, kullaniciAdi, rol };
}

/** Giriş yoksa giriş sayfasına, yetki yoksa ana sayfaya yönlendirir. */
export async function yetkiIste(...roller: Rol[]): Promise<OturumKullanici> {
  const k = await mevcutKullanici();
  if (!k) redirect("/giris");
  if (roller.length && k.rol !== "YONETICI" && !roller.includes(k.rol)) redirect("/");
  return k;
}

/** Maliyet ve kâr bilgisini görebilen roller. */
export const maliyetGorur = (k: OturumKullanici) => k.rol === "YONETICI" || k.rol === "MUHASEBE";
