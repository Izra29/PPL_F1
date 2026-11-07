// Skenario demo asesmen pertama (UJI-01 s.d. UJI-04) terhadap demo server F-1.
// Jalankan: node demo/local-server.js   (terminal 1, data awal = seed)
//           node test/asesmen1-demo.js  (terminal 2)
// Simpan hasil: node test/asesmen1-demo.js > bukti-asesmen1.txt
// Restart server sebelum menjalankan ulang supaya data kembali ke seed.
// Token disamarkan pada keluaran.

const jwt = require('jsonwebtoken');
const BASE = process.env.F1_BASE_URL || 'http://127.0.0.1:4100';
const SECRET = process.env.JWT_SECRET || 'ganti-dengan-rahasia-acak-minimal-32-karakter';
const PASS = 'Password123!';
let failed = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, json };
}
const mask = (o) => JSON.stringify(o, (k, v) => (k === 'accessToken' ? String(v).slice(0, 14) + '...[disamarkan]' : v));
function show(id, title, req, r, expectStatus, extraOk = true, note = '') {
  const ok = r.status === expectStatus && extraOk;
  if (!ok) failed++;
  console.log(`[${ok ? 'LULUS' : 'GAGAL'}] ${id} ${title}`);
  console.log(`        ${req} -> HTTP ${r.status} (harapan ${expectStatus})`);
  console.log(`        ${mask(r.json).slice(0, 330)}`);
  if (note) console.log(`        ${note}`);
}
async function login(u) { const r = await call('POST', '/auth/login', { body: { emailOrUsername: u, password: PASS } }); return r; }

