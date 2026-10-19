import type { Rol } from "@prisma/client";

/**
 * Modül haritası: soldaki menü ve ana ekrandaki modül kartları buradan üretilir.
 * Yeni modül eklenince yalnızca bu listeye eklenir. roller boşsa herkes görür (yönetici her zaman görür);
 * sayfaların kendi yetki kontrolü ayrıca geçerlidir, buradaki roller onunla aynı tutulur.
 */
export type Baglanti = { href: string; ad: string; roller?: Rol[] };
export type Modul = { ad: string; aciklama: string; ana: Baglanti; islemler: Baglanti[]; yakinda?: boolean };

const SATIS_ROLLERI: Rol[] = ["SATIS", "MUHASEBE", "SERVIS"];
const STOK_ROLLERI: Rol[] = ["DEPO", "MUHASEBE"];

export const MODULLER: Modul[] = [
  {
    ad: "Satış",
    aciklama: "Araç satışı, hızlı satış, iade",
    ana: { href: "/satislar", ad: "Satışlar" },
    islemler: [
      { href: "/satislar/yeni", ad: "Araç satışı", roller: ["SATIS"] },
      { href: "/satislar/hizli", ad: "Hızlı satış", roller: SATIS_ROLLERI },
    ],
  },
  {
    ad: "Teklif",
    aciklama: "Fiyat teklifi, satışa dönüşüm",
    ana: { href: "/teklifler", ad: "Teklifler", roller: SATIS_ROLLERI },
    islemler: [{ href: "/teklifler/yeni", ad: "Yeni teklif", roller: SATIS_ROLLERI }],
  },
  {
    ad: "Tahsilat ve cari",
    aciklama: "Tahsilat, senet/çek, açık alacaklar",
    ana: { href: "/tahsilat", ad: "Tahsilat", roller: SATIS_ROLLERI },
    islemler: [{ href: "/tahsilat/yeni", ad: "Tahsilat al", roller: SATIS_ROLLERI }],
  },
  {
    ad: "Müşteriler",
    aciklama: "Cari kartlar, ekstre",
    ana: { href: "/musteriler", ad: "Müşteriler" },
    islemler: [{ href: "/musteriler/yeni", ad: "Yeni müşteri", roller: SATIS_ROLLERI }],
  },
  {
    ad: "Araçlar",
    aciklama: "Şase bazlı araç stoğu, konum, QR etiket",
    ana: { href: "/araclar", ad: "Araçlar" },
    islemler: [
      { href: "/araclar/fatura", ad: "Faturayla araç girişi", roller: STOK_ROLLERI },
      { href: "/araclar/yeni", ad: "Elle araç girişi", roller: STOK_ROLLERI },
    ],
  },
  {
    ad: "Stok",
    aciklama: "Parça, aksesuar, hizmet kartları",
    ana: { href: "/stok", ad: "Stok" },
    islemler: [
      { href: "/stok/giris/yeni", ad: "Stok girişi", roller: STOK_ROLLERI },
      { href: "/stok/yeni", ad: "Yeni ürün / hizmet", roller: STOK_ROLLERI },
      { href: "/stok/sayim", ad: "Sayım", roller: STOK_ROLLERI },
    ],
  },
  {
    ad: "Analiz",
    aciklama: "Stok yaşlandırma, kârlılık, ABC, teklif hunisi",
    ana: { href: "/analiz", ad: "Analiz", roller: ["MUHASEBE"] },
    islemler: [],
  },
  {
    ad: "Ayarlar",
    aciklama: "Firma, oranlar, tanımlar, kullanıcılar",
    ana: { href: "/ayarlar", ad: "Ayarlar", roller: ["YONETICI"] },
    islemler: [
      { href: "/ayarlar/satis", ad: "Satış ayarları", roller: ["YONETICI"] },
      { href: "/ayarlar/stok", ad: "Stok ayarları", roller: ["YONETICI"] },
      { href: "/ayarlar/kullanicilar", ad: "Kullanıcılar", roller: ["YONETICI"] },
    ],
  },
  { ad: "Teknik servis", aciklama: "Servis kabul, iş emri, parça kullanımı", ana: { href: "#", ad: "Teknik servis" }, islemler: [], yakinda: true },
  { ad: "E-fatura", aciklama: "Uyumsoft ile e-fatura / e-arşiv", ana: { href: "#", ad: "E-fatura" }, islemler: [], yakinda: true },
];

export const gorur = (rol: Rol, b: Baglanti) => rol === "YONETICI" || !b.roller?.length || b.roller.includes(rol);

/** Kullanıcının erişebildiği modüller ve işlemleri */
export function modulleri(rol: Rol) {
  return MODULLER.filter((m) => m.yakinda || gorur(rol, m.ana)).map((m) => ({ ...m, islemler: m.islemler.filter((i) => gorur(rol, i)) }));
}

/** Soldaki menü: ana sayfa + modüllerin ana sayfaları, hızlı satış ayrıca */
export function menuOgeleri(rol: Rol): Baglanti[] {
  const hizli = { href: "/satislar/hizli", ad: "Hızlı satış", roller: SATIS_ROLLERI };
  const liste = modulleri(rol).filter((m) => !m.yakinda).map((m) => m.ana);
  if (gorur(rol, hizli)) liste.splice(1, 0, hizli);
  return [{ href: "/", ad: "Ana ekran" }, ...liste];
}
