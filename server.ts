import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const STORE_PATH = path.resolve(__dirname, '.humanis-student-portal.json');
const SESSION_SECRET =
  process.env.STUDENT_SESSION_SECRET ||
  process.env.GEMINI_API_KEY ||
  crypto.randomBytes(32).toString('hex');

const ADMIN_EMAIL = 'alamifal@smkn1sidayu.sch.id';

function loadFirebaseWebApiKey(): string {
  try {
    const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as { apiKey?: string };
      return parsed.apiKey || '';
    }
  } catch {
    // ignore
  }
  return '';
}

const FIREBASE_WEB_API_KEY = loadFirebaseWebApiKey();

app.use(express.json({ limit: '4mb' }));

// --- Persistent Store & Crypto Helpers ---

interface StaffAccountRecord {
  id: string;
  username: string;
  passwordHash: string;
  nama: string;
  nip?: string;
  email?: string;
  role: 'admin' | 'wali_kelas' | 'guru_bk' | 'kepala_sekolah';
  kelasBinaan?: string;
  aktif: boolean;
  permissions: string[];
  createdAt: string;
}

interface StudentCredentialRecord {
  studentId: string;
  username: string;
  passwordHash: string;
  aktif?: boolean;
}

interface PortalStore {
  staffAccounts: Record<string, StaffAccountRecord>;
  credentials: Record<string, StudentCredentialRecord>;
  students: Record<string, Record<string, unknown>>;
  diagnostics: Array<Record<string, unknown>>;
  humanis: Record<string, Record<string, unknown>>;
  observations: Array<Record<string, unknown>>;
  processes: Array<Record<string, unknown>>;
  goodStatements: Array<Record<string, unknown>>;
  reports: Array<Record<string, unknown>>;
  roleAssignments: Array<Record<string, unknown>>;
  themeSettings: Record<string, Record<string, unknown>>;
  pendingRegistrations: Array<{
    tempStudentId: string;
    student: Record<string, unknown>;
    createdAt: string;
  }>;
  pendingProfileUpdates: Array<{
    id: string;
    studentId: string;
    updates: Record<string, unknown>;
    createdAt: string;
  }>;
  pendingAssessments: Array<{
    id: string;
    studentId: string;
    diagnostic: Record<string, unknown>;
    statement?: Record<string, unknown>;
    createdAt: string;
  }>;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

const DEFAULT_ADMIN_PERMISSIONS = [
  'kelola_siswa',
  'tes_diagnostik',
  'tahap_humanis',
  'observasi_pembinaan',
  'ai_advisor',
  'cetak_laporan',
  'kelola_peran_tema',
];

function createEmptyStore(): PortalStore {
  return {
    staffAccounts: {},
    credentials: {},
    students: {},
    diagnostics: [],
    humanis: {},
    observations: [],
    processes: [],
    goodStatements: [],
    reports: [],
    roleAssignments: [],
    themeSettings: {},
    pendingRegistrations: [],
    pendingProfileUpdates: [],
    pendingAssessments: [],
  };
}

function loadStore(): PortalStore {
  let store = createEmptyStore();
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PortalStore>;
      store = {
        ...createEmptyStore(),
        ...parsed,
      };
    }
  } catch (err) {
    console.error('Failed to read portal store:', err);
  }

  // Ensure built-in admin account is provisioned with scrypt hash on server startup
  if (!store.staffAccounts['staff_admin']) {
    const initialPass = process.env.ADMIN_PASSCODE || 'admin123';
    store.staffAccounts['staff_admin'] = {
      id: 'staff_admin',
      username: 'admin',
      passwordHash: hashPassword(initialPass),
      nama: 'Administrator Sekolah',
      nip: 'ADMIN-01',
      email: ADMIN_EMAIL,
      role: 'admin',
      kelasBinaan: 'Semua Kelas',
      aktif: true,
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      createdAt: new Date().toISOString(),
    };
    saveStore(store);
  }

  return store;
}

function saveStore(store: PortalStore): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist portal store:', err);
  }
}

const portalStore: PortalStore = loadStore();

// --- Token Signing & Verification ---

interface SignedStaffPayload {
  type: 'staff';
  id: string;
  username: string;
  role: 'admin' | 'wali_kelas' | 'guru_bk' | 'kepala_sekolah';
  displayName: string;
  email: string;
  exp: number;
}

interface SignedStudentPayload {
  type: 'student';
  studentId: string;
  username: string;
  exp: number;
}

function signPayload(payloadObj: SignedStaffPayload | SignedStudentPayload): string {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyTokenRaw(token: string): SignedStaffPayload | SignedStudentPayload | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as
      | SignedStaffPayload
      | SignedStudentPayload;
    if (!decoded || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

function extractBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

function verifyStudentSession(req: express.Request): SignedStudentPayload | null {
  const token = extractBearerToken(req);
  if (!token) return null;
  const decoded = verifyTokenRaw(token);
  if (!decoded || decoded.type !== 'student' || !decoded.studentId) return null;
  const cred = portalStore.credentials[decoded.studentId];
  if (cred && cred.aktif === false) return null;
  return decoded;
}

function verifyStaffSession(req: express.Request): SignedStaffPayload | null {
  const token = extractBearerToken(req);
  if (!token) return null;
  const decoded = verifyTokenRaw(token);
  if (!decoded || decoded.type !== 'staff' || !decoded.id) return null;
  const localAcc = portalStore.staffAccounts[decoded.id];
  if (localAcc && !localAcc.aktif) return null;
  return decoded;
}

function requireStaff(req: express.Request, res: express.Response): SignedStaffPayload | null {
  const staff = verifyStaffSession(req);
  if (!staff) {
    res.status(401).json({ error: 'Akses ditolak. Silakan login sebagai Admin atau Staf sekolah.' });
    return null;
  }
  return staff;
}

function requireAdmin(req: express.Request, res: express.Response): SignedStaffPayload | null {
  const staff = requireStaff(req, res);
  if (!staff) return null;
  if (staff.role !== 'admin') {
    res.status(403).json({ error: 'Hanya Admin / Operator yang diizinkan mengelola akun terdaftar.' });
    return null;
  }
  return staff;
}

// --- Helpers ---

function computeCategory(score: number): string {
  if (score < 35) return 'Sangat Rendah';
  if (score < 55) return 'Rendah';
  if (score < 70) return 'Sedang';
  if (score < 85) return 'Baik';
  return 'Sangat Baik';
}

function buildPortalData(studentId: string) {
  const student = portalStore.students[studentId];
  if (!student) return null;
  const diagnostics = portalStore.diagnostics
    .filter((d) => d.studentId === studentId)
    .sort((a, b) => String(b.assessedDate || '').localeCompare(String(a.assessedDate || '')));
  const observations = portalStore.observations
    .filter((o) => o.studentId === studentId)
    .sort((a, b) => String(a.tanggal || '').localeCompare(String(b.tanggal || '')));
  const processes = portalStore.processes
    .filter((p) => p.studentId === studentId)
    .sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
  const goodStatements = portalStore.goodStatements
    .filter((g) => g.studentId === studentId)
    .sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
  const humanis = portalStore.humanis[studentId] || null;

  return {
    student,
    diagnostics,
    humanis,
    observations,
    processes,
    goodStatements,
  };
}

function findStudentCredentialByUsername(usernameInput: string): StudentCredentialRecord | null {
  const target = usernameInput.trim().toLowerCase();
  if (!target) return null;
  for (const cred of Object.values(portalStore.credentials)) {
    if (cred.username.toLowerCase() === target) {
      return cred;
    }
  }
  return null;
}

function isStudentUsernameTaken(username: string, excludeStudentId?: string): boolean {
  const target = username.trim().toLowerCase();
  return Object.values(portalStore.credentials).some(
    (c) => c.username.toLowerCase() === target && c.studentId !== excludeStudentId
  );
}

function isStaffUsernameTaken(username: string, excludeStaffId?: string): boolean {
  const target = username.trim().toLowerCase();
  return Object.values(portalStore.staffAccounts).some(
    (s) => s.username.toLowerCase() === target && s.id !== excludeStaffId
  );
}

function sanitizeStaffSummary(acc: StaffAccountRecord) {
  return {
    id: acc.id,
    username: acc.username,
    nama: acc.nama,
    nip: acc.nip || '',
    email: acc.email || '',
    role: acc.role,
    kelasBinaan: acc.kelasBinaan || '',
    aktif: acc.aktif,
    permissions: acc.permissions,
    createdAt: acc.createdAt,
  };
}

function getAllStudentAccountSummaries() {
  return Object.values(portalStore.students).map((s) => {
    const sid = String(s.id || '');
    const cred = portalStore.credentials[sid];
    return {
      studentId: sid,
      nisn: String(s.nisn || ''),
      namaLengkap: String(s.namaLengkap || ''),
      kelas: String(s.kelas || ''),
      jurusan: String(s.jurusan || ''),
      username: cred?.username || String(s.portalUsername || s.nisn || ''),
      aktif: cred ? cred.aktif !== false : true,
    };
  });
}

// --- Gemini Client ---

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi pada environment server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'humanis-smk-api' });
});

