import { XMLParser } from "fast-xml-parser";

/**
 * Tedarikçi e-Fatura (UBL-TR) XML'inden araçları okur. Her araç ayrı satırdır (adet 16 ise 16 araç).
 * Eski satış panelindeki okuyucunun aynısı; şase numarası sırasıyla satır notundan, ItemInstance/SerialID'den
 * ya da fatura başlık notlarından alınır.
 */

export type FaturaArac = {
  satirNo: string;
  sase: string;
  motor: string;
  yil: string;
  renk: string;
  markaHam: string;
  urunAdi: string;
  aciklama: string;
  tipHam: string;
  birimFiyat: number | null;
  kdvOrani: number | null; // kesir, 0.2
  otvOrani: number | null;
  kaynak: string;
  uyarilar: string[];
};

export type FaturaSonuc =
  | { ok: false; dosya: string; hata: string }
  | {
      ok: true;
      dosya: string;
      faturaNo: string;
      faturaTarihi: string;
      saticiUnvan: string;
      saticiVkn: string;
      paraBirimi: string;
      iskontoOrani: number; // kesir, fatura geneli
      araclar: FaturaArac[];
      uyarilar: string[];
    };

type Dugum = Record<string, unknown>;

const LISTELER = new Set(["InvoiceLine", "Note", "AdditionalItemProperty", "SerialID", "TaxSubtotal", "ItemInstance", "PartyIdentification", "TaxTotal"]);
const ayristirici = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  trimValues: true,
  isArray: (ad) => LISTELER.has(ad),
});

const liste = (x: unknown): unknown[] => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
function yazi(x: unknown): string {
  if (x === undefined || x === null) return "";
  if (typeof x === "object") return yazi((x as Dugum)["#text"]);
  return String(x).trim();
}
/** "Party/PartyName/Name" gibi bir yolun ilk değeri */
function yol(d: unknown, p: string): unknown {
  let cur: unknown = d;
  for (const parca of p.split("/")) {
    const ilk = liste(cur)[0];
    if (!ilk || typeof ilk !== "object") return undefined;
    cur = (ilk as Dugum)[parca];
  }
  return Array.isArray(cur) ? cur[0] : cur;
}
const yy = (d: unknown, p: string) => yazi(yol(d, p));
function sayi(s: string): number | null {
  if (!s) return null;
  const v = parseFloat(s.replace(",", "."));
  return Number.isNaN(v) ? null : v;
}
const yuvarla = (v: number) => Math.round(v * 100) / 100;

const RE = {
  sase: /(?:SER[İIiı]|[ŞşSs]AS[İIiıEe])\s*NO\s*[:.]\s*([A-Z0-9]{8,20})/i,
  motor: /MOTOR\s*NO\s*[:.]\s*([A-Z0-9]+)/i,
  yil: /MODEL(?:\s*YILI)?\s*[:.]\s*(\d{4})/i,
  renk: /RENK\s*[:.]\s*([^\n\r]+)/i,
  tip: /T[İIiı]P\s*:\s*([^\n\r]+)/i,
  marka: /MARKA\s*:\s*([^\n\r]+)/i,
};

type BaslikKaydi = { sase: string; motor: string; yil: string; renk: string; tip: string; marka: string };
function alanlariOku(t: string): BaslikKaydi {
  const g = (re: RegExp) => re.exec(t)?.[1].trim() ?? "";
  return { sase: g(RE.sase).toUpperCase(), motor: g(RE.motor).toUpperCase(), yil: g(RE.yil), renk: g(RE.renk), tip: g(RE.tip), marka: g(RE.marka) };
}
/** "1.Marka: ... 2.Marka: ..." gibi numaralı bloklar varsa ayırır, yoksa tek kayıt */
function baslikKayitlari(notlar: string[]): BaslikKaydi[] {
  const metin = notlar.join("\n");
  const bloklar = metin.split(/(?=\b\d+\s*\.\s*Marka\s*:)/i).filter((b) => /Marka\s*:/i.test(b));
  const kayitlar = (bloklar.length ? bloklar : [metin]).map(alanlariOku);
  return kayitlar.filter((k) => k.sase);
}
/** Satır notu: "ACK:RENK:SIYAH-GRI - M.N: 172MM2CRE055022 - S.N: LCEPDNLM4T7003264 - M.Y: 2026" */
function satirNotuOku(t: string) {
  const s = /S\.?\s*N\s*[:：]\s*([A-Z0-9]{8,20})/i.exec(t);
  if (!s) return null;
  const m = /M\.?\s*N\s*[:：]\s*([A-Z0-9]+)/i.exec(t);
  const y = /M\.?\s*Y\s*[:：]\s*(\d{4})/i.exec(t);
  const r = /RENK\s*[:：]\s*(.*?)\s+-\s+M\.?\s*N/i.exec(t);
  return { sase: s[1].toUpperCase(), motor: m ? m[1].toUpperCase() : "", yil: y ? y[1] : "", renk: r ? r[1].trim() : "" };
}

