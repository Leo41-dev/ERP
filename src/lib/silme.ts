import "server-only";
import { Prisma, type Rol } from "@prisma/client";
import { db } from "./db";

/**
 * Kayıt silme (tüm modüller için ortak kural).
 * Bir kayıt yalnızca hiçbir hareket ya da belgede kullanılmıyorsa silinir; kullanılıyorsa nerede kullanıldığı
 * söylenir ve pasif yapılması önerilir. Kullanım, şemadaki ilişkilerden otomatik bulunur: yeni bir modül
 * eklendiğinde ona bağlanan kayıtlar da kendiliğinden sayılır. Kayda ait alt kayıtlar (ürünün vergi seçimi,
 * teklifin kalemleri gibi, şemada onDelete: Cascade olanlar) onunla birlikte silinir.
 * Satış, tahsilat, iade, stok girişi gibi mali belgeler silinmez; iptal edilir (ters kayıt).
 */

type Tanim = {
  model: Prisma.ModelName;
  ad: string;
  yetki: Rol[]; // yönetici her zaman yetkili
  liste?: string; // silindikten sonra dönülecek sayfa
  sahipli?: Prisma.ModelName[]; // geçmiş sayılmayan, kayıtla birlikte silinen bağlı kayıtlar
  engel?: (id: number, k: { id: number; rol: Rol }) => Promise<string | null>;
};

export const SILINEBILIR = {
  urun: { model: "Urun", ad: "ürün kartı", yetki: ["DEPO", "MUHASEBE"], liste: "/stok" },
  cari: { model: "Cari", ad: "müşteri", yetki: ["MUHASEBE"], liste: "/musteriler" },
  arac: { model: "Arac", ad: "araç", yetki: [], liste: "/araclar", sahipli: ["KonumTransferi"] },
  teklif: {
    model: "Teklif",
    ad: "teklif",
    yetki: ["SATIS", "MUHASEBE"],
    liste: "/teklifler",
    engel: async (id, k) => {
      const t = await db.teklif.findUnique({ where: { id }, select: { satisId: true, saticiId: true } });
      if (t?.satisId) return "Satışa dönüşmüş teklif silinemez.";
      if (t && k.rol === "SATIS" && t.saticiId !== k.id) return "Yalnızca kendi teklifinizi silebilirsiniz.";
      return null;
    },
  },
  finansHesabi: { model: "FinansHesabi", ad: "hesap", yetki: ["MUHASEBE"], liste: "/finans" },
  finansKategori: { model: "FinansKategori", ad: "kategori", yetki: [] },
  konum: { model: "Konum", ad: "konum", yetki: [] },
  kdvOrani: { model: "KdvOrani", ad: "KDV oranı", yetki: [] },
  otvOrani: { model: "OtvOrani", ad: "ÖTV oranı", yetki: [] },
  vergiTanimi: { model: "VergiTanimi", ad: "vergi tanımı", yetki: [] },
  kontrolMaddesi: { model: "KontrolMaddesi", ad: "kontrol maddesi", yetki: [] },
  urunGrubu: { model: "UrunGrubu", ad: "ürün grubu", yetki: [] },
  urunMarkasi: { model: "UrunMarkasi", ad: "ürün markası", yetki: [] },
  aracTipi: { model: "AracTipi", ad: "araç tipi", yetki: [] },
  marka: { model: "Marka", ad: "marka", yetki: [] },
  aracModeli: { model: "AracModeli", ad: "model", yetki: [] },
  firma: {
    model: "Firma",
    ad: "firma",
    yetki: [],
    engel: async (id) => {
      const f = await db.firma.findUnique({ where: { id }, select: { varsayilan: true } });
      if (f?.varsayilan && (await db.firma.count({ where: { NOT: { id } } }))) return "Varsayılan firma silinemez; önce başka bir firmayı varsayılan yapın.";
      return null;
    },
  },
  kullanici: {
    model: "Kullanici",
    ad: "kullanıcı",
    yetki: [],
    liste: "/ayarlar/kullanicilar",
    sahipli: ["SatisHedefi"],
    engel: async (id, k) => {
      if (id === k.id) return "Kendi kullanıcınızı silemezsiniz.";
      const u = await db.kullanici.findUnique({ where: { id }, select: { rol: true } });
      if (u?.rol === "YONETICI" && (await db.kullanici.count({ where: { rol: "YONETICI", aktif: true, NOT: { id } } })) === 0) return "Son yönetici silinemez.";
      return null;
    },
  },
} satisfies Record<string, Tanim>;

export type SilinebilirTur = keyof typeof SILINEBILIR;

