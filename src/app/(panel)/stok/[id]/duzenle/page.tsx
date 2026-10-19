import { notFound } from "next/navigation";
import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { urunKaydet } from "../../eylem";
import { UrunFormu } from "../../UrunFormu";

export const metadata = { title: "Ürünü düzenle" };

const yaz = (v: unknown) => (v === null || v === undefined ? undefined : String(v).replace(".", ","));

export default async function UrunDuzenle({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const id = Number((await params).id);
  const [u, gruplar] = await Promise.all([
    Number.isInteger(id) ? db.urun.findUnique({ where: { id } }) : null,
    db.urun.findMany({ where: { grup: { not: null } }, distinct: ["grup"], select: { grup: true }, orderBy: { grup: "asc" } }),
  ]);
  if (!u || u.tur === "ARAC") notFound();
  return (
    <>
      <SayfaBaslik baslik={`${u.kod} · düzenle`} />
      <UrunFormu
        eylem={urunKaydet.bind(null, u.id)}
        gruplar={gruplar.map((g) => g.grup!)}
        maliyetGoster={maliyetGorur(k)}
        v={{
          ad: u.ad, tur: u.tur, kod: u.kod, barkod: u.barkod ?? undefined, grup: u.grup ?? undefined, birim: u.birim, raf: u.raf ?? undefined,
          kritikStok: yaz(u.kritikStok), satisFiyati: yaz(u.satisFiyati), kdvOrani: String(Number(u.kdvOrani)), alisFiyati: yaz(u.alisFiyati), not: u.not ?? undefined, aktif: u.aktif,
        }}
      />
    </>
  );
}
