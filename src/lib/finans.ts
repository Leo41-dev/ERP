import "server-only";
import { Prisma, type HesapTur, type OdemeYontem } from "@prisma/client";
import { db } from "./db";
import { para } from "./normalize";

/**
 * Banka ve kasa. Para hareketi olan her işlem bir hesaba (kasa, banka, POS, kredi kartı) bağlanır:
 * tahsilat giriş, iade ödemesi çıkış yazar; masraf, diğer gelir ve virman elle girilir.
 * Ödeme yöntemine göre varsayılan hesap Ayarlar → Finans'ta seçilir (ayar anahtarı finans.hesap.<YONTEM>).
 * Senet ve çek portföyde bekler, tahsil edildiğinde hesaba girer.
 */

type Tx = Prisma.TransactionClient | typeof db;
const dec = (n: number) => new Prisma.Decimal(n);

export const HESAP_TUR_AD: Record<HesapTur, string> = { KASA: "Kasa", BANKA: "Banka hesabı", POS: "POS", KREDI_KARTI: "Kredi kartı" };
export const VARSAYILAN_YONTEMLER: OdemeYontem[] = ["NAKIT", "KART", "HAVALE", "CEK", "SENET", "DIGER"];
export const PORTFOY: OdemeYontem[] = ["SENET", "CEK"];

export async function varsayilanHesaplar(tx: Tx = db) {
  const ayarlar = await tx.ayar.findMany({ where: { anahtar: { startsWith: "finans.hesap." } } });
  const m: Partial<Record<OdemeYontem, number>> = {};
  for (const a of ayarlar) if (Number(a.deger)) m[a.anahtar.slice("finans.hesap.".length) as OdemeYontem] = Number(a.deger);
  return m;
}

/** Ödeme formlarındaki hesap seçimi için aktif hesaplar ve yönteme göre varsayılanlar */
export async function odemeHesapSecenekleri() {
  const [hesaplar, varsayilan] = await Promise.all([
    db.finansHesabi.findMany({ where: { aktif: true }, orderBy: [{ tur: "asc" }, { ad: "asc" }], select: { id: true, ad: true, tur: true } }),
    varsayilanHesaplar(),
  ]);
  return { hesaplar, varsayilan };
}
export type OdemeHesaplari = Awaited<ReturnType<typeof odemeHesapSecenekleri>>;

/** Seçilen hesap aktifse o, değilse yöntemin varsayılanı; senet/çek portföyde bekler (null) */
export async function odemeHesabi(tx: Tx, yontem: OdemeYontem, secilen: number | null | undefined, portfoyDahil = false) {
  if (PORTFOY.includes(yontem) && !portfoyDahil) return null;
  if (secilen && (await tx.finansHesabi.findFirst({ where: { id: secilen, aktif: true }, select: { id: true } }))) return secilen;
  const v = (await varsayilanHesaplar(tx))[yontem];
  return v && (await tx.finansHesabi.findFirst({ where: { id: v, aktif: true }, select: { id: true } })) ? v : null;
}

/** Tahsilatın hesaba girişi (hesap yoksa yazılmaz; sonradan hesap ekranından bağlanabilir) */
export async function tahsilatHesabaYaz(tx: Prisma.TransactionClient, t: { id: number; tarih: Date; tutar: number | Prisma.Decimal; yontem: OdemeYontem; cariId: number }, secilen: number | null | undefined, kaydeden: string, aciklama: string, portfoyDahil = false) {
  const hesapId = await odemeHesabi(tx, t.yontem, secilen, portfoyDahil);
  if (!hesapId) return null;
  await tx.tahsilat.update({ where: { id: t.id }, data: { hesapId } });
  return tx.hesapHareketi.create({ data: { hesapId, tarih: t.tarih, giris: dec(Number(t.tutar)), aciklama, cariId: t.cariId, tahsilatId: t.id, kaynak: "TAHSILAT", kaydeden } });
}

/** Müşteriye iade ödemesi: hesaptan çıkış */
export async function geriOdemeHesabaYaz(tx: Prisma.TransactionClient, g: { id: number; tutar: number; yontem: OdemeYontem; cariId: number; tarih: Date }, secilen: number | null | undefined, kaydeden: string, aciklama: string) {
  const hesapId = await odemeHesabi(tx, g.yontem, secilen);
  if (!hesapId) return null;
  await tx.geriOdeme.update({ where: { id: g.id }, data: { hesapId } });
  return tx.hesapHareketi.create({ data: { hesapId, tarih: g.tarih, cikis: dec(g.tutar), aciklama, cariId: g.cariId, geriOdemeId: g.id, kaynak: "GERI_ODEME", kaydeden } });
}

/** İptal edilen tahsilatların hesap hareketleri de iptal edilir (silinmez) */
export async function tahsilatHareketleriniIptalEt(tx: Prisma.TransactionClient, tahsilatIdler: number[], kim: string, neden: string) {
  if (!tahsilatIdler.length) return;
  await tx.hesapHareketi.updateMany({ where: { tahsilatId: { in: tahsilatIdler }, iptalZamani: null }, data: { iptalZamani: new Date(), iptalEden: kim, iptalNedeni: neden } });
}

/** Hesap bakiyeleri: açılış + giriş − çıkış (iptaller hariç) */
export async function hesapBakiyeleri() {
  const [hesaplar, toplam] = await Promise.all([
    db.finansHesabi.findMany({ orderBy: [{ aktif: "desc" }, { tur: "asc" }, { ad: "asc" }], include: { firma: { select: { unvan: true } } } }),
    db.hesapHareketi.groupBy({ by: ["hesapId"], where: { iptalZamani: null }, _sum: { giris: true, cikis: true }, _max: { tarih: true } }),
  ]);
  return hesaplar.map((h) => {
    const t = toplam.find((x) => x.hesapId === h.id);
    const giris = Number(t?._sum.giris ?? 0), cikis = Number(t?._sum.cikis ?? 0);
    return { ...h, acilisBakiye: Number(h.acilisBakiye), giris, cikis, bakiye: para(Number(h.acilisBakiye) + giris - cikis), son: t?._max.tarih ?? null };
  });
}

/** Tarih aralığında yürüyen bakiyeli döküm; aralıktan önceki hareketler devreden bakiyeye girer */
export async function hesapDokumu(hesapId: number, bas: Date | null, bit: Date | null) {
  const h = await db.finansHesabi.findUnique({ where: { id: hesapId } });
  if (!h) return null;
  const once = bas ? await db.hesapHareketi.aggregate({ where: { hesapId, iptalZamani: null, tarih: { lt: bas } }, _sum: { giris: true, cikis: true } }) : null;
  let bakiye = Number(h.acilisBakiye) + Number(once?._sum.giris ?? 0) - Number(once?._sum.cikis ?? 0);
  const devreden = para(bakiye);
  const hareketler = await db.hesapHareketi.findMany({
    where: { hesapId, tarih: { ...(bas ? { gte: bas } : {}), ...(bit ? { lt: bit } : {}) } },
    orderBy: [{ tarih: "asc" }, { id: "asc" }],
    include: { kategori: true, cari: { select: { id: true, unvan: true } }, tahsilat: { select: { satisId: true, yontem: true } }, geriOdeme: { select: { iade: { select: { satisId: true, iadeNo: true } } } } },
  });
  const satirlar = hareketler.map((x) => {
    if (!x.iptalZamani) bakiye += Number(x.giris) - Number(x.cikis);
    return { ...x, giris: Number(x.giris), cikis: Number(x.cikis), bakiye: para(bakiye) };
  });
  return { hesap: h, devreden, satirlar, kapanis: para(bakiye) };
}
