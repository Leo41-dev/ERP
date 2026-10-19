import { SilButonu } from "@/components/SilButonu";
import type { ReactNode } from "react";
import { Alan, Girdi, Kart, MetinAlani, Secim } from "@/components/ui";
import { BELGE_AYARLARI, belgeAyarlari, type BelgeAyarAnahtari } from "@/lib/belgeAyarlari";
import { VERGI_HESAP_AD, vergiDegerYaz, vergiDegerYazi, type VergiHesapTuru } from "@/lib/vergiHesap";
import { aktiflikDegistir, belgeAyarKaydet, urunTanimAdDegistir, urunTanimEkle, vergiTanimKaydet } from "./eylem";
import { AktiflikButonu, AyarFormu } from "./Formlar";

export function Liste({ ogeler }: { ogeler: { id: number; ad: string; aktif?: boolean; sag?: ReactNode }[] }) {
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

/** Bölümün yazdırılan belge metinleri; yalnızca verilen anahtarlar kaydedilir, diğer bölümlerinkine dokunulmaz. */
export async function BelgeAyarKarti({ baslik, anahtarlar }: { baslik: string; anahtarlar: BelgeAyarAnahtari[] }) {
  const belge = await belgeAyarlari();
  return (
    <Kart baslik={baslik} sag={<span className="text-xs text-zinc-500">Boş bırakılan alan varsayılana döner</span>}>
      <AyarFormu eylem={belgeAyarKaydet} buton="Kaydet" className="grid gap-2">
        {anahtarlar.map((a) => {
          const t = BELGE_AYARLARI[a];
          return (
            <Alan key={a} etiket={t.ad}>
              {t.cokSatir ? <MetinAlani name={a} rows={3} defaultValue={belge[a]} placeholder={t.varsayilan} /> : <Girdi name={a} defaultValue={belge[a]} placeholder={t.varsayilan} />}
            </Alan>
          );
        })}
      </AyarFormu>
    </Kart>
  );
}

/** Adı değiştirilebilen, pasif yapılabilen basit tanım listesi (ürün grubu, ürün markası) */
export function TanimKarti({ tur, baslik, ipucu, liste }: { tur: "urunGrubu" | "urunMarkasi"; baslik: string; ipucu: string; liste: { id: number; ad: string; aktif: boolean; _count: { urunler: number } }[] }) {
  return (
    <Kart baslik={baslik} sag={<span className="text-xs text-zinc-500">Ürün kartlarında seçilir</span>}>
      <ul className="mb-3 space-y-1.5">
        {liste.map((x) => (
          <li key={x.id} className="flex items-start gap-2">
            <div className="flex-1">
              <AyarFormu eylem={urunTanimAdDegistir.bind(null, tur, x.id)} buton="Kaydet">
                <Girdi name="ad" defaultValue={x.ad} className={`w-auto flex-1 uppercase ${x.aktif ? "" : "text-zinc-400 line-through"}`} aria-label="Ad" />
              </AyarFormu>
            </div>
            <span className="w-14 pt-2 text-right text-xs text-zinc-500">{x._count.urunler} ürün</span>
            <div className="flex gap-3 pt-2"><AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, tur, x.id)} /><SilButonu kucuk tur={tur} id={x.id} ad={x.ad} /></div>
          </li>
        ))}
        {!liste.length && <li className="text-sm text-zinc-500">Henüz kayıt yok.</li>}
      </ul>
      <AyarFormu eylem={urunTanimEkle.bind(null, tur)}><Girdi name="ad" placeholder={ipucu} className="w-auto flex-1 uppercase" required /></AyarFormu>
    </Kart>
  );
}

type VergiSatiri = { id: number; ad: string; kod: string | null; hesap: VergiHesapTuru; deger: number; kdvMatrahina: boolean; kesinti: boolean; aciklama: string | null; aktif: boolean };

function VergiAlanlari({ v }: { v?: VergiSatiri }) {
  return (
    <>
      <Girdi name="ad" defaultValue={v?.ad} placeholder="Ad (ör. ÖİV)" className="!w-40" required aria-label="Ad" />
      <Girdi name="kod" defaultValue={v?.kod ?? ""} placeholder="GİB kodu" className="!w-24" aria-label="GİB vergi kodu" />
      <Secim name="hesap" defaultValue={v?.hesap ?? "YUZDE"} className="!w-52" aria-label="Hesap şekli">
        {(Object.keys(VERGI_HESAP_AD) as VergiHesapTuru[]).map((h) => <option key={h} value={h}>{VERGI_HESAP_AD[h]}</option>)}
      </Secim>
      <Girdi name="deger" defaultValue={v ? String(vergiDegerYaz(v.hesap, v.deger)).replace(".", ",") : ""} placeholder="% ya da ₺" inputMode="decimal" className="!w-24" required aria-label="Oran ya da tutar" />
      <label className="flex items-center gap-1 text-xs text-zinc-600"><input type="checkbox" name="kdvMatrahina" defaultChecked={v?.kdvMatrahina} /> KDV matrahına girer</label>
      <label className="flex items-center gap-1 text-xs text-zinc-600"><input type="checkbox" name="kesinti" defaultChecked={v?.kesinti} /> Kesinti (tahsilattan düşer)</label>
    </>
  );
}

/** KDV ve ÖTV dışındaki vergiler: ÖİV, konaklama, damga, maktu vergiler, tevkifat, stopaj */
export function VergiTanimKarti({ liste }: { liste: VergiSatiri[] }) {
  return (
    <Kart baslik="Diğer vergiler" className="lg:col-span-2" sag={<span className="text-xs text-zinc-500">Ürün kartında seçilir; oran ve kodları mali müşavirinizle teyit edin</span>}>
      <ul className="mb-4 space-y-2">
        {liste.map((v) => (
          <li key={v.id} className={`flex items-start gap-2 ${v.aktif ? "" : "opacity-50"}`}>
            <div className="flex-1">
              <AyarFormu eylem={vergiTanimKaydet.bind(null, v.id)} buton="Kaydet"><VergiAlanlari v={v} /></AyarFormu>
              <p className="mt-1 text-xs text-zinc-500">{vergiDegerYazi(v.hesap, v.deger)} · {v.kdvMatrahina ? "KDV matrahına girer" : v.kesinti ? "toplama girmez, tahsil edilecekten düşer" : "KDV matrahına girmez, toplama eklenir"}</p>
            </div>
            <div className="flex gap-3 pt-2"><AktiflikButonu aktif={v.aktif} eylem={aktiflikDegistir.bind(null, "vergiTanimi", v.id)} /><SilButonu kucuk tur="vergiTanimi" id={v.id} ad={v.ad} /></div>
          </li>
        ))}
        {!liste.length && <li className="text-sm text-zinc-500">Henüz tanım yok. Örnek: ÖİV (%, KDV matrahına girer), konaklama vergisi (%), maktu vergi (birim başına ₺), KDV tevkifatı (5/10 için 50), stopaj (%, kesinti).</li>}
      </ul>
      <AyarFormu eylem={vergiTanimKaydet.bind(null, null)} buton="Vergi ekle"><VergiAlanlari /></AyarFormu>
    </Kart>
  );
}
