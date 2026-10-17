"use server";
import { redirect } from "next/navigation";
import { cikisYap } from "@/lib/oturum";

export async function cikisEylemi() {
  await cikisYap();
  redirect("/giris");
}