(async () => {
  console.log(`Skenario demo asesmen 1 -- F-1 -- ${new Date().toISOString()} -- ${BASE}\n`);
  const adm = await login('super.admin');
  const admT = adm.json && adm.json.accessToken;
  const before = (await call('GET', '/accounts', { token: admT })).json.length;
  console.log(`Jumlah akun awal (seed): ${before}\n`);

  console.log('=== UJI-01 Berhasil: login -> identitas -> buat akun -> baca ulang -> nonaktifkan ===');
  show('U1.1', 'Login ADMIN', 'POST /auth/login (super.admin)', adm, 200, adm.json.roleCode === 'ADMIN');
  const me = await call('GET', `/identity/accounts/${adm.json.account.accountId}`, { token: admT });
  show('U1.2', 'Identitas akun sendiri', 'GET /identity/accounts/{accountId}', me, 200, me.json.roleCode === 'ADMIN');
  const created = await call('POST', '/accounts', { token: admT, body: { employeeId: '01929b4a-5f10-7a22-9d44-3c8f1b2e7aa0', roleCode: 'CFO', username: 'demo.cfo' } });
  show('U1.3', 'Buat akun role CFO', 'POST /accounts (token ADMIN)', created, 201, created.json.roleCode === 'CFO' && created.json.status === 'active');
  const newId = created.json.accountId;
  const reread = await call('GET', `/accounts/${newId}/role`, { token: admT });
  show('U1.4', 'Baca ulang peran akun baru', 'GET /accounts/{newId}/role', reread, 200, reread.json.roleCode === 'CFO' && reread.json.status === 'active');
  const upd = await call('PUT', `/accounts/${newId}`, { token: admT, body: { status: 'inactive' } });
  show('U1.5', 'Nonaktifkan akun', 'PUT /accounts/{newId} {status: inactive}', upd, 200, upd.json.status === 'inactive');
  const reread2 = await call('GET', `/accounts/${newId}/role`, { token: admT });
  show('U1.6', 'Baca ulang status', 'GET /accounts/{newId}/role', reread2, 200, reread2.json.status === 'inactive');

  console.log('\n=== UJI-02 Ditolak: kredensial/input tidak sah ===');
  const wrong = await call('POST', '/auth/login', { body: { emailOrUsername: 'super.admin', password: 'salah' } });
  show('U2.1', 'Password salah', 'POST /auth/login', wrong, 401, wrong.json.code === 'INVALID_CREDENTIALS');
  const locked = await login('amaliyah');
  show('U2.2', 'Akun terkunci', 'POST /auth/login (amaliyah)', locked, 403, locked.json.code === 'ACCOUNT_LOCKED');
  const inactive = await login('icha.aprilia');
  show('U2.3', 'Akun nonaktif', 'POST /auth/login (icha.aprilia)', inactive, 403, inactive.json.code === 'ACCOUNT_INACTIVE');
  const noTok = await call('POST', '/accounts', { body: { employeeId: 'x', roleCode: 'EMPLOYEE' } });
  show('U2.4', 'Buat akun tanpa token', 'POST /accounts (tanpa Authorization)', noTok, 401, noTok.json.code === 'INVALID_TOKEN');
  const bad = await call('POST', '/accounts', { token: admT, body: { employeeId: 'x' } });
  show('U2.5', 'Field wajib kosong (roleCode)', 'POST /accounts (token ADMIN, tanpa roleCode)', bad, 400, bad.json.code === 'REQUIRED_FIELD_MISSING');
  const dup = await call('POST', '/accounts', { token: admT, body: { employeeId: 'y', roleCode: 'EMPLOYEE', username: 'demo.cfo' } });
  show('U2.6', 'Username sudah dipakai', 'POST /accounts (username demo.cfo)', dup, 409, dup.json.code === 'USERNAME_TAKEN');
  const afterRej = (await call('GET', '/accounts', { token: admT })).json.length;
  show('U2.7', 'Data tidak berubah setelah penolakan', 'GET /accounts (ADMIN)', { status: 200, json: { jumlahAkun: afterRej, diharapkan: before + 1 } }, 200, afterRej === before + 1, '(seed + 1 akun demo.cfo dari U1.3; penolakan U2.4-U2.6 tidak menambah akun)');

  console.log('\n=== UJI-03 Akses peran ===');
  const emp = await login('dwi.saputra'); const empT = emp.json.accessToken;
  const e1 = await call('POST', '/accounts', { token: empT, body: { employeeId: 'z', roleCode: 'EMPLOYEE', username: 'percobaan.izin' } });
  show('U3.1', 'EMPLOYEE membuat akun', 'POST /accounts (token EMPLOYEE)', e1, 403, e1.json.code === 'INSUFFICIENT_PERMISSION');
  const tl = await login('amaliyah.tl'); const tlT = tl.json.accessToken;
  const e2 = await call('PUT', `/accounts/${newId}`, { token: tlT, body: { status: 'active' } });
  show('U3.2', 'TL mengubah akun', 'PUT /accounts/{newId} (token TL)', e2, 403, e2.json.code === 'INSUFFICIENT_PERMISSION');
  const stillInactive = await call('GET', `/accounts/${newId}/role`, { token: admT });
  show('U3.3', 'Data tetap utuh setelah PUT ditolak', 'GET /accounts/{newId}/role', stillInactive, 200, stillInactive.json.status === 'inactive');
  const listEmp = await call('GET', '/accounts', { token: empT });
  const onlyActive = listEmp.json.every(a => a.status === 'active') && listEmp.json.every(a => !('email' in a) && !('username' in a));
  show('U3.4', 'EMPLOYEE melihat daftar akun (hanya active, tanpa email/username)', 'GET /accounts (token EMPLOYEE)', { status: listEmp.status, json: { jumlah: listEmp.json.length, hanyaActiveTanpaEmail: onlyActive } }, 200, onlyActive);
  const listAdm = await call('GET', '/accounts', { token: admT });
  const full = listAdm.json.some(a => a.email) && listAdm.json.some(a => a.status !== 'active');
  show('U3.5', 'ADMIN melihat daftar lengkap', 'GET /accounts (token ADMIN)', { status: listAdm.status, json: { jumlah: listAdm.json.length, lengkapDenganEmailDanSemuaStatus: full } }, 200, full);
  for (const [u, role] of [['maelani.tw', 'TW'], ['amaliyah.tl', 'TL'], ['account.manager', 'AM']]) {
    const r = await login(u);
    show(`U3.6-${role}`, `Login role baru ${role}`, `POST /auth/login (${u})`, r, 200, r.json.roleCode === role);
  }

  console.log('\n=== UJI-04 Dependensi dan token bermasalah ===');
  const nf = await call('GET', '/identity/accounts/01929b4a-0000-7000-8000-000000000000', { token: admT });
  show('U4.1', 'accountId tidak dikenal', 'GET /identity/accounts/{id-acak}', nf, 404, nf.json.code === 'ACCOUNT_NOT_FOUND');
  const junk = await call('GET', `/accounts/${newId}/role`, { token: 'token.acak.rusak' });
  show('U4.2', 'Token rusak', 'GET /accounts/{id}/role (token acak)', junk, 401, junk.json.code === 'INVALID_TOKEN');
  const expired = jwt.sign({ accountId: adm.json.account.accountId, roleCode: 'ADMIN' }, SECRET, { expiresIn: -10 });
  const exp = await call('GET', `/accounts/${newId}/role`, { token: expired });
  show('U4.3', 'Token kedaluwarsa', 'GET /accounts/{id}/role (token expired)', exp, 401, /expired/.test(exp.json.message));

  console.log(`\nRingkasan: ${failed === 0 ? 'SEMUA LULUS' : failed + ' GAGAL'}`);
  process.exit(failed ? 1 : 0);
})();
