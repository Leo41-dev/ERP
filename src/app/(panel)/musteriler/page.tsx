import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BaglantiButon, Girdi, Hucre, SayfaBaslik, Tablo } from "@/components/ui";
import { telefonGoster } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";

export default async function Musteriler({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await yetkiIste();
  const q = ((await searchParams).q ?? "").trim();
  const rakam = q.replace(/\D/g, "");
  const where: Prisma.CariWhereInput = q
    ? {
        OR: [
          { unvan: { contains: q.toLocaleUpperCase("tr-TR"), mode: "insensitive" } },
          ...(rakam.length >= 4 ? [{ tckn: { startsWith: rakam } }, { vkn: { startsWith: rakam } }, { telefon: { contains: rakam.replace(/^0/, "") } }] : []),
        ],
      }
    : {};
  const cariler = await db.cari.findMany({ where, orderBy: { id: "desc" }, take: 50, include: { _count: { select: { satislar: true } } } });
  return (
    <>
      <SayfaBaslik baslik="Müşteriler" sag={<BaglantiButon href="/musteriler/yeni">Yeni müşteri</BaglantiButon>} />
      <form className="mb-4 max-w-md">
        <Girdi name="q" defaultValue={q} placeholder="Ad, telefon veya TCKN/VKN ile ara" />
      </form>
      <Tablo basliklar={["Ad soyad / ünvan", "TCKN / VKN", "Telefon", "İl / ilçe", "Satış"]} bos={!cariler.length}>
        {cariler.map((c) => (
          <tr key={c.id} className="hover:bg-zinc-50">
            <Hucre><Link href={`/musteriler/${c.id}`} className="font-medium hover:underline">{c.unvan}</Link></Hucre>
            <Hucre>{c.tckn ?? c.vkn ?? "-"}</Hucre>
            <Hucre>{telefonGoster(c.telefon)}</Hucre>
            <Hucre>{[c.il, c.ilce].filter(Boolean).join(" / ") || "-"}</Hucre>
            <Hucre>{c._count.satislar}</Hucre>
          </tr>
        ))}
      </Tablo>
    </>
  );
}
