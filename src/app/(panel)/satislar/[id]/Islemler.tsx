"use client";
import { useActionState } from "react";
import { Alan, Buton, Girdi, HataKutusu } from "@/components/ui";
import type { SatisDurum } from "../eylem";

type Eylem = (d: SatisDurum, f: FormData) => Promise<SatisDurum>;

export function IptalFormu({ eylem }: { eylem: Eylem }) {
  const [d, gonder, bekliyor] = useActionState(eylem, undefined);
  return (
    <form action={gonder} className="space-y-2">
      <HataKutusu mesaj={d?.genel} />
      <Alan etiket="İptal nedeni"><Girdi name="neden" required /></Alan>
      <Buton tur="tehlike" disabled={bekliyor} onClick={(e) => { if (!confirm("Satış iptal edilsin mi? Araç ve ürünler stoğa döner.")) e.preventDefault(); }}>Satışı iptal et</Buton>
    </form>
  );
}

export function FaturaFormu({ eylem }: { eylem: Eylem }) {
  const [d, gonder, bekliyor] = useActionState(eylem, undefined);
  return (
    <form action={gonder} className="space-y-2">
      <HataKutusu mesaj={d?.genel} />
      <Alan etiket="Fatura no"><Girdi name="faturaNo" required className="uppercase" /></Alan>
      <Buton disabled={bekliyor}>Faturalandı olarak işaretle</Buton>
    </form>
  );
}

export function TeslimKontrolFormu({ eylem, maddeler, kontrolEden }: { eylem: Eylem; maddeler: { id: number; ad: string; tamam: boolean }[]; kontrolEden: string }) {
  const [d, gonder, bekliyor] = useActionState(eylem, undefined);
  return (
    <form action={gonder} className="space-y-3">
      <HataKutusu mesaj={d?.genel} />
      <ul className="grid gap-1.5 text-sm md:grid-cols-2">
        {maddeler.map((m) => (
          <li key={m.id}><label className="flex items-center gap-2"><input type="checkbox" name={`madde_${m.id}`} defaultChecked={m.tamam} /> {m.ad}</label></li>
        ))}
      </ul>
      <div className="flex items-end gap-2">
        <Alan etiket="Kontrol eden"><Girdi name="kontrolEden" defaultValue={kontrolEden} required /></Alan>
        <Buton tur="ikincil" disabled={bekliyor}>Kaydet</Buton>
      </div>
    </form>
  );
}
