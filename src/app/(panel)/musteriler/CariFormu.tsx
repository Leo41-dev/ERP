"use client";
import { sifirlamadan } from "@/components/form";
import { useActionState } from "react";
import type { Cari } from "@prisma/client";
import { Alan, Buton, Girdi, HataKutusu, Kart, MetinAlani, Secim } from "@/components/ui";
import type { CariDurum } from "./eylem";

type Eylem = (d: CariDurum, f: FormData) => Promise<CariDurum>;

export function CariFormu({ eylem, cari }: { eylem: Eylem; cari?: Cari }) {
  const [durum, gonder, bekliyor] = useActionState(eylem, undefined);
  const h = durum?.hatalar ?? {};
  const tarih = cari?.dogumTarihi ? cari.dogumTarihi.toISOString().slice(0, 10) : "";
  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-4">
      <HataKutusu mesaj={durum?.genel} />
      <Kart baslik="Kimlik">
        <div className="grid gap-4 md:grid-cols-3">
          <Alan etiket="Ad soyad / ünvan" hata={h.unvan} className="md:col-span-2">
            <Girdi name="unvan" defaultValue={cari?.unvan} required />
          </Alan>
          <Alan etiket="Rol">
            <Secim name="rol" defaultValue={cari?.rol ?? "MUSTERI"}>
              <option value="MUSTERI">Müşteri</option>
              <option value="TEDARIKCI">Tedarikçi</option>
              <option value="MUSTERI_TEDARIKCI">Müşteri + tedarikçi</option>
            </Secim>
          </Alan>
          <Alan etiket="TCKN / VKN" hata={h.kimlikNo}>
            <Girdi name="kimlikNo" inputMode="numeric" defaultValue={cari?.tckn ?? cari?.vkn ?? ""} />
          </Alan>
          <Alan etiket="Vergi dairesi (kurumsal)">
            <Girdi name="vergiDairesi" defaultValue={cari?.vergiDairesi ?? ""} />
          </Alan>
          <Alan etiket="TCKK seri no">
            <Girdi name="tckkSeriNo" defaultValue={cari?.tckkSeriNo ?? ""} />
          </Alan>
          <Alan etiket="Doğum tarihi" hata={h.dogumTarihi}>
            <Girdi name="dogumTarihi" type="date" defaultValue={tarih} />
          </Alan>
        </div>
      </Kart>
      <Kart baslik="İletişim">
        <div className="grid gap-4 md:grid-cols-3">
          <Alan etiket="Cep telefonu" hata={h.telefon}>
            <Girdi name="telefon" inputMode="tel" placeholder="5xx xxx xx xx" defaultValue={cari?.telefon ?? ""} />
          </Alan>
          <Alan etiket="İkinci telefon" hata={h.telefon2}>
            <Girdi name="telefon2" inputMode="tel" defaultValue={cari?.telefon2 ?? ""} />
          </Alan>
          <Alan etiket="E-posta" hata={h.eposta}>
            <Girdi name="eposta" type="email" defaultValue={cari?.eposta ?? ""} />
          </Alan>
          <Alan etiket="İl" hata={h.il}>
            <Girdi name="il" defaultValue={cari?.il ?? ""} />
          </Alan>
          <Alan etiket="İlçe" hata={h.ilce}>
            <Girdi name="ilce" defaultValue={cari?.ilce ?? ""} />
          </Alan>
          <Alan etiket="Açık adres" hata={h.acikAdres} className="md:col-span-3">
            <Girdi name="acikAdres" defaultValue={cari?.acikAdres ?? ""} />
          </Alan>
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="eTebligat" defaultChecked={cari?.eTebligat} /> E-tebligat adresi var</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="kvkkOnay" defaultChecked={cari?.kvkkOnay} /> KVKK aydınlatma onayı alındı</label>
        </div>
      </Kart>
      <Kart baslik="Not">
        <MetinAlani name="not" defaultValue={cari?.not ?? ""} />
      </Kart>
      <Buton type="submit" disabled={bekliyor}>{bekliyor ? "Kaydediliyor..." : "Kaydet"}</Buton>
    </form>
  );
}
