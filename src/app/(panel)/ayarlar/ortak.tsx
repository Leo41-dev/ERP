import type { ReactNode } from "react";
import { Alan, Girdi, Kart, MetinAlani } from "@/components/ui";
import { BELGE_AYARLARI, belgeAyarlari, type BelgeAyarAnahtari } from "@/lib/belgeAyarlari";
import { aktiflikDegistir, belgeAyarKaydet, urunTanimAdDegistir, urunTanimEkle } from "./eylem";
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
            <div className="pt-2"><AktiflikButonu aktif={x.aktif} eylem={aktiflikDegistir.bind(null, tur, x.id)} /></div>
          </li>
        ))}
        {!liste.length && <li className="text-sm text-zinc-500">Henüz kayıt yok.</li>}
      </ul>
      <AyarFormu eylem={urunTanimEkle.bind(null, tur)}><Girdi name="ad" placeholder={ipucu} className="w-auto flex-1 uppercase" required /></AyarFormu>
    </Kart>
  );
}
