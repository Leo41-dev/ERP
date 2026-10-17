"use client";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Alan, Buton, Etiket, Girdi, HataKutusu, Kart, Secim } from "@/components/ui";
import type { ModelSatiri } from "@/lib/fatura/esle";
import { faturaOnizle, hizliModelEkle, stogaAl, type Onizleme, type StogaAlSonucu } from "./eylem";

const GUVEN = {
  kayitli: { ad: "Kayıtlı", renk: "yesil" },
  yuksek: { ad: "Eşleşti", renk: "yesil" },
  kontrol: { ad: "Kontrol edin", renk: "sari" },
  yok: { ad: "Seçin", renk: "kirmizi" },
} as const;

const tl = (v: number) => v.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const modelAdi = (m: ModelSatiri) => [m.model, m.alt].filter(Boolean).join(" · ");

export function FaturaYukle(p: { modeller: ModelSatiri[]; konumlar: { id: number; ad: string }[]; tipler: { id: number; ad: string }[]; maliyetGorur: boolean }) {
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [dosyalar, setDosyalar] = useState<File[]>([]);
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);
  const [modeller, setModeller] = useState(p.modeller);
  const [secim, setSecim] = useState<Record<string, number | null>>({});
  const [alinacak, setAlinacak] = useState<Record<string, boolean>>({});
  const [konumId, setKonumId] = useState(p.konumlar[0]?.id ? String(p.konumlar[0].id) : "");
  const [sonuc, setSonuc] = useState<StogaAlSonucu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yeniModel, setYeniModel] = useState(false);
  const [bekliyor, basla] = useTransition();

  const markalar = useMemo(() => {
    const g = new Map<string, ModelSatiri[]>();
    for (const m of modeller) g.set(m.marka, [...(g.get(m.marka) ?? []), m]);
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [modeller]);

  const formVerisi = () => {
    const f = new FormData();
    for (const d of dosyalar) f.append("dosya", d);
    return f;
  };

  const oku = (secilen: File[]) => {
    setDosyalar(secilen);
    setSonuc(null);
    setHata(null);
    if (!secilen.length) return setOnizleme(null);
    const f = new FormData();
    for (const d of secilen) f.append("dosya", d);
    basla(async () => {
      const o = await faturaOnizle(f);
      setOnizleme(o);
      setHata(o.hata ?? null);
      setSecim(Object.fromEntries(o.satirlar.map((x) => [x.sase, x.esleme.modelId])));
      setAlinacak(Object.fromEntries(o.satirlar.map((x) => [x.sase, !x.stoktaVar])));
    });
  };

  const secilenler = onizleme?.satirlar.filter((x) => alinacak[x.sase] && !x.stoktaVar) ?? [];
  const modelsiz = secilenler.filter((x) => !secim[x.sase]);

  const kaydet = () => {
    if (modelsiz.length) return setHata(`${modelsiz.length} araç için model seçilmedi.`);
    const f = formVerisi();
    f.set("secim", JSON.stringify(Object.fromEntries(secilenler.map((x) => [x.sase, secim[x.sase]]))));
    f.set("konumId", konumId);
    basla(async () => {
      const s = await stogaAl(f);
      if (s.hata) return setHata(s.hata);
      setSonuc(s);
      setOnizleme(null);
      setDosyalar([]);
      if (dosyaRef.current) dosyaRef.current.value = "";
    });
  };

  const modelEkle = (f: FormData) =>
    basla(async () => {
      const s = await hizliModelEkle(f);
      if (s.hata || !s.model) return setHata(s.hata ?? "Model eklenemedi.");
      const m = s.model;
      setModeller((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
      setYeniModel(false);
      setHata(null);
    });

  return (
    <div className="space-y-4">
      <Kart>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={dosyaRef} type="file" accept=".xml,text/xml,application/xml" multiple className="text-sm" onChange={(e) => oku([...(e.target.files ?? [])])} />
          {bekliyor && <span className="text-sm text-zinc-500">İşleniyor...</span>}
        </div>
      </Kart>

      <HataKutusu mesaj={hata} />

      {sonuc && (
        <Kart baslik="Stoğa alındı">
          <p className="text-sm">{sonuc.eklenen?.length ?? 0} araç stoğa eklendi.{sonuc.atlanan?.length ? ` ${sonuc.atlanan.length} şase zaten stokta olduğu için atlandı: ${sonuc.atlanan.join(", ")}` : ""}</p>
          {!!sonuc.eklenen?.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/yazdir/etiket?id=${sonuc.eklenen.map((x) => x.id).join(",")}`} target="_blank" className="rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700">QR etiketlerini yazdır</Link>
              <Link href="/araclar" className="rounded-md border border-zinc-300 px-3.5 py-2 text-sm">Araç listesine git</Link>
            </div>
          )}
        </Kart>
      )}

      {onizleme?.okunamayan.map((o) => <HataKutusu key={o.dosya} mesaj={`${o.dosya}: ${o.hata}`} />)}

      {onizleme?.faturalar.map((f) => (
        <Kart key={f.dosya} baslik={`${f.saticiUnvan || "Satıcı okunamadı"} · ${f.faturaNo}`} sag={<span className="text-xs text-zinc-500">{f.faturaTarihi} · {f.dosya}</span>}>
          <div className="flex flex-wrap gap-2 text-xs">
            <Etiket>VKN {f.saticiVkn || "-"}</Etiket>
            <Etiket>{onizleme.satirlar.filter((x) => x.dosya === f.dosya).length} araç</Etiket>
            {f.iskontoOrani > 0 && <Etiket renk="mavi">Fatura iskontosu %{(f.iskontoOrani * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</Etiket>}
          </div>
          {f.uyarilar.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">{f.uyarilar.map((u) => <li key={u}>{u}</li>)}</ul>}
        </Kart>
      ))}

      {onizleme && onizleme.satirlar.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  {["", "Şase", "Faturadaki ad", "Model", "Eşleşme", "Yıl", "Renk", "Motor", ...(p.maliyetGorur ? ["Alış"] : []), "Uyarılar"].map((b, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{b}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {onizleme.satirlar.map((x) => {
                  const g = GUVEN[x.esleme.guven];
                  const adaylar = new Set(x.esleme.adaylar);
                  return (
                    <tr key={x.dosya + x.sase} className={x.stoktaVar ? "bg-zinc-50 text-zinc-400" : ""}>
                      <td className="px-3 py-2">
                        <input type="checkbox" disabled={x.stoktaVar} checked={!!alinacak[x.sase] && !x.stoktaVar} onChange={(e) => setAlinacak((s) => ({ ...s, [x.sase]: e.target.checked }))} aria-label={`${x.sase} stoğa alınsın`} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{x.sase}</td>
                      <td className="max-w-56 px-3 py-2 text-xs">{x.urunAdi}{x.tipHam ? <span className="block text-zinc-500">{x.tipHam}</span> : null}</td>
                      <td className="px-3 py-2">
                        {x.stoktaVar ? (
                          <Etiket>Stokta var</Etiket>
                        ) : (
                          <Secim value={secim[x.sase] ?? ""} onChange={(e) => setSecim((s) => ({ ...s, [x.sase]: Number(e.target.value) || null }))} className="min-w-56 py-1.5 text-xs">
                            <option value="">Model seçin</option>
                            {x.esleme.adaylar.length > 1 && (
                              <optgroup label="Öneriler">
                                {modeller.filter((m) => adaylar.has(m.id)).map((m) => <option key={"o" + m.id} value={m.id}>{m.marka} {modelAdi(m)}</option>)}
                              </optgroup>
                            )}
                            {markalar.map(([marka, liste]) => (
                              <optgroup key={marka} label={marka}>
                                {liste.map((m) => <option key={m.id} value={m.id}>{marka} {modelAdi(m)}{m.tip ? ` (${m.tip})` : ""}</option>)}
                              </optgroup>
                            ))}
                          </Secim>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{!x.stoktaVar && <><Etiket renk={g.renk}>{g.ad}</Etiket><span className="mt-0.5 block max-w-48 text-zinc-500">{x.esleme.neden}</span></>}</td>
                      <td className="px-3 py-2">{x.yil || "-"}</td>
                      <td className="px-3 py-2 text-xs">{x.renk || "-"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{x.motor || "-"}</td>
                      {p.maliyetGorur && <td className="whitespace-nowrap px-3 py-2 text-xs">{x.maliyet !== null ? tl(x.maliyet) : "-"}</td>}
                      <td className="px-3 py-2 text-xs text-amber-700">{x.uyarilar.join(" · ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Kart>
            <div className="flex flex-wrap items-end gap-3">
              <Alan etiket="Konum">
                <Secim value={konumId} onChange={(e) => setKonumId(e.target.value)} className="w-48">
                  <option value="">Konum yok</option>
                  {p.konumlar.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
                </Secim>
              </Alan>
              <Buton type="button" onClick={kaydet} disabled={bekliyor || !secilenler.length}>{secilenler.length} aracı stoğa al</Buton>
              <Buton type="button" tur="ikincil" onClick={() => setYeniModel((v) => !v)}>Listede olmayan model ekle</Buton>
              {modelsiz.length > 0 && <span className="text-sm text-red-600">{modelsiz.length} araç için model seçilmedi.</span>}
            </div>
            {yeniModel && (
              <form action={modelEkle} className="mt-4 grid gap-2 border-t border-zinc-100 pt-4 md:grid-cols-5">
                <Girdi name="marka" placeholder="Marka" list="fy-markalar" required />
                <datalist id="fy-markalar">{markalar.map(([m]) => <option key={m} value={m} />)}</datalist>
                <Girdi name="model" placeholder="Model" required />
                <Girdi name="altModel" placeholder="Alt model" />
                <Secim name="tipId" defaultValue="">
                  <option value="">Tip</option>
                  {p.tipler.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
                </Secim>
                <Buton disabled={bekliyor}>Modeli ekle</Buton>
              </form>
            )}
          </Kart>
        </>
      )}
    </div>
  );
}
