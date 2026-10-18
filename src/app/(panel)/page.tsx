import Link from "next/link";
import type { ReactNode } from "react";
import { Hucre, Kart, SayfaBaslik, Secim, Girdi, Tablo } from "@/components/ui";
import { KONDISYON_AD, tl } from "@/lib/bicim";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { panoVerisi } from "@/lib/pano";
import { DONEM_AD, donemAraligi, trKunye, type Donem } from "@/lib/panoHesap";
import { Trend } from "./Trend";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const sayi = (n: number) => n.toLocaleString("tr-TR");
const yuzde = (n: number | null) => (n === null ? "-" : `${n < 0 ? "−" : ""}%${Math.abs(n).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`);
const kisa = (n: number) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} mn ₺` : tl(n));

function Gosterge({ ad, deger, alt, href }: { ad: string; deger: ReactNode; alt?: ReactNode; href?: string }) {
  const ic = (
    <Kart className={href ? "h-full hover:border-zinc-400" : "h-full"}>
      <p className="text-xs text-zinc-500">{ad}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{deger}</p>
      {alt && <p className="mt-1 text-xs text-zinc-500">{alt}</p>}
    </Kart>
  );
  return href ? <Link href={href}>{ic}</Link> : ic;
}

function Ilerleme({ oran }: { oran: number }) {
  const o = Math.min(Math.max(oran, 0), 1);
  return (
    <div className="h-2 w-full rounded-full bg-zinc-100" role="meter" aria-valuenow={Math.round(oran * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-2 rounded-full ${oran >= 1 ? "bg-green-600" : "bg-blue-600"}`} style={{ width: `${o * 100}%` }} />
    </div>
  );
}

