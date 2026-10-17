# Kartepe ATV ERP

Kartepe ATV için sıfırdan tasarlanan web tabanlı ERP. Mevcut sistemler (Bilsoft, Google Sheets) bu projeden etkilenmez.
İlk modül satış; plan ve kararlar proje dosyalarındaki `plan/satis-modulu-plani.md` içinde.

## Teknoloji

- Next.js 15 (App Router, TypeScript, Tailwind)
- PostgreSQL + Prisma 6
- Vitest

## Kurulum

```bash
npm install
cp .env.example .env          # DATABASE_URL'yi düzenleyin
npm run db:migrate            # şemayı veritabanına uygular
npm run dev
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm test` | Birim testleri |
| `npm run typecheck` | Tip kontrolü |
| `npm run lint` | ESLint |