// ============================================================
// STAFF & ADMIN AUTHENTICATION + ACCOUNT MANAGEMENT ENDPOINTS
// ============================================================

// 1. Login Admin / Staf via Username (or NIP/Email) + Password
app.post('/api/staff/login', (req, res) => {
  const { username, password } = req.body || {};
  const identifier = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  if (!identifier || !cleanPass) {
    res.status(400).json({ error: 'Username / NIP dan password wajib diisi.' });
    return;
  }

  const matched = Object.values(portalStore.staffAccounts).find(
    (acc) =>
      acc.username.toLowerCase() === identifier ||
      (acc.nip && acc.nip.toLowerCase() === identifier) ||
      (acc.email && acc.email.toLowerCase() === identifier)
  );

  if (!matched) {
    res.status(401).json({
      error: 'Akun staf atau admin tidak ditemukan. Periksa kembali username/NIP Anda.',
    });
    return;
  }

  if (!matched.aktif) {
    res.status(403).json({
      error: 'Akun Anda sedang dinonaktifkan oleh Admin sekolah.',
    });
    return;
  }

  // Allow process.env.ADMIN_PASSCODE override for built-in admin if configured
  const envAdminPass = process.env.ADMIN_PASSCODE;
  let passOk = verifyPassword(cleanPass, matched.passwordHash);
  if (matched.username === 'admin' && envAdminPass) {
    const aBuf = Buffer.from(cleanPass);
    const bBuf = Buffer.from(envAdminPass);
    passOk = aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
  }

  if (!passOk) {
    res.status(401).json({ error: 'Password tidak sesuai.' });
    return;
  }

  const token = signPayload({
    type: 'staff',
    id: matched.id,
    username: matched.username,
    role: matched.role,
    displayName: matched.nama,
    email: matched.email || `${matched.username}@smkn1sidayu.sch.id`,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });

  res.json({
    token,
    user: {
      id: matched.id,
      username: matched.username,
      displayName: matched.nama,
      email: matched.email || `${matched.username}@smkn1sidayu.sch.id`,
      nip: matched.nip || '',
      staffRole: matched.role,
    },
  });
});

// 2. Exchange Firebase Google ID Token for Server Staff Bearer Token
app.post('/api/staff/firebase-exchange', async (req, res) => {
  const { idToken, preferredRole } = req.body || {};
  if (!idToken || typeof idToken !== 'string' || !FIREBASE_WEB_API_KEY) {
    res.status(400).json({ error: 'Token Firebase tidak valid.' });
    return;
  }

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!verifyRes.ok) {
      res.status(401).json({ error: 'Verifikasi Firebase ID Token gagal.' });
      return;
    }
    const verifyData = (await verifyRes.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
      }>;
    };
    const fbUser = verifyData.users?.[0];
    if (!fbUser || !fbUser.email || !fbUser.emailVerified) {
      res.status(401).json({ error: 'Email akun Google belum terverifikasi.' });
      return;
    }

    const emailLower = fbUser.email.toLowerCase();
    const regAcc = Object.values(portalStore.staffAccounts).find(
      (a) => a.email && a.email.toLowerCase() === emailLower
    );
    if (regAcc && !regAcc.aktif) {
      res.status(403).json({ error: 'Akun staf sedang dinonaktifkan oleh Admin.' });
      return;
    }

    const allowedRoles = ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'] as const;
    const reqRole = allowedRoles.includes(preferredRole) ? preferredRole : 'wali_kelas';
    const resolvedRole: StaffAccountRecord['role'] =
      emailLower === ADMIN_EMAIL
        ? reqRole === 'admin' || !preferredRole
          ? 'admin'
          : reqRole
        : regAcc
          ? regAcc.role
          : reqRole === 'admin'
            ? 'wali_kelas'
            : reqRole;

    const token = signPayload({
      type: 'staff',
      id: fbUser.localId,
      username: emailLower,
      role: resolvedRole,
      displayName: fbUser.displayName || 'Pendidik SMK',
      email: fbUser.email,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    res.json({ token, staffRole: resolvedRole });
  } catch (err) {
    console.error('Firebase token exchange failed:', err);
    res.status(500).json({ error: 'Gagal memverifikasi sesi Google.' });
  }
});

// 3. Admin: List All Registered Accounts (Staff + Students)
app.get('/api/staff/accounts', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const staffAccounts = Object.values(portalStore.staffAccounts).map(sanitizeStaffSummary);
  const studentAccounts = getAllStudentAccountSummaries();
  res.json({ staffAccounts, studentAccounts });
});

