import { tl } from "@/lib/bicim";

const kisa = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} mn ₺` : `${Math.round(n / 1000).toLocaleString("tr-TR")} bin ₺`);
/** eksen için yuvarlak üst değer: 1, 2, 2,5, 5 × 10ⁿ */
function yuvarla(n: number) {
  const us = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 2.5, 5, 10].find((c) => c * us >= n) ?? 10) * us;
}

type Kova = { etiket: string; ipucu: string; ciro: number; adet: number };

/** Tek seri sütun grafiği: dönemdeki ciro. Her sütunun üzerine gelince tarih, ciro ve araç adedi görünür. */
export function Trend({ kovalar }: { kovalar: Kova[] }) {
  const enCok = yuvarla(Math.max(...kovalar.map((k) => k.ciro), 1));
  const G = 720, Y = 180, ust = 4, alt = 22;
  const genislik = G / Math.max(kovalar.length, 1);
  const cubuk = Math.max(2, Math.min(28, genislik - 2)); // komşu sütunlar arasında en az 2px boşluk
  const yAdim = enCok > 0 ? [0.5, 1].map((o) => o * enCok) : [];
  const etiketAdim = Math.ceil(kovalar.length / 10);
  return (
    <figure>
      <svg viewBox={`0 0 ${G} ${Y + alt}`} className="w-full" role="img" aria-label="Dönem cirosu">
        {yAdim.map((v) => {
          const y = ust + (Y - ust) * (1 - v / enCok);
          return (
            <g key={v}>
              <line x1={0} x2={G} y1={y} y2={y} stroke="currentColor" className="text-zinc-200" strokeWidth={1} />
              <text x={0} y={y + 11} className="fill-zinc-500 text-[10px]">{kisa(v)}</text>
            </g>
          );
        })}
        <line x1={0} x2={G} y1={Y} y2={Y} stroke="currentColor" className="text-zinc-300" strokeWidth={1} />
        {kovalar.map((k, i) => {
          const h = (k.ciro / enCok) * (Y - ust);
          const x = i * genislik + (genislik - cubuk) / 2;
          return (
            <g key={k.etiket + i} className="group">
              {/* üzerine gelme alanı sütundan geniş tutulur */}
              <rect x={i * genislik} y={0} width={genislik} height={Y} fill="transparent" />
              {h > 0 && (cubuk < 8 || h < 4) && <rect x={x} y={Y - h} width={cubuk} height={h} className="fill-blue-600 group-hover:fill-blue-800" />}
              {h >= 4 && cubuk >= 8 && <path d={`M${x},${Y} v${-Math.max(h - 4, 0)} q0,-4 4,-4 h${cubuk - 8} q4,0 4,4 v${Math.max(h - 4, 0)} z`} className="fill-blue-600 group-hover:fill-blue-800" />}
              <title>{`${k.ipucu}: ${tl(k.ciro)}${k.adet ? ` · ${k.adet} araç` : ""}`}</title>
              {i % etiketAdim === 0 && <text x={i * genislik + genislik / 2} y={Y + 15} textAnchor="middle" className="fill-zinc-500 text-[10px]">{k.etiket}</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
