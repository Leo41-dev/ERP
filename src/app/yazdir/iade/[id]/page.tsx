import { notFound } from "next/navigation";
import { YazdirButon } from "@/components/YazdirButon";
import { ODEME_AD, tarih, tarihSaat, telefonGoster, tl } from "@/lib/bicim";
import { belgeAyarlari } from "@/lib/belgeAyarlari";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { tutarYazi } from "@/lib/sayiYazi";

export const metadata = { title: "İade belgesi" };

const kenar = "border border-zinc-800 px-2 py-1";
const etiket = `${kenar} w-[28%] bg-zinc-50 font-semibold`;

export default async function IadeBelgesi({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste();
  const id = Number((await params).id);
  const x = Number.isInteger(id)
    ? await db.iade.findUnique({
        where: { id },
        include: { satis: { include: { cari: true, firma: true } }, kalemler: { include: { satisKalemi: { include: { arac: true } } } }, geriOdemeler: true },
      })
    : null;
  if (!x || (k.rol === "SATIS" && x.satis.saticiId !== k.id)) notFound();
  const s = x.satis;
  const c = s.cari;
  const [ayar, firma] = await Promise.all([belgeAyarlari(), s.firma ? Promise.resolve(s.firma) : db.firma.findFirst({ where: { varsayilan: true } })]);
  const geri = x.geriOdemeler.reduce((t, g) => t + Number(g.tutar), 0);

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
              <p><b>İade No:</b> {x.iadeNo}</p>
              <p><b>Tarih:</b> {tarihSaat(x.tarih)}</p>
            </td>
          </tr>
          <tr><th colSpan={3} className={`${kenar} bg-zinc-300 text-center text-[13px] tracking-wide`}>İADE BELGESİ</th></tr>
          <tr><td className={etiket}>MÜŞTERİ</td><td className={kenar} colSpan={2}>{c.unvan}</td></tr>
          <tr><td className={etiket}>TCKN / VKN</td><td className={kenar} colSpan={2}>{c.tckn ?? c.vkn ?? "-"}{c.telefon ? ` · ${telefonGoster(c.telefon)}` : ""}</td></tr>
          <tr><td className={etiket}>İLGİLİ SATIŞ</td><td className={kenar} colSpan={2}>Form no {s.formNo} · {tarih(s.tarih)}{s.faturaNo ? ` · fatura ${s.faturaNo}` : ""}</td></tr>
          {x.faturaNo && <tr><td className={etiket}>İADE FATURASI</td><td className={kenar} colSpan={2}>{x.faturaNo}</td></tr>}
          <tr><td className={etiket}>İADE NEDENİ</td><td className={kenar} colSpan={2}>{x.neden}</td></tr>
        </tbody>
      </table>

      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr className="bg-zinc-200 text-left"><th className={kenar}>İADE EDİLEN</th><th className={`${kenar} text-right`}>ADET</th><th className={`${kenar} text-right`}>TUTAR</th></tr>
        </thead>
        <tbody>
          {x.kalemler.map((y) => (
            <tr key={y.id}>
              <td className={kenar}>{y.satisKalemi.aciklama}{y.satisKalemi.arac && <span className="block font-mono text-[10px]">Şase {y.satisKalemi.arac.sase}</span>}</td>
              <td className={`${kenar} text-right`}>{Number(y.miktar).toLocaleString("tr-TR")}</td>
              <td className={`${kenar} text-right`}>{tl(y.tutar)}</td>
            </tr>
          ))}
          {x.kalemler.reduce((t, y) => t + Number(y.tutar), 0) - Number(x.tutar) >= 0.01 && (
            <tr><td className={kenar} colSpan={2}>Kesinti</td><td className={`${kenar} text-right`}>−{tl(x.kalemler.reduce((t, y) => t + Number(y.tutar), 0) - Number(x.tutar))}</td></tr>
          )}
          <tr className="font-bold"><td className={`${kenar} bg-zinc-100`} colSpan={2}>İADE TUTARI</td><td className={`${kenar} bg-zinc-100 text-right`}>{tl(x.tutar)}</td></tr>
        </tbody>
      </table>
      <p className="mt-1 text-right text-[10px] italic">{tutarYazi(Number(x.tutar))}</p>

      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr className="bg-zinc-200 text-left"><th className={kenar} colSpan={2}>MÜŞTERİYE GERİ ÖDEME</th><th className={`${kenar} text-right`}>TUTAR</th></tr>
        </thead>
        <tbody>
          {x.geriOdemeler.map((g) => (
            <tr key={g.id}><td className={kenar}>{ODEME_AD[g.yontem]}</td><td className={kenar}>{g.aciklama ?? ""}</td><td className={`${kenar} text-right`}>{tl(g.tutar)}</td></tr>
          ))}
          {!x.geriOdemeler.length && <tr><td className={kenar} colSpan={3}>Para iadesi yapılmadı; tutar müşterinin cari hesabına alacak yazıldı.</td></tr>}
          {geri > 0 && Number(x.tutar) - geri >= 0.01 && <tr><td className={kenar} colSpan={2}>Cari hesaba alacak kalan</td><td className={`${kenar} text-right`}>{tl(Number(x.tutar) - geri)}</td></tr>}
        </tbody>
      </table>

      <table className="mt-4 w-full table-fixed border-collapse">
        <tbody>
          <tr><th className={`${kenar} bg-zinc-200`}>TESLİM ALAN (FİRMA)</th><th className={`${kenar} bg-zinc-200`}>{geri > 0 ? "PARAYI ALAN (MÜŞTERİ)" : "TESLİM EDEN (MÜŞTERİ)"}</th></tr>
          <tr><td className={`${kenar} h-16 text-center align-bottom`}>{x.kaydeden}</td><td className={`${kenar} h-16 text-center align-bottom`}>{c.unvan}</td></tr>
        </tbody>
      </table>
    </main>
  );
}
