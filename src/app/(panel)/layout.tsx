import type { ReactNode } from "react";
import { ROL_AD } from "@/lib/bicim";
import { yetkiIste } from "@/lib/oturum";
import { cikisEylemi } from "./eylem";
import { Menu } from "./Menu";

export default async function PanelDuzeni({ children }: { children: ReactNode }) {
  const k = await yetkiIste();
  const ogeler = [
    { href: "/", ad: "Pano" },
    { href: "/satislar", ad: "Satışlar" },
    { href: "/araclar", ad: "Araçlar" },
    { href: "/musteriler", ad: "Müşteriler" },
    ...(k.rol === "YONETICI" ? [{ href: "/ayarlar", ad: "Ayarlar" }] : []),
  ];
  return (
    <div className="min-h-screen bg-zinc-50 md:flex">
      <aside className="border-b border-zinc-200 bg-white p-3 md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <div className="mb-3 flex items-center justify-between md:block">
          <p className="px-3 text-sm font-semibold">Kartepe ATV</p>
          <div className="px-3 text-xs text-zinc-500 md:mt-1">
            {k.adSoyad} · {ROL_AD[k.rol]}
          </div>
        </div>
        <Menu ogeler={ogeler} />
        <form action={cikisEylemi} className="mt-3 px-3">
          <button className="text-xs text-zinc-500 hover:text-zinc-900">Çıkış yap</button>
        </form>
      </aside>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
