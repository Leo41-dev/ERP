"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { sifirlamadan } from "@/components/form";
import { Alan, Buton, Girdi, HataKutusu, MetinAlani, Secim } from "@/components/ui";
import { hareketIptal, hareketKaydet, type FinansDurum } from "./eylem";

const TUR_AD = { KASA: "Kasa", BANKA: "Banka hesabı", POS: "POS", KREDI_KARTI: "Kredi kartı" };

export type HesapVerisi = {
  ad: string; tur: string; firmaId: number | null; banka: string | null; sube: string | null; hesapNo: string | null; iban: string | null;
  paraBirimi: string; acilisBakiye: number; acilisTarihi: string; aciklama: string | null; aktif: boolean;
};

export function HesapFormu({ eylem, hesap, firmalar, bugun }: { eylem: (d: FinansDurum, f: FormData) => Promise<FinansDurum>; hesap?: HesapVerisi; firmalar: { id: number; unvan: string }[]; bugun: string }) {
  const [d, gonder, bekliyor] = useActionState(eylem, undefined);
  const h = d?.hatalar ?? {};
  const [tur, setTur] = useState(hesap?.tur ?? "BANKA");
  const banka = tur !== "KASA";
  return (
    <form onSubmit={sifirlamadan(gonder)} className="grid gap-3 md:grid-cols-3">
      <HataKutusu mesaj={d?.genel} />
      <Alan etiket="Hesap adı" hata={h.ad}><Girdi name="ad" defaultValue={hesap?.ad} placeholder="Ör. Ziraat TL, Merkez kasa" required /></Alan>
      <Alan etiket="Tür" hata={h.tur}>
        <Secim name="tur" value={tur} onChange={(e) => setTur(e.target.value)}>
          {Object.entries(TUR_AD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Secim>
      </Alan>
      <Alan etiket="Para birimi">
        <Secim name="paraBirimi" defaultValue={hesap?.paraBirimi ?? "TRY"}><option value="TRY">TL</option><option value="EUR">Euro</option><option value="USD">Dolar</option></Secim>
      </Alan>
      {banka && (
        <>
          <Alan etiket="Banka"><Girdi name="banka" defaultValue={hesap?.banka ?? ""} /></Alan>
          <Alan etiket="Şube"><Girdi name="sube" defaultValue={hesap?.sube ?? ""} /></Alan>
          <Alan etiket="Hesap / kart no"><Girdi name="hesapNo" defaultValue={hesap?.hesapNo ?? ""} /></Alan>
          {tur === "BANKA" && <Alan etiket="IBAN" hata={h.iban} className="md:col-span-2"><Girdi name="iban" defaultValue={hesap?.iban ?? ""} placeholder="TR.." className="font-mono" /></Alan>}
        </>
      )}
      {firmalar.length > 1 && (
        <Alan etiket="Firma">
          <Secim name="firmaId" defaultValue={String(hesap?.firmaId ?? "")}>
            <option value="">Ortak</option>
            {firmalar.map((f) => <option key={f.id} value={f.id}>{f.unvan}</option>)}
          </Secim>
        </Alan>
      )}
      <Alan etiket="Açılış bakiyesi" hata={h.acilisBakiye}><Girdi name="acilisBakiye" inputMode="decimal" defaultValue={hesap ? String(hesap.acilisBakiye).replace(".", ",") : ""} placeholder="0" /></Alan>
      <Alan etiket="Açılış tarihi"><Girdi name="acilisTarihi" type="date" defaultValue={hesap?.acilisTarihi ?? bugun} /></Alan>
      <Alan etiket="Not" className="md:col-span-3"><MetinAlani name="aciklama" rows={2} defaultValue={hesap?.aciklama ?? ""} /></Alan>
      {hesap && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="aktif" defaultChecked={hesap.aktif} /> Aktif (pasif hesap ödeme ekranlarında görünmez)</label>}
      <div className="flex items-center gap-3 md:col-span-3">
        <Buton disabled={bekliyor}>{hesap ? "Kaydet" : "Hesabı aç"}</Buton>
        {d?.tamam && <span className="text-sm text-green-700">{d.tamam}</span>}
      </div>
    </form>
  );
}

type Secenek = { id: number; ad: string };
type Kategori = Secenek & { tur: "GELIR" | "GIDER" };
type CariBulunan = { id: number; unvan: string; telefon: string | null };

/** Cari arayıp seçen kutu (/musteriler/ara) */
function CariSecici({ hata }: { hata?: string }) {
  const [yazi, setYazi] = useState("");
  const [secili, setSecili] = useState<CariBulunan | null>(null);
  const [liste, setListe] = useState<CariBulunan[]>([]);
  const sira = useRef(0);
  useEffect(() => {
    if (secili || yazi.trim().length < 2) return setListe([]);
    const no = ++sira.current;
    const t = setTimeout(async () => {
      const r = await fetch(`/musteriler/ara?q=${encodeURIComponent(yazi.trim())}`).catch(() => null);
      const l: CariBulunan[] = r?.ok ? await r.json() : [];
      if (no === sira.current) setListe(l);
    }, 250);
    return () => clearTimeout(t);
  }, [yazi, secili]);
  return (
    <Alan etiket="Cari (isteğe bağlı)" hata={hata} className="relative">
      <input type="hidden" name="cariId" value={secili?.id ?? ""} />
      <Girdi value={secili ? secili.unvan : yazi} onChange={(e) => { setSecili(null); setYazi(e.target.value); }} placeholder="Tedarikçi, müşteri, personel..." autoComplete="off" />
      {liste.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white text-sm shadow">
          {liste.map((c) => (
            <li key={c.id}><button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-zinc-50" onClick={() => { setSecili(c); setListe([]); }}>{c.unvan}{c.telefon ? <span className="ml-2 text-xs text-zinc-500">{c.telefon}</span> : null}</button></li>
          ))}
        </ul>
      )}
    </Alan>
  );
}

export function HareketFormu({ hesaplar, kategoriler, hesapId, tur: ilkTur, bugun }: { hesaplar: Secenek[]; kategoriler: Kategori[]; hesapId?: number; tur?: string; bugun: string }) {
  const [d, gonder, bekliyor] = useActionState(hareketKaydet, undefined);
  const h = d?.hatalar ?? {};
  const [tur, setTur] = useState(ilkTur && ["GIRIS", "CIKIS", "VIRMAN"].includes(ilkTur) ? ilkTur : "CIKIS");
  const kats = kategoriler.filter((k) => k.tur === (tur === "GIRIS" ? "GELIR" : "GIDER"));
  return (
    <form onSubmit={sifirlamadan(gonder)} className="grid gap-3 md:grid-cols-3">
      <HataKutusu mesaj={d?.genel} />
      <div className="flex gap-2 md:col-span-3" role="radiogroup" aria-label="İşlem">
        {[["CIKIS", "Çıkış (masraf, ödeme)"], ["GIRIS", "Giriş (gelir)"], ["VIRMAN", "Virman (hesaplar arası)"]].map(([k, v]) => (
          <label key={k} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${tur === k ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`}>
            <input type="radio" name="tur" value={k} checked={tur === k} onChange={() => setTur(k)} className="sr-only" /> {v}
          </label>
        ))}
      </div>
      <Alan etiket={tur === "VIRMAN" ? "Çıkan hesap" : "Hesap"} hata={h.hesapId}>
        <Secim name="hesapId" defaultValue={String(hesapId ?? "")} required>
          <option value="" disabled>Seçin</option>
          {hesaplar.map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
        </Secim>
      </Alan>
      {tur === "VIRMAN" ? (
        <Alan etiket="Giren hesap" hata={h.hedefId}>
          <Secim name="hedefId" defaultValue="" required>
            <option value="" disabled>Seçin</option>
            {hesaplar.map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
          </Secim>
        </Alan>
      ) : (
        <Alan etiket="Kategori" hata={h.kategoriId}>
          <Secim name="kategoriId" key={tur} defaultValue="">
            <option value="">Kategorisiz (cariye bağlı)</option>
            {kats.map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
          </Secim>
        </Alan>
      )}
      <Alan etiket="Tutar" hata={h.tutar}><Girdi name="tutar" inputMode="decimal" required /></Alan>
      <Alan etiket="Tarih" hata={h.tarih}><Girdi name="tarih" type="date" defaultValue={bugun} max={bugun} /></Alan>
      <Alan etiket="Belge no (dekont, fatura)"><Girdi name="belgeNo" /></Alan>
      {tur !== "VIRMAN" && <CariSecici hata={h.cariId} />}
      <Alan etiket="Açıklama" className="md:col-span-3"><Girdi name="aciklama" /></Alan>
      <p className="text-xs text-zinc-500 md:col-span-3">
        Cari seçilirse cari hesaba da işlenir: giriş cariyi alacaklandırır, çıkış borçlandırır (ör. tedarikçiye ödeme). Müşteriden satış tahsilatı için Tahsilat ekranını kullanın.
      </p>
      <div className="md:col-span-3"><Buton disabled={bekliyor}>{bekliyor ? "Kaydediliyor..." : "Kaydet"}</Buton></div>
    </form>
  );
}

export function HareketIptalButonu({ id }: { id: number }) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState("");
  return (
    <>
      <button
        disabled={bekliyor}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
        onClick={() => {
          const neden = prompt("İptal nedeni (hareket silinmez, bakiyeden düşülür):");
          if (neden) basla(async () => setHata((await hareketIptal(id, neden)).hata ?? ""));
        }}
      >
        İptal
      </button>
      {hata && <span className="ml-1 text-xs text-red-600">{hata}</span>}
    </>
  );
}
