import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup } from 'firebase/auth';
import { auth, googleWorkspaceProvider } from './firebase';
import type {
  CoachingProcess,
  Diagnostic,
  GoodStatement,
  HumanisProgress,
  Observation,
  ReportRecord,
  Student,
} from '../types/humanis';

// Keep Google Workspace OAuth access token strictly in JS memory (never localStorage/sessionStorage)
let cachedWorkspaceAccessToken: string | null = null;
let connectedGoogleEmail: string | null = null;

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
export const HUMANIS_DRIVE_FOLDER_NAME = 'HUMANIS SMK - Database';

export class WorkspaceAuthError extends Error {
  constructor(message = 'Sesi otorisasi Google Drive & Sheets diperlukan.') {
    super(message);
    this.name = 'WorkspaceAuthError';
  }
}

export function setWorkspaceAccessToken(token: string | null, email?: string | null): void {
  cachedWorkspaceAccessToken = token;
  if (!token) {
    connectedGoogleEmail = null;
  } else if (email !== undefined) {
    connectedGoogleEmail = email;
  }
}

export function getWorkspaceAccessToken(): string | null {
  return cachedWorkspaceAccessToken;
}

export function getConnectedGoogleEmail(): string | null {
  return connectedGoogleEmail || auth.currentUser?.email || null;
}

export async function connectGoogleWorkspace(): Promise<{
  accessToken: string;
  email: string;
  displayName: string;
}> {
  let result;
  if (auth.currentUser) {
    try {
      result = await reauthenticateWithPopup(auth.currentUser, googleWorkspaceProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-mismatch' || code === 'auth/no-current-user') {
        result = await signInWithPopup(auth, googleWorkspaceProvider);
      } else {
        throw err;
      }
    }
  } else {
    result = await signInWithPopup(auth, googleWorkspaceProvider);
  }
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (!accessToken) {
    throw new WorkspaceAuthError(
      'Token akses Google Drive & Sheets tidak diterima. Pastikan izin Google Drive & Sheets disetujui.'
    );
  }
  const email = result.user.email || '';
  const displayName = result.user.displayName || email || 'Akun Google';
  setWorkspaceAccessToken(accessToken, email);
  return { accessToken, email, displayName };
}

async function googleApiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = cachedWorkspaceAccessToken;
  if (!token) {
    throw new WorkspaceAuthError('Silakan hubungkan akun Google Anda terlebih dahulu.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 || res.status === 403) {
    if (res.status === 401) {
      setWorkspaceAccessToken(null);
      throw new WorkspaceAuthError(
        'Token Google Drive & Sheets kedaluwarsa. Klik tombol hubungkan Google untuk otorisasi ulang.'
      );
    }
    const errText = await res.text().catch(() => '');
    if (errText.includes('insufficientPermissions') || errText.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
      setWorkspaceAccessToken(null);
      throw new WorkspaceAuthError(
        'Izin akses Google Drive / Sheets belum lengkap. Hubungkan ulang akun Google Anda dan centang semua izin.'
      );
    }
    throw new Error(extractGoogleErrorMessage(errText, res.status));
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(extractGoogleErrorMessage(errText, res.status));
  }

  if (res.status === 204) {
    return {} as T;
  }
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function extractGoogleErrorMessage(raw: string, status: number): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // ignore non-json
  }
  return `Permintaan Google API gagal (HTTP ${status}).`;
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
  parents?: string[];
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface SpreadsheetTabInfo {
  sheetId: number;
  title: string;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SpreadsheetTabInfo[];
}

export interface HumanisDatasets {
  students: Student[];
  diagnostics: Diagnostic[];
  humanisList: HumanisProgress[];
  observations: Observation[];
  processes: CoachingProcess[];
  statements: GoodStatement[];
  reports: ReportRecord[];
}

const SHEET_TABS = [
  'Data Siswa',
  'Tes Diagnostik',
  'Tahapan HUMANIS',
  'Observasi Kondisi',
  'Proses Pembinaan',
  'Pernyataan Baik',
  'Laporan AI',
] as const;

export async function ensureHumanisDriveFolder(
  folderName = HUMANIS_DRIVE_FOLDER_NAME
): Promise<DriveFolderInfo> {
  const escaped = folderName.replace(/'/g, "\\'");
  const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${escaped}'`;
  const searchUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,webViewLink)&pageSize=5`;

  const found = await googleApiFetch<{ files?: DriveFolderInfo[] }>(searchUrl);
  if (found.files && found.files.length > 0) {
    return found.files[0];
  }

  return googleApiFetch<DriveFolderInfo>(
    `${DRIVE_API_BASE}/files?fields=id,name,webViewLink`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
}

export async function listAppSpreadsheets(): Promise<DriveSpreadsheetFile[]> {
  const q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    q
  )}&orderBy=modifiedTime desc&pageSize=30&fields=files(id,name,webViewLink,modifiedTime,parents)`;
  const res = await googleApiFetch<{ files?: DriveSpreadsheetFile[] }>(url);
  return res.files || [];
}

