import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BaglantiButon, Etiket, Girdi, Hucre, SayfaBaslik, Secim, Tablo } from "@/components/ui";
import { URUN_TUR_AD, miktar, tl } from "@/lib/bicim";
import { db } from "@/lib/db";
import { maliyetGorur, yetkiIste } from "@/lib/oturum";
import { kritikDurum } from "@/lib/stokHesap";

export const metadata = { title: "Stok" };

const DURUM = { eksi: ["kirmizi", "Eksi"], yok: ["gri", "Yok"], kritik: ["sari", "Kritik"], normal: null } as const;

export default async function Stok({ searchParams }: { searchParams: Promise<{ q?: string; tur?: string; grup?: string; durum?: string; pasif?: string }> }) {
  const k = await yetkiIste();
  const p = await searchParams;
  const q = (p.q ?? "").trim().toLocaleUpperCase("tr-TR");
  const where: Prisma.UrunWhereInput = {
    tur: p.tur ? (p.tur as Prisma.UrunWhereInput["tur"]) : { not: "ARAC" },
    ...(p.pasif ? {} : { aktif: true }),
    ...(p.grup ? { grup: p.grup } : {}),
    ...(p.durum === "eksi" ? { miktar: { lt: 0 } } : p.durum === "stokta" ? { miktar: { gt: 0 } } : {}),
    ...(q ? { OR: [{ kod: { contains: q } }, { ad: { contains: q } }, { barkod: q }, { raf: { contains: q } }] } : {}),
  };
  const maliyet = maliyetGorur(k);
  const yonetebilir = k.rol === "YONETICI" || k.rol === "DEPO" || k.rol === "MUHASEBE";
  const [hepsi, gruplar, ozet] = await Promise.all([
    db.urun.findMany({ where, orderBy: [{ grup: "asc" }, { ad: "asc" }], take: p.durum === "kritik" ? undefined : 300 }),
    db.urun.findMany({ where: { grup: { not: null }, tur: { not: "ARAC" } }, distinct: ["grup"], select: { grup: true }, orderBy: { grup: "asc" } }),
    db.$queryRaw<{ kart: bigint; deger: number | null; kritik: bigint; eksi: bigint }[]>`
      SELECT count(*) AS kart,
             sum(CASE WHEN "miktar" > 0 THEN "miktar" * coalesce("ortMaliyet", 0) END)::float AS deger,
             count(*) FILTER (WHERE "kritikStok" IS NOT NULL AND "miktar" <= "kritikStok" AND "miktar" >= 0) AS kritik,
             count(*) FILTER (WHERE "miktar" < 0) AS eksi
      FROM "Urun" WHERE "aktif" AND "tur" NOT IN ('ARAC', 'HIZMET')`,
  ]);
  const urunler = p.durum === "kritik" ? hepsi.filter((u) => u.tur !== "HIZMET" && ["kritik", "yok"].includes(kritikDurum(Number(u.miktar), u.kritikStok === null ? null : Number(u.kritikStok))) && u.kritikStok !== null).slice(0, 300) : hepsi;
  const o = ozet[0];
  const sorgu = (ek: Record<string, string>) => `?${new URLSearchParams({ ...(p.q ? { q: p.q } : {}), ...ek })}`;

  return (
    <>
      <SayfaBaslik
        baslik="Stok"
        aciklama="Parça, aksesuar, ekipman ve hizmet kartları. Araçlar şase bazında Araçlar sayfasında."
        sag={yonetebilir && (
          <div className="flex flex-wrap gap-2">
            <BaglantiButon href="/stok/sayim" className="border border-zinc-300 !bg-white !text-zinc-800 hover:!bg-zinc-50">Sayım</BaglantiButon>
            <BaglantiButon href="/stok/giris" className="border border-zinc-300 !bg-white !text-zinc-800 hover:!bg-zinc-50">Stok girişi</BaglantiButon>
            <BaglantiButon href="/stok/yeni">Yeni ürün</BaglantiButon>
          </div>
        )}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kutu ad="Aktif ürün kartı" deger={Number(o.kart).toLocaleString("tr-TR")} />
        {maliyet ? <Kutu ad="Stok değeri (maliyet)" deger={tl(o.deger ?? 0)} /> : <Kutu ad="Stokta olan ürün" deger={hepsi.filter((u) => Number(u.miktar) > 0).length.toLocaleString("tr-TR")} />}
        <Kutu ad="Kritik seviyede" deger={Number(o.kritik).toLocaleString("tr-TR")} href={sorgu({ durum: "kritik" })} uyari={Number(o.kritik) > 0} />
        <Kutu ad="Eksi stokta" deger={Number(o.eksi).toLocaleString("tr-TR")} href={sorgu({ durum: "eksi" })} uyari={Number(o.eksi) > 0} />
      </div>
      <form className="mb-4 grid gap-2 md:grid-cols-5">
        <Girdi name="q" defaultValue={p.q} placeholder="Kod, ad, barkod veya raf" className="md:col-span-2" autoFocus />
        <Secim name="tur" defaultValue={p.tur ?? ""}>
          <option value="">Tüm türler</option>
          {["YEDEK_PARCA", "AKSESUAR", "HIZMET", "DIGER"].map((t) => <option key={t} value={t}>{URUN_TUR_AD[t]}</option>)}
        </Secim>
        <Secim name="grup" defaultValue={p.grup ?? ""}>
          <option value="">Tüm gruplar</option>
          {gruplar.map((g) => <option key={g.grup} value={g.grup!}>{g.grup}</option>)}
        </Secim>
        <Secim name="durum" defaultValue={p.durum ?? ""}>
          <option value="">Tüm stok durumları</option>
          <option value="stokta">Stokta olanlar</option>
          <option value="kritik">Kritik seviyede</option>
          <option value="eksi">Eksi stokta</option>
        </Secim>
        <button className="hidden" />
      </form>
      <div className="mb-2 flex justify-between text-xs text-zinc-500">
        <span>{urunler.length} ürün{urunler.length === 300 ? " (ilk 300, aramayı daraltın)" : ""}</span>
        {maliyet && <a href={`/stok/csv${sorgu({ ...(p.tur ? { tur: p.tur } : {}), ...(p.grup ? { grup: p.grup } : {}) })}`} className="hover:underline">{"Excel'e aktar (CSV)"}</a>}
      </div>
      <Tablo basliklar={["Kod", "Ürün", "Grup", "Raf", "Miktar", "", "Satış fiyatı", ...(maliyet ? ["Ort. maliyet", "Stok değeri"] : [])]} bos={!urunler.length}>
        {urunler.map((u) => {
          const m = Number(u.miktar);
          const d = u.tur === "HIZMET" ? null : DURUM[kritikDurum(m, u.kritikStok === null ? null : Number(u.kritikStok))];
          return (
            <tr key={u.id} className={`hover:bg-zinc-50 ${u.aktif ? "" : "text-zinc-400"}`}>
              <Hucre><Link href={`/stok/${u.id}`} className="font-mono font-medium hover:underline">{u.kod}</Link></Hucre>
              <Hucre className="max-w-80 truncate"><Link href={`/stok/${u.id}`} className="hover:underline">{u.ad}</Link></Hucre>
              <Hucre>{u.grup ?? "-"}</Hucre>
              <Hucre>{u.raf ?? "-"}</Hucre>
              <Hucre className={`text-right tabular-nums ${m < 0 ? "text-red-700" : ""}`}>{u.tur === "HIZMET" ? "-" : `${miktar(m)} ${u.birim}`}</Hucre>
              <Hucre>{d && <Etiket renk={d[0]}>{d[1]}</Etiket>}</Hucre>
              <Hucre className="text-right tabular-nums">{tl(u.satisFiyati)}</Hucre>
              {maliyet && <Hucre className="text-right tabular-nums">{tl(u.ortMaliyet)}</Hucre>}
              {maliyet && <Hucre className="text-right tabular-nums">{m > 0 && u.ortMaliyet ? tl(m * Number(u.ortMaliyet)) : "-"}</Hucre>}
            </tr>
          );
        })}
      </Tablo>
    </>
  );
}

function Kutu({ ad, deger, href, uyari }: { ad: string; deger: string; href?: string; uyari?: boolean }) {
  const ic = (
    <>
      <p className="text-xs text-zinc-500">{ad}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${uyari ? "text-amber-700" : ""}`}>{deger}</p>
    </>
  );
  return href ? <Link href={href} className="rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400">{ic}</Link> : <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">{ic}</div>;
}
