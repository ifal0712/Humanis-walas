import type {
  CoachingProcess,
  Diagnostic,
  GoodStatement,
  HumanisProgress,
  Observation,
  ReportRecord,
  RoleAssignment,
  StaffAccountSummary,
  StaffRole,
  StaffSession,
  Student,
  StudentAccountSummary,
  ThemeSetting,
} from '../types/humanis';
import { apiFetchJson } from './apiClient';

// Keep non-Firebase Bearer tokens strictly in JS memory (never localStorage/sessionStorage)
let inMemoryStaffToken: string | null = null;
let workspaceChangedListener: (() => void) | null = null;

export function setStaffAuthToken(token: string | null): void {
  inMemoryStaffToken = token;
}

export function getStaffAuthToken(): string | null {
  return inMemoryStaffToken;
}

export function onStaffWorkspaceMutated(cb: (() => void) | null): void {
  workspaceChangedListener = cb;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (inMemoryStaffToken) {
    headers.Authorization = `Bearer ${inMemoryStaffToken}`;
  }
  return headers;
}

export async function loginStaffCredentials(
  username: string,
  password: string
): Promise<StaffSession> {
  const data = await apiFetchJson<{
    token: string;
    user: {
      id: string;
      username: string;
      displayName: string;
      email: string;
      nip?: string;
      staffRole: StaffRole;
    };
  }>(
    '/api/staff/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    'Gagal masuk sebagai Admin / Staf.'
  );
  inMemoryStaffToken = data.token;
  return {
    token: data.token,
    id: data.user.id,
    username: data.user.username,
    displayName: data.user.displayName,
    email: data.user.email,
    nip: data.user.nip,
    staffRole: data.user.staffRole,
  };
}

export async function exchangeFirebaseTokenForStaffToken(
  idToken: string,
  preferredRole?: StaffRole
): Promise<string | null> {
  try {
    const data = await apiFetchJson<{ token?: string }>(
      '/api/staff/firebase-exchange',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, preferredRole }),
      },
      'Gagal menukar sesi Google.'
    );
    if (data.token) {
      inMemoryStaffToken = data.token;
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

export interface StaffWorkspaceSnapshot {
  students: Student[];
  diagnostics: Diagnostic[];
  humanisList: HumanisProgress[];
  observations: Observation[];
  processes: CoachingProcess[];
  goodStatements: GoodStatement[];
  reports: ReportRecord[];
  roleAssignments: RoleAssignment[];
  theme: ThemeSetting | null;
}

export async function fetchStaffWorkspace(): Promise<StaffWorkspaceSnapshot> {
  return apiFetchJson<StaffWorkspaceSnapshot>(
    '/api/staff/workspace',
    { headers: authHeaders() },
    'Gagal memuat ruang kerja staf.'
  );
}

export async function mutateStaffWorkspace(
  action: string,
  payload?: Record<string, unknown>,
  id?: string
): Promise<{ id?: string; ok?: boolean }> {
  const data = await apiFetchJson<{ id?: string; ok?: boolean }>(
    '/api/staff/workspace/mutate',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action, id, payload }),
    },
    'Gagal menyimpan perubahan ke server.'
  );
  if (workspaceChangedListener) {
    workspaceChangedListener();
  }
  return data;
}

// --- Registered Accounts Management (Admin Only) ---

export async function fetchRegisteredAccounts(): Promise<{
  staffAccounts: StaffAccountSummary[];
  studentAccounts: StudentAccountSummary[];
}> {
  return apiFetchJson<{
    staffAccounts: StaffAccountSummary[];
    studentAccounts: StudentAccountSummary[];
  }>('/api/staff/accounts', { headers: authHeaders() }, 'Gagal memuat daftar akun terdaftar.');
}

export async function createRegisteredStaffAccount(payload: {
  username: string;
  password: string;
  nama: string;
  nip?: string;
  email?: string;
  role: StaffRole;
  kelasBinaan?: string;
  aktif?: boolean;
  permissions?: string[];
}): Promise<StaffAccountSummary> {
  const data = await apiFetchJson<{ account: StaffAccountSummary }>(
    '/api/staff/accounts/staff',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
    'Gagal membuat akun staf baru.'
  );
  return data.account;
}

export async function updateRegisteredStaffAccount(
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
): Promise<StaffAccountSummary> {
  const data = await apiFetchJson<{ account: StaffAccountSummary }>(
    `/api/staff/accounts/staff/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    },
    'Gagal memperbarui akun staf.'
  );
  return data.account;
}

export async function deleteRegisteredStaffAccount(id: string): Promise<void> {
  await apiFetchJson<{ ok: boolean }>(
    `/api/staff/accounts/staff/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
    'Gagal menghapus akun staf.'
  );
}

export async function createRegisteredStudentAccount(payload: {
  nisn: string;
  namaLengkap: string;
  jenisKelamin: 'L' | 'P';
  kelas: string;
  jurusan: string;
  username: string;
  password: string;
  aktif?: boolean;
}): Promise<StudentAccountSummary> {
  const data = await apiFetchJson<{ account: StudentAccountSummary }>(
    '/api/staff/accounts/student',
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
    'Gagal membuat akun siswa.'
  );
  if (workspaceChangedListener) workspaceChangedListener();
  return data.account;
}

export async function updateRegisteredStudentAccount(
  studentId: string,
  updates: {
    username?: string;
    newPassword?: string;
    aktif?: boolean;
    namaLengkap?: string;
    kelas?: string;
    jurusan?: string;
  }
): Promise<StudentAccountSummary> {
  const data = await apiFetchJson<{ account: StudentAccountSummary }>(
    `/api/staff/accounts/student/${encodeURIComponent(studentId)}`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    },
    'Gagal memperbarui akun siswa.'
  );
  if (workspaceChangedListener) workspaceChangedListener();
  return data.account;
}

export async function deleteRegisteredStudentAccount(studentId: string): Promise<void> {
  await apiFetchJson<{ ok: boolean }>(
    `/api/staff/accounts/student/${encodeURIComponent(studentId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
    'Gagal menghapus akun siswa.'
  );
}
