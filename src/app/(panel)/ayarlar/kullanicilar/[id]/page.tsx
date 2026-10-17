import { notFound } from "next/navigation";
import { SayfaBaslik } from "@/components/ui";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";
import { kullaniciKaydet } from "../../eylem";
import { KullaniciFormu } from "../KullaniciFormu";

export default async function KullaniciDuzenle({ params }: { params: Promise<{ id: string }> }) {
  await yetkiIste("YONETICI");
  const id = Number((await params).id);
  const k = Number.isInteger(id) ? await db.kullanici.findUnique({ where: { id } }) : null;
  if (!k) notFound();
  return (
    <>
      <SayfaBaslik baslik={k.adSoyad} aciklama="Kullanıcıyı düzenle" />
      <KullaniciFormu eylem={kullaniciKaydet.bind(null, k.id)} k={{ kullaniciAdi: k.kullaniciAdi, adSoyad: k.adSoyad, eposta: k.eposta, rol: k.rol, aktif: k.aktif }} />
    </>
  );
}
