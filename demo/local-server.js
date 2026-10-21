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
// Jalankan: node demo/local-server.js
// Server berjalan di http://127.0.0.1:4100

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../seed/seed-akun.json'), 'utf8'));

// Nama tampilan untuk demo (seed asli tidak menyimpan field nama/jabatan secara lengkap untuk semua akun)
const NAMA_DEMO = {
  'super.admin': 'Super Admin',
  'yuril.salsabila': 'Yuril Salsabila',
  'dwi.saputra': 'Dwi Saputra',
  'amaliyah': 'Amaliyah',
  'icha.aprilia': 'Icha Aprilia',
};

// Password polos KHUSUS demo lokal ini (lihat catatan di atas) — bukan representasi keamanan asli.
const DEMO_PASSWORDS = {
  'dwi.saputra': 'Password123!',
  'yuril.salsabila': 'Password123!',
  'super.admin': 'Password123!',
  'amaliyah': 'Password123!',
  'icha.aprilia': 'Password123!',
};

// Penyimpanan di memori — hidup selama proses ini jalan
const akunStore = seed.akun.map(a => ({ ...a, nama: NAMA_DEMO[a.username] || a.username }));

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
      const akun = akunStore.find(a => a.username === body.emailAtauUsername || a.email === body.emailAtauUsername);
      if (!akun || DEMO_PASSWORDS[akun.username] !== body.password) {
        return sendJson(res, 401, { kode: 'KREDENSIAL_SALAH', pesan: 'Email/username atau password salah.' });
      }
      if (akun.status === 'terkunci') {
        return sendJson(res, 403, { kode: 'AKUN_TERKUNCI', pesan: 'Akun terkunci, coba lagi nanti.' });
      }
      if (akun.status === 'nonaktif') {
        return sendJson(res, 403, { kode: 'AKUN_NONAKTIF', pesan: 'Akun nonaktif, hubungi admin.' });
      }
      return sendJson(res, 200, {
        accessToken: `demo.${Buffer.from(JSON.stringify({ akunId: akun.akunId, kodePeran: akun.kodePeran })).toString('base64url')}.signature`,
        akunId: akun.akunId,
        kodePeran: akun.kodePeran,
      });
    }

    // POST /akun  (Buat)
    if (req.method === 'POST' && url.pathname === '/akun') {
      const body = await readBody(req);
      if (!body.employeeId || !body.kodePeran) {
        return sendJson(res, 400, { kode: 'FIELD_WAJIB_KOSONG', pesan: 'employeeId dan kodePeran wajib diisi.' });
      }
      const username = body.username || `pegawai.${akunStore.length + 1}`;
      if (akunStore.some(a => a.username === username)) {
        return sendJson(res, 409, { kode: 'USERNAME_TERPAKAI', pesan: 'Username atau email sudah terdaftar.' });
      }
      const baru = {
        akunId: uuidv7(),
        employeeId: body.employeeId,
        username,
        email: `${username}@anaheimnimbus.co.id`,
        nama: body.nama || 'Pegawai Baru (Demo)',
        kodePeran: body.kodePeran,
        status: 'aktif',
        dibuatPada: new Date().toISOString(),
      };
      akunStore.push(baru);
      return sendJson(res, 201, baru);
    }

    // GET /identitas/akun/{akunId}  (Lihat)
    if (req.method === 'GET' && segments[0] === 'identitas' && segments[1] === 'akun' && segments[2]) {
      const akun = akunStore.find(a => a.akunId === segments[2]);
      if (!akun) return sendJson(res, 404, { kode: 'AKUN_TIDAK_DITEMUKAN', pesan: 'akunId tidak ditemukan.' });
      return sendJson(res, 200, {
        akunId: akun.akunId,
        employeeId: akun.employeeId,
        nama: akun.nama,
        kodePeran: akun.kodePeran,
        jabatan: akun.jabatan || null,
        status: akun.status,
      });
    }

    // PUT /akun/{akunId}  (Ubah)
    if (req.method === 'PUT' && segments[0] === 'akun' && segments[1] && !segments[2]) {
      const akun = akunStore.find(a => a.akunId === segments[1]);
      if (!akun) return sendJson(res, 404, { kode: 'AKUN_TIDAK_DITEMUKAN', pesan: 'akunId tidak ditemukan.' });
      const body = await readBody(req);
      if (body.status) akun.status = body.status;
      if (body.kodePeran) akun.kodePeran = body.kodePeran;
      return sendJson(res, 200, akun);
    }

    // GET /akun/{akunId}/peran
    if (req.method === 'GET' && segments[0] === 'akun' && segments[1] && segments[2] === 'peran') {
      const akun = akunStore.find(a => a.akunId === segments[1]);
      if (!akun) return sendJson(res, 404, { kode: 'AKUN_TIDAK_DITEMUKAN', pesan: 'akunId tidak ditemukan.' });
      return sendJson(res, 200, { akunId: akun.akunId, kodePeran: akun.kodePeran, status: akun.status });
    }

    return sendJson(res, 404, { kode: 'RUTE_TIDAK_DIKENAL', pesan: 'Path tidak dikenal pada demo server ini.' });
  } catch (e) {
    return sendJson(res, 400, { kode: 'BODY_TIDAK_VALID', pesan: 'Body request bukan JSON yang valid.' });
  }
});

const PORT = 4100;
server.listen(PORT, () => console.log(`Demo server (in-memory) F-1 berjalan di http://127.0.0.1:${PORT}`));
