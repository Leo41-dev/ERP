// Örnek kasa / banka hesapları (`npm run demo:finans`): yalnızca hiç hesap yokken çalışır.
// Mevcut tahsilat ve iade ödemeleri varsayılan hesaplara işlenir, birkaç örnek masraf ve virman eklenir.
// Demo veritabanı içindir; gerçek kurulumda hesaplar Banka ve kasa sayfasından açılır.
import { Prisma, PrismaClient, type OdemeYontem } from "@prisma/client";

const db = new PrismaClient();
const dec = (n: number) => new Prisma.Decimal(n);
const gunOnce = (g: number) => new Date(Date.now() - g * 86_400_000);

async function main() {
  if (await db.finansHesabi.count()) return console.log("Hesap var, örnek finans verisi eklenmedi.");
  const acilisTarihi = gunOnce(120);
  const kasa = await db.finansHesabi.create({ data: { ad: "MERKEZ KASA", tur: "KASA", acilisBakiye: dec(25_000), acilisTarihi } });
  const banka = await db.finansHesabi.create({ data: { ad: "ZİRAAT BANKASI TL", tur: "BANKA", banka: "Ziraat Bankası", sube: "Kartepe", iban: "TR000001000000000000000001", acilisBakiye: dec(350_000), acilisTarihi } });
  const pos = await db.finansHesabi.create({ data: { ad: "ZİRAAT POS", tur: "POS", banka: "Ziraat Bankası", acilisTarihi } });
  const varsayilan: Partial<Record<OdemeYontem, number>> = { NAKIT: kasa.id, KART: pos.id, HAVALE: banka.id, CEK: banka.id, SENET: kasa.id };
  for (const [y, id] of Object.entries(varsayilan)) {
    await db.ayar.upsert({ where: { anahtar: `finans.hesap.${y}` }, create: { anahtar: `finans.hesap.${y}`, deger: String(id), guncelleme: new Date() }, update: { deger: String(id), guncelleme: new Date() } });
  }
  // mevcut tahsilatlar: senet/çek yalnızca tahsil edildiyse
  const tahsilatlar = await db.tahsilat.findMany({ where: { hesapId: null }, include: { cari: { select: { unvan: true } }, satis: { select: { formNo: true, durum: true } } } });
  for (const t of tahsilatlar) {
    const portfoy = t.yontem === "SENET" || t.yontem === "CEK";
    if (portfoy && !t.tahsilTarihi) continue;
    const hesapId = varsayilan[t.yontem];
    if (!hesapId) continue;
    const iptal = t.iptalZamani ?? (t.satis?.durum === "IPTAL" ? new Date() : null);
    await db.tahsilat.update({ where: { id: t.id }, data: { hesapId } });
    await db.hesapHareketi.create({
      data: {
        hesapId, tarih: portfoy ? t.tahsilTarihi! : t.tarih, giris: t.tutar, cariId: t.cariId, tahsilatId: t.id, kaynak: "TAHSILAT", kaydeden: t.kaydeden,
        aciklama: `Tahsilat${t.satis ? `, satış ${t.satis.formNo}` : ""} · ${t.cari.unvan}`,
        ...(iptal ? { iptalZamani: iptal, iptalNedeni: t.iptalNedeni ?? "Satış iptali" } : {}),
      },
    });
  }
  const geriOdemeler = await db.geriOdeme.findMany({ where: { hesapId: null }, include: { iade: { include: { satis: { select: { cariId: true, formNo: true } } } } } });
  for (const g of geriOdemeler) {
    const hesapId = varsayilan[g.yontem];
    if (!hesapId) continue;
    await db.geriOdeme.update({ where: { id: g.id }, data: { hesapId } });
    await db.hesapHareketi.create({ data: { hesapId, tarih: g.iade.tarih, cikis: g.tutar, cariId: g.iade.satis.cariId, geriOdemeId: g.id, kaynak: "GERI_ODEME", aciklama: `İade ödemesi ${g.iade.iadeNo}, satış ${g.iade.satis.formNo}` } });
  }
  // POS'ta biriken kart tahsilatları bankaya geçer (virman) ve komisyon kesilir
  const posToplam = (await db.hesapHareketi.aggregate({ where: { hesapId: pos.id, iptalZamani: null }, _sum: { giris: true } }))._sum.giris;
  const kat = async (ad: string) => (await db.finansKategori.findFirst({ where: { ad } }))?.id ?? null;
  if (posToplam && Number(posToplam) > 0) {
    const tutar = Math.round(Number(posToplam) * 0.6);
    const ortak = { tarih: gunOnce(3), aciklama: "POS blokesi çözüldü", virmanNo: "demo-pos-1", kaynak: "VIRMAN" as const, kaydeden: "Demo" };
    await db.hesapHareketi.create({ data: { ...ortak, hesapId: pos.id, cikis: dec(tutar) } });
    await db.hesapHareketi.create({ data: { ...ortak, hesapId: banka.id, giris: dec(tutar) } });
    await db.hesapHareketi.create({ data: { hesapId: pos.id, tarih: gunOnce(3), cikis: dec(Math.round(tutar * 0.019)), aciklama: "POS komisyonu", kategoriId: await kat("Banka masrafı ve komisyon"), kaydeden: "Demo" } });
  }
  const masraflar: [number, number, string, string, number][] = [
    [banka.id, 25, "Kira", "Ekim kirası", 45_000],
    [banka.id, 12, "Elektrik, su, doğalgaz", "Elektrik faturası", 6_850],
    [kasa.id, 6, "Kargo ve nakliye", "Parça kargosu", 740],
    [banka.id, 2, "Personel", "Maaş ödemeleri", 98_000],
  ];
  for (const [hesapId, g, k, aciklama, tutar] of masraflar) {
    await db.hesapHareketi.create({ data: { hesapId, tarih: gunOnce(g), cikis: dec(tutar), aciklama, kategoriId: await kat(k), kaydeden: "Demo" } });
  }
  console.log(`Örnek finans verisi: 3 hesap, ${tahsilatlar.length} tahsilat ve ${geriOdemeler.length} iade ödemesi işlendi.`);
}

main().finally(() => db.$disconnect());
