"use client";
import { useActionState, useState } from "react";
import { sifirlamadan } from "@/components/form";
import { Alan, Buton, Girdi, HataKutusu, Kart, Secim } from "@/components/ui";
import { OdemeSatirlari, yeniOdeme, type Odeme } from "@/components/OdemeSatirlari";
import { UrunSecici, type UrunBulunan } from "@/components/UrunSecici";
import { sayi } from "@/lib/normalize";
import { kalemHesapla } from "@/lib/satis/hesap";
import { hizliSatisKaydet } from "./eylem";
import { yuzde } from "@/lib/bicim";
import { secenekli } from "@/lib/vergi";
import { vergiEtiketi } from "@/lib/vergiHesap";

type Kalem = { anahtar: number; aciklama: string; miktar: string; fiyat: string; kdv: string; urun?: UrunBulunan | null };

const tl = (n: number) => n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const bosKalem = (): Kalem => ({ anahtar: Date.now() + Math.random(), aciklama: "", miktar: "1", fiyat: "", kdv: "0.2" });

export type TekliftenHizli = { id: number; no: number; unvan: string; telefon: string; kimlikNo: string; kalemler: Omit<Kalem, "anahtar">[] };
const virgul = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2, useGrouping: false });

export function HizliSatisFormu({ firmalar, teklif, kdvOranlari }: { firmalar: { id: number; unvan: string; varsayilan: boolean }[]; teklif?: TekliftenHizli; kdvOranlari: string[] }) {
  const [durum, gonder, bekliyor] = useActionState(hizliSatisKaydet, undefined);
  const h = durum?.hatalar ?? {};
  const [kalemler, setKalemler] = useState<Kalem[]>(() => (teklif?.kalemler.length ? teklif.kalemler.map((x) => ({ ...x, anahtar: Date.now() + Math.random() })) : [bosKalem()]));
  const [odemeler, setOdemeler] = useState<Odeme[]>([yeniOdeme("KART")]);
  const [tutarElle, setTutarElle] = useState(false);

  const hesap = kalemHesapla(
    kalemler.map((k) => ({ aciklama: k.aciklama, miktar: sayi(k.miktar) ?? 0, birimFiyat: sayi(k.fiyat) ?? 0, kdvOrani: Number(k.kdv), otvOrani: k.urun?.otvOrani ?? 0, ekler: k.urun?.ekVergiler ?? [] })).filter((k) => k.miktar > 0 && k.birimFiyat > 0),
  );
  // tek ödeme satırı varsa ve elle değiştirilmediyse tutar toplamı izler
  // stopaj/tevkifat gibi kesintiler alıcıda kalır: beklenen ödeme tahsil edilecek tutardır
  const beklenen = hesap.tahsilEdilecek;
  const odemeListesi = odemeler.length === 1 && !tutarElle ? [{ ...odemeler[0], tutar: beklenen ? String(beklenen).replace(".", ",") : "" }] : odemeler;

  const odemeToplam = odemeListesi.reduce((t, o) => t + (sayi(o.tutar) ?? 0), 0);

  const kalemGuncelle = (a: number, alan: keyof Kalem, d: string) => setKalemler((l) => l.map((k) => (k.anahtar === a ? { ...k, [alan]: d } : k)));
  // stok kartı seçilince ad, fiyat ve KDV karttan gelir; aynı ürün başka satırdaysa o satırın adedi artar.
  // Son satırda seçim yapılınca yeni boş satır açılır, barkod okuyucuyla arka arkaya okutulabilir.
  const urunSec = (a: number, u: UrunBulunan) =>
    setKalemler((l) => {
      const diger = l.find((k) => k.urun?.id === u.id && k.anahtar !== a);
      const yeni = diger
        ? l.map((k) => (k === diger ? { ...k, miktar: String((sayi(k.miktar) ?? 0) + 1).replace(".", ",") } : k.anahtar === a ? { ...k, aciklama: "", urun: null } : k))
        : l.map((k) => (k.anahtar === a ? { ...k, urun: u, aciklama: u.ad, fiyat: u.satisFiyati ? virgul(u.satisFiyati) : k.fiyat, kdv: String(u.kdvOrani) } : k));
      return yeni.every((k) => k.aciklama) ? [...yeni, bosKalem()] : yeni;
    });
  const odemeGuncelle = (a: number, alan: keyof Odeme, d: string) => {
    if (alan === "tutar") setTutarElle(true);
    setOdemeler(odemeListesi.map((o) => (o.anahtar === a ? { ...o, [alan]: d } : o)));
  };

  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-4">
      <HataKutusu mesaj={durum?.genel} />
      {teklif && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <input type="hidden" name="teklifId" value={teklif.id} />
          {teklif.no} numaralı teklif satışa dönüştürülüyor; kalemler ve müşteri bilgisi aktarıldı.
        </p>
      )}

      <Kart baslik="Ürün ve hizmetler" sag={<span className="text-sm font-semibold">{tl(hesap.genelToplam)}</span>}>
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_5rem_9rem_6rem_8rem_auto] gap-2 text-xs text-zinc-500 md:grid">
            <span>Ürün / hizmet (stoktan ara, barkod okut ya da serbest yaz)</span><span>Adet</span><span>Birim fiyat (KDV dahil)</span><span>KDV</span><span className="text-right">Tutar</span><span />
          </div>
          {kalemler.map((k, i) => {
            const tutar = (sayi(k.miktar) ?? 0) * (sayi(k.fiyat) ?? 0);
            const az = k.urun && k.urun.tur !== "HIZMET" && (sayi(k.miktar) ?? 0) > k.urun.miktar;
            return (
              <div key={k.anahtar}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_5rem_9rem_6rem_8rem_auto]">
                <input type="hidden" name="kalem_urun" value={k.urun?.id ?? ""} />
                <UrunSecici
                  name="kalem_aciklama"
                  className="col-span-2 md:col-span-1"
                  deger={k.aciklama}
                  secili={!!k.urun}
                  placeholder="Kask, yağ, lastik ya da barkod..."
                  autoFocus={i === 0 || (i === kalemler.length - 1 && !k.aciklama)}
                  onYazi={(d) => setKalemler((l) => l.map((x) => (x.anahtar === k.anahtar ? { ...x, aciklama: d, urun: null } : x)))}
                  onSec={(u) => urunSec(k.anahtar, u)}
                />
                <Girdi name="kalem_miktar" inputMode="decimal" value={k.miktar} onChange={(e) => kalemGuncelle(k.anahtar, "miktar", e.target.value)} aria-label="Adet" />
                <Girdi name="kalem_fiyat" inputMode="decimal" placeholder="Fiyat" value={k.fiyat} onChange={(e) => kalemGuncelle(k.anahtar, "fiyat", e.target.value)} aria-label="Birim fiyat" />
                <Secim name="kalem_kdv" value={k.kdv} onChange={(e) => kalemGuncelle(k.anahtar, "kdv", e.target.value)} aria-label="KDV">
                  {secenekli(kdvOranlari, k.kdv).map((o) => <option key={o} value={o}>{yuzde(Number(o))}</option>)}
                </Secim>
                <span className="self-center text-right text-sm">{tutar ? tl(tutar) : "-"}</span>
                <Buton type="button" tur="ikincil" onClick={() => setKalemler((l) => l.filter((x) => x.anahtar !== k.anahtar))} disabled={kalemler.length === 1}>Sil</Buton>
              </div>
              {k.urun && (
                <p className={`mt-0.5 text-xs ${az ? "text-red-600" : "text-zinc-500"}`}>
                  <span className="font-mono">{k.urun.kod}</span>
                  {k.urun.tur === "HIZMET" ? " · hizmet" : ` · stokta ${k.urun.miktar.toLocaleString("tr-TR")} ${k.urun.birim}${az ? " (yetersiz)" : ""}`}
                  {k.urun.ekVergiler?.map((v) => ` · ${vergiEtiketi(v)}`)}
                </p>
              )}
              </div>
            );
          })}
        </div>
        {h.kalemler && <p className="mt-2 text-xs text-red-600">{h.kalemler}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Buton type="button" tur="ikincil" onClick={() => setKalemler((l) => [...l, bosKalem()])}>Satır ekle</Buton>
          <span className="text-xs text-zinc-500">
            Vergiler hariç {tl(hesap.matrah)}{hesap.otv > 0 && ` · ÖTV ${tl(hesap.otv)}`}
            {hesap.vergiOzeti.filter((v) => !v.kesinti).map((v) => ` · ${v.ad} ${tl(v.tutar)}`)} · KDV {tl(hesap.kdv)}
            {hesap.vergiOzeti.filter((v) => v.kesinti).map((v) => ` · ${v.ad} −${tl(v.tutar)}`)}
            {hesap.kesinti > 0 && ` · Tahsil edilecek ${tl(hesap.tahsilEdilecek)}`}
          </span>
        </div>
      </Kart>

      <Kart baslik="Ödeme" sag={<span className={`text-sm ${Math.abs(beklenen - odemeToplam) >= 0.01 ? "text-amber-600" : "text-zinc-600"}`}>{tl(odemeToplam)} / {tl(beklenen)}</span>}>
        <OdemeSatirlari odemeler={odemeListesi} guncelle={odemeGuncelle} sil={(a) => setOdemeler(odemeListesi.filter((x) => x.anahtar !== a))} />
        {h.odemeler && <p className="mt-2 text-xs text-red-600">{h.odemeler}</p>}
        <Buton
          type="button"
          tur="ikincil"
          className="mt-3"
          onClick={() => {
            setTutarElle(true);
            setOdemeler([...odemeListesi, yeniOdeme("NAKIT")]);
          }}
        >
          Ödemeyi böl
        </Buton>
      </Kart>

      <Kart baslik="Müşteri (isteğe bağlı)">
        <div className="grid gap-3 md:grid-cols-4">
          <Alan etiket="Ad soyad / unvan" hata={h.unvan}><Girdi name="unvan" defaultValue={teklif?.unvan} className="uppercase" /></Alan>
          <Alan etiket="Telefon" hata={h.telefon}><Girdi name="telefon" defaultValue={teklif?.telefon} inputMode="tel" placeholder="5xx xxx xx xx" /></Alan>
          <Alan etiket="TCKN / VKN (fatura için)" hata={h.kimlikNo}><Girdi name="kimlikNo" defaultValue={teklif?.kimlikNo} inputMode="numeric" /></Alan>
          {firmalar.length > 1 ? (
            <Alan etiket="Satışı yapan firma">
              <Secim name="firmaId" defaultValue={String(firmalar.find((f) => f.varsayilan)?.id ?? firmalar[0].id)}>
                {firmalar.map((f) => <option key={f.id} value={f.id}>{f.unvan}</option>)}
              </Secim>
            </Alan>
          ) : (
            <Alan etiket="Not"><Girdi name="not" /></Alan>
          )}
          {firmalar.length > 1 && <Alan etiket="Not" className="md:col-span-4"><Girdi name="not" /></Alan>}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Boş bırakılırsa perakende müşteri olarak kaydedilir. Telefon ya da kimlik no kayıtlıysa o müşteriye bağlanır.</p>
      </Kart>

      {durum?.uyari && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{durum.uyari}</p>}
      {durum?.onayIste && <input type="hidden" name="farkOnay" value="1" />}
      {durum?.eksiUyari && <p className="whitespace-pre-line rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{durum.eksiUyari}</p>}
      {durum?.eksiOnay && <input type="hidden" name="eksiOnay" value="1" />}
      <Buton type="submit" disabled={bekliyor} className="w-full py-3 text-base md:w-auto">{bekliyor ? "Kaydediliyor..." : `Kaydet ve fiş hazırla · ${tl(hesap.genelToplam)}`}</Buton>
    </form>
  );
}
