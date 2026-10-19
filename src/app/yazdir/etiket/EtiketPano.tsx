"use client";
import { useState, type ReactNode } from "react";

/** Etiket yazıcı ayarı: yön ve kayma (mm). Kağıt boyutu etiketle aynı, ölçek %100, kenar boşluğu yok. */
export function EtiketPano({ adet, children }: { adet: number; children: ReactNode }) {
  const [yon, setYon] = useState<"y" | "d">("y");
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const boyut = yon === "y" ? "58mm 40mm" : "40mm 58mm";
  return (
    <>
      <style>{`@page { size: ${boyut}; margin: 0 }`}</style>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 text-sm print:hidden">
        <b>{adet} etiket</b>
        <select value={yon} onChange={(e) => setYon(e.target.value as "y" | "d")} className="rounded-md border border-zinc-300 px-2 py-1.5">
          <option value="y">Yatay 58×40 mm</option>
          <option value="d">Dikey 40×58 mm</option>
        </select>
        <label className="flex items-center gap-1 text-zinc-600">Sağa/sola (mm)<input type="number" step="0.5" value={dx} onChange={(e) => setDx(Number(e.target.value) || 0)} className="w-16 rounded-md border border-zinc-300 px-2 py-1" /></label>
        <label className="flex items-center gap-1 text-zinc-600">Aşağı/yukarı (mm)<input type="number" step="0.5" value={dy} onChange={(e) => setDy(Number(e.target.value) || 0)} className="w-16 rounded-md border border-zinc-300 px-2 py-1" /></label>
        <button onClick={() => window.print()} className="rounded-md bg-zinc-900 px-3.5 py-1.5 font-medium text-white">Hepsini yazdır</button>
        <span className="text-xs text-zinc-500">Yazdırırken kağıt boyutu etiketle aynı, ölçek %100, kenar boşluğu yok olmalı.</span>
      </div>
      <div className={`etiketler ${yon} bg-zinc-100 p-4 print:bg-white print:p-0`} style={{ ["--dx" as string]: `${dx}mm`, ["--dy" as string]: `${dy}mm` }}>
        {children}
      </div>
    </>
  );
}
