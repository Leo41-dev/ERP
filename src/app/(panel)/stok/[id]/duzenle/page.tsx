import { notFound } from "next/navigation";
import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { urunTanimlari } from "@/lib/stokTanim";
import { urunKaydet } from "../../eylem";
import { UrunFormu } from "../../UrunFormu";

export const metadata = { title: "Ürünü düzenle" };

const yaz = (v: unknown) => (v === null || v === undefined ? undefined : String(v).replace(".", ","));

export default async function UrunDuzenle({ params }: { params: Promise<{ id: string }> }) {
  const k = await yetkiIste("DEPO", "MUHASEBE");
  const id = Number((await params).id);
  const u = Number.isInteger(id) ? await db.urun.findUnique({ where: { id } }) : null;
  if (!u || u.tur === "ARAC") notFound();
  const tanim = await urunTanimlari(db, u);
  return (
    <>
      <SayfaBaslik baslik={`${u.kod} · düzenle`} />
      <UrunFormu
        eylem={urunKaydet.bind(null, u.id)}
        {...tanim}
        yonetici={k.rol === "YONETICI"}
        maliyetGoster={maliyetGorur(k)}
        v={{
          ad: u.ad, tur: u.tur, kod: u.kod, barkod: u.barkod ?? undefined, grupId: u.grupId ? String(u.grupId) : undefined, markaId: u.markaId ? String(u.markaId) : undefined, birim: u.birim, raf: u.raf ?? undefined,
          kritikStok: yaz(u.kritikStok), satisFiyati: yaz(u.satisFiyati), kdvOrani: String(Number(u.kdvOrani)), alisFiyati: yaz(u.alisFiyati), not: u.not ?? undefined, aktif: u.aktif,
        }}
      />
    </>
  );
}
