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
import { ApiUnavailableError, apiFetchJson } from './apiClient';
import {
  ensureDefaultAdminProvisioned,
  getSavedLocalStaffSession,
  isLocalStaffToken,
  localCreateStaffAccount,
  localCreateStudentAccount,
  localDeleteStaffAccount,
  localDeleteStudentAccount,
  localFetchRegisteredAccounts,
  localFetchStaffWorkspace,
  localLoginStaff,
  localMutateStaffWorkspace,
  localUpdateStaffAccount,
  localUpdateStudentAccount,
  saveLocalStaffSession,
} from './localAuthStore';

// Initialize default admin ('admin' / 'admin123') and hydrate saved session if present
ensureDefaultAdminProvisioned();
const initialSavedSession = getSavedLocalStaffSession();

let inMemoryStaffToken: string | null = initialSavedSession?.token || null;
let preferServerWorkspace = Boolean(initialSavedSession);
let workspaceChangedListener: (() => void) | null = null;

export function getSavedStaffSession(): StaffSession | null {
  const saved = getSavedLocalStaffSession();
  if (saved) {
    inMemoryStaffToken = saved.token;
    preferServerWorkspace = true;
  }
  return saved;
}

export function clearSavedStaffSession(): void {
  inMemoryStaffToken = null;
  preferServerWorkspace = false;
  saveLocalStaffSession(null);
}

export function setStaffAuthToken(token: string | null): void {
  inMemoryStaffToken = token;
  if (!token) {
    preferServerWorkspace = false;
    saveLocalStaffSession(null);
  }
}

export function getStaffAuthToken(): string | null {
  return inMemoryStaffToken;
}

export function setPreferServerWorkspace(enabled: boolean): void {
  preferServerWorkspace = enabled;
}

export function isServerWorkspacePreferred(): boolean {
  return preferServerWorkspace;
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
  ensureDefaultAdminProvisioned();
  try {
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
    const session: StaffSession = {
      token: data.token,
      id: data.user.id,
      username: data.user.username,
      displayName: data.user.displayName,
      email: data.user.email,
      nip: data.user.nip,
      staffRole: data.user.staffRole,
    };
    inMemoryStaffToken = session.token;
    preferServerWorkspace = true;
    saveLocalStaffSession(session);
    return session;
  } catch (err) {
    if (err instanceof ApiUnavailableError) {
      const localSession = localLoginStaff(username, password);
      inMemoryStaffToken = localSession.token;
      preferServerWorkspace = true;
      return localSession;
    }
    throw err;
  }
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
      preferServerWorkspace = false;
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
  const savedSession = getSavedLocalStaffSession();
  if (isLocalStaffToken(inMemoryStaffToken)) {
    return localFetchStaffWorkspace(savedSession?.id);
  }
  try {
    return await apiFetchJson<StaffWorkspaceSnapshot>(
      '/api/staff/workspace',
      { headers: authHeaders() },
      'Gagal memuat ruang kerja staf.'
    );
  } catch (err) {
    if (err instanceof ApiUnavailableError) {
      return localFetchStaffWorkspace(savedSession?.id);
    }
    throw err;
  }
}

export async function mutateStaffWorkspace(
  action: string,
  payload?: Record<string, unknown>,
  id?: string
): Promise<{ id?: string; ok?: boolean }> {
  const savedSession = getSavedLocalStaffSession();
  let data: { id?: string; ok?: boolean };
  if (isLocalStaffToken(inMemoryStaffToken)) {
    data = localMutateStaffWorkspace(action, payload, id, savedSession?.id);
  } else {
    try {
      data = await apiFetchJson<{ id?: string; ok?: boolean }>(
        '/api/staff/workspace/mutate',
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ action, id, payload }),
        },
        'Gagal menyimpan perubahan ke server.'
      );
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        data = localMutateStaffWorkspace(action, payload, id, savedSession?.id);
      } else {
        throw err;
      }
    }
  }
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
  if (isLocalStaffToken(inMemoryStaffToken)) {
    return localFetchRegisteredAccounts();
  }
  try {
    return await apiFetchJson<{
      staffAccounts: StaffAccountSummary[];
      studentAccounts: StudentAccountSummary[];
    }>('/api/staff/accounts', { headers: authHeaders() }, 'Gagal memuat daftar akun terdaftar.');
  } catch (err) {
    if (err instanceof ApiUnavailableError) {
      return localFetchRegisteredAccounts();
    }
    throw err;
  }
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
  if (isLocalStaffToken(inMemoryStaffToken)) {
    return localCreateStaffAccount(payload);
  }
  try {
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
  } catch (err) {
    if (err instanceof ApiUnavailableError) {
      return localCreateStaffAccount(payload);
    }
    throw err;
  }
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
  if (isLocalStaffToken(inMemoryStaffToken)) {
    return localUpdateStaffAccount(id, updates);
  }
  try {
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
  } catch (err) {
    if (err instanceof ApiUnavailableError) {
      return localUpdateStaffAccount(id, updates);
    }
    throw err;
  }
}

export async function deleteRegisteredStaffAccount(id: string): Promise<void> {
  if (isLocalStaffToken(inMemoryStaffToken)) {
    localDeleteStaffAccount(id);
    return;
  }
  try {
    await apiFetchJson<{ ok: boolean }>(
      `/api/staff/accounts/staff/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: authHeaders(),
      },
      'Gagal menghapus akun staf.'
    );
  } catch (err) {
    if (err instanceof ApiUnavailableError) {
      localDeleteStaffAccount(id);
      return;
    }
    throw err;
  }
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
  let account: StudentAccountSummary;
  if (isLocalStaffToken(inMemoryStaffToken)) {
    account = localCreateStudentAccount(payload);
  } else {
    try {
      const data = await apiFetchJson<{ account: StudentAccountSummary }>(
        '/api/staff/accounts/student',
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        },
        'Gagal membuat akun siswa.'
      );
      account = data.account;
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        account = localCreateStudentAccount(payload);
      } else {
        throw err;
      }
    }
  }
  if (workspaceChangedListener) workspaceChangedListener();
  return account;
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
  let account: StudentAccountSummary;
  if (isLocalStaffToken(inMemoryStaffToken)) {
    account = localUpdateStudentAccount(studentId, updates);
  } else {
    try {
      const data = await apiFetchJson<{ account: StudentAccountSummary }>(
        `/api/staff/accounts/student/${encodeURIComponent(studentId)}`,
        {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(updates),
        },
        'Gagal memperbarui akun siswa.'
      );
      account = data.account;
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        account = localUpdateStudentAccount(studentId, updates);
      } else {
        throw err;
      }
    }
  }
  if (workspaceChangedListener) workspaceChangedListener();
  return account;
}

export async function deleteRegisteredStudentAccount(studentId: string): Promise<void> {
  if (isLocalStaffToken(inMemoryStaffToken)) {
    localDeleteStudentAccount(studentId);
    if (workspaceChangedListener) workspaceChangedListener();
    return;
  }
  try {
    await apiFetchJson<{ ok: boolean }>(
      `/api/staff/accounts/student/${encodeURIComponent(studentId)}`,
      {
        method: 'DELETE',
        headers: authHeaders(),
      },
      'Gagal menghapus akun siswa.'
    );
    if (workspaceChangedListener) workspaceChangedListener();
  } catch (err) {
    if (err instanceof ApiUnavailableError) {
      localDeleteStudentAccount(studentId);
      if (workspaceChangedListener) workspaceChangedListener();
      return;
    }
    throw err;
  }
}