export default async function Pano({ searchParams }: { searchParams: Promise<{ donem?: string; bas?: string; bit?: string; esik?: string }> }) {
  const k = await yetkiIste();
  const p = await searchParams;
  const donem = (Object.keys(DONEM_AD).includes(p.donem ?? "") ? p.donem : "ay") as Donem;
  const { bas, bit } = donemAraligi(donem, new Date(), { bas: p.bas, bit: p.bit });
  const oluEsik = [60, 90, 120, 180].includes(Number(p.esik)) ? Number(p.esik) : 90;
  const maliyet = maliyetGorur(k);
  const satisRolu = k.rol === "SATIS";
  const satisGorur = k.rol !== "DEPO" && k.rol !== "SERVIS";
  const v = await panoVerisi({ bas, bit, saticiId: satisRolu ? k.id : undefined, maliyet, oluEsik, dusukMarj: 5 });
  const o = v.ozet;

  // grafik: 62 günden kısa dönemde günlük, uzunda aylık sütun
  const basGun = trKunye(new Date(bas.getTime() + 1));
  const gunSayisi = Math.round((bit.getTime() - bas.getTime()) / 86_400_000);
  const kovalar = gunSayisi <= 62
    ? [...Array(gunSayisi)].map((_, i) => {
        const g = new Date(basGun.getTime() + i * 86_400_000);
        const anahtar = g.toISOString().slice(0, 10);
        const d = v.gunluk.find((x) => x.gun === anahtar);
        return { etiket: String(g.getUTCDate()), ipucu: g.toLocaleDateString("tr-TR", { timeZone: "UTC" }), ciro: d?.ciro ?? 0, adet: d?.adet ?? 0 };
      })
    : (() => {
        const aylar = new Map<string, { etiket: string; ipucu: string; ciro: number; adet: number }>();
        for (let g = new Date(basGun); g < bit; g = new Date(Date.UTC(g.getUTCFullYear(), g.getUTCMonth() + 1, 1))) {
          aylar.set(g.toISOString().slice(0, 7), { etiket: AYLAR[g.getUTCMonth()], ipucu: `${AYLAR[g.getUTCMonth()]} ${g.getUTCFullYear()}`, ciro: 0, adet: 0 });
        }
        for (const d of v.gunluk) { const a = aylar.get(d.gun.slice(0, 7)); if (a) { a.ciro += d.ciro; a.adet += d.adet; } }
        return [...aylar.values()];
      })();

  const hedefOzet = v.hedefler.reduce((t, h) => ({ adet: t.adet + h.adet, hedefAdet: t.hedefAdet + h.hedefAdet, ciro: t.ciro + h.ciro, hedefCiro: t.hedefCiro + h.hedefCiro }), { adet: 0, hedefAdet: 0, ciro: 0, hedefCiro: 0 });

  return (
    <>
      <SayfaBaslik baslik={satisRolu ? `Merhaba, ${k.adSoyad}` : "Pano"} aciklama={satisRolu ? "Kendi satışlarınız, hedefiniz ve alacaklarınız" : undefined} />

      <form className="mb-5 flex flex-wrap items-end gap-2">
        <label className="text-xs text-zinc-500">
          Dönem
          <Secim name="donem" defaultValue={donem} className="mt-1 w-40">
            {Object.entries(DONEM_AD).map(([a, ad]) => <option key={a} value={a}>{ad}</option>)}
          </Secim>
        </label>
        <label className="text-xs text-zinc-500">Başlangıç<Girdi type="date" name="bas" defaultValue={p.bas} className="mt-1 w-40" /></label>
        <label className="text-xs text-zinc-500">Bitiş<Girdi type="date" name="bit" defaultValue={p.bit} className="mt-1 w-40" /></label>
        <label className="text-xs text-zinc-500">
          Ölü stok eşiği
          <Secim name="esik" defaultValue={String(oluEsik)} className="mt-1 w-32">
            {[60, 90, 120, 180].map((g) => <option key={g} value={g}>{g} gün</option>)}
          </Secim>
        </label>
        <button className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-sm hover:bg-zinc-50">Uygula</button>
        <span className="pb-2 text-xs text-zinc-500">{bas.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} – {new Date(bit.getTime() - 1).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} · Başlangıç/bitiş yalnızca &quot;Özel aralık&quot;ta kullanılır</span>
      </form>

      {satisGorur && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Gosterge ad={satisRolu ? "Cirom" : "Ciro"} deger={kisa(o.ciro)} alt={`Araç ${kisa(o.aracCiro)} · hızlı ${kisa(o.hizliCiro)}`} href="/satislar" />
            <Gosterge ad="Satılan araç" deger={sayi(o.aracAdet)} alt={`${sayi(o.hizliAdet)} hızlı satış`} />
            {maliyet ? (
              <Gosterge ad="Kâr (araç)" deger={kisa(o.kar ?? 0)} alt={`Kârlılık ${yuzde(o.marj)} · maliyeti girilmiş araçlar`} />
            ) : (
              <Gosterge ad="Açık teklif" deger={sayi(o.teklifAcikAdet)} alt={kisa(o.teklifAcikTutar)} href="/teklifler?durum=ACIK" />
            )}
            <Gosterge ad="Tahsilat" deger={kisa(o.tahsilat)} alt="İade ödemeleri düşülmüş" href="/tahsilat" />
            <Gosterge ad="Açık alacak" deger={kisa(o.acikAlacak)} alt={`${sayi(o.acikAlacakAdet)} satış · bugün itibarıyla`} href="/tahsilat" />
            <Gosterge ad="Vadesi geçen senet/çek" deger={o.vadesiGecenAdet ? <span className="text-red-700">{kisa(o.vadesiGecen)}</span> : "-"} alt={`${sayi(o.vadesiGecenAdet)} adet`} href="/tahsilat" />
            {maliyet && <Gosterge ad="Açık teklif" deger={sayi(o.teklifAcikAdet)} alt={kisa(o.teklifAcikTutar)} href="/teklifler?durum=ACIK" />}
            <Gosterge ad="Teklif dönüşümü" deger={yuzde(o.teklifDonusum)} alt={`Dönemde ${sayi(o.teklifDonem)} teklif · sonuçlananlar içinde`} />
          </div>

          <Kart baslik="Ciro" className="mt-4" sag={<span className="text-xs text-zinc-500">{gunSayisi <= 62 ? "Günlük" : "Aylık"} · üzerine gelince ayrıntı</span>}>
            {o.ciro ? <Trend kovalar={kovalar} /> : <p className="py-8 text-center text-sm text-zinc-500">Bu dönemde satış yok.</p>}
          </Kart>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Kart baslik="Bu ayın hedefleri" sag={k.rol === "YONETICI" ? <Link href="/ayarlar/hedefler" className="text-xs text-zinc-600 hover:underline">Hedefleri düzenle</Link> : <span className="text-xs text-zinc-500">Kayıtlı hedef yoksa son 3 tam ay × 1,10</span>}>
              {v.hedefler.length ? (
                <div className="space-y-3">
                  {v.hedefler.map((h) => (
                    <div key={h.id} className="text-sm">
                      <div className="flex justify-between"><span className="font-medium">{h.ad}{!h.kayitli && <span className="ml-1 text-xs font-normal text-zinc-500">(öneri)</span>}</span><span className="tabular-nums text-zinc-600">{h.adet} / {h.hedefAdet} araç · {kisa(h.ciro)} / {kisa(h.hedefCiro)}</span></div>
                      <div className="mt-1 grid grid-cols-2 gap-2"><Ilerleme oran={h.adet / h.hedefAdet} /><Ilerleme oran={h.hedefCiro ? h.ciro / h.hedefCiro : 0} /></div>
                    </div>
                  ))}
                  {v.hedefler.length > 1 && <p className="border-t border-zinc-100 pt-2 text-xs text-zinc-500">Toplam: {hedefOzet.adet} / {hedefOzet.hedefAdet} araç · {kisa(hedefOzet.ciro)} / {kisa(hedefOzet.hedefCiro)}</p>}
                </div>
              ) : <p className="text-sm text-zinc-500">Aktif satış personeli yok.</p>}
            </Kart>

            <Kart baslik="Kampanya önerileri" sag={<span className="text-xs text-zinc-500">Ölü stoktan üretilir</span>}>
              {v.oneriler.length ? (
                <ul className="space-y-3">
                  {v.oneriler.map((x) => <li key={x.baslik} className="text-sm"><p className="font-medium">{x.baslik}</p><p className="text-zinc-600">{x.aciklama}</p></li>)}
                </ul>
              ) : <p className="text-sm text-zinc-500">{oluEsik} günü geçen stok yok; öneri üretilmedi.</p>}
            </Kart>
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold">Model bazında araç satışı</h2>
          <Tablo basliklar={["Model", "Adet", "Ciro", ...(maliyet ? ["Kâr", "Kârlılık"] : []), "Ort. satış süresi"]} bos={!v.markalar.length}>
            {v.markalar.map((m) => (
              <tr key={m.ad}>
                <Hucre>{m.ad}</Hucre><Hucre>{m.adet}</Hucre><Hucre>{tl(m.ciro)}</Hucre>
                {maliyet && <><Hucre>{tl(m.kar)}</Hucre><Hucre>{yuzde(m.ciro ? (m.kar / m.ciro) * 100 : null)}</Hucre></>}
                <Hucre>{m.sureAdet ? `${Math.round(m.sureToplam / m.sureAdet)} gün` : "-"}</Hucre>
              </tr>
            ))}
          </Tablo>

          {!satisRolu && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold">Personel</h2>
              <Tablo basliklar={["Satıcı", "Araç", "Ciro", "Hızlı satış", ...(maliyet ? ["Kâr"] : []), "Ort. satış süresi"]} bos={!v.personel.length}>
                {v.personel.map((x) => (
                  <tr key={x.ad}>
                    <Hucre>{x.ad}</Hucre><Hucre>{x.adet}</Hucre><Hucre>{tl(x.ciro)}</Hucre><Hucre>{tl(x.hizliCiro)}</Hucre>
                    {maliyet && <Hucre>{tl(x.kar)}</Hucre>}
                    <Hucre>{x.sureAdet ? `${Math.round(x.sureToplam / x.sureAdet)} gün` : "-"}</Hucre>
                  </tr>
                ))}
              </Tablo>
            </>
          )}

          {maliyet && v.dusukMarjlar.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold">Kârlılığı %5&apos;in altında kalan satışlar</h2>
              <Tablo basliklar={["Form no", "Model", "Ciro", "Kâr", "Kârlılık"]}>
                {v.dusukMarjlar.map((x) => (
                  <tr key={x.id}>
                    <Hucre><Link href={`/satislar/${x.id}`} className="hover:underline">{x.formNo}</Link></Hucre><Hucre>{x.ad}</Hucre><Hucre>{tl(x.ciro)}</Hucre>
                    <Hucre className={x.kar < 0 ? "text-red-700" : ""}>{tl(x.kar)}</Hucre><Hucre>{yuzde(x.marj)}</Hucre>
                  </tr>
                ))}
              </Tablo>
            </>
          )}
        </>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold">Stok · bugün</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Gosterge ad="Stoktaki araç" deger={sayi(o.stokAdet)} alt={`${sayi(o.rezerveAdet)} rezerve`} href="/araclar" />
        {maliyet && <Gosterge ad="Stok değeri (maliyet)" deger={kisa(o.stokDeger ?? 0)} alt="Stokta ve rezerve" />}
        <Gosterge ad="Ortalama bekleme" deger={`${sayi(o.ortBekleme)} gün`} alt="Geliş tarihinden bugüne" />
        <Gosterge ad={`Ölü stok (${oluEsik}+ gün)`} deger={v.olu.length ? <span className="text-amber-700">{sayi(v.olu.length)}</span> : "0"} alt={maliyet ? kisa(v.olu.reduce((t, a) => t + a.deger, 0)) : undefined} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_2fr]">
        <Tablo basliklar={["Konum", "Araç", ...(maliyet ? ["Değer"] : []), "Ölü stok"]} bos={!v.konumlar.length}>
          {v.konumlar.map((x) => (
            <tr key={x.ad}><Hucre>{x.ad}</Hucre><Hucre>{x.adet}</Hucre>{maliyet && <Hucre>{kisa(x.deger)}</Hucre>}<Hucre>{x.olu || "-"}</Hucre></tr>
          ))}
        </Tablo>
        <Tablo basliklar={["Ölü stok", "Şase", "Konum", "Kondisyon", "Bekleme", ...(maliyet ? ["Maliyet"] : [])]} bos={!v.olu.length}>
          {v.olu.slice(0, 15).map((a) => (
            <tr key={a.id}>
              <Hucre>{a.ad}</Hucre><Hucre><Link href={`/araclar/${a.id}`} className="font-mono hover:underline">{a.sase}</Link></Hucre><Hucre>{a.konum}</Hucre>
              <Hucre>{KONDISYON_AD[a.kondisyon]}</Hucre><Hucre className={a.gun >= 180 ? "text-red-700" : "text-amber-700"}>{a.gun} gün</Hucre>
              {maliyet && <Hucre>{tl(a.deger)}</Hucre>}
            </tr>
          ))}
        </Tablo>
      </div>
      {v.olu.length > 15 && <p className="mt-1 text-xs text-zinc-500">En uzun bekleyen 15 araç gösteriliyor.</p>}
    </>
  );
}
