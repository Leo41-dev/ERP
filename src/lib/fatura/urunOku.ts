import { ayristirici, liste, saticiVknBul, sayi, vergiOranlari, yazi, yy, type Dugum } from "./oku";
import { norm } from "./esle";

/**
 * Tedarikçi e-Fatura (UBL-TR) XML'inden parça/aksesuar satırlarını okur. Araç faturası okuyucusundan farkı:
 * her satır bir kalemdir (adet kadar kayıt açılmaz), şase aranmaz.
 */

export type FaturaUrun = {
  satirNo: string;
  ad: string;
  saticiKodu: string; // tedarikçinin ürün kodu
  barkod: string;
  miktar: number;
  birim: string; // UBL birim kodu çevrilmiş hali
  birimFiyat: number; // KDV hariç, satır ve fatura iskontosu düşülmüş
  kdvOrani: number | null;
  tutar: number; // KDV hariç satır toplamı (iskontolar düşülmüş)
};

export type FaturaUrunSonuc =
  | { ok: false; hata: string }
  | { ok: true; faturaNo: string; faturaTarihi: string; saticiUnvan: string; saticiVkn: string; paraBirimi: string; satirlar: FaturaUrun[]; uyarilar: string[] };

// UN/ECE birim kodlarının sık görülenleri
const BIRIM: Record<string, string> = { C62: "Adet", NIU: "Adet", EA: "Adet", H87: "Adet", PR: "Çift", SET: "Takım", LTR: "Litre", KGM: "Kg", MTR: "Metre", PA: "Paket", HUR: "Saat" };
const yuvarla = (v: number, h = 2) => Math.round(v * 10 ** h) / 10 ** h;

export function faturaUrunOku(xml: string): FaturaUrunSonuc {
  let doc: Dugum;
  try {
    doc = ayristirici.parse(xml) as Dugum;
  } catch (e) {
    return { ok: false, hata: `XML okunamadı: ${(e as Error).message}` };
  }
  const kok = doc.Invoice as Dugum | undefined;
  if (!kok || typeof kok !== "object") return { ok: false, hata: "Bu bir e-Fatura (Invoice) dosyası değil." };

  const uyarilar: string[] = [];
  const paraBirimi = yy(kok, "DocumentCurrencyCode") || "TRY";
  if (paraBirimi !== "TRY") uyarilar.push(`Para birimi TRY değil (${paraBirimi}); fiyatları TL'ye çevirerek düzeltin.`);
  // fatura altı iskonto satırlara oranla dağıtılır
  const satirToplam = sayi(yy(kok, "LegalMonetaryTotal/LineExtensionAmount")) ?? 0;
  const altIskonto = sayi(yy(kok, "LegalMonetaryTotal/AllowanceTotalAmount")) ?? 0;
  const carpan = satirToplam > 0 && altIskonto > 0 ? 1 - altIskonto / satirToplam : 1;

  const satirlar: FaturaUrun[] = liste(kok.InvoiceLine).map((sat, si) => {
    const s = sat as Dugum;
    const miktarDugum = s.InvoicedQuantity;
    const miktar = sayi(yazi(miktarDugum)) ?? 0;
    const birimKod = typeof miktarDugum === "object" && miktarDugum ? String((miktarDugum as Dugum)["@unitCode"] ?? "") : "";
    const ad = yy(s, "Item/Name") || yy(s, "Item/Description");
    const tutarHam = sayi(yy(s, "LineExtensionAmount")) ?? 0; // satır iskontosu düşülmüş
    const tutar = yuvarla(tutarHam * carpan);
    const { kdv } = vergiOranlari(s);
    if (!miktar) uyarilar.push(`Satır ${si + 1} (${ad}): miktar okunamadı.`);
    return {
      satirNo: yy(s, "ID") || String(si + 1),
      ad: ad.replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR"),
      saticiKodu: yy(s, "Item/SellersItemIdentification/ID"),
      barkod: yy(s, "Item/StandardItemIdentification/ID") || yy(s, "Item/ManufacturersItemIdentification/ID"),
      miktar,
      birim: BIRIM[birimKod] ?? "Adet",
      birimFiyat: miktar ? yuvarla(tutar / miktar, 4) : 0,
      kdvOrani: kdv,
      tutar,
    };
  });
  if (carpan !== 1) uyarilar.push(`Fatura altı iskonto (${altIskonto.toLocaleString("tr-TR")} ₺) satırlara dağıtıldı.`);
  return {
    ok: true,
    faturaNo: yy(kok, "ID"),
    faturaTarihi: yy(kok, "IssueDate"),
    saticiUnvan: yy(kok, "AccountingSupplierParty/Party/PartyName/Name") || yy(kok, "AccountingSupplierParty/Party/PartyLegalEntity/RegistrationName"),
    saticiVkn: saticiVknBul(kok),
    paraBirimi,
    satirlar,
    uyarilar,
  };
}

/** Kalıcı eşleme anahtarı: tedarikçi VKN + tedarikçinin ürün kodu (yoksa ürün adı) */
export function urunEslemeAnahtari(vkn: string, x: Pick<FaturaUrun, "saticiKodu" | "ad">) {
  return `${vkn}|${x.saticiKodu ? `K:${norm(x.saticiKodu)}` : norm(x.ad)}`;
}
