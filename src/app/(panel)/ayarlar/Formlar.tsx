"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { Buton, HataKutusu } from "@/components/ui";
import { sifirlamadan } from "@/components/form";
import type { AyarDurum } from "./eylem";

type Eylem = (d: AyarDurum, f: FormData) => Promise<AyarDurum>;

/** Ayarlar sayfasındaki küçük formlar: hata olursa yazılanlar korunur, başarıda form temizlenir. */
export function AyarFormu({ eylem, buton = "Ekle", children, className = "flex flex-wrap items-end gap-2" }: { eylem: Eylem; buton?: string; children: ReactNode; className?: string }) {
  const [d, gonder, bekliyor] = useActionState(eylem, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (d?.tamam) ref.current?.reset();
  }, [d]);
  return (
    <div className="space-y-2">
      <form ref={ref} onSubmit={sifirlamadan(gonder)} className={className}>
        {children}
        <Buton disabled={bekliyor}>{buton}</Buton>
      </form>
      <HataKutusu mesaj={d?.hata} />
      {d?.tamam && <p className="text-xs text-green-700">{d.tamam}</p>}
    </div>
  );
}

export function AktiflikButonu({ eylem, aktif }: { eylem: () => Promise<void>; aktif: boolean }) {
  return (
    <form action={eylem}>
      <button className="text-xs text-zinc-500 hover:text-zinc-900">{aktif ? "Pasif yap" : "Aktif yap"}</button>
    </form>
  );
}
