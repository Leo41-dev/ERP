import { eposta as epostaCoz, kimlikAyir, metin, telefon as telefonCoz } from "../normalize";

export type CariVeri = {
  tip: "BIREYSEL" | "KURUMSAL";
  rol: "MUSTERI" | "TEDARIKCI" | "MUSTERI_TEDARIKCI";
  unvan: string;
  tckn: string | null;
  vkn: string | null;
  vergiDairesi: string | null;
  tckkSeriNo: string | null;
  dogumTarihi: Date | null;
  telefon: string | null;
  telefon2: string | null;
  eposta: string | null;
  il: string | null;
  ilce: string | null;
  acikAdres: string | null;
  eTebligat: boolean;
  kvkkOnay: boolean;
  not: string | null;
};

export type Hatalar = Record<string, string>;

const bos = (v: string) => (v ? v : null);

/** Form alanlarını doğrular ve temizler. Satış formu da müşteri bölümü için bunu kullanır. */
export function cariDogrula(g: Record<string, string | undefined>, satisIcin = false): { veri: CariVeri; hatalar: Hatalar } {
  const h: Hatalar = {};
  const s = (k: string) => (g[k] ?? "").trim();
  const unvan = metin(s("unvan"));
  if (!unvan) h.unvan = "Ad soyad / ünvan boş olamaz.";

  const kimlikHam = s("kimlikNo").replace(/\D/g, "");
  const kimlik = kimlikAyir(kimlikHam);
  if (kimlik.gecersiz) h.kimlikNo = kimlikHam.length === 11 ? "TC kimlik numarası geçersiz." : "TCKN 11, VKN 10 haneli olmalı.";
  if (satisIcin && !kimlikHam) h.kimlikNo = "Satış için TCKN veya VKN gerekli.";

  const telHam = s("telefon");
  const telefon = telefonCoz(telHam);
  if (telHam && !telefon) h.telefon = "Telefon 10 haneli olmalı (5xx xxx xx xx).";
  if (satisIcin && !telHam) h.telefon = "Satış için telefon gerekli.";
  const tel2Ham = s("telefon2");
  const telefon2 = telefonCoz(tel2Ham);
  if (tel2Ham && !telefon2) h.telefon2 = "Telefon 10 haneli olmalı.";

  const epostaHam = s("eposta");
  const eposta = epostaCoz(epostaHam);
  if (epostaHam && !eposta) h.eposta = "E-posta adresi geçersiz.";

  let dogumTarihi: Date | null = null;
  if (s("dogumTarihi")) {
    dogumTarihi = new Date(`${s("dogumTarihi")}T00:00:00Z`);
    if (Number.isNaN(dogumTarihi.getTime()) || dogumTarihi > new Date()) h.dogumTarihi = "Doğum tarihi geçersiz.";
  }

  const il = metin(s("il"));
  const ilce = metin(s("ilce"));
  const acikAdres = metin(s("acikAdres"));
  if (satisIcin) {
    if (!il) h.il = "İl gerekli.";
    if (!ilce) h.ilce = "İlçe gerekli.";
    if (!acikAdres) h.acikAdres = "Açık adres gerekli.";
  }

  const rol = (["MUSTERI", "TEDARIKCI", "MUSTERI_TEDARIKCI"] as const).find((r) => r === s("rol")) ?? "MUSTERI";
  return {
    veri: {
      tip: kimlik.vkn ? "KURUMSAL" : "BIREYSEL",
      rol,
      unvan,
      tckn: kimlik.tckn ?? null,
      vkn: kimlik.vkn ?? null,
      vergiDairesi: bos(metin(s("vergiDairesi"))),
      tckkSeriNo: bos(metin(s("tckkSeriNo"))),
      dogumTarihi,
      telefon,
      telefon2,
      eposta,
      il: bos(il),
      ilce: bos(ilce),
      acikAdres: bos(acikAdres),
      eTebligat: g.eTebligat === "on",
      kvkkOnay: g.kvkkOnay === "on",
      not: bos(s("not")),
    },
    hatalar: h,
  };
}

export const formNesne = (f: FormData) => Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
