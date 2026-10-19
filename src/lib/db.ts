import { PrismaClient } from "@prisma/client";

// Geliştirmede sıcak yeniden yüklemede bağlantı çoğalmasın diye tek örnek tutulur.
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
