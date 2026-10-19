import { Kart, SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { HareketFormu } from "../Formlar";

export const metadata = { title: "Hesap hareketi" };

export default async function YeniHareket({ searchParams }: { searchParams: Promise<{ hesap?: string; tur?: string }> }) {
  await yetkiIste("MUHASEBE");
  const p = await searchParams;
  const [hesaplar, kategoriler] = await Promise.all([
    db.finansHesabi.findMany({ where: { aktif: true }, orderBy: [{ tur: "asc" }, { ad: "asc" }], select: { id: true, ad: true } }),
    db.finansKategori.findMany({ where: { aktif: true }, orderBy: { ad: "asc" }, select: { id: true, ad: true, tur: true } }),
  ]);
  return (
    <>
      <SayfaBaslik baslik="Hesap hareketi" aciklama="Masraf, diğer gelir, tedarikçi ödemesi ya da hesaplar arası virman." />
      <Kart>
        {hesaplar.length ? (
          <HareketFormu hesaplar={hesaplar} kategoriler={kategoriler} hesapId={Number(p.hesap) || undefined} tur={p.tur} bugun={new Date().toISOString().slice(0, 10)} />
        ) : (
          <p className="text-sm text-zinc-600">Önce Banka ve kasa sayfasından bir hesap açın.</p>
        )}
      </Kart>
    </>
  );
}
