"use client";
import { useActionState } from "react";
import { kayitSil, type SilDurum } from "@/app/(panel)/eylem";
import type { SilinebilirTur } from "@/lib/silme";
import { Buton } from "./ui";

/**
 * Kayıt silme düğmesi: onay ister; kayıt kullanılıyorsa nedenini gösterir.
 * kucuk: tanım listelerinde yazı düğmesi, silinince sayfada kalır. Değilse kart sayfasında, silinince listeye döner.
 */
export function SilButonu({ tur, id, ad, kucuk = false }: { tur: SilinebilirTur; id: number; ad: string; kucuk?: boolean }) {
  const [d, gonder, bekliyor] = useActionState<SilDurum, FormData>(() => kayitSil(tur, id, kucuk ? "kal" : "liste", undefined), undefined);
  const onayla = (e: React.FormEvent) => {
    if (!confirm(`"${ad}" silinsin mi? Bu işlem geri alınamaz.`)) e.preventDefault();
  };
  return (
    <form action={gonder} onSubmit={onayla} className={kucuk ? "inline" : "relative inline-flex"}>
      {kucuk ? (
        <button disabled={bekliyor} className="text-xs text-zinc-500 hover:text-red-600 disabled:opacity-50">Sil</button>
      ) : (
        <Buton tur="ikincil" disabled={bekliyor} className="text-red-700 hover:bg-red-50">{bekliyor ? "Siliniyor..." : "Sil"}</Buton>
      )}
      {d?.hata && (
        <span role="alert" className={kucuk ? "ml-2 text-xs text-red-600" : "absolute right-0 top-full z-10 mt-1 w-80 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 shadow-sm"}>
          {d.hata}
        </span>
      )}
    </form>
  );
}
