"use client";

export function YazdirButon() {
  return (
    <button onClick={() => window.print()} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white print:hidden">
      Yazdır
    </button>
  );
}