export async function deleteDriveSpreadsheet(fileId: string): Promise<void> {
  await googleApiFetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  });
}

export async function getSpreadsheetMetadata(
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(
    spreadsheetId
  )}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets(properties(sheetId,title))`;
  const data = await googleApiFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(url);

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Spreadsheet Tanpa Judul',
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheets: (data.sheets || [])
      .map((s) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title || 'Sheet',
      }))
      .filter((s) => Boolean(s.title)),
  };
}

function buildHumanisSheetsData(
  datasets: HumanisDatasets
): Record<(typeof SHEET_TABS)[number], (string | number)[][]> {
  const studentRows: (string | number)[][] = [
    [
      'NISN',
      'Nama Lengkap',
      'L/P',
      'Kelas',
      'Jurusan',
      'No HP Siswa',
      'Nama Orang Tua',
      'No HP Orang Tua',
      'Alamat',
      'Username Portal',
      'Skor Kemandirian',
      'Kategori',
      'Kondisi Terakhir',
    ],
    ...datasets.students.map((s) => [
      s.nisn || '',
      s.namaLengkap || '',
      s.jenisKelamin || 'L',
      s.kelas || '',
      s.jurusan || '',
      s.noHp || '',
      s.namaOrangTua || '',
      s.nomorOrangTua || '',
      s.alamat || '',
      s.portalUsername || s.nisn || '',
      s.latestScore ?? 0,
      s.latestCategory || 'Belum dites',
      s.latestCondition || 'cukup',
    ]),
  ];

  const diagnosticRows: (string | number)[][] = [
    [
      'Tanggal Asesmen',
      'Nama Siswa',
      'Kelas',
      'Tanggung Jawab (1-5)',
      'Disiplin (1-5)',
      'Inisiatif (1-5)',
      'Pengambilan Keputusan (1-5)',
      'Manajemen Diri (1-5)',
      'Skor Total (0-100)',
      'Kategori',
      'Catatan',
    ],
    ...datasets.diagnostics.map((d) => [
      d.assessedDate || '',
      d.studentName || '',
      d.kelas || '',
      d.tanggungJawab ?? 0,
      d.disiplin ?? 0,
      d.inisiatif ?? 0,
      d.pengambilanKeputusan ?? 0,
      d.manajemenDiri ?? 0,
      d.totalScore ?? 0,
      d.category || '',
      d.notes || '',
    ]),
  ];

  const humanisRows: (string | number)[][] = [
    [
      'Nama Siswa',
      'Kelas',
      'Tahap Selesai',
      'Jumlah Tahap (x/7)',
      'H - Minat',
      'H - Bakat',
      'H - Cita-cita',
      'H - Keunggulan',
      'U - Pemahaman Dunia Kerja',
      'U - Kesadaran Mandiri',
      'M - Keteladanan Guru',
      'A - Progres Dicapai',
      'N - Kebiasaan Positif',
      'I - Nilai Tertanam',
      'S - Peran Orang Tua',
      'S - Tindak Lanjut',
    ],
    ...datasets.humanisList.map((h) => [
      h.studentName || '',
      h.kelas || '',
      (h.completedStages || []).join(', '),
      h.completedStages?.length ?? 0,
      h.hMinat || '',
      h.hBakat || '',
      h.hCitaCita || '',
      h.hKeunggulan || '',
      h.uPemahamanKerja || '',
      h.uKesadaranMandiri || '',
      h.mKeteladananGuru || '',
      h.aProgresDicapai || '',
      h.nKebiasaanPositif || '',
      h.iNilaiTertanam || '',
      h.sPeranOrangTua || '',
      h.sTindakLanjut || '',
    ]),
  ];

  const observationRows: (string | number)[][] = [
    [
      'Tanggal',
      'Nama Siswa',
      'Kelas',
      'Tingkat Kemandirian',
      'Skor (0-100)',
      'Kondisi Akademik',
      'Kondisi Sosial',
      'Kondisi Emosional',
      'Observer',
    ],
    ...datasets.observations.map((o) => [
      o.tanggal || '',
      o.studentName || '',
      o.kelas || '',
      o.tingkatKemandirian || '',
      o.skorKemandirian ?? 0,
      o.kondisiAkademik || '',
      o.kondisiSosial || '',
      o.kondisiEmosional || '',
      o.observerName || '',
    ]),
  ];

  const processRows: (string | number)[][] = [
    [
      'Tanggal',
      'Nama Siswa',
      'Kelas',
      'Tahap HUMANIS',
      'Tindakan Pembinaan',
      'Hasil Sementara',
      'Peran Petugas',
      'Nama Petugas',
    ],
    ...datasets.processes.map((p) => [
      p.tanggal || '',
      p.studentName || '',
      p.kelas || '',
      p.tahapHumanis || '',
      p.tindakan || '',
      p.hasilSementara || '',
      p.petugasRole || '',
      p.petugasNama || '',
    ]),
  ];

  const statementRows: (string | number)[][] = [
    ['Tanggal', 'Nama Siswa', 'Kelas', 'Pernyataan Positif Siswa', 'Sumber Input'],
    ...datasets.statements.map((st) => [
      st.tanggal || '',
      st.studentName || '',
      st.kelas || '',
      st.kalimat || '',
      st.sumber === 'voice' ? 'Suara (Voice to Text)' : 'Input Manual',
    ]),
  ];

  const reportRows: (string | number)[][] = [
    [
      'Judul Laporan',
      'Tipe',
      'Nama Siswa',
      'Kelas',
      'Prediksi Perkembangan',
      'Analisis',
      'Saran Tindakan',
      'Disusun Oleh',
    ],
    ...datasets.reports.map((r) => [
      r.title || '',
      r.reportType || '',
      r.studentName || '-',
      r.kelas || '-',
      r.prediksiPerkembangan || '',
      r.analisisSiswa || '',
      (r.saranTindakan || []).join(' | '),
      r.generatedBy || '',
    ]),
  ];

  return {
    'Data Siswa': studentRows,
    'Tes Diagnostik': diagnosticRows,
    'Tahapan HUMANIS': humanisRows,
    'Observasi Kondisi': observationRows,
    'Proses Pembinaan': processRows,
    'Pernyataan Baik': statementRows,
    'Laporan AI': reportRows,
  };
}

function escapeSheetRangeTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

async function applyHeaderFormatting(
  spreadsheetId: string,
  sheetTabs: SpreadsheetTabInfo[]
): Promise<void> {
  const targetTabSet = new Set<string>(SHEET_TABS);
  const requests = sheetTabs
    .filter((tab) => targetTabSet.has(tab.title))
    .map((tab) => ({
      repeatCell: {
        range: {
          sheetId: tab.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.145, green: 0.388, blue: 0.922 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    }));

  if (requests.length === 0) return;

  await googleApiFetch(`${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });
}

