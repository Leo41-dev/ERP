import { db } from "@/lib/db";
import { mevcutKullanici } from "@/lib/oturum";

/** Cari arama: /musteriler/ara?q=ahmet — ad, telefon, TCKN veya VKN */
export async function GET(istek: Request) {
  const k = await mevcutKullanici();
  if (!k) return Response.json([], { status: 401 });
  const q = (new URL(istek.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json([]);
  const rakam = q.replace(/\D/g, "");
  const sonuc = await db.cari.findMany({
    where: { OR: [{ unvan: { contains: q.toLocaleUpperCase("tr-TR") } }, ...(rakam.length >= 4 ? [{ telefon: { contains: rakam.replace(/^0/, "") } }, { tckn: rakam }, { vkn: rakam }] : [])] },
    select: { id: true, unvan: true, telefon: true },
    orderBy: { unvan: "asc" },
    take: 10,
  });
  return Response.json(sonuc);
}