// 4. Admin: Create Registered Staff Account
app.post('/api/staff/accounts/staff', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { username, password, nama, nip, email, role, kelasBinaan, aktif, permissions } =
    req.body || {};

  const cleanUsername = String(username || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .slice(0, 60);
  const cleanPassword = String(password || '');
  const cleanNama = String(nama || '').trim().slice(0, 120);
  const allowedRoles = ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'] as const;
  const cleanRole = allowedRoles.includes(role) ? role : 'wali_kelas';

  if (cleanUsername.length < 3) {
    res.status(400).json({ error: 'Username staf minimal 3 karakter.' });
    return;
  }
  if (cleanPassword.length < 4) {
    res.status(400).json({ error: 'Password staf minimal 4 karakter.' });
    return;
  }
  if (cleanNama.length < 2) {
    res.status(400).json({ error: 'Nama lengkap staf wajib diisi.' });
    return;
  }
  if (isStaffUsernameTaken(cleanUsername)) {
    res.status(409).json({ error: `Username "${cleanUsername}" sudah terdaftar.` });
    return;
  }

  const id = `staff_${crypto.randomBytes(6).toString('hex')}`;
  const record: StaffAccountRecord = {
    id,
    username: cleanUsername,
    passwordHash: hashPassword(cleanPassword),
    nama: cleanNama,
    nip: String(nip || '').trim().slice(0, 40),
    email: String(email || '').trim().slice(0, 180),
    role: cleanRole,
    kelasBinaan: String(kelasBinaan || '').trim().slice(0, 40),
    aktif: aktif !== false,
    permissions: Array.isArray(permissions)
      ? permissions.slice(0, 12).map((p) => String(p).slice(0, 80))
      : DEFAULT_ADMIN_PERMISSIONS,
    createdAt: new Date().toISOString(),
  };

  portalStore.staffAccounts[id] = record;
  saveStore(portalStore);
  res.status(201).json({ account: sanitizeStaffSummary(record) });
});

// 5. Admin: Update Registered Staff Account (Role, Active Status, Password Reset, Info)
app.put('/api/staff/accounts/staff/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id || '');
  const existing = portalStore.staffAccounts[id];
  if (!existing) {
    res.status(404).json({ error: 'Akun staf tidak ditemukan.' });
    return;
  }

  const { username, newPassword, nama, nip, email, role, kelasBinaan, aktif, permissions } =
    req.body || {};

  if (username !== undefined) {
    const nextUsername = String(username)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '.')
      .slice(0, 60);
    if (nextUsername.length < 3) {
      res.status(400).json({ error: 'Username minimal 3 karakter.' });
      return;
    }
    if (existing.id === 'staff_admin' && nextUsername !== 'admin') {
      res.status(400).json({ error: 'Username utama "admin" tidak dapat diubah.' });
      return;
    }
    if (isStaffUsernameTaken(nextUsername, id)) {
      res.status(409).json({ error: `Username "${nextUsername}" sudah digunakan.` });
      return;
    }
    existing.username = nextUsername;
  }

  if (newPassword !== undefined && String(newPassword).length > 0) {
    if (String(newPassword).length < 4) {
      res.status(400).json({ error: 'Password baru minimal 4 karakter.' });
      return;
    }
    existing.passwordHash = hashPassword(String(newPassword));
  }

  if (nama !== undefined && String(nama).trim().length >= 2) {
    existing.nama = String(nama).trim().slice(0, 120);
  }
  if (nip !== undefined) existing.nip = String(nip).trim().slice(0, 40);
  if (email !== undefined) existing.email = String(email).trim().slice(0, 180);
  if (kelasBinaan !== undefined) existing.kelasBinaan = String(kelasBinaan).trim().slice(0, 40);

  const allowedRoles = ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'] as const;
  if (role !== undefined && allowedRoles.includes(role)) {
    if (existing.id === 'staff_admin' && role !== 'admin') {
      res.status(400).json({ error: 'Peran admin utama harus tetap Admin / Operator.' });
      return;
    }
    existing.role = role;
  }

  if (aktif !== undefined) {
    if (existing.id === 'staff_admin' && !aktif) {
      res.status(400).json({ error: 'Akun admin utama tidak dapat dinonaktifkan.' });
      return;
    }
    existing.aktif = Boolean(aktif);
  }

  if (Array.isArray(permissions)) {
    existing.permissions = permissions.slice(0, 12).map((p) => String(p).slice(0, 80));
  }

  saveStore(portalStore);
  res.json({ account: sanitizeStaffSummary(existing) });
});

// 6. Admin: Delete Registered Staff Account
app.delete('/api/staff/accounts/staff/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = String(req.params.id || '');
  if (id === 'staff_admin') {
    res.status(400).json({ error: 'Akun admin utama tidak dapat dihapus.' });
    return;
  }
  if (!portalStore.staffAccounts[id]) {
    res.status(404).json({ error: 'Akun staf tidak ditemukan.' });
    return;
  }
  delete portalStore.staffAccounts[id];
  saveStore(portalStore);
  res.json({ ok: true });
});

// 7. Admin: Create Registered Student Account
app.post('/api/staff/accounts/student', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { nisn, namaLengkap, jenisKelamin, kelas, jurusan, username, password, aktif } =
    req.body || {};

  const cleanNisn = String(nisn || '').trim().slice(0, 20);
  const cleanName = String(namaLengkap || '').trim().slice(0, 120);
  const cleanKelas = String(kelas || '').trim().slice(0, 40);
  const cleanJurusan = String(jurusan || '').trim().slice(0, 80);
  const cleanUsername = String(username || cleanNisn)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .slice(0, 60);
  const cleanPassword = String(password || 'smk12345');

  if (cleanNisn.length < 4 || cleanName.length < 2 || cleanKelas.length < 2 || cleanJurusan.length < 2) {
    res.status(400).json({ error: 'NISN, Nama Lengkap, Kelas, dan Jurusan wajib diisi.' });
    return;
  }
  if (cleanUsername.length < 3 || cleanPassword.length < 4) {
    res.status(400).json({ error: 'Username (min 3) dan password (min 4) wajib valid.' });
    return;
  }
  if (isStudentUsernameTaken(cleanUsername)) {
    res.status(409).json({ error: `Username siswa "${cleanUsername}" sudah digunakan.` });
    return;
  }

  const sid = `stu_${crypto.randomBytes(8).toString('hex')}`;
  const studentRecord: Record<string, unknown> = {
    id: sid,
    ownerId: 'staff_admin',
    nisn: cleanNisn,
    namaLengkap: cleanName,
    jenisKelamin: jenisKelamin === 'P' ? 'P' : 'L',
    kelas: cleanKelas,
    jurusan: cleanJurusan,
    portalUsername: cleanUsername,
    latestScore: 0,
    latestCategory: 'Sedang',
    latestCondition: 'cukup',
  };

  portalStore.students[sid] = studentRecord;
  portalStore.credentials[sid] = {
    studentId: sid,
    username: cleanUsername,
    passwordHash: hashPassword(cleanPassword),
    aktif: aktif !== false,
  };
  portalStore.pendingRegistrations.push({
    tempStudentId: sid,
    student: studentRecord,
    createdAt: new Date().toISOString(),
  });
  saveStore(portalStore);

  res.status(201).json({
    account: {
      studentId: sid,
      nisn: cleanNisn,
      namaLengkap: cleanName,
      kelas: cleanKelas,
      jurusan: cleanJurusan,
      username: cleanUsername,
      aktif: aktif !== false,
    },
  });
});

