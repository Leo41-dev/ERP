import { notFound, redirect } from "next/navigation";
import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { satisKalani } from "@/lib/satis/iade";
import { iadeKaydet } from "./eylem";
import { IadeFormu } from "./IadeFormu";

export default async function IadeAl({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste("SATIS", "MUHASEBE");
  const id = Number((await params).id);
  const s = Number.isInteger(id)
    ? await db.satis.findUnique({
        where: { id },
        include: { cari: true, kalemler: { orderBy: { id: "asc" }, include: { iadeler: true, arac: true, urun: { select: { tur: true } } } }, iadeler: { include: { geriOdemeler: true } }, tahsilatlar: true },
      })
    : null;
  if (!s || (k.rol === "SATIS" && s.saticiId !== k.id)) notFound();
  if (!(s.durum === "FATURALANDI" || (s.durum === "KAYITLI" && s.tur === "HIZLI"))) redirect(`/satislar/${id}`);
  const tahsil = s.tahsilatlar.filter((t) => !t.iptalZamani).reduce((a, t) => a + Number(t.tutar), 0);
  const geri = s.iadeler.reduce((a, i) => a + i.geriOdemeler.reduce((b, g) => b + Number(g.tutar), 0), 0);
  const iade = s.iadeler.reduce((a, i) => a + Number(i.tutar), 0);
  return (
    <>
      <SayfaBaslik baslik={`Satış ${s.formNo} · iade`} aciklama={`${s.cari.unvan} · kayıt silinmez; iade cariye alacak, geri ödeme borç olarak yazılır.`} />
      <IadeFormu
        eylem={iadeKaydet.bind(null, s.id)}
        alinan={Math.round((tahsil - geri) * 100) / 100}
        acik={satisKalani({ genelToplam: Number(s.genelToplam), iade, tahsil, geriOdeme: geri, kesinti: Number(s.kesintiToplam) })}
        tescilli={s.kalemler.some((x) => x.arac && (x.arac.tescilDurum !== "TESCILSIZ" || x.arac.plaka))}
        kalemler={s.kalemler.map((x) => {
          const miktar = Number(x.miktar);
          return {
            id: x.id,
            aciklama: x.arac ? `${x.aciklama} · ${x.arac.sase}` : x.aciklama,
            arac: !!x.aracId,
            stoklu: !!x.urunId && x.urun?.tur !== "HIZMET",
            miktar,
            kalan: Math.round((miktar - x.iadeler.reduce((a, i) => a + Number(i.miktar), 0)) * 1000) / 1000,
            birim: Number(x.tutar) / miktar,
          };
        })}
      />
    </>
  );
}
