"use client";
import { useActionState } from "react";
import { Alan, Buton, Girdi, HataKutusu } from "@/components/ui";
import { girisEylemi } from "./eylem";

export function GirisFormu({ ad }: { ad: string }) {
  const [durum, eylem, bekliyor] = useActionState(girisEylemi, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <form action={eylem} className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
        <div>
          <h1 className="text-lg font-semibold">{ad}</h1>
          <p className="text-sm text-zinc-500">Hesabınızla giriş yapın.</p>
        </div>
        <HataKutusu mesaj={durum?.hata} />
        <Alan etiket="Kullanıcı adı">
          <Girdi name="kullaniciAdi" autoComplete="username" required autoFocus />
        </Alan>
        <Alan etiket="Şifre">
          <Girdi name="sifre" type="password" autoComplete="current-password" required />
        </Alan>
        <Buton type="submit" disabled={bekliyor} className="w-full">
          {bekliyor ? "Giriş yapılıyor..." : "Giriş yap"}
        </Buton>
      </form>
    </main>
  );
}
