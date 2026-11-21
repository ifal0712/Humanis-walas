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

const STUDENT_SESSION_KEY = 'humanis_student_session';

export function getSavedStudentSession(): StudentSession | null {
  try {
    const raw = localStorage.getItem(STUDENT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudentSession;
    if (!parsed?.token || !parsed?.studentId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStudentSession(session: StudentSession | null): void {
  if (!session) {
    localStorage.removeItem(STUDENT_SESSION_KEY);
    return;
  }
  localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session));
}

export async function loginStudentAccount(
  username: string,
  password: string
): Promise<{ session: StudentSession; portal: StudentPortalData }> {
  const res = await fetch('/api/student/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal masuk ke portal siswa.');
  }
  const session: StudentSession = {
    token: data.token,
    username: data.username,
    studentId: data.studentId,
  };
  saveStudentSession(session);
  return { session, portal: data.portal as StudentPortalData };
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
  const res = await fetch('/api/student/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mendaftarkan akun siswa.');
  }
  const session: StudentSession = {
    token: data.token,
    username: data.username,
    studentId: data.studentId,
  };
  saveStudentSession(session);
  return { session, portal: data.portal as StudentPortalData };
}

export async function fetchStudentPortal(token: string): Promise<StudentPortalData> {
  const res = await fetch('/api/student/portal', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memuat data siswa.');
  }
  return data as StudentPortalData;
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
  const res = await fetch('/api/student/assessment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menyimpan penilaian mandiri.');
  }
  return data as StudentPortalData;
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
  const res = await fetch('/api/student/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memperbarui biodata.');
  }
  const portal = data.portal as StudentPortalData;
  const session: StudentSession = {
    token: data.token,
    username: data.username,
    studentId: portal.student.id,
  };
  saveStudentSession(session);
  return { session, portal };
}

export async function setStudentPortalCredentials(payload: {
  studentId: string;
  username: string;
  password?: string;
  student?: Partial<Student>;
}): Promise<void> {
  const res = await fetch('/api/student/set-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menyimpan kredensial login siswa.');
  }
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
  const res = await fetch('/api/student/pending-updates');
  if (!res.ok) {
    return { pendingRegistrations: [], pendingProfileUpdates: [], pendingAssessments: [] };
  }
  return (await res.json()) as PendingStudentUpdates;
}

export async function ackPendingStudentUpdates(payload: {
  remappedIds: Array<{ tempStudentId: string; firestoreId: string }>;
  processedProfileUpdateIds: string[];
  processedAssessmentIds: string[];
}): Promise<void> {
  await fetch('/api/student/ack-pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function syncStaffSnapshotToStudentPortal(payload: {
  students: Student[];
  diagnostics: Diagnostic[];
  humanisList: HumanisProgress[];
  observations: Observation[];
  processes: CoachingProcess[];
  statements: GoodStatement[];
}): Promise<void> {
  await fetch('/api/student/sync-from-staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
