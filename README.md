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
│   └── seed-accounts.json       # Data fiktif: 11 peran + 8 akun contoh (status beragam)
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
Berkas ini berisi 11 peran dan 8 akun contoh dengan status beragam
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

## Update (2026-10-28): penamaan diseragamkan ke Bahasa Inggris

Sesuai aturan dosen: nama skema, properti/field, nilai enum, operationId, dan
path pada kontrak dan kode (openapi.yaml, demo/local-server.js,
seed/seed-accounts.json, test/smoke-test.js) diseragamkan ke Bahasa Inggris
supaya konsisten dan sinkron dengan kontrak kelompok lain. Teks
deskripsi/summary dalam dokumen tetap Bahasa Indonesia. Kontrak naik ke
v0.4.0 (dari v0.3.0) — ini perubahan yang memecah kompatibilitas (breaking
change) terhadap kontrak sebelumnya, karena nama field dan path berubah.

Pemetaan nama lama → nama baru yang paling penting bagi kelompok konsumen (F-2 s.d. F-6):

| Lama | Baru |
| --- | --- |
| `akunId` | `accountId` |
| `kodePeran` | `roleCode` |
| `nama` | `name` |
| `jabatan` | `position` |
| `dibuatPada` | `createdAt` |
| `emailAtauUsername` | `emailOrUsername` |
| `passwordBaru` | `newPassword` |
| `ingatSaya` | `rememberMe` |
| status `aktif` / `nonaktif` / `terkunci` | `active` / `inactive` / `locked` |
| peran `KARYAWAN` / `TENAGA_AHLI` | `EMPLOYEE` / `SPECIALIST` |
| skema `Akun` / `AkunBaru` / `AkunUbahan` / `AkunRingkas` | `Account` / `NewAccount` / `AccountUpdate` / `AccountSummary` |
| skema `StatusAkun` / `KodePeran` / `IdentitasPengguna` | `AccountStatus` / `RoleCode` / `UserIdentity` |
| path `/akun` | `/accounts` |
| path `/akun/{akunId}` | `/accounts/{accountId}` |
| path `/akun/{akunId}/peran` | `/accounts/{accountId}/role` |
| path `/identitas/akun/{akunId}` | `/identity/accounts/{accountId}` |

## Update (2026-11-02): bug pemeriksaan izin -- v0.4.1 (pertemuan 6)

Ditemukan saat menyiapkan bukti "Pemeriksaan identitas dan hak akses"
pertemuan 6: `openapi.yaml` sudah lama mendokumentasikan bahwa
`POST /accounts` dan `PUT /accounts/{accountId}` menolak (403) pemanggil
yang bukan `COO`/`CTO`/`ADMIN`, tapi `demo/local-server.js` **tidak
pernah benar-benar memeriksa itu** -- siapa pun dengan token valid apa
pun rolenya bisa membuat/mengubah akun. Sudah diperbaiki: kedua endpoint
itu sekarang memverifikasi token DAN menolak role selain
`COO`/`CTO`/`ADMIN` dengan `403 INSUFFICIENT_PERMISSION`.

**Dampak buat konsumen**: pemanggil `POST /accounts` dan
`PUT /accounts/{accountId}` (termasuk trigger dari F-2 saat pegawai baru
terdaftar) sekarang WAJIB menyertakan header
`Authorization: Bearer <token>` dengan role `COO`/`CTO`/`ADMIN` --
sebelumnya tidak wajib (bug). Lihat `bukti-pertemuan6.txt` untuk bukti
nyata kasus izin sah dan izin tidak cukup.

## Update (2026-11-03): penyesuaian role -- v0.5.0

Atas permintaan kelompok mitra:

| Permintaan | Keputusan |
| --- | --- |
| Direktur | Dipetakan ke `CEO` (tidak ada role baru) |
| Komisaris | Dipetakan ke `COO` (tidak ada role baru) |
| Kepala Finance | Role baru `CFO` |
| Technical Writer | Role baru `TW`, **bisa login** |
| Technical Lead | Role baru `TL`, **bisa login** |
| AM | Sudah ada (`AM` = Account Manager); sekarang punya akun seed contoh |

`RoleCode` sekarang: `CEO, COO, CTO, CFO, ADMIN, AM, PM, EMPLOYEE, SPECIALIST, TW, TL`
(11 nilai). Penambahan bersifat aditif sehingga **tidak memecah kompatibilitas**
terhadap konsumen v0.4.x. Hak membuat/mengubah akun tetap hanya `COO`/`CTO`/`ADMIN`;
role baru (CFO, TW, TL) dan AM belum punya hak itu.

Akun seed contoh baru (password demo `Password123!`): `maelani.tw` (TW),
`amaliyah.tl` (TL), `account.manager` (AM).

Catatan tambahan v0.5.0: respons `POST /auth/login` pada demo server sekarang juga
memuat objek `account` (`accountId`, `name`, `roleCode`) sesuai `LoginResponse`
di kontrak. Field datar `accountId` dan `roleCode` tetap dipertahankan supaya
konsumen yang sudah memakainya tidak rusak.

## Update (2026-11-04): daftar akun untuk semua role -- v0.6.0

Atas permintaan kelompok lain (memilih peserta rapat dan PIC), `GET /accounts`
sekarang bisa dibuka **semua role dengan token valid**, tidak hanya admin.

| Pemanggil | Yang diterima |
| --- | --- |
| `COO` / `CTO` / `ADMIN` | Semua akun, field lengkap (`Account`), filter `?status=` dan `?search=` |
| Role lain | Hanya akun `active`, field terbatas (`accountId`, `employeeId`, `name`, `roleCode`, `position`, `status`; tanpa `username` dan `email`), filter `?search=` |
| Tanpa token / token salah | `401 INVALID_TOKEN` |

`POST /accounts` dan `PUT /accounts/{accountId}` tetap hanya untuk `COO`/`CTO`/`ADMIN`.
Perubahan ini melonggarkan akses sehingga **tidak memecah kompatibilitas**. Catatan:
sebelum v0.6.0, `GET /accounts` ada di kontrak tetapi belum diimplementasikan di demo server.
