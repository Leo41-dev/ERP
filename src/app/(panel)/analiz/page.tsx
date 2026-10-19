import { Girdi, Kart, SayfaBaslik, Secim } from "@/components/ui";
import { tl } from "@/lib/bicim";
import { analizVerisi } from "@/lib/analiz";
import type { KolonTur, Tablo } from "@/lib/analizHesap";
import { yetkiIste } from "@/lib/oturum";
import { DONEM_AD, donemAraligi, type Donem } from "@/lib/panoHesap";
import { kisa } from "./bicim";
import { Grafik, type GrafikVeri } from "./Grafik";
const kisaTl = (n: number) => kisa(n, "tl");

function bicim(v: string | number | null, tur: KolonTur) {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v;
  if (tur === "tl") return tl(v);
  if (tur === "yuzde") return `${v < 0 ? "−" : ""}%${Math.abs(v).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
  if (tur === "gun") return `${Math.round(v).toLocaleString("tr-TR")} gün`;
  return v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

const GENIS = ["yaslandirma-marka", "konum-marka", "abc", "mevsimsellik"];

// renkler: kategorik sıra mavi, turuncu, su yeşili, sarı, pembe, yeşil, mor, kırmızı; yaş kovaları için açık→koyu mavi
const KATEGORIK = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const SIRALI = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];
const MAVI = KATEGORIK[0], GRI = "#b4b2aa", KRITIK = "#d03b3b";
const ENCOK_SATIR = 12;

const sayi = (v: string | number | null) => (typeof v === "number" ? v : null);
const ipucu = (t: Tablo, satirlar = t.satirlar) => satirlar.map((r) => r.slice(1).map((v, j) => `${t.kolonlar[j + 1].ad}: ${bicim(v, t.kolonlar[j + 1].tur)}`));
const kolon = (satirlar: Tablo["satirlar"], j: number) => satirlar.map((r) => sayi(r[j]));
const ad = (satirlar: Tablo["satirlar"]) => satirlar.map((r) => String(r[0]));

/** Her analiz tablosu için verinin işine uyan grafik: dağılımlar dikey, uzun adlı listeler yatay çubuk. */
function grafikVerisi(t: Tablo): GrafikVeri | null {
  const r = t.satirlar;
  if (!r.length) return null;
  const tek = (j: number, yon: "dikey" | "yatay", birim: GrafikVeri["birim"], ek: Partial<GrafikVeri> = {}, satirlar = r): GrafikVeri => ({
    yon, birim, kategoriler: ad(satirlar), seriler: [{ ad: t.kolonlar[j].ad, degerler: kolon(satirlar, j), renk: MAVI }], ipucu: ipucu(t, satirlar), ...ek,
  });
  switch (t.anahtar) {
    case "yaslandirma":
      return tek(1, "dikey", "adet", { kategoriRenk: SIRALI });
    case "satis-suresi":
      return tek(1, "dikey", "adet");
    case "marj":
      return tek(1, "dikey", "adet", { kategoriRenk: r.map((x) => (x[0] === "Zarar" ? KRITIK : null)) });
    case "teklif":
    case "ret-nedenleri":
      return tek(1, "yatay", "adet");
    case "satis-suresi-model":
      return tek(2, "yatay", "gun", {}, r.slice(0, ENCOK_SATIR));
    case "abc": {
      const s = r.slice(0, ENCOK_SATIR);
      const sinif = { A: SIRALI[4], B: SIRALI[2], C: SIRALI[0] } as Record<string, string>;
      return tek(3, "yatay", "tl", { kategoriRenk: s.map((x) => sinif[String(x[1])]), lejant: [{ ad: "A sınıfı", renk: sinif.A }, { ad: "B sınıfı", renk: sinif.B }, { ad: "C sınıfı", renk: sinif.C }] }, s);
    }
    case "mevsimsellik":
      return {
        yon: "dikey", birim: "adet", kategoriler: r.map((x) => String(x[0]).replace(/ 20(\d\d)$/, " $1")), ipucu: ipucu(t),
        seriler: [{ ad: "Bu yıl", degerler: kolon(r, 1), renk: MAVI }, { ad: "Geçen yıl aynı ay", degerler: kolon(r, 3), renk: GRI }],
      };
    case "fiyat-bandi":
      return { yon: "dikey", birim: "adet", kategoriler: ad(r), ipucu: ipucu(t), seriler: [{ ad: "Stokta", degerler: kolon(r, 1), renk: KATEGORIK[0] }, { ad: "Dönemde satılan", degerler: kolon(r, 2), renk: KATEGORIK[1] }] };
    case "tedarikci": {
      const s = r.slice(0, ENCOK_SATIR);
      return { yon: "yatay", birim: "adet", kategoriler: ad(s), ipucu: ipucu(t, s), seriler: [{ ad: "Dönemde satılan", degerler: kolon(s, 2), renk: KATEGORIK[0] }, { ad: "Stokta", degerler: kolon(s, 1), renk: KATEGORIK[1] }] };
    }
    case "otv":
      return {
        yon: "dikey", birim: "tl", yigin: true, kategoriler: ad(r), ipucu: ipucu(t),
        seriler: [{ ad: "ÖTV hariç ciro", degerler: r.map((x) => (sayi(x[2]) ?? 0) - (sayi(x[3]) ?? 0)), renk: KATEGORIK[0] }, { ad: "ÖTV", degerler: kolon(r, 3), renk: KATEGORIK[1] }],
      };
    case "yaslandirma-marka": {
      const s = r.slice(0, ENCOK_SATIR);
      return { yon: "yatay", birim: "adet", yigin: true, kategoriler: ad(s), ipucu: ipucu(t, s), seriler: SIRALI.map((renk, i) => ({ ad: t.kolonlar[i + 1].ad, degerler: kolon(s, i + 1), renk })) };
    }
    case "konum-marka": {
      // en çok 7 marka ayrı renk alır, kalanı "Diğer"de toplanır
      const markalar = t.kolonlar.slice(1, -1).map((k, i) => ({ ad: k.ad, j: i + 1, top: r.reduce((x, y) => x + (sayi(y[i + 1]) ?? 0), 0) }));
      const sirali = [...markalar].sort((a, b) => b.top - a.top);
      const ayri = markalar.length > 8 ? sirali.slice(0, 7) : sirali;
      const diger = markalar.filter((m) => !ayri.includes(m));
      return {
        yon: "yatay", birim: "adet", yigin: true, kategoriler: ad(r), ipucu: ipucu(t),
        seriler: [
          ...ayri.map((m, i) => ({ ad: m.ad, degerler: kolon(r, m.j), renk: KATEGORIK[i] })),
          ...(diger.length ? [{ ad: "Diğer", degerler: r.map((x) => diger.reduce((a, m) => a + (sayi(x[m.j]) ?? 0), 0)), renk: GRI }] : []),
        ],
      };
    }
  }
  return null;
}

function AnalizKarti({ t, sorgu }: { t: Tablo; sorgu: string }) {
  const g = grafikVerisi(t);
  const kesik = g && g.kategoriler.length < t.satirlar.length;
  return (
    <Kart
      baslik={t.baslik}
      className={GENIS.includes(t.anahtar) ? "xl:col-span-2" : ""}
      sag={<a href={`/analiz/csv?tablo=${t.anahtar}&${sorgu}`} className="text-xs text-zinc-600 hover:underline">{"Excel'e aktar (CSV)"}</a>}
    >
      <p id={t.anahtar} className="-mt-1 mb-3 scroll-mt-4 text-xs text-zinc-500">{t.aciklama}{kesik ? ` Grafikte ilk ${g.kategoriler.length} satır, tamamı tabloda.` : ""}</p>
      {t.satirlar.length ? (
        <>
          {g && <Grafik v={g} />}
          <details className="mt-3 group" open={!g}>
            <summary className="cursor-pointer select-none text-xs text-zinc-500 hover:text-zinc-800">{g ? "Tabloyu göster" : "Tablo"}</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>{t.kolonlar.map((k, i) => <th key={k.ad + i} className={`whitespace-nowrap px-2 py-1.5 font-medium ${k.tur === "metin" ? "" : "text-right"}`}>{k.ad}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {t.satirlar.map((r, i) => (
                    <tr key={i}>
                      {r.map((v, j) => (
                        <td key={j} className={`whitespace-nowrap px-2 py-1.5 tabular-nums ${t.kolonlar[j].tur === "metin" ? "" : "text-right"} ${typeof v === "number" && v < 0 ? "text-red-700" : ""}`}>{bicim(v, t.kolonlar[j].tur)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : <p className="py-4 text-center text-sm text-zinc-500">Bu dönemde veri yok.</p>}
    </Kart>
  );
}

function Ozet({ ad, deger, alt }: { ad: string; deger: string; alt?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs text-zinc-500">{ad}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{deger}</p>
      {alt && <p className="mt-0.5 text-xs text-zinc-500">{alt}</p>}
    </div>
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
  const bul = (a: string) => tablolar.find((x) => x.anahtar === a)!;
  const topla = (a: string, j: number) => bul(a).satirlar.reduce((t, r) => t + (sayi(r[j]) ?? 0), 0);
  const stokAdet = topla("yaslandirma", 1), satilan = topla("satis-suresi", 1);
  const yasli = bul("yaslandirma").satirlar.slice(3).reduce((t, r) => t + (sayi(r[1]) ?? 0), 0);
  const teklif = bul("teklif").satirlar;
  const teklifSayi = sayi(teklif[0]?.[1]) ?? 0, donen = sayi(teklif[teklif.length - 1]?.[1]) ?? 0;
  return (
    <>
      <SayfaBaslik baslik="Analiz merkezi" aciklama="Stok verileri bugünkü durumu, satış ve teklif verileri seçilen dönemi gösterir. Grafiklerin üzerine gelince ayrıntı görünür; lejanttaki bir seriye tıklayınca gizlenir." />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-zinc-500">Dönem
          <Secim name="donem" defaultValue={donem} className="mt-1 w-40">{Object.entries(DONEM_AD).map(([a, ad]) => <option key={a} value={a}>{ad}</option>)}</Secim>
        </label>
        <label className="text-xs text-zinc-500">Başlangıç<Girdi type="date" name="bas" defaultValue={p.bas} className="mt-1 w-40" /></label>
        <label className="text-xs text-zinc-500">Bitiş<Girdi type="date" name="bit" defaultValue={p.bit} className="mt-1 w-40" /></label>
        <button className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-sm hover:bg-zinc-50">Uygula</button>
        <span className="pb-2 text-xs text-zinc-500">{bas.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} – {new Date(bit.getTime() - 1).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}</span>
      </form>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Ozet ad="Stoktaki araç" deger={stokAdet.toLocaleString("tr-TR")} alt={`${yasli} araç 90 günden eski`} />
        <Ozet ad="Stok değeri (maliyet)" deger={kisaTl(topla("yaslandirma", 3))} />
        <Ozet ad="Dönemde satılan araç" deger={satilan.toLocaleString("tr-TR")} alt={bul("satis-suresi").aciklama.match(/Medyan .*/)?.[0]} />
        <Ozet ad="Teklif dönüşümü" deger={teklifSayi ? `%${Math.round((donen / teklifSayi) * 100)}` : "-"} alt={`${teklifSayi} tekliften ${donen} satış`} />
      </div>
      <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {gruplar.flatMap(([, l]) => l).map((a) => { const t = bul(a); return <a key={a} href={`#${a}`} className="text-zinc-600 hover:underline">{t.baslik}</a>; })}
      </nav>
      {gruplar.map(([ad, l]) => (
        <section key={ad} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{ad}</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {l.map((a) => <AnalizKarti key={a} t={bul(a)} sorgu={sorgu} />)}
          </div>
        </section>
      ))}
    </>
  );
}
