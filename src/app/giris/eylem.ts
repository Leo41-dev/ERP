"use server";
import { redirect } from "next/navigation";
import { girisYap } from "@/lib/oturum";

export async function girisEylemi(_: { hata?: string } | undefined, form: FormData) {
  const sonuc = await girisYap(String(form.get("kullaniciAdi") ?? ""), String(form.get("sifre") ?? ""));
  if ("hata" in sonuc) return { hata: sonuc.hata };
  redirect("/");
}
