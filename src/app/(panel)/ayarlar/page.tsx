import Link from "next/link";
import { Alan, Etiket, Girdi, Kart, MetinAlani, SayfaBaslik, Secim } from "@/components/ui";
import { yuzde } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { BELGE_AYARLARI, belgeAyarlari, type BelgeAyarAnahtari } from "@/lib/belgeAyarlari";
import { aktiflikDegistir, belgeAyarKaydet, firmaKaydet, konumEkle, maddeEkle, maddeGuncelle, markaEkle, modelEkle, otvEkle, tipEkle, urunTanimAdDegistir, urunTanimEkle } from "./eylem";
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
  const [firmalar, konumlar, otvler, maddeler, tipler, markalar, kullaniciSayisi, urunGruplari, urunMarkalari] = await Promise.all([
    db.firma.findMany({ orderBy: { id: "asc" } }),
    db.konum.findMany({ orderBy: { ad: "asc" } }),
    db.otvOrani.findMany({ orderBy: { oran: "asc" } }),
    db.kontrolMaddesi.findMany({ orderBy: { sira: "asc" } }),
    db.aracTipi.findMany({ orderBy: { ad: "asc" } }),
    db.marka.findMany({ orderBy: { ad: "asc" }, include: { modeller: { include: { tip: true }, orderBy: [{ model: "asc" }, { altModel: "asc" }] } } }),
    db.kullanici.count({ where: { aktif: true } }),
    db.urunGrubu.findMany({ orderBy: { ad: "asc" }, include: { _count: { select: { urunler: true } } } }),
    db.urunMarkasi.findMany({ orderBy: { ad: "asc" }, include: { _count: { select: { urunler: true } } } }),
  ]);
  const belge = await belgeAyarlari();
  const aktifOtv = otvler.filter((o) => o.aktif);

  return (
    <>
      <SayfaBaslik baslik="Ayarlar" aciklama="Tanımlar silinmez, pasif yapılır; eski kayıtlar bozulmaz." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Kart baslik="Kullanıcılar" sag={<span className="flex gap-4"><Link href="/ayarlar/hedefler" className="text-sm text-zinc-600 hover:underline">Satış hedefleri</Link><Link href="/ayarlar/kullanicilar" className="text-sm text-zinc-600 hover:underline">Yönet</Link></span>}>
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

        <Kart baslik="Yazdırılan belgeler" sag={<span className="text-xs text-zinc-500">Boş bırakılan alan varsayılana döner</span>}>
          <AyarFormu eylem={belgeAyarKaydet} buton="Kaydet" className="grid gap-2">
            {(Object.keys(BELGE_AYARLARI) as BelgeAyarAnahtari[]).map((a) => {
              const t = BELGE_AYARLARI[a];
              return (
                <Alan key={a} etiket={t.ad}>
                  {t.cokSatir
                    ? <MetinAlani name={a} rows={3} defaultValue={belge[a]} placeholder={t.varsayilan} />
                    : <Girdi name={a} defaultValue={belge[a]} placeholder={t.varsayilan} />}
                </Alan>
              );
            })}
          </AyarFormu>
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
          <ul className="mb-3 space-y-1.5">
            {maddeler.map((x) => (
              <li key={x.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <AyarFormu eylem={maddeGuncelle.bind(null, x.id)} buton="Kaydet">
                    <Girdi name="sira" type="number" min={1} defaultValue={x.sira} className="w-16" aria-label="Sıra" />
                    <Girdi name="ad" defaultValue={x.ad} className={`w-auto flex-1 ${x.aktif ? "" : "text-zinc-400 line-through"}`} aria-label="Madde" />
                  </AyarFormu>
                </div>
                <div className="pt-2"><AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, "kontrolMaddesi", x.id)} /></div>
              </li>
            ))}
          </ul>
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

        {([["urunGrubu", "Ürün grupları", urunGruplari, "Yeni grup (ör. FİLTRE)"], ["urunMarkasi", "Ürün markaları", urunMarkalari, "Yeni marka (ör. MOTUL)"]] as const).map(([tur, baslik, liste, ipucu]) => (
          <Kart key={tur} baslik={baslik} sag={<span className="text-xs text-zinc-500">Stok kartlarında seçilir</span>}>
            <ul className="mb-3 space-y-1.5">
              {liste.map((x) => (
                <li key={x.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <AyarFormu eylem={urunTanimAdDegistir.bind(null, tur, x.id)} buton="Kaydet">
                      <Girdi name="ad" defaultValue={x.ad} className={`w-auto flex-1 uppercase ${x.aktif ? "" : "text-zinc-400 line-through"}`} aria-label="Ad" />
                    </AyarFormu>
                  </div>
                  <span className="w-14 pt-2 text-right text-xs text-zinc-500">{x._count.urunler} ürün</span>
                  <div className="pt-2"><AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, tur, x.id)} /></div>
                </li>
              ))}
              {!liste.length && <li className="text-sm text-zinc-500">Henüz kayıt yok.</li>}
            </ul>
            <AyarFormu eylem={urunTanimEkle.bind(null, tur)}><Girdi name="ad" placeholder={ipucu} className="w-auto flex-1 uppercase" required /></AyarFormu>
          </Kart>
        ))}

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
