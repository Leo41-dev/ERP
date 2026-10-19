import { db } from "@/lib/db";
import { TanimKarti } from "../ortak";

export const metadata = { title: "Ayarlar · Stok" };

export default async function StokAyarlari() {
  const [gruplar, markalar] = await Promise.all([
    db.urunGrubu.findMany({ orderBy: { ad: "asc" }, include: { _count: { select: { urunler: true } } } }),
    db.urunMarkasi.findMany({ orderBy: { ad: "asc" }, include: { _count: { select: { urunler: true } } } }),
  ]);
  return (
    <>
      <p className="mb-4 text-sm text-zinc-500">Parça, aksesuar ve hizmet kartlarında seçilen tanımlar. Ad değişikliği bağlı bütün ürünlerde görünür; pasif kayıt yeni kartlarda çıkmaz.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <TanimKarti tur="urunGrubu" baslik="Ürün grupları" ipucu="Yeni grup (ör. FİLTRE)" liste={gruplar} />
        <TanimKarti tur="urunMarkasi" baslik="Ürün markaları" ipucu="Yeni marka (ör. MOTUL)" liste={markalar} />
      </div>
    </>
  );
}
