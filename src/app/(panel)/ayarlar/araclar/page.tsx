import { SilButonu } from "@/components/SilButonu";
import { Etiket, Girdi, Kart, Secim } from "@/components/ui";
import { yuzde } from "@/lib/bicim";
import { db } from "@/lib/db";
import { aktiflikDegistir, konumEkle, markaEkle, modelEkle, tipEkle } from "../eylem";
import { AktiflikButonu, AyarFormu } from "../Formlar";
import { Liste } from "../ortak";

export const metadata = { title: "Ayarlar · Araçlar" };

export default async function AracAyarlari() {
  const [konumlar, otvler, tipler, markalar] = await Promise.all([
    db.konum.findMany({ orderBy: { ad: "asc" } }),
    db.otvOrani.findMany({ where: { aktif: true }, orderBy: { oran: "asc" } }),
    db.aracTipi.findMany({ orderBy: { ad: "asc" } }),
    db.marka.findMany({ orderBy: { ad: "asc" }, include: { modeller: { include: { tip: true }, orderBy: [{ model: "asc" }, { altModel: "asc" }] } } }),
  ]);
  const aktifOtv = otvler;
  return (
    <>
      <p className="mb-4 text-sm text-zinc-500">Şase bazlı araç stoğunda kullanılan konumlar, tipler, marka ve modeller.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Kart baslik="Araç konumları">
          <Liste ogeler={konumlar.map((x) => ({ id: x.id, ad: x.ad, aktif: x.aktif, sag: <span className="flex gap-3"><AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, "konum", x.id)} /><SilButonu kucuk tur="konum" id={x.id} ad={x.ad} /></span> }))} />
          <AyarFormu eylem={konumEkle}><Girdi name="ad" placeholder="Yeni konum" className="w-auto flex-1" required /></AyarFormu>
        </Kart>

        <Kart baslik="Araç tipleri">
          <Liste ogeler={tipler.map((x) => ({ id: x.id, ad: x.ad, sag: <span className="flex gap-3 text-xs text-zinc-500">önerilen ÖTV {yuzde(x.varsayilanOtvOrani)}<SilButonu kucuk tur="aracTipi" id={x.id} ad={x.ad} /></span> }))} />
          <AyarFormu eylem={tipEkle}>
            <Girdi name="ad" placeholder="Tip (ör. SUV, ATV)" className="w-auto flex-1" required />
            <Secim name="otv" className="w-auto" defaultValue="">
              <option value="">Önerilen ÖTV yok</option>
              {aktifOtv.map((o) => <option key={o.id} value={String(o.oran)}>{yuzde(o.oran)}</option>)}
            </Secim>
          </AyarFormu>
        </Kart>

        <Kart baslik="Marka ve modeller" className="lg:col-span-2">
          <div className="mb-4 space-y-3">
            {markalar.map((m) => (
              <div key={m.id}>
                <div className="flex items-center gap-3 text-sm font-medium">{m.ad}<SilButonu kucuk tur="marka" id={m.id} ad={m.ad} /></div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {m.modeller.map((x) => (
                    <Etiket key={x.id}>{[x.model, x.altModel].filter(Boolean).join(" · ")}{x.tip ? ` (${x.tip.ad})` : ""} <SilButonu kucuk tur="aracModeli" id={x.id} ad={[m.ad, x.model, x.altModel].filter(Boolean).join(" ")} /></Etiket>
                  ))}
                  {!m.modeller.length && <span className="text-xs text-zinc-500">Model yok.</span>}
                </div>
              </div>
            ))}
            {!markalar.length && <p className="text-sm text-zinc-500">Henüz marka yok.</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <AyarFormu eylem={markaEkle} buton="Marka ekle"><Girdi name="ad" placeholder="Marka" className="w-auto flex-1" required /></AyarFormu>
            <AyarFormu eylem={modelEkle} buton="Model ekle">
              <Secim name="markaId" className="w-auto" required defaultValue="">
                <option value="" disabled>Marka</option>
                {markalar.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
              </Secim>
              <Girdi name="model" placeholder="Model" className="w-28" required />
              <Girdi name="altModel" placeholder="Alt model" className="w-28" />
              <Secim name="tipId" className="w-auto" defaultValue="">
                <option value="">Tip</option>
                {tipler.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
              </Secim>
            </AyarFormu>
          </div>
        </Kart>
      </div>
    </>
  );
}
