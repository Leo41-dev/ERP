import { notFound } from "next/navigation";
import { YazdirButon } from "@/components/YazdirButon";
import { tarih, telefonGoster, tl } from "@/lib/bicim";
import { belgeAyarlari } from "@/lib/belgeAyarlari";
import { cariEkstre } from "@/lib/cari";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";

export const metadata = { title: "Cari ekstre" };

const kenar = "border border-zinc-800 px-2 py-1";
const gun = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

export default async function Ekstre({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ basla?: string; bitis?: string }> }) {
  await yetkiIste();
  const id = Number((await params).id);
  const p = await searchParams;
  const c = Number.isInteger(id) ? await db.cari.findUnique({ where: { id } }) : null;
  if (!c) notFound();
  const basla = gun(p.basla) ? new Date(`${p.basla}T00:00:00+03:00`) : undefined;
  const bitis = gun(p.bitis) ? new Date(`${p.bitis}T23:59:59+03:00`) : undefined;
  const [e, ayar, firma] = await Promise.all([cariEkstre(id, basla, bitis), belgeAyarlari(), db.firma.findFirst({ where: { varsayilan: true } })]);
  const tb = e.satirlar.reduce((t, s) => t + s.borc, 0);
  const ta = e.satirlar.reduce((t, s) => t + s.alacak, 0);
  const bakiyeYaz = (b: number) => `${tl(Math.abs(b))} ${b > 0.004 ? "B" : b < -0.004 ? "A" : ""}`;

  return (
    <main className="mx-auto max-w-[210mm] bg-white p-6 text-[11px] text-zinc-900 print:p-0">
      <style>{`@page { size: A4; margin: 10mm; } main { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <form className="flex items-center gap-2 text-xs">
          <input type="date" name="basla" defaultValue={p.basla} className="rounded border border-zinc-300 px-2 py-1" />
          <span>-</span>
          <input type="date" name="bitis" defaultValue={p.bitis} className="rounded border border-zinc-300 px-2 py-1" />
          <button className="rounded border border-zinc-300 px-2 py-1">Uygula</button>
        </form>
        <YazdirButon />
      </div>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={kenar} colSpan={3}>
              <p className="text-[14px] font-bold">{ayar["belge.baslik"]}</p>
              {firma && <p className="text-[10px] text-zinc-600">{[firma.unvan, [firma.vergiDairesi, firma.vkn].filter(Boolean).join(" / ")].filter(Boolean).join(" · ")}</p>}
            </td>
            <td className={`${kenar} w-[30%]`}>
              <p><b>Tarih:</b> {tarih(new Date())}</p>
              <p><b>Dönem:</b> {p.basla ? tarih(basla) : "Başlangıç"} - {p.bitis ? tarih(bitis) : "Bugün"}</p>
            </td>
          </tr>
          <tr><th colSpan={4} className={`${kenar} bg-zinc-300 text-center text-[13px] tracking-wide`}>CARİ HESAP EKSTRESİ</th></tr>
          <tr>
            <td className={`${kenar} w-[18%] bg-zinc-50 font-semibold`}>ÜNVAN</td><td className={kenar}>{c.unvan}</td>
            <td className={`${kenar} w-[18%] bg-zinc-50 font-semibold`}>TCKN / VKN</td><td className={kenar}>{c.tckn ?? c.vkn ?? "-"}</td>
          </tr>
          <tr>
            <td className={`${kenar} bg-zinc-50 font-semibold`}>TELEFON</td><td className={kenar}>{telefonGoster(c.telefon)}</td>
            <td className={`${kenar} bg-zinc-50 font-semibold`}>ADRES</td><td className={kenar}>{[c.acikAdres, [c.ilce, c.il].filter(Boolean).join("/")].filter(Boolean).join(" ") || "-"}</td>
          </tr>
        </tbody>
      </table>
      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr className="bg-zinc-200 text-left">
            <th className={`${kenar} w-[13%]`}>TARİH</th><th className={kenar}>AÇIKLAMA</th>
            <th className={`${kenar} w-[15%] text-right`}>BORÇ</th><th className={`${kenar} w-[15%] text-right`}>ALACAK</th><th className={`${kenar} w-[17%] text-right`}>BAKİYE</th>
          </tr>
        </thead>
        <tbody>
          {basla && (
            <tr className="italic"><td className={kenar}>{tarih(basla)}</td><td className={kenar}>Devir</td><td className={kenar} /><td className={kenar} /><td className={`${kenar} text-right`}>{bakiyeYaz(e.acilis)}</td></tr>
          )}
          {e.satirlar.map((s) => (
            <tr key={s.id}>
              <td className={kenar}>{tarih(s.tarih)}</td>
              <td className={kenar}>{s.aciklama}</td>
              <td className={`${kenar} text-right`}>{s.borc ? tl(s.borc) : ""}</td>
              <td className={`${kenar} text-right`}>{s.alacak ? tl(s.alacak) : ""}</td>
              <td className={`${kenar} text-right`}>{bakiyeYaz(s.bakiye)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={kenar} colSpan={2}>TOPLAM</td>
            <td className={`${kenar} text-right`}>{tl(tb)}</td>
            <td className={`${kenar} text-right`}>{tl(ta)}</td>
            <td className={`${kenar} text-right`}>{bakiyeYaz(e.kapanis)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-zinc-600">B: müşteri borçlu, A: müşteri alacaklı.</p>
    </main>
  );
}
