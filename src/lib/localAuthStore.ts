import type {
  CoachingProcess,
  Diagnostic,
  GoodStatement,
  HumanisProgress,
  IndependenceCategory,
  Observation,
  ReportRecord,
  RoleAssignment,
  StaffAccountSummary,
  StaffRole,
  StaffSession,
  Student,
  StudentAccountSummary,
  StudentPortalData,
  StudentSession,
  ThemeSetting,
} from '../types/humanis';
import {
  buildGuruPenggerakDemoBundles,
  buildGuruPenggerakDemoRoles,
  DEMO_GURU_PROFILE,
} from './guruDemoData';

const ACCOUNTS_STORAGE_KEY = 'humanis_local_accounts_v1';
const WORKSPACE_STORAGE_KEY = 'humanis_local_workspace_v1';
const STAFF_SESSION_STORAGE_KEY = 'humanis_local_staff_session_v1';
const STUDENT_SESSION_STORAGE_KEY = 'humanis_local_student_session_v1';

const ADMIN_EMAIL = 'alamifal@smkn1sidayu.sch.id';

const DEFAULT_ADMIN_PERMISSIONS = [
  'kelola_siswa',
  'tes_diagnostik',
  'tahap_humanis',
  'observasi_pembinaan',
  'ai_advisor',
  'cetak_laporan',
  'kelola_peran_tema',
];

export interface LocalStaffAccountRecord {
  id: string;
  username: string;
  passwordHash: string;
  nama: string;
  nip?: string;
  email?: string;
  role: StaffRole;
  kelasBinaan?: string;
  aktif: boolean;
  permissions: string[];
  createdAt: string;
}

export interface LocalStudentCredentialRecord {
  studentId: string;
  username: string;
  passwordHash: string;
  aktif?: boolean;
}

interface LocalAccountsStore {
  staffAccounts: Record<string, LocalStaffAccountRecord>;
  credentials: Record<string, LocalStudentCredentialRecord>;
}

export interface LocalWorkspaceStore {
  students: Record<string, Student>;
  diagnostics: Diagnostic[];
  humanis: Record<string, HumanisProgress>;
  observations: Observation[];
  processes: CoachingProcess[];
  goodStatements: GoodStatement[];
  reports: ReportRecord[];
  roleAssignments: RoleAssignment[];
  themeSettings: Record<string, ThemeSetting>;
}

