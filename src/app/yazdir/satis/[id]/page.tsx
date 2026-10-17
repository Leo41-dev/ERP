import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { KONDISYON_AD, ODEME_AD, TESCIL_AD, tarih, telefonGoster, tl, yuzde } from "@/lib/bicim";
import { belgeAyarlari } from "@/lib/belgeAyarlari";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { YazdirButon } from "./YazdirButon";

export const metadata = { title: "Satış formu" };

const kenar = "border border-zinc-800";

/** Gri zeminli bölüm başlığı satırı */
function Baslik({ children, kolon = 2 }: { children: ReactNode; kolon?: number }) {
  return (
    <tr>
      <th colSpan={kolon} className={`${kenar} bg-zinc-200 px-2 py-1 text-left text-[11px] font-bold tracking-wide`}>{children}</th>
    </tr>
  );
}

/** Etiket | değer satırı; iki çift yan yana da verilebilir */
function Satir({ ciftler }: { ciftler: [string, ReactNode][] }) {
  return (
    <tr>
      {ciftler.map(([e, v]) => [
        <td key={e + "e"} className={`${kenar} w-[18%] bg-zinc-50 px-2 py-1 font-semibold`}>{e}</td>,
        <td key={e + "d"} className={`${kenar} px-2 py-1`} colSpan={ciftler.length === 1 ? 3 : 1}>{v || " "}</td>,
      ])}
    </tr>
  );
}

function Tablo({ children }: { children: ReactNode }) {
  return <table className="mb-2 w-full table-fixed border-collapse"><tbody>{children}</tbody></table>;
}

function UstBilgi({ baslik, firma, belgeBaslik, formNo, tarihMetni }: { baslik: string; firma: { unvan: string; adres: string | null; vergiDairesi: string | null; vkn: string } | null; belgeBaslik: string; formNo: number; tarihMetni: string }) {
  return (
    <Tablo>
      <tr>
        <td className={`${kenar} px-2 py-2`} colSpan={3}>
          <p className="text-[15px] font-bold">{baslik}</p>
          {firma && <p className="text-[10px] text-zinc-600">{[firma.unvan, firma.adres, [firma.vergiDairesi, firma.vkn].filter(Boolean).join(" / ")].filter(Boolean).join(" · ")}</p>}
        </td>
        <td className={`${kenar} px-2 py-1 text-[11px]`}>
          <p><b>Form No:</b> {formNo}</p>
          <p><b>Tarih:</b> {tarihMetni}</p>
        </td>
      </tr>
      <tr>
        <th colSpan={4} className={`${kenar} bg-zinc-300 px-2 py-1.5 text-center text-[13px] font-bold tracking-wide`}>{belgeBaslik}</th>
      </tr>
    </Tablo>
  );
}

function Imzalar({ sol, sag }: { sol: [string, string]; sag: [string, string] }) {
  return (
    <Tablo>
      <tr>
        <th className={`${kenar} bg-zinc-200 px-2 py-1 text-[11px]`}>{sol[0]}</th>
        <th className={`${kenar} bg-zinc-200 px-2 py-1 text-[11px]`}>{sag[0]}</th>
      </tr>
      <tr>
        <td className={`${kenar} h-20 px-2 py-1 text-center align-bottom`}>{sol[1]}</td>
        <td className={`${kenar} h-20 px-2 py-1 text-center align-bottom`}>{sag[1]}</td>
      </tr>
    </Tablo>
  );
}

