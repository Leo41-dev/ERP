import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Buton({ tur = "ana", className, ...p }: ComponentProps<"button"> & { tur?: "ana" | "ikincil" | "tehlike" }) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium disabled:opacity-50",
        tur === "ana" && "bg-zinc-900 text-white hover:bg-zinc-700",
        tur === "ikincil" && "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
        tur === "tehlike" && "bg-red-600 text-white hover:bg-red-500",
        className,
      )}
    />
  );
}

export function BaglantiButon({ className, ...p }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...p}
      className={cx("inline-flex items-center rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700", className)}
    />
  );
}

const girdiSinif = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none";

export function Girdi(p: ComponentProps<"input">) {
  return <input {...p} className={cx(girdiSinif, p.className)} />;
}

export function Secim(p: ComponentProps<"select">) {
  return <select {...p} className={cx(girdiSinif, p.className)} />;
}

export function MetinAlani(p: ComponentProps<"textarea">) {
  return <textarea rows={3} {...p} className={cx(girdiSinif, p.className)} />;
}

export function Alan({ etiket, children, hata, className }: { etiket: string; children: ReactNode; hata?: string; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-zinc-600">{etiket}</span>
      {children}
      {hata && <span className="mt-1 block text-xs text-red-600">{hata}</span>}
    </label>
  );
}

export function Kart({ baslik, children, sag, className }: { baslik?: string; children: ReactNode; sag?: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg border border-zinc-200 bg-white", className)}>
      {(baslik || sag) && (
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold">{baslik}</h2>
          {sag}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SayfaBaslik({ baslik, aciklama, sag }: { baslik: string; aciklama?: ReactNode; sag?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{baslik}</h1>
        {aciklama && <p className="mt-1 text-sm text-zinc-500">{aciklama}</p>}
      </div>
      {sag}
    </div>
  );
}

export function Tablo({ basliklar, children, bos }: { basliklar: string[]; children: ReactNode; bos?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
          <tr>{basliklar.map((b) => <th key={b} className="whitespace-nowrap px-3 py-2 font-medium">{b}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">{children}</tbody>
      </table>
      {bos && <p className="p-6 text-center text-sm text-zinc-500">Kayıt yok.</p>}
    </div>
  );
}

export function Hucre({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cx("whitespace-nowrap px-3 py-2", className)}>{children}</td>;
}

const ETIKET_RENK: Record<string, string> = {
  yesil: "bg-green-50 text-green-700 ring-green-200",
  sari: "bg-amber-50 text-amber-700 ring-amber-200",
  kirmizi: "bg-red-50 text-red-700 ring-red-200",
  gri: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  mavi: "bg-blue-50 text-blue-700 ring-blue-200",
};
export function Etiket({ renk = "gri", children }: { renk?: keyof typeof ETIKET_RENK; children: ReactNode }) {
  return <span className={cx("inline-flex rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", ETIKET_RENK[renk])}>{children}</span>;
}

export function HataKutusu({ mesaj }: { mesaj?: string | null }) {
  if (!mesaj) return null;
  return <p className="whitespace-pre-line rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{mesaj}</p>;
}