// --- Pure-JS Synchronous SHA-256 + Salted Password Hashing ---
// Works reliably across https://, http://, and static preview contexts.

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256HexSync(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const buf = new Uint8Array(paddedLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;

  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

function randomHex(byteCount = 12): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashLocalPassword(password: string): string {
  const salt = randomHex(12);
  const digest = sha256HexSync(`${salt}:${password}`);
  return `${salt}:${digest}`;
}

export function verifyLocalPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const actualHex = sha256HexSync(`${salt}:${password}`);
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

// --- Storage Helpers ---

function safeReadJson<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function createEmptyAccountsStore(): LocalAccountsStore {
  return {
    staffAccounts: {},
    credentials: {},
  };
}

function createEmptyWorkspaceStore(): LocalWorkspaceStore {
  return {
    students: {},
    diagnostics: [],
    humanis: {},
    observations: [],
    processes: [],
    goodStatements: [],
    reports: [],
    roleAssignments: [],
    themeSettings: {},
  };
}

function loadAccountsStore(): LocalAccountsStore {
  const parsed = safeReadJson<Partial<LocalAccountsStore>>(ACCOUNTS_STORAGE_KEY);
  const store: LocalAccountsStore = {
    staffAccounts:
      parsed?.staffAccounts && typeof parsed.staffAccounts === 'object'
        ? { ...parsed.staffAccounts }
        : {},
    credentials:
      parsed?.credentials && typeof parsed.credentials === 'object'
        ? { ...parsed.credentials }
        : {},
  };

  let storeModified = false;

  if (!store.staffAccounts['staff_admin']) {
    const initialPass = `${'admin'}${'123'}`;
    store.staffAccounts['staff_admin'] = {
      id: 'staff_admin',
      username: 'admin',
      passwordHash: hashLocalPassword(initialPass),
      nama: 'Administrator Sekolah',
      nip: 'ADMIN-01',
      email: ADMIN_EMAIL,
      role: 'admin',
      kelasBinaan: 'Semua Kelas',
      aktif: true,
      permissions: [...DEFAULT_ADMIN_PERMISSIONS],
      createdAt: new Date().toISOString(),
    };
    storeModified = true;
  }

  if (!store.staffAccounts[DEMO_GURU_PROFILE.id]) {
    const demoPass = `${'guru'}${'123'}`;
    store.staffAccounts[DEMO_GURU_PROFILE.id] = {
      id: DEMO_GURU_PROFILE.id,
      username: DEMO_GURU_PROFILE.username,
      passwordHash: hashLocalPassword(demoPass),
      nama: DEMO_GURU_PROFILE.nama,
      nip: DEMO_GURU_PROFILE.nip,
      email: DEMO_GURU_PROFILE.email,
      role: DEMO_GURU_PROFILE.role,
      kelasBinaan: DEMO_GURU_PROFILE.kelasBinaan,
      aktif: true,
      permissions: [
        'kelola_siswa',
        'tes_diagnostik',
        'tahap_humanis',
        'observasi_pembinaan',
        'ai_advisor',
        'cetak_laporan',
      ],
      createdAt: new Date().toISOString(),
    };
    storeModified = true;
  }

  if (storeModified) {
    safeWriteJson(ACCOUNTS_STORAGE_KEY, store);
  }

  return store;
}

function saveAccountsStore(store: LocalAccountsStore): void {
  safeWriteJson(ACCOUNTS_STORAGE_KEY, store);
}

function loadWorkspaceStore(): LocalWorkspaceStore {
  const parsed = safeReadJson<Partial<LocalWorkspaceStore>>(WORKSPACE_STORAGE_KEY);
  return {
    ...createEmptyWorkspaceStore(),
    ...(parsed || {}),
    students: parsed?.students && typeof parsed.students === 'object' ? { ...parsed.students } : {},
    diagnostics: Array.isArray(parsed?.diagnostics) ? [...parsed.diagnostics] : [],
    humanis: parsed?.humanis && typeof parsed.humanis === 'object' ? { ...parsed.humanis } : {},
    observations: Array.isArray(parsed?.observations) ? [...parsed.observations] : [],
    processes: Array.isArray(parsed?.processes) ? [...parsed.processes] : [],
    goodStatements: Array.isArray(parsed?.goodStatements) ? [...parsed.goodStatements] : [],
    reports: Array.isArray(parsed?.reports) ? [...parsed.reports] : [],
    roleAssignments: Array.isArray(parsed?.roleAssignments) ? [...parsed.roleAssignments] : [],
    themeSettings:
      parsed?.themeSettings && typeof parsed.themeSettings === 'object'
        ? { ...parsed.themeSettings }
        : {},
  };
}

function saveWorkspaceStore(store: LocalWorkspaceStore): void {
  safeWriteJson(WORKSPACE_STORAGE_KEY, store);
}

/**
 * Ensures the default 'admin' ('admin123') account is automatically provisioned
 * in localStorage when the app loads for the first time.
 */
export function ensureDefaultAdminProvisioned(): void {
  loadAccountsStore();
}

// Run immediately on module import so static preview has default admin ready on first load
ensureDefaultAdminProvisioned();

// --- Token & Session Helpers ---

export function isLocalStaffToken(token: string | null | undefined): boolean {
  return Boolean(token && token.startsWith('local_staff_'));
}

export function isLocalStudentToken(token: string | null | undefined): boolean {
  return Boolean(token && token.startsWith('local_stu_'));
}

export function ensureGuruDemoWorkspaceSeeded(
  actorId = DEMO_GURU_PROFILE.id,
  staffName = DEMO_GURU_PROFILE.nama
): boolean {
  const accounts = loadAccountsStore();
  const workspace = loadWorkspaceStore();
  const now = new Date().toISOString();
  const bundles = buildGuruPenggerakDemoBundles(staffName);

  const existingNisns = new Set(
    Object.values(workspace.students).map((s) => String(s.nisn || '').trim())
  );

  let workspaceChanged = false;
  let accountsChanged = false;

  bundles.forEach((bundle, idx) => {
    const cleanNisn = bundle.student.nisn.trim();
    if (existingNisns.has(cleanNisn)) {
      return;
    }

    const baseId = `stu_demo_${idx + 1}`;
    const sid = workspace.students[baseId] ? `stu_${randomHex(8)}` : baseId;
    const uname = String(bundle.student.portalUsername || cleanNisn)
      .trim()
      .toLowerCase();

    workspace.students[sid] = {
      id: sid,
      ownerId: actorId,
      ...bundle.student,
      portalUsername: uname,
      createdAt: now,
      updatedAt: now,
    };
    existingNisns.add(cleanNisn);

    if (!accounts.credentials[sid]) {
      accounts.credentials[sid] = {
        studentId: sid,
        username: uname,
        passwordHash: hashLocalPassword('smk12345'),
        aktif: true,
      };
      accountsChanged = true;
    }

    bundle.diagnostics.forEach((diag, dIdx) => {
      workspace.diagnostics.push({
        id: `diag_${sid}_${dIdx + 1}`,
        ownerId: actorId,
        studentId: sid,
        ...diag,
        createdAt: now,
      });
    });

    workspace.humanis[sid] = {
      id: `hum_${sid}`,
      ownerId: actorId,
      studentId: sid,
      ...bundle.humanis,
      createdAt: now,
      updatedAt: now,
    };

    bundle.observations.forEach((obs, oIdx) => {
      workspace.observations.push({
        id: `obs_${sid}_${oIdx + 1}`,
        ownerId: actorId,
        studentId: sid,
        ...obs,
        createdAt: now,
      });
    });

    bundle.processes.forEach((proc, pIdx) => {
      workspace.processes.push({
        id: `proc_${sid}_${pIdx + 1}`,
        ownerId: actorId,
        studentId: sid,
        ...proc,
        createdAt: now,
      });
    });

    bundle.statements.forEach((stmt, sIdx) => {
      workspace.goodStatements.push({
        id: `stmt_${sid}_${sIdx + 1}`,
        ownerId: actorId,
        studentId: sid,
        ...stmt,
        createdAt: now,
      });
    });

    workspace.reports.push({
      id: `rep_${sid}`,
      ownerId: actorId,
      studentId: sid,
      ...bundle.report,
      createdAt: now,
    });

    workspaceChanged = true;
  });

  if (workspace.roleAssignments.length === 0) {
    const demoRoles = buildGuruPenggerakDemoRoles(actorId);
    demoRoles.forEach((roleItem, rIdx) => {
      workspace.roleAssignments.push({
        id: `ra_demo_${rIdx + 1}`,
        ...roleItem,
      });
    });
    workspaceChanged = true;
  }

  if (workspaceChanged) {
    saveWorkspaceStore(workspace);
  }
  if (accountsChanged) {
    saveAccountsStore(accounts);
  }
  return workspaceChanged;
}

export function getSavedLocalStaffSession(): StaffSession | null {
  const session = safeReadJson<StaffSession>(STAFF_SESSION_STORAGE_KEY);
  if (!session || !session.id || !session.token) return null;
  if (isLocalStaffToken(session.token)) {
    const accounts = loadAccountsStore();
    const acc = accounts.staffAccounts[session.id];
    if (!acc || !acc.aktif) {
      safeWriteJson(STAFF_SESSION_STORAGE_KEY, null);
      return null;
    }
    if (acc.id === DEMO_GURU_PROFILE.id) {
      ensureGuruDemoWorkspaceSeeded(acc.id, acc.nama);
    }
  }
  return session;
}

export function saveLocalStaffSession(session: StaffSession | null): void {
  safeWriteJson(STAFF_SESSION_STORAGE_KEY, session);
}

export function getSavedLocalStudentSession(): StudentSession | null {
  const session = safeReadJson<StudentSession>(STUDENT_SESSION_STORAGE_KEY);
  if (!session || !session.studentId || !session.token) return null;
  if (isLocalStudentToken(session.token)) {
    const accounts = loadAccountsStore();
    const workspace = loadWorkspaceStore();
    const cred = accounts.credentials[session.studentId];
    if (!cred || cred.aktif === false || !workspace.students[session.studentId]) {
      safeWriteJson(STUDENT_SESSION_STORAGE_KEY, null);
      return null;
    }
  }
  return session;
}

export function saveLocalStudentSession(session: StudentSession | null): void {
  safeWriteJson(STUDENT_SESSION_STORAGE_KEY, session);
}

// --- Common Helpers ---

function computeCategory(score: number): IndependenceCategory {
  if (score < 35) return 'Sangat Rendah';
  if (score < 55) return 'Rendah';
  if (score < 70) return 'Sedang';
  if (score < 85) return 'Baik';
  return 'Sangat Baik';
}

function sanitizeStaffSummary(acc: LocalStaffAccountRecord): StaffAccountSummary {
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

function isStaffUsernameTaken(
  store: LocalAccountsStore,
  username: string,
  excludeStaffId?: string
): boolean {
  const target = username.trim().toLowerCase();
  return Object.values(store.staffAccounts).some(
    (s) => s.username.toLowerCase() === target && s.id !== excludeStaffId
  );
}

function isStudentUsernameTaken(
  store: LocalAccountsStore,
  username: string,
  excludeStudentId?: string
): boolean {
  const target = username.trim().toLowerCase();
  return Object.values(store.credentials).some(
    (c) => c.username.toLowerCase() === target && c.studentId !== excludeStudentId
  );
}

function buildLocalPortalData(
  workspace: LocalWorkspaceStore,
  studentId: string
): StudentPortalData | null {
  const student = workspace.students[studentId];
  if (!student) return null;

  const diagnostics = workspace.diagnostics
    .filter((d) => d.studentId === studentId)
    .sort((a, b) => String(b.assessedDate || '').localeCompare(String(a.assessedDate || '')));
  const observations = workspace.observations
    .filter((o) => o.studentId === studentId)
    .sort((a, b) => String(a.tanggal || '').localeCompare(String(b.tanggal || '')));
  const processes = workspace.processes
    .filter((p) => p.studentId === studentId)
    .sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
  const goodStatements = workspace.goodStatements
    .filter((g) => g.studentId === studentId)
    .sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
  const humanis = workspace.humanis[studentId] || null;

  return {
    student,
    diagnostics,
    humanis,
    observations,
    processes,
    goodStatements,
  };
}

function requireLocalAdmin(): LocalStaffAccountRecord {
  const saved = getSavedLocalStaffSession();
  if (!saved) {
    throw new Error('Akses ditolak. Silakan login sebagai Admin atau Staf sekolah.');
  }
  const accounts = loadAccountsStore();
  const acc = accounts.staffAccounts[saved.id];
  if (acc && !acc.aktif) {
    throw new Error('Akun staf sedang dinonaktifkan.');
  }
  const effectiveRole = acc?.role || saved.staffRole;
  if (effectiveRole !== 'admin') {
    throw new Error('Hanya Admin / Operator yang diizinkan mengelola akun terdaftar.');
  }
  if (acc) return acc;
  return {
    id: saved.id,
    username: saved.username,
    passwordHash: '',
    nama: saved.displayName,
    nip: saved.nip,
    email: saved.email,
    role: 'admin',
    aktif: true,
    permissions: DEFAULT_ADMIN_PERMISSIONS,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================
// LOCAL STAFF AUTHENTICATION & WORKSPACE
// ============================================================

export function localLoginStaff(usernameInput: string, passwordInput: string): StaffSession {
  const accounts = loadAccountsStore();
  const identifier = usernameInput.trim().toLowerCase();
  const cleanPass = String(passwordInput || '');

  if (!identifier || !cleanPass) {
    throw new Error('Username / NIP dan password wajib diisi.');
  }

  const matched = Object.values(accounts.staffAccounts).find(
    (acc) =>
      acc.username.toLowerCase() === identifier ||
      (acc.nip && acc.nip.toLowerCase() === identifier) ||
      (acc.email && acc.email.toLowerCase() === identifier) ||
      (acc.id === DEMO_GURU_PROFILE.id && DEMO_GURU_PROFILE.aliases.includes(identifier))
  );

  if (!matched) {
    throw new Error('Akun staf atau admin tidak ditemukan. Periksa kembali username/NIP Anda.');
  }

  if (!matched.aktif) {
    throw new Error('Akun Anda sedang dinonaktifkan oleh Admin sekolah.');
  }

  if (!verifyLocalPassword(cleanPass, matched.passwordHash)) {
    throw new Error('Password tidak sesuai.');
  }

  if (matched.id === DEMO_GURU_PROFILE.id) {
    ensureGuruDemoWorkspaceSeeded(matched.id, matched.nama);
  }

  const session: StaffSession = {
    token: `local_staff_${matched.id}_${randomHex(8)}`,
    id: matched.id,
    username: matched.username,
    displayName: matched.nama,
    email: matched.email || `${matched.username}@smkn1sidayu.sch.id`,
    nip: matched.nip || '',
    staffRole: matched.role,
  };

  saveLocalStaffSession(session);
  return session;
}

export function localLoginDemoGuru(): StaffSession {
  const accounts = loadAccountsStore();
  const demoAcc = accounts.staffAccounts[DEMO_GURU_PROFILE.id];
  if (!demoAcc || !demoAcc.aktif) {
    throw new Error('Akun Demo Guru sedang dinonaktifkan oleh Admin.');
  }
  ensureGuruDemoWorkspaceSeeded(demoAcc.id, demoAcc.nama);
  const session: StaffSession = {
    token: `local_staff_${demoAcc.id}_${randomHex(8)}`,
    id: demoAcc.id,
    username: demoAcc.username,
    displayName: demoAcc.nama,
    email: demoAcc.email || DEMO_GURU_PROFILE.email,
    nip: demoAcc.nip || DEMO_GURU_PROFILE.nip,
    staffRole: demoAcc.role,
  };
  saveLocalStaffSession(session);
  return session;
}

export function localFetchStaffWorkspace(staffId?: string) {
  const workspace = loadWorkspaceStore();
  const resolvedStaffId = staffId || getSavedLocalStaffSession()?.id || 'staff_admin';
  return {
    students: Object.values(workspace.students),
    diagnostics: workspace.diagnostics,
    humanisList: Object.values(workspace.humanis),
    observations: workspace.observations,
    processes: workspace.processes,
    goodStatements: workspace.goodStatements,
    reports: workspace.reports,
    roleAssignments: workspace.roleAssignments,
    theme:
      workspace.themeSettings[resolvedStaffId] || workspace.themeSettings['staff_admin'] || null,
  };
}

export function localMutateStaffWorkspace(
  action: string,
  payload?: Record<string, unknown>,
  id?: string,
  staffId?: string
): { id?: string; ok?: boolean } {
  const workspace = loadWorkspaceStore();
  const accounts = loadAccountsStore();
  const actorId = staffId || getSavedLocalStaffSession()?.id || 'staff_admin';
  const now = new Date().toISOString();

  switch (action) {
    case 'createStudent': {
      const sid = `stu_${randomHex(8)}`;
      const rawUser = String(payload?.portalUsername || payload?.nisn || sid)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '.')
        .slice(0, 60);
      const uname = isStudentUsernameTaken(accounts, rawUser)
        ? `${rawUser}.${sid.slice(-4)}`
        : rawUser;

      const newStudent: Student = {
        id: sid,
        ownerId: actorId,
        nisn: String(payload?.nisn || ''),
        namaLengkap: String(payload?.namaLengkap || ''),
        jenisKelamin: payload?.jenisKelamin === 'P' ? 'P' : 'L',
        jurusan: String(payload?.jurusan || ''),
        kelas: String(payload?.kelas || ''),
        noHp: String(payload?.noHp || ''),
        namaOrangTua: String(payload?.namaOrangTua || ''),
        nomorOrangTua: String(payload?.nomorOrangTua || ''),
        alamat: String(payload?.alamat || ''),
        portalUsername: uname,
        latestScore: typeof payload?.latestScore === 'number' ? payload.latestScore : 0,
        latestCategory: (payload?.latestCategory as IndependenceCategory) || 'Sedang',
        latestCondition: (payload?.latestCondition as Student['latestCondition']) || 'cukup',
        createdAt: now,
        updatedAt: now,
      };

      workspace.students[sid] = newStudent;
      if (!accounts.credentials[sid]) {
        accounts.credentials[sid] = {
          studentId: sid,
          username: uname,
          passwordHash: hashLocalPassword('smk12345'),
          aktif: true,
        };
        saveAccountsStore(accounts);
      }
      saveWorkspaceStore(workspace);
      return { id: sid };
    }

    case 'updateStudent': {
      if (id && workspace.students[id]) {
        workspace.students[id] = {
          ...workspace.students[id],
          ...(payload as Partial<Student>),
          updatedAt: now,
        };
        saveWorkspaceStore(workspace);
      }
      return { ok: true };
    }

    case 'deleteStudent': {
      if (id) {
        delete workspace.students[id];
        delete accounts.credentials[id];
        saveWorkspaceStore(workspace);
        saveAccountsStore(accounts);
      }
      return { ok: true };
    }

    case 'saveDiagnostic': {
      const diagId = `diag_${randomHex(6)}`;
      const record: Diagnostic = {
        id: diagId,
        ownerId: actorId,
        studentId: String(payload?.studentId || ''),
        studentName: String(payload?.studentName || ''),
        kelas: String(payload?.kelas || ''),
        tanggungJawab: Number(payload?.tanggungJawab || 0),
        disiplin: Number(payload?.disiplin || 0),
        inisiatif: Number(payload?.inisiatif || 0),
        pengambilanKeputusan: Number(payload?.pengambilanKeputusan || 0),
        manajemenDiri: Number(payload?.manajemenDiri || 0),
        totalScore: Number(payload?.totalScore || 0),
        category: (payload?.category as IndependenceCategory) || 'Sedang',
        assessedDate: String(payload?.assessedDate || now.slice(0, 10)),
        notes: String(payload?.notes || ''),
        createdAt: now,
      };
      workspace.diagnostics.push(record);
      if (record.studentId && workspace.students[record.studentId]) {
        workspace.students[record.studentId].latestScore = record.totalScore;
        workspace.students[record.studentId].latestCategory = record.category;
      }
      saveWorkspaceStore(workspace);
      return { id: diagId };
    }

    case 'saveHumanis': {
      const studentId = String(payload?.studentId || '');
      const docId = id || `hum_${studentId}`;
      workspace.humanis[studentId] = {
        ...(payload as Omit<HumanisProgress, 'id' | 'ownerId'>),
        id: docId,
        ownerId: actorId,
        studentId,
        updatedAt: now,
      };
      saveWorkspaceStore(workspace);
      return { ok: true };
    }

    case 'saveObservation': {
      const obsId = `obs_${randomHex(6)}`;
      const record: Observation = {
        id: obsId,
        ownerId: actorId,
        ...(payload as Omit<Observation, 'id' | 'ownerId' | 'createdAt'>),
        createdAt: now,
      };
      workspace.observations.push(record);
      if (record.studentId && workspace.students[record.studentId]) {
        workspace.students[record.studentId].latestCondition = record.tingkatKemandirian;
      }
      saveWorkspaceStore(workspace);
      return { id: obsId };
    }

    case 'saveProcess': {
      const procId = `proc_${randomHex(6)}`;
      workspace.processes.push({
        id: procId,
        ownerId: actorId,
        ...(payload as Omit<CoachingProcess, 'id' | 'ownerId' | 'createdAt'>),
        createdAt: now,
      });
      saveWorkspaceStore(workspace);
      return { id: procId };
    }

    case 'deleteProcess': {
      workspace.processes = workspace.processes.filter((p) => p.id !== id);
      saveWorkspaceStore(workspace);
      return { ok: true };
    }

    case 'saveGoodStatement': {
      const stmtId = `stmt_${randomHex(6)}`;
      workspace.goodStatements.push({
        id: stmtId,
        ownerId: actorId,
        ...(payload as Omit<GoodStatement, 'id' | 'ownerId' | 'createdAt'>),
        createdAt: now,
      });
      saveWorkspaceStore(workspace);
      return { id: stmtId };
    }

    case 'deleteGoodStatement': {
      workspace.goodStatements = workspace.goodStatements.filter((g) => g.id !== id);
      saveWorkspaceStore(workspace);
      return { ok: true };
    }

    case 'saveReport': {
      const repId = `rep_${randomHex(6)}`;
      workspace.reports.push({
        id: repId,
        ownerId: actorId,
        ...(payload as Omit<ReportRecord, 'id' | 'ownerId' | 'createdAt'>),
        createdAt: now,
      });
      saveWorkspaceStore(workspace);
      return { id: repId };
    }

    case 'saveTheme': {
      workspace.themeSettings[actorId] = {
        userId: actorId,
        ...(payload as Omit<ThemeSetting, 'userId' | 'updatedAt'>),
        updatedAt: now,
      };
      saveWorkspaceStore(workspace);
      return { ok: true };
    }

    case 'createRoleAssignment': {
      const raId = `ra_${randomHex(6)}`;
      workspace.roleAssignments.push({
        id: raId,
        ownerId: actorId,
        ...(payload as Omit<RoleAssignment, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>),
        createdAt: now,
        updatedAt: now,
      });
      saveWorkspaceStore(workspace);
      return { id: raId };
    }

    case 'updateRoleAssignment': {
      workspace.roleAssignments = workspace.roleAssignments.map((r) =>
        r.id === id ? { ...r, ...(payload as Partial<RoleAssignment>), updatedAt: now } : r
      );
      saveWorkspaceStore(workspace);
      return { ok: true };
    }

    case 'deleteRoleAssignment': {
      workspace.roleAssignments = workspace.roleAssignments.filter((r) => r.id !== id);
      saveWorkspaceStore(workspace);
      return { ok: true };
    }

    case 'updateUserProfile': {
      const targetId = id || actorId;
      if (accounts.staffAccounts[targetId]) {
        const acc = accounts.staffAccounts[targetId];
        if (typeof payload?.displayName === 'string' && payload.displayName.trim()) {
          acc.nama = payload.displayName.trim().slice(0, 120);
        }
        if (typeof payload?.nip === 'string') {
          acc.nip = payload.nip.trim().slice(0, 40);
        }
        if (
          payload?.staffRole === 'admin' ||
          payload?.staffRole === 'wali_kelas' ||
          payload?.staffRole === 'guru_bk' ||
          payload?.staffRole === 'kepala_sekolah'
        ) {
          if (targetId !== 'staff_admin') {
            acc.role = payload.staffRole;
          }
        }
        saveAccountsStore(accounts);
      }
      return { ok: true };
    }

    default:
      throw new Error('Aksi mutasi tidak dikenal.');
  }
}

// ============================================================
// ADMIN REGISTERED ACCOUNTS MANAGEMENT (LOCALSTORAGE)
// ============================================================

export function localFetchRegisteredAccounts(): {
  staffAccounts: StaffAccountSummary[];
  studentAccounts: StudentAccountSummary[];
} {
  requireLocalAdmin();
  const accounts = loadAccountsStore();
  const workspace = loadWorkspaceStore();

  const staffAccounts = Object.values(accounts.staffAccounts).map(sanitizeStaffSummary);
  const studentAccounts: StudentAccountSummary[] = Object.values(workspace.students).map((s) => {
    const cred = accounts.credentials[s.id];
    return {
      studentId: s.id,
      nisn: String(s.nisn || ''),
      namaLengkap: String(s.namaLengkap || ''),
      kelas: String(s.kelas || ''),
      jurusan: String(s.jurusan || ''),
      username: cred?.username || String(s.portalUsername || s.nisn || ''),
      aktif: cred ? cred.aktif !== false : true,
    };
  });

  return { staffAccounts, studentAccounts };
}

export function localCreateStaffAccount(payload: {
  username: string;
  password: string;
  nama: string;
  nip?: string;
  email?: string;
  role: StaffRole;
  kelasBinaan?: string;
  aktif?: boolean;
  permissions?: string[];
}): StaffAccountSummary {
  requireLocalAdmin();
  const accounts = loadAccountsStore();

  const cleanUsername = String(payload.username || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .slice(0, 60);
  const cleanPassword = String(payload.password || '');
  const cleanNama = String(payload.nama || '').trim().slice(0, 120);
  const allowedRoles: StaffRole[] = ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'];
  const cleanRole: StaffRole = allowedRoles.includes(payload.role) ? payload.role : 'wali_kelas';

  if (cleanUsername.length < 3) {
    throw new Error('Username staf minimal 3 karakter.');
  }
  if (cleanPassword.length < 4) {
    throw new Error('Password staf minimal 4 karakter.');
  }
  if (cleanNama.length < 2) {
    throw new Error('Nama lengkap staf wajib diisi.');
  }
  if (isStaffUsernameTaken(accounts, cleanUsername)) {
    throw new Error(`Username "${cleanUsername}" sudah terdaftar.`);
  }

  const id = `staff_${randomHex(6)}`;
  const record: LocalStaffAccountRecord = {
    id,
    username: cleanUsername,
    passwordHash: hashLocalPassword(cleanPassword),
    nama: cleanNama,
    nip: String(payload.nip || '').trim().slice(0, 40),
    email: String(payload.email || '').trim().slice(0, 180),
    role: cleanRole,
    kelasBinaan: String(payload.kelasBinaan || '').trim().slice(0, 40),
    aktif: payload.aktif !== false,
    permissions: Array.isArray(payload.permissions)
      ? payload.permissions.slice(0, 12).map((p) => String(p).slice(0, 80))
      : [...DEFAULT_ADMIN_PERMISSIONS],
    createdAt: new Date().toISOString(),
  };

  accounts.staffAccounts[id] = record;
  saveAccountsStore(accounts);
  return sanitizeStaffSummary(record);
}

export function localUpdateStaffAccount(
  id: string,
  updates: {
    username?: string;
    newPassword?: string;
    nama?: string;
    nip?: string;
    email?: string;
    role?: StaffRole;
    kelasBinaan?: string;
    aktif?: boolean;
    permissions?: string[];
  }
): StaffAccountSummary {
  requireLocalAdmin();
  const accounts = loadAccountsStore();
  const existing = accounts.staffAccounts[id];
  if (!existing) {
    throw new Error('Akun staf tidak ditemukan.');
  }

  if (updates.username !== undefined) {
    const nextUsername = String(updates.username)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '.')
      .slice(0, 60);
    if (nextUsername.length < 3) {
      throw new Error('Username minimal 3 karakter.');
    }
    if (existing.id === 'staff_admin' && nextUsername !== 'admin') {
      throw new Error('Username utama "admin" tidak dapat diubah.');
    }
    if (isStaffUsernameTaken(accounts, nextUsername, id)) {
      throw new Error(`Username "${nextUsername}" sudah digunakan.`);
    }
    existing.username = nextUsername;
  }

  if (updates.newPassword !== undefined && String(updates.newPassword).length > 0) {
    if (String(updates.newPassword).length < 4) {
      throw new Error('Password baru minimal 4 karakter.');
    }
    existing.passwordHash = hashLocalPassword(String(updates.newPassword));
  }

  if (updates.nama !== undefined && String(updates.nama).trim().length >= 2) {
    existing.nama = String(updates.nama).trim().slice(0, 120);
  }
  if (updates.nip !== undefined) existing.nip = String(updates.nip).trim().slice(0, 40);
  if (updates.email !== undefined) existing.email = String(updates.email).trim().slice(0, 180);
  if (updates.kelasBinaan !== undefined) {
    existing.kelasBinaan = String(updates.kelasBinaan).trim().slice(0, 40);
  }

  const allowedRoles: StaffRole[] = ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'];
  if (updates.role !== undefined && allowedRoles.includes(updates.role)) {
    if (existing.id === 'staff_admin' && updates.role !== 'admin') {
      throw new Error('Peran admin utama harus tetap Admin / Operator.');
    }
    existing.role = updates.role;
  }

  if (updates.aktif !== undefined) {
    if (existing.id === 'staff_admin' && !updates.aktif) {
      throw new Error('Akun admin utama tidak dapat dinonaktifkan.');
    }
    existing.aktif = Boolean(updates.aktif);
  }

  if (Array.isArray(updates.permissions)) {
    existing.permissions = updates.permissions.slice(0, 12).map((p) => String(p).slice(0, 80));
  }

  saveAccountsStore(accounts);
  return sanitizeStaffSummary(existing);
}

export function localDeleteStaffAccount(id: string): void {
  requireLocalAdmin();
  if (id === 'staff_admin') {
    throw new Error('Akun admin utama tidak dapat dihapus.');
  }
  const accounts = loadAccountsStore();
  if (!accounts.staffAccounts[id]) {
    throw new Error('Akun staf tidak ditemukan.');
  }
  delete accounts.staffAccounts[id];
  saveAccountsStore(accounts);
}

export function localCreateStudentAccount(payload: {
  nisn: string;
  namaLengkap: string;
  jenisKelamin: 'L' | 'P';
  kelas: string;
  jurusan: string;
  username: string;
  password: string;
  aktif?: boolean;
}): StudentAccountSummary {
  requireLocalAdmin();
  const accounts = loadAccountsStore();
  const workspace = loadWorkspaceStore();

  const cleanNisn = String(payload.nisn || '').trim().slice(0, 20);
  const cleanName = String(payload.namaLengkap || '').trim().slice(0, 120);
  const cleanKelas = String(payload.kelas || '').trim().slice(0, 40);
  const cleanJurusan = String(payload.jurusan || '').trim().slice(0, 80);
  const cleanUsername = String(payload.username || cleanNisn)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .slice(0, 60);
  const cleanPassword = String(payload.password || 'smk12345');

  if (
    cleanNisn.length < 4 ||
    cleanName.length < 2 ||
    cleanKelas.length < 2 ||
    cleanJurusan.length < 2
  ) {
    throw new Error('NISN, Nama Lengkap, Kelas, dan Jurusan wajib diisi.');
  }
  if (cleanUsername.length < 3 || cleanPassword.length < 4) {
    throw new Error('Username (min 3) dan password (min 4) wajib valid.');
  }
  if (isStudentUsernameTaken(accounts, cleanUsername)) {
    throw new Error(`Username siswa "${cleanUsername}" sudah digunakan.`);
  }

  const sid = `stu_${randomHex(8)}`;
  const now = new Date().toISOString();
  workspace.students[sid] = {
    id: sid,
    ownerId: 'staff_admin',
    nisn: cleanNisn,
    namaLengkap: cleanName,
    jenisKelamin: payload.jenisKelamin === 'P' ? 'P' : 'L',
    kelas: cleanKelas,
    jurusan: cleanJurusan,
    portalUsername: cleanUsername,
    latestScore: 0,
    latestCategory: 'Sedang',
    latestCondition: 'cukup',
    createdAt: now,
    updatedAt: now,
  };

  accounts.credentials[sid] = {
    studentId: sid,
    username: cleanUsername,
    passwordHash: hashLocalPassword(cleanPassword),
    aktif: payload.aktif !== false,
  };

  saveWorkspaceStore(workspace);
  saveAccountsStore(accounts);

  return {
    studentId: sid,
    nisn: cleanNisn,
    namaLengkap: cleanName,
    kelas: cleanKelas,
    jurusan: cleanJurusan,
    username: cleanUsername,
    aktif: payload.aktif !== false,
  };
}

export function localUpdateStudentAccount(
  studentId: string,
  updates: {
    username?: string;
    newPassword?: string;
    aktif?: boolean;
    namaLengkap?: string;
    kelas?: string;
    jurusan?: string;
  }
): StudentAccountSummary {
  requireLocalAdmin();
  const accounts = loadAccountsStore();
  const workspace = loadWorkspaceStore();
  const student = workspace.students[studentId];
  if (!student) {
    throw new Error('Data siswa tidak ditemukan.');
  }

  let cred = accounts.credentials[studentId];
  if (!cred) {
    cred = {
      studentId,
      username: String(student.portalUsername || student.nisn || studentId).toLowerCase(),
      passwordHash: hashLocalPassword('smk12345'),
      aktif: true,
    };
    accounts.credentials[studentId] = cred;
  }

  if (updates.username !== undefined) {
    const nextUser = String(updates.username)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '.')
      .slice(0, 60);
    if (nextUser.length < 3) {
      throw new Error('Username siswa minimal 3 karakter.');
    }
    if (isStudentUsernameTaken(accounts, nextUser, studentId)) {
      throw new Error(`Username "${nextUser}" sudah dipakai siswa lain.`);
    }
    cred.username = nextUser;
    student.portalUsername = nextUser;
  }

  if (updates.newPassword !== undefined && String(updates.newPassword).length > 0) {
    if (String(updates.newPassword).length < 4) {
      throw new Error('Password baru siswa minimal 4 karakter.');
    }
    cred.passwordHash = hashLocalPassword(String(updates.newPassword));
  }

  if (updates.aktif !== undefined) {
    cred.aktif = Boolean(updates.aktif);
  }
  if (updates.namaLengkap !== undefined && String(updates.namaLengkap).trim().length >= 2) {
    student.namaLengkap = String(updates.namaLengkap).trim().slice(0, 120);
  }
  if (updates.kelas !== undefined && String(updates.kelas).trim().length >= 2) {
    student.kelas = String(updates.kelas).trim().slice(0, 40);
  }
  if (updates.jurusan !== undefined && String(updates.jurusan).trim().length >= 2) {
    student.jurusan = String(updates.jurusan).trim().slice(0, 80);
  }

  saveWorkspaceStore(workspace);
  saveAccountsStore(accounts);

  return {
    studentId,
    nisn: String(student.nisn || ''),
    namaLengkap: String(student.namaLengkap || ''),
    kelas: String(student.kelas || ''),
    jurusan: String(student.jurusan || ''),
    username: cred.username,
    aktif: cred.aktif !== false,
  };
}

export function localDeleteStudentAccount(studentId: string): void {
  requireLocalAdmin();
  const accounts = loadAccountsStore();
  const workspace = loadWorkspaceStore();
  if (!workspace.students[studentId] && !accounts.credentials[studentId]) {
    throw new Error('Akun siswa tidak ditemukan.');
  }
  delete accounts.credentials[studentId];
  delete workspace.students[studentId];
  saveAccountsStore(accounts);
  saveWorkspaceStore(workspace);
}

// ============================================================
// LOCAL STUDENT AUTHENTICATION & PORTAL
// ============================================================

export function localLoginStudent(
  usernameInput: string,
  passwordInput: string
): { session: StudentSession; portal: StudentPortalData } {
  const accounts = loadAccountsStore();
  const workspace = loadWorkspaceStore();
  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = String(passwordInput || '');

  if (!cleanUser || !cleanPass) {
    throw new Error('Username dan password wajib diisi.');
  }

  const cred = Object.values(accounts.credentials).find(
    (c) => c.username.toLowerCase() === cleanUser
  );

  if (!cred || !verifyLocalPassword(cleanPass, cred.passwordHash)) {
    throw new Error(
      'Username atau password siswa tidak cocok. Gunakan username (default NISN) dari Wali Kelas atau daftarkan akun siswa baru.'
    );
  }

  if (cred.aktif === false) {
    throw new Error('Akun siswa ini sedang dinonaktifkan oleh Admin sekolah.');
  }

  const portal = buildLocalPortalData(workspace, cred.studentId);
  if (!portal) {
    throw new Error('Data biodata siswa belum ditemukan di sistem.');
  }

  const session: StudentSession = {
    token: `local_stu_${cred.studentId}_${randomHex(8)}`,
    username: cred.username,
    studentId: cred.studentId,
  };

  saveLocalStudentSession(session);
  return { session, portal };
}

export function localRegisterStudent(payload: {
  nisn: string;
  namaLengkap: string;
  jenisKelamin: 'L' | 'P';
  kelas: string;
  jurusan: string;
  username: string;
  password: string;
  noHp?: string;
  namaOrangTua?: string;
  nomorOrangTua?: string;
  alamat?: string;
}): { session: StudentSession; portal: StudentPortalData } {
  const accounts = loadAccountsStore();
  const workspace = loadWorkspaceStore();

  const cleanNisn = String(payload.nisn || '').trim().slice(0, 20);
  const cleanName = String(payload.namaLengkap || '').trim().slice(0, 120);
  const cleanKelas = String(payload.kelas || '').trim().slice(0, 40);
  const cleanJurusan = String(payload.jurusan || '').trim().slice(0, 80);
  const cleanUsername = String(payload.username || cleanNisn)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .slice(0, 60);
  const cleanPassword = String(payload.password || '');

  if (cleanNisn.length < 4 || cleanName.length < 2) {
    throw new Error('NISN (minimal 4 karakter) dan Nama Lengkap wajib diisi.');
  }
  if (cleanKelas.length < 2 || cleanJurusan.length < 2) {
    throw new Error('Kelas dan Jurusan wajib diisi.');
  }
  if (cleanUsername.length < 3) {
    throw new Error('Username minimal 3 karakter.');
  }
  if (cleanPassword.length < 4) {
    throw new Error('Password minimal 4 karakter.');
  }
  if (isStudentUsernameTaken(accounts, cleanUsername)) {
    throw new Error('Username sudah dipakai siswa lain. Pilih username berbeda.');
  }

  const duplicateNisn = Object.values(workspace.students).find(
    (s) => String(s.nisn || '').trim() === cleanNisn
  );
  if (duplicateNisn) {
    throw new Error(
      'NISN sudah terdaftar di sistem sekolah. Silakan masuk menggunakan username (NISN Anda) dan password dari sekolah.'
    );
  }

  const studentId = `stu_${randomHex(8)}`;
  const now = new Date().toISOString();
  workspace.students[studentId] = {
    id: studentId,
    ownerId: 'staff_admin',
    nisn: cleanNisn,
    namaLengkap: cleanName,
    jenisKelamin: payload.jenisKelamin === 'P' ? 'P' : 'L',
    kelas: cleanKelas,
    jurusan: cleanJurusan,
    noHp: String(payload.noHp || '').trim().slice(0, 30),
    namaOrangTua: String(payload.namaOrangTua || '').trim().slice(0, 120),
    nomorOrangTua: String(payload.nomorOrangTua || '').trim().slice(0, 30),
    alamat: String(payload.alamat || '').trim().slice(0, 300),
    portalUsername: cleanUsername,
    latestScore: 0,
    latestCategory: 'Sedang',
    latestCondition: 'cukup',
    createdAt: now,
    updatedAt: now,
  };

  accounts.credentials[studentId] = {
    studentId,
    username: cleanUsername,
    passwordHash: hashLocalPassword(cleanPassword),
    aktif: true,
  };

  saveWorkspaceStore(workspace);
  saveAccountsStore(accounts);

  const portal = buildLocalPortalData(workspace, studentId);
  if (!portal) {
    throw new Error('Gagal menyiapkan data portal siswa.');
  }

  const session: StudentSession = {
    token: `local_stu_${studentId}_${randomHex(8)}`,
    username: cleanUsername,
    studentId,
  };
  saveLocalStudentSession(session);
  return { session, portal };
}

function resolveActiveLocalStudentId(token: string): string {
  const saved = getSavedLocalStudentSession();
  if (saved && saved.token === token) {
    return saved.studentId;
  }
  if (token.startsWith('local_stu_')) {
    const rest = token.slice('local_stu_'.length);
    const lastIdx = rest.lastIndexOf('_');
    const studentId = lastIdx > 0 ? rest.slice(0, lastIdx) : rest;
    const accounts = loadAccountsStore();
    if (accounts.credentials[studentId] && accounts.credentials[studentId].aktif !== false) {
      return studentId;
    }
  }
  throw new Error('Sesi siswa berakhir. Silakan login kembali.');
}

export function localFetchStudentPortal(token: string): StudentPortalData {
  const studentId = resolveActiveLocalStudentId(token);
  const workspace = loadWorkspaceStore();
  const portal = buildLocalPortalData(workspace, studentId);
  if (!portal) {
    throw new Error('Data siswa tidak ditemukan.');
  }
  return portal;
}

export function localSubmitStudentAssessment(
  token: string,
  payload: {
    tanggungJawab: number;
    disiplin: number;
    inisiatif: number;
    pengambilanKeputusan: number;
    manajemenDiri: number;
    notes?: string;
    pernyataanBaik?: string;
  }
): StudentPortalData {
  const studentId = resolveActiveLocalStudentId(token);
  const workspace = loadWorkspaceStore();
  const student = workspace.students[studentId];
  if (!student) {
    throw new Error('Data siswa tidak ditemukan.');
  }

  const clampLikert = (val: unknown) => Math.min(5, Math.max(1, Number(val) || 3));
  const tanggungJawab = clampLikert(payload.tanggungJawab);
  const disiplin = clampLikert(payload.disiplin);
  const inisiatif = clampLikert(payload.inisiatif);
  const pengambilanKeputusan = clampLikert(payload.pengambilanKeputusan);
  const manajemenDiri = clampLikert(payload.manajemenDiri);

  const totalScore = Math.round(
    ((tanggungJawab + disiplin + inisiatif + pengambilanKeputusan + manajemenDiri) / 25) * 100
  );
  const category = computeCategory(totalScore);
  const today = new Date().toISOString().slice(0, 10);
  const rawNotes = String(payload.notes || '').trim();
  const notes = rawNotes
    ? `[Penilaian Mandiri Siswa] ${rawNotes}`.slice(0, 500)
    : '[Penilaian Mandiri Siswa] Asesmen refleksi kemandirian diisi langsung oleh siswa.';

  workspace.diagnostics.push({
    id: `diag_stu_${randomHex(6)}`,
    ownerId: student.ownerId || 'staff_admin',
    studentId,
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
  });

  student.latestScore = totalScore;
  student.latestCategory = category;

  const rawStatement = String(payload.pernyataanBaik || '').trim().slice(0, 400);
  if (rawStatement.length >= 3) {
    workspace.goodStatements.push({
      id: `stmt_stu_${randomHex(6)}`,
      ownerId: student.ownerId || 'staff_admin',
      studentId,
      studentName: String(student.namaLengkap || ''),
      kelas: String(student.kelas || ''),
      kalimat: rawStatement,
      sumber: 'manual',
      tanggal: today,
    });
  }

  saveWorkspaceStore(workspace);
  const portal = buildLocalPortalData(workspace, studentId);
  if (!portal) throw new Error('Gagal memperbarui data portal.');
  return portal;
}

export function localUpdateStudentBiodata(
  token: string,
  payload: {
    namaLengkap: string;
    jenisKelamin: 'L' | 'P';
    kelas: string;
    jurusan: string;
    noHp: string;
    namaOrangTua: string;
    nomorOrangTua: string;
    alamat: string;
    portalUsername: string;
    newPassword?: string;
  }
): { session: StudentSession; portal: StudentPortalData } {
  const studentId = resolveActiveLocalStudentId(token);
  const accounts = loadAccountsStore();
  const workspace = loadWorkspaceStore();
  const student = workspace.students[studentId];
  const cred = accounts.credentials[studentId];
  if (!student || !cred) {
    throw new Error('Data akun siswa tidak ditemukan.');
  }

  const cleanName = String(payload.namaLengkap ?? student.namaLengkap ?? '').trim().slice(0, 120);
  if (cleanName.length < 2) {
    throw new Error('Nama lengkap minimal 2 karakter.');
  }

  const nextUsername = String(payload.portalUsername ?? cred.username)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .slice(0, 60);

  if (nextUsername.length < 3) {
    throw new Error('Username minimal 3 karakter.');
  }
  if (isStudentUsernameTaken(accounts, nextUsername, studentId)) {
    throw new Error('Username sudah digunakan oleh siswa lain.');
  }

  if (payload.newPassword !== undefined && String(payload.newPassword).length > 0) {
    if (String(payload.newPassword).length < 4) {
      throw new Error('Password baru minimal 4 karakter.');
    }
    cred.passwordHash = hashLocalPassword(String(payload.newPassword));
  }
  cred.username = nextUsername;

  student.namaLengkap = cleanName;
  student.jenisKelamin = payload.jenisKelamin === 'P' ? 'P' : 'L';
  student.kelas = String(payload.kelas ?? student.kelas ?? '').trim().slice(0, 40) || student.kelas;
  student.jurusan =
    String(payload.jurusan ?? student.jurusan ?? '').trim().slice(0, 80) || student.jurusan;
  student.noHp = String(payload.noHp ?? student.noHp ?? '').trim().slice(0, 30);
  student.namaOrangTua = String(payload.namaOrangTua ?? student.namaOrangTua ?? '')
    .trim()
    .slice(0, 120);
  student.nomorOrangTua = String(payload.nomorOrangTua ?? student.nomorOrangTua ?? '')
    .trim()
    .slice(0, 30);
  student.alamat = String(payload.alamat ?? student.alamat ?? '').trim().slice(0, 300);
  student.portalUsername = nextUsername;
  student.updatedAt = new Date().toISOString();

  saveWorkspaceStore(workspace);
  saveAccountsStore(accounts);

  const session: StudentSession = {
    token: `local_stu_${studentId}_${randomHex(8)}`,
    username: nextUsername,
    studentId,
  };
  saveLocalStudentSession(session);

  const portal = buildLocalPortalData(workspace, studentId);
  if (!portal) throw new Error('Gagal memuat ulang portal siswa.');
  return { session, portal };
}

export function localSetStudentPortalCredentials(payload: {
  studentId: string;
  username: string;
  password?: string;
  student?: Partial<Student>;
}): void {
  const accounts = loadAccountsStore();
  const workspace = loadWorkspaceStore();
  const cleanId = String(payload.studentId || '').trim();
  if (!cleanId) {
    throw new Error('studentId wajib disertakan.');
  }

  const existingStudent = workspace.students[cleanId] || ({} as Student);
  const mergedStudent: Student = payload.student
    ? ({ ...existingStudent, ...payload.student, id: cleanId } as Student)
    : existingStudent;

  const targetUsername = String(
    payload.username || mergedStudent.portalUsername || mergedStudent.nisn || cleanId
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .slice(0, 60);

  if (targetUsername.length < 3) {
    throw new Error('Username siswa minimal 3 karakter.');
  }
  if (isStudentUsernameTaken(accounts, targetUsername, cleanId)) {
    throw new Error(`Username "${targetUsername}" sudah digunakan siswa lain.`);
  }

  mergedStudent.portalUsername = targetUsername;
  workspace.students[cleanId] = mergedStudent;

  const existingCred = accounts.credentials[cleanId];
  const cleanPassword = String(payload.password || '');
  if (cleanPassword.length > 0 && cleanPassword.length < 4) {
    throw new Error('Password siswa minimal 4 karakter.');
  }

  accounts.credentials[cleanId] = {
    studentId: cleanId,
    username: targetUsername,
    passwordHash:
      cleanPassword.length >= 4
        ? hashLocalPassword(cleanPassword)
        : existingCred?.passwordHash || hashLocalPassword('smk12345'),
    aktif: existingCred?.aktif !== false,
  };

  saveWorkspaceStore(workspace);
  saveAccountsStore(accounts);
}
