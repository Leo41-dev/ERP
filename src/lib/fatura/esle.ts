import type { FaturaArac } from "./oku";

/**
 * Fatura satırını tanımlı marka/model/alt modele eşler (eski paneldeki eşleme motoru).
 *   kayitli : daha önce onaylanmış eşleme
 *   yuksek  : marka + alt model adı faturada aynen geçiyor (BRP hariç)
 *   kontrol : öneri var ama onay gerekir
 *   yok     : öneri yok, listeden seçilir
 */

export type ModelSatiri = { id: number; marka: string; model: string; alt: string; tip: string };
export type Guven = "kayitli" | "yuksek" | "kontrol" | "yok";
export type EslemeSonucu = { modelId: number | null; guven: Guven; neden: string; adaylar: number[]; anahtar: string };

const TR: Record<string, string> = { Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" };
/** büyük harf, Türkçe harfler sadeleşir, harf/rakam dışı atılır */
export function norm(s: unknown): string {
  return String(s ?? "")
    .toLocaleUpperCase("tr-TR")
    .replace(/[ÇĞİÖŞÜ]/g, (c) => TR[c])
    .replace(/[^A-Z0-9]/g, "");
}

/** Fatura satırının kalıcı eşleme anahtarı: tedarikçi VKN + satır tipi/ürün adı */
export function eslemeAnahtari(saticiVkn: string, a: Pick<FaturaArac, "tipHam" | "urunAdi">): string {
  const kaynak = a.tipHam || a.urunAdi.split(" - ")[0];
  return `${saticiVkn}|${norm(kaynak)}`;
}

function tekil(liste: ModelSatiri[]): ModelSatiri[] {
  const gor = new Set<string>();
  return liste.filter((x) => {
    const k = x.model + "||" + x.alt;
    if (gor.has(k)) return false;
    gor.add(k);
    return true;
  });
}

function jetonlar(s: string): string[] {
  return String(s || "")
    .toLocaleUpperCase("tr-TR")
    .replace(/[ÇĞİÖŞÜ]/g, (c) => TR[c])
    .replace(/-/g, "")
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

/**
 * BRP faturalarında ad listeyle birebir uyuşmaz ("BRP CAN-AM_ATV OUTL MAX XTP 1000R GY ABS SAS TR 26_T3"),
 * kelime kelime eşlenir; en özgül alt model kazanır.
 */
function brpEsle(a: FaturaArac, satirlar: ModelSatiri[]) {
  const inv = jetonlar(`${a.urunAdi} ${a.aciklama} ${a.tipHam}`);
  if (inv.some((x) => /^T\d[A-Z]?$/.test(x)) && !inv.includes("T")) inv.push("T");
  const sozluk = new Set(satirlar.flatMap((r) => jetonlar(r.alt)));
  const adaylar = satirlar
    .map((r) => {
      const mt = jetonlar(r.model);
      const modelUygun = mt.length > 0 && mt.every((t) => inv.some((x) => x === t || (x.length >= 4 && t.startsWith(x))));
      const at = jetonlar(r.alt);
      if (!modelUygun || !at.length) return null;
      const eksik = at.filter((t) => !inv.includes(t));
      const eslesen = at.filter((t) => inv.includes(t));
      const aciklanmayan = inv.filter((x) => sozluk.has(x) && !at.includes(x) && !mt.includes(x));
      return { r, puan: eslesen.length * 10 - eksik.length * 15 - aciklanmayan.length * 8, eksik, eslesen, aciklanmayan };
    })
    .filter((x) => x !== null && x.eksik.length === 0)
    .sort((x, y) => y!.puan - x!.puan) as { r: ModelSatiri; puan: number; eslesen: string[]; aciklanmayan: string[] }[];
  if (!adaylar.length) return null;
  const ust = adaylar.filter((x) => x.puan === adaylar[0].puan);
  const tek = tekil(ust.map((x) => x.r));
  const digerleri = tekil(adaylar.filter((x) => x.puan !== adaylar[0].puan).slice(0, 4).map((x) => x.r));
  return { en: ust[0], tekAday: tek.length === 1, adaylar: [...tek, ...digerleri] };
}

export function esle(a: FaturaArac, anahtar: string, modeller: ModelSatiri[], kayitliEslemeler: Map<string, number>): EslemeSonucu {
  const sonuc: EslemeSonucu = { modelId: null, guven: "yok", neden: "", adaylar: [], anahtar };

  // 1) daha önce onaylanmış eşleme
  const kayitli = kayitliEslemeler.get(anahtar);
  if (kayitli && modeller.some((m) => m.id === kayitli)) return { ...sonuc, modelId: kayitli, guven: "kayitli", neden: "Daha önce onaylanan eşleme" };

  // 2) marka
  const markalar = [...new Set(modeller.map((m) => m.marka))].sort((x, y) => norm(y).length - norm(x).length);
  const ad = norm(a.urunAdi);
  const ham = norm(a.markaHam);
  const ilkKelime = norm(a.urunAdi.split(/[\s_]+/)[0]);
  let marka =
    markalar.find((m) => {
      const n = norm(m);
      return n.length >= 3 && ((ham && ham === n) || ilkKelime === n || ad.startsWith(n));
    }) ?? markalar.find((m) => norm(m).length >= 4 && (ad + norm(a.aciklama)).includes(norm(m)));
  if (!marka) return { ...sonuc, neden: "Marka tanımlı değil; Ayarlar'dan ekleyin veya listeden seçin" };
  marka = marka as string;
  const satirlar = modeller.filter((m) => norm(m.marka) === norm(marka));

  // 3a) BRP
  if (norm(marka) === "BRP") {
    const b = brpEsle(a, satirlar);
    if (b) {
      const ac = b.en.aciklanmayan.length ? ` Faturada listede karşılığı olmayan: ${b.en.aciklanmayan.join(", ")}.` : "";
      return {
        ...sonuc,
        modelId: b.en.r.id,
        guven: "kontrol",
        adaylar: b.adaylar.map((x) => x.id),
        neden: b.tekAday ? `BRP: ${b.en.eslesen.join(" · ")} ile eşleşti.${ac} Onaylayın.` : `${b.adaylar.length} olasılık, doğru olanı seçin.`,
      };
    }
  }

  // 3b) alt model adı faturada geçiyor mu
  const metin = norm(`${a.urunAdi} ${a.aciklama} ${a.tipHam}`);
  let enIyi = 0;
  let adaylar: ModelSatiri[] = [];
  for (const r of satirlar) {
    const n = norm(r.alt);
    if (n.length >= 3 && metin.includes(n)) {
      if (n.length > enIyi) [enIyi, adaylar] = [n.length, [r]];
      else if (n.length === enIyi) adaylar.push(r);
    }
  }
  adaylar = tekil(adaylar);
  // eşitlikte araç tipi (ATV/UTV) faturada ayrı kelime olarak geçiyorsa o tercih edilir
  if (adaylar.length > 1) {
    const kelimeler = `${a.urunAdi} ${a.aciklama}`.toLocaleUpperCase("tr-TR").split(/[^A-Z0-9ÇĞİÖŞÜ]+/);
    const tipli = adaylar.filter((r) => r.tip && kelimeler.includes(r.tip.toLocaleUpperCase("tr-TR")));
    if (tipli.length >= 1 && tipli.length < adaylar.length) adaylar = tipli;
  }
  if (adaylar.length === 1) {
    const brp = norm(marka) === "BRP";
    return { ...sonuc, modelId: adaylar[0].id, adaylar: [adaylar[0].id], guven: brp ? "kontrol" : "yuksek", neden: brp ? "BRP faturasındaki ad listeyle birebir uyuşmuyor, onaylayın" : "Alt model adı faturada aynen geçiyor" };
  }
  if (adaylar.length > 1) return { ...sonuc, modelId: adaylar[0].id, adaylar: adaylar.map((x) => x.id), guven: "kontrol", neden: `${adaylar.length} olası eşleşme, birini seçin` };

  // 4) yalnızca model adı geçiyorsa
  const mAday = [...new Set(satirlar.map((r) => r.model))].filter((x) => norm(x).length >= 3 && metin.includes(norm(x))).sort((x, y) => norm(y).length - norm(x).length);
  if (mAday.length) {
    const alts = tekil(satirlar.filter((r) => r.model === mAday[0]));
    if (alts.length === 1) return { ...sonuc, modelId: alts[0].id, adaylar: [alts[0].id], guven: "kontrol", neden: "Yalnızca model adı eşleşti" };
    return { ...sonuc, adaylar: alts.map((x) => x.id), neden: `Model bulundu (${mAday[0]}), alt modeli seçin` };
  }
  return { ...sonuc, neden: "Model eşleşmedi, listeden seçin" };
}
