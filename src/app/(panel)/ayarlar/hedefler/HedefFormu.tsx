"use client";
import { useActionState, useState } from "react";
import { sifirlamadan } from "@/components/form";
import { Buton, Girdi, HataKutusu } from "@/components/ui";
import { sayi } from "@/lib/normalize";
import type { HedefDurum } from "./eylem";

type Satir = {
  id: number; ad: string;
  gecmis: { adet: number; ciro: number }[];
  oneri: { adet: number; ciro: number };
  kayit: { adet: number; ciro: number; baz: string } | null;
  gerceklesen: { adet: number; ciro: number };
};
const tl = (n: number) => n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const yaz = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });

export function HedefFormu({ eylem, satirlar, aylar }: { eylem: (d: HedefDurum, f: FormData) => Promise<HedefDurum>; satirlar: Satir[]; aylar: string[] }) {
  const [d, gonder, bekliyor] = useActionState(eylem, undefined);
  const [deger, setDeger] = useState<Record<number, { adet: string; ciro: string }>>(() =>
    Object.fromEntries(satirlar.map((s) => [s.id, s.kayit ? { adet: String(s.kayit.adet), ciro: yaz(s.kayit.ciro) } : { adet: "", ciro: "" }])),
  );
  const guncelle = (id: number, alan: "adet" | "ciro", v: string) => setDeger((x) => ({ ...x, [id]: { ...x[id], [alan]: v } }));
  const oneriYaz = () => setDeger(Object.fromEntries(satirlar.map((s) => [s.id, { adet: String(s.oneri.adet), ciro: yaz(s.oneri.ciro) }])));
  const toplam = satirlar.reduce((t, s) => {
    const v = deger[s.id];
    const bos = !v.adet && !v.ciro;
    return { adet: t.adet + (bos ? s.oneri.adet : Number(v.adet) || 0), ciro: t.ciro + (bos ? s.oneri.ciro : sayi(v.ciro) ?? 0) };
  }, { adet: 0, ciro: 0 });

  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Satıcı</th>
              {aylar.map((a) => <th key={a} className="px-3 py-2 font-medium">{a}</th>)}
              <th className="px-3 py-2 font-medium">Öneri (ort. × 1,10)</th>
              <th className="px-3 py-2 font-medium">Hedef araç</th>
              <th className="px-3 py-2 font-medium">Hedef ciro (₺)</th>
              <th className="px-3 py-2 font-medium">Gerçekleşen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {satirlar.map((s) => {
              const v = deger[s.id];
              const hedefAdet = v.adet ? Number(v.adet) : s.oneri.adet;
              return (
                <tr key={s.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{s.ad}</td>
                  {s.gecmis.map((g, i) => <td key={i} className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-600">{g.adet} araç<span className="block text-xs">{tl(g.ciro)}</span></td>)}
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-600">{s.oneri.adet} araç<span className="block text-xs">{tl(s.oneri.ciro)}</span></td>
                  <td className="px-3 py-2"><Girdi name={`hedef_adet_${s.id}`} inputMode="numeric" className="w-20" placeholder={String(s.oneri.adet)} value={v.adet} onChange={(e) => guncelle(s.id, "adet", e.target.value)} aria-label={`${s.ad} araç hedefi`} /></td>
                  <td className="px-3 py-2"><Girdi name={`hedef_ciro_${s.id}`} inputMode="decimal" className="w-36" placeholder={yaz(s.oneri.ciro)} value={v.ciro} onChange={(e) => guncelle(s.id, "ciro", e.target.value)} aria-label={`${s.ad} ciro hedefi`} /></td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    <span className={s.gerceklesen.adet >= hedefAdet ? "text-green-700" : ""}>{s.gerceklesen.adet} / {hedefAdet} araç</span>
                    <span className="block text-xs text-zinc-500">{tl(s.gerceklesen.ciro)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!satirlar.length && <p className="p-6 text-center text-sm text-zinc-500">Aktif satış personeli yok. Kullanıcılar sayfasından satış rolünde kullanıcı ekleyin.</p>}
      </div>
      <p className="text-xs text-zinc-500">Boş bırakılan satırda panoda öneri kullanılır (gri yazılı değer). Toplam hedef: {toplam.adet} araç · {tl(toplam.ciro)}</p>
      <HataKutusu mesaj={d?.hata} />
      {d?.tamam && <p className="text-sm text-green-700">{d.tamam}</p>}
      <div className="flex gap-2">
        <Buton disabled={bekliyor || !satirlar.length}>{bekliyor ? "Kaydediliyor..." : "Hedefleri kaydet"}</Buton>
        <Buton type="button" tur="ikincil" onClick={oneriYaz} disabled={!satirlar.length}>Önerileri yaz</Buton>
        <Buton type="button" tur="ikincil" onClick={() => setDeger(Object.fromEntries(satirlar.map((s) => [s.id, { adet: "", ciro: "" }])))} disabled={!satirlar.length}>Temizle</Buton>
      </div>
    </form>
  );
}
