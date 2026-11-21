import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  UserProfile,
  RoleAssignment,
  ThemeSetting,
  Student,
  Diagnostic,
  HumanisProgress,
  Observation,
  CoachingProcess,
  GoodStatement,
  ReportRecord,
  StaffRole,
} from '../types/humanis';

const clip = (val: string | undefined, max: number): string =>
  (val ?? '').trim().slice(0, max);

// 1. User Profile Operations
export async function getOrCreateUserProfile(params: {
  uid: string;
  displayName: string;
  email: string;
  preferredRole?: StaffRole;
  nip?: string;
}): Promise<UserProfile> {
  const userPath = `users/${params.uid}`;
  try {
    const userRef = doc(db, 'users', params.uid);
    const snap = await getDoc(userRef);
    const isAdminEmail = params.email === 'alamifal@smkn1sidayu.sch.id';
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    // Security rules prevent non-bootstrapped emails from self-assigning 'admin' on create
    const safeRole: StaffRole =
      params.preferredRole === 'admin' && !isAdminEmail
        ? 'wali_kelas'
        : params.preferredRole || (isAdminEmail ? 'admin' : 'wali_kelas');

    const newProfile: UserProfile = {
      uid: params.uid,
      displayName: clip(params.displayName || 'Pendidik SMK', 120),
      email: clip(params.email, 180),
      nip: clip(params.nip || '', 40),
      staffRole: safeRole,
      kelasBinaan: 'X TKJ 1',
      jurusan: 'Teknik Komputer & Jaringan',
      schoolName: 'SMK Negeri 1 Sidayu',
    };
    await setDoc(userRef, {
      ...newProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<UserProfile, 'displayName' | 'nip' | 'staffRole' | 'kelasBinaan' | 'jurusan' | 'schoolName'>>
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.displayName !== undefined) payload.displayName = clip(updates.displayName, 120);
    if (updates.nip !== undefined) payload.nip = clip(updates.nip, 40);
    if (updates.staffRole !== undefined) payload.staffRole = updates.staffRole;
    if (updates.kelasBinaan !== undefined) payload.kelasBinaan = clip(updates.kelasBinaan, 40);
    if (updates.jurusan !== undefined) payload.jurusan = clip(updates.jurusan, 80);
    if (updates.schoolName !== undefined) payload.schoolName = clip(updates.schoolName, 120);

    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

// 2. Role Assignments CRUD (Operator Role Management)
export async function createRoleAssignment(
  ownerId: string,
  input: Omit<RoleAssignment, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = 'roleAssignments';
  try {
    const docRef = await addDoc(collection(db, path), {
      ownerId,
      nama: clip(input.nama, 120),
      nip: clip(input.nip, 40),
      email: clip(input.email, 180),
      role: input.role,
      kelasBinaan: clip(input.kelasBinaan, 40),
      aktif: Boolean(input.aktif),
      permissions: input.permissions.slice(0, 12).map((p) => clip(p, 80)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRoleAssignment(
  assignmentId: string,
  updates: Partial<Omit<RoleAssignment, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const path = `roleAssignments/${assignmentId}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.nama !== undefined) payload.nama = clip(updates.nama, 120);
    if (updates.nip !== undefined) payload.nip = clip(updates.nip, 40);
    if (updates.email !== undefined) payload.email = clip(updates.email, 180);
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.kelasBinaan !== undefined) payload.kelasBinaan = clip(updates.kelasBinaan, 40);
    if (updates.aktif !== undefined) payload.aktif = Boolean(updates.aktif);
    if (updates.permissions !== undefined) {
      payload.permissions = updates.permissions.slice(0, 12).map((p) => clip(p, 80));
    }

    await updateDoc(doc(db, 'roleAssignments', assignmentId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteRoleAssignment(assignmentId: string): Promise<void> {
  const path = `roleAssignments/${assignmentId}`;
  try {
    await deleteDoc(doc(db, 'roleAssignments', assignmentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 3. Theme Settings Sync
export async function saveThemeSetting(
  userId: string,
  setting: Omit<ThemeSetting, 'userId' | 'updatedAt'>
): Promise<void> {
  const path = `themeSettings/${userId}`;
  const gridColumns = Math.min(6, Math.max(2, Math.round(Number(setting.gridColumns ?? 4))));
  const gridRows = Math.min(6, Math.max(2, Math.round(Number(setting.gridRows ?? 3))));
  try {
    await setDoc(doc(db, 'themeSettings', userId), {
      userId,
      mode: setting.mode,
      accentColor: clip(setting.accentColor, 20),
      cardRadius: setting.cardRadius,
      density: setting.density,
      schoolName: clip(setting.schoolName || 'SMK Negeri 1 Sidayu', 120),
      academicYear: clip(setting.academicYear || '2026/2027', 30),
      programSubtitle: clip(
        setting.programSubtitle || 'Implementasi Tahap HUMANIS Kemandirian Siswa SMK',
        160
      ),
      gridColumns,
      gridRows,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeThemeSetting(
  userId: string,
  onData: (setting: ThemeSetting | null) => void
): Unsubscribe {
  const path = `themeSettings/${userId}`;
  return onSnapshot(
    doc(db, 'themeSettings', userId),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as ThemeSetting);
      } else {
        onData(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// 4. Real-time Collection Subscriptions (Scoped by ownerId or full-school for admin)
export function subscribeOwnedCollection<T>(
  collectionName: string,
  uid: string,
  isAdminEmail: boolean,
  onData: (items: T[]) => void
): Unsubscribe {
  const colRef = collection(db, collectionName);
  const q = isAdminEmail
    ? colRef
    : collectionName === 'users'
      ? query(colRef, where('uid', '==', uid))
      : query(colRef, where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      })) as T[];
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }
  );
}

// 5. Students CRUD
export async function createStudent(
  ownerId: string,
  input: Omit<Student, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = 'students';
  try {
    const docRef = await addDoc(collection(db, path), {
      ownerId,
      nisn: clip(input.nisn, 20),
      namaLengkap: clip(input.namaLengkap, 120),
      jenisKelamin: input.jenisKelamin,
      jurusan: clip(input.jurusan, 80),
      kelas: clip(input.kelas, 40),
      noHp: clip(input.noHp, 30),
      namaOrangTua: clip(input.namaOrangTua, 120),
      nomorOrangTua: clip(input.nomorOrangTua, 30),
      alamat: clip(input.alamat, 300),
      portalUsername: clip(input.portalUsername || input.nisn, 60).toLowerCase(),
      latestScore: typeof input.latestScore === 'number' ? Math.min(100, Math.max(0, input.latestScore)) : 0,
      latestCategory: clip(input.latestCategory || 'Sedang', 40),
      latestCondition: input.latestCondition || 'cukup',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateStudent(
  studentId: string,
  input: Partial<Omit<Student, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const path = `students/${studentId}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (input.nisn !== undefined) payload.nisn = clip(input.nisn, 20);
    if (input.namaLengkap !== undefined) payload.namaLengkap = clip(input.namaLengkap, 120);
    if (input.jenisKelamin !== undefined) payload.jenisKelamin = input.jenisKelamin;
    if (input.jurusan !== undefined) payload.jurusan = clip(input.jurusan, 80);
    if (input.kelas !== undefined) payload.kelas = clip(input.kelas, 40);
    if (input.noHp !== undefined) payload.noHp = clip(input.noHp, 30);
    if (input.namaOrangTua !== undefined) payload.namaOrangTua = clip(input.namaOrangTua, 120);
    if (input.nomorOrangTua !== undefined) payload.nomorOrangTua = clip(input.nomorOrangTua, 30);
    if (input.alamat !== undefined) payload.alamat = clip(input.alamat, 300);
    if (input.portalUsername !== undefined) payload.portalUsername = clip(input.portalUsername, 60).toLowerCase();

    await updateDoc(doc(db, 'students', studentId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStudent(studentId: string): Promise<void> {
  const path = `students/${studentId}`;
  try {
    await deleteDoc(doc(db, 'students', studentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 6. Diagnostics Create
export async function saveDiagnostic(
  ownerId: string,
  input: Omit<Diagnostic, 'id' | 'ownerId' | 'createdAt'>
): Promise<string> {
  const path = 'diagnostics';
  try {
    const docRef = await addDoc(collection(db, path), {
      ownerId,
      studentId: input.studentId,
      studentName: clip(input.studentName, 120),
      kelas: clip(input.kelas, 40),
      tanggungJawab: Number(input.tanggungJawab),
      disiplin: Number(input.disiplin),
      inisiatif: Number(input.inisiatif),
      pengambilanKeputusan: Number(input.pengambilanKeputusan),
      manajemenDiri: Number(input.manajemenDiri),
      totalScore: Number(input.totalScore),
      category: input.category,
      assessedDate: clip(input.assessedDate, 30),
      notes: clip(input.notes, 500),
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'students', input.studentId), {
      latestScore: Number(input.totalScore),
      latestCategory: input.category,
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// 7. HUMANIS Upsert
export async function saveHumanisProgress(
  ownerId: string,
  studentId: string,
  input: Omit<HumanisProgress, 'id' | 'ownerId' | 'studentId' | 'createdAt' | 'updatedAt'>,
  existingDocId?: string
): Promise<void> {
  const docId = existingDocId || `hum_${studentId}`;
  const path = `humanis/${docId}`;
  try {
    const ref = doc(db, 'humanis', docId);
    const snap = await getDoc(ref);

    const sanitizedPayload = {
      studentName: clip(input.studentName, 120),
      kelas: clip(input.kelas, 40),
      completedStages: input.completedStages.slice(0, 7),
      hMinat: clip(input.hMinat, 400),
      hBakat: clip(input.hBakat, 400),
      hCitaCita: clip(input.hCitaCita, 400),
      hKeunggulan: clip(input.hKeunggulan, 400),
      uPemahamanKerja: clip(input.uPemahamanKerja, 400),
      uKesadaranMandiri: clip(input.uKesadaranMandiri, 400),
      uCatatanDiskusi: clip(input.uCatatanDiskusi, 500),
      mKeteladananGuru: clip(input.mKeteladananGuru, 400),
      mResponSiswa: clip(input.mResponSiswa, 400),
      aProgresDicapai: clip(input.aProgresDicapai, 400),
      aBentukApresiasi: clip(input.aBentukApresiasi, 400),
      aTanggal: clip(input.aTanggal, 30),
      nKebiasaanPositif: clip(input.nKebiasaanPositif, 400),
      nTugasKemandirian: clip(input.nTugasKemandirian, 400),
      iNilaiTertanam: clip(input.iNilaiTertanam, 400),
      iRefleksiSiswa: clip(input.iRefleksiSiswa, 500),
      sPeranOrangTua: clip(input.sPeranOrangTua, 400),
      sPeranGuru: clip(input.sPeranGuru, 400),
      sTindakLanjut: clip(input.sTindakLanjut, 500),
      updatedAt: serverTimestamp(),
    };

    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId,
        studentId,
        ...sanitizedPayload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, sanitizedPayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 8. Observations Create
export async function saveObservation(
  ownerId: string,
  input: Omit<Observation, 'id' | 'ownerId' | 'createdAt'>
): Promise<string> {
  const path = 'observations';
  try {
    const docRef = await addDoc(collection(db, path), {
      ownerId,
      studentId: input.studentId,
      studentName: clip(input.studentName, 120),
      kelas: clip(input.kelas, 40),
      tanggal: clip(input.tanggal, 30),
      kondisiAkademik: clip(input.kondisiAkademik, 400),
      kondisiSosial: clip(input.kondisiSosial, 400),
      kondisiEmosional: clip(input.kondisiEmosional, 400),
      tingkatKemandirian: input.tingkatKemandirian,
      skorKemandirian: Number(input.skorKemandirian),
      observerName: clip(input.observerName, 120),
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'students', input.studentId), {
      latestCondition: input.tingkatKemandirian,
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// 9. Coaching Processes Create & Delete
export async function saveProcess(
  ownerId: string,
  input: Omit<CoachingProcess, 'id' | 'ownerId' | 'createdAt'>
): Promise<string> {
  const path = 'processes';
  try {
    const docRef = await addDoc(collection(db, path), {
      ownerId,
      studentId: input.studentId,
      studentName: clip(input.studentName, 120),
      kelas: clip(input.kelas, 40),
      tanggal: clip(input.tanggal, 30),
      tindakan: clip(input.tindakan, 500),
      tahapHumanis: input.tahapHumanis,
      hasilSementara: clip(input.hasilSementara, 500),
      petugasRole: input.petugasRole,
      petugasNama: clip(input.petugasNama, 120),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteProcess(processId: string): Promise<void> {
  const path = `processes/${processId}`;
  try {
    await deleteDoc(doc(db, 'processes', processId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 10. Good Statements Create & Delete
export async function saveGoodStatement(
  ownerId: string,
  input: Omit<GoodStatement, 'id' | 'ownerId' | 'createdAt'>
): Promise<string> {
  const path = 'goodStatements';
  try {
    const docRef = await addDoc(collection(db, path), {
      ownerId,
      studentId: input.studentId,
      studentName: clip(input.studentName, 120),
      kelas: clip(input.kelas, 40),
      kalimat: clip(input.kalimat, 400),
      sumber: input.sumber,
      tanggal: clip(input.tanggal, 30),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteGoodStatement(statementId: string): Promise<void> {
  const path = `goodStatements/${statementId}`;
  try {
    await deleteDoc(doc(db, 'goodStatements', statementId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 11. Reports & AI Insights Create
export async function saveReportRecord(
  ownerId: string,
  input: Omit<ReportRecord, 'id' | 'ownerId' | 'createdAt'>
): Promise<string> {
  const path = 'reports';
  try {
    const docRef = await addDoc(collection(db, path), {
      ownerId,
      reportType: input.reportType,
      studentId: clip(input.studentId, 128),
      studentName: clip(input.studentName, 120),
      kelas: clip(input.kelas, 40),
      title: clip(input.title, 160),
      analisisSiswa: clip(input.analisisSiswa, 1500),
      saranTindakan: input.saranTindakan.slice(0, 10).map((s) => clip(s, 300)),
      prediksiPerkembangan: input.prediksiPerkembangan,
      generatedBy: clip(input.generatedBy, 120),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
