"use client";
import { useState, useTransition } from "react";
import { senetTahsilEdildi, tahsilatIptal } from "./eylem";

export function TahsilatIptalButonu({ id }: { id: number }) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState("");
  return (
    <>
      <button
        disabled={bekliyor}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
        onClick={() => {
          const neden = prompt("İptal nedeni (tahsilat silinmez, cariye ters kayıt atılır):");
          if (neden) basla(async () => setHata((await tahsilatIptal(id, neden)).hata ?? ""));
        }}
      >
        İptal
      </button>
      {hata && <span className="ml-1 text-xs text-red-600">{hata}</span>}
    </>
  );
}

export function SenetTahsilButonu({ id }: { id: number }) {
  const [bekliyor, basla] = useTransition();
  return (
    <button
      disabled={bekliyor}
      className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
      onClick={() => confirm("Tahsil edildi olarak işaretlensin mi?") && basla(async () => void (await senetTahsilEdildi(id)))}
    >
      Tahsil edildi
    </button>
  );
}
