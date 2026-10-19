import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { bugunTr } from "@/lib/dogrulama/teklif";
import { yetkiIste } from "@/lib/oturum";
import { GirisFormu } from "../GirisFormu";
import { kdvOranlari } from "@/lib/vergi";

export const metadata = { title: "Stok girişi" };

export default async function YeniGiris() {
  await yetkiIste("DEPO", "MUHASEBE");
  const tedarikciler = await db.cari.findMany({ where: { rol: { in: ["TEDARIKCI", "MUSTERI_TEDARIKCI"] } }, orderBy: { unvan: "asc" }, select: { id: true, unvan: true } });
  return (
    <>
      <SayfaBaslik baslik="Stok girişi" aciklama="Tedarikçiden gelen parça ve aksesuarlar. Kaydedince stok artar, ortalama maliyet güncellenir." />
      <GirisFormu tedarikciler={tedarikciler} bugun={bugunTr()} kdvOranlari={await kdvOranlari(db)} />
    </>
  );
}
