"use client";
import { sifirlamadan } from "@/components/form";
import { useActionState, useMemo, useRef, useState } from "react";
import { Alan, Buton, Girdi, HataKutusu, Kart, MetinAlani, Secim } from "@/components/ui";
import { OdemeSatirlari, yeniOdeme, type Odeme } from "@/components/OdemeSatirlari";
import { sayi } from "@/lib/normalize";
import { vergiKirilimi } from "@/lib/satis/hesap";
import { musteriBul, satisKaydet } from "./eylem";

type Arac = { id: number; modelId: number | null; etiket: string; kdv: number | null; otv: number | null };
export type TekliftenSatis = {
  id: number; no: number; modelId: number; modelAd: string; tutar: string; kdv: string; otv: string; digerler: string; digerTutar: number; toplam: number; not: string;
  musteri: { unvan: string; telefon: string; eposta: string; kimlikNo: string };
};

const tl = (n: number) => n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const yuzde = (o: number) => `%${(o * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;

export function SatisFormu({ araclar, secili, otvOranlari, kdvOranlari, teklif }: { araclar: Arac[]; secili?: number; otvOranlari: number[]; kdvOranlari: string[]; teklif?: TekliftenSatis }) {
  const [durum, gonder, bekliyor] = useActionState(satisKaydet, undefined);
  const h = durum?.hatalar ?? {};
  const ilk = araclar.find((a) => a.id === secili);
  const [aracId, setAracId] = useState(ilk ? String(ilk.id) : "");
  const [kdv, setKdv] = useState(teklif?.kdv ?? String(ilk?.kdv ?? 0.2));
  const [otv, setOtv] = useState(teklif?.otv ?? (ilk?.otv !== null && ilk?.otv !== undefined ? String(ilk.otv) : ""));
  const [toplam, setToplam] = useState(teklif?.tutar ?? "");
  const uygun = teklif ? araclar.filter((a) => a.modelId === teklif.modelId) : [];
  const digerAraclar = teklif ? araclar.filter((a) => a.modelId !== teklif.modelId) : araclar;
  const [odemeler, setOdemeler] = useState<Odeme[]>([yeniOdeme("HAVALE")]);
  const [bulMesaj, setBulMesaj] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const genel = sayi(toplam) ?? 0;
  const kirilim = useMemo(() => (genel > 0 && otv !== "" ? vergiKirilimi(genel, Number(kdv), Number(otv)) : null), [genel, kdv, otv]);
  const odemeToplam = odemeler.reduce((t, o) => t + (sayi(o.tutar) ?? 0), 0);

  const aracSec = (id: string) => {
    setAracId(id);
    const a = araclar.find((x) => String(x.id) === id);
    if (teklif) return; // fiyat ve vergi oranları tekliften gelir
    if (a?.kdv !== null && a?.kdv !== undefined) setKdv(String(a.kdv));
    if (a?.otv !== null && a?.otv !== undefined) setOtv(String(a.otv));
  };

  const musteriGetir = async () => {
    const f = formRef.current;
    if (!f) return;
    const kimlik = (f.elements.namedItem("kimlikNo") as HTMLInputElement).value;
    const m = await musteriBul(kimlik);
    if (!m) return setBulMesaj("Bu numarayla kayıtlı müşteri yok; yeni müşteri olarak kaydedilecek.");
    for (const [alan, deger] of Object.entries(m)) {
      const el = f.elements.namedItem(alan) as HTMLInputElement | null;
      if (el && !el.value) el.value = deger;
    }
    setBulMesaj(`Kayıtlı müşteri bulundu: ${m.unvan}`);
  };

  const odemeGuncelle = (anahtar: number, alan: keyof Odeme, deger: string) =>
    setOdemeler((l) => l.map((o) => (o.anahtar === anahtar ? { ...o, [alan]: deger } : o)));

  return (
    <form ref={formRef} onSubmit={sifirlamadan(gonder)} className="space-y-4">
      <HataKutusu mesaj={durum?.genel} />
      {teklif && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <input type="hidden" name="teklifId" value={teklif.id} />
          {teklif.no} numaralı teklif ({teklif.toplam.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}) satışa dönüştürülüyor. Araç satırının fiyatı ve vergi oranları forma aktarıldı.
          {teklif.digerler && ` Diğer kalemler aksesuar alanına yazıldı${teklif.digerTutar ? `; fiyatlı olanlar (${teklif.digerTutar.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}) satış tutarına dahil değil, ayrıca hızlı satışla girilebilir` : ""}.`}
        </div>
      )}
      <Kart baslik="Araç">
        <div className="grid gap-4 md:grid-cols-3">
          <Alan etiket="Stoktaki araç" hata={h.aracId} className="md:col-span-3">
            <Secim name="aracId" value={aracId} onChange={(e) => aracSec(e.target.value)} required>
              <option value="">{teklif ? `Araç seçin (teklifteki model: ${teklif.modelAd})` : "Araç seçin"}</option>
              {teklif && (
                <optgroup label={uygun.length ? `Teklifteki model · ${uygun.length} araç` : "Teklifteki model stokta yok"}>
                  {uygun.map((a) => <option key={a.id} value={a.id}>{a.etiket}</option>)}
                </optgroup>
              )}
              {teklif ? (
                <optgroup label="Diğer araçlar">{digerAraclar.map((a) => <option key={a.id} value={a.id}>{a.etiket}</option>)}</optgroup>
              ) : (
                araclar.map((a) => <option key={a.id} value={a.id}>{a.etiket}</option>)
              )}
            </Secim>
          </Alan>
        </div>
      </Kart>

      <Kart baslik="Müşteri">
        <div className="grid gap-4 md:grid-cols-3">
          <Alan etiket="TCKN / VKN" hata={h.kimlikNo}>
            <div className="flex gap-2">
              <Girdi name="kimlikNo" defaultValue={teklif?.musteri.kimlikNo} inputMode="numeric" required />
              <Buton type="button" tur="ikincil" onClick={musteriGetir}>Getir</Buton>
            </div>
            {bulMesaj && <span className="mt-1 block text-xs text-zinc-500">{bulMesaj}</span>}
          </Alan>
          <Alan etiket="Ad soyad / ünvan" hata={h.unvan} className="md:col-span-2"><Girdi name="unvan" defaultValue={teklif?.musteri.unvan} required /></Alan>
          <Alan etiket="Cep telefonu" hata={h.telefon}><Girdi name="telefon" defaultValue={teklif?.musteri.telefon} inputMode="tel" placeholder="5xx xxx xx xx" required /></Alan>
          <Alan etiket="E-posta" hata={h.eposta}><Girdi name="eposta" defaultValue={teklif?.musteri.eposta} type="email" /></Alan>
          <Alan etiket="Vergi dairesi (kurumsal)"><Girdi name="vergiDairesi" /></Alan>
          <Alan etiket="TCKK seri no"><Girdi name="tckkSeriNo" /></Alan>
          <Alan etiket="Doğum tarihi" hata={h.dogumTarihi}><Girdi name="dogumTarihi" type="date" /></Alan>
          <div />
          <Alan etiket="İl" hata={h.il}><Girdi name="il" required /></Alan>
          <Alan etiket="İlçe" hata={h.ilce}><Girdi name="ilce" required /></Alan>
          <Alan etiket="Açık adres" hata={h.acikAdres} className="md:col-span-3"><Girdi name="acikAdres" required placeholder="Mahalle, sokak, no" /></Alan>
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="eTebligat" /> E-tebligat adresi var</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="kvkkOnay" /> KVKK aydınlatma onayı alındı</label>
        </div>
      </Kart>

      <Kart baslik="Fiyat">
        <div className="grid gap-4 md:grid-cols-3">
          <Alan etiket="Satış tutarı (KDV dahil, faturaya yazılır)" hata={h.genelToplam}>
            <Girdi name="genelToplam" inputMode="decimal" value={toplam} onChange={(e) => setToplam(e.target.value)} required />
          </Alan>
          <Alan etiket="KDV oranı" hata={h.kdvOrani}>
            <Secim name="kdvOrani" value={kdv} onChange={(e) => setKdv(e.target.value)}>
              {kdvOranlari.map((o) => <option key={o} value={o}>{yuzde(Number(o))}</option>)}
            </Secim>
          </Alan>
          <Alan etiket="ÖTV oranı (elle seçilir)" hata={h.otvOrani}>
            <Secim name="otvOrani" value={otv} onChange={(e) => setOtv(e.target.value)} required>
              <option value="">Seçin</option>
              {otvOranlari.map((o) => <option key={o} value={String(o)}>{yuzde(o)}</option>)}
            </Secim>
          </Alan>
        </div>
        {kirilim && (
          <p className="mt-3 text-sm text-zinc-600">
            Matrah {tl(kirilim.matrah)} · ÖTV {tl(kirilim.otv)} · KDV {tl(kirilim.kdv)}
          </p>
        )}
      </Kart>

      <Kart baslik="Ödemeler" sag={<span className={`text-sm ${genel && Math.abs(genel - odemeToplam) >= 0.5 ? "text-amber-600" : "text-zinc-600"}`}>{tl(odemeToplam)} / {tl(genel)}</span>}>
        <OdemeSatirlari odemeler={odemeler} guncelle={odemeGuncelle} sil={(a) => setOdemeler((l) => l.filter((x) => x.anahtar !== a))} />
        {h.odemeler && <p className="mt-2 text-xs text-red-600">{h.odemeler}</p>}
        <Buton type="button" tur="ikincil" className="mt-3" onClick={() => setOdemeler((l) => [...l, yeniOdeme()])}>
          Ödeme satırı ekle
        </Buton>
      </Kart>

      <Kart baslik="Teslim ve notlar">
        <div className="grid gap-4 md:grid-cols-3">
          <Alan etiket="Teslim tarihi" hata={h.teslimTarihi}><Girdi name="teslimTarihi" type="date" /></Alan>
          <Alan etiket="Aksesuarlar" className="md:col-span-2"><Girdi name="aksesuarlar" defaultValue={teklif?.digerler} placeholder="Kask, çanta..." /></Alan>
          <Alan etiket="Hizmetler" className="md:col-span-3"><Girdi name="hizmetler" placeholder="Tescil takibi, nakliye..." /></Alan>
          <Alan etiket="Not" className="md:col-span-3"><MetinAlani name="not" defaultValue={teklif?.not} /></Alan>
        </div>
      </Kart>

      {durum?.uyari && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{durum.uyari}</p>}
      {durum?.onayIste && <input type="hidden" name="farkOnay" value="1" />}
      <Buton type="submit" disabled={bekliyor}>{bekliyor ? "Kaydediliyor..." : "Satışı kaydet"}</Buton>
    </form>
  );
}
