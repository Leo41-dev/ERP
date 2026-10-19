"use client";
import { useActionState } from "react";
import { Buton, HataKutusu } from "@/components/ui";
import type { SayimDurum } from "../eylem";

export function SayimKapatButonu({ eylem, farkli }: { eylem: (d: SayimDurum) => Promise<SayimDurum>; farkli: number }) {
  const [durum, gonder, bekliyor] = useActionState(eylem, undefined);
  return (
    <form
      action={gonder}
      onSubmit={(e) => {
        if (!confirm(`Sayım kapatılacak ve ${farkli} üründeki fark stoğa işlenecek. Kapanan sayım değiştirilemez. Devam edilsin mi?`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <HataKutusu mesaj={durum?.genel} />
      <Buton type="submit" disabled={bekliyor}>{bekliyor ? "İşleniyor..." : "Sayımı kapat ve farkları işle"}</Buton>
    </form>
  );
}
