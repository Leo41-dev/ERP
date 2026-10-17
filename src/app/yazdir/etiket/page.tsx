import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { EtiketPano } from "./EtiketPano";

export const metadata = { title: "QR etiket" };

/** "CANYON CANYON REDROCK" gibi baştaki tekrarı temizler */
function etiketAdi(s: string): string {
  let k = s.trim().split(/\s+/);
  for (let n = Math.floor(k.length / 2); n >= 1; n--) {
    if (k.slice(0, n).join(" ") === k.slice(n, 2 * n).join(" ")) {
      k = k.slice(n);
      break;
    }
  }
  return k.join(" ");
}

const CSS = `
.etiket { width: 58mm; height: 40mm; position: relative; overflow: hidden; background: #fff; color: #000; margin: 0 auto 12px; box-shadow: 0 1px 6px rgba(0,0,0,.2); break-after: page; }
.etiket:last-child { break-after: auto; }
.etiket .ic { position: absolute; inset: 0; transform: translate(var(--dx, 0mm), var(--dy, 0mm)); font-family: Arial, Helvetica, sans-serif; }
.etiket .ad { font-weight: 800; line-height: 1.08; text-transform: uppercase; word-break: break-word; }
.etiket .qr svg { display: block; width: 100%; height: 100%; }
.etiket .ss { font-family: "Courier New", monospace; font-weight: 800; font-size: 8pt; line-height: 1.15; }
.etiketler.y .ic { padding: 2.5mm; display: grid; grid-template-columns: 32mm 1fr; grid-template-rows: 1fr auto; grid-template-areas: "qr ad" "qr ss"; column-gap: 2.5mm; }
.etiketler.y .qr { grid-area: qr; width: 32mm; height: 32mm; align-self: center; }
.etiketler.y .ad { grid-area: ad; font-size: var(--pl); }
.etiketler.y .ss { grid-area: ss; align-self: end; }
.etiketler.y .ss span { display: block; }
.etiketler.d .etiket { width: 40mm; height: 58mm; }
.etiketler.d .ic { padding: 1.5mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2.5mm; text-align: center; }
.etiketler.d .ad { width: 100%; min-height: 9mm; display: flex; align-items: center; justify-content: center; font-size: var(--pd); }
.etiketler.d .qr { width: 34mm; height: 34mm; flex: none; }
.etiketler.d .ss { font-size: 9pt; white-space: nowrap; }
@media print { .etiket { box-shadow: none; margin: 0; } }
`;

export default async function EtiketYazdir({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  await yetkiIste();
  // ?id=1,2,3 ya da listeden işaretlenenler: ?id=1&id=2
  const idler = [(await searchParams).id ?? []]
    .flat()
    .join(",")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 300);
  const araclar = await db.arac.findMany({ where: { id: { in: idler } }, include: { model: { include: { marka: true } } }, orderBy: { id: "asc" } });

  // QR, aracın ERP sayfasını açar (konum değiştirme ve geçmiş oradan)
  const h = await headers();
  const kok = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const etiketler = await Promise.all(
    araclar.map(async (a) => {
      const svg = await QRCode.toString(`${kok}/araclar/${a.id}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
      const ad = etiketAdi(a.model ? `${a.model.marka.ad} ${a.model.model} ${a.model.altModel}` : "");
      const n = ad.length;
      const pd = n <= 12 ? 13 : n <= 18 ? 11 : n <= 26 ? 9.5 : 8;
      const pl = n <= 10 ? 10 : n <= 16 ? 9 : n <= 24 ? 8 : 7;
      const yari = Math.ceil(a.sase.length / 2);
      return (
        <div key={a.id} className="etiket">
          <div className="ic" style={{ ["--pd" as string]: `${pd}pt`, ["--pl" as string]: `${pl}pt` }}>
            <div className="ad">{ad}</div>
            <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="ss"><span>{a.sase.slice(0, yari)}</span><span>{a.sase.slice(yari)}</span></div>
          </div>
        </div>
      );
    }),
  );

  return (
    <main className="min-h-screen bg-white">
      <style>{CSS}</style>
      {araclar.length ? <EtiketPano adet={araclar.length}>{etiketler}</EtiketPano> : <p className="p-8 text-sm text-zinc-600">Yazdırılacak araç seçilmedi.</p>}
    </main>
  );
}