function ozellikler(item: unknown): Record<string, string> {
  const h: Record<string, string> = {};
  const it = liste(item)[0] as Dugum | undefined;
  if (!it) return h;
  const props = [...liste(it.AdditionalItemProperty), ...liste(it.ItemInstance).flatMap((x) => liste((x as Dugum).AdditionalItemProperty))];
  for (const p of props) {
    const v = yy(p, "Value");
    if (/^[-.…\s]*$/.test(v)) continue; // "-", "…" gibi boş yer tutucular
    h[yy(p, "Name").toLocaleUpperCase("tr-TR")] = v;
  }
  return h;
}

/** Satırdaki vergi oranları: 0015 KDV, 0071 ÖTV (1. liste) */
function vergiOranlari(satir: unknown) {
  let kdv: number | null = null;
  let otv: number | null = null;
  for (const tt of liste((satir as Dugum).TaxTotal)) {
    for (const st of liste((tt as Dugum).TaxSubtotal)) {
      const kod = yy(st, "TaxCategory/TaxScheme/TaxTypeCode");
      const yuzde = sayi(yy(st, "Percent"));
      if (yuzde === null) continue;
      if (kod === "0071") otv = yuzde / 100;
      else if (kod === "0015" || (!kod && kdv === null)) kdv = yuzde / 100;
    }
  }
  return { kdv, otv };
}

function saticiVknBul(kok: Dugum): string {
  const parti = yol(kok, "AccountingSupplierParty/Party") as Dugum | undefined;
  for (const pi of liste(parti?.PartyIdentification)) {
    const id = (pi as Dugum).ID as Dugum | string | undefined;
    const sema = typeof id === "object" && id ? String(id["@schemeID"] ?? "") : "";
    if (sema === "VKN" || sema === "TCKN") return yazi(id).replace(/\D/g, "");
  }
  return "";
}

