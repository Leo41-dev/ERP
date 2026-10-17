import Link from "next/link";
import { notFound } from "next/navigation";
import { BaglantiButon, Etiket, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { tarih, tarihSaat, teklifDurum, telefonGoster, tl, yuzde } from "@/lib/bicim";
import { belgeAyarlari } from "@/lib/belgeAyarlari";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { teklifReddet, teklifYenidenAc } from "../eylem";
import { RetFormu, YenidenAcButonu } from "./Islemler";

const ikincil = "!bg-white !text-zinc-800 border border-zinc-300 hover:!bg-zinc-50";

export default async function TeklifDetay({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const id = Number((await params).id);
  const t = Number.isInteger(id)
    ? await db.teklif.findUnique({ where: { id }, include: { cari: true, satici: true, firma: true, satis: true, kalemler: { orderBy: { sira: "asc" } } } })
    : null;
  if (!t || (k.rol === "SATIS" && t.saticiId !== k.id)) notFound();
  const ayar = await belgeAyarlari();
  const d = teklifDurum(t);
  const acik = t.durum === "ACIK";
  const aracli = t.kalemler.some((x) => x.modelId);

  const mesaj = [
    `Sayın ${t.musteriAd},`,
    `${t.firma?.unvan ?? ayar["belge.baslik"]} fiyat teklifimiz (No ${t.teklifNo}, ${tarih(t.gecerlilik)} tarihine kadar geçerlidir):`,
    ...t.kalemler.map((x) => `- ${x.aciklama}${Number(x.miktar) !== 1 ? ` x${Number(x.miktar).toLocaleString("tr-TR")}` : ""}: ${tl(x.tutar)}`),
    `Toplam: ${tl(t.genelToplam)} (KDV ve ÖTV dahil)`,
    t.odemeKosullari ? `Ödeme: ${t.odemeKosullari}` : null,
    t.satici ? `${t.satici.adSoyad}` : null,
  ].filter(Boolean).join("\n");
  const whatsapp = t.telefon ? `https://wa.me/90${t.telefon}?text=${encodeURIComponent(mesaj)}` : null;

  return (
    <>
      <SayfaBaslik
        baslik={`Teklif ${t.teklifNo}`}
        aciklama={`${tarihSaat(t.tarih)} · ${t.satici?.adSoyad ?? "-"}`}
        sag={
          <div className="flex flex-wrap items-center gap-2">
            <Etiket renk={d.renk}>{d.ad}</Etiket>
            <BaglantiButon href={`/yazdir/teklif/${t.id}`} target="_blank" className={ikincil}>Yazdır / PDF</BaglantiButon>
            {whatsapp && <BaglantiButon href={whatsapp} target="_blank" className={ikincil}>WhatsApp ile gönder</BaglantiButon>}
            <BaglantiButon href={`/teklifler/yeni?kopya=${t.id}`} className={ikincil}>Kopyala</BaglantiButon>
            {acik && <BaglantiButon href={`/teklifler/${t.id}/duzenle`} className={ikincil}>Düzenle</BaglantiButon>}
            {acik && k.rol !== "SERVIS" && (
              <BaglantiButon href={aracli ? `/satislar/yeni?teklif=${t.id}` : `/satislar/hizli?teklif=${t.id}`}>Satışa dönüştür</BaglantiButon>
            )}
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Kart baslik="Müşteri">
          <p className="text-sm font-medium">{t.cari ? <Link href={`/musteriler/${t.cari.id}`} className="hover:underline">{t.musteriAd}</Link> : t.musteriAd}</p>
          <p className="mt-1 text-sm text-zinc-600">{[t.telefon && telefonGoster(t.telefon), t.eposta, t.kimlikNo].filter(Boolean).join(" · ") || "-"}</p>
          {!t.cari && <p className="mt-1 text-xs text-zinc-500">Kayıtlı müşteri değil; satışa dönüşünce müşteri kaydı açılır.</p>}
        </Kart>
        <Kart baslik="Tutar">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-zinc-500">Matrah</dt><dd>{tl(t.araToplam)}</dd>
            <dt className="text-zinc-500">ÖTV</dt><dd>{tl(t.otvToplam)}</dd>
            <dt className="text-zinc-500">KDV</dt><dd>{tl(t.kdvToplam)}</dd>
            <dt className="font-medium">Toplam</dt><dd className="font-medium">{tl(t.genelToplam)}</dd>
            <dt className="text-zinc-500">Geçerlilik</dt><dd>{tarih(t.gecerlilik)}</dd>
          </dl>
        </Kart>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Kalemler</h2>
      <Tablo basliklar={["Açıklama", "Adet", "Birim fiyat", "ÖTV", "KDV", "Tutar"]}>
        {t.kalemler.map((x) => (
          <tr key={x.id}>
            <Hucre>{x.aciklama}{x.modelId && <span className="ml-2"><Etiket>Araç</Etiket></span>}</Hucre>
            <Hucre>{Number(x.miktar).toLocaleString("tr-TR")}</Hucre>
            <Hucre>{tl(x.birimFiyat)}</Hucre>
            <Hucre>{Number(x.otvOrani) ? yuzde(x.otvOrani) : "-"}</Hucre>
            <Hucre>{yuzde(x.kdvOrani)}</Hucre>
            <Hucre>{tl(x.tutar)}</Hucre>
          </tr>
        ))}
      </Tablo>

      {(t.odemeKosullari || t.not) && (
        <Kart baslik="Koşullar ve notlar" className="mt-6">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-xs text-zinc-500">Ödeme koşulları</dt><dd className="whitespace-pre-line">{t.odemeKosullari ?? "-"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Not</dt><dd className="whitespace-pre-line">{t.not ?? "-"}</dd></div>
          </dl>
        </Kart>
      )}

      {t.satis && (
        <Kart baslik="Satış" className="mt-6">
          <p className="text-sm">
            Bu teklif <Link href={`/satislar/${t.satis.id}`} className="font-medium hover:underline">{t.satis.formNo} numaralı satışa</Link> dönüştü · {tarih(t.satis.tarih)} · {tl(t.satis.genelToplam)}
          </p>
        </Kart>
      )}
      {acik && <Kart baslik="Müşteri almadı mı?" className="mt-6 md:w-1/2"><RetFormu eylem={teklifReddet.bind(null, t.id)} /></Kart>}
      {t.durum === "RET" && (
        <Kart baslik="Reddedildi" className="mt-6">
          <p className="mb-3 text-sm">{t.retNedeni}</p>
          <YenidenAcButonu eylem={teklifYenidenAc.bind(null, t.id)} />
        </Kart>
      )}
    </>
  );
}
