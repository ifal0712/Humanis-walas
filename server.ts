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
  'humanis-smk-student-session-secret-v1';

app.use(express.json({ limit: '4mb' }));

// --- Student Portal Persistent Store & Crypto Helpers ---

interface StudentCredentialRecord {
  studentId: string;
  username: string;
  passwordHash: string;
}

interface StudentPortalStore {
  credentials: Record<string, StudentCredentialRecord>;
  students: Record<string, Record<string, unknown>>;
  diagnostics: Array<Record<string, unknown>>;
  humanis: Record<string, Record<string, unknown>>;
  observations: Array<Record<string, unknown>>;
  processes: Array<Record<string, unknown>>;
  goodStatements: Array<Record<string, unknown>>;
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

function createEmptyStore(): StudentPortalStore {
  return {
    credentials: {},
    students: {},
    diagnostics: [],
    humanis: {},
    observations: [],
    processes: [],
    goodStatements: [],
    pendingRegistrations: [],
    pendingProfileUpdates: [],
    pendingAssessments: [],
  };
}

function loadStore(): StudentPortalStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StudentPortalStore>;
      return {
        ...createEmptyStore(),
        ...parsed,
      };
    }
  } catch (err) {
    console.error('Failed to read student portal store:', err);
  }
  return createEmptyStore();
}

function saveStore(store: StudentPortalStore): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist student portal store:', err);
  }
}

let studentStore: StudentPortalStore = loadStore();

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

function signStudentToken(studentId: string, username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      studentId,
      username,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyStudentToken(token: string): { studentId: string; username: string } | null {
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
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      studentId: string;
      username: string;
      exp: number;
    };
    if (!decoded.studentId || decoded.exp < Date.now()) return null;
    return { studentId: decoded.studentId, username: decoded.username };
  } catch {
    return null;
  }
}

function extractBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

function computeCategory(score: number): string {
  if (score < 35) return 'Sangat Rendah';
  if (score < 55) return 'Rendah';
  if (score < 70) return 'Sedang';
  if (score < 85) return 'Baik';
  return 'Sangat Baik';
}

function buildPortalData(studentId: string) {
  const student = studentStore.students[studentId];
  if (!student) return null;
  const diagnostics = studentStore.diagnostics
    .filter((d) => d.studentId === studentId)
    .sort((a, b) => String(b.assessedDate || '').localeCompare(String(a.assessedDate || '')));
  const observations = studentStore.observations
    .filter((o) => o.studentId === studentId)
    .sort((a, b) => String(a.tanggal || '').localeCompare(String(b.tanggal || '')));
  const processes = studentStore.processes
    .filter((p) => p.studentId === studentId)
    .sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
  const goodStatements = studentStore.goodStatements
    .filter((g) => g.studentId === studentId)
    .sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
  const humanis = studentStore.humanis[studentId] || null;

  return {
    student,
    diagnostics,
    humanis,
    observations,
    processes,
    goodStatements,
  };
}

function findCredentialByUsername(usernameInput: string): StudentCredentialRecord | null {
  const target = usernameInput.trim().toLowerCase();
  if (!target) return null;
  for (const cred of Object.values(studentStore.credentials)) {
    if (cred.username.toLowerCase() === target) {
      return cred;
    }
  }
  return null;
}

