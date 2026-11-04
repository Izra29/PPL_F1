// Demo server F-1 (Identitas, akun, dan hak akses) — Pertemuan 5
//
// Ini BUKAN pengganti backend produksi. Ini implementasi minimal yang
// benar-benar menyimpan data di memori (bukan Prism/mock statis), supaya
// siklus buat -> lihat -> ubah -> lihat ulang bisa dibuktikan sungguhan
// berjalan dan datanya benar-benar berubah, sesuai permintaan tugas
// pertemuan 5 ("Laporkan operasi buat, lihat, dan ubah yang benar-benar
// berjalan").
//
// Penyederhanaan yang disengaja untuk demo ini (dicatat juga di laporan):
//  - Password dicek polos (plaintext) lewat DEMO_PASSWORDS di bawah,
//    bukan bcrypt. Implementasi asli nanti wajib pakai hash asli.
//  - Data hilang saat proses dimatikan (in-memory, bukan database).
//
// Update v0.4.0 (2026-10-28): seluruh field dan path diseragamkan ke
// Bahasa Inggris (accountId, roleCode, status: active/inactive/locked,
// dst.) sesuai aturan dosen dan mengikuti openapi.yaml v0.4.0.
//
// Update v0.4.1 (2026-11-02, pertemuan 6): openapi.yaml sudah lama
// mendokumentasikan bahwa POST /accounts dan PUT /accounts/{accountId}
// menolak (403) pemanggil yang bukan COO/CTO/Admin -- tapi demo server
// ini sebelumnya TIDAK memeriksa itu sama sekali (bug, ketahuan saat
// menyiapkan bukti "Pemeriksaan identitas dan hak akses" pertemuan 6).
// Sudah diperbaiki: kedua endpoint itu sekarang benar-benar memverifikasi
// token dan menolak role selain COO/CTO/ADMIN dengan 403.
//
// Update v0.5.0 (2026-11-03): role CFO, TW, TL ditambahkan (TW/TL bisa login)
// dan ada akun seed contoh untuk AM, TW, TL.
//
// Update v0.6.0 (2026-11-04): GET /accounts diimplementasikan dan dibuka untuk semua
// role dengan token valid (non-admin hanya melihat akun active dengan field terbatas),
// atas permintaan kelompok lain untuk memilih peserta rapat dan PIC.
//
// Jalankan: node demo/local-server.js
// Server berjalan di http://127.0.0.1:4100

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Harus SAMA PERSIS dengan JWT_SECRET di .env setiap layanan konsumen (F-2, F-6, dst),
// supaya mereka bisa verifikasi token ini secara lokal tanpa memanggil balik ke F-1.
const JWT_SECRET = process.env.JWT_SECRET || 'ganti-dengan-rahasia-acak-minimal-32-karakter';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '3600';

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../seed/seed-accounts.json'), 'utf8'));

// Nama tampilan untuk demo (seed asli tidak menyimpan field nama/jabatan secara lengkap untuk semua akun)
const DEMO_NAMES = {
  'super.admin': 'Super Admin',
  'yuril.salsabila': 'Yuril Salsabila',
  'dwi.saputra': 'Dwi Saputra',
  'amaliyah': 'Amaliyah',
  'icha.aprilia': 'Icha Aprilia',
  'maelani.tw': 'Maelani (TW)',
  'amaliyah.tl': 'Amaliyah (TL)',
  'account.manager': 'Account Manager (Demo)',
};

// Password polos KHUSUS demo lokal ini (lihat catatan di atas) — bukan representasi keamanan asli.
const DEMO_PASSWORDS = {
  'dwi.saputra': 'Password123!',
  'yuril.salsabila': 'Password123!',
  'super.admin': 'Password123!',
  'amaliyah': 'Password123!',
  'icha.aprilia': 'Password123!',
  'maelani.tw': 'Password123!',
  'amaliyah.tl': 'Password123!',
  'account.manager': 'Password123!',
};

// Penyimpanan di memori — hidup selama proses ini jalan
const accountStore = seed.accounts.map(a => ({ ...a, name: DEMO_NAMES[a.username] || a.username }));

