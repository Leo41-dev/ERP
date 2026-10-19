"use client";
import { useActionState, useState } from "react";
import { sifirlamadan } from "@/components/form";
import { Alan, Buton, Girdi, HataKutusu, Secim } from "@/components/ui";
import type { UrunDurum } from "../eylem";

export function StokDuzeltFormu({ eylem, birim }: { eylem: (d: UrunDurum, f: FormData) => Promise<UrunDurum>; birim: string }) {
  const [durum, gonder, bekliyor] = useActionState(eylem, undefined);
  const [tur, setTur] = useState("CIKIS");
  const h = durum?.hatalar ?? {};
  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-3">
      <HataKutusu mesaj={durum?.genel} />
      {durum?.tamam && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{durum.tamam}</p>}
      <div className="grid gap-3 md:grid-cols-4">
        <Alan etiket="İşlem">
          <Secim name="tur" value={tur} onChange={(e) => setTur(e.target.value)}>
            <option value="CIKIS">Çıkış (fire, kayıp, kullanım)</option>
            <option value="ACILIS">Açılış / elle giriş</option>
          </Secim>
        </Alan>
        <Alan etiket={`Miktar (${birim})`} hata={h.miktar}><Girdi name="miktar" inputMode="decimal" /></Alan>
        {tur === "ACILIS" && <Alan etiket="Birim maliyet (KDV hariç)" hata={h.maliyet}><Girdi name="maliyet" inputMode="decimal" /></Alan>}
        <Alan etiket={tur === "CIKIS" ? "Neden" : "Açıklama"} hata={h.aciklama} className={tur === "ACILIS" ? "" : "md:col-span-2"}><Girdi name="aciklama" /></Alan>
      </div>
      <p className="text-xs text-zinc-500">Tedarikçiden gelen mal için Stok girişi ekranını, sayım farkları için Sayım ekranını kullanın.</p>
      <Buton type="submit" tur="ikincil" disabled={bekliyor}>{bekliyor ? "Kaydediliyor..." : "Kaydet"}</Buton>
    </form>
  );
}