function isUsernameTaken(username: string, excludeStudentId?: string): boolean {
  const target = username.trim().toLowerCase();
  return Object.values(studentStore.credentials).some(
    (c) => c.username.toLowerCase() === target && c.studentId !== excludeStudentId
  );
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

// --- Student Auth & Portal Endpoints ---

// 1. Login Siswa (Username & Password)
app.post('/api/student/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  if (!cleanUser || !cleanPass) {
    res.status(400).json({ error: 'Username dan password wajib diisi.' });
    return;
  }

  const cred = findCredentialByUsername(cleanUser);
  if (!cred || !verifyPassword(cleanPass, cred.passwordHash)) {
    res.status(401).json({
      error:
        'Username atau password siswa tidak cocok. Gunakan username (default NISN) dari Wali Kelas atau daftarkan akun siswa baru.',
    });
    return;
  }

  const portal = buildPortalData(cred.studentId);
  if (!portal) {
    res.status(404).json({ error: 'Data biodata siswa belum ditemukan di sistem.' });
    return;
  }

  const token = signStudentToken(cred.studentId, cred.username);
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
  if (isUsernameTaken(cleanUsername)) {
    res.status(409).json({ error: 'Username sudah dipakai siswa lain. Pilih username berbeda.' });
    return;
  }

  const duplicateNisn = Object.values(studentStore.students).find(
    (s) => String(s.nisn || '').trim() === cleanNisn
  );
  if (duplicateNisn) {
    res.status(409).json({
      error:
        'NISN sudah terdaftar oleh Wali Kelas/Operator. Silakan langsung masuk menggunakan username (NISN Anda) dan password dari sekolah.',
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

  studentStore.students[tempStudentId] = studentRecord;
  studentStore.credentials[tempStudentId] = {
    studentId: tempStudentId,
    username: cleanUsername,
    passwordHash: hashPassword(cleanPassword),
  };
  studentStore.pendingRegistrations.push({
    tempStudentId,
    student: studentRecord,
    createdAt: new Date().toISOString(),
  });
  saveStore(studentStore);

  const token = signStudentToken(tempStudentId, cleanUsername);
  res.status(201).json({
    token,
    username: cleanUsername,
    studentId: tempStudentId,
    portal: buildPortalData(tempStudentId),
  });
});

// 3. Get Authenticated Student Portal Data
app.get('/api/student/portal', (req, res) => {
  const token = extractBearerToken(req);
  const authSession = token ? verifyStudentToken(token) : null;
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

// 4. Submit Penilaian Mandiri Siswa (Skala Likert 1-5 + Catatan Refleksi & Pernyataan Baik)
app.post('/api/student/assessment', (req, res) => {
  const token = extractBearerToken(req);
  const authSession = token ? verifyStudentToken(token) : null;
  if (!authSession) {
    res.status(401).json({ error: 'Sesi siswa berakhir. Silakan login kembali.' });
    return;
  }

  const student = studentStore.students[authSession.studentId];
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

  studentStore.diagnostics.push(diagnosticRecord);
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
    studentStore.goodStatements.push(statementRecord);
  }

  studentStore.pendingAssessments.push({
    id: `pa_${crypto.randomBytes(6).toString('hex')}`,
    studentId: authSession.studentId,
    diagnostic: diagnosticRecord,
    statement: statementRecord,
    createdAt: new Date().toISOString(),
  });

  saveStore(studentStore);
  res.json(buildPortalData(authSession.studentId));
});

// 5. Perbarui Biodata Siswa (oleh Siswa Sendiri)
app.put('/api/student/profile', (req, res) => {
  const token = extractBearerToken(req);
  const authSession = token ? verifyStudentToken(token) : null;
  if (!authSession) {
    res.status(401).json({ error: 'Sesi siswa berakhir. Silakan login kembali.' });
    return;
  }

  const student = studentStore.students[authSession.studentId];
  const cred = studentStore.credentials[authSession.studentId];
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
  if (isUsernameTaken(nextUsername, authSession.studentId)) {
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
  studentStore.pendingProfileUpdates.push({
    id: `pp_${crypto.randomBytes(6).toString('hex')}`,
    studentId: authSession.studentId,
    updates,
    createdAt: new Date().toISOString(),
  });
  saveStore(studentStore);

  const refreshedToken = signStudentToken(authSession.studentId, nextUsername);
  res.json({
    token: refreshedToken,
    username: nextUsername,
    portal: buildPortalData(authSession.studentId),
  });
});

// 6. Staff: Set/Reset Student Portal Credentials
app.post('/api/student/set-credentials', (req, res) => {
  const { studentId, username, password, student } = req.body || {};
  const cleanId = String(studentId || '').trim();
  if (!cleanId) {
    res.status(400).json({ error: 'studentId wajib disertakan.' });
    return;
  }

  const existingStudent = studentStore.students[cleanId] || {};
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
  if (isUsernameTaken(targetUsername, cleanId)) {
    res.status(409).json({ error: `Username "${targetUsername}" sudah digunakan siswa lain.` });
    return;
  }

  mergedStudent.portalUsername = targetUsername;
  studentStore.students[cleanId] = mergedStudent;

  const existingCred = studentStore.credentials[cleanId];
  const cleanPassword = String(password || '');
  if (cleanPassword.length > 0 && cleanPassword.length < 4) {
    res.status(400).json({ error: 'Password siswa minimal 4 karakter.' });
    return;
  }

  studentStore.credentials[cleanId] = {
    studentId: cleanId,
    username: targetUsername,
    passwordHash:
      cleanPassword.length >= 4
        ? hashPassword(cleanPassword)
        : existingCred?.passwordHash || hashPassword('smk12345'),
  };

  saveStore(studentStore);
  res.json({ ok: true, username: targetUsername });
});

// 7. Staff: Pull Pending Student Registrations / Biodata Edits / Self-Assessments
app.get('/api/student/pending-updates', (_req, res) => {
  res.json({
    pendingRegistrations: studentStore.pendingRegistrations,
    pendingProfileUpdates: studentStore.pendingProfileUpdates,
    pendingAssessments: studentStore.pendingAssessments,
  });
});

// 8. Staff: Acknowledge Pending Updates & Remap Temp Student IDs to Firestore IDs
app.post('/api/student/ack-pending', (req, res) => {
  const {
    remappedIds = [],
    processedProfileUpdateIds = [],
    processedAssessmentIds = [],
  } = req.body || {} as {
    remappedIds?: Array<{ tempStudentId: string; firestoreId: string }>;
    processedProfileUpdateIds?: string[];
    processedAssessmentIds?: string[];
  };

  for (const mapping of remappedIds) {
    const { tempStudentId, firestoreId } = mapping;
    if (!tempStudentId || !firestoreId) continue;

    if (studentStore.students[tempStudentId]) {
      const stu = studentStore.students[tempStudentId];
      stu.id = firestoreId;
      studentStore.students[firestoreId] = stu;
      delete studentStore.students[tempStudentId];
    }
    if (studentStore.credentials[tempStudentId]) {
      const cred = studentStore.credentials[tempStudentId];
      cred.studentId = firestoreId;
      studentStore.credentials[firestoreId] = cred;
      delete studentStore.credentials[tempStudentId];
    }
    for (const d of studentStore.diagnostics) {
      if (d.studentId === tempStudentId) d.studentId = firestoreId;
    }
    for (const s of studentStore.goodStatements) {
      if (s.studentId === tempStudentId) s.studentId = firestoreId;
    }
    for (const pa of studentStore.pendingAssessments) {
      if (pa.studentId === tempStudentId) {
        pa.studentId = firestoreId;
        pa.diagnostic.studentId = firestoreId;
        if (pa.statement) pa.statement.studentId = firestoreId;
      }
    }
    for (const pp of studentStore.pendingProfileUpdates) {
      if (pp.studentId === tempStudentId) pp.studentId = firestoreId;
    }
  }

  const regTemps = new Set(remappedIds.map((r: { tempStudentId: string }) => r.tempStudentId));
  studentStore.pendingRegistrations = studentStore.pendingRegistrations.filter(
    (r) => !regTemps.has(r.tempStudentId)
  );

  const profSet = new Set(processedProfileUpdateIds as string[]);
  studentStore.pendingProfileUpdates = studentStore.pendingProfileUpdates.filter(
    (p) => !profSet.has(p.id)
  );

  const assessSet = new Set(processedAssessmentIds as string[]);
  studentStore.pendingAssessments = studentStore.pendingAssessments.filter(
    (a) => !assessSet.has(a.id)
  );

  saveStore(studentStore);
  res.json({ ok: true });
});

// 9. Staff: Sync Firestore Snapshot to Student Portal Store
app.post('/api/student/sync-from-staff', (req, res) => {
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

      // Avoid clobbering un-synced student profile edits
      const hasPendingProfile = studentStore.pendingProfileUpdates.some((p) => p.studentId === sid);
      if (!hasPendingProfile) {
        studentStore.students[sid] = {
          ...s,
          portalUsername: preferredUsername,
        };
      }

      if (!studentStore.credentials[sid]) {
        const finalUsername = isUsernameTaken(preferredUsername, sid)
          ? `${preferredUsername}.${sid.slice(-4).toLowerCase()}`
          : preferredUsername;
        studentStore.credentials[sid] = {
          studentId: sid,
          username: finalUsername,
          passwordHash: hashPassword('smk12345'),
        };
      }
    }
  }

  if (Array.isArray(diagnostics)) {
    const pendingDiagIds = new Set(
      studentStore.pendingAssessments.map((p) => String(p.diagnostic.id || ''))
    );
    const pendingDiags = studentStore.diagnostics.filter((d) =>
      pendingDiagIds.has(String(d.id || ''))
    );
    studentStore.diagnostics = [...diagnostics, ...pendingDiags];
  }

  if (Array.isArray(humanisList)) {
    const nextHumanis: Record<string, Record<string, unknown>> = {};
    for (const h of humanisList) {
      if (h?.studentId) nextHumanis[String(h.studentId)] = h;
    }
    studentStore.humanis = nextHumanis;
  }

  if (Array.isArray(observations)) {
    studentStore.observations = observations;
  }

  if (Array.isArray(processes)) {
    studentStore.processes = processes;
  }

  if (Array.isArray(statements)) {
    const pendingStmtIds = new Set(
      studentStore.pendingAssessments
        .map((p) => (p.statement ? String(p.statement.id || '') : ''))
        .filter(Boolean)
    );
    const pendingStmts = studentStore.goodStatements.filter((g) =>
      pendingStmtIds.has(String(g.id || ''))
    );
    studentStore.goodStatements = [...statements, ...pendingStmts];
  }

  saveStore(studentStore);
  res.json({ ok: true, syncedStudents: Object.keys(studentStore.students).length });
});

// AI Endpoint 1: Analisis Individu Siswa (Diagnostik + Observasi + Tahap HUMANIS + Proses + Pernyataan Baik)
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

// AI Endpoint 2: AI Insight Kelas / Sekolah untuk Dashboard Utama
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
