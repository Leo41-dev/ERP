// Ekranda gösterim biçimleri
import type { Prisma } from "@prisma/client";

type Sayisal = number | Prisma.Decimal | null | undefined;
const n = (v: Sayisal) => (v === null || v === undefined ? null : Number(v));

export function tl(v: Sayisal): string {
  const x = n(v);
  return x === null ? "-" : x.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

export function yuzde(v: Sayisal): string {
  const x = n(v);
  return x === null ? "-" : `%${(x * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}

export function tarih(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : "-";
}

export function tarihSaat(d: Date | null | undefined): string {
  return d ? d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" }) : "-";
}

export function telefonGoster(t: string | null | undefined): string {
  return t && t.length === 10 ? `0${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6, 8)} ${t.slice(8)}` : (t ?? "-");
}

export const ROL_AD: Record<string, string> = { YONETICI: "Yönetici", SATIS: "Satış", DEPO: "Depo", SERVIS: "Servis", MUHASEBE: "Muhasebe" };
export const KONDISYON_AD: Record<string, string> = { SIFIR: "Sıfır", IKINCI_EL: "2. el", KONSINYE: "Konsinye" };
export const ARAC_DURUM_AD: Record<string, string> = { STOKTA: "Stokta", REZERVE: "Rezerve", SATILDI: "Satıldı", IADE: "İade" };
export const SATIS_DURUM_AD: Record<string, string> = { TASLAK: "Taslak", KAYITLI: "Kayıtlı", FATURALANDI: "Faturalandı", IPTAL: "İptal" };
export const ODEME_AD: Record<string, string> = { HAVALE: "Havale/EFT", KART: "Kredi kartı", NAKIT: "Nakit", SENET: "Senet", CEK: "Çek", DIGER: "Diğer" };
export const TESCIL_AD: Record<string, string> = { TESCILSIZ: "Tescilsiz", BASVURUDA: "Başvuruda", TESCILLI: "Tescilli" };
export const SATIS_DURUM_RENK = { TASLAK: "gri", KAYITLI: "sari", FATURALANDI: "yesil", IPTAL: "kirmizi" } as const;
