import Link from "next/link";
import { SayfaBaslik } from "@/components/ui";
import { hedefTablosu } from "@/lib/hedef";
import { yetkiIste } from "@/lib/oturum";
import { ayKaydir, buAy } from "@/lib/panoHesap";
import { hedefleriKaydet } from "./eylem";
import { HedefFormu } from "./HedefFormu";

const AY_AD = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const ayAd = (ay: string) => `${AY_AD[Number(ay.slice(5)) - 1]} ${ay.slice(0, 4)}`;

export default async function Hedefler({ searchParams }: { searchParams: Promise<{ ay?: string }> }) {
  await yetkiIste("YONETICI");
  const q = (await searchParams).ay ?? "";
  const ay = /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : buAy();
  const t = await hedefTablosu(ay);
  const bag = "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50";
  return (
    <>
      <SayfaBaslik
        baslik={`Satış hedefleri · ${ayAd(ay)}`}
        aciklama="Öneri, önceki 3 ayın ortalamasının %10 fazlasıdır (araç adedi araç satışlarından, ciro tüm satışlardan, iadeler düşülmüş)."
        sag={
          <div className="flex items-center gap-2">
            <Link href={`?ay=${ayKaydir(ay, -1)}`} className={bag}>‹ {ayAd(ayKaydir(ay, -1))}</Link>
            {ay !== buAy() && <Link href="?" className={bag}>Bu ay</Link>}
            <Link href={`?ay=${ayKaydir(ay, 1)}`} className={bag}>{ayAd(ayKaydir(ay, 1))} ›</Link>
          </div>
        }
      />
      <HedefFormu key={ay} eylem={hedefleriKaydet.bind(null, ay)} satirlar={t.satirlar} aylar={t.aylar.map(ayAd)} />
    </>
  );
}