// 8. Admin: Update Registered Student Account (Username, Password Reset, Active Status, Info)
app.put('/api/staff/accounts/student/:studentId', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const studentId = String(req.params.studentId || '');
  const student = portalStore.students[studentId];
  if (!student) {
    res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
    return;
  }

  const { username, newPassword, aktif, namaLengkap, kelas, jurusan } = req.body || {};
  let cred = portalStore.credentials[studentId];
  if (!cred) {
    cred = {
      studentId,
      username: String(student.portalUsername || student.nisn || studentId).toLowerCase(),
      passwordHash: hashPassword('smk12345'),
      aktif: true,
    };
    portalStore.credentials[studentId] = cred;
  }

  if (username !== undefined) {
    const nextUser = String(username).trim().toLowerCase().replace(/\s+/g, '.').slice(0, 60);
    if (nextUser.length < 3) {
      res.status(400).json({ error: 'Username siswa minimal 3 karakter.' });
      return;
    }
    if (isStudentUsernameTaken(nextUser, studentId)) {
      res.status(409).json({ error: `Username "${nextUser}" sudah dipakai siswa lain.` });
      return;
    }
    cred.username = nextUser;
    student.portalUsername = nextUser;
  }

  if (newPassword !== undefined && String(newPassword).length > 0) {
    if (String(newPassword).length < 4) {
      res.status(400).json({ error: 'Password baru siswa minimal 4 karakter.' });
      return;
    }
    cred.passwordHash = hashPassword(String(newPassword));
  }

  if (aktif !== undefined) {
    cred.aktif = Boolean(aktif);
  }
  if (namaLengkap !== undefined && String(namaLengkap).trim().length >= 2) {
    student.namaLengkap = String(namaLengkap).trim().slice(0, 120);
  }
  if (kelas !== undefined && String(kelas).trim().length >= 2) {
    student.kelas = String(kelas).trim().slice(0, 40);
  }
  if (jurusan !== undefined && String(jurusan).trim().length >= 2) {
    student.jurusan = String(jurusan).trim().slice(0, 80);
  }

  saveStore(portalStore);
  res.json({
    account: {
      studentId,
      nisn: String(student.nisn || ''),
      namaLengkap: String(student.namaLengkap || ''),
      kelas: String(student.kelas || ''),
      jurusan: String(student.jurusan || ''),
      username: cred.username,
      aktif: cred.aktif !== false,
    },
  });
});

// 9. Admin: Delete Registered Student Account
app.delete('/api/staff/accounts/student/:studentId', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const studentId = String(req.params.studentId || '');
  if (!portalStore.students[studentId] && !portalStore.credentials[studentId]) {
    res.status(404).json({ error: 'Akun siswa tidak ditemukan.' });
    return;
  }
  delete portalStore.credentials[studentId];
  delete portalStore.students[studentId];
  saveStore(portalStore);
  res.json({ ok: true });
});

// ============================================================
// STAFF WORKSPACE ENDPOINTS (Supports Admin / Staff Local Login)
// ============================================================

app.get('/api/staff/workspace', (req, res) => {
  const staff = requireStaff(req, res);
  if (!staff) return;

  res.json({
    students: Object.values(portalStore.students),
    diagnostics: portalStore.diagnostics,
    humanisList: Object.values(portalStore.humanis),
    observations: portalStore.observations,
    processes: portalStore.processes,
    goodStatements: portalStore.goodStatements,
    reports: portalStore.reports,
    roleAssignments: portalStore.roleAssignments,
    theme: portalStore.themeSettings[staff.id] || portalStore.themeSettings['staff_admin'] || null,
  });
});

app.post('/api/staff/workspace/mutate', (req, res) => {
  const staff = requireStaff(req, res);
  if (!staff) return;

  const { action, id, payload } = req.body || {};
  const now = new Date().toISOString();

  switch (action) {
    case 'createStudent': {
      const sid = `stu_${crypto.randomBytes(8).toString('hex')}`;
      const uname = String(payload?.portalUsername || payload?.nisn || sid)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '.')
        .slice(0, 60);
      portalStore.students[sid] = {
        id: sid,
        ownerId: staff.id,
        ...payload,
        portalUsername: uname,
        createdAt: now,
        updatedAt: now,
      };
      if (!portalStore.credentials[sid]) {
        portalStore.credentials[sid] = {
          studentId: sid,
          username: uname,
          passwordHash: hashPassword('smk12345'),
          aktif: true,
        };
      }
      saveStore(portalStore);
      res.json({ id: sid });
      return;
    }
    case 'updateStudent': {
      if (id && portalStore.students[id]) {
        portalStore.students[id] = { ...portalStore.students[id], ...payload, updatedAt: now };
        saveStore(portalStore);
      }
      res.json({ ok: true });
      return;
    }
    case 'deleteStudent': {
      if (id) {
        delete portalStore.students[id];
        delete portalStore.credentials[id];
        saveStore(portalStore);
      }
      res.json({ ok: true });
      return;
    }
    case 'saveDiagnostic': {
      const diagId = `diag_${crypto.randomBytes(6).toString('hex')}`;
      portalStore.diagnostics.push({ id: diagId, ownerId: staff.id, ...payload, createdAt: now });
      if (payload?.studentId && portalStore.students[payload.studentId]) {
        portalStore.students[payload.studentId].latestScore = payload.totalScore;
        portalStore.students[payload.studentId].latestCategory = payload.category;
      }
      saveStore(portalStore);
      res.json({ id: diagId });
      return;
    }
    case 'saveHumanis': {
      const docId = id || `hum_${payload?.studentId}`;
      portalStore.humanis[payload?.studentId] = {
        id: docId,
        ownerId: staff.id,
        ...payload,
        updatedAt: now,
      };
      saveStore(portalStore);
      res.json({ ok: true });
      return;
    }
    case 'saveObservation': {
      const obsId = `obs_${crypto.randomBytes(6).toString('hex')}`;
      portalStore.observations.push({ id: obsId, ownerId: staff.id, ...payload, createdAt: now });
      if (payload?.studentId && portalStore.students[payload.studentId]) {
        portalStore.students[payload.studentId].latestCondition = payload.tingkatKemandirian;
      }
      saveStore(portalStore);
      res.json({ id: obsId });
      return;
    }
    case 'saveProcess': {
      const procId = `proc_${crypto.randomBytes(6).toString('hex')}`;
      portalStore.processes.push({ id: procId, ownerId: staff.id, ...payload, createdAt: now });
      saveStore(portalStore);
      res.json({ id: procId });
      return;
    }
    case 'deleteProcess': {
      portalStore.processes = portalStore.processes.filter((p) => p.id !== id);
      saveStore(portalStore);
      res.json({ ok: true });
      return;
    }
    case 'saveGoodStatement': {
      const stmtId = `stmt_${crypto.randomBytes(6).toString('hex')}`;
      portalStore.goodStatements.push({ id: stmtId, ownerId: staff.id, ...payload, createdAt: now });
      saveStore(portalStore);
      res.json({ id: stmtId });
      return;
    }
    case 'deleteGoodStatement': {
      portalStore.goodStatements = portalStore.goodStatements.filter((g) => g.id !== id);
      saveStore(portalStore);
      res.json({ ok: true });
      return;
    }
    case 'saveReport': {
      const repId = `rep_${crypto.randomBytes(6).toString('hex')}`;
      portalStore.reports.push({ id: repId, ownerId: staff.id, ...payload, createdAt: now });
      saveStore(portalStore);
      res.json({ id: repId });
      return;
    }
    case 'saveTheme': {
      portalStore.themeSettings[staff.id] = { userId: staff.id, ...payload, updatedAt: now };
      saveStore(portalStore);
      res.json({ ok: true });
      return;
    }
    case 'createRoleAssignment': {
      const raId = `ra_${crypto.randomBytes(6).toString('hex')}`;
      portalStore.roleAssignments.push({
        id: raId,
        ownerId: staff.id,
        ...payload,
        createdAt: now,
        updatedAt: now,
      });
      saveStore(portalStore);
      res.json({ id: raId });
      return;
    }
    case 'updateRoleAssignment': {
      portalStore.roleAssignments = portalStore.roleAssignments.map((r) =>
        r.id === id ? { ...r, ...payload, updatedAt: now } : r
      );
      saveStore(portalStore);
      res.json({ ok: true });
      return;
    }
    case 'deleteRoleAssignment': {
      portalStore.roleAssignments = portalStore.roleAssignments.filter((r) => r.id !== id);
      saveStore(portalStore);
      res.json({ ok: true });
      return;
    }
    default:
      res.status(400).json({ error: 'Aksi mutasi tidak dikenal.' });
  }
});