const MODEL_AD: Partial<Record<Prisma.ModelName, string>> = {
  StokHareketi: "stok hareketi",
  StokGiris: "stok girişi",
  StokGirisKalemi: "stok giriş satırı",
  SayimSatiri: "sayım satırı",
  Satis: "satış",
  SatisKalemi: "satış kalemi",
  Teklif: "teklif",
  TeklifKalemi: "teklif kalemi",
  CariHareket: "cari hareket",
  Tahsilat: "tahsilat",
  Arac: "araç",
  AracModeli: "model",
  KonumTransferi: "konum transferi",
  Garanti: "garanti kaydı",
  Urun: "ürün",
  UrunVergi: "ürün kartı",
  FaturaEsleme: "fatura eşlemesi",
  SatisHedefi: "satış hedefi",
  HesapHareketi: "hesap hareketi",
  GeriOdeme: "iade ödemesi",
};

type Delege = { count(a: object): Promise<number>; deleteMany(a: object): Promise<unknown>; findUnique(a: object): Promise<object | null>; delete(a: object): Promise<unknown> };
const delege = (tx: Prisma.TransactionClient | typeof db, model: Prisma.ModelName) => (tx as unknown as Record<string, Delege>)[model[0].toLowerCase() + model.slice(1)];

/** Bu modele yabancı anahtarla bağlanan ilişkiler (alt kayıt olarak birlikte silinenler hariç) */
function baglantilar(model: Prisma.ModelName, sahipli: Prisma.ModelName[] = []) {
  const sonuc: { model: Prisma.ModelName; alan: string; sahipli: boolean }[] = [];
  for (const m of Prisma.dmmf.datamodel.models) {
    for (const f of m.fields) {
      if (f.kind !== "object" || f.type !== model || !f.relationFromFields?.length || f.relationOnDelete === "Cascade") continue;
      sonuc.push({ model: m.name as Prisma.ModelName, alan: f.relationFromFields[0], sahipli: sahipli.includes(m.name as Prisma.ModelName) });
    }
  }
  return sonuc;
}

/** Kaydın kullanıldığı yerler: "3 satış kalemi, 12 stok hareketi" */
export async function kullanimlar(model: Prisma.ModelName, id: number, sahipli: Prisma.ModelName[] = []) {
  const say = await Promise.all(
    baglantilar(model, sahipli)
      .filter((b) => !b.sahipli)
      .map(async (b) => ({ ad: MODEL_AD[b.model] ?? b.model, adet: await delege(db, b.model).count({ where: { [b.alan]: id } }) })),
  );
  const toplam = new Map<string, number>();
  for (const s of say) if (s.adet) toplam.set(s.ad, (toplam.get(s.ad) ?? 0) + s.adet);
  return [...toplam.entries()].map(([ad, adet]) => `${adet.toLocaleString("tr-TR")} ${ad}`);
}

export type SilmeSonucu = { hata: string } | { tamam: true; liste?: string };

export async function kaydiSil(tur: SilinebilirTur, id: number, k: { id: number; rol: Rol; kullaniciAdi: string }): Promise<SilmeSonucu> {
  const t: Tanim = SILINEBILIR[tur];
  if (k.rol !== "YONETICI" && !t.yetki.includes(k.rol)) return { hata: "Bu kaydı silme yetkiniz yok." };
  const kayit = await delege(db, t.model).findUnique({ where: { id } });
  if (!kayit) return { hata: "Kayıt bulunamadı, sayfayı yenileyin." };
  const engel = await t.engel?.(id, k);
  if (engel) return { hata: engel };
  const kullanim = await kullanimlar(t.model, id, t.sahipli);
  if (kullanim.length) {
    const pasifOlur = Prisma.dmmf.datamodel.models.find((m) => m.name === t.model)?.fields.some((f) => f.name === "aktif");
    return { hata: `Bu ${t.ad} kullanılıyor (${kullanim.join(", ")}); geçmiş kayıtlar bozulmasın diye silinemez.${pasifOlur ? " Pasif yaparak listelerden kaldırabilirsiniz." : ""}` };
  }
  try {
    await db.$transaction(async (tx) => {
      for (const b of baglantilar(t.model, t.sahipli).filter((x) => x.sahipli)) await delege(tx, b.model).deleteMany({ where: { [b.alan]: id } });
      await delege(tx, t.model).delete({ where: { id } });
      // silinen kaydın son hali denetim kaydında saklanır
      await tx.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: "SIL", tablo: t.model, kayitId: String(id), detay: JSON.parse(JSON.stringify(kayit)) } });
    });
  } catch (e) {
    // kontrolle silme arasında başka bir işlem kayda bağlandıysa
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2003" || e.code === "P2014")) return { hata: `Bu ${t.ad} başka kayıtlarda kullanılıyor, silinemez.` };
    throw e;
  }
  return { tamam: true, liste: t.liste };
}
