import Link from "next/link";
import { notFound } from "next/navigation";
import { BaglantiButon, Etiket, Hucre, Kart, SayfaBaslik, Tablo } from "@/components/ui";
import { SATIS_DURUM_AD, tarih, telefonGoster, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";

export default async function MusteriDetay({ params }: { params: Promise<{ id: string }> }) {
  await yetkiIste();
  const id = Number((await params).id);
  const c = Number.isInteger(id)
    ? await db.cari.findUnique({
        where: { id },
        include: {
          satislar: { orderBy: { tarih: "desc" }, include: { kalemler: { include: { arac: true } }, satici: true } },
          garantiler: { include: { arac: true } },
        },
      })
    : null;
  if (!c) notFound();
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
      <SayfaBaslik baslik={c.unvan} aciklama={`Müşteri no ${c.id}`} sag={<BaglantiButon href={`/musteriler/${c.id}/duzenle`}>Düzenle</BaglantiButon>} />
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
    </>
  );
}
