import Link from "next/link";
import { BaglantiButon, Etiket, Hucre, SayfaBaslik, Tablo } from "@/components/ui";
import { ROL_AD, tarihSaat } from "@/lib/bicim";
import { db } from "@/lib/db";
import { yetkiIste } from "@/lib/oturum";

export default async function Kullanicilar() {
  await yetkiIste("YONETICI");
  const liste = await db.kullanici.findMany({ orderBy: [{ aktif: "desc" }, { adSoyad: "asc" }] });
  return (
    <>
      <SayfaBaslik baslik="Kullanıcılar" sag={<BaglantiButon href="/ayarlar/kullanicilar/yeni">Yeni kullanıcı</BaglantiButon>} />
      <Tablo basliklar={["Ad soyad", "Kullanıcı adı", "Rol", "Durum", "Son giriş"]} bos={!liste.length}>
        {liste.map((x) => (
          <tr key={x.id}>
            <Hucre><Link href={`/ayarlar/kullanicilar/${x.id}`} className="font-medium hover:underline">{x.adSoyad}</Link></Hucre>
            <Hucre className="font-mono text-xs">{x.kullaniciAdi}</Hucre>
            <Hucre>{ROL_AD[x.rol]}</Hucre>
            <Hucre>{x.aktif ? <Etiket renk="yesil">Aktif</Etiket> : <Etiket>Pasif</Etiket>}</Hucre>
            <Hucre>{x.sonGiris ? tarihSaat(x.sonGiris) : "-"}</Hucre>
          </tr>
        ))}
      </Tablo>
    </>
  );
}
