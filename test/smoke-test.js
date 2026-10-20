// Uji dasar (smoke test) terhadap mock server Prism yang dijalankan dari openapi.yaml.
// Jalankan: npm run mock   (di terminal lain, biarkan berjalan)
//           npm test       (di terminal ini)
//
// Tidak memakai library eksternal selain Node.js bawaan, supaya ringan dipakai di CI.

const http = require('http');

const BASE = process.env.MOCK_BASE_URL || 'http://127.0.0.1:4010';

function request(method, path, body, { auth = false } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      BASE + path,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: 'Bearer token-fiktif-untuk-mock' } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch (e) {
            // respons non-JSON tetap diteruskan sebagai teks mentah
          }
          resolve({ status: res.statusCode, body: json !== null ? json : raw });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const AKUN_ID_CONTOH = '01929b4a-83a1-7d55-8b12-9f7c2e4a6b10';

let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`OK   - ${label}`);
  } else {
    console.error(`GAGAL - ${label}`);
    failed += 1;
  }
}

async function main() {
  console.log(`Menguji mock server di ${BASE} ...\n`);

  const login = await request('POST', '/auth/login', {
    emailAtauUsername: 'yuril.salsabila@anaheimnimbus.co.id',
    password: 'Rahasia#2026',
  });
  check('POST /auth/login mengembalikan status 2xx', login.status >= 200 && login.status < 300);
  check(
    'POST /auth/login mengembalikan accessToken',
    login.body && typeof login.body.accessToken === 'string'
  );

  const identitas = await request('GET', `/identitas/akun/${AKUN_ID_CONTOH}`, null, { auth: true });
  check(
    'GET /identitas/akun/{akunId} mengembalikan status 2xx',
    identitas.status >= 200 && identitas.status < 300
  );
  check(
    'GET /identitas/akun/{akunId} mengembalikan akunId yang diminta',
    identitas.body && typeof identitas.body.akunId === 'string'
  );

  const peran = await request('GET', `/akun/${AKUN_ID_CONTOH}/peran`, null, { auth: true });
  check('GET /akun/{akunId}/peran mengembalikan status 2xx', peran.status >= 200 && peran.status < 300);

  console.log('');
  if (failed > 0) {
    console.error(`${failed} pengujian gagal.`);
    process.exit(1);
  } else {
    console.log('Semua pengujian dasar lolos.');
  }
}

main().catch((err) => {
  console.error('Tidak dapat terhubung ke mock server. Jalankan "npm run mock" di terminal lain terlebih dahulu.');
  console.error(err.message);
  process.exit(1);
});
