import { SilButonu } from "@/components/SilButonu";
import { Alan, Girdi, Kart, MetinAlani } from "@/components/ui";
import { db } from "@/lib/db";
import { firmaKaydet } from "./eylem";
import { AyarFormu } from "./Formlar";
import { BelgeAyarKarti } from "./ortak";

export const metadata = { title: "Ayarlar · Genel" };

export default async function GenelAyarlar() {
  const firmalar = await db.firma.findMany({ orderBy: { id: "asc" } });
  return (
    <>
      <p className="mb-4 text-sm text-zinc-500">Firma bilgileri ve bütün belgelerde ortak olan alanlar. Kullanılmayan tanım silinebilir; işlem görmüş olan silinmez, pasif yapılır ki eski kayıtlar bozulmasın.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Kart baslik="Firma bilgileri">
          {[...firmalar, null].map((f) => (
            <div key={f?.id ?? "yeni"} className="mb-4 last:mb-0">
              {!f && firmalar.length > 0 && <p className="mb-2 text-xs font-medium text-zinc-500">Yeni firma (ör. hizmet satışı yapan firma)</p>}
              <AyarFormu eylem={firmaKaydet} buton={f ? "Kaydet" : "Firma ekle"} className="grid gap-2 md:grid-cols-2">
                {f && <input type="hidden" name="id" value={f.id} />}
                <Alan etiket="Unvan" className="md:col-span-2"><Girdi name="unvan" defaultValue={f?.unvan} required /></Alan>
                <Alan etiket="VKN / TCKN"><Girdi name="vkn" defaultValue={f?.vkn} inputMode="numeric" required /></Alan>
                <Alan etiket="Vergi dairesi"><Girdi name="vergiDairesi" defaultValue={f?.vergiDairesi ?? ""} /></Alan>
                <Alan etiket="Adres" className="md:col-span-2"><MetinAlani name="adres" rows={2} defaultValue={f?.adres ?? ""} /></Alan>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" name="varsayilan" defaultChecked={f ? f.varsayilan : firmalar.length === 0} /> Satış formunda varsayılan firma
                </label>
              </AyarFormu>
              {f && <div className="mt-1 text-right"><SilButonu kucuk tur="firma" id={f.id} ad={f.unvan} /></div>}
            </div>
          ))}
        </Kart>
        <BelgeAyarKarti baslik="Belgelerde ortak" anahtarlar={["belge.baslik"]} />
      </div>
    </>
  );
}
