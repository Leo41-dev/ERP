import { Kart, SayfaBaslik } from "@/components/ui";
import { tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";

export default async function Pano() {
  const k = await yetkiIste();
  const simdi = new Date();
  const ayBasi = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
  const ayAnahtar = `${simdi.getFullYear()}-${String(simdi.getMonth() + 1).padStart(2, "0")}`;
  const kendi = !maliyetGorur(k);
  const satisFiltre = { durum: { in: ["KAYITLI", "FATURALANDI"] as ("KAYITLI" | "FATURALANDI")[] }, tarih: { gte: ayBasi }, ...(kendi ? { saticiId: k.id } : {}) };
  const [stokta, rezerve, ay, hedef] = await Promise.all([
    db.arac.count({ where: { durum: "STOKTA" } }),
    db.arac.count({ where: { durum: "REZERVE" } }),
    db.satis.aggregate({ where: satisFiltre, _count: true, _sum: { genelToplam: true } }),
    db.satisHedefi.findUnique({ where: { kullaniciId_ay: { kullaniciId: k.id, ay: ayAnahtar } } }),
  ]);
  const kutular = [
    { ad: "Stoktaki araç", deger: stokta.toLocaleString("tr-TR") },
    { ad: "Rezerve araç", deger: rezerve.toLocaleString("tr-TR") },
    { ad: kendi ? "Bu ay satışlarım" : "Bu ay satış", deger: ay._count.toLocaleString("tr-TR") },
    { ad: kendi ? "Bu ay cirom" : "Bu ay ciro", deger: tl(ay._sum.genelToplam ?? 0) },
  ];
  return (
    <>
      <SayfaBaslik baslik={`Merhaba, ${k.adSoyad}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kutular.map((x) => (
          <Kart key={x.ad}>
            <p className="text-xs text-zinc-500">{x.ad}</p>
            <p className="mt-1 text-xl font-semibold">{x.deger}</p>
          </Kart>
        ))}
      </div>
      {hedef && kendi && (
        <Kart baslik="Bu ayki hedefim" className="mt-4">
          <p className="text-sm">
            {ay._count} / {hedef.hedefAdet} adet · {tl(ay._sum.genelToplam ?? 0)} / {tl(hedef.hedefCiro)}
          </p>
        </Kart>
      )}
    </>
  );
}
