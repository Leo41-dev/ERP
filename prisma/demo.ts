// Örnek verili demo kurulumu (`npm run demo`): --demo ya da DEMO_VERI=1 ile çağrılınca ve veritabanında hiç kullanıcı yokken prisma/demo.sql'i yükler.
// Gerçek kurulumda çalışmaz; dolu bir veritabanına dokunmaz.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.DEMO_VERI !== "1" && !process.argv.includes("--demo")) return;
  const db = new PrismaClient();
  try {
    if ((await db.kullanici.count()) > 0) return console.log("Demo verisi atlandı: veritabanı boş değil.");
    const komutlar = readFileSync(new URL("./demo.sql", import.meta.url), "utf8").split("\n").filter((s) => s.trim());
    await db.$transaction(async (tx) => { for (const k of komutlar) await tx.$executeRawUnsafe(k); }, { timeout: 120_000 });
    console.log(`Demo verisi yüklendi (${komutlar.length} komut).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
