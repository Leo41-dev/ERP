"use client";
import { useActionState, useState } from "react";
import { sifirlamadan } from "@/components/form";
import { OdemeSatirlari, yeniOdeme, type Odeme } from "@/components/OdemeSatirlari";
import { Alan, Buton, Girdi, HataKutusu, Kart } from "@/components/ui";
import { sayi } from "@/lib/normalize";
import type { IadeDurumu } from "./eylem";

export type IadeKalem = { id: number; aciklama: string; arac: boolean; miktar: number; kalan: number; birim: number };
const tl = (n: number) => n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const virgul = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** alinan: müşteriden net alınan para (tahsilat − önceki geri ödemeler); acik: iade öncesi kalan alacak */
export function IadeFormu({ eylem, kalemler, alinan, acik, tescilli }: { eylem: (d: IadeDurumu, f: FormData) => Promise<IadeDurumu>; kalemler: IadeKalem[]; alinan: number; acik: number; tescilli: boolean }) {
  const [durum, gonder, bekliyor] = useActionState(eylem, undefined);
  const h = durum?.hatalar ?? {};
  const tekAracli = kalemler.length === 1 && kalemler[0].arac;
  const [secim, setSecim] = useState<Record<number, string>>(() => Object.fromEntries(kalemler.map((k) => [k.id, tekAracli ? "1" : ""])));
  const [tutarElle, setTutarElle] = useState("");
  const [odemeler, setOdemeler] = useState<Odeme[] | null>(null);

  const hesap = kalemler.reduce((t, k) => t + Math.min(sayi(secim[k.id]) ?? 0, k.kalan) * k.birim, 0);
  const tutar = sayi(tutarElle) ?? hesap;
  // müşterinin fazla ödediği kısım geri ödenir: alınan − (iade sonrası satış borcu)
  const oneri = Math.max(0, Math.min(alinan, tutar - acik));
  const liste = odemeler ?? [yeniOdeme("HAVALE", oneri ? virgul(oneri) : "")];
  const geriToplam = liste.reduce((t, o) => t + (sayi(o.tutar) ?? 0), 0);
  const aracSecili = kalemler.some((k) => k.arac && (sayi(secim[k.id]) ?? 0) > 0);

  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-4">
      <HataKutusu mesaj={durum?.genel} />
      <Kart baslik="İade edilen kalemler" sag={<span className="text-sm font-semibold">{tl(hesap)}</span>}>
        <div className="space-y-2">
          {kalemler.map((k) => (
            <div key={k.id} className="grid grid-cols-[1fr_7rem_8rem] items-center gap-2 text-sm">
              <span>
                {k.aciklama}
                <span className="block text-xs text-zinc-500">{k.miktar.toLocaleString("tr-TR")} adet satıldı{k.kalan < k.miktar ? `, ${(k.miktar - k.kalan).toLocaleString("tr-TR")} iade edilmiş` : ""} · birim {tl(k.birim)}</span>
              </span>
              {k.arac ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={secim[k.id] === "1"} disabled={!k.kalan} onChange={(e) => setSecim({ ...secim, [k.id]: e.target.checked ? "1" : "" })} />
                  İade al
                  <input type="hidden" name={`iade_${k.id}`} value={secim[k.id]} />
                </label>
              ) : (
                <Girdi name={`iade_${k.id}`} inputMode="decimal" placeholder={`en çok ${k.kalan.toLocaleString("tr-TR")}`} value={secim[k.id]} onChange={(e) => setSecim({ ...secim, [k.id]: e.target.value })} disabled={!k.kalan} aria-label="İade adedi" />
              )}
              <span className="text-right">{tl(Math.min(sayi(secim[k.id]) ?? 0, k.kalan) * k.birim)}</span>
            </div>
          ))}
        </div>
        {h.kalemler && <p className="mt-2 text-xs text-red-600">{h.kalemler}</p>}
        {aracSecili && (
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" name="ikinciEl" defaultChecked={tescilli} /> Araç stoğa 2. el olarak dönsün
          </label>
        )}
      </Kart>

      <Kart baslik="İade bilgileri">
        <div className="grid gap-3 md:grid-cols-3">
          <Alan etiket="İade nedeni" hata={h.neden} className="md:col-span-3"><Girdi name="neden" required placeholder="Arıza, beden uymadı, müşteri vazgeçti..." /></Alan>
          <Alan etiket="İade tutarı (kesinti varsa düşürün)" hata={h.tutar}><Girdi name="tutar" inputMode="decimal" placeholder={virgul(hesap)} value={tutarElle} onChange={(e) => setTutarElle(e.target.value)} /></Alan>
          <Alan etiket="İade faturası no (varsa)"><Girdi name="faturaNo" className="uppercase" /></Alan>
        </div>
        <p className="mt-2 text-xs text-zinc-500">İade tutarı müşterinin cari hesabına alacak yazılır.</p>
      </Kart>

      <Kart baslik="Müşteriye geri ödeme" sag={<span className="text-sm text-zinc-600">{tl(geriToplam)} · alınan {tl(alinan)}</span>}>
        <OdemeSatirlari
          odemeler={liste}
          guncelle={(a, alan, d) => setOdemeler(liste.map((o) => (o.anahtar === a ? { ...o, [alan]: d } : o)))}
          sil={(a) => setOdemeler(liste.filter((o) => o.anahtar !== a))}
        />
        {h.odemeler && <p className="mt-2 text-xs text-red-600">{h.odemeler}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Buton type="button" tur="ikincil" onClick={() => setOdemeler([...liste, yeniOdeme("NAKIT")])}>Ödeme satırı ekle</Buton>
          <span className="text-xs text-zinc-500">Önerilen tutar, iadeden sonra müşterinin fazla ödediği kısımdır. Para iade edilmeyecekse (cariye mahsup) tutarı silin.</span>
        </div>
      </Kart>

      <Buton type="submit" tur="tehlike" disabled={bekliyor}>{bekliyor ? "Kaydediliyor..." : `İadeyi kaydet · ${tl(tutar)}`}</Buton>
    </form>
  );
}
