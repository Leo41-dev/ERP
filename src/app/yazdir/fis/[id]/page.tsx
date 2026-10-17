import { notFound } from "next/navigation";
import { ODEME_AD, tarihSaat, telefonGoster, tl, yuzde } from "@/lib/bicim";
import { belgeAyarlari } from "@/lib/belgeAyarlari";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { FisSecenek } from "./FisSecenek";

export const metadata = { title: "Satış fişi" };

const cizgi = "border-t border-dashed border-zinc-500 my-1.5";

export default async function Fis({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste();
  const id = Number((await params).id);
  const s = Number.isInteger(id)
    ? await db.satis.findUnique({ where: { id }, include: { firma: true, cari: true, satici: true, kalemler: { orderBy: { id: "asc" } }, tahsilatlar: { orderBy: { tarih: "asc" } } } })
    : null;
  if (!s || (k.rol === "SATIS" && s.saticiId !== k.id)) notFound();
  const [ayar, varsayilan] = await Promise.all([belgeAyarlari(), s.firma ? null : db.firma.findFirst({ where: { varsayilan: true } })]);
  const firma = s.firma ?? varsayilan;
  const perakende = !s.cari.tckn && !s.cari.vkn && !s.cari.telefon;

  // KDV oranına göre özet
  const kdvOzet = new Map<string, { matrah: number; kdv: number }>();
  for (const x of s.kalemler) {
    const o = yuzde(x.kdvOrani);
    const tutar = Number(x.tutar);
    const matrah = tutar / (1 + Number(x.kdvOrani));
    const e = kdvOzet.get(o) ?? { matrah: 0, kdv: 0 };
    kdvOzet.set(o, { matrah: e.matrah + matrah, kdv: e.kdv + tutar - matrah });
  }

  return (
    <main className="min-h-screen bg-zinc-100 font-mono print:bg-white">
      <FisSecenek>
        <div className="text-center">
          <p className="text-[1.15em] font-bold">{ayar["belge.baslik"]}</p>
          {firma && <p>{firma.unvan}</p>}
          {firma?.adres && <p>{firma.adres}</p>}
          {firma && <p>{[firma.vergiDairesi, firma.vkn].filter(Boolean).join(" / ")}</p>}
        </div>
        <div className={cizgi} />
        <p className="text-center font-bold">{ayar["belge.fisBaslik"]}{s.durum === "IPTAL" ? " · İPTAL" : ""}</p>
        <div className="flex justify-between"><span>No: {s.formNo}</span><span>{tarihSaat(s.tarih)}</span></div>
        {!perakende && (
          <>
            <p>Müşteri: {s.cari.unvan}</p>
            {s.cari.telefon && <p>Tel: {telefonGoster(s.cari.telefon)}</p>}
          </>
        )}
        <div className={cizgi} />
        <table className="w-full">
          <tbody>
            {s.kalemler.map((x) => (
              <tr key={x.id} className="align-top">
                <td className="pb-1">
                  <div>{x.aciklama}</div>
                  <div className="text-zinc-600">{Number(x.miktar).toLocaleString("tr-TR")} x {tl(Number(x.tutar) / Number(x.miktar))} · KDV {yuzde(x.kdvOrani)}</div>
                </td>
                <td className="whitespace-nowrap pb-1 pl-2 text-right">{tl(x.tutar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={cizgi} />
        {[...kdvOzet.entries()].map(([o, v]) => (
          <div key={o} className="flex justify-between text-zinc-700"><span>KDV {o} (matrah {tl(v.matrah)})</span><span>{tl(v.kdv)}</span></div>
        ))}
        <div className="mt-1 flex justify-between text-[1.2em] font-bold"><span>TOPLAM</span><span>{tl(s.genelToplam)}</span></div>
        <div className={cizgi} />
        {s.tahsilatlar.map((t) => (
          <div key={t.id} className="flex justify-between">
            <span>{ODEME_AD[t.yontem]}{t.taksit ? ` · ${t.taksit} taksit` : ""}{t.aciklama ? ` · ${t.aciklama}` : ""}</span>
            <span>{tl(t.tutar)}</span>
          </div>
        ))}
        {s.not && <p className="mt-1 whitespace-pre-line">{s.not}</p>}
        <div className={cizgi} />
        <p>Satış: {s.satici?.adSoyad ?? "-"}</p>
        {s.tahsilatlar.some((t) => t.yontem === "KART") && <p className="mt-6 border-t border-zinc-500 pt-0.5 text-center">Müşteri imzası</p>}
        <p className="mt-2 whitespace-pre-line text-center text-[0.9em]">{ayar["belge.fisNotu"]}</p>
      </FisSecenek>
    </main>
  );
}