// ============================================================
// STUDENT AUTH & PORTAL ENDPOINTS
// ============================================================

// 1. Login Siswa (Username & Password)
app.post('/api/student/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  if (!cleanUser || !cleanPass) {
    res.status(400).json({ error: 'Username dan password wajib diisi.' });
    return;
  }

  const cred = findStudentCredentialByUsername(cleanUser);
  if (!cred || !verifyPassword(cleanPass, cred.passwordHash)) {
    res.status(401).json({
      error:
        'Username atau password siswa tidak cocok. Gunakan username (default NISN) dari Wali Kelas atau daftarkan akun siswa baru.',
    });
    return;
  }

  if (cred.aktif === false) {
    res.status(403).json({
      error: 'Akun siswa ini sedang dinonaktifkan oleh Admin sekolah.',
    });
    return;
  }

  const portal = buildPortalData(cred.studentId);
  if (!portal) {
    res.status(404).json({ error: 'Data biodata siswa belum ditemukan di sistem.' });
    return;
  }

  const token = signPayload({
    type: 'student',
    studentId: cred.studentId,
    username: cred.username,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });

  res.json({
    token,
    username: cred.username,
    studentId: cred.studentId,
    portal,
  });
});

// 2. Registrasi / Aktivasi Akun Siswa Baru
app.post('/api/student/register', (req, res) => {
  const {
    nisn,
    namaLengkap,
    jenisKelamin,
    kelas,
    jurusan,
    username,
    password,
    noHp,
    namaOrangTua,
    nomorOrangTua,
    alamat,
  } = req.body || {};

  const cleanNisn = String(nisn || '').trim().slice(0, 20);
  const cleanName = String(namaLengkap || '').trim().slice(0, 120);
  const cleanKelas = String(kelas || '').trim().slice(0, 40);
  const cleanJurusan = String(jurusan || '').trim().slice(0, 80);
  const cleanUsername = String(username || cleanNisn)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .slice(0, 60);
  const cleanPassword = String(password || '');

  if (cleanNisn.length < 4 || cleanName.length < 2) {
    res.status(400).json({ error: 'NISN (minimal 4 karakter) dan Nama Lengkap wajib diisi.' });
    return;
  }
  if (cleanKelas.length < 2 || cleanJurusan.length < 2) {
    res.status(400).json({ error: 'Kelas dan Jurusan wajib diisi.' });
    return;
  }
  if (cleanUsername.length < 3) {
    res.status(400).json({ error: 'Username minimal 3 karakter.' });
    return;
  }
  if (cleanPassword.length < 4) {
    res.status(400).json({ error: 'Password minimal 4 karakter.' });
    return;
  }
  if (isStudentUsernameTaken(cleanUsername)) {
    res.status(409).json({ error: 'Username sudah dipakai siswa lain. Pilih username berbeda.' });
    return;
  }

  const duplicateNisn = Object.values(portalStore.students).find(
    (s) => String(s.nisn || '').trim() === cleanNisn
  );
  if (duplicateNisn) {
    res.status(409).json({
      error:
        'NISN sudah terdaftar di sistem sekolah. Silakan masuk menggunakan username (NISN Anda) dan password dari sekolah.',
    });
    return;
  }

  const tempStudentId = `stu_${crypto.randomBytes(8).toString('hex')}`;
  const studentRecord: Record<string, unknown> = {
    id: tempStudentId,
    ownerId: 'pending_staff_sync',
    nisn: cleanNisn,
    namaLengkap: cleanName,
    jenisKelamin: jenisKelamin === 'P' ? 'P' : 'L',
    kelas: cleanKelas,
    jurusan: cleanJurusan,
    noHp: String(noHp || '').trim().slice(0, 30),
    namaOrangTua: String(namaOrangTua || '').trim().slice(0, 120),
    nomorOrangTua: String(nomorOrangTua || '').trim().slice(0, 30),
    alamat: String(alamat || '').trim().slice(0, 300),
    portalUsername: cleanUsername,
    latestScore: 0,
    latestCategory: 'Sedang',
    latestCondition: 'cukup',
  };

  portalStore.students[tempStudentId] = studentRecord;
  portalStore.credentials[tempStudentId] = {
    studentId: tempStudentId,
    username: cleanUsername,
    passwordHash: hashPassword(cleanPassword),
    aktif: true,
  };
  portalStore.pendingRegistrations.push({
    tempStudentId,
    student: studentRecord,
    createdAt: new Date().toISOString(),
  });
  saveStore(portalStore);

  const token = signPayload({
    type: 'student',
    studentId: tempStudentId,
    username: cleanUsername,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });

  res.status(201).json({
    token,
    username: cleanUsername,
    studentId: tempStudentId,
    portal: buildPortalData(tempStudentId),
  });
});

// 3. Get Authenticated Student Portal Data
app.get('/api/student/portal', (req, res) => {
  const authSession = verifyStudentSession(req);
  if (!authSession) {
    res.status(401).json({ error: 'Sesi siswa berakhir. Silakan login kembali.' });
    return;
  }

  const portal = buildPortalData(authSession.studentId);
  if (!portal) {
    res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
    return;
  }
  res.json(portal);
});

