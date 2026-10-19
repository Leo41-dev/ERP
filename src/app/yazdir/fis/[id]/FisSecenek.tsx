"use client";
import { useState, type ReactNode } from "react";

/** Fiş boyutu: 80 mm termal rulo ya da A5 */
export function FisSecenek({ children }: { children: ReactNode }) {
  const [boyut, setBoyut] = useState<"rulo" | "a5">("rulo");
  return (
    <>
      <style>{boyut === "rulo" ? "@page { size: 80mm auto; margin: 3mm }" : "@page { size: A5; margin: 10mm }"}</style>
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-zinc-200 bg-white p-3 text-sm print:hidden">
        <select value={boyut} onChange={(e) => setBoyut(e.target.value as "rulo" | "a5")} className="rounded-md border border-zinc-300 px-2 py-1.5">
          <option value="rulo">Termal fiş (80 mm)</option>
          <option value="a5">A5 kâğıt</option>
        </select>
        <button onClick={() => window.print()} className="rounded-md bg-zinc-900 px-3.5 py-1.5 font-medium text-white">Yazdır</button>
      </div>
      <div className={`fis mx-auto bg-white text-black ${boyut === "rulo" ? "w-[74mm] text-[11px]" : "w-[128mm] text-[12px]"} my-4 p-2 shadow print:my-0 print:p-0 print:shadow-none`}>{children}</div>
    </>
  );
}
