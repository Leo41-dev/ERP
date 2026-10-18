import { analizVerisi } from "@/lib/analiz";
import { csv } from "@/lib/analizHesap";
import { yetkiIste } from "@/lib/oturum";
import { DONEM_AD, donemAraligi, type Donem } from "@/lib/panoHesap";

/** Analiz tablosunu CSV olarak indirir: /analiz/csv?tablo=yaslandirma&donem=365 */
export async function GET(istek: Request) {
  await yetkiIste("MUHASEBE");
  const p = new URL(istek.url).searchParams;
  const donem = (Object.keys(DONEM_AD).includes(p.get("donem") ?? "") ? p.get("donem") : "365") as Donem;
  const { bas, bit } = donemAraligi(donem, new Date(), { bas: p.get("bas") ?? undefined, bit: p.get("bit") ?? undefined });
  const t = (await analizVerisi(bas, bit)).find((x) => x.anahtar === p.get("tablo"));
  if (!t) return new Response("Tablo bulunamadı", { status: 404 });
  const gun = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
  return new Response(csv(t), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${t.anahtar}-${gun}.csv"` },
  });
}