export default async function SatisYazdir({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ belge?: string }> }) {
  const k = await yetkiIste();
  const id = Number((await params).id);
  const secim = (await searchParams).belge;
  const s = Number.isInteger(id)
    ? await db.satis.findUnique({
        where: { id },
        include: {
          firma: true,
          cari: true,
          satici: true,
          kalemler: { include: { arac: { include: { model: { include: { marka: true } } } } } },
          tahsilatlar: { orderBy: { tarih: "asc" } },
          teslimKontrol: true,
        },
      })
    : null;
  if (!s || (k.rol === "SATIS" && s.saticiId !== k.id)) notFound();
  const [firma, maddeler, ayar] = await Promise.all([
    s.firma ? Promise.resolve(s.firma) : db.firma.findFirst({ where: { varsayilan: true } }),
    db.kontrolMaddesi.findMany({ where: { aktif: true }, orderBy: { sira: "asc" } }),
    belgeAyarlari(),
  ]);
  // kontrol yapılmışsa o günkü liste basılır; maddeler sonradan değişse de belge değişmez
  const liste = s.teslimKontrol
    ? (s.teslimKontrol.maddeler as { ad: string; tamam: boolean }[])
    : maddeler.map((m) => ({ ad: m.ad, tamam: false }));
  const c = s.cari;
  const kimlik = c.vkn ? `${c.vkn}${c.vergiDairesi ? " / " + c.vergiDairesi : ""}` : c.tckn;
  const adres = [c.acikAdres, [c.ilce, c.il].filter(Boolean).join("/")].filter(Boolean).join(" ");
  const kontrolEden = s.teslimKontrol?.kontrolEden || ayar["belge.kontrolEden"];
  const satisFormu = secim !== "pdi";
  const pdi = secim !== "satis";
  const ust = { baslik: ayar["belge.baslik"], firma, formNo: s.formNo, tarihMetni: tarih(s.tarih) };
  const sekme = (deger: string | undefined, ad: string) => (
    <Link href={deger ? `?belge=${deger}` : "?"} className={`rounded px-2 py-1 ${secim === deger ? "bg-zinc-900 text-white" : "border border-zinc-300"}`}>{ad}</Link>
  );

  const aracSatirlari = s.kalemler.map((x) => {
    const a = x.arac;
    const marka = a?.model?.marka.ad ?? x.aciklama;
    const model = a?.model ? [a.model.model, a.model.altModel].filter(Boolean).join(" ") : "";
    return (
      <tbody key={x.id}>
        <Satir ciftler={[["ŞASE NO", <span key="s" className="font-mono">{a?.sase}</span>], ["MOTOR NO", a?.motorNo]]} />
        <Satir ciftler={[["MARKA", marka], ["MODEL", model]]} />
        <Satir ciftler={[["YIL", a?.yil], ["RENK", a?.renk]]} />
        <Satir ciftler={[["KONDİSYON", a && KONDISYON_AD[a.kondisyon]], ["TESCİL", a && [TESCIL_AD[a.tescilDurum], a.plaka].filter(Boolean).join(" · ")]]} />
      </tbody>
    );
  });

  return (
    <main className="mx-auto max-w-[210mm] bg-white p-6 text-[11px] leading-snug text-zinc-900 print:p-0">
      <style>{`@page { size: A4; margin: 10mm; } main { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @media print { .sayfa + .sayfa { break-before: page; } }`}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs print:hidden">
        <div className="flex gap-1">{sekme(undefined, "İkisi")}{sekme("satis", "Satış formu")}{sekme("pdi", "PDI")}</div>
        <YazdirButon />
      </div>

      {satisFormu && (
        <section className="sayfa">
          <UstBilgi {...ust} belgeBaslik={ayar["belge.satisFormuBaslik"]} />
          {s.durum === "IPTAL" && <p className="mb-2 border-2 border-red-700 p-1 text-center font-bold text-red-700">BU SATIŞ İPTAL EDİLDİ</p>}

          <Tablo>
            <Baslik kolon={4}>ALICI BİLGİLERİ</Baslik>
            <Satir ciftler={[["ÜNVAN", c.unvan]]} />
            <Satir ciftler={[["TCKN / VKN, VD", kimlik], ["TCKK SERİ NO", c.tckkSeriNo]]} />
            <Satir ciftler={[["DOĞUM TARİHİ", c.dogumTarihi ? tarih(c.dogumTarihi) : ""], ["TELEFON", telefonGoster(c.telefon)]]} />
            <Satir ciftler={[["E-POSTA", c.eposta], ["E-TEBLİGAT", c.eTebligat]]} />
            <Satir ciftler={[["ADRES", adres]]} />
          </Tablo>

          <table className="mb-2 w-full table-fixed border-collapse">
            <thead><Baslik kolon={4}>ARAÇ BİLGİLERİ</Baslik></thead>
            {aracSatirlari}
          </table>

          <Tablo>
            <Baslik kolon={4}>MALİ BİLGİLER</Baslik>
            <Satir ciftler={[["MATRAH", tl(s.araToplam)], [`ÖTV (${yuzde(s.kalemler[0]?.otvOrani)})`, tl(s.otvToplam)]]} />
            <Satir ciftler={[[`KDV (${yuzde(s.kalemler[0]?.kdvOrani)})`, tl(s.kdvToplam)], ["TOPLAM", <b key="t">{tl(s.genelToplam)}</b>]]} />
            <Satir ciftler={[["FATURA NO", s.faturaNo], ["FATURA TARİHİ", s.faturaTarihi ? tarih(s.faturaTarihi) : ""]]} />
          </Tablo>

          <table className="mb-2 w-full table-fixed border-collapse">
            <thead>
              <Baslik kolon={5}>ÖDEME BİLGİLERİ</Baslik>
              <tr className="bg-zinc-50 text-left">
                {["TARİH", "YÖNTEM", "TAKSİT", "AÇIKLAMA", "TUTAR"].map((b) => <th key={b} className={`${kenar} px-2 py-1 font-semibold`}>{b}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.tahsilatlar.map((t) => (
                <tr key={t.id}>
                  <td className={`${kenar} px-2 py-1`}>{tarih(t.tarih)}</td>
                  <td className={`${kenar} px-2 py-1`}>{ODEME_AD[t.yontem]}</td>
                  <td className={`${kenar} px-2 py-1`}>{t.taksit ?? "-"}</td>
                  <td className={`${kenar} px-2 py-1`}>{t.aciklama ?? ""}</td>
                  <td className={`${kenar} px-2 py-1 text-right`}>{tl(t.tutar)}</td>
                </tr>
              ))}
              {!s.tahsilatlar.length && <tr><td colSpan={5} className={`${kenar} px-2 py-1 text-zinc-500`}>Ödeme girilmemiş.</td></tr>}
            </tbody>
          </table>

          <Tablo>
            <Baslik kolon={4}>AKSESUAR VE HİZMET BİLGİLERİ</Baslik>
            <Satir ciftler={[["AKSESUARLAR", s.aksesuarlar]]} />
            <Satir ciftler={[["HİZMETLER", s.hizmetler]]} />
            <Satir ciftler={[["TESLİM TARİHİ", s.teslimTarihi ? tarih(s.teslimTarihi) : ""], ["SATIŞ TEMSİLCİSİ", s.satici?.adSoyad]]} />
          </Tablo>

          <Tablo>
            <Baslik>NOTLAR</Baslik>
            <tr><td colSpan={2} className={`${kenar} h-14 whitespace-pre-line px-2 py-1 align-top`}>{s.not ?? ""}</td></tr>
          </Tablo>

          {ayar["belge.satisFormuNotu"] && <p className="mb-2 whitespace-pre-line text-[10px] italic">{ayar["belge.satisFormuNotu"]}</p>}
          <Imzalar sol={["ALICI", c.unvan]} sag={["SATICI", s.satici?.adSoyad ?? ""]} />
        </section>
      )}

      {pdi && (
        <section className="sayfa">
          {satisFormu && <hr className="my-8 border-dashed print:hidden" />}
          <UstBilgi {...ust} belgeBaslik={ayar["belge.pdiBaslik"]} />

          <Tablo>
            <Baslik kolon={4}>ARACI SATIN ALAN BİLGİLERİ</Baslik>
            <Satir ciftler={[["ÜNVAN", c.unvan]]} />
            <Satir ciftler={[["TCKN / VKN", kimlik], ["TELEFON", telefonGoster(c.telefon)]]} />
            <Satir ciftler={[["ADRES", adres]]} />
          </Tablo>

          <table className="mb-2 w-full table-fixed border-collapse">
            <thead><Baslik kolon={4}>ARAÇ BİLGİLERİ</Baslik></thead>
            {aracSatirlari}
          </table>

          <table className="mb-2 w-full table-fixed border-collapse">
            <colgroup><col className="w-10" /><col /><col className="w-20" /></colgroup>
            <thead>
              <Baslik kolon={3}>KONTROL LİSTESİ</Baslik>
            </thead>
            <tbody>
              {liste.map((m, i) => {
                const tamam = m.tamam;
                return (
                  <tr key={m.ad}>
                    <td className={`${kenar} px-2 py-1 text-center`}>{i + 1}</td>
                    <td className={`${kenar} px-2 py-1`}>{m.ad}</td>
                    <td className={`${kenar} px-2 py-1 text-center text-[13px]`}>{tamam ? "☑" : "☐"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <Imzalar sol={["KONTROL EDEN", kontrolEden]} sag={["TESLİM EDEN", s.satici?.adSoyad ?? ""]} />

          <Tablo>
            <Baslik>NOTLAR</Baslik>
            <tr><td colSpan={2} className={`${kenar} h-12 px-2 py-1`}>{" "}</td></tr>
          </Tablo>

          <p className="mb-2 whitespace-pre-line text-[10px] font-bold italic">{ayar["belge.teslimBeyani"]}</p>

          <Tablo>
            <Baslik kolon={4}>TESLİM ALAN</Baslik>
            <Satir ciftler={[["ÜNVAN", c.unvan], ["TESLİM TARİHİ", s.teslimTarihi ? tarih(s.teslimTarihi) : ""]]} />
            <tr>
              <td className={`${kenar} w-[18%] bg-zinc-50 px-2 py-1 font-semibold`}>İMZA</td>
              <td colSpan={3} className={`${kenar} h-14 px-2 py-1`}>{" "}</td>
            </tr>
          </Tablo>
        </section>
      )}
    </main>
  );
}
