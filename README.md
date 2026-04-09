# Etsy Siparis Analiz Uygulamasi

Next.js (App Router) ile gelistirilmis full stack bir analiz paneli.

## Ozellikler

- Etsy'den manuel indirilen CSV dosyasini yukler.
- Veriyi ucretsiz Vercel Postgres veritabanina aylik olarak kaydeder.
- Ayni ay tekrar yukleme yapildiginda duplicate olusturmadan akilli upsert uygular.
- Listing ID bazinda toplam satis adedini gosterir.
- Secilen listing icin gun gun aylik satis tablosu ve cizgisini cikarir.
- Tum urunlerin toplam satis icindeki yuzdesini pie chart ile verir.
- Eyalet bazli satin alim siralamasini adet ve siparis sayisi ile gosterir.

## CSV Beklenen Sutunlar

Sirasiyla su sutunlar beklenir:

- Sale Date
- Item Name
- Quantity
- Price
- Listing ID
- Ship State
- Order ID

## Kurulum

1. Bagimliliklar yuklu degilse yukle:

```bash
npm install
```

2. Ortam degiskenlerini hazirla:

```bash
cp .env.example .env.local
```

3. `.env.local` icinde su alanlari doldur:

- `POSTGRES_URL`

4. Vercel Dashboard > Storage > Postgres olusturup connection string'i `.env.local` dosyasina ekle.

5. Gelistirme sunucusunu baslat:

```bash
npm run dev
```

## Kullanim

1. Panelde ay sec.
2. CSV dosyasini secip `CSV Yukle` tikla.
3. `Analizi Getir` ile secili ay verisini oku.
4. Listing secimi yaparak gunluk satis tablosunu incele.

## API Uclari

- `POST /api/upload-csv`
	- `multipart/form-data`
	- Alanlar: `file` (csv), `month` (`YYYY-MM`, opsiyonel)
- `GET /api/analytics?month=YYYY-MM&listingId=...`

## Not

Bu proje Next.js 16 ile olusturuldu. Node.js surumunun guncel tutulmasi onerilir.
Tablo yapisi uygulama acilisinda otomatik olusturulur.
CSV tekrar yuklemelerinde ayni `month + order_id + listing_id + item_name + day` satiri guncellenir, eksik kalan kayitlar ay bazinda silinir.