// 4. Submit Penilaian Mandiri Siswa
app.post('/api/student/assessment', (req, res) => {
  const authSession = verifyStudentSession(req);
  if (!authSession) {
    res.status(401).json({ error: 'Sesi siswa berakhir. Silakan login kembali.' });
    return;
  }

  const student = portalStore.students[authSession.studentId];
  if (!student) {
    res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
    return;
  }

  const clampLikert = (val: unknown) => Math.min(5, Math.max(1, Number(val) || 3));
  const tanggungJawab = clampLikert(req.body?.tanggungJawab);
  const disiplin = clampLikert(req.body?.disiplin);
  const inisiatif = clampLikert(req.body?.inisiatif);
  const pengambilanKeputusan = clampLikert(req.body?.pengambilanKeputusan);
  const manajemenDiri = clampLikert(req.body?.manajemenDiri);

  const totalScore = Math.round(
    ((tanggungJawab + disiplin + inisiatif + pengambilanKeputusan + manajemenDiri) / 25) * 100
  );
  const category = computeCategory(totalScore);
  const today = new Date().toISOString().slice(0, 10);
  const rawNotes = String(req.body?.notes || '').trim();
  const notes = rawNotes
    ? `[Penilaian Mandiri Siswa] ${rawNotes}`.slice(0, 500)
    : '[Penilaian Mandiri Siswa] Asesmen refleksi kemandirian diisi langsung oleh siswa.';

  const diagId = `diag_stu_${crypto.randomBytes(6).toString('hex')}`;
  const diagnosticRecord: Record<string, unknown> = {
    id: diagId,
    ownerId: student.ownerId || 'pending_staff_sync',
    studentId: authSession.studentId,
    studentName: String(student.namaLengkap || ''),
    kelas: String(student.kelas || ''),
    tanggungJawab,
    disiplin,
    inisiatif,
    pengambilanKeputusan,
    manajemenDiri,
    totalScore,
    category,
    assessedDate: today,
    notes,
  };

  portalStore.diagnostics.push(diagnosticRecord);
  student.latestScore = totalScore;
  student.latestCategory = category;

  const rawStatement = String(req.body?.pernyataanBaik || '').trim().slice(0, 400);
  let statementRecord: Record<string, unknown> | undefined;
  if (rawStatement.length >= 3) {
    statementRecord = {
      id: `stmt_stu_${crypto.randomBytes(6).toString('hex')}`,
      ownerId: student.ownerId || 'pending_staff_sync',
      studentId: authSession.studentId,
      studentName: String(student.namaLengkap || ''),
      kelas: String(student.kelas || ''),
      kalimat: rawStatement,
      sumber: 'manual',
      tanggal: today,
    };
    portalStore.goodStatements.push(statementRecord);
  }

  portalStore.pendingAssessments.push({
    id: `pa_${crypto.randomBytes(6).toString('hex')}`,
    studentId: authSession.studentId,
    diagnostic: diagnosticRecord,
    statement: statementRecord,
    createdAt: new Date().toISOString(),
  });

  saveStore(portalStore);
  res.json(buildPortalData(authSession.studentId));
});

// 5. Perbarui Biodata Siswa (oleh Siswa Sendiri)
app.put('/api/student/profile', (req, res) => {
  const authSession = verifyStudentSession(req);
  if (!authSession) {
    res.status(401).json({ error: 'Sesi siswa berakhir. Silakan login kembali.' });
    return;
  }

  const student = portalStore.students[authSession.studentId];
  const cred = portalStore.credentials[authSession.studentId];
  if (!student || !cred) {
    res.status(404).json({ error: 'Data akun siswa tidak ditemukan.' });
    return;
  }

  const {
    namaLengkap,
    jenisKelamin,
    kelas,
    jurusan,
    noHp,
    namaOrangTua,
    nomorOrangTua,
    alamat,
    portalUsername,
    newPassword,
  } = req.body || {};

  const cleanName = String(namaLengkap ?? student.namaLengkap ?? '').trim().slice(0, 120);
  if (cleanName.length < 2) {
    res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
    return;
  }

  const nextUsername = String(portalUsername ?? cred.username)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .slice(0, 60);

  if (nextUsername.length < 3) {
    res.status(400).json({ error: 'Username minimal 3 karakter.' });
    return;
  }
  if (isStudentUsernameTaken(nextUsername, authSession.studentId)) {
    res.status(409).json({ error: 'Username sudah digunakan oleh siswa lain.' });
    return;
  }

  if (newPassword !== undefined && String(newPassword).length > 0) {
    if (String(newPassword).length < 4) {
      res.status(400).json({ error: 'Password baru minimal 4 karakter.' });
      return;
    }
    cred.passwordHash = hashPassword(String(newPassword));
  }
  cred.username = nextUsername;

  const updates: Record<string, unknown> = {
    namaLengkap: cleanName,
    jenisKelamin: jenisKelamin === 'P' ? 'P' : 'L',
    kelas: String(kelas ?? student.kelas ?? '').trim().slice(0, 40) || student.kelas,
    jurusan: String(jurusan ?? student.jurusan ?? '').trim().slice(0, 80) || student.jurusan,
    noHp: String(noHp ?? student.noHp ?? '').trim().slice(0, 30),
    namaOrangTua: String(namaOrangTua ?? student.namaOrangTua ?? '').trim().slice(0, 120),
    nomorOrangTua: String(nomorOrangTua ?? student.nomorOrangTua ?? '').trim().slice(0, 30),
    alamat: String(alamat ?? student.alamat ?? '').trim().slice(0, 300),
    portalUsername: nextUsername,
  };

  Object.assign(student, updates);
  portalStore.pendingProfileUpdates.push({
    id: `pp_${crypto.randomBytes(6).toString('hex')}`,
    studentId: authSession.studentId,
    updates,
    createdAt: new Date().toISOString(),
  });
  saveStore(portalStore);

  const refreshedToken = signPayload({
    type: 'student',
    studentId: authSession.studentId,
    username: nextUsername,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });

  res.json({
    token: refreshedToken,
    username: nextUsername,
    portal: buildPortalData(authSession.studentId),
  });
});

