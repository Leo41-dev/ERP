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
npm run db:seed               # konumlar, ÖTV oranları, PDI listesi ve ilk yönetici
npm run dev
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm test` | Birim testleri |
| `npm run typecheck` | Tip kontrolü |
| `npm run lint` | ESLint |
| `npm run db:seed` | Başlangıç tanımları; tekrar çalıştırmak güvenli |

## Modüller

- **Giriş ve roller:** Yönetici, Satış, Depo, Servis, Muhasebe. Satış personeli maliyet ve kâr görmez, yalnızca kendi satışlarını görür.
- **Müşteriler:** aynı TCKN/VKN ile ikinci kayıt açılmaz.
- **Araçlar:** şase bazlı stok, konum (Başiskele, Acısu, Atölye) ve transfer geçmişi, maliyet kalemleri, tescil bilgisi.
- **Fatura ile araç girişi:** tedarikçi e-Fatura (UBL-TR) XML'lerinden şase, motor, yıl, renk ve alış fiyatı okunur; model önerilir, onaylanan eşleme tedarikçi bazında hatırlanır. Stokta olan şase tekrar girilmez.
- **QR etiket:** 58×40 / 40×58 mm etiket; QR aracın ERP sayfasını açar.
- **Satış:** araç rezerve edilir, ÖTV oranı elle seçilir, fatura tutarı elle girilir ve vergi kırılımı ondan hesaplanır; ödeme satırları, PDI, fatura no işleme, iptal (kayıt silinmez). Satış formu ve PDI yazdırılır.
- **Hızlı satış:** araç dışı satışlar (parça, aksesuar, ekipman, hizmet) için tek ekranda kalem, kartla/bölünmüş ödeme ve 80 mm ya da A5 satış fişi. Müşteri isteğe bağlı; boşsa perakende müşteri.
- **Tahsilat ve cari:** satıştan veya müşteriden tahsilat (kapora dahil), senet/çek vade portföyü, yazıyla tutarlı makbuz, ters kayıtla tahsilat iptali, yürüyen bakiyeli cari ekstre ve yazdırma.
- **Teklif:** araç modeli ve aksesuar/hizmet kalemleriyle teklif, satır bazında ÖTV/KDV, A4 çıktı ve WhatsApp mesajı; düzenleme, kopyalama, ret nedeni. Kabul edilen teklif tek tıkla araç satışına ya da hızlı satışa döner. Teklif müşteri kaydı açmaz; kayıtlı müşteriyse kartında görünür.
- **İade:** faturalı araç satışından ya da hızlı satıştan tam veya kısmi iade; kesinti için tutar düşürülebilir. Araç stoğa (istenirse 2. el olarak) döner, iade cariye alacak, müşteriye yapılan geri ödeme borç yazılır; tamamı iade edilen satış "İade edildi" olur. A5 iade belgesi.
- **Pano:** dönem seçmeli ciro (araç/hızlı), satılan araç, kâr ve kârlılık, tahsilat, açık alacak, vadesi geçen senet/çek, teklif dönüşümü; günlük/aylık ciro grafiği; bu ayın hedefleri (kayıtlı hedef yoksa son 3 tam ay × 1,10); model ve personel kırılımı, %5 altı kârlılık listesi; stok değeri, bekleme süresi, konum dağılımı, ölü stok (60–180 gün eşik) ve buna göre kampanya önerileri. Satıcı yalnızca kendi rakamlarını görür, maliyet ve kâr yalnızca yönetici/muhasebede.
- **Ayarlar:** kullanıcılar, firma bilgileri, konumlar, ÖTV oranları, PDI maddeleri, araç tipleri, marka ve modeller. Tanımlar silinmez, pasif yapılır.
