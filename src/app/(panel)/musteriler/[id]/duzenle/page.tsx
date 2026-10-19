import { notFound } from "next/navigation";
import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { CariFormu } from "../../CariFormu";
import { cariKaydet } from "../../eylem";

export default async function MusteriDuzenle({ params }: { params: Promise<{ id: string }> }) {
  await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const id = Number((await params).id);
  const cari = Number.isInteger(id) ? await db.cari.findUnique({ where: { id } }) : null;
  if (!cari) notFound();
  return (
    <>
      <SayfaBaslik baslik={`${cari.unvan} düzenle`} />
      <CariFormu eylem={cariKaydet.bind(null, id)} cari={cari} />
    </>
  );
}