// 6. Staff: Set/Reset Student Portal Credentials
app.post('/api/student/set-credentials', (req, res) => {
  if (!requireStaff(req, res)) return;
  const { studentId, username, password, student } = req.body || {};
  const cleanId = String(studentId || '').trim();
  if (!cleanId) {
    res.status(400).json({ error: 'studentId wajib disertakan.' });
    return;
  }

  const existingStudent = portalStore.students[cleanId] || {};
  const mergedStudent = student ? { ...existingStudent, ...student, id: cleanId } : existingStudent;
  const targetUsername = String(
    username || mergedStudent.portalUsername || mergedStudent.nisn || cleanId
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .slice(0, 60);

  if (targetUsername.length < 3) {
    res.status(400).json({ error: 'Username siswa minimal 3 karakter.' });
    return;
  }
  if (isStudentUsernameTaken(targetUsername, cleanId)) {
    res.status(409).json({ error: `Username "${targetUsername}" sudah digunakan siswa lain.` });
    return;
  }

  mergedStudent.portalUsername = targetUsername;
  portalStore.students[cleanId] = mergedStudent;

  const existingCred = portalStore.credentials[cleanId];
  const cleanPassword = String(password || '');
  if (cleanPassword.length > 0 && cleanPassword.length < 4) {
    res.status(400).json({ error: 'Password siswa minimal 4 karakter.' });
    return;
  }

  portalStore.credentials[cleanId] = {
    studentId: cleanId,
    username: targetUsername,
    passwordHash:
      cleanPassword.length >= 4
        ? hashPassword(cleanPassword)
        : existingCred?.passwordHash || hashPassword('smk12345'),
    aktif: existingCred?.aktif !== false,
  };

  saveStore(portalStore);
  res.json({ ok: true, username: targetUsername });
});

// 7. Staff: Pull Pending Student Registrations / Biodata Edits / Self-Assessments
app.get('/api/student/pending-updates', (req, res) => {
  if (!requireStaff(req, res)) return;
  res.json({
    pendingRegistrations: portalStore.pendingRegistrations,
    pendingProfileUpdates: portalStore.pendingProfileUpdates,
    pendingAssessments: portalStore.pendingAssessments,
  });
});

// 8. Staff: Acknowledge Pending Updates & Remap Temp Student IDs to Firestore IDs
app.post('/api/student/ack-pending', (req, res) => {
  if (!requireStaff(req, res)) return;
  const {
    remappedIds = [],
    processedProfileUpdateIds = [],
    processedAssessmentIds = [],
  } = (req.body || {}) as {
    remappedIds?: Array<{ tempStudentId: string; firestoreId: string }>;
    processedProfileUpdateIds?: string[];
    processedAssessmentIds?: string[];
  };

  for (const mapping of remappedIds) {
    const { tempStudentId, firestoreId } = mapping;
    if (!tempStudentId || !firestoreId) continue;

    if (portalStore.students[tempStudentId]) {
      const stu = portalStore.students[tempStudentId];
      stu.id = firestoreId;
      portalStore.students[firestoreId] = stu;
      delete portalStore.students[tempStudentId];
    }
    if (portalStore.credentials[tempStudentId]) {
      const cred = portalStore.credentials[tempStudentId];
      cred.studentId = firestoreId;
      portalStore.credentials[firestoreId] = cred;
      delete portalStore.credentials[tempStudentId];
    }
    for (const d of portalStore.diagnostics) {
      if (d.studentId === tempStudentId) d.studentId = firestoreId;
    }
    for (const s of portalStore.goodStatements) {
      if (s.studentId === tempStudentId) s.studentId = firestoreId;
    }
    for (const pa of portalStore.pendingAssessments) {
      if (pa.studentId === tempStudentId) {
        pa.studentId = firestoreId;
        pa.diagnostic.studentId = firestoreId;
        if (pa.statement) pa.statement.studentId = firestoreId;
      }
    }
    for (const pp of portalStore.pendingProfileUpdates) {
      if (pp.studentId === tempStudentId) pp.studentId = firestoreId;
    }
  }

  const regTemps = new Set(remappedIds.map((r) => r.tempStudentId));
  portalStore.pendingRegistrations = portalStore.pendingRegistrations.filter(
    (r) => !regTemps.has(r.tempStudentId)
  );

  const profSet = new Set(processedProfileUpdateIds);
  portalStore.pendingProfileUpdates = portalStore.pendingProfileUpdates.filter(
    (p) => !profSet.has(p.id)
  );

  const assessSet = new Set(processedAssessmentIds);
  portalStore.pendingAssessments = portalStore.pendingAssessments.filter(
    (a) => !assessSet.has(a.id)
  );

  saveStore(portalStore);
  res.json({ ok: true });
});

// 9. Staff: Sync Firestore Snapshot to Student Portal Store
app.post('/api/student/sync-from-staff', (req, res) => {
  if (!requireStaff(req, res)) return;
  const {
    students = [],
    diagnostics = [],
    humanisList = [],
    observations = [],
    processes = [],
    statements = [],
  } = req.body || {};

  if (Array.isArray(students)) {
    for (const s of students) {
      if (!s?.id) continue;
      const sid = String(s.id);
      const preferredUsername = String(s.portalUsername || s.nisn || sid)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '.')
        .slice(0, 60);

      const hasPendingProfile = portalStore.pendingProfileUpdates.some((p) => p.studentId === sid);
      if (!hasPendingProfile) {
        portalStore.students[sid] = {
          ...s,
          portalUsername: preferredUsername,
        };
      }

      if (!portalStore.credentials[sid]) {
        const finalUsername = isStudentUsernameTaken(preferredUsername, sid)
          ? `${preferredUsername}.${sid.slice(-4).toLowerCase()}`
          : preferredUsername;
        portalStore.credentials[sid] = {
          studentId: sid,
          username: finalUsername,
          passwordHash: hashPassword('smk12345'),
          aktif: true,
        };
      }
    }
  }

  if (Array.isArray(diagnostics)) {
    const pendingDiagIds = new Set(
      portalStore.pendingAssessments.map((p) => String(p.diagnostic.id || ''))
    );
    const pendingDiags = portalStore.diagnostics.filter((d) =>
      pendingDiagIds.has(String(d.id || ''))
    );
    portalStore.diagnostics = [...diagnostics, ...pendingDiags];
  }

  if (Array.isArray(humanisList)) {
    const nextHumanis: Record<string, Record<string, unknown>> = {};
    for (const h of humanisList) {
      if (h?.studentId) nextHumanis[String(h.studentId)] = h;
    }
    portalStore.humanis = nextHumanis;
  }

  if (Array.isArray(observations)) {
    portalStore.observations = observations;
  }

  if (Array.isArray(processes)) {
    portalStore.processes = processes;
  }

  if (Array.isArray(statements)) {
    const pendingStmtIds = new Set(
      portalStore.pendingAssessments
        .map((p) => (p.statement ? String(p.statement.id || '') : ''))
        .filter(Boolean)
    );
    const pendingStmts = portalStore.goodStatements.filter((g) =>
      pendingStmtIds.has(String(g.id || ''))
    );
    portalStore.goodStatements = [...statements, ...pendingStmts];
  }

  saveStore(portalStore);
  res.json({ ok: true, syncedStudents: Object.keys(portalStore.students).length });
});

// ============================================================
// GEMINI AI ENDPOINTS
// ============================================================