export async function createHumanisSpreadsheetInDrive(params: {
  title: string;
  datasets: HumanisDatasets;
}): Promise<{
  spreadsheetId: string;
  title: string;
  webViewLink: string;
  folder: DriveFolderInfo;
}> {
  const folder = await ensureHumanisDriveFolder();
  const sheetDataMap = buildHumanisSheetsData(params.datasets);

  const created = await googleApiFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(SHEETS_API_BASE, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title: params.title.trim() || 'Database HUMANIS SMK',
        locale: 'id_ID',
      },
      sheets: SHEET_TABS.map((tabTitle) => ({
        properties: {
          title: tabTitle,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      })),
    }),
  });

  // Move the spreadsheet directly into the dedicated Google Drive folder
  let webViewLink =
    created.spreadsheetUrl ||
    `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`;
  try {
    const fileMeta = await googleApiFetch<{ parents?: string[]; webViewLink?: string }>(
      `${DRIVE_API_BASE}/files/${encodeURIComponent(created.spreadsheetId)}?fields=parents,webViewLink`
    );
    const removeParents = (fileMeta.parents || []).join(',');
    const moveQuery = new URLSearchParams({
      addParents: folder.id,
      fields: 'id,name,webViewLink',
    });
    if (removeParents) moveQuery.set('removeParents', removeParents);
    const moved = await googleApiFetch<{ webViewLink?: string }>(
      `${DRIVE_API_BASE}/files/${encodeURIComponent(created.spreadsheetId)}?${moveQuery.toString()}`,
      {
        method: 'PATCH',
        body: JSON.stringify({}),
      }
    );
    if (moved.webViewLink) webViewLink = moved.webViewLink;
  } catch {
    // Moving parent folder is best-effort if Drive permissions restrict removing root parent
  }

  // Write all 7 tabs in one batchUpdate
  const valueData = SHEET_TABS.map((tab) => ({
    range: `${escapeSheetRangeTitle(tab)}!A1`,
    values: sheetDataMap[tab],
  }));

  await googleApiFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(created.spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueData,
      }),
    }
  );

  const tabs: SpreadsheetTabInfo[] = (created.sheets || []).map((s) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title || '',
  }));
  await applyHeaderFormatting(created.spreadsheetId, tabs).catch(() => {});

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title || params.title,
    webViewLink,
    folder,
  };
}