function uuidv7() {
  const now = BigInt(Date.now());
  const rand = crypto.randomBytes(10);
  const bytes = Buffer.alloc(16);
  bytes.writeUIntBE(Number(now & 0xffffffffffffn), 0, 6);
  rand.copy(bytes, 6);
  bytes[6] = 0x70 | (bytes[6] & 0x0f); // versi 7
  bytes[8] = 0x80 | (bytes[8] & 0x3f); // varian
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(data);
}

// Role yang boleh membuat/mengubah akun, sesuai openapi.yaml ("Pemanggil bukan COO/CTO/Admin").
const ACCOUNT_MANAGER_ROLES = ['COO', 'CTO', 'ADMIN'];

function verifyToken(req) {
  const header = req.headers['authorization'] || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return { ok: false, reason: 'Token tidak ada.' };
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, reason: `Token tidak valid: ${e.message}` };
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const segments = url.pathname.split('/').filter(Boolean);

  try {
    // POST /auth/login
    if (req.method === 'POST' && url.pathname === '/auth/login') {
      const body = await readBody(req);
      const account = accountStore.find(a => a.username === body.emailOrUsername || a.email === body.emailOrUsername);
      if (!account || DEMO_PASSWORDS[account.username] !== body.password) {
        return sendJson(res, 401, { code: 'INVALID_CREDENTIALS', message: 'Email/username atau password salah.' });
      }
      if (account.status === 'locked') {
        return sendJson(res, 403, { code: 'ACCOUNT_LOCKED', message: 'Akun terkunci, coba lagi nanti.' });
      }
      if (account.status === 'inactive') {
        return sendJson(res, 403, { code: 'ACCOUNT_INACTIVE', message: 'Akun nonaktif, hubungi admin.' });
      }
      const accessToken = jwt.sign(
        { accountId: account.accountId, roleCode: account.roleCode },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: Number(JWT_EXPIRES_IN) }
      );
      return sendJson(res, 200, {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: Number(JWT_EXPIRES_IN),
        // Objek `account` sesuai kontrak (LoginResponse.account).
        account: { accountId: account.accountId, name: account.name, roleCode: account.roleCode },
        // Field datar di bawah dipertahankan demi kompatibilitas dengan konsumen yang sudah memakainya.
        accountId: account.accountId,
        roleCode: account.roleCode,
      });
    }

    // GET /accounts  (Daftar) -- v0.6.0: boleh dibuka SEMUA role dengan token valid.
    //  - COO/CTO/ADMIN: melihat semua akun dengan field lengkap (Account), bisa filter ?status=
    //  - role lain (anggota proyek, mis. untuk memilih peserta rapat/PIC): hanya akun
    //    berstatus active, dengan field terbatas (UserIdentity: tanpa username/email).
    //  Query: ?search= (cocok ke nama, username, email -- tidak peka huruf besar/kecil)
    if (req.method === 'GET' && url.pathname === '/accounts') {
      const check = verifyToken(req);
      if (!check.ok) return sendJson(res, 401, { code: 'INVALID_TOKEN', message: check.reason });
      const isManager = ACCOUNT_MANAGER_ROLES.includes(check.payload.roleCode);
      const statusFilter = url.searchParams.get('status');
      const search = (url.searchParams.get('search') || '').toLowerCase();
      let list = accountStore;
      if (!isManager) list = list.filter(a => a.status === 'active');
      else if (statusFilter) list = list.filter(a => a.status === statusFilter);
      if (search) {
        list = list.filter(a => [a.name, a.username, a.email].some(v => (v || '').toLowerCase().includes(search)));
      }
      const items = list.map(a => isManager
        ? { accountId: a.accountId, employeeId: a.employeeId, name: a.name, username: a.username, email: a.email, roleCode: a.roleCode, status: a.status, createdAt: a.createdAt || null }
        : { accountId: a.accountId, employeeId: a.employeeId, name: a.name, roleCode: a.roleCode, position: a.position || null, status: a.status });
      return sendJson(res, 200, items);
    }

    // POST /accounts  (Buat) — perlu token valid DAN role COO/CTO/ADMIN
    if (req.method === 'POST' && url.pathname === '/accounts') {
      const check = verifyToken(req);
      if (!check.ok) return sendJson(res, 401, { code: 'INVALID_TOKEN', message: check.reason });
      if (!ACCOUNT_MANAGER_ROLES.includes(check.payload.roleCode)) {
        return sendJson(res, 403, { code: 'INSUFFICIENT_PERMISSION', message: 'Pemanggil bukan COO/CTO/Admin.' });
      }
      const body = await readBody(req);
      if (!body.employeeId || !body.roleCode) {
        return sendJson(res, 400, { code: 'REQUIRED_FIELD_MISSING', message: 'employeeId dan roleCode wajib diisi.' });
      }
      const username = body.username || `pegawai.${accountStore.length + 1}`;
      if (accountStore.some(a => a.username === username)) {
        return sendJson(res, 409, { code: 'USERNAME_TAKEN', message: 'Username atau email sudah terdaftar.' });
      }
      const created = {
        accountId: uuidv7(),
        employeeId: body.employeeId,
        username,
        email: `${username}@anaheimnimbus.co.id`,
        name: body.name || 'Pegawai Baru (Demo)',
        roleCode: body.roleCode,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      accountStore.push(created);
      return sendJson(res, 201, created);
    }

    // GET /identity/accounts/{accountId}  (Lihat) — perlu token valid (bearerAuth)
    if (req.method === 'GET' && segments[0] === 'identity' && segments[1] === 'accounts' && segments[2]) {
      const check = verifyToken(req);
      if (!check.ok) return sendJson(res, 401, { code: 'INVALID_TOKEN', message: check.reason });
      const account = accountStore.find(a => a.accountId === segments[2]);
      if (!account) return sendJson(res, 404, { code: 'ACCOUNT_NOT_FOUND', message: 'accountId tidak ditemukan.' });
      return sendJson(res, 200, {
        accountId: account.accountId,
        employeeId: account.employeeId,
        name: account.name,
        roleCode: account.roleCode,
        position: account.position || null,
        status: account.status,
      });
    }

    // PUT /accounts/{accountId}  (Ubah) — perlu token valid DAN role COO/CTO/ADMIN
    if (req.method === 'PUT' && segments[0] === 'accounts' && segments[1] && !segments[2]) {
      const check = verifyToken(req);
      if (!check.ok) return sendJson(res, 401, { code: 'INVALID_TOKEN', message: check.reason });
      if (!ACCOUNT_MANAGER_ROLES.includes(check.payload.roleCode)) {
        return sendJson(res, 403, { code: 'INSUFFICIENT_PERMISSION', message: 'Pemanggil bukan COO/CTO/Admin.' });
      }
      const account = accountStore.find(a => a.accountId === segments[1]);
      if (!account) return sendJson(res, 404, { code: 'ACCOUNT_NOT_FOUND', message: 'accountId tidak ditemukan.' });
      const body = await readBody(req);
      if (body.status) account.status = body.status;
      if (body.roleCode) account.roleCode = body.roleCode;
      return sendJson(res, 200, account);
    }

    // GET /accounts/{accountId}/role — perlu token valid (bearerAuth)
    if (req.method === 'GET' && segments[0] === 'accounts' && segments[1] && segments[2] === 'role') {
      const check = verifyToken(req);
      if (!check.ok) return sendJson(res, 401, { code: 'INVALID_TOKEN', message: check.reason });
      const account = accountStore.find(a => a.accountId === segments[1]);
      if (!account) return sendJson(res, 404, { code: 'ACCOUNT_NOT_FOUND', message: 'accountId tidak ditemukan.' });
      return sendJson(res, 200, { accountId: account.accountId, roleCode: account.roleCode, status: account.status });
    }

    return sendJson(res, 404, { code: 'UNKNOWN_ROUTE', message: 'Path tidak dikenal pada demo server ini.' });
  } catch (e) {
    return sendJson(res, 400, { code: 'INVALID_BODY', message: 'Body request bukan JSON yang valid.' });
  }
});

const PORT = 4100;
server.listen(PORT, () => console.log(`Demo server (in-memory) F-1 berjalan di http://127.0.0.1:${PORT}`));
