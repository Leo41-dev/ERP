import { SilButonu } from "@/components/SilButonu";
import { Alan, Girdi, Kart, Secim } from "@/components/ui";
import { ODEME_AD } from "@/lib/bicim";
import { db } from "@/lib/db";
import { HESAP_TUR_AD, VARSAYILAN_YONTEMLER, varsayilanHesaplar } from "@/lib/finans";
import { aktiflikDegistir, finansKategoriEkle, finansVarsayilanKaydet } from "../eylem";
import { AktiflikButonu, AyarFormu } from "../Formlar";
import { Liste } from "../ortak";

export const metadata = { title: "Ayarlar · Finans" };

export default async function FinansAyarlari() {
  const [hesaplar, varsayilan, kategoriler] = await Promise.all([
    db.finansHesabi.findMany({ where: { aktif: true }, orderBy: [{ tur: "asc" }, { ad: "asc" }] }),
    varsayilanHesaplar(),
    db.finansKategori.findMany({ orderBy: { ad: "asc" } }),
  ]);
  return (
    <>
      <p className="mb-4 text-sm text-zinc-500">Kasa ve banka hesapları Banka ve kasa sayfasında açılır. Burada ödemelerin hangi hesaba işleneceği ve gelir/gider kategorileri seçilir.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Kart baslik="Ödemelerin işleneceği hesap" className="lg:col-span-2" sag={<span className="text-xs text-zinc-500">Ödeme ekranında satır bazında değiştirilebilir</span>}>
          {hesaplar.length ? (
            <AyarFormu eylem={finansVarsayilanKaydet} buton="Kaydet" className="grid gap-3 md:grid-cols-3">
              {VARSAYILAN_YONTEMLER.map((y) => (
                <Alan key={y} etiket={y === "CEK" || y === "SENET" ? `${ODEME_AD[y]} (tahsil edilince)` : ODEME_AD[y]}>
                  <Secim name={y} defaultValue={String(varsayilan[y] ?? "")}>
                    <option value="">Hesaba işlenmesin</option>
                    {hesaplar.map((h) => <option key={h.id} value={h.id}>{h.ad} ({HESAP_TUR_AD[h.tur]})</option>)}
                  </Secim>
                </Alan>
              ))}
            </AyarFormu>
          ) : (
            <p className="text-sm text-zinc-500">Önce Banka ve kasa sayfasından hesap açın.</p>
          )}
        </Kart>
        {(["GIDER", "GELIR"] as const).map((tur) => (
          <Kart key={tur} baslik={tur === "GIDER" ? "Gider kategorileri" : "Gelir kategorileri"}>
            <Liste
              ogeler={kategoriler.filter((k) => k.tur === tur).map((k) => ({
                id: k.id, ad: k.ad, aktif: k.aktif,
                sag: <span className="flex gap-3"><AktiflikButonu aktif={k.aktif} eylem={aktiflikDegistir.bind(null, "finansKategori", k.id)} /><SilButonu kucuk tur="finansKategori" id={k.id} ad={k.ad} /></span>,
              }))}
            />
            <AyarFormu eylem={finansKategoriEkle.bind(null, tur)}><Girdi name="ad" placeholder={tur === "GIDER" ? "Yeni gider (ör. Yakıt)" : "Yeni gelir (ör. Kira geliri)"} className="w-auto flex-1" required /></AyarFormu>
          </Kart>
        ))}
      </div>
    </>
  );
}