export function faturaOku(xml: string, dosya = ""): FaturaSonuc {
  let doc: Dugum;
  try {
    doc = ayristirici.parse(xml) as Dugum;
  } catch (e) {
    return { ok: false, dosya, hata: `XML okunamadı: ${(e as Error).message}` };
  }
  const kok = doc.Invoice as Dugum | undefined;
  if (!kok || typeof kok !== "object") return { ok: false, dosya, hata: "Bu bir e-Fatura (Invoice) dosyası değil." };

  const uyarilar: string[] = [];
  const faturaNo = yy(kok, "ID");
  const faturaTarihi = yy(kok, "IssueDate");
  const saticiUnvan = yy(kok, "AccountingSupplierParty/Party/PartyName/Name") || yy(kok, "AccountingSupplierParty/Party/PartyLegalEntity/RegistrationName");
  const saticiVkn = saticiVknBul(kok);
  const paraBirimi = yy(kok, "DocumentCurrencyCode") || "TRY";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(faturaTarihi)) uyarilar.push(`Fatura tarihi okunamadı: "${faturaTarihi}"`);
  if (paraBirimi !== "TRY") uyarilar.push(`Para birimi TRY değil: ${paraBirimi}`);
  if (!saticiVkn) uyarilar.push("Satıcının VKN'si okunamadı.");

  const satirToplamFatura = sayi(yy(kok, "LegalMonetaryTotal/LineExtensionAmount")) ?? 0;
  const iskontoToplam = sayi(yy(kok, "LegalMonetaryTotal/AllowanceTotalAmount")) ?? 0;
  const iskontoOrani = satirToplamFatura ? iskontoToplam / satirToplamFatura : 0;

  const kayitlar = baslikKayitlari(liste(kok.Note).map(yazi));
  const kullanilan = new Set<string>();
  const araclar: FaturaArac[] = [];
  let satirToplami = 0;

  liste(kok.InvoiceLine).forEach((sat, si) => {
    const satirNo = yy(sat, "ID") || String(si + 1);
    const adet = sayi(yy(sat, "InvoicedQuantity")) ?? 0;
    const item = (sat as Dugum).Item;
    const urunAdi = yy(item, "Name");
    const aciklama = yy(item, "Description");
    const markaAdi = yy(item, "BrandName").replace(/^\s*\d+\s*-\s*/, "");
    const oz = ozellikler(item);
    const satirTutar = sayi(yy(sat, "LineExtensionAmount")) ?? 0;
    let birimFiyat = sayi(yy(sat, "Price/PriceAmount"));
    if (birimFiyat === null && adet) birimFiyat = yuvarla(satirTutar / adet);
    const { kdv, otv } = vergiOranlari(sat);
    satirToplami += satirTutar;

    if (adet && birimFiyat !== null && Math.abs(birimFiyat * adet - satirTutar) > 0.05 * Math.max(1, adet)) {
      uyarilar.push(`Satır ${satirNo}: birim fiyat × adet (${yuvarla(birimFiyat * adet)}) satır tutarıyla (${satirTutar}) uyuşmuyor.`);
    }

    // bu satırdaki araçlar
    let bulunan: { sase: string; motor: string; yil: string; renk: string; kaynak: string }[] = liste((sat as Dugum).Note)
      .map((n) => satirNotuOku(yazi(n)))
      .filter((x) => x !== null)
      .map((x) => ({ ...x, kaynak: "satır notu" }));
    if (!bulunan.length) {
      const it = liste(item)[0] as Dugum | undefined;
      bulunan = liste(it?.ItemInstance)
        .flatMap((x) => liste((x as Dugum).SerialID))
        .map((s) => yazi(s).toUpperCase())
        .filter(Boolean)
        .map((sase) => ({ sase, motor: "", yil: "", renk: "", kaynak: "seri no alanı" }));
    }
    if (!bulunan.length) {
      const gerekli = Math.round(adet) || 1;
      for (const k of kayitlar) {
        if (bulunan.length >= gerekli) break;
        if (kullanilan.has(k.sase)) continue;
        kullanilan.add(k.sase);
        bulunan.push({ sase: k.sase, motor: "", yil: "", renk: "", kaynak: "fatura notu" });
      }
    }
    if (Math.round(adet) !== bulunan.length) uyarilar.push(`Satır ${satirNo} (${urunAdi}): ${adet} adet var ama ${bulunan.length} şase numarası bulundu.`);

    for (const a of bulunan) {
      const k = kayitlar.find((x) => x.sase === a.sase);
      const u: string[] = [];
      let yil = a.yil || k?.yil || "";
      const yilOzellik = oz["MODEL YILI"] || "";
      if (yilOzellik && yil && yilOzellik !== yil) u.push(`Model yılı çelişkisi: notta ${yil}, satır özelliğinde ${yilOzellik} (not esas alındı)`);
      if (!yil && yilOzellik) yil = yilOzellik;
      if (!yil) u.push("Model yılı bulunamadı");
      const renk = a.renk || k?.renk || oz["RENK"] || "";
      if (!renk) u.push("Renk bulunamadı");
      if (a.sase.length !== 17) u.push(`Şase 17 karakter değil (${a.sase.length})`);
      if (kdv === null) u.push("KDV oranı bulunamadı");
      araclar.push({
        satirNo,
        sase: a.sase,
        motor: a.motor || k?.motor || "",
        yil,
        renk,
        markaHam: markaAdi || k?.marka || (oz["MARKA"] && oz["MARKA"] !== "-" ? oz["MARKA"] : ""),
        urunAdi,
        aciklama,
        tipHam: k?.tip || oz["TİP"] || oz["TIP"] || "",
        birimFiyat,
        kdvOrani: kdv,
        otvOrani: otv,
        kaynak: a.kaynak,
        uyarilar: u,
      });
    }
  });

  const gor = new Set<string>();
  for (const a of araclar) {
    if (gor.has(a.sase)) a.uyarilar.push("Aynı faturada şase tekrar ediyor");
    gor.add(a.sase);
  }
  if (satirToplamFatura && Math.abs(satirToplamFatura - satirToplami) > 0.05) {
    uyarilar.push(`Satır toplamı (${yuvarla(satirToplami)}) fatura toplamıyla (${satirToplamFatura}) uyuşmuyor.`);
  }
  return { ok: true, dosya, faturaNo, faturaTarihi, saticiUnvan, saticiVkn, paraBirimi, iskontoOrani, araclar, uyarilar };
}
