import Link from "next/link";
import { BaglantiButon, Etiket, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { tarih, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { HESAP_TUR_AD, hesapBakiyeleri } from "@/lib/finans";
import { yetkiIste } from "@/lib/oturum";
import { hesapKaydet } from "./eylem";
import { HesapFormu } from "./Formlar";

export const metadata = { title: "Banka ve kasa" };

const PARA = { TRY: "₺", EUR: "€", USD: "$" } as const;
const tutar = (n: number, p: keyof typeof PARA) => (p === "TRY" ? tl(n) : `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${PARA[p]}`);

export default async function Finans() {
  await yetkiIste("MUHASEBE");
  const [hesaplar, firmalar] = await Promise.all([hesapBakiyeleri(), db.firma.findMany({ where: { aktif: true }, select: { id: true, unvan: true }, orderBy: { id: "asc" } })]);
  const aktif = hesaplar.filter((h) => h.aktif);
  // türe göre TL toplamları
  const ozet = (Object.keys(HESAP_TUR_AD) as (keyof typeof HESAP_TUR_AD)[])
    .map((t) => ({ t, toplam: aktif.filter((h) => h.tur === t && h.paraBirimi === "TRY").reduce((a, h) => a + h.bakiye, 0), adet: aktif.filter((h) => h.tur === t).length }))
    .filter((x) => x.adet);
  return (
    <>
      <SayfaBaslik
        baslik="Banka ve kasa"
        aciklama="Kasa, banka, POS ve kredi kartı hesapları. Tahsilatlar ve iade ödemeleri hesaplara kendiliğinden işlenir; masraf, gelir ve virman elle girilir."
        sag={aktif.length > 0 && <BaglantiButon href="/finans/hareket">Hareket gir</BaglantiButon>}
      />
      {ozet.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {ozet.map((x) => (
            <Kart key={x.t}><p className="text-xs text-zinc-500">{HESAP_TUR_AD[x.t]} ({x.adet})</p><p className={`mt-1 text-lg font-semibold tabular-nums ${x.toplam < 0 ? "text-red-700" : ""}`}>{tl(x.toplam)}</p></Kart>
          ))}
        </div>
      )}
      <Tablo basliklar={["Hesap", "Tür", "Banka / IBAN", "Son hareket", "Bakiye"]} bos={!hesaplar.length}>
        {hesaplar.map((h) => (
          <tr key={h.id} className={h.aktif ? "hover:bg-zinc-50" : "text-zinc-400"}>
            <Hucre><Link href={`/finans/${h.id}`} className="font-medium hover:underline">{h.ad}</Link>{!h.aktif && <span className="ml-2"><Etiket>Pasif</Etiket></span>}{h.firma && firmalar.length > 1 && <span className="ml-2 text-xs text-zinc-500">{h.firma.unvan}</span>}</Hucre>
            <Hucre>{HESAP_TUR_AD[h.tur]}</Hucre>
            <Hucre>{[h.banka, h.iban ?? h.hesapNo].filter(Boolean).join(" · ") || "-"}</Hucre>
            <Hucre>{tarih(h.son)}</Hucre>
            <Hucre className={`text-right tabular-nums ${h.bakiye < 0 ? "text-red-700" : ""}`}>{tutar(h.bakiye, h.paraBirimi)}</Hucre>
          </tr>
        ))}
      </Tablo>
      <Kart baslik="Yeni hesap" className="mt-6">
        <HesapFormu eylem={hesapKaydet.bind(null, null)} firmalar={firmalar} bugun={new Date().toISOString().slice(0, 10)} />
      </Kart>
      <p className="mt-3 text-xs text-zinc-500">Ödeme yöntemine göre paranın gireceği varsayılan hesap ve gelir/gider kategorileri Ayarlar → Finans&apos;ta seçilir.</p>
    </>
  );
}
