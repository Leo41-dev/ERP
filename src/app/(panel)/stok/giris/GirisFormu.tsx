"use client";
import { useActionState, useState, useTransition } from "react";
import { sifirlamadan } from "@/components/form";
import { Alan, Buton, Girdi, HataKutusu, Kart, Secim } from "@/components/ui";
import { UrunSecici, type UrunBulunan } from "@/components/UrunSecici";
import { BIRIMLER } from "@/lib/dogrulama/urun";
import { sayi } from "@/lib/normalize";
import { girisKaydet, xmlOku, type XmlSatir } from "./eylem";

type Satir = {
  anahtar: number; urun: UrunBulunan | null; yazi: string; tur: string; birim: string; barkod: string; faturaAdi: string; esleme: string; eslesme?: XmlSatir["eslesme"]; miktar: string; fiyat: string; kdv: string;
};
const bos = (): Satir => ({ anahtar: Date.now() + Math.random(), urun: null, yazi: "", tur: "YEDEK_PARCA", birim: "Adet", barkod: "", faturaAdi: "", esleme: "", miktar: "1", fiyat: "", kdv: "0.2" });
const virgul = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 4, useGrouping: false });
const tl = (n: number) => n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const KDV = ["0.2", "0.1", "0.01", "0"];
const ESLESME: Record<string, string> = { kayitli: "önceki eşleme", barkod: "barkoddan", kod: "koddan", ad: "addan" };

