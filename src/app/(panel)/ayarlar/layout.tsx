import type { ReactNode } from "react";
import { yetkiIste } from "@/lib/oturum";
import { AyarSekmeleri } from "./Sekmeler";

export default async function AyarlarDuzeni({ children }: { children: ReactNode }) {
  await yetkiIste("YONETICI");
  return (
    <>
      <h1 className="mb-3 text-xl font-semibold">Ayarlar</h1>
      <AyarSekmeleri />
      {children}
    </>
  );
}
