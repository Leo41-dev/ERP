import { notFound } from "next/navigation";
import { KONDISYON_AD, ODEME_AD, TESCIL_AD, tarih, telefonGoster, tl, yuzde } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { YazdirButon } from "./YazdirButon";

export const metadata = { title: "Satış formu" };

function Satir({ ad, deger }: { ad: string; deger: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-zinc-200 py-1">
      <dt className="w-32 shrink-0 text-zinc-500">{ad}</dt>
      <dd className="font-medium">{deger || "-"}</dd>
    </div>
  );
}

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h2 className="mb-1 border-b-2 border-zinc-900 pb-0.5 text-xs font-bold uppercase tracking-wide">{baslik}</h2>
      {children}
    </section>
  );
}

export default async function SatisYazdir({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste();
  const id = Number((await params).id);
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
  const firma = s.firma ?? (await db.firma.findFirst({ where: { varsayilan: true } }));
  const maddeler = await db.kontrolMaddesi.findMany({ where: { aktif: true }, orderBy: { sira: "asc" } });
  const yapilan = (s.teslimKontrol?.maddeler ?? []) as { ad: string; tamam: boolean }[];
  const c = s.cari;

  return (
    <main className="mx-auto max-w-[210mm] bg-white p-8 text-[12px] text-zinc-900 print:p-0">
      <style>{`@page { size: A4; margin: 12mm; }`}</style>
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <YazdirButon />
      </div>

      <header className="flex items-start justify-between border-b-2 border-zinc-900 pb-2">
        <div>
          <p className="text-base font-bold">{firma?.unvan ?? "Kartepe ATV"}</p>
          {firma?.adres && <p className="text-zinc-600">{firma.adres}</p>}
          {firma && <p className="text-zinc-600">{[firma.vergiDairesi, firma.vkn].filter(Boolean).join(" / ")}</p>}
        </div>
        <div className="text-right">
          <p className="text-base font-bold">ARAÇ SATIŞ FORMU</p>
          <p>Form No: <b>{s.formNo}</b></p>
          <p>Tarih: {tarih(s.tarih)}</p>
          {s.durum === "IPTAL" && <p className="font-bold text-red-700">İPTAL EDİLDİ</p>}
        </div>
      </header>

      <Bolum baslik="Alıcı">
        <dl className="grid grid-cols-2 gap-x-6">
          <Satir ad="Ad soyad / unvan" deger={c.unvan} />
          <Satir ad={c.vkn ? "VKN" : "TCKN"} deger={c.vkn ?? c.tckn} />
          {c.vkn && <Satir ad="Vergi dairesi" deger={c.vergiDairesi} />}
          <Satir ad="Telefon" deger={telefonGoster(c.telefon)} />
          <Satir ad="E-posta" deger={c.eposta} />
          <Satir ad="İl / ilçe" deger={[c.il, c.ilce].filter(Boolean).join(" / ")} />
          <div className="col-span-2"><Satir ad="Adres" deger={c.acikAdres} /></div>
        </dl>
      </Bolum>

      {s.kalemler.map((x) => {
        const a = x.arac;
        return (
          <Bolum key={x.id} baslik="Araç">
            <dl className="grid grid-cols-2 gap-x-6">
              <Satir ad="Marka / model" deger={a?.model ? `${a.model.marka.ad} ${a.model.model} ${a.model.altModel}`.trim() : x.aciklama} />
              <Satir ad="Şase no" deger={<span className="font-mono">{a?.sase}</span>} />
              <Satir ad="Motor no" deger={a?.motorNo} />
              <Satir ad="Model yılı" deger={a?.yil} />
              <Satir ad="Renk" deger={a?.renk} />
              <Satir ad="Kondisyon" deger={a && KONDISYON_AD[a.kondisyon]} />
              <Satir ad="Tescil" deger={a && TESCIL_AD[a.tescilDurum]} />
              <Satir ad="Plaka" deger={a?.plaka} />
            </dl>
          </Bolum>
        );
      })}

      <Bolum baslik="Bedel">
        <dl className="grid grid-cols-2 gap-x-6">
          <Satir ad="Matrah" deger={tl(s.araToplam)} />
          <Satir ad={`ÖTV (${yuzde(s.kalemler[0]?.otvOrani)})`} deger={tl(s.otvToplam)} />
          <Satir ad={`KDV (${yuzde(s.kalemler[0]?.kdvOrani)})`} deger={tl(s.kdvToplam)} />
          <Satir ad="Toplam" deger={<span className="text-sm">{tl(s.genelToplam)}</span>} />
        </dl>
      </Bolum>

      <Bolum baslik="Ödeme planı">
        <table className="w-full">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-1 font-normal">Tarih</th><th className="font-normal">Yöntem</th><th className="font-normal">Taksit</th><th className="font-normal">Açıklama</th><th className="text-right font-normal">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {s.tahsilatlar.map((t) => (
              <tr key={t.id} className="border-t border-zinc-200">
                <td className="py-1">{tarih(t.tarih)}</td><td>{ODEME_AD[t.yontem]}</td><td>{t.taksit ?? "-"}</td><td>{t.aciklama ?? "-"}</td><td className="text-right">{tl(t.tutar)}</td>
              </tr>
            ))}
            {!s.tahsilatlar.length && <tr><td colSpan={5} className="py-1 text-zinc-500">Ödeme girilmemiş.</td></tr>}
          </tbody>
        </table>
      </Bolum>

      <Bolum baslik="Teslim">
        <dl className="grid grid-cols-2 gap-x-6">
          <Satir ad="Teslim tarihi" deger={tarih(s.teslimTarihi)} />
          <Satir ad="Satış temsilcisi" deger={s.satici?.adSoyad} />
          <Satir ad="Aksesuarlar" deger={s.aksesuarlar} />
          <Satir ad="Hizmetler" deger={s.hizmetler} />
          {s.not && <div className="col-span-2"><Satir ad="Not" deger={<span className="whitespace-pre-line">{s.not}</span>} /></div>}
        </dl>
      </Bolum>

      <Bolum baslik="Teslim öncesi kontrol listesi (PDI)">
        <ul className="grid grid-cols-2 gap-x-6">
          {maddeler.map((m) => {
            const tamam = yapilan.some((y) => y.ad === m.ad && y.tamam);
            return (
              <li key={m.id} className="flex items-center gap-2 border-b border-zinc-200 py-1">
                <span className="inline-flex h-4 w-4 items-center justify-center border border-zinc-900 text-[10px]">{tamam ? "✓" : ""}</span>
                {m.ad}
              </li>
            );
          })}
        </ul>
        <p className="mt-1 text-zinc-600">Kontrol eden: {s.teslimKontrol?.kontrolEden ?? "................................"}</p>
      </Bolum>

      <p className="mt-4 text-[11px] text-zinc-600">
        Aracı yukarıdaki özelliklerle, kontrol listesindeki maddeler gösterilerek eksiksiz teslim aldım. Kullanım ve garanti koşulları hakkında bilgilendirildim.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-12 text-center">
        <div className="border-t border-zinc-900 pt-1">Teslim eden<br />{s.satici?.adSoyad ?? ""}</div>
        <div className="border-t border-zinc-900 pt-1">Teslim alan<br />{c.unvan}</div>
      </div>
    </main>
  );
}
