import Link from "next/link";
import type { Rol } from "@prisma/client";
import { modulleri } from "@/lib/moduller";

/** Ana ekran: kullanıcının erişebildiği bütün modüller ve sık kullanılan işlemleri */
export function ModulKartlari({ rol }: { rol: Rol }) {
  return (
    <section aria-label="Modüller" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {modulleri(rol).map((m) =>
        m.yakinda ? (
          <div key={m.ad} className="rounded-lg border border-dashed border-zinc-300 p-3 text-zinc-400">
            <p className="text-sm font-semibold">{m.ad}</p>
            <p className="mt-0.5 text-xs">{m.aciklama}</p>
            <p className="mt-2 text-xs">Yakında</p>
          </div>
        ) : (
          <div key={m.ad} className="flex flex-col rounded-lg border border-zinc-200 bg-white p-3 hover:border-zinc-400">
            <Link href={m.ana.href} className="text-sm font-semibold hover:underline">{m.ad}</Link>
            <p className="mt-0.5 text-xs text-zinc-500">{m.aciklama}</p>
            {m.islemler.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs">
                {m.islemler.map((i) => (
                  <li key={i.href}><Link href={i.href} className="text-blue-700 hover:underline">{i.ad}</Link></li>
                ))}
              </ul>
            )}
          </div>
        ),
      )}
    </section>
  );
}