export function GirisFormu({ tedarikciler, bugun }: { tedarikciler: { id: number; unvan: string }[]; bugun: string }) {
  const [durum, gonder, bekliyor] = useActionState(girisKaydet, undefined);
  const [okunuyor, baslat] = useTransition();
  const [xmlHata, setXmlHata] = useState<string | null>(null);
  const [uyarilar, setUyarilar] = useState<string[]>([]);
  const [satirlar, setSatirlar] = useState<Satir[]>([bos()]);
  const [tedarikciId, setTedarikciId] = useState("");
  const [yeniTed, setYeniTed] = useState({ unvan: "", vkn: "" });
  const [baslik, setBaslik] = useState({ faturaNo: "", tarih: bugun, kaynak: "ELLE", anahtar: 0 });
  const h = durum?.hatalar ?? {};

  const guncelle = (a: number, d: Partial<Satir>) => setSatirlar((l) => l.map((x) => (x.anahtar === a ? { ...x, ...d } : x)));
  const hesap = satirlar.map((x) => { const t = (sayi(x.miktar) ?? 0) * (sayi(x.fiyat) ?? 0); return { t, kdv: t * Number(x.kdv) }; });
  const ara = hesap.reduce((t, x) => t + x.t, 0), kdv = hesap.reduce((t, x) => t + x.kdv, 0);

  const xmlYukle = (f: File) =>
    baslat(async () => {
      setXmlHata(null);
      const fd = new FormData();
      fd.set("dosya", f);
      const r = await xmlOku(fd);
      if ("hata" in r) return setXmlHata(r.hata);
      setUyarilar(r.uyarilar);
      setBaslik({ faturaNo: r.faturaNo, tarih: r.tarih > bugun ? bugun : r.tarih, kaynak: "XML", anahtar: Date.now() });
      if (r.tedarikci.id) setTedarikciId(String(r.tedarikci.id));
      else { setTedarikciId("yeni"); setYeniTed({ unvan: r.tedarikci.unvan, vkn: r.tedarikci.vkn }); }
      setSatirlar(r.satirlar.map((x) => ({
        ...bos(),
        urun: x.urun,
        yazi: x.urun ? `${x.urun.kod} · ${x.urun.ad}` : x.ad,
        birim: x.birim,
        barkod: x.barkod,
        faturaAdi: x.ad,
        esleme: x.anahtar,
        eslesme: x.eslesme,
        miktar: virgul(x.miktar),
        fiyat: virgul(x.birimFiyat),
        kdv: x.kdvOrani === null ? "0.2" : String(x.kdvOrani),
      })));
    });

  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-4">
      <HataKutusu mesaj={durum?.genel} />
      <Kart baslik="E-fatura ile doldur (isteğe bağlı)">
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".xml,text/xml" onChange={(e) => e.target.files?.[0] && xmlYukle(e.target.files[0])} className="text-sm" disabled={okunuyor} />
          {okunuyor && <span className="text-sm text-zinc-500">Okunuyor...</span>}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Tedarikçinin gönderdiği e-fatura XML&apos;ini seçin; satırlar aşağıya dolar. Eşleşmeyen satırlar için yeni ürün kartı açılır ya da listeden ürün seçebilirsiniz. Seçiminiz bir sonraki faturada hatırlanır.</p>
        <HataKutusu mesaj={xmlHata} />
        {uyarilar.length > 0 && <ul className="mt-2 list-disc space-y-0.5 rounded-md bg-amber-50 py-2 pl-7 pr-3 text-sm text-amber-800">{uyarilar.map((u) => <li key={u}>{u}</li>)}</ul>}
      </Kart>

      <Kart baslik="Belge">
        <input type="hidden" name="kaynak" value={baslik.kaynak} />
        <div className="grid gap-4 md:grid-cols-4" key={baslik.anahtar}>
          <Alan etiket="Tedarikçi" hata={h.tedarikci} className="md:col-span-2">
            <Secim name="tedarikciId" value={tedarikciId === "yeni" ? "" : tedarikciId} onChange={(e) => setTedarikciId(e.target.value)} disabled={tedarikciId === "yeni"}>
              <option value="">Seçin (isteğe bağlı)</option>
              {tedarikciler.map((t) => <option key={t.id} value={t.id}>{t.unvan}</option>)}
            </Secim>
          </Alan>
          <Alan etiket="Fatura / irsaliye no"><Girdi name="faturaNo" defaultValue={baslik.faturaNo} className="uppercase" /></Alan>
          <Alan etiket="Tarih" hata={h.tarih}><Girdi type="date" name="tarih" defaultValue={baslik.tarih} max={bugun} /></Alan>
        </div>
        {tedarikciId === "yeni" ? (
          <div className="mt-3 grid gap-3 rounded-md bg-zinc-50 p-3 md:grid-cols-[1fr_12rem_auto]">
            <Alan etiket="Yeni tedarikçi ünvanı"><Girdi name="tedarikciUnvan" value={yeniTed.unvan} onChange={(e) => setYeniTed({ ...yeniTed, unvan: e.target.value })} className="uppercase" /></Alan>
            <Alan etiket="VKN"><Girdi name="tedarikciVkn" value={yeniTed.vkn} onChange={(e) => setYeniTed({ ...yeniTed, vkn: e.target.value })} inputMode="numeric" /></Alan>
            <Buton type="button" tur="ikincil" className="self-end" onClick={() => setTedarikciId("")}>Listeden seç</Buton>
          </div>
        ) : (
          <button type="button" onClick={() => setTedarikciId("yeni")} className="mt-2 text-xs text-zinc-600 hover:underline">Listede yok, yeni tedarikçi ekle</button>
        )}
      </Kart>

      <Kart baslik="Ürünler" sag={<span className="text-sm font-semibold">{tl(ara + kdv)}</span>}>
        <div className="space-y-3">
          <div className="hidden grid-cols-[1fr_6rem_8rem_5.5rem_7rem_auto] gap-2 text-xs text-zinc-500 md:grid">
            <span>Ürün</span><span>Miktar</span><span>Birim fiyat (KDV hariç)</span><span>KDV</span><span className="text-right">Tutar</span><span />
          </div>
          {satirlar.map((x, i) => (
            <div key={x.anahtar} className="rounded-md border border-zinc-100 p-2 md:border-0 md:p-0">
              <input type="hidden" name="s_urun" value={x.urun?.id ?? ""} />
              <input type="hidden" name="s_ad" value={x.urun ? "" : x.yazi} />
              <input type="hidden" name="s_tur" value={x.tur} />
              <input type="hidden" name="s_birim" value={x.birim} />
              <input type="hidden" name="s_barkod" value={x.barkod} />
              <input type="hidden" name="s_faturaAdi" value={x.faturaAdi} />
              <input type="hidden" name="s_anahtar" value={x.esleme} />
              <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_6rem_8rem_5.5rem_7rem_auto]">
                <UrunSecici
                  className="col-span-2 md:col-span-1"
                  deger={x.yazi}
                  secili={!!x.urun}
                  autoFocus={i === satirlar.length - 1 && i > 0}
                  placeholder="Ürün ara ya da barkod okut"
                  onYazi={(s) => guncelle(x.anahtar, { yazi: s, urun: null })}
                  onSec={(u) => guncelle(x.anahtar, { urun: u, yazi: `${u.kod} · ${u.ad}`, kdv: String(u.kdvOrani), fiyat: x.fiyat || (u.alisFiyati ? virgul(u.alisFiyati) : "") })}
                />
                <Girdi name="s_miktar" inputMode="decimal" value={x.miktar} onChange={(e) => guncelle(x.anahtar, { miktar: e.target.value })} aria-label="Miktar" />
                <Girdi name="s_fiyat" inputMode="decimal" value={x.fiyat} onChange={(e) => guncelle(x.anahtar, { fiyat: e.target.value })} aria-label="Birim fiyat" />
                <Secim name="s_kdv" value={x.kdv} onChange={(e) => guncelle(x.anahtar, { kdv: e.target.value })} aria-label="KDV">
                  {KDV.map((o) => <option key={o} value={o}>%{Number(o) * 100}</option>)}
                </Secim>
                <span className="self-center text-right text-sm tabular-nums">{hesap[i].t ? tl(hesap[i].t) : "-"}</span>
                <Buton type="button" tur="ikincil" onClick={() => setSatirlar((l) => l.filter((y) => y.anahtar !== x.anahtar))} disabled={satirlar.length === 1}>Sil</Buton>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                {x.faturaAdi && <span>Faturada: {x.faturaAdi}</span>}
                {x.urun && x.eslesme && x.eslesme !== "yok" && <span className="text-blue-700">Eşleşti ({ESLESME[x.eslesme]})</span>}
                {x.urun && <span>Stokta {x.urun.miktar.toLocaleString("tr-TR")} {x.urun.birim}</span>}
                {!x.urun && x.yazi.trim() && (
                  <span className="flex flex-wrap items-center gap-2 text-amber-700">
                    Yeni ürün kartı açılacak:
                    <select value={x.tur} onChange={(e) => guncelle(x.anahtar, { tur: e.target.value })} className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-zinc-800">
                      <option value="YEDEK_PARCA">Yedek parça</option><option value="AKSESUAR">Aksesuar</option><option value="DIGER">Diğer</option>
                    </select>
                    <select value={x.birim} onChange={(e) => guncelle(x.anahtar, { birim: e.target.value })} className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-zinc-800">
                      {BIRIMLER.map((b) => <option key={b}>{b}</option>)}
                    </select>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {h.satirlar && <p className="mt-2 text-xs text-red-600">{h.satirlar}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Buton type="button" tur="ikincil" onClick={() => setSatirlar((l) => [...l, bos()])}>Satır ekle</Buton>
          <span className="text-xs text-zinc-500">KDV hariç {tl(ara)} · KDV {tl(kdv)}</span>
        </div>
      </Kart>
      <Kart><Alan etiket="Not"><Girdi name="not" /></Alan></Kart>
      {durum?.uyari && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{durum.uyari}</p>}
      {durum?.onayIste && <input type="hidden" name="tekrarOnay" value="1" />}
      <Buton type="submit" disabled={bekliyor}>{bekliyor ? "Kaydediliyor..." : "Girişi kaydet"}</Buton>
    </form>
  );
}
