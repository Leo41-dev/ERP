"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Ayar bölümleri: her modül kendi sekmesinde. Yeni modül (teknik servis vb.) buraya bir satır ve kendi sayfasıyla eklenir. */
export const AYAR_BOLUMLERI = [
  { href: "/ayarlar", ad: "Genel", yollar: ["/ayarlar"] },
  { href: "/ayarlar/satis", ad: "Satış", yollar: ["/ayarlar/satis", "/ayarlar/hedefler"] },
  { href: "/ayarlar/stok", ad: "Stok", yollar: ["/ayarlar/stok"] },
  { href: "/ayarlar/araclar", ad: "Araçlar", yollar: ["/ayarlar/araclar"] },
  { href: "/ayarlar/finans", ad: "Finans", yollar: ["/ayarlar/finans"] },
  { href: "/ayarlar/kullanicilar", ad: "Kullanıcılar", yollar: ["/ayarlar/kullanicilar"] },
];

export function AyarSekmeleri() {
  const yol = usePathname();
  const aktif = AYAR_BOLUMLERI.find((b) => b.yollar.some((y) => (y === "/ayarlar" ? yol === y : yol.startsWith(y))))?.href;
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200">
      {AYAR_BOLUMLERI.map((b) => (
        <Link
          key={b.href}
          href={b.href}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${b.href === aktif ? "border-zinc-900 font-medium text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
        >
          {b.ad}
        </Link>
      ))}
    </nav>
  );
}
