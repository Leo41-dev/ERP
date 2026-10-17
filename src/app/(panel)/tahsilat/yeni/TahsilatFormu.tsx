"use client";
import { useActionState, useState } from "react";
import { sifirlamadan } from "@/components/form";
import { OdemeSatirlari, yeniOdeme, type Odeme } from "@/components/OdemeSatirlari";
import { Alan, Buton, Girdi, HataKutusu, Kart, Secim } from "@/components/ui";
import { sayi } from "@/lib/normalize";
import { tahsilatKaydet } from "../eylem";

type AcikSatis = { id: number; formNo: number; kalan: number; aciklama: string };
const tl = (n: number) => n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

export function TahsilatFormu({ cariId, satislar, secili, bugun }: { cariId: number; satislar: AcikSatis[]; secili: number | null; bugun: string }) {
  const [durum, gonder, bekliyor] = useActionState(tahsilatKaydet, undefined);
  const h = durum?.hatalar ?? {};
  const ilk = satislar.find((s) => s.id === secili);
  const [satisId, setSatisId] = useState(ilk ? String(ilk.id) : "");
  const [odemeler, setOdemeler] = useState<Odeme[]>([yeniOdeme("NAKIT", ilk ? String(ilk.kalan).replace(".", ",") : "")]);
  const toplam = odemeler.reduce((t, o) => t + (sayi(o.tutar) ?? 0), 0);
  const kalan = satislar.find((s) => String(s.id) === satisId)?.kalan;

  const satisSec = (id: string) => {
    setSatisId(id);
    const s = satislar.find((x) => String(x.id) === id);
    // tek ödeme satırı boşsa satışın kalanı önerilir
    if (s && odemeler.length === 1) setOdemeler([{ ...odemeler[0], tutar: String(s.kalan).replace(".", ",") }]);
  };

  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-4">
      <input type="hidden" name="cariId" value={cariId} />
      <HataKutusu mesaj={durum?.genel} />
      <Kart>
        <div className="grid gap-3 md:grid-cols-3">
          <Alan etiket="Hangi satış için" className="md:col-span-2">
            <Secim name="satisId" value={satisId} onChange={(e) => satisSec(e.target.value)}>
              <option value="">Satışa bağlı değil (genel tahsilat, kapora, eski bakiye)</option>
              {satislar.map((s) => <option key={s.id} value={s.id}>Satış {s.formNo} · {s.aciklama} · kalan {tl(s.kalan)}</option>)}
            </Secim>
          </Alan>
          <Alan etiket="Tahsilat tarihi"><Girdi name="tarih" type="date" defaultValue={bugun} max={bugun} /></Alan>
        </div>
      </Kart>
      <Kart baslik="Ödeme" sag={<span className={`text-sm ${kalan !== undefined && toplam - kalan >= 0.01 ? "text-amber-600" : "text-zinc-600"}`}>{tl(toplam)}{kalan !== undefined ? ` / kalan ${tl(kalan)}` : ""}</span>}>
        <OdemeSatirlari
          odemeler={odemeler}
          guncelle={(a, alan, d) => setOdemeler((l) => l.map((o) => (o.anahtar === a ? { ...o, [alan]: d } : o)))}
          sil={(a) => setOdemeler((l) => l.filter((o) => o.anahtar !== a))}
        />
        {h.odemeler && <p className="mt-2 text-xs text-red-600">{h.odemeler}</p>}
        <Buton type="button" tur="ikincil" className="mt-3" onClick={() => setOdemeler((l) => [...l, yeniOdeme("NAKIT")])}>Ödeme satırı ekle</Buton>
        <Alan etiket="Açıklama" className="mt-4"><Girdi name="aciklama" placeholder="Kapora, kalan ödeme, taksit..." /></Alan>
      </Kart>
      <Buton type="submit" disabled={bekliyor}>{bekliyor ? "Kaydediliyor..." : `Tahsilatı kaydet · ${tl(toplam)}`}</Buton>
    </form>
  );
}
