"use client";
import { useActionState, useTransition } from "react";
import { Alan, Buton, Girdi, HataKutusu } from "@/components/ui";
import type { TeklifDurumu } from "../eylem";

export function RetFormu({ eylem }: { eylem: (d: TeklifDurumu, f: FormData) => Promise<TeklifDurumu> }) {
  const [d, gonder, bekliyor] = useActionState(eylem, undefined);
  return (
    <form action={gonder} className="space-y-2">
      <HataKutusu mesaj={d?.genel} />
      <Alan etiket="Ret nedeni"><Girdi name="neden" required placeholder="Fiyat yüksek bulundu, başka bayi, vazgeçti..." /></Alan>
      <Buton tur="ikincil" disabled={bekliyor}>Reddedildi olarak işaretle</Buton>
    </form>
  );
}

export function YenidenAcButonu({ eylem }: { eylem: () => Promise<void> }) {
  const [bekliyor, baslat] = useTransition();
  return <Buton tur="ikincil" disabled={bekliyor} onClick={() => baslat(() => eylem())}>Teklifi yeniden aç</Buton>;
}
