import { Girdi, Kart, SayfaBaslik, Secim } from "@/components/ui";
import { tl } from "@/lib/bicim";
import { analizVerisi } from "@/lib/analiz";
import type { KolonTur, Tablo } from "@/lib/analizHesap";
import { yetkiIste } from "@/lib/oturum";
import { DONEM_AD, donemAraligi, type Donem } from "@/lib/panoHesap";

function bicim(v: string | number | null, tur: KolonTur) {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v;
  if (tur === "tl") return tl(v);
  if (tur === "yuzde") return `${v < 0 ? "−" : ""}%${Math.abs(v).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
  if (tur === "gun") return `${Math.round(v).toLocaleString("tr-TR")} gün`;
  return v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

const GENIS = ["yaslandirma-marka", "konum-marka", "abc"];

function AnalizTablosu({ t, sorgu }: { t: Tablo; sorgu: string }) {
  const enCok = t.cubuk !== undefined ? Math.max(...t.satirlar.map((r) => Math.abs(Number(r[t.cubuk!]) || 0)), 1) : 1;
  return (
    <Kart
      baslik={t.baslik}
      className={GENIS.includes(t.anahtar) ? "xl:col-span-2" : ""}
      sag={<a href={`/analiz/csv?tablo=${t.anahtar}&${sorgu}`} className="text-xs text-zinc-600 hover:underline">{"Excel'e aktar (CSV)"}</a>}
    >
      <p id={t.anahtar} className="-mt-1 mb-3 text-xs text-zinc-500">{t.aciklama}</p>
      {t.satirlar.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>{t.kolonlar.map((k, i) => <th key={k.ad + i} className={`whitespace-nowrap px-2 py-1.5 font-medium ${k.tur === "metin" ? "" : "text-right"}`}>{k.ad}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {t.satirlar.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => {
                    const tur = t.kolonlar[j].tur;
                    return (
                      <td key={j} className={`whitespace-nowrap px-2 py-1.5 tabular-nums ${tur === "metin" ? "" : "text-right"} ${typeof v === "number" && v < 0 ? "text-red-700" : ""}`}>
                        {j === t.cubuk ? (
                          <span className="flex items-center justify-end gap-2">
                            <span className="hidden h-2 w-28 rounded-full bg-zinc-100 sm:block"><span className="block h-2 rounded-full bg-blue-600" style={{ width: `${(Math.abs(Number(v) || 0) / enCok) * 100}%` }} /></span>
                            {bicim(v, tur)}
                          </span>
                        ) : bicim(v, tur)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="py-4 text-center text-sm text-zinc-500">Bu dönemde veri yok.</p>}
    </Kart>
  );
}

export default async function Analiz({ searchParams }: { searchParams: Promise<{ donem?: string; bas?: string; bit?: string }> }) {
  await yetkiIste("MUHASEBE");
  const p = await searchParams;
  const donem = (Object.keys(DONEM_AD).includes(p.donem ?? "") ? p.donem : "365") as Donem;
  const { bas, bit } = donemAraligi(donem, new Date(), { bas: p.bas, bit: p.bit });
  const tablolar = await analizVerisi(bas, bit);
  const sorgu = new URLSearchParams({ donem, ...(donem === "ozel" ? { bas: p.bas ?? "", bit: p.bit ?? "" } : {}) }).toString();
  const gruplar: [string, string[]][] = [
    ["Stok", ["yaslandirma", "fiyat-bandi", "yaslandirma-marka", "konum-marka"]],
    ["Satış", ["satis-suresi", "satis-suresi-model", "abc", "mevsimsellik", "otv"]],
    ["Kârlılık ve tedarik", ["marj", "tedarikci"]],
    ["Teklif", ["teklif", "ret-nedenleri"]],
  ];
  return (
    <>
      <SayfaBaslik baslik="Analiz merkezi" aciklama="Stok verileri bugünkü durumu, satış ve teklif verileri seçilen dönemi gösterir. Her tablo Excel'e aktarılabilir." />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-zinc-500">Dönem
          <Secim name="donem" defaultValue={donem} className="mt-1 w-40">{Object.entries(DONEM_AD).map(([a, ad]) => <option key={a} value={a}>{ad}</option>)}</Secim>
        </label>
        <label className="text-xs text-zinc-500">Başlangıç<Girdi type="date" name="bas" defaultValue={p.bas} className="mt-1 w-40" /></label>
        <label className="text-xs text-zinc-500">Bitiş<Girdi type="date" name="bit" defaultValue={p.bit} className="mt-1 w-40" /></label>
        <button className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-sm hover:bg-zinc-50">Uygula</button>
        <span className="pb-2 text-xs text-zinc-500">{bas.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} – {new Date(bit.getTime() - 1).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}</span>
      </form>
      <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {gruplar.flatMap(([, l]) => l).map((a) => { const t = tablolar.find((x) => x.anahtar === a)!; return <a key={a} href={`#${a}`} className="text-zinc-600 hover:underline">{t.baslik}</a>; })}
      </nav>
      {gruplar.map(([ad, l]) => (
        <section key={ad} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{ad}</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {l.map((a) => <AnalizTablosu key={a} t={tablolar.find((x) => x.anahtar === a)!} sorgu={sorgu} />)}
          </div>
        </section>
      ))}
    </>
  );
}
