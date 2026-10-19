"use client";
import { useActionState } from "react";
import type { Rol } from "@prisma/client";
import { Alan, BaglantiButon, Buton, Girdi, HataKutusu, Secim } from "@/components/ui";
import { sifirlamadan } from "@/components/form";
import { ROL_AD } from "@/lib/bicim";
import type { AyarDurum } from "../eylem";

type Kullanici = { kullaniciAdi: string; adSoyad: string; eposta: string | null; rol: Rol; aktif: boolean };

export function KullaniciFormu({ eylem, k }: { eylem: (d: AyarDurum, f: FormData) => Promise<AyarDurum>; k?: Kullanici }) {
  const [d, gonder, bekliyor] = useActionState(eylem, undefined);
  return (
    <form onSubmit={sifirlamadan(gonder)} className="grid max-w-xl gap-3 md:grid-cols-2">
      <div className="md:col-span-2"><HataKutusu mesaj={d?.hata} /></div>
      <Alan etiket="Ad soyad"><Girdi name="adSoyad" defaultValue={k?.adSoyad} required /></Alan>
      <Alan etiket="Kullanıcı adı"><Girdi name="kullaniciAdi" defaultValue={k?.kullaniciAdi} autoComplete="off" required className="lowercase" /></Alan>
      <Alan etiket="E-posta"><Girdi name="eposta" type="email" defaultValue={k?.eposta ?? ""} /></Alan>
      <Alan etiket="Rol">
        <Secim name="rol" defaultValue={k?.rol ?? "SATIS"}>
          {Object.entries(ROL_AD).map(([v, ad]) => <option key={v} value={v}>{ad}</option>)}
        </Secim>
      </Alan>
      <Alan etiket={k ? "Yeni şifre (değişmeyecekse boş bırakın)" : "Şifre"} className="md:col-span-2">
        <Girdi name="sifre" type="password" autoComplete="new-password" required={!k} placeholder="En az 8 karakter, harf ve rakam" />
      </Alan>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" name="aktif" defaultChecked={k?.aktif ?? true} /> Aktif (pasif kullanıcı giriş yapamaz)
      </label>
      <div className="flex gap-2 md:col-span-2">
        <Buton disabled={bekliyor}>Kaydet</Buton>
        <BaglantiButon href="/ayarlar/kullanicilar" className="!bg-white !text-zinc-800 border border-zinc-300">Vazgeç</BaglantiButon>
      </div>
    </form>
  );
}
