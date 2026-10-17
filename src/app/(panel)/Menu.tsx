"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Menu({ ogeler }: { ogeler: { href: string; ad: string }[] }) {
  const yol = usePathname();
  // iç içe yollarda (/satislar ve /satislar/hizli) yalnızca en uzun eşleşen işaretlenir
  const eslesen = ogeler.filter((o) => (o.href === "/" ? yol === "/" : yol.startsWith(o.href))).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {ogeler.map((o) => {
        const aktif = o.href === eslesen;
        return (
          <Link
            key={o.href}
            href={o.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${aktif ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
          >
            {o.ad}
          </Link>
        );
      })}
    </nav>
  );
}
