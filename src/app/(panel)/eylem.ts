"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cikisYap, yetkiIste } from "@/lib/oturum";
import { SILINEBILIR, kaydiSil, type SilinebilirTur } from "@/lib/silme";

export async function cikisEylemi() {
  await cikisYap();
  redirect("/giris");
}

export type SilDurum = { hata?: string; tamam?: string } | undefined;

/** Ortak silme: kullanılmayan kayıt silinir, kullanılan için nedeni döner (kural: lib/silme.ts) */
export async function kayitSil(tur: SilinebilirTur, id: number, sonra: "liste" | "kal", _: SilDurum): Promise<SilDurum> {
  const k = await yetkiIste();
  if (!(tur in SILINEBILIR)) return { hata: "Geçersiz kayıt türü." };
  const s = await kaydiSil(tur, id, k);
  if ("hata" in s) return { hata: s.hata };
  revalidatePath("/", "layout");
  if (sonra === "liste" && s.liste) redirect(`${s.liste}?silindi=1`);
  return { tamam: "Silindi." };
}
