# Etsy Siparis Analiz Uygulamasi

Next.js (App Router) ile gelistirilmis full stack bir analiz paneli.

## Ozellikler

- Etsy'den manuel indirilen CSV dosyasini yukler.
- Veriyi aylik sekmeler halinde Google Sheets'e kaydeder.
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

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

4. Google service account email'ini hedef spreadsheet'e Editor olarak ekle.

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
