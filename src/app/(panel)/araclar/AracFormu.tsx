"use client";
import { sifirlamadan } from "@/components/form";
import { useActionState, useState } from "react";
import { Alan, Buton, Girdi, HataKutusu, Kart, MetinAlani, Secim } from "@/components/ui";
import { MALIYET_TURLERI } from "@/lib/dogrulama/arac";
import type { AracDurum } from "./eylem";
import type { AracFormListeleri } from "./veri";

type Eylem = (d: AracDurum, f: FormData) => Promise<AracDurum>;
export type AracVarsayilan = Partial<Record<string, string>>;

const yuzdeYaz = (o: number) => `%${(o * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;

export function AracFormu({ eylem, listeler, v = {}, maliyetGoster }: { eylem: Eylem; listeler: AracFormListeleri; v?: AracVarsayilan; maliyetGoster: boolean }) {
  const [durum, gonder, bekliyor] = useActionState(eylem, undefined);
  const [otv, setOtv] = useState(v.otvOrani ?? "");
  const [tescil, setTescil] = useState(v.tescilDurum ?? "TESCILSIZ");
  const h = durum?.hatalar ?? {};
  const markalar = [...new Set(listeler.modeller.map((m) => m.marka))];

  // model seçilince tipin önerdiği ÖTV oranı gelir; oran yine elle değiştirilebilir
  const modelSecildi = (id: string) => {
    const m = listeler.modeller.find((x) => String(x.id) === id);
    if (m?.otv !== null && m?.otv !== undefined && !otv) setOtv(String(m.otv));
  };

  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-4">
      <HataKutusu mesaj={durum?.genel} />
      <Kart baslik="Araç">
        <div className="grid gap-4 md:grid-cols-3">
          <Alan etiket="Şase no" hata={h.sase}><Girdi name="sase" defaultValue={v.sase} required className="font-mono uppercase" /></Alan>
          <Alan etiket="Motor no"><Girdi name="motorNo" defaultValue={v.motorNo} className="font-mono uppercase" /></Alan>
          <Alan etiket="Marka / model">
            <Secim name="modelId" defaultValue={v.modelId ?? ""} onChange={(e) => modelSecildi(e.target.value)}>
              <option value="">Seçin</option>
              {markalar.map((mk) => (
                <optgroup key={mk} label={mk}>
                  {listeler.modeller.filter((m) => m.marka === mk).map((m) => (
                    <option key={m.id} value={m.id}>{mk} · {m.ad}{m.tip ? ` (${m.tip})` : ""}</option>
                  ))}
                </optgroup>
              ))}
            </Secim>
          </Alan>
          <Alan etiket="Model yılı" hata={h.yil}><Girdi name="yil" inputMode="numeric" defaultValue={v.yil} /></Alan>
          <Alan etiket="Renk"><Girdi name="renk" defaultValue={v.renk} /></Alan>
          <Alan etiket="Euro standardı"><Girdi name="euroStandart" defaultValue={v.euroStandart} /></Alan>
          <Alan etiket="Kondisyon">
            <Secim name="kondisyon" defaultValue={v.kondisyon ?? "SIFIR"}>
              <option value="SIFIR">Sıfır</option>
              <option value="IKINCI_EL">2. el</option>
              <option value="KONSINYE">Konsinye</option>
            </Secim>
          </Alan>
          <Alan etiket="Konum">
            <Secim name="konumId" defaultValue={v.konumId ?? ""}>
              <option value="">Seçin</option>
              {listeler.konumlar.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
            </Secim>
          </Alan>
          <Alan etiket="Geliş tarihi" hata={h.gelisTarihi}><Girdi name="gelisTarihi" type="date" defaultValue={v.gelisTarihi} /></Alan>
        </div>
      </Kart>
      <Kart baslik="Alış ve vergi">
        <div className="grid gap-4 md:grid-cols-3">
          <Alan etiket="Tedarikçi">
            <Secim name="tedarikciId" defaultValue={v.tedarikciId ?? ""}>
              <option value="">Seçin</option>
              {listeler.tedarikciler.map((t) => <option key={t.id} value={t.id}>{t.unvan}</option>)}
            </Secim>
          </Alan>
          <Alan etiket="Alış fatura no"><Girdi name="alisFaturaNo" defaultValue={v.alisFaturaNo} /></Alan>
          <Alan etiket="Alış şekli"><Girdi name="alisSekli" defaultValue={v.alisSekli} placeholder="Fatura, noter, konsinye..." /></Alan>
          <Alan etiket="KDV oranı" hata={h.kdvOrani}>
            <Secim name="kdvOrani" defaultValue={v.kdvOrani ?? "0.2"}>
              {["0.2", "0.1", "0.01", "0"].map((o) => <option key={o} value={o}>{yuzdeYaz(Number(o))}</option>)}
            </Secim>
          </Alan>
          <Alan etiket="ÖTV oranı (elle seçilir)">
            <Secim name="otvOrani" value={otv} onChange={(e) => setOtv(e.target.value)}>
              <option value="">Seçin</option>
              {listeler.otvOranlari.map((o) => <option key={o} value={String(o)}>{yuzdeYaz(o)}</option>)}
            </Secim>
          </Alan>
        </div>
      </Kart>
      {maliyetGoster && (
        <Kart baslik="Maliyet kalemleri (₺)">
          <div className="grid gap-4 md:grid-cols-4">
            {MALIYET_TURLERI.map(([tur, ad]) => (
              <Alan key={tur} etiket={ad} hata={h[`maliyet_${tur}`]}>
                <Girdi name={`maliyet_${tur}`} inputMode="decimal" defaultValue={v[`maliyet_${tur}`]} />
              </Alan>
            ))}
          </div>
        </Kart>
      )}
      <Kart baslik="Tescil">
        <div className="grid gap-4 md:grid-cols-4">
          <Alan etiket="Tescil durumu">
            <Secim name="tescilDurum" value={tescil} onChange={(e) => setTescil(e.target.value)}>
              <option value="TESCILSIZ">Tescilsiz</option>
              <option value="BASVURUDA">Başvuruda</option>
              <option value="TESCILLI">Tescilli</option>
            </Secim>
          </Alan>
          <Alan etiket="Plaka" hata={h.plaka}><Girdi name="plaka" defaultValue={v.plaka} className="uppercase" /></Alan>
          <Alan etiket="Ruhsat seri no"><Girdi name="ruhsatSeriNo" defaultValue={v.ruhsatSeriNo} /></Alan>
          <Alan etiket="Tescil tarihi" hata={h.tescilTarihi}><Girdi name="tescilTarihi" type="date" defaultValue={v.tescilTarihi} /></Alan>
        </div>
      </Kart>
      <Kart baslik="Not"><MetinAlani name="not" defaultValue={v.not} /></Kart>
      <Buton type="submit" disabled={bekliyor}>{bekliyor ? "Kaydediliyor..." : "Kaydet"}</Buton>
    </form>
  );
}
