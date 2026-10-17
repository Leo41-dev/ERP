import { notFound } from "next/navigation";
import { YazdirButon } from "@/components/YazdirButon";
import { tarih, telefonGoster, tl, yuzde } from "@/lib/bicim";
import { belgeAyarlari } from "@/lib/belgeAyarlari";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { tutarYazi } from "@/lib/sayiYazi";

export const metadata = { title: "Fiyat teklifi" };

const kenar = "border border-zinc-800 px-2 py-1";
const etiket = `${kenar} w-[18%] bg-zinc-50 font-semibold`;

export default async function TeklifYazdir({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const id = Number((await params).id);
  const t = Number.isInteger(id) ? await db.teklif.findUnique({ where: { id }, include: { firma: true, satici: true, kalemler: { orderBy: { sira: "asc" } } } }) : null;
  if (!t || (k.rol === "SATIS" && t.saticiId !== k.id)) notFound();
  const [ayar, firma] = await Promise.all([belgeAyarlari(), t.firma ? Promise.resolve(t.firma) : db.firma.findFirst({ where: { varsayilan: true } })]);
  const otvVar = t.kalemler.some((x) => Number(x.otvOrani) > 0);

  return (
    <main className="mx-auto max-w-[210mm] bg-white p-6 text-[11px] leading-snug text-zinc-900 print:p-0">
      <style>{`@page { size: A4; margin: 10mm; } main { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>
      <div className="mb-4 flex justify-end print:hidden"><YazdirButon /></div>

      <table className="mb-2 w-full table-fixed border-collapse">
        <tbody>
          <tr>
            <td className={`${kenar} py-2`} colSpan={3}>
              <p className="text-[15px] font-bold">{ayar["belge.baslik"]}</p>
              {firma && <p className="text-[10px] text-zinc-600">{[firma.unvan, firma.adres, [firma.vergiDairesi, firma.vkn].filter(Boolean).join(" / ")].filter(Boolean).join(" · ")}</p>}
            </td>
            <td className={kenar}>
              <p><b>Teklif No:</b> {t.teklifNo}</p>
              <p><b>Tarih:</b> {tarih(t.tarih)}</p>
              <p><b>Geçerlilik:</b> {tarih(t.gecerlilik)}</p>
            </td>
          </tr>
          <tr><th colSpan={4} className={`${kenar} bg-zinc-300 py-1.5 text-center text-[13px] tracking-wide`}>{ayar["belge.teklifBaslik"]}</th></tr>
          <tr><th colSpan={4} className={`${kenar} bg-zinc-200 text-left text-[11px] tracking-wide`}>SAYIN</th></tr>
          <tr><td className={etiket}>AD SOYAD / ÜNVAN</td><td className={kenar} colSpan={3}>{t.musteriAd}</td></tr>
          <tr>
            <td className={etiket}>TELEFON</td><td className={kenar}>{t.telefon ? telefonGoster(t.telefon) : " "}</td>
            <td className={etiket}>E-POSTA</td><td className={kenar}>{t.eposta ?? " "}</td>
          </tr>
        </tbody>
      </table>

      <table className="mb-2 w-full border-collapse">
        <colgroup>
          <col className="w-8" /><col /><col className="w-14" /><col className="w-28" />{otvVar && <col className="w-14" />}<col className="w-14" /><col className="w-28" />
        </colgroup>
        <thead>
          <tr><th colSpan={otvVar ? 7 : 6} className={`${kenar} bg-zinc-200 text-left tracking-wide`}>TEKLİF KALEMLERİ</th></tr>
          <tr className="bg-zinc-50 text-left">
            <th className={kenar}>#</th><th className={kenar}>AÇIKLAMA</th><th className={`${kenar} text-right`}>ADET</th><th className={`${kenar} text-right`}>BİRİM FİYAT</th>
            {otvVar && <th className={`${kenar} text-right`}>ÖTV</th>}<th className={`${kenar} text-right`}>KDV</th><th className={`${kenar} text-right`}>TUTAR</th>
          </tr>
        </thead>
        <tbody>
          {t.kalemler.map((x, i) => (
            <tr key={x.id}>
              <td className={`${kenar} text-center`}>{i + 1}</td>
              <td className={kenar}>{x.aciklama}</td>
              <td className={`${kenar} text-right`}>{Number(x.miktar).toLocaleString("tr-TR")}</td>
              <td className={`${kenar} text-right`}>{tl(x.birimFiyat)}</td>
              {otvVar && <td className={`${kenar} text-right`}>{Number(x.otvOrani) ? yuzde(x.otvOrani) : "-"}</td>}
              <td className={`${kenar} text-right`}>{yuzde(x.kdvOrani)}</td>
              <td className={`${kenar} text-right`}>{tl(x.tutar)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mb-2 ml-auto w-1/2 border-collapse">
        <tbody>
          <tr><td className={`${kenar} bg-zinc-50 font-semibold`}>MATRAH</td><td className={`${kenar} text-right`}>{tl(t.araToplam)}</td></tr>
          {otvVar && <tr><td className={`${kenar} bg-zinc-50 font-semibold`}>ÖTV</td><td className={`${kenar} text-right`}>{tl(t.otvToplam)}</td></tr>}
          <tr><td className={`${kenar} bg-zinc-50 font-semibold`}>KDV</td><td className={`${kenar} text-right`}>{tl(t.kdvToplam)}</td></tr>
          <tr><td className={`${kenar} bg-zinc-200 font-bold`}>GENEL TOPLAM</td><td className={`${kenar} text-right text-[13px] font-bold`}>{tl(t.genelToplam)}</td></tr>
        </tbody>
      </table>
      <p className="mb-3 text-right text-[10px] italic">{tutarYazi(Number(t.genelToplam))}</p>

      <table className="mb-2 w-full table-fixed border-collapse">
        <tbody>
          <tr><th colSpan={2} className={`${kenar} bg-zinc-200 text-left tracking-wide`}>KOŞULLAR</th></tr>
          <tr><td className={etiket}>ÖDEME</td><td className={`${kenar} whitespace-pre-line`}>{t.odemeKosullari ?? " "}</td></tr>
          <tr><td className={etiket}>NOT</td><td className={`${kenar} h-12 whitespace-pre-line align-top`}>{t.not ?? " "}</td></tr>
          <tr><td className={etiket}>SATIŞ TEMSİLCİSİ</td><td className={kenar}>{t.satici?.adSoyad ?? " "}</td></tr>
        </tbody>
      </table>

      {ayar["belge.teklifNotu"] && <p className="mb-6 whitespace-pre-line text-[10px] italic">{ayar["belge.teklifNotu"]}</p>}

      <table className="w-full table-fixed border-collapse">
        <tbody>
          <tr><th className={`${kenar} bg-zinc-200`}>TEKLİFİ VEREN</th><th className={`${kenar} bg-zinc-200`}>MÜŞTERİ ONAYI</th></tr>
          <tr><td className={`${kenar} h-20 text-center align-bottom`}>{t.satici?.adSoyad ?? ""}</td><td className={`${kenar} h-20 text-center align-bottom`}>{t.musteriAd}</td></tr>
        </tbody>
      </table>
    </main>
  );
}
