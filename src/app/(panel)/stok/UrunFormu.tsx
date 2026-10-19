"use client";
import { useActionState } from "react";
import { sifirlamadan } from "@/components/form";
import { Alan, Buton, Girdi, HataKutusu, Kart, MetinAlani, Secim } from "@/components/ui";
import { BIRIMLER } from "@/lib/dogrulama/urun";
import { URUN_TUR_AD } from "@/lib/bicim";
import type { Tanim } from "@/lib/stokTanim";
import type { UrunDurum } from "./eylem";

type Eylem = (d: UrunDurum, f: FormData) => Promise<UrunDurum>;
type Alanlar = "ad" | "tur" | "kod" | "barkod" | "grupId" | "markaId" | "birim" | "raf" | "kritikStok" | "satisFiyati" | "kdvOrani" | "alisFiyati" | "not";
export type UrunVarsayilan = Partial<Record<Alanlar, string>> & { aktif?: boolean };

const KDV = ["0.2", "0.1", "0.01", "0"];

export function UrunFormu({ eylem, v = {}, gruplar, markalar, yeni, maliyetGoster, yonetici }: { eylem: Eylem; v?: UrunVarsayilan; gruplar: Tanim[]; markalar: Tanim[]; yeni?: boolean; maliyetGoster: boolean; yonetici: boolean }) {
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
      <Kart baslik="Fiyat">
        <div className="grid gap-4 md:grid-cols-3">
          <Alan etiket="Satış fiyatı (KDV dahil)" hata={h.satisFiyati}><Girdi name="satisFiyati" inputMode="decimal" defaultValue={v.satisFiyati} /></Alan>
          <Alan etiket="KDV" hata={h.kdvOrani}>
            <Secim name="kdvOrani" defaultValue={v.kdvOrani ?? "0.2"}>{KDV.map((o) => <option key={o} value={o}>%{Number(o) * 100}</option>)}</Secim>
          </Alan>
          {maliyetGoster && <Alan etiket="Liste alış fiyatı (KDV hariç)" hata={h.alisFiyati}><Girdi name="alisFiyati" inputMode="decimal" defaultValue={v.alisFiyati} /></Alan>}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Satış fiyatı hızlı satışta ürün seçilince otomatik gelir, satışta değiştirilebilir.</p>
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