app.post('/api/ai/analyze-student', async (req, res) => {
  try {
    const { student, diagnostic, humanis, observations, processes, goodStatements } = req.body || {};

    if (!student || !student.namaLengkap) {
      res.status(400).json({ error: 'Data siswa tidak lengkap untuk dianalisis.' });
      return;
    }

    const ai = getGeminiClient();

    const prompt = `
Anda adalah Konselor Pendidikan Vokasi & Ahli Pembinaan Karakter Kemandirian Siswa SMK yang menggunakan kerangka kerja 7 Tahap HUMANIS:
(H) Humanisasi Potensi, (U) Urgensi & Pemahaman, (M) Modeling & Keteladanan, (A) Apresiasi Progres Kecil, (N) Normalisasi & Pembiasaan, (I) Internalisasi Nilai, (S) Sinergi & Keberlanjutan.

Analisis profil pembinaan siswa berikut secara objektif, empatik, konkret, dan praktis dalam Bahasa Indonesia:

1. Biodata Siswa:
- Nama: ${student.namaLengkap}
- Kelas/Jurusan: ${student.kelas} (${student.jurusan})
- NISN: ${student.nisn}

2. Hasil Tes Diagnostik Awal Kemandirian (Skala 1-5 per aspek):
${diagnostic ? `
- Tanggung Jawab: ${diagnostic.tanggungJawab}/5
- Disiplin: ${diagnostic.disiplin}/5
- Inisiatif: ${diagnostic.inisiatif}/5
- Pengambilan Keputusan: ${diagnostic.pengambilanKeputusan}/5
- Manajemen Diri: ${diagnostic.manajemenDiri}/5
- Skor Total: ${diagnostic.totalScore}/100 (${diagnostic.category})
- Catatan Diagnostik: ${diagnostic.notes || '-'}
` : 'Belum ada data diagnostik awal.'}

3. Progres Tahapan HUMANIS:
${humanis ? `
- Tahap Selesai: ${(humanis.completedStages || []).join(', ') || 'Belum ada'}
- Minat/Bakat/Cita-cita (H): ${humanis.hMinat || '-'} / ${humanis.hBakat || '-'} / ${humanis.hCitaCita || '-'}
- Kesadaran Mandiri (U): ${humanis.uKesadaranMandiri || '-'}
- Keteladanan & Respon (M): ${humanis.mKeteladananGuru || '-'} -> ${humanis.mResponSiswa || '-'}
- Apresiasi Progres (A): ${humanis.aProgresDicapai || '-'}
- Pembiasaan (N): ${humanis.nKebiasaanPositif || '-'}
- Refleksi Nilai (I): ${humanis.iRefleksiSiswa || '-'}
- Sinergi Orang Tua (S): ${humanis.sPeranOrangTua || '-'}
` : 'Tahapan HUMANIS belum diisi.'}

4. Riwayat Observasi Kondisi Terbaru (${(observations || []).length} catatan):
${(observations || []).slice(0, 5).map((o: Record<string, unknown>) => `- [${o.tanggal}] Kemandirian: ${o.tingkatKemandirian} (Skor ${o.skorKemandirian}) | Akademik: ${o.kondisiAkademik} | Sosial: ${o.kondisiSosial} | Emosional: ${o.kondisiEmosional}`).join('\n') || 'Belum ada observasi.'}

5. Riwayat Proses Pembinaan (${(processes || []).length} tindakan):
${(processes || []).slice(0, 5).map((p: Record<string, unknown>) => `- [${p.tanggal} | Tahap ${p.tahapHumanis}] Tindakan: ${p.tindakan} -> Hasil: ${p.hasilSementara}`).join('\n') || 'Belum ada log pembinaan.'}

6. Pernyataan Baik Siswa (${(goodStatements || []).length} afirmasi):
${(goodStatements || []).slice(0, 5).map((g: Record<string, unknown>) => `- "${g.kalimat}" (${g.tanggal})`).join('\n') || 'Belum ada pernyataan baik.'}

Berikan analisis ringkas namun tajam (2-3 kalimat untuk analisisSiswa), 3-4 saran tindakan operasional yang langsung bisa dilakukan wali kelas minggu ini, prediksi perkembangan ('Meningkat', 'Stabil', atau 'Berisiko Menurun'), alasan singkat prediksi, dan rekomendasi tahap HUMANIS prioritas berikutnya.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analisisSiswa: {
              type: Type.STRING,
              description: 'Ringkasan analisis kekuatan, tantangan, dan karakter kemandirian siswa (2-3 kalimat).'
            },
            saranTindakan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 sampai 4 langkah intervensi praktis untuk wali kelas dan guru BK.'
            },
            prediksiPerkembangan: {
              type: Type.STRING,
              description: 'Harus tepat salah satu dari: Meningkat, Stabil, Berisiko Menurun'
            },
            alasanPrediksi: {
              type: Type.STRING,
              description: 'Penjelasan singkat 1-2 kalimat mengenai dasar prediksi.'
            },
            fokusHumanis: {
              type: Type.STRING,
              description: 'Tahap HUMANIS yang disarankan untuk difokuskan berikutnya beserta alasannya.'
            }
          },
          required: ['analisisSiswa', 'saranTindakan', 'prediksiPerkembangan', 'alasanPrediksi', 'fokusHumanis']
        }
      }
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
    const validPred = ['Meningkat', 'Stabil', 'Berisiko Menurun'].includes(parsed.prediksiPerkembangan)
      ? parsed.prediksiPerkembangan
      : 'Stabil';

    res.json({
      analisisSiswa: parsed.analisisSiswa || 'Analisis berhasil dibuat.',
      saranTindakan: Array.isArray(parsed.saranTindakan) ? parsed.saranTindakan.slice(0, 6) : [],
      prediksiPerkembangan: validPred,
      alasanPrediksi: parsed.alasanPrediksi || '',
      fokusHumanis: parsed.fokusHumanis || 'N - Normalisasi dan Pembiasaan',
    });
  } catch (err) {
    console.error('Gemini analyze-student error:', err);
    const message = err instanceof Error ? err.message : 'Gagal memproses analisis Gemini AI.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/class-insight', async (req, res) => {
  try {
    const { summary } = req.body || {};
    if (!summary) {
      res.status(400).json({ error: 'Ringkasan data kelas dibutuhkan.' });
      return;
    }

    const ai = getGeminiClient();

    const prompt = `
Anda adalah Sistem Analitik Pembinaan Kemandirian Siswa SMK berbasis model 7 Tahap HUMANIS.
Berdasarkan rekap data nyata di bawah ini, buatlah AI Insight singkat, padat, dan langsung dapat ditindaklanjuti oleh Wali Kelas & Kepala Sekolah dalam Bahasa Indonesia:

Data Agregat Kelas/Sekolah:
- Total Siswa: ${summary.totalStudents}
- Siswa Mandiri Tinggi (Baik/Sangat Baik): ${summary.highCount}
- Siswa Kategori Sedang: ${summary.mediumCount}
- Siswa Perlu Pendampingan: ${summary.attentionCount}
- Rata-rata Aspek Diagnostik (1-5):
  * Tanggung Jawab: ${summary.aspectAverages?.tanggungJawab ?? 0}
  * Disiplin: ${summary.aspectAverages?.disiplin ?? 0}
  * Inisiatif: ${summary.aspectAverages?.inisiatif ?? 0}
  * Pengambilan Keputusan: ${summary.aspectAverages?.pengambilanKeputusan ?? 0}
  * Manajemen Diri: ${summary.aspectAverages?.manajemenDiri ?? 0}
- Kelas/Jurusan dominan: ${(summary.classes || []).join(', ') || 'Umum SMK'}
- Rata-rata keterlaksanaan tahap HUMANIS: ${summary.avgHumanisStages ?? 0} dari 7 tahap
- Siswa yang membutuhkan perhatian khusus: ${(summary.priorityNames || []).join(', ') || 'Tidak ada'}

Buatlah ringkasan insight kelas (2-3 kalimat, langsung menyebut aspek paling lemah dan rekomendasi spesifik seperti proyek individu, refleksi mingguan, atau pembiasaan), identifikasi aspek terlemah, aspek terkuat, serta 3 rekomendasi tindakan kelas.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ringkasanEksekutif: {
              type: Type.STRING,
              description: 'Insight utama kondisi kemandirian kelas dalam 2-3 kalimat.'
            },
            aspekTerlemah: { type: Type.STRING },
            aspekTerkuat: { type: Type.STRING },
            rekomendasiStrategis: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 rekomendasi strategis praktis tingkat kelas/sekolah.'
            }
          },
          required: ['ringkasanEksekutif', 'aspekTerlemah', 'aspekTerkuat', 'rekomendasiStrategis']
        }
      }
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
    res.json(parsed);
  } catch (err) {
    console.error('Gemini class-insight error:', err);
    const message = err instanceof Error ? err.message : 'Gagal menghasilkan AI Insight kelas.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HUMANIS SMK server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
