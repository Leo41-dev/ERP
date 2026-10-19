import { SilButonu } from "@/components/SilButonu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BaglantiButon, Etiket, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { SATIS_DURUM_AD, tarih, teklifDurum, telefonGoster, tl } from "@/lib/bicim";
import { cariEkstre } from "@/lib/cari";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";

export default async function MusteriDetay({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste();
  const id = Number((await params).id);
  const c = Number.isInteger(id)
    ? await db.cari.findUnique({
        where: { id },
        include: {
          satislar: { orderBy: { tarih: "desc" }, include: { kalemler: { include: { arac: true } }, satici: true } },
          garantiler: { include: { arac: true } },
          teklifler: { orderBy: { tarih: "desc" }, take: 20, include: { kalemler: { orderBy: { sira: "asc" }, select: { aciklama: true } } } },
        },
      })
    : null;
  if (!c) notFound();
  const ekstre = await cariEkstre(c.id);
  const bakiye = ekstre.kapanis;
  const tahsilatYetki = k.rol !== "DEPO";
  const bilgi: [string, string][] = [
    ["TCKN / VKN", c.tckn ?? c.vkn ?? "-"],
    ["Vergi dairesi", c.vergiDairesi ?? "-"],
    ["Telefon", [c.telefon, c.telefon2].filter(Boolean).map(telefonGoster).join(", ") || "-"],
    ["E-posta", c.eposta ?? "-"],
    ["Adres", [c.acikAdres, [c.ilce, c.il].filter(Boolean).join("/")].filter(Boolean).join(" ") || "-"],
    ["Doğum tarihi", tarih(c.dogumTarihi)],
    ["KVKK onayı", c.kvkkOnay ? "Var" : "Yok"],
  ];
  return (
    <>
      <SayfaBaslik baslik={c.unvan} aciklama={`Müşteri no ${c.id}`} sag={
          <div className="flex gap-2">
            {tahsilatYetki && <BaglantiButon href={`/tahsilat/yeni?cari=${c.id}`}>Tahsilat al</BaglantiButon>}
            {(k.rol === "YONETICI" || k.rol === "MUHASEBE") && <SilButonu tur="cari" id={c.id} ad={c.unvan} />}
            <BaglantiButon href={`/musteriler/${c.id}/duzenle`} className="!bg-white !text-zinc-800 border border-zinc-300 hover:!bg-zinc-50">Düzenle</BaglantiButon>
          </div>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kart><p className="text-xs text-zinc-500">Toplam borç</p><p className="mt-1 text-lg font-semibold">{tl(ekstre.satirlar.reduce((t, x) => t + x.borc, 0))}</p></Kart>
        <Kart><p className="text-xs text-zinc-500">Toplam ödeme</p><p className="mt-1 text-lg font-semibold">{tl(ekstre.satirlar.reduce((t, x) => t + x.alacak, 0))}</p></Kart>
        <Kart>
          <p className="text-xs text-zinc-500">Bakiye</p>
          <p className={`mt-1 text-lg font-semibold ${bakiye > 0.004 ? "text-red-600" : bakiye < -0.004 ? "text-green-700" : ""}`}>
            {tl(Math.abs(bakiye))} {bakiye > 0.004 ? "borçlu" : bakiye < -0.004 ? "alacaklı" : ""}
          </p>
        </Kart>
      </div>
      <Kart baslik="Bilgiler">
        <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
          {bilgi.map(([k, v]) => (
            <div key={k}><dt className="text-xs text-zinc-500">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {c.not && <p className="mt-4 whitespace-pre-line text-sm text-zinc-600">{c.not}</p>}
      </Kart>
      <h2 className="mb-2 mt-6 text-sm font-semibold">Satışlar</h2>
      <Tablo basliklar={["Form no", "Tarih", "Araç / ürün", "Tutar", "Durum", "Satıcı"]} bos={!c.satislar.length}>
        {c.satislar.map((s) => (
          <tr key={s.id} className="hover:bg-zinc-50">
            <Hucre><Link href={`/satislar/${s.id}`} className="font-medium hover:underline">{s.formNo}</Link></Hucre>
            <Hucre>{tarih(s.tarih)}</Hucre>
            <Hucre>{s.kalemler.map((k) => (k.arac ? `${k.aciklama} (${k.arac.sase})` : k.aciklama)).join(", ")}</Hucre>
            <Hucre>{tl(s.genelToplam)}</Hucre>
            <Hucre><Etiket renk={s.durum === "IPTAL" ? "kirmizi" : s.durum === "FATURALANDI" ? "yesil" : "sari"}>{SATIS_DURUM_AD[s.durum]}</Etiket></Hucre>
            <Hucre>{s.satici?.adSoyad ?? "-"}</Hucre>
          </tr>
        ))}
      </Tablo>

      {c.teklifler.length > 0 && k.rol !== "DEPO" && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold">Teklifler</h2>
          <Tablo basliklar={["No", "Tarih", "Kalemler", "Tutar", "Durum"]}>
            {c.teklifler.filter((t) => k.rol !== "SATIS" || t.saticiId === k.id).map((t) => {
              const d = teklifDurum(t);
              return (
                <tr key={t.id}>
                  <Hucre><Link href={`/teklifler/${t.id}`} className="font-medium hover:underline">{t.teklifNo}</Link></Hucre>
                  <Hucre>{tarih(t.tarih)}</Hucre>
                  <Hucre className="max-w-72 truncate">{t.kalemler.map((x) => x.aciklama).join(", ")}</Hucre>
                  <Hucre>{tl(t.genelToplam)}</Hucre>
                  <Hucre><Etiket renk={d.renk}>{d.ad}</Etiket></Hucre>
                </tr>
              );
            })}
          </Tablo>
        </>
      )}

      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Cari ekstre</h2>
        <Link href={`/yazdir/ekstre/${c.id}`} target="_blank" className="text-sm text-zinc-600 hover:underline">Ekstreyi yazdır</Link>
      </div>
      <Tablo basliklar={["Tarih", "Açıklama", "Borç", "Alacak", "Bakiye"]} bos={!ekstre.satirlar.length}>
        {[...ekstre.satirlar].reverse().map((h) => (
          <tr key={h.id}>
            <Hucre>{tarih(h.tarih)}</Hucre>
            <Hucre>{h.satis ? <Link href={`/satislar/${h.satis.id}`} className="hover:underline">{h.aciklama}</Link> : h.aciklama}</Hucre>
            <Hucre>{h.borc ? tl(h.borc) : ""}</Hucre>
            <Hucre>{h.alacak ? tl(h.alacak) : ""}</Hucre>
            <Hucre>{tl(h.bakiye)}</Hucre>
          </tr>
        ))}
      </Tablo>
    </>
  );
}