export async function syncAllDataToSpreadsheet(params: {
  spreadsheetId: string;
  datasets: HumanisDatasets;
}): Promise<{ title: string; spreadsheetUrl: string; updatedTabs: number }> {
  // Always inspect actual sheet metadata first rather than assuming tab names exist
  let meta = await getSpreadsheetMetadata(params.spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.title));
  const missingTabs = SHEET_TABS.filter((tab) => !existingTitles.has(tab));

  if (missingTabs.length > 0) {
    await googleApiFetch(
      `${SHEETS_API_BASE}/${encodeURIComponent(params.spreadsheetId)}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTabs.map((tabTitle) => ({
            addSheet: {
              properties: {
                title: tabTitle,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          })),
        }),
      }
    );
    meta = await getSpreadsheetMetadata(params.spreadsheetId);
  }

  // Clear target tab ranges before writing fresh snapshots
  await googleApiFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(params.spreadsheetId)}/values:batchClear`,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: SHEET_TABS.map((tab) => `${escapeSheetRangeTitle(tab)}!A:Z`),
      }),
    }
  );

  const sheetDataMap = buildHumanisSheetsData(params.datasets);
  await googleApiFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(params.spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: SHEET_TABS.map((tab) => ({
          range: `${escapeSheetRangeTitle(tab)}!A1`,
          values: sheetDataMap[tab],
        })),
      }),
    }
  );

  await applyHeaderFormatting(params.spreadsheetId, meta.sheets).catch(() => {});

  return {
    title: meta.title,
    spreadsheetUrl: meta.spreadsheetUrl,
    updatedTabs: SHEET_TABS.length,
  };
}

export type ImportedStudentRow = Omit<Student, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;

export async function previewStudentsFromSpreadsheet(
  spreadsheetId: string,
  sheetTitle: string
): Promise<ImportedStudentRow[]> {
  const range = `${escapeSheetRangeTitle(sheetTitle)}!A1:Z500`;
  const data = await googleApiFetch<{ values?: string[][] }>(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
  );

  const rows = data.values || [];
  if (rows.length < 2) return [];

  const headerRow = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const findCol = (...candidates: string[]): number =>
    headerRow.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const nisnIdx = findCol('nisn');
  const namaIdx = findCol('nama lengkap', 'nama siswa', 'nama');
  const jkIdx = findCol('l/p', 'jenis kelamin', 'jk', 'gender');
  const kelasIdx = findCol('kelas');
  const jurusanIdx = findCol('jurusan', 'kompetensi');
  const hpIdx = findCol('no hp siswa', 'no hp', 'hp siswa', 'telepon');
  const ortuIdx = findCol('nama orang tua', 'orang tua', 'wali');
  const hpOrtuIdx = findCol('no hp orang tua', 'nomor orang tua', 'hp orang tua');
  const alamatIdx = findCol('alamat');
  const usernameIdx = findCol('username portal', 'username');

  if (nisnIdx === -1 && namaIdx === -1) {
    throw new Error(
      `Tab "${sheetTitle}" tidak memiliki kolom header "NISN" atau "Nama Lengkap".`
    );
  }

  const parsed: ImportedStudentRow[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i] || [];
    const nisn = String((nisnIdx >= 0 ? r[nisnIdx] : '') || '').trim();
    const namaLengkap = String((namaIdx >= 0 ? r[namaIdx] : '') || '').trim();
    if (!nisn || !namaLengkap) continue;

    const jkRaw = String((jkIdx >= 0 ? r[jkIdx] : 'L') || 'L')
      .trim()
      .toUpperCase();
    const jenisKelamin: 'L' | 'P' = jkRaw.startsWith('P') ? 'P' : 'L';

    parsed.push({
      nisn,
      namaLengkap,
      jenisKelamin,
      kelas: String((kelasIdx >= 0 ? r[kelasIdx] : '') || 'X TKJ 1').trim(),
      jurusan: String(
        (jurusanIdx >= 0 ? r[jurusanIdx] : '') || 'Teknik Komputer & Jaringan'
      ).trim(),
      noHp: String((hpIdx >= 0 ? r[hpIdx] : '') || '').trim(),
      namaOrangTua: String((ortuIdx >= 0 ? r[ortuIdx] : '') || '').trim(),
      nomorOrangTua: String((hpOrtuIdx >= 0 ? r[hpOrtuIdx] : '') || '').trim(),
      alamat: String((alamatIdx >= 0 ? r[alamatIdx] : '') || '').trim(),
      portalUsername: String((usernameIdx >= 0 ? r[usernameIdx] : '') || nisn)
        .trim()
        .toLowerCase(),
      latestScore: 0,
      latestCategory: 'Sedang',
      latestCondition: 'cukup',
    });
  }

  return parsed;
}
