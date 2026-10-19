import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (sifre: string, tuz: Buffer, uzunluk: number) => Promise<Buffer>;

// Biçim: scrypt$<tuz hex>$<özet hex>
export async function sifreOzetle(sifre: string): Promise<string> {
  const tuz = randomBytes(16);
  const ozet = await scrypt(sifre, tuz, 64);
  return `scrypt$${tuz.toString("hex")}$${ozet.toString("hex")}`;
}

export async function sifreDogrula(sifre: string, kayit: string | null): Promise<boolean> {
  const [alg, tuzHex, ozetHex] = (kayit ?? "").split("$");
  if (alg !== "scrypt" || !tuzHex || !ozetHex) return false;
  const beklenen = Buffer.from(ozetHex, "hex");
  const ozet = await scrypt(sifre, Buffer.from(tuzHex, "hex"), beklenen.length);
  return timingSafeEqual(ozet, beklenen);
}

/** En az 8 karakter, harf ve rakam. Hata mesajı döner, uygunsa null. */
export function sifreKurali(sifre: string): string | null {
  if (sifre.length < 8) return "Şifre en az 8 karakter olmalı.";
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(sifre) || !/\d/.test(sifre)) return "Şifre harf ve rakam içermeli.";
  return null;
}
