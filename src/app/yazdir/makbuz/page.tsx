import { notFound } from "next/navigation";
import { YazdirButon } from "@/components/YazdirButon";
import { ODEME_AD, tarih, tarihSaat, telefonGoster, tl } from "@/lib/bicim";
import { belgeAyarlari } from "@/lib/belgeAyarlari";
import { acikSatislar, cariBakiye } from "@/lib/cari";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { tutarYazi } from "@/lib/sayiYazi";

export const metadata = { title: "Tahsilat makbuzu" };

const kenar = "border border-zinc-800 px-2 py-1";

export default async function Makbuz({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await yetkiIste();
  const idler = String((await searchParams).id ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20);
  const liste = await db.tahsilat.findMany({ where: { id: { in: idler } }, orderBy: { id: "asc" }, include: { cari: true, satis: { include: { firma: true } } } });
  if (!liste.length || new Set(liste.map((t) => t.cariId)).size > 1) notFound();
  const c = liste[0].cari;
  const satis = liste.find((t) => t.satis)?.satis ?? null;
  const [ayar, firma, bakiye, acik] = await Promise.all([
    belgeAyarlari(),
    satis?.firma ? Promise.resolve(satis.firma) : db.firma.findFirst({ where: { varsayilan: true } }),
    cariBakiye(c.id),
    satis ? acikSatislar({ cariId: c.id }) : Promise.resolve([]),
  ]);
  const gecerli = liste.filter((t) => !t.iptalZamani);
  const toplam = gecerli.reduce((t, x) => t + Number(x.tutar), 0);
  const satisKalan = satis ? (acik.find((s) => s.id === satis.id)?.kalan ?? 0) : null;

  return (
    <main className="mx-auto max-w-[148mm] bg-white p-6 text-[11px] text-zinc-900 print:p-0">
      <style>{`@page { size: A5; margin: 8mm; } main { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>
      <div className="mb-3 flex justify-end print:hidden"><YazdirButon /></div>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={kenar} colSpan={2}>
              <p className="text-[13px] font-bold">{ayar["belge.baslik"]}</p>
              {firma && <p className="text-[10px] text-zinc-600">{[firma.unvan, firma.adres, [firma.vergiDairesi, firma.vkn].filter(Boolean).join(" / ")].filter(Boolean).join(" · ")}</p>}
            </td>
            <td className={`${kenar} w-[34%]`}>
              <p><b>Makbuz No:</b> {liste[0].id}{liste.length > 1 ? `-${liste[liste.length - 1].id}` : ""}</p>
              <p><b>Tarih:</b> {tarihSaat(liste[0].tarih)}</p>
            </td>
          </tr>
          <tr><th colSpan={3} className={`${kenar} bg-zinc-300 text-center text-[13px] tracking-wide`}>TAHSİLAT MAKBUZU{gecerli.length < liste.length ? " (İPTAL SATIR VAR)" : ""}</th></tr>
          <tr><td className={`${kenar} w-[28%] bg-zinc-50 font-semibold`}>ÖDEYEN</td><td className={kenar} colSpan={2}>{c.unvan}</td></tr>
          <tr><td className={`${kenar} bg-zinc-50 font-semibold`}>TCKN / VKN</td><td className={kenar} colSpan={2}>{c.tckn ?? c.vkn ?? "-"}{c.telefon ? ` · ${telefonGoster(c.telefon)}` : ""}</td></tr>
          {satis && <tr><td className={`${kenar} bg-zinc-50 font-semibold`}>İLGİLİ SATIŞ</td><td className={kenar} colSpan={2}>Form no {satis.formNo} · {tl(satis.genelToplam)}</td></tr>}
        </tbody>
      </table>

      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr className="bg-zinc-200 text-left">
            <th className={kenar}>ÖDEME ŞEKLİ</th><th className={kenar}>AÇIKLAMA</th><th className={`${kenar} text-right`}>TUTAR</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((t) => (
            <tr key={t.id} className={t.iptalZamani ? "text-zinc-400 line-through" : ""}>
              <td className={kenar}>{ODEME_AD[t.yontem]}{t.taksit ? ` · ${t.taksit} taksit` : ""}{t.vade ? ` · vade ${tarih(t.vade)}` : ""}</td>
              <td className={kenar}>{t.aciklama ?? ""}</td>
              <td className={`${kenar} text-right`}>{tl(t.tutar)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={kenar} colSpan={2}>TOPLAM</td>
            <td className={`${kenar} text-right text-[12px]`}>{tl(toplam)}</td>
          </tr>
          <tr><td className={`${kenar} italic`} colSpan={3}>{tutarYazi(toplam)}</td></tr>
        </tbody>
      </table>

      <table className="mt-2 w-full border-collapse">
        <tbody>
          {satisKalan !== null && <tr><td className={`${kenar} w-[50%] bg-zinc-50 font-semibold`}>SATIŞTAN KALAN</td><td className={kenar}>{tl(satisKalan)}</td></tr>}
          <tr><td className={`${kenar} w-[50%] bg-zinc-50 font-semibold`}>GÜNCEL CARİ BAKİYE</td><td className={kenar}>{tl(bakiye.bakiye)} {bakiye.bakiye > 0 ? "(borç)" : bakiye.bakiye < 0 ? "(alacak)" : ""}</td></tr>
        </tbody>
      </table>

      <table className="mt-2 w-full border-collapse">
        <tbody>
          <tr><th className={`${kenar} bg-zinc-200`}>ÖDEYEN</th><th className={`${kenar} bg-zinc-200`}>TAHSİL EDEN</th></tr>
          <tr>
            <td className={`${kenar} h-16 text-center align-bottom`}>{c.unvan}</td>
            <td className={`${kenar} h-16 text-center align-bottom`}>{liste[0].kaydeden ?? ""}</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
