"use client";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { sifirlamadan } from "@/components/form";
import { Alan, Buton, Girdi, HataKutusu } from "@/components/ui";
import { UrunSecici, type UrunBulunan } from "@/components/UrunSecici";
import type { SayimDurum } from "./eylem";

type Eylem = (d: SayimDurum, f: FormData) => Promise<SayimDurum>;

export function SayimBaslatFormu({ eylem }: { eylem: Eylem }) {
  const [durum, gonder, bekliyor] = useActionState(eylem, undefined);
  return (
    <form onSubmit={sifirlamadan(gonder)} className="flex flex-wrap items-end gap-2">
      <Alan etiket="Sayım adı" className="min-w-64 flex-1"><Girdi name="aciklama" placeholder="Ekim 2026 genel sayım" /></Alan>
      <Buton type="submit" disabled={bekliyor}>Sayım başlat</Buton>
      <div className="w-full"><HataKutusu mesaj={durum?.genel} /></div>
    </form>
  );
}

/** Ürün seçilip sayılan miktar yazılır. "Okut ve 1 ekle" açıkken barkod okutmak tek başına 1 adet sayar. */
export function SayimGirisFormu({ eylem }: { eylem: Eylem }) {
  const [durum, gonder, bekliyor] = useActionState(eylem, undefined);
  const [urun, setUrun] = useState<UrunBulunan | null>(null);
  const [yazi, setYazi] = useState("");
  const [miktar, setMiktar] = useState("");
  const [okut, setOkut] = useState(true);
  const miktarKutu = useRef<HTMLInputElement>(null);

  // kayıt başarılıysa kutular temizlenir, imleç yeniden ürün aramasına döner
  useEffect(() => {
    if (durum?.anahtar) {
      setUrun(null);
      setYazi("");
      setMiktar("");
    }
  }, [durum?.anahtar]);

  const sec = (u: UrunBulunan) => {
    setUrun(u);
    setYazi(`${u.kod} · ${u.ad}`);
    if (okut) {
      const f = new FormData();
      f.set("urunId", String(u.id));
      f.set("miktar", "1");
      f.set("mod", "ekle");
      startTransition(() => gonder(f));
    } else setTimeout(() => miktarKutu.current?.focus(), 0);
  };

  return (
    <form onSubmit={sifirlamadan(gonder)} className="space-y-2">
      <input type="hidden" name="urunId" value={urun?.id ?? ""} />
      <input type="hidden" name="mod" value="yaz" />
      <div className="grid gap-2 md:grid-cols-[1fr_9rem_auto]">
        <UrunSecici key={durum?.anahtar ?? 0} deger={yazi} secili={!!urun} autoFocus placeholder="Ürün ara ya da barkod okut" onYazi={(s) => { setYazi(s); setUrun(null); }} onSec={sec} />
        <Girdi ref={miktarKutu} name="miktar" inputMode="decimal" placeholder={urun ? `Sayılan (${urun.birim})` : "Sayılan"} value={miktar} onChange={(e) => setMiktar(e.target.value)} disabled={okut} />
        <Buton type="submit" disabled={bekliyor || !urun || okut}>Yaz</Buton>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-600">
        <input type="checkbox" checked={okut} onChange={(e) => setOkut(e.target.checked)} /> Okut ve 1 ekle (her okutma sayıma 1 adet ekler)
      </label>
      <HataKutusu mesaj={durum?.genel} />
      {durum?.tamam && <p className="text-sm text-green-700">Sayıldı · {durum.tamam}</p>}
    </form>
  );
}
