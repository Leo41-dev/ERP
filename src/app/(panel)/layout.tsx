import { Suspense, type ReactNode } from "react";
import { uygulamaAdi } from "@/lib/belgeAyarlari";
import { ROL_AD } from "@/lib/bicim";
import { menuOgeleri } from "@/lib/moduller";
import { yetkiIste } from "@/lib/oturum";
import { cikisEylemi } from "./eylem";
import { Menu } from "./Menu";
import { SilindiBildirimi } from "./SilindiBildirimi";

export default async function PanelDuzeni({ children }: { children: ReactNode }) {
  const k = await yetkiIste();
  const ogeler = menuOgeleri(k.rol);
  return (
    <div className="min-h-screen bg-zinc-50 md:flex">
      <aside className="border-b border-zinc-200 bg-white p-3 md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <div className="mb-3 flex items-center justify-between md:block">
          <p className="px-3 text-sm font-semibold">{await uygulamaAdi()}</p>
          <div className="px-3 text-xs text-zinc-500 md:mt-1">
            {k.adSoyad} · {ROL_AD[k.rol]}
          </div>
        </div>
        <Menu ogeler={ogeler} />
        <form action={cikisEylemi} className="mt-3 px-3">
          <button className="text-xs text-zinc-500 hover:text-zinc-900">Çıkış yap</button>
        </form>
      </aside>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
        <Suspense>
          <SilindiBildirimi />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
