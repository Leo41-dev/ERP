import Link from "next/link";
import { Alan, Etiket, Girdi, Kart, MetinAlani, SayfaBaslik, Secim } from "@/components/ui";
import { yuzde } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { aktiflikDegistir, firmaKaydet, konumEkle, maddeEkle, markaEkle, modelEkle, otvEkle, tipEkle } from "./eylem";
import { AktiflikButonu, AyarFormu } from "./Formlar";

function Liste({ ogeler }: { ogeler: { id: number; ad: string; aktif?: boolean; sag?: React.ReactNode }[] }) {
  if (!ogeler.length) return <p className="mb-3 text-sm text-zinc-500">Henüz kayıt yok.</p>;
  return (
    <ul className="mb-3 divide-y divide-zinc-100 text-sm">
      {ogeler.map((o) => (
        <li key={o.id} className="flex items-center justify-between gap-2 py-1.5">
          <span className={o.aktif === false ? "text-zinc-400 line-through" : ""}>{o.ad}</span>
          {o.sag}
        </li>
      ))}
    </ul>
  );
}

export default async function Ayarlar() {
  await yetkiIste("YONETICI");
  const [firmalar, konumlar, otvler, maddeler, tipler, markalar, kullaniciSayisi] = await Promise.all([
    db.firma.findMany({ orderBy: { id: "asc" } }),
    db.konum.findMany({ orderBy: { ad: "asc" } }),
    db.otvOrani.findMany({ orderBy: { oran: "asc" } }),
    db.kontrolMaddesi.findMany({ orderBy: { sira: "asc" } }),
    db.aracTipi.findMany({ orderBy: { ad: "asc" } }),
    db.marka.findMany({ orderBy: { ad: "asc" }, include: { modeller: { include: { tip: true }, orderBy: [{ model: "asc" }, { altModel: "asc" }] } } }),
    db.kullanici.count({ where: { aktif: true } }),
  ]);
  const aktifOtv = otvler.filter((o) => o.aktif);

  return (
    <>
      <SayfaBaslik baslik="Ayarlar" aciklama="Tanımlar silinmez, pasif yapılır; eski kayıtlar bozulmaz." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Kart baslik="Kullanıcılar" sag={<Link href="/ayarlar/kullanicilar" className="text-sm text-zinc-600 hover:underline">Yönet</Link>}>
          <p className="text-sm text-zinc-600">{kullaniciSayisi} aktif kullanıcı.</p>
        </Kart>

        <Kart baslik="Firma bilgileri">
          {[...firmalar, null].map((f) => (
            <div key={f?.id ?? "yeni"} className="mb-4 last:mb-0">
              {!f && firmalar.length > 0 && <p className="mb-2 text-xs font-medium text-zinc-500">Yeni firma (ör. hizmet satışı yapan firma)</p>}
              <AyarFormu eylem={firmaKaydet} buton={f ? "Kaydet" : "Firma ekle"} className="grid gap-2 md:grid-cols-2">
                {f && <input type="hidden" name="id" value={f.id} />}
                <Alan etiket="Unvan" className="md:col-span-2"><Girdi name="unvan" defaultValue={f?.unvan} required /></Alan>
                <Alan etiket="VKN / TCKN"><Girdi name="vkn" defaultValue={f?.vkn} inputMode="numeric" required /></Alan>
                <Alan etiket="Vergi dairesi"><Girdi name="vergiDairesi" defaultValue={f?.vergiDairesi ?? ""} /></Alan>
                <Alan etiket="Adres" className="md:col-span-2"><MetinAlani name="adres" rows={2} defaultValue={f?.adres ?? ""} /></Alan>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" name="varsayilan" defaultChecked={f ? f.varsayilan : firmalar.length === 0} /> Satış formunda varsayılan firma
                </label>
              </AyarFormu>
            </div>
          ))}
        </Kart>

        <Kart baslik="Araç konumları">
          <Liste ogeler={konumlar.map((x) => ({ id: x.id, ad: x.ad, aktif: x.aktif, sag: <AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, "konum", x.id)} /> }))} />
          <AyarFormu eylem={konumEkle}><Girdi name="ad" placeholder="Yeni konum" className="w-auto flex-1" required /></AyarFormu>
        </Kart>

        <Kart baslik="ÖTV oranları">
          <Liste ogeler={otvler.map((x) => ({ id: x.id, ad: yuzde(x.oran), aktif: x.aktif, sag: <AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, "otvOrani", x.id)} /> }))} />
          <AyarFormu eylem={otvEkle}><Girdi name="oran" placeholder="Oran, % (ör. 37)" inputMode="decimal" className="w-auto flex-1" required /></AyarFormu>
        </Kart>

        <Kart baslik="Teslim kontrol listesi (PDI)">
          <Liste ogeler={maddeler.map((x) => ({ id: x.id, ad: `${x.sira}. ${x.ad}`, aktif: x.aktif, sag: <AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, "kontrolMaddesi", x.id)} /> }))} />
          <AyarFormu eylem={maddeEkle}><Girdi name="ad" placeholder="Yeni madde" className="w-auto flex-1" required /></AyarFormu>
        </Kart>

        <Kart baslik="Araç tipleri">
          <Liste ogeler={tipler.map((x) => ({ id: x.id, ad: x.ad, sag: <span className="text-xs text-zinc-500">önerilen ÖTV {yuzde(x.varsayilanOtvOrani)}</span> }))} />
          <AyarFormu eylem={tipEkle}>
            <Girdi name="ad" placeholder="Tip (ör. ATV, UTV)" className="w-auto flex-1" required />
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
                <p className="text-sm font-medium">{m.ad}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {m.modeller.map((x) => (
                    <Etiket key={x.id}>{[x.model, x.altModel].filter(Boolean).join(" · ")}{x.tip ? ` (${x.tip.ad})` : ""}</Etiket>
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
