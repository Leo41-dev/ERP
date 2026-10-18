// Pano için saf hesaplar (Türkiye saati UTC+3, yaz saati yok)

const SAAT3 = 3 * 3_600_000;
const GUN = 86_400_000;

/** Türkiye takvim gününü UTC gece yarısı olarak verir (tarih alanlarıyla karşılaştırmak için) */
export const trKunye = (d: Date) => new Date(Math.floor((d.getTime() + SAAT3) / GUN) * GUN);

/** Türkiye takviminde iki an arasındaki gün farkı */
export const gunFarki = (a: Date, b: Date) => Math.max(0, Math.round((trKunye(b).getTime() - trKunye(a).getTime()) / GUN));

export type Donem = "bugun" | "ay" | "gecenay" | "30" | "90" | "yil" | "ozel";
export const DONEM_AD: Record<Donem, string> = { bugun: "Bugün", ay: "Bu ay", gecenay: "Geçen ay", "30": "Son 30 gün", "90": "Son 90 gün", yil: "Bu yıl", ozel: "Özel aralık" };

/** Dönemin başlangıç (dahil) ve bitiş (hariç) anları */
export function donemAraligi(donem: Donem, simdi = new Date(), ozel?: { bas?: string; bit?: string }) {
  const gun = trKunye(simdi); // bugünün Türkiye günü (UTC gece yarısı)
  const y = gun.getUTCFullYear(), m = gun.getUTCMonth();
  const an = (d: Date) => new Date(d.getTime() - SAAT3); // Türkiye gece yarısı anı
  const yarin = new Date(gun.getTime() + GUN);
  switch (donem) {
    case "bugun": return { bas: an(gun), bit: an(yarin) };
    case "gecenay": return { bas: an(new Date(Date.UTC(y, m - 1, 1))), bit: an(new Date(Date.UTC(y, m, 1))) };
    case "30": return { bas: an(new Date(gun.getTime() - 29 * GUN)), bit: an(yarin) };
    case "90": return { bas: an(new Date(gun.getTime() - 89 * GUN)), bit: an(yarin) };
    case "yil": return { bas: an(new Date(Date.UTC(y, 0, 1))), bit: an(yarin) };
    case "ozel": {
      const b = /^\d{4}-\d{2}-\d{2}$/.test(ozel?.bas ?? "") ? new Date(`${ozel!.bas}T00:00:00Z`) : new Date(Date.UTC(y, m, 1));
      const s = /^\d{4}-\d{2}-\d{2}$/.test(ozel?.bit ?? "") ? new Date(`${ozel!.bit}T00:00:00Z`) : gun;
      return { bas: an(b), bit: an(new Date(Math.max(s.getTime(), b.getTime()) + GUN)) };
    }
    default: return { bas: an(new Date(Date.UTC(y, m, 1))), bit: an(yarin) };
  }
}

/** Eski panodaki hedef kuralı: son 3 tam ayın ortalaması × 1,10 (adet araç satışından, ciro tüm satışlardan) */
export const HEDEF_BUYUME = 1.1;
export function hedefHesapla(satislar: { arac: boolean; tutar: number }[]) {
  const adet = satislar.filter((s) => s.arac).length;
  const ciro = satislar.reduce((t, s) => t + s.tutar, 0);
  return { adet: Math.max(1, Math.round((adet / 3) * HEDEF_BUYUME)), ciro: Math.round(((ciro / 3) * HEDEF_BUYUME) / 1000) * 1000 };
}

/** "yyyy-MM" ayını n ay kaydırır */
export function ayKaydir(ay: string, n: number) {
  const [y, m] = ay.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Ayın Türkiye saatine göre başlangıç anı */
export const ayBasi = (ay: string) => new Date(Date.parse(`${ay}-01T00:00:00Z`) - SAAT3);

/** Türkiye saatine göre içinde bulunulan ay */
export const buAy = (simdi = new Date()) => trKunye(simdi).toISOString().slice(0, 7);
