"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cariDogrula, formNesne, type Hatalar } from "@/lib/dogrulama/cari";
import { yetkiIste } from "@/lib/oturum";

export type CariDurum = { hatalar?: Hatalar; genel?: string } | undefined;

export async function cariKaydet(id: number | null, _: CariDurum, form: FormData): Promise<CariDurum> {
  const k = await yetkiIste("SATIS", "MUHASEBE", "SERVIS");
  const { veri, hatalar } = cariDogrula(formNesne(form));
  if (Object.keys(hatalar).length) return { hatalar };
  // aynı kimlik numarasıyla ikinci kayıt açılmasın
  const kimlik = veri.tckn ? { tckn: veri.tckn } : veri.vkn ? { vkn: veri.vkn } : null;
  if (kimlik) {
    const var_ = await db.cari.findFirst({ where: { ...kimlik, ...(id ? { NOT: { id } } : {}) }, select: { id: true, unvan: true } });
    if (var_) return { genel: `Bu kimlik numarasıyla kayıtlı bir müşteri var: ${var_.unvan} (no ${var_.id}).` };
  }
  const kayit = id ? await db.cari.update({ where: { id }, data: veri }) : await db.cari.create({ data: veri });
  await db.denetimKaydi.create({ data: { kullanici: k.kullaniciAdi, islem: id ? "GUNCELLE" : "EKLE", tablo: "Cari", kayitId: String(kayit.id) } });
  revalidatePath("/musteriler");
  redirect(`/musteriler/${kayit.id}`);
}
