"use client";
import { useActionState, useState } from "react";
import { sifirlamadan } from "@/components/form";
import { Alan, Buton, Girdi, HataKutusu, Kart, MetinAlani, Secim } from "@/components/ui";
import { sayi } from "@/lib/normalize";
import { teklifHesapla } from "@/lib/satis/hesap";
import type { TeklifDurumu } from "./eylem";

export type ModelSecenek = { id: number; etiket: string; otv: number | null; stok: number };
export type TeklifBaslangic = {
  musteriAd: string; telefon: string; eposta: string; kimlikNo: string; gecerlilik: string; odemeKosullari: string; not: string; firmaId: number | null;
  kalemler: { aciklama: string; modelId: number | null; miktar: string; fiyat: string; kdv: string; otv: string }[];
};
type Kalem = TeklifBaslangic["kalemler"][number] & { anahtar: number };

const tl = (n: number) => n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const yuzde = (o: number) => `%${(o * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
const KDV = ["0.2", "0.1", "0.01", "0"];
const anahtarUret = () => Date.now() + Math.random();
const bosKalem = (): Kalem => ({ anahtar: anahtarUret(), aciklama: "", modelId: null, miktar: "1", fiyat: "", kdv: "0.2", otv: "0" });

export function TeklifFormu({ eylem, modeller, otvOranlari, oneriler, firmalar, baslangic, dugme }: {
  eylem: (d: TeklifDurumu, f: FormData) => Promise<TeklifDurumu>;
  modeller: ModelSecenek[];
  otvOranlari: number[];
  oneriler: string[];
  firmalar: { id: number; unvan: string; varsayilan: boolean }[];
  baslangic: TeklifBaslangic;
  dugme: string;
}) {
  const [durum, gonder, bekliyor] = useActionState(eylem, undefined);
  const h = durum?.hatalar ?? {};
  const [kalemler, setKalemler] = useState<Kalem[]>(() => (baslangic.kalemler.length ? baslangic.kalemler.map((x) => ({ ...x, anahtar: anahtarUret() })) : [bosKalem()]));
  const otvSecenek = [...new Set([0, ...otvOranlari])].sort((a, b) => a - b);

  const hesap = teklifHesapla(
    kalemler
      .map((k) => ({ aciklama: k.aciklama, modelId: k.modelId, miktar: sayi(k.miktar) ?? 0, birimFiyat: sayi(k.fiyat) ?? 0, kdvOrani: Number(k.kdv), otvOrani: Number(k.otv) }))
      .filter((k) => k.miktar > 0 && k.birimFiyat > 0),
  );

  const guncelle = (a: number, alan: keyof Kalem, d: string) =>
    setKalemler((l) =>
      l.map((k) => {
        if (k.anahtar !== a) return k;
        const yeni = { ...k, [alan]: d };
        if (alan === "aciklama") {
          // yazılan ad bir araç modeline denk geliyorsa satır araç satırı olur, modelin varsayılan ÖTV'si önerilir
          const m = modeller.find((x) => x.etiket.toLocaleUpperCase("tr-TR") === d.trim().toLocaleUpperCase("tr-TR"));
          yeni.modelId = m?.id ?? null;
          if (m && m.otv !== null && k.otv === "0") yeni.otv = String(m.otv);
        }
        return yeni;
      }),
    );

  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-4">
      <HataKutusu mesaj={durum?.genel} />
      <Kart baslik="Müşteri">
        <div className="grid gap-3 md:grid-cols-4">
          <Alan etiket="Ad soyad / ünvan" hata={h.musteriAd} className="md:col-span-2"><Girdi name="musteriAd" defaultValue={baslangic.musteriAd} required className="uppercase" /></Alan>
          <Alan etiket="Telefon" hata={h.telefon}><Girdi name="telefon" defaultValue={baslangic.telefon} inputMode="tel" placeholder="5xx xxx xx xx" /></Alan>
          <Alan etiket="E-posta" hata={h.eposta}><Girdi name="eposta" defaultValue={baslangic.eposta} type="email" /></Alan>
          <Alan etiket="TCKN / VKN (isteğe bağlı)" hata={h.kimlikNo}><Girdi name="kimlikNo" defaultValue={baslangic.kimlikNo} inputMode="numeric" /></Alan>
          <Alan etiket="Geçerlilik tarihi" hata={h.gecerlilik}><Girdi name="gecerlilik" type="date" defaultValue={baslangic.gecerlilik} required /></Alan>
          {firmalar.length > 1 && (
            <Alan etiket="Teklifi veren firma" className="md:col-span-2">
              <Secim name="firmaId" defaultValue={String(baslangic.firmaId ?? firmalar.find((f) => f.varsayilan)?.id ?? firmalar[0].id)}>
                {firmalar.map((f) => <option key={f.id} value={f.id}>{f.unvan}</option>)}
              </Secim>
            </Alan>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Teklif müşteri kaydı açmaz. Telefon ya da kimlik no kayıtlı bir müşteriye aitse teklif o müşterinin kartında da görünür.</p>
      </Kart>

      <Kart baslik="Kalemler" sag={<span className="text-sm font-semibold">{tl(hesap.genelToplam)}</span>}>
        <datalist id="tk-modeller">
          {modeller.map((m) => <option key={m.id} value={m.etiket}>{m.stok ? `${m.stok} stokta` : "stokta yok"}</option>)}
          {oneriler.map((o) => <option key={o} value={o} />)}
        </datalist>
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_4.5rem_9rem_6rem_5.5rem_8rem_auto] gap-2 text-xs text-zinc-500 md:grid">
            <span>Araç modeli, ürün ya da hizmet</span><span>Adet</span><span>Birim fiyat (vergiler dahil)</span><span>ÖTV</span><span>KDV</span><span className="text-right">Tutar</span><span />
          </div>
          {kalemler.map((k) => {
            const tutar = (sayi(k.miktar) ?? 0) * (sayi(k.fiyat) ?? 0);
            const model = modeller.find((m) => m.id === k.modelId);
            return (
              <div key={k.anahtar}>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_4.5rem_9rem_6rem_5.5rem_8rem_auto]">
                  <input type="hidden" name="kalem_model" value={k.modelId ?? ""} />
                  <Girdi name="kalem_aciklama" list="tk-modeller" placeholder="Model adı yazın ya da serbest metin" value={k.aciklama} onChange={(e) => guncelle(k.anahtar, "aciklama", e.target.value)} className="col-span-2 uppercase md:col-span-1" />
                  <Girdi name="kalem_miktar" inputMode="decimal" value={k.miktar} onChange={(e) => guncelle(k.anahtar, "miktar", e.target.value)} aria-label="Adet" />
                  <Girdi name="kalem_fiyat" inputMode="decimal" placeholder="Fiyat" value={k.fiyat} onChange={(e) => guncelle(k.anahtar, "fiyat", e.target.value)} aria-label="Birim fiyat" />
                  <Secim name="kalem_otv" value={k.otv} onChange={(e) => guncelle(k.anahtar, "otv", e.target.value)} aria-label="ÖTV">
                    {otvSecenek.map((o) => <option key={o} value={String(o)}>{o ? yuzde(o) : "Yok"}</option>)}
                  </Secim>
                  <Secim name="kalem_kdv" value={k.kdv} onChange={(e) => guncelle(k.anahtar, "kdv", e.target.value)} aria-label="KDV">
                    {KDV.map((o) => <option key={o} value={o}>{yuzde(Number(o))}</option>)}
                  </Secim>
                  <span className="self-center text-right text-sm">{tutar ? tl(tutar) : "-"}</span>
                  <Buton type="button" tur="ikincil" onClick={() => setKalemler((l) => l.filter((x) => x.anahtar !== k.anahtar))} disabled={kalemler.length === 1}>Sil</Buton>
                </div>
                {model && <p className="mt-0.5 text-xs text-zinc-500">Araç modeli · {model.stok ? `${model.stok} adet stokta` : "şu an stokta yok"}</p>}
              </div>
            );
          })}
        </div>
        {h.kalemler && <p className="mt-2 text-xs text-red-600">{h.kalemler}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Buton type="button" tur="ikincil" onClick={() => setKalemler((l) => [...l, bosKalem()])}>Satır ekle</Buton>
          <span className="text-xs text-zinc-500">Matrah {tl(hesap.matrah)} · ÖTV {tl(hesap.otv)} · KDV {tl(hesap.kdv)}</span>
        </div>
      </Kart>

      <Kart baslik="Koşullar ve notlar">
        <div className="grid gap-3 md:grid-cols-2">
          <Alan etiket="Ödeme koşulları"><MetinAlani name="odemeKosullari" defaultValue={baslangic.odemeKosullari} placeholder="Peşin / kredi kartına 6 taksit / senetli..." /></Alan>
          <Alan etiket="Not (teklifte görünür)"><MetinAlani name="not" defaultValue={baslangic.not} placeholder="Teslim süresi, hediye aksesuar..." /></Alan>
        </div>
      </Kart>

      <Buton type="submit" disabled={bekliyor}>{bekliyor ? "Kaydediliyor..." : `${dugme} · ${tl(hesap.genelToplam)}`}</Buton>
    </form>
  );
}
