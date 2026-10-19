"use client";
import { useEffect, useRef, useState } from "react";
import type { UrunBulunan } from "@/app/(panel)/stok/ara/route";

export type { UrunBulunan };

/**
 * Stok kartı arayan metin kutusu. Yazdıkça /stok/ara'dan öneri getirir; barkod okutulup Enter'a basılınca
 * tek ve tam eşleşen ürün doğrudan seçilir. Seçilmeden yazılan metin serbest satır olarak kalır.
 */
export function UrunSecici({
  deger, onYazi, onSec, secili, placeholder, autoFocus, name, className,
}: {
  deger: string;
  onYazi: (s: string) => void;
  onSec: (u: UrunBulunan) => void;
  secili: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  name?: string;
  className?: string;
}) {
  const [liste, setListe] = useState<UrunBulunan[]>([]);
  const [acik, setAcik] = useState(false);
  const [imlec, setImlec] = useState(0);
  const sira = useRef(0);

  useEffect(() => {
    if (secili || deger.trim().length < 2) {
      setListe([]);
      return;
    }
    const no = ++sira.current;
    const t = setTimeout(async () => {
      const r = await fetch(`/stok/ara?q=${encodeURIComponent(deger.trim())}`).catch(() => null);
      const l: UrunBulunan[] = r?.ok ? await r.json() : [];
      if (no === sira.current) {
        setListe(l);
        setImlec(0);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [deger, secili]);

  const sec = (u: UrunBulunan) => {
    onSec(u);
    setAcik(false);
    setListe([]);
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        name={name}
        value={deger}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onYazi(e.target.value);
          setAcik(true);
        }}
        onFocus={() => setAcik(true)}
        onBlur={() => setTimeout(() => setAcik(false), 150)}
        onKeyDown={async (e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setImlec((i) => Math.min(i + 1, liste.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setImlec((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Escape") setAcik(false);
          else if (e.key === "Enter" && !secili && deger.trim()) {
            e.preventDefault();
            if (acik && liste[imlec]) return sec(liste[imlec]);
            // barkod okuyucu metni yazıp hemen Enter gönderir; listeyi beklemeden tam eşleşme aranır
            const r = await fetch(`/stok/ara?q=${encodeURIComponent(deger.trim())}`).catch(() => null);
            const l: UrunBulunan[] = r?.ok ? await r.json() : [];
            const tam = l.find((u) => u.barkod === deger.trim() || u.kod === deger.trim().toLocaleUpperCase("tr-TR"));
            if (tam) sec(tam);
            else { setListe(l); setAcik(true); }
          }
        }}
        className={`w-full rounded-md border px-3 py-2 text-sm uppercase focus:outline-none ${secili ? "border-blue-300 bg-blue-50/50 focus:border-blue-500" : "border-zinc-300 bg-white focus:border-zinc-500"}`}
      />
      {acik && liste.length > 0 && (
        <ul className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg">
          {liste.map((u, i) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => sec(u)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left ${i === imlec ? "bg-zinc-100" : ""}`}
              >
                <span className="min-w-0 truncate"><span className="font-mono text-xs text-zinc-500">{u.kod}</span> {u.ad}</span>
                <span className={`shrink-0 text-xs tabular-nums ${u.tur === "HIZMET" ? "text-zinc-400" : u.miktar <= 0 ? "text-red-600" : "text-zinc-500"}`}>
                  {u.tur === "HIZMET" ? "hizmet" : `${u.miktar.toLocaleString("tr-TR")} ${u.birim}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
