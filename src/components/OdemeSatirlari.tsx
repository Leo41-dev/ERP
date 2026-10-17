"use client";
import { Buton, Girdi, Secim } from "@/components/ui";
import { ODEME_AD } from "@/lib/bicim";

export type Odeme = { anahtar: number; yontem: string; tutar: string; taksit: string; vade: string; aciklama: string };
export const yeniOdeme = (yontem = "KART", tutar = ""): Odeme => ({ anahtar: Date.now() + Math.random(), yontem, tutar, taksit: "", vade: "", aciklama: "" });

/**
 * Satış ve tahsilat formlarındaki ödeme satırları. Alanlar pasif yapılmaz (readOnly) çünkü pasif alan
 * gönderilmez ve satırlar birbirine kayar. Taksit yalnızca kartta, vade yalnızca senet/çekte doldurulur.
 */
export function OdemeSatirlari({ odemeler, guncelle, sil }: { odemeler: Odeme[]; guncelle: (anahtar: number, alan: keyof Odeme, deger: string) => void; sil: (anahtar: number) => void }) {
  return (
    <div className="space-y-2">
      {odemeler.map((o) => {
        const kart = o.yontem === "KART";
        const vadeli = o.yontem === "SENET" || o.yontem === "CEK";
        return (
          <div key={o.anahtar} className="grid grid-cols-2 gap-2 md:grid-cols-[9rem_9rem_5rem_9rem_1fr_auto]">
            <Secim name="odeme_yontem" value={o.yontem} onChange={(e) => guncelle(o.anahtar, "yontem", e.target.value)} aria-label="Ödeme yöntemi">
              {Object.entries(ODEME_AD).map(([kod, ad]) => <option key={kod} value={kod}>{ad}</option>)}
            </Secim>
            <Girdi name="odeme_tutar" inputMode="decimal" placeholder="Tutar" value={o.tutar} onChange={(e) => guncelle(o.anahtar, "tutar", e.target.value)} aria-label="Tutar" />
            <Girdi name="odeme_taksit" inputMode="numeric" placeholder="Taksit" readOnly={!kart} value={kart ? o.taksit : ""} onChange={(e) => guncelle(o.anahtar, "taksit", e.target.value)} className={kart ? "" : "bg-zinc-50"} aria-label="Taksit" />
            <Girdi name="odeme_vade" type="date" readOnly={!vadeli} value={vadeli ? o.vade : ""} onChange={(e) => guncelle(o.anahtar, "vade", e.target.value)} className={vadeli ? "" : "bg-zinc-50 text-zinc-400"} aria-label="Vade" title="Senet / çek vadesi" />
            <Girdi name="odeme_aciklama" placeholder={vadeli ? "Senet / çek no, banka" : "Banka / POS, açıklama"} value={o.aciklama} onChange={(e) => guncelle(o.anahtar, "aciklama", e.target.value)} aria-label="Açıklama" />
            <Buton type="button" tur="ikincil" onClick={() => sil(o.anahtar)} disabled={odemeler.length === 1}>Sil</Buton>
          </div>
        );
      })}
    </div>
  );
}
