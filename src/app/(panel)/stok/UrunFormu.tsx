"use client";
import { useActionState, useState } from "react";
import { sifirlamadan } from "@/components/form";
import { Alan, Buton, Girdi, HataKutusu, Kart, MetinAlani, Secim } from "@/components/ui";
import { BIRIMLER } from "@/lib/dogrulama/urun";
import { URUN_TUR_AD } from "@/lib/bicim";
import type { Tanim } from "@/lib/stokTanim";
import { fiyattanKarOrani, marjliFiyat } from "@/lib/stokHesap";
import { secenekli } from "@/lib/vergi";
import { sayi } from "@/lib/normalize";
import { tl, yuzde } from "@/lib/bicim";
import type { UrunDurum } from "./eylem";

type Eylem = (d: UrunDurum, f: FormData) => Promise<UrunDurum>;
type Alanlar = "ad" | "tur" | "kod" | "barkod" | "grupId" | "markaId" | "birim" | "raf" | "kritikStok" | "satisFiyati" | "kdvOrani" | "otvOrani" | "fiyatTipi" | "karOrani" | "alisFiyati" | "not";
export type UrunVarsayilan = Partial<Record<Alanlar, string>> & { aktif?: boolean };


export function UrunFormu({ eylem, v = {}, gruplar, markalar, yeni, maliyetGoster, yonetici, bazMaliyet = null, kdvOranlari, otvOranlari }: {
  eylem: Eylem;
  v?: UrunVarsayilan;
  gruplar: Tanim[];
  markalar: Tanim[];
  yeni?: boolean;
  maliyetGoster: boolean;
  yonetici: boolean;
  bazMaliyet?: number | null; // alış fiyatı yoksa kâr oranında kullanılan ortalama maliyet
  kdvOranlari: string[];
  otvOranlari: string[];
}) {
  const [durum, gonder, bekliyor] = useActionState(eylem, undefined);
  const h = durum?.hatalar ?? {};
  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-4">
      <HataKutusu mesaj={durum?.genel} />
      {yeni && <input type="hidden" name="yeni" value="1" />}
      <Kart baslik="Ürün">
        <div className="grid gap-4 md:grid-cols-3">
          <Alan etiket="Ürün adı" hata={h.ad} className="md:col-span-2"><Girdi name="ad" defaultValue={v.ad} required className="uppercase" autoFocus={yeni} /></Alan>
          <Alan etiket="Tür" hata={h.tur}>
            <Secim name="tur" defaultValue={v.tur ?? "YEDEK_PARCA"}>
              {["YEDEK_PARCA", "AKSESUAR", "HIZMET", "DIGER"].map((t) => <option key={t} value={t}>{URUN_TUR_AD[t]}</option>)}
            </Secim>
          </Alan>
          <Alan etiket="Stok kodu" hata={h.kod}><Girdi name="kod" defaultValue={v.kod} placeholder="Boş bırakılırsa otomatik verilir" className="font-mono uppercase" /></Alan>
          <Alan etiket="Barkod" hata={h.barkod}><Girdi name="barkod" defaultValue={v.barkod} className="font-mono" /></Alan>
          {([["grupId", "Grup", gruplar], ["markaId", "Marka", markalar]] as const).map(([ad, etiket, liste]) => (
            <Alan key={ad} etiket={etiket} hata={h[ad]}>
              <Secim name={ad} defaultValue={v[ad] ?? ""}>
                <option value="">Seçilmedi</option>
                {liste.map((x) => <option key={x.id} value={x.id}>{x.ad}{x.aktif ? "" : " (pasif)"}</option>)}
              </Secim>
            </Alan>
          ))}
          <Alan etiket="Birim">
            <Secim name="birim" defaultValue={v.birim ?? "Adet"}>{BIRIMLER.map((b) => <option key={b}>{b}</option>)}</Secim>
          </Alan>
          <Alan etiket="Raf / yer"><Girdi name="raf" defaultValue={v.raf} className="uppercase" /></Alan>
          <Alan etiket="Kritik stok seviyesi" hata={h.kritikStok}><Girdi name="kritikStok" inputMode="decimal" defaultValue={v.kritikStok} placeholder="Bu miktara düşünce uyarır" /></Alan>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Grup ve marka listesi Ayarlar&apos;dan yönetilir{yonetici ? <> (<a href="/ayarlar" className="underline" target="_blank">listeyi aç</a>)</> : ", yöneticiye eklettirin"}.
        </p>
      </Kart>
      <Kart baslik="Fiyat ve vergiler">
        <FiyatAlanlari v={v} h={h} maliyetGoster={maliyetGoster} bazMaliyet={bazMaliyet} kdvOranlari={kdvOranlari} otvOranlari={otvOranlari} />
      </Kart>
      <Kart>
        <Alan etiket="Not"><MetinAlani name="not" defaultValue={v.not} /></Alan>
        {!yeni && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="aktif" defaultChecked={v.aktif ?? true} /> Aktif (pasif ürünler satışta listelenmez)
          </label>
        )}
      </Kart>
      <Buton type="submit" disabled={bekliyor}>{bekliyor ? "Kaydediliyor..." : "Kaydet"}</Buton>
    </form>
  );
}

