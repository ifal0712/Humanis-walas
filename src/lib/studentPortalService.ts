import type {
  CoachingProcess,
  Diagnostic,
  GoodStatement,
  HumanisProgress,
  Observation,
  Student,
  StudentPortalData,
  StudentSession,
} from '../types/humanis';
import { apiFetchJson } from './apiClient';
import { getStaffAuthToken } from './staffPortalService';

// Keep Bearer tokens strictly in JS memory (never localStorage/sessionStorage)
let inMemoryStudentSession: StudentSession | null = null;

export function getSavedStudentSession(): StudentSession | null {
  return inMemoryStudentSession;
}

export function saveStudentSession(session: StudentSession | null): void {
  inMemoryStudentSession = session;
}

export async function loginStudentAccount(
  username: string,
  password: string
): Promise<{ session: StudentSession; portal: StudentPortalData }> {
  const data = await apiFetchJson<{
    token: string;
    username: string;
    studentId: string;
    portal: StudentPortalData;
  }>(
    '/api/student/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    'Gagal masuk ke portal siswa.'
  );
  const session: StudentSession = {
    token: data.token,
    username: data.username,
    studentId: data.studentId,
  };
  saveStudentSession(session);
  return { session, portal: data.portal };
}

export async function registerStudentAccount(payload: {
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
}): Promise<{ session: StudentSession; portal: StudentPortalData }> {
  const data = await apiFetchJson<{
    token: string;
    username: string;
    studentId: string;
    portal: StudentPortalData;
  }>(
    '/api/student/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal mendaftarkan akun siswa.'
  );
  const session: StudentSession = {
    token: data.token,
    username: data.username,
    studentId: data.studentId,
  };
  saveStudentSession(session);
  return { session, portal: data.portal };
}

export async function fetchStudentPortal(token: string): Promise<StudentPortalData> {
  return apiFetchJson<StudentPortalData>(
    '/api/student/portal',
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    'Gagal memuat data siswa.'
  );
}

export async function submitStudentAssessment(
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
): Promise<StudentPortalData> {
  return apiFetchJson<StudentPortalData>(
    '/api/student/assessment',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
    'Gagal menyimpan penilaian mandiri.'
  );
}

export async function updateStudentBiodata(
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
): Promise<{ session: StudentSession; portal: StudentPortalData }> {
  const data = await apiFetchJson<{
    token: string;
    username: string;
    portal: StudentPortalData;
  }>(
    '/api/student/profile',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
    'Gagal memperbarui biodata.'
  );
  const portal = data.portal;
  const session: StudentSession = {
    token: data.token,
    username: data.username,
    studentId: portal.student.id,
  };
  saveStudentSession(session);
  return { session, portal };
}

function staffAuthHeaders(includeJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getStaffAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function setStudentPortalCredentials(payload: {
  studentId: string;
  username: string;
  password?: string;
  student?: Partial<Student>;
}): Promise<void> {
  await apiFetchJson<{ ok: boolean }>(
    '/api/student/set-credentials',
    {
      method: 'POST',
      headers: staffAuthHeaders(true),
      body: JSON.stringify(payload),
    },
    'Gagal menyimpan kredensial login siswa.'
  );
}

export interface PendingStudentUpdates {
  pendingRegistrations: Array<{
    tempStudentId: string;
    student: Omit<Student, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;
  }>;
  pendingProfileUpdates: Array<{
    id: string;
    studentId: string;
    updates: Partial<Student>;
  }>;
  pendingAssessments: Array<{
    id: string;
    studentId: string;
    diagnostic: Omit<Diagnostic, 'id' | 'ownerId' | 'createdAt'>;
    statement?: Omit<GoodStatement, 'id' | 'ownerId' | 'createdAt'>;
  }>;
}

export async function fetchPendingStudentUpdates(): Promise<PendingStudentUpdates> {
  const token = getStaffAuthToken();
  if (!token) {
    return { pendingRegistrations: [], pendingProfileUpdates: [], pendingAssessments: [] };
  }
  try {
    return await apiFetchJson<PendingStudentUpdates>(
      '/api/student/pending-updates',
      { headers: staffAuthHeaders(false) },
      'Gagal memeriksa pembaruan siswa.'
    );
  } catch {
    return { pendingRegistrations: [], pendingProfileUpdates: [], pendingAssessments: [] };
  }
}

export async function ackPendingStudentUpdates(payload: {
  remappedIds: Array<{ tempStudentId: string; firestoreId: string }>;
  processedProfileUpdateIds: string[];
  processedAssessmentIds: string[];
}): Promise<void> {
  if (!getStaffAuthToken()) return;
  try {
    await apiFetchJson<{ ok: boolean }>('/api/student/ack-pending', {
      method: 'POST',
      headers: staffAuthHeaders(true),
      body: JSON.stringify(payload),
    });
  } catch {
    // non-fatal sync ack
  }
}

export async function syncStaffSnapshotToStudentPortal(payload: {
  students: Student[];
  diagnostics: Diagnostic[];
  humanisList: HumanisProgress[];
  observations: Observation[];
  processes: CoachingProcess[];
  statements: GoodStatement[];
}): Promise<void> {
  if (!getStaffAuthToken()) return;
  try {
    await apiFetchJson<{ ok: boolean }>('/api/student/sync-from-staff', {
      method: 'POST',
      headers: staffAuthHeaders(true),
      body: JSON.stringify(payload),
    });
  } catch {
    // non-fatal sync
  }
}
