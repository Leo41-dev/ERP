import "server-only";
import { db } from "./db";
import { acikSatislar } from "./cari";
import { para } from "./normalize";
import { donemAraligi, gunFarki, hedefHesapla, trKunye, type Donem } from "./panoHesap";

export { donemAraligi, type Donem };

const GECERLI = ["KAYITLI", "FATURALANDI", "IADE"] as const;

/**
 * Pano verisi. saticiId verilirse yalnızca o satıcının satış/teklif/alacakları sayılır (satış rolü);
 * maliyet ve kâr yalnızca maliyet=true iken hesaplanır.
 */
export async function panoVerisi(o: { bas: Date; bit: Date; saticiId?: number; maliyet: boolean; oluEsik: number; dusukMarj: number }) {
  const kendi = o.saticiId ? { saticiId: o.saticiId } : {};
  const bugun = new Date();
  const ucAyOnce = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth() - 3, 1) - 3 * 3_600_000);
  const buAyBasi = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), 1) - 3 * 3_600_000);

  const [satislar, stok, tahsilat, geriOdeme, acik, vadesiGecen, teklifAcik, teklifDonem, gecmis, hedefKayitlari, kullanicilar, buAy] = await Promise.all([
    db.satis.findMany({
      where: { durum: { in: [...GECERLI] }, tarih: { gte: o.bas, lt: o.bit }, ...kendi },
      include: {
        satici: { select: { id: true, adSoyad: true } },
        iadeler: { select: { tutar: true } },
        kalemler: { include: { arac: { include: { model: { include: { marka: true } }, maliyetler: { select: { tutar: true } } } } } },
      },
      orderBy: { tarih: "asc" },
    }),
    db.arac.findMany({
      where: { durum: { in: ["STOKTA", "REZERVE"] } },
      include: { model: { include: { marka: true } }, konum: true, maliyetler: { select: { tutar: true } } },
    }),
    db.tahsilat.aggregate({ where: { iptalZamani: null, tarih: { gte: o.bas, lt: o.bit }, ...(o.saticiId ? { satis: { saticiId: o.saticiId } } : {}) }, _sum: { tutar: true } }),
    db.geriOdeme.aggregate({ where: { iade: { tarih: { gte: o.bas, lt: o.bit }, ...(o.saticiId ? { satis: { saticiId: o.saticiId } } : {}) } }, _sum: { tutar: true } }),
    acikSatislar(o.saticiId ? { saticiId: o.saticiId } : {}),
    db.tahsilat.aggregate({ where: { iptalZamani: null, yontem: { in: ["SENET", "CEK"] }, tahsilTarihi: null, vade: { lt: trKunye(bugun) }, ...(o.saticiId ? { satis: { saticiId: o.saticiId } } : {}) }, _sum: { tutar: true }, _count: true }),
    db.teklif.aggregate({ where: { durum: "ACIK", gecerlilik: { gte: trKunye(bugun) }, ...kendi }, _sum: { genelToplam: true }, _count: true }),
    db.teklif.groupBy({ by: ["durum"], where: { tarih: { gte: o.bas, lt: o.bit }, ...kendi }, _count: true }),
    // hedef için son 3 tam ayın satışları
    db.satis.findMany({
      where: { durum: { in: ["KAYITLI", "FATURALANDI"] }, tarih: { gte: ucAyOnce, lt: buAyBasi }, ...kendi },
      select: { saticiId: true, tur: true, genelToplam: true, iadeler: { select: { tutar: true } } },
    }),
    db.satisHedefi.findMany({ where: { ay: new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 7), ...(o.saticiId ? { kullaniciId: o.saticiId } : {}) } }),
    db.kullanici.findMany({ where: { aktif: true, rol: "SATIS", ...(o.saticiId ? { id: o.saticiId } : {}) }, select: { id: true, adSoyad: true } }),
    // hedef ilerlemesi dönem filtresinden bağımsız, bu ayın satışlarıyla
    db.satis.findMany({
      where: { durum: { in: ["KAYITLI", "FATURALANDI"] }, tarih: { gte: buAyBasi }, ...kendi },
      select: { saticiId: true, tur: true, genelToplam: true, iadeler: { select: { tutar: true } } },
    }),
  ]);

  // ---- satışlar
  type Grup = { ad: string; adet: number; ciro: number; kar: number; sureToplam: number; sureAdet: number };
  const grup = (m: Map<string, Grup>, ad: string) => m.get(ad) ?? (m.set(ad, { ad, adet: 0, ciro: 0, kar: 0, sureToplam: 0, sureAdet: 0 }), m.get(ad)!);
  const markalar = new Map<string, Grup>();
  const personel = new Map<string, Grup & { id: number | null; hizliCiro: number }>();
  const gunluk = new Map<string, { ciro: number; adet: number }>();
  const dusukMarjlar: { id: number; formNo: number; ad: string; ciro: number; kar: number; marj: number }[] = [];
  let ciro = 0, aracCiro = 0, hizliCiro = 0, aracAdet = 0, hizliAdet = 0, kar = 0, maliyetliCiro = 0;

  for (const s of satislar) {
    const net = Number(s.genelToplam) - s.iadeler.reduce((t, i) => t + Number(i.tutar), 0);
    if (net < 0.01) continue; // tamamı iade
    ciro += net;
    const gun = trKunye(s.tarih).toISOString().slice(0, 10);
    const g = gunluk.get(gun) ?? { ciro: 0, adet: 0 };
    g.ciro += net;
    const p = personel.get(String(s.saticiId)) ?? { ad: s.satici?.adSoyad ?? "-", id: s.saticiId, adet: 0, ciro: 0, kar: 0, sureToplam: 0, sureAdet: 0, hizliCiro: 0 };
    personel.set(String(s.saticiId), p);
    p.ciro += net;
    if (s.tur === "HIZLI") {
      hizliCiro += net; hizliAdet++; p.hizliCiro += net;
    } else {
      aracCiro += net; aracAdet++; g.adet++; p.adet++;
      const a = s.kalemler.find((x) => x.arac)?.arac;
      const mal = a?.maliyetler.reduce((t, m) => t + Number(m.tutar), 0) ?? 0;
      const k = mal > 0 ? net - mal : 0;
      const mg = grup(markalar, a?.model ? [a.model.marka.ad, a.model.model, a.model.altModel].filter(Boolean).join(" ") : "Modelsiz");
      mg.adet++; mg.ciro += net;
      if (mal > 0) {
        kar += k; maliyetliCiro += net; mg.kar += k; p.kar += k;
        const marj = (k / net) * 100;
        if (marj < o.dusukMarj) dusukMarjlar.push({ id: s.id, formNo: s.formNo, ad: mg.ad, ciro: net, kar: k, marj });
      }
      const gelis = a?.gelisTarihi ?? a?.olusturma;
      if (gelis) { const sure = gunFarki(gelis, s.tarih); mg.sureToplam += sure; mg.sureAdet++; p.sureToplam += sure; p.sureAdet++; }
    }
    gunluk.set(gun, g);
  }

  // ---- stok
  const stokSatir = stok.map((a) => ({
    id: a.id,
    sase: a.sase,
    ad: a.model ? [a.model.marka.ad, a.model.model, a.model.altModel].filter(Boolean).join(" ") : "Modelsiz",
    konum: a.konum?.ad ?? "Konumsuz",
    kondisyon: a.kondisyon,
    durum: a.durum,
    deger: a.maliyetler.reduce((t, m) => t + Number(m.tutar), 0),
    gun: gunFarki(a.gelisTarihi ?? a.olusturma, bugun),
  }));
  const olu = stokSatir.filter((a) => a.durum === "STOKTA" && a.gun >= o.oluEsik).sort((a, b) => b.gun - a.gun);
  const konumlar = new Map<string, { ad: string; adet: number; deger: number; olu: number }>();
  for (const a of stokSatir) {
    const k = konumlar.get(a.konum) ?? { ad: a.konum, adet: 0, deger: 0, olu: 0 };
    k.adet++; k.deger += a.deger; if (a.durum === "STOKTA" && a.gun >= o.oluEsik) k.olu++;
    konumlar.set(a.konum, k);
  }

  // ---- hedefler: kayıtlı hedef yoksa son 3 tam ay ortalaması × 1,10
  const hedefler = kullanicilar.map((u) => {
    const kayit = hedefKayitlari.find((h) => h.kullaniciId === u.id);
    const oneri = hedefHesapla(gecmis.filter((s) => s.saticiId === u.id).map((s) => ({ arac: s.tur === "ARAC", tutar: Number(s.genelToplam) - s.iadeler.reduce((t, i) => t + Number(i.tutar), 0) })));
    const ay = buAy.filter((s) => s.saticiId === u.id);
    const ciro = para(ay.reduce((t, s) => t + Number(s.genelToplam) - s.iadeler.reduce((a, i) => a + Number(i.tutar), 0), 0));
    return { id: u.id, ad: u.adSoyad, hedefAdet: kayit?.hedefAdet ?? oneri.adet, hedefCiro: kayit ? Number(kayit.hedefCiro) : oneri.ciro, kayitli: !!kayit, adet: ay.filter((s) => s.tur === "ARAC").length, ciro };
  });

  // ---- kampanya önerileri (eski panodaki kurallar sadeleştirildi)
  const oneriler: { baslik: string; aciklama: string }[] = [];
  const oluModel = new Map<string, typeof olu>();
  for (const a of olu) oluModel.set(a.ad, [...(oluModel.get(a.ad) ?? []), a]);
  for (const [ad, l] of [...oluModel.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3)) {
    const ort = Math.round(l.reduce((t, a) => t + a.gun, 0) / l.length);
    oneriler.push({
      baslik: `${ad} için kampanya`,
      aciklama: `${l.length} araç ortalama ${ort} gündür bekliyor (${[...new Set(l.map((a) => a.konum))].join(", ")}). ${ort > 180 ? "%10" : "%5"} indirim ya da takas avantajıyla hızlı satış teşvik edilebilir.`,
    });
  }
  const ikinciEl = stokSatir.filter((a) => a.kondisyon === "IKINCI_EL");
  if (stokSatir.length >= 5 && ikinciEl.length / stokSatir.length > 0.3) {
    oneriler.push({ baslik: "2. el stok için takas kampanyası", aciklama: `Stoktaki araçların %${Math.round((ikinciEl.length / stokSatir.length) * 100)}'i 2. el. "Eskini getir, indirimle al" tarzı bir takas kampanyası bu stoğu eritebilir.` });
  }

  const sirala = <T extends { ciro: number }>(m: Iterable<T>) => [...m].sort((a, b) => b.ciro - a.ciro);
  const sonuclanan = (teklifDonem.find((t) => t.durum === "KABUL")?._count ?? 0) + (teklifDonem.find((t) => t.durum === "RET")?._count ?? 0);
  return {
    ozet: {
      ciro: para(ciro), aracCiro: para(aracCiro), hizliCiro: para(hizliCiro), aracAdet, hizliAdet,
      kar: o.maliyet ? para(kar) : null,
      marj: o.maliyet && maliyetliCiro ? (kar / maliyetliCiro) * 100 : null,
      tahsilat: para(Number(tahsilat._sum.tutar ?? 0) - Number(geriOdeme._sum.tutar ?? 0)),
      acikAlacak: para(acik.reduce((t, s) => t + s.kalan, 0)),
      acikAlacakAdet: acik.length,
      vadesiGecen: Number(vadesiGecen._sum.tutar ?? 0), vadesiGecenAdet: vadesiGecen._count,
      stokAdet: stokSatir.filter((a) => a.durum === "STOKTA").length,
      rezerveAdet: stokSatir.filter((a) => a.durum === "REZERVE").length,
      stokDeger: o.maliyet ? para(stokSatir.reduce((t, a) => t + a.deger, 0)) : null,
      ortBekleme: stokSatir.length ? Math.round(stokSatir.reduce((t, a) => t + a.gun, 0) / stokSatir.length) : 0,
      teklifAcikAdet: teklifAcik._count, teklifAcikTutar: Number(teklifAcik._sum.genelToplam ?? 0),
      teklifDonem: teklifDonem.reduce((t, x) => t + x._count, 0),
      teklifDonusum: sonuclanan ? Math.round(((teklifDonem.find((t) => t.durum === "KABUL")?._count ?? 0) / sonuclanan) * 100) : null,
    },
    gunluk: [...gunluk.entries()].map(([gun, v]) => ({ gun, ...v })),
    markalar: sirala(markalar.values()),
    personel: sirala(personel.values()),
    konumlar: [...konumlar.values()].sort((a, b) => b.adet - a.adet),
    olu,
    dusukMarjlar: dusukMarjlar.sort((a, b) => a.marj - b.marj),
    hedefler,
    oneriler,
  };
}
