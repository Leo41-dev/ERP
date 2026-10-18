"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { kisa, type Birim } from "./bicim";

export type Seri = { ad: string; degerler: (number | null)[]; renk: string };
export type GrafikVeri = {
  yon: "dikey" | "yatay";
  kategoriler: string[];
  seriler: Seri[];
  birim: Birim;
  yigin?: boolean; // seriler üst üste
  ipucu?: string[][]; // her kategori için ipucu satırları (tablonun satırı)
  kategoriRenk?: (string | null)[]; // tek seride kategoriye özel renk
  lejant?: { ad: string; renk: string }[]; // tek seride sabit lejant (ör. ABC sınıfı)
};

/** eksen adımı: 1, 2, 3, 4, 5, 6, 8 × 10ⁿ; üst değer dört adım (adette adım tam sayı) */
function yuvarla(n: number, birim: Birim) {
  const hedef = n > 0 ? n / 4 : 1;
  const us = 10 ** Math.floor(Math.log10(hedef));
  let adim = ([1, 2, 3, 4, 5, 6, 8, 10].find((c) => c * us >= hedef) ?? 10) * us;
  if (birim === "adet") adim = Math.max(1, Math.ceil(adim));
  return adim * 4;
}

/** taban tarafı düz, veri ucu 4px yuvarlak çubuk */
function cubuk(x: number, y: number, w: number, h: number, yon: "dikey" | "yatay", yuvarlak: boolean) {
  if (w <= 0 || h <= 0) return "";
  if (!yuvarlak) return `M${x},${y}h${w}v${h}h${-w}z`;
  const r = Math.min(4, yon === "dikey" ? w / 2 : h / 2, yon === "dikey" ? h : w);
  return yon === "dikey"
    ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}z`
    : `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}z`;
}

const kirp = (s: string, px: number) => { const n = Math.floor(px / 7); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s; };

function useGenislik() {
  const ref = useRef<HTMLDivElement>(null);
  const [g, setG] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setG(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, g] as const;
}

export function Grafik({ v }: { v: GrafikVeri }) {
  const [ref, G] = useGenislik();
  const [gizli, setGizli] = useState<string[]>([]);
  const [uzerinde, setUzerinde] = useState<{ i: number; x: number; y: number } | null>(null);
  const seriler = v.seriler.filter((s) => !gizli.includes(s.ad));
  const n = v.kategoriler.length;
  const toplam = (i: number) => seriler.reduce((t, s) => t + Math.max(0, s.degerler[i] ?? 0), 0);
  const enCok = yuvarla(Math.max(0, ...v.kategoriler.map((_, i) => (v.yigin ? toplam(i) : Math.max(0, ...seriler.map((s) => s.degerler[i] ?? 0))))), v.birim);
  const adimlar = [0, 0.25, 0.5, 0.75, 1].map((o) => o * enCok);
  const tekSeri = v.seriler.length === 1;
  const renk = (s: Seri, i: number) => (tekSeri && v.kategoriRenk?.[i]) || s.renk;

  const fare = (i: number) => (e: MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    setUzerinde({ i, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  let govde = null;
  let yukseklik = 0;
  if (G > 0 && v.yon === "dikey") {
    const sol = 52, ust = 16, Y = 220, alt = 36;
    yukseklik = ust + Y + alt;
    const genislik = (G - sol) / Math.max(n, 1);
    const grupG = Math.min(genislik - 2, v.yigin || seriler.length <= 1 ? 40 : 22 * seriler.length);
    const tekG = v.yigin ? grupG : (grupG - 2 * (seriler.length - 1)) / Math.max(seriler.length, 1);
    // sığmayan etiket boşluktan ikiye bölünür; yine sığmazsa (çok kategori) bazıları atlanır
    const satirlar = v.kategoriler.map((k) => {
      if (k.length * 6 + 6 <= genislik || !k.includes(" ")) return [k];
      const bosluklar = [...k.matchAll(/ /g)].map((m) => m.index!);
      const orta = bosluklar.reduce((a, b) => (Math.abs(b - k.length / 2) < Math.abs(a - k.length / 2) ? b : a));
      return [k.slice(0, orta), k.slice(orta + 1)];
    });
    const etiketAdim = Math.max(1, Math.ceil((Math.max(...satirlar.flat().map((k) => k.length)) * 6 + 6) / genislik));
    const yy = (d: number) => ust + Y * (1 - d / enCok);
    const degerEtiketi = seriler.length === 1 && n <= 12 && genislik >= 34;
    govde = (
      <>
        {adimlar.map((d) => (
          <g key={d}>
            <line x1={sol} x2={G} y1={yy(d)} y2={yy(d)} className={d === 0 ? "stroke-zinc-300" : "stroke-zinc-100"} />
            <text x={sol - 6} y={yy(d) + 3.5} textAnchor="end" className="fill-zinc-500 text-[10px]">{kisa(d, v.birim)}</text>
          </g>
        ))}
        {v.kategoriler.map((k, i) => {
          const x0 = sol + i * genislik + (genislik - grupG) / 2;
          let birikim = 0;
          const sonGorunen = seriler.map((s) => (s.degerler[i] ?? 0) > 0).lastIndexOf(true);
          return (
            <g key={k + i} onMouseMove={fare(i)} onMouseLeave={() => setUzerinde(null)}>
              <rect x={sol + i * genislik} y={ust} width={genislik} height={Y} className={uzerinde?.i === i ? "fill-zinc-100" : "fill-transparent"} />
              {seriler.map((s, j) => {
                const d = Math.max(0, s.degerler[i] ?? 0);
                const h = (d / enCok) * Y;
                if (v.yigin) {
                  const yol = cubuk(x0, ust + Y - birikim - h, tekG, Math.max(0, h - (j < sonGorunen ? 2 : 0)), "dikey", j === sonGorunen);
                  birikim += h;
                  return <path key={s.ad} d={yol} fill={renk(s, i)} />;
                }
                return <path key={s.ad} d={cubuk(x0 + j * (tekG + 2), ust + Y - h, tekG, h, "dikey", true)} fill={renk(s, i)} />;
              })}
              {degerEtiketi && (seriler[0].degerler[i] ?? 0) > 0 && (
                <text x={x0 + grupG / 2} y={yy(seriler[0].degerler[i]!) - 4} textAnchor="middle" className="fill-zinc-700 text-[10px] tabular-nums">{kisa(seriler[0].degerler[i]!, v.birim)}</text>
              )}
              {i % etiketAdim === 0 && (
                <text x={sol + i * genislik + genislik / 2} y={ust + Y + 15} textAnchor="middle" className="fill-zinc-600 text-[10px]">
                  {satirlar[i].map((s, j) => <tspan key={j} x={sol + i * genislik + genislik / 2} dy={j ? 12 : 0}>{s}</tspan>)}
                </text>
              )}
            </g>
          );
        })}
      </>
    );
  } else if (G > 0) {
    const etiketG = Math.min(Math.round(G * 0.38), Math.max(...v.kategoriler.map((k) => k.length)) * 7 + 10);
    const degerG = 64, ust = 4, satirH = v.yigin || seriler.length <= 1 ? 26 : 14 * seriler.length + 10;
    const alan = Math.max(40, G - etiketG - degerG);
    yukseklik = ust + n * satirH + 18;
    const xx = (d: number) => etiketG + (d / enCok) * alan;
    govde = (
      <>
        {adimlar.map((d) => (
          <g key={d}>
            <line x1={xx(d)} x2={xx(d)} y1={ust} y2={ust + n * satirH} className={d === 0 ? "stroke-zinc-300" : "stroke-zinc-100"} />
            <text x={xx(d)} y={ust + n * satirH + 13} textAnchor={d === 0 ? "start" : "middle"} className="fill-zinc-500 text-[10px]">{kisa(d, v.birim)}</text>
          </g>
        ))}
        {v.kategoriler.map((k, i) => {
          const y0 = ust + i * satirH;
          const cubukH = v.yigin || seriler.length <= 1 ? 16 : 12;
          let birikim = 0;
          const sonGorunen = seriler.map((s) => (s.degerler[i] ?? 0) > 0).lastIndexOf(true);
          const top = v.yigin ? toplam(i) : null;
          return (
            <g key={k + i} onMouseMove={fare(i)} onMouseLeave={() => setUzerinde(null)}>
              <rect x={0} y={y0} width={G} height={satirH} className={uzerinde?.i === i ? "fill-zinc-100" : "fill-transparent"} />
              <text x={0} y={y0 + satirH / 2 + 3.5} className="fill-zinc-700 text-[11px]">{kirp(k, etiketG - 8)}</text>
              {seriler.map((s, j) => {
                const d = Math.max(0, s.degerler[i] ?? 0);
                const w = (d / enCok) * alan;
                if (v.yigin) {
                  const yol = cubuk(etiketG + birikim, y0 + (satirH - cubukH) / 2, Math.max(0, w - (j < sonGorunen ? 2 : 0)), cubukH, "yatay", j === sonGorunen);
                  birikim += w;
                  return <path key={s.ad} d={yol} fill={renk(s, i)} />;
                }
                const yb = y0 + (satirH - (cubukH + 2) * seriler.length + 2) / 2 + j * (cubukH + 2);
                return (
                  <g key={s.ad}>
                    <path d={cubuk(etiketG, yb, w, cubukH, "yatay", true)} fill={renk(s, i)} />
                    <text x={etiketG + w + 4} y={yb + cubukH / 2 + 3.5} className="fill-zinc-600 text-[10px] tabular-nums">{s.degerler[i] === null ? "" : kisa(s.degerler[i]!, v.birim)}</text>
                  </g>
                );
              })}
              {top !== null && top > 0 && <text x={etiketG + birikim + 4} y={y0 + satirH / 2 + 3.5} className="fill-zinc-600 text-[10px] tabular-nums">{kisa(top, v.birim)}</text>}
            </g>
          );
        })}
      </>
    );
  }

  const lejant = v.lejant ?? (v.seriler.length > 1 ? v.seriler.map((s) => ({ ad: s.ad, renk: s.renk })) : []);
  const ip = uzerinde && (v.ipucu?.[uzerinde.i] ?? seriler.map((s) => `${s.ad}: ${s.degerler[uzerinde.i] === null ? "-" : kisa(s.degerler[uzerinde.i]!, v.birim)}`));
  return (
    <div>
      {lejant.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
          {lejant.map((l) => {
            const kapali = gizli.includes(l.ad);
            const ac = !v.lejant && v.seriler.length > 1;
            return (
              <button
                key={l.ad}
                type="button"
                disabled={!ac}
                onClick={() => setGizli((g) => (kapali ? g.filter((x) => x !== l.ad) : g.length + 1 < v.seriler.length ? [...g, l.ad] : g))}
                className={`inline-flex items-center gap-1.5 ${ac ? "cursor-pointer hover:text-zinc-900" : "cursor-default"} ${kapali ? "opacity-40 line-through" : ""}`}
                title={ac ? (kapali ? "Göster" : "Gizle") : undefined}
              >
                <span className="inline-block size-2.5 rounded-sm" style={{ background: l.renk }} />{l.ad}
              </button>
            );
          })}
        </div>
      )}
      <div ref={ref} className="relative w-full" style={{ minHeight: 60 }}>
        {G > 0 && (
          <svg width={G} height={yukseklik} role="img" aria-label={v.kategoriler.join(", ")} className="block select-none">
            {govde}
          </svg>
        )}
        {uzerinde && ip && (
          <div
            className="pointer-events-none absolute z-10 min-w-40 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: Math.min(uzerinde.x + 12, Math.max(0, G - 200)), top: uzerinde.y + 14 }}
          >
            <p className="mb-1 font-semibold text-zinc-900">{v.kategoriler[uzerinde.i]}</p>
            {ip.map((s, j) => <p key={j} className="whitespace-nowrap text-zinc-600 tabular-nums">{s}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