type Hatalar = Partial<Record<string, string>>;

/** Satış fiyatı ya elle girilir ya da son alış fiyatı üzerine kâr oranıyla hesaplanır; vergiler dahil gösterilir. */
function FiyatAlanlari({ v, h, maliyetGoster, bazMaliyet, kdvOranlari, otvOranlari }: { v: UrunVarsayilan; h: Hatalar; maliyetGoster: boolean; bazMaliyet: number | null; kdvOranlari: string[]; otvOranlari: string[] }) {
  const [tip, setTip] = useState(v.fiyatTipi ?? "SABIT");
  const [fiyat, setFiyat] = useState(v.satisFiyati ?? "");
  const [kar, setKar] = useState(v.karOrani ?? "");
  const [alis, setAlis] = useState(v.alisFiyati ?? "");
  const [kdv, setKdv] = useState(v.kdvOrani ?? "0.2");
  const [otv, setOtv] = useState(v.otvOrani ?? "0");
  const baz = sayi(alis) || bazMaliyet;
  const k = Number(kdv), o = Number(otv);
  const hesaplanan = tip === "MARJ" && baz && sayi(kar) !== null ? marjliFiyat(baz, sayi(kar)! / 100, k, o) : null;
  const mevcutKar = tip === "SABIT" && sayi(fiyat) ? fiyattanKarOrani(sayi(fiyat)!, baz, k, o) : null;
  const kilitli = !maliyetGoster && v.fiyatTipi === "MARJ"; // maliyet görmeyen kullanıcı kâr oranıyla hesaplanan fiyatı değiştiremez
  return (
    <div className="space-y-4">
      {maliyetGoster && (
        <div className="flex flex-wrap gap-4 text-sm">
          {([["SABIT", "Satış fiyatını elle gir"], ["MARJ", "Kâr oranıyla hesapla"]] as const).map(([d, ad]) => (
            <label key={d} className="flex items-center gap-2">
              <input type="radio" name="fiyatTipi" value={d} checked={tip === d} onChange={() => setTip(d)} /> {ad}
            </label>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        {maliyetGoster && (
          <Alan etiket="Son alış fiyatı (KDV hariç)" hata={h.alisFiyati}>
            <Girdi name="alisFiyati" inputMode="decimal" value={alis} onChange={(e) => setAlis(e.target.value)} placeholder={bazMaliyet ? `ort. maliyet ${bazMaliyet.toLocaleString("tr-TR")}` : ""} />
          </Alan>
        )}
        {tip === "MARJ" && maliyetGoster ? (
          <>
            <Alan etiket="Kâr oranı (maliyet üzerine, %)" hata={h.karOrani}>
              <Girdi name="karOrani" inputMode="decimal" value={kar} onChange={(e) => setKar(e.target.value)} placeholder="ör. 35" />
            </Alan>
            <Alan etiket="Satış fiyatı (vergiler dahil)">
              <p className="py-2 text-sm font-medium">{hesaplanan !== null ? tl(hesaplanan) : <span className="font-normal text-zinc-500">{baz ? "Kâr oranını yazın" : "Önce alış fiyatını yazın"}</span>}</p>
            </Alan>
          </>
        ) : (
          <Alan etiket="Satış fiyatı (vergiler dahil)" hata={h.satisFiyati}>
            <Girdi name={kilitli ? undefined : "satisFiyati"} inputMode="decimal" value={fiyat} onChange={(e) => setFiyat(e.target.value)} disabled={kilitli} />
          </Alan>
        )}
        <Alan etiket="KDV" hata={h.kdvOrani}>
          <Secim name="kdvOrani" value={kdv} onChange={(e) => setKdv(e.target.value)}>
            {secenekli(kdvOranlari, kdv).map((x) => <option key={x} value={x}>{yuzde(Number(x))}</option>)}
          </Secim>
        </Alan>
        <Alan etiket="ÖTV" hata={h.otvOrani}>
          <Secim name="otvOrani" value={otv} onChange={(e) => setOtv(e.target.value)}>
            <option value="0">Yok</option>
            {secenekli(otvOranlari, otv === "0" ? null : otv).map((x) => <option key={x} value={x}>{yuzde(Number(x))}</option>)}
          </Secim>
        </Alan>
      </div>
      <p className="text-xs text-zinc-500">
        {kilitli
          ? "Bu ürünün fiyatı kâr oranıyla hesaplanıyor; değiştirmek için yöneticiye başvurun."
          : tip === "MARJ"
            ? "Fiyat, son alış fiyatına kâr oranı eklenip üzerine ÖTV ve KDV konarak hesaplanır. Yeni stok girişinde alış fiyatı değişince satış fiyatı da kendiliğinden güncellenir."
            : mevcutKar !== null && maliyetGoster
              ? `Bu fiyatla maliyet üzerine kâr ${yuzde(mevcutKar)}. Satış fiyatı hızlı satışta ürün seçilince gelir, satışta değiştirilebilir.`
              : "Satış fiyatı hızlı satışta ürün seçilince otomatik gelir, satışta değiştirilebilir."}
      </p>
    </div>
  );
}
