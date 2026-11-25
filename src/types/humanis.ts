export type StaffRole = 'admin' | 'wali_kelas' | 'guru_bk' | 'kepala_sekolah';

export type IndependenceCategory =
  | 'Sangat Rendah'
  | 'Rendah'
  | 'Sedang'
  | 'Baik'
  | 'Sangat Baik';

export type ConditionLevel = 'baik' | 'cukup' | 'perlu_pendampingan';

export type HumanisStageKey = 'H' | 'U' | 'M' | 'A' | 'N' | 'I' | 'S';

export type PredictionCategory = 'Meningkat' | 'Stabil' | 'Berisiko Menurun';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  nip?: string;
  staffRole: StaffRole;
  kelasBinaan?: string;
  jurusan?: string;
  schoolName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoleAssignment {
  id: string;
  ownerId: string;
  nama: string;
  nip?: string;
  email: string;
  role: StaffRole;
  kelasBinaan?: string;
  aktif: boolean;
  permissions: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ThemeSetting {
  userId: string;
  mode: 'light' | 'dark';
  accentColor: string;
  cardRadius: 'compact' | 'balanced' | 'rounded';
  density: 'comfortable' | 'compact';
  schoolName?: string;
  academicYear?: string;
  programSubtitle?: string;
  gridColumns?: number;
  gridRows?: number;
  updatedAt?: unknown;
}

export interface Student {
  id: string;
  ownerId: string;
  nisn: string;
  namaLengkap: string;
  jenisKelamin: 'L' | 'P';
  jurusan: string;
  kelas: string;
  noHp?: string;
  namaOrangTua?: string;
  nomorOrangTua?: string;
  alamat?: string;
  portalUsername?: string;
  latestScore?: number;
  latestCategory?: IndependenceCategory;
  latestCondition?: ConditionLevel;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Diagnostic {
  id: string;
  ownerId: string;
  studentId: string;
  studentName: string;
  kelas: string;
  tanggungJawab: number;
  disiplin: number;
  inisiatif: number;
  pengambilanKeputusan: number;
  manajemenDiri: number;
  totalScore: number;
  category: IndependenceCategory;
  assessedDate: string;
  periodMonths?: 0 | 3 | 6 | 12;
  notes?: string;
  createdAt?: unknown;
}

export interface HumanisProgress {
  id: string;
  ownerId: string;
  studentId: string;
  studentName: string;
  kelas: string;
  completedStages: HumanisStageKey[];
  hMinat?: string;
  hBakat?: string;
  hCitaCita?: string;
  hKeunggulan?: string;
  uPemahamanKerja?: string;
  uKesadaranMandiri?: string;
  uCatatanDiskusi?: string;
  mKeteladananGuru?: string;
  mResponSiswa?: string;
  aProgresDicapai?: string;
  aBentukApresiasi?: string;
  aTanggal?: string;
  nKebiasaanPositif?: string;
  nTugasKemandirian?: string;
  iNilaiTertanam?: string;
  iRefleksiSiswa?: string;
  sPeranOrangTua?: string;
  sPeranGuru?: string;
  sTindakLanjut?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Observation {
  id: string;
  ownerId: string;
  studentId: string;
  studentName: string;
  kelas: string;
  tanggal: string;
  kondisiAkademik: string;
  kondisiSosial: string;
  kondisiEmosional: string;
  tingkatKemandirian: ConditionLevel;
  skorKemandirian: number;
  observerName?: string;
  createdAt?: unknown;
}

export interface CoachingProcess {
  id: string;
  ownerId: string;
  studentId: string;
  studentName: string;
  kelas: string;
  tanggal: string;
  tindakan: string;
  tahapHumanis: HumanisStageKey;
  hasilSementara: string;
  petugasRole: StaffRole;
  petugasNama?: string;
  createdAt?: unknown;
}

export interface GoodStatement {
  id: string;
  ownerId: string;
  studentId: string;
  studentName: string;
  kelas: string;
  kalimat: string;
  sumber: 'manual' | 'voice';
  tanggal: string;
  createdAt?: unknown;
}

export interface ReportRecord {
  id: string;
  ownerId: string;
  reportType: 'individu' | 'kelas' | 'ai_insight';
  studentId?: string;
  studentName?: string;
  kelas?: string;
  title: string;
  analisisSiswa: string;
  saranTindakan: string[];
  prediksiPerkembangan: PredictionCategory;
  generatedBy?: string;
  createdAt?: unknown;
}

export interface AIStudentAnalysisResult {
  analisisSiswa: string;
  saranTindakan: string[];
  prediksiPerkembangan: PredictionCategory;
  alasanPrediksi: string;
  fokusHumanis: string;
}

export interface AIClassInsightResult {
  ringkasanEksekutif: string;
  aspekTerlemah: string;
  aspekTerkuat: string;
  rekomendasiStrategis: string[];
}

export interface StudentPortalData {
  student: Student;
  diagnostics: Diagnostic[];
  humanis: HumanisProgress | null;
  observations: Observation[];
  processes: CoachingProcess[];
  goodStatements: GoodStatement[];
}

export interface StudentSession {
  token: string;
  username: string;
  studentId: string;
}

export interface StaffAccountSummary {
  id: string;
  username: string;
  nama: string;
  nip?: string;
  email?: string;
  role: StaffRole;
  kelasBinaan?: string;
  aktif: boolean;
  permissions: string[];
  createdAt?: string;
}

export interface StudentAccountSummary {
  studentId: string;
  nisn: string;
  namaLengkap: string;
  kelas: string;
  jurusan: string;
  username: string;
  aktif: boolean;
}

export interface StaffSession {
  token: string;
  id: string;
  username: string;
  displayName: string;
  email: string;
  nip?: string;
  staffRole: StaffRole;
}
