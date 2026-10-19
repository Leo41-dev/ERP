import Link from "next/link";
import { Girdi, Kart } from "@/components/ui";
import { yuzde } from "@/lib/bicim";
import { db } from "@/lib/db";
import { aktiflikDegistir, kdvEkle, maddeEkle, maddeGuncelle, otvEkle } from "../eylem";
import { AktiflikButonu, AyarFormu } from "../Formlar";
import { BelgeAyarKarti, Liste } from "../ortak";

export const metadata = { title: "Ayarlar · Satış" };

export default async function SatisAyarlari() {
  const [kdvler, otvler, maddeler] = await Promise.all([
    db.kdvOrani.findMany({ orderBy: { oran: "asc" } }),
    db.otvOrani.findMany({ orderBy: { oran: "asc" } }),
    db.kontrolMaddesi.findMany({ orderBy: { sira: "asc" } }),
  ]);
  return (
    <>
      <p className="mb-4 text-sm text-zinc-500">Satış, hızlı satış ve teklif ekranlarında kullanılan oranlar, teslim kontrol listesi ve belge metinleri.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Kart baslik="KDV oranları" sag={<span className="text-xs text-zinc-500">Ürün kartı, satış ve teklifte seçilir</span>}>
          <Liste ogeler={kdvler.map((x) => ({ id: x.id, ad: yuzde(x.oran), aktif: x.aktif, sag: <AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, "kdvOrani", x.id)} /> }))} />
          <AyarFormu eylem={kdvEkle}><Girdi name="oran" placeholder="Oran, % (ör. 20)" inputMode="decimal" className="w-auto flex-1" required /></AyarFormu>
        </Kart>
        <Kart baslik="ÖTV oranları" sag={<span className="text-xs text-zinc-500">Araç satışı ve ürün kartında seçilir</span>}>
          <Liste ogeler={otvler.map((x) => ({ id: x.id, ad: yuzde(x.oran), aktif: x.aktif, sag: <AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, "otvOrani", x.id)} /> }))} />
          <AyarFormu eylem={otvEkle}><Girdi name="oran" placeholder="Oran, % (ör. 37)" inputMode="decimal" className="w-auto flex-1" required /></AyarFormu>
        </Kart>
        <Kart baslik="Satış hedefleri">
          <p className="text-sm text-zinc-600">Her satıcı için ay ay araç ve ciro hedefi. <Link href="/ayarlar/hedefler" className="underline">Hedefleri düzenle</Link></p>
        </Kart>
        <BelgeAyarKarti baslik="Teklif" anahtarlar={["belge.teklifBaslik", "belge.teklifNotu", "belge.teklifGun"]} />
        <Kart baslik="Teslim kontrol listesi (PDI)">
          <ul className="mb-3 space-y-1.5">
            {maddeler.map((x) => (
              <li key={x.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <AyarFormu eylem={maddeGuncelle.bind(null, x.id)} buton="Kaydet">
                    <Girdi name="sira" type="number" min={1} defaultValue={x.sira} className="!w-16" aria-label="Sıra" />
                    <Girdi name="ad" defaultValue={x.ad} className={`w-auto flex-1 ${x.aktif ? "" : "text-zinc-400 line-through"}`} aria-label="Madde" />
                  </AyarFormu>
                </div>
                <div className="pt-2"><AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, "kontrolMaddesi", x.id)} /></div>
              </li>
            ))}
          </ul>
          <AyarFormu eylem={maddeEkle}><Girdi name="ad" placeholder="Yeni madde" className="w-auto flex-1" required /></AyarFormu>
        </Kart>
        <BelgeAyarKarti baslik="Satış belgeleri" anahtarlar={["belge.satisFormuBaslik", "belge.satisFormuNotu", "belge.pdiBaslik", "belge.teslimBeyani", "belge.kontrolEden", "belge.fisBaslik", "belge.fisNotu"]} />
      </div>
    </>
  );
}
