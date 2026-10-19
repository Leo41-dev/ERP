"use client";
import { useSearchParams } from "next/navigation";

/** Kart sayfasından silinip listeye dönülünce (?silindi=1) kısa bilgi */
export function SilindiBildirimi() {
  if (useSearchParams().get("silindi") !== "1") return null;
  return <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Kayıt silindi.</p>;
}
