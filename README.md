# F-1 — Identitas, Akun, dan Hak Akses

Repositori kelompok F-1 (Kelas F, Kelompok 1), Proyek Perangkat Lunak ERP
PT Anaheim Nimbus Universal. Berisi kontrak OpenAPI, mock server yang
dapat dijalankan, data fiktif (seed), dan pemeriksaan CI dasar — bukti
yang diminta pada pertemuan 3.

Detail kontrak API (daftar operasi, keputusan lintas layanan, cakupan)
ada di [`openapi/README.md`](openapi/README.md). Berkas ini menjelaskan
cara menjalankan repo-nya.

## Isi folder

```
f1-identitas-service/
├── .env.example                 # Konfigurasi contoh — salin jadi .env
├── .github/workflows/check.yml  # CI: validasi openapi, jalankan mock, uji dasar
├── openapi/
│   ├── openapi.yaml             # Spesifikasi OpenAPI 3.0.3 (sumber utama)
│   ├── README.md                # Rincian kontrak API
│   └── examples/                # Contoh respons sukses/gagal
├── seed/
│   └── seed-accounts.json       # Data fiktif: 8 peran + 5 akun contoh (status beragam)
├── test/
│   └── smoke-test.js            # Uji dasar terhadap mock server yang berjalan
└── package.json
```

## 1. Prasyarat

- Node.js 18 atau lebih baru (dipakai mock server dan uji dasar; tidak perlu database untuk versi mock ini).
- Belum perlu database sungguhan — mock server menjawab memakai contoh/skema dari `openapi.yaml`, bukan data asli. `DATABASE_URL` pada `.env.example` disiapkan untuk langkah berikutnya (backend asli).

## 2. Konfigurasi

```bash
cp .env.example .env
```

Nilai bawaan di `.env.example` sudah cukup untuk menjalankan mock server
secara lokal; ganti `JWT_SECRET` bila nanti dipakai pada backend asli.

## 3. Instalasi dan seed data

```bash
npm install
```

Data fiktif ada langsung di `seed/seed-accounts.json` (tidak perlu perintah
migrasi/seed terpisah untuk versi mock ini, karena belum ada database).
Berkas ini berisi 8 peran dan 5 akun contoh dengan status beragam
(active, locked, inactive) agar reviewer bisa menguji skenario gagal
tanpa perlu membuat data sendiri.

## 4. Menjalankan aplikasi (mock server)

```bash
npm run mock
```

Mock server (Prism) berjalan di `http://127.0.0.1:4010` dan menjawab
seluruh path pada `openapi.yaml` memakai contoh/skema yang sudah
ditulis — tanpa perlu backend asli. Contoh pemanggilan dari terminal
lain:

```bash
curl -X POST http://127.0.0.1:4010/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"yuril.salsabila@anaheimnimbus.co.id","password":"Rahasia#2026"}'

curl http://127.0.0.1:4010/identity/accounts/01929b4a-83a1-7d55-8b12-9f7c2e4a6b10 \
  -H "Authorization: Bearer token-fiktif"
```

## 5. Menjalankan uji dan mengembalikan lingkungan

Di terminal lain (saat `npm run mock` masih berjalan):

```bash
npm test
```

`test/smoke-test.js` memanggil tiga operasi inti (login, identitas
akun, cek peran) dan memeriksa status serta bentuk responsnya. Sudah
dijalankan dan lolos sebelum dikumpulkan — lihat `smoke-test-evidence.txt`
pada submisi.

Untuk mengembalikan lingkungan: hentikan proses `npm run mock`
(Ctrl+C) — mock server tidak menyimpan state apa pun di luar prosesnya
sendiri, jadi tidak ada langkah "reset data" terpisah.

## CI

`.github/workflows/check.yml` menjalankan urutan yang sama secara
otomatis pada setiap push/PR: pasang dependensi → validasi
`openapi.yaml` → jalankan mock server → jalankan `npm test`. Hasil
lulus/gagal terlihat di tab Actions repositori.

## Status

Versi mock (Prism), belum ada backend asli. Langkah berikutnya sesuai
rencana di `openapi/README.md`: implementasi endpoint nyata dimulai
dari `POST /auth/login` (lihat Tugas Pertemuan 3 — OpenAPI, bagian
"Tugas sprint berikutnya").

## Demo server lokal (pertemuan 5)

Selain mock kontrak (`npm run mock`, berbasis Prism — statis, tidak menyimpan perubahan),
tersedia juga server demo nyata yang benar-benar menyimpan data di memori selama proses
berjalan, dipakai untuk membuktikan siklus buat → lihat → ubah → lihat ulang:

```
node demo/local-server.js
```

Berjalan di `http://127.0.0.1:4100`. Data direset ke `seed/seed-accounts.json` setiap kali
proses dimulai ulang. Lihat `bukti-pertemuan5.txt` untuk contoh request/response nyata.

Catatan: password pada server demo ini dicek polos (bukan hash) khusus untuk kebutuhan
demo lokal — bukan representasi keamanan produksi.

## Update (2026-10-24): token sekarang JWT asli

Versi demo/local-server.js sebelumnya mengembalikan token PALSU (bukan JWT
asli bertanda tangan) -- ini yang bikin error saat kelompok lain mencoba
verifikasi token. Sudah diperbaiki: accessToken sekarang JWT asli (HS256,
ditandatangani pakai JWT_SECRET dari .env), bisa diverifikasi dengan
library jsonwebtoken standar oleh layanan konsumen mana pun, selama
JWT_SECRET-nya sama persis.

Endpoint yang butuh otorisasi (GET /identity/accounts/{accountId},
GET /accounts/{accountId}/role) sekarang menolak (401) bila header
Authorization: Bearer <token> tidak ada atau tokennya tidak valid/kedaluwarsa.

> > > > > > > > > Temporary merge branch 2
