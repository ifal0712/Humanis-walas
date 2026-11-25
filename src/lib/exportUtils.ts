import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AIStudentAnalysisResult,
  CoachingProcess,
  Diagnostic,
  GoodStatement,
  HumanisProgress,
  Observation,
  Student,
} from '../types/humanis';

export function exportStudentsToExcel(students: Student[], filename = 'Data_Siswa_HUMANIS_SMK.xlsx') {
  const rows = students.map((s, idx) => ({
    No: idx + 1,
    NISN: s.nisn,
    'Nama Lengkap': s.namaLengkap,
    'Jenis Kelamin': s.jenisKelamin,
    Jurusan: s.jurusan,
    Kelas: s.kelas,
    'No HP': s.noHp || '-',
    'Nama Orang Tua': s.namaOrangTua || '-',
    'Nomor Orang Tua': s.nomorOrangTua || '-',
    Alamat: s.alamat || '-',
    'Skor Kemandirian': s.latestScore ?? 0,
    Kategori: s.latestCategory || '-',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Siswa SMK');
  XLSX.writeFile(workbook, filename);
}

export interface ParsedStudentTemplateRow {
  rowNumber: number;
  nisn: string;
  namaLengkap: string;
  jenisKelamin: 'L' | 'P';
  kelas: string;
  jurusan: string;
  noHp: string;
  namaOrangTua: string;
  nomorOrangTua: string;
  alamat: string;
  portalUsername: string;
  portalPassword: string;
  validationError?: string;
}

const TEMPLATE_HEADERS = [
  'NISN',
  'Nama Lengkap',
  'Jenis Kelamin (L/P)',
  'Kelas',
  'Jurusan',
  'No HP Siswa',
  'Nama Orang Tua',
  'Nomor HP Orang Tua',
  'Alamat',
  'Username Portal',
  'Password Portal',
];

const TEMPLATE_SAMPLE_ROWS = [
  [
    '0085123001',
    'Andi Wijaya',
    'L',
    'X TKJ 1',
    'Teknik Komputer & Jaringan',
    '081234560101',
    'Hendro Wijaya',
    '081234569101',
    'Jl. Pendidikan No. 10, Sidayu',
    '0085123001',
    'smk12345',
  ],
  [
    '0085123002',
    'Rina Kusuma',
    'P',
    'XI RPL 1',
    'Rekayasa Perangkat Lunak',
    '081234560102',
    'Siti Aminah',
    '081234569102',
    'Jl. Pemuda No. 24, Gresik',
    'rina.kusuma',
    'smk12345',
  ],
];

export function downloadStudentTemplateExcel(
  filename = 'Template_Tambah_Siswa_HUMANIS_SMK.xlsx'
) {
  const wsData = [TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE_ROWS];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 20 },
    { wch: 12 },
    { wch: 28 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
    { wch: 30 },
    { wch: 18 },
    { wch: 16 },
  ];

  const guideData = [
    ['Kolom', 'Wajib?', 'Keterangan Pengisian'],
    ['NISN', 'Ya', 'Minimal 4 digit, maksimal 20 karakter (contoh: 0085123001).'],
    ['Nama Lengkap', 'Ya', 'Minimal 2 karakter sesuai data induk sekolah.'],
    ['Jenis Kelamin (L/P)', 'Ya', 'Isi L untuk Laki-laki atau P untuk Perempuan.'],
    ['Kelas', 'Ya', 'Contoh: X TKJ 1, XI RPL 1, XII TKR 2.'],
    ['Jurusan', 'Ya', 'Kompetensi keahlian (contoh: Teknik Komputer & Jaringan).'],
    ['No HP Siswa', 'Opsional', 'Nomor WhatsApp/HP aktif siswa.'],
    ['Nama Orang Tua', 'Opsional', 'Nama ayah, ibu, atau wali siswa.'],
    ['Nomor HP Orang Tua', 'Opsional', 'Nomor HP/WhatsApp orang tua atau wali.'],
    ['Alamat', 'Opsional', 'Alamat domisili siswa.'],
    ['Username Portal', 'Opsional', 'Jika dikosongkan otomatis memakai NISN siswa.'],
    ['Password Portal', 'Opsional', 'Minimal 4 karakter. Jika kosong otomatis diset "smk12345".'],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideData);
  guideSheet['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 62 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Panduan Pengisian');
  XLSX.writeFile(workbook, filename);
}

export function downloadStudentTemplateCsv(
  filename = 'Template_Tambah_Siswa_HUMANIS_SMK.csv'
) {
  const escapeCsv = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const lines = [TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE_ROWS].map((row) =>
    row.map((cell) => escapeCsv(String(cell))).join(',')
  );
  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeRowObject(
  row: Record<string, unknown>,
  rowNumber: number
): ParsedStudentTemplateRow | null {
  const pick = (...keys: string[]): string => {
    const entries = Object.entries(row);
    for (const key of keys) {
      const target = key.toLowerCase();
      const found = entries.find(([k]) => k.trim().toLowerCase() === target);
      if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
        return String(found[1]).trim();
      }
    }
    for (const key of keys) {
      const target = key.toLowerCase();
      const found = entries.find(([k]) => k.trim().toLowerCase().includes(target));
      if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
        return String(found[1]).trim();
      }
    }
    return '';
  };

  const nisn = pick('NISN', 'nisn').slice(0, 20);
  const namaLengkap = pick('Nama Lengkap', 'Nama Siswa', 'Nama', 'namaLengkap').slice(0, 120);
  const jkRaw = pick('Jenis Kelamin (L/P)', 'Jenis Kelamin', 'L/P', 'JK', 'jenisKelamin').toUpperCase();
  const jenisKelamin: 'L' | 'P' = jkRaw.startsWith('P') ? 'P' : 'L';
  const kelas = (pick('Kelas', 'kelas') || 'X TKJ 1').slice(0, 40);
  const jurusan = (pick('Jurusan', 'Kompetensi Keahlian', 'jurusan') || 'Teknik Komputer & Jaringan').slice(0, 80);
  const noHp = pick('No HP Siswa', 'No HP', 'HP Siswa', 'noHp').slice(0, 30);
  const namaOrangTua = pick('Nama Orang Tua', 'Orang Tua', 'Wali', 'namaOrangTua').slice(0, 120);
  const nomorOrangTua = pick('Nomor HP Orang Tua', 'Nomor Orang Tua', 'No HP Orang Tua', 'nomorOrangTua').slice(0, 30);
  const alamat = pick('Alamat', 'Alamat Domisili', 'alamat').slice(0, 300);
  const rawUser = pick('Username Portal', 'Username', 'portalUsername');
  const portalUsername = (rawUser || nisn).toLowerCase().replace(/\s+/g, '.').slice(0, 60);
  const portalPassword = pick('Password Portal', 'Password', 'portalPassword').slice(0, 60);

  if (!nisn && !namaLengkap) return null;

  const errors: string[] = [];
  if (nisn.length < 4) errors.push('NISN min. 4 karakter');
  if (namaLengkap.length < 2) errors.push('Nama min. 2 karakter');
  if (kelas.length < 2) errors.push('Kelas wajib diisi');
  if (jurusan.length < 2) errors.push('Jurusan wajib diisi');
  if (portalPassword && portalPassword.length < 4) errors.push('Password min. 4 karakter');

  return {
    rowNumber,
    nisn,
    namaLengkap,
    jenisKelamin,
    kelas,
    jurusan,
    noHp,
    namaOrangTua,
    nomorOrangTua,
    alamat,
    portalUsername,
    portalPassword,
    validationError: errors.length > 0 ? errors.join(', ') : undefined,
  };
}

export async function parseStudentTemplateFile(
  file: File
): Promise<ParsedStudentTemplateRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rawRows
    .map((row, idx) => normalizeRowObject(row, idx + 2))
    .filter((item): item is ParsedStudentTemplateRow => item !== null);
}

export function parseStudentTemplateText(text: string): ParsedStudentTemplateRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t')
    ? '\t'
    : firstLine.includes(';')
      ? ';'
      : ',';

  const splitLine = (line: string) =>
    line.split(delimiter).map((cell) => cell.trim().replace(/^"(.*)"$/, '$1').trim());

  const firstCells = splitLine(lines[0]);
  const looksLikeHeader = firstCells.some((c) => {
    const lower = c.toLowerCase();
    return lower === 'nisn' || lower.includes('nama lengkap') || lower === 'nama';
  });

  const headers = looksLikeHeader ? firstCells : TEMPLATE_HEADERS;
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line, idx) => {
      const cells = splitLine(line);
      const rowObj: Record<string, unknown> = {};
      headers.forEach((h, colIdx) => {
        rowObj[h] = cells[colIdx] ?? '';
      });
      return normalizeRowObject(rowObj, idx + (looksLikeHeader ? 2 : 1));
    })
    .filter((item): item is ParsedStudentTemplateRow => item !== null);
}

export async function parseStudentsFromExcel(
  file: File
): Promise<Array<Omit<Student, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>> {
  const rows = await parseStudentTemplateFile(file);
  return rows
    .filter((r) => !r.validationError)
    .map((r) => ({
      nisn: r.nisn,
      namaLengkap: r.namaLengkap,
      jenisKelamin: r.jenisKelamin,
      jurusan: r.jurusan,
      kelas: r.kelas,
      noHp: r.noHp,
      namaOrangTua: r.namaOrangTua,
      nomorOrangTua: r.nomorOrangTua,
      alamat: r.alamat,
      portalUsername: r.portalUsername,
      latestScore: 0,
      latestCategory: 'Sedang' as const,
      latestCondition: 'cukup' as const,
    }));
}

export function exportClassReportToExcel(
  students: Student[],
  diagnostics: Diagnostic[],
  humanisList: HumanisProgress[],
  kelasFilter: string
) {
  const rows = students.map((s, idx) => {
    const diag = diagnostics.find((d) => d.studentId === s.id);
    const hum = humanisList.find((h) => h.studentId === s.id);
    return {
      No: idx + 1,
      NISN: s.nisn,
      'Nama Siswa': s.namaLengkap,
      Kelas: s.kelas,
      Jurusan: s.jurusan,
      'Skor Diagnostik': diag?.totalScore ?? s.latestScore ?? 0,
      'Kategori Kemandirian': diag?.category ?? s.latestCategory ?? '-',
      'Tahap HUMANIS Selesai': `${hum?.completedStages.length ?? 0}/7`,
      'Kondisi Terkini':
        s.latestCondition === 'baik'
          ? 'Baik'
          : s.latestCondition === 'perlu_pendampingan'
            ? 'Perlu Pendampingan'
            : 'Cukup',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Kelas');
  const label = kelasFilter === 'Semua' ? 'Semua_Kelas' : kelasFilter.replace(/\s+/g, '_');
  XLSX.writeFile(workbook, `Laporan_HUMANIS_${label}.xlsx`);
}

export function exportIndividualReportToPDF(params: {
  student: Student;
  diagnostic?: Diagnostic;
  humanis?: HumanisProgress;
  observations: Observation[];
  processes: CoachingProcess[];
  statements: GoodStatement[];
  aiAnalysis?: AIStudentAnalysisResult | null;
}) {
  const { student, diagnostic, humanis, observations, processes, aiAnalysis } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(15);
  doc.setTextColor(37, 99, 235);
  doc.text('LAPORAN PERKEMBANGAN KEMANDIRIAN SISWA (HUMANIS)', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}`, 14, 24);

  autoTable(doc, {
    startY: 29,
    head: [['Biodata Siswa', 'Keterangan']],
    body: [
      ['Nama Lengkap', student.namaLengkap],
      ['NISN', student.nisn],
      ['Kelas / Jurusan', `${student.kelas} — ${student.jurusan}`],
      ['Orang Tua / Wali', `${student.namaOrangTua || '-'} (${student.nomorOrangTua || '-'})`],
      ['Skor Kemandirian', `${diagnostic?.totalScore ?? student.latestScore ?? 0}/100 (${diagnostic?.category ?? student.latestCategory ?? '-'})`],
      ['Tahap HUMANIS Terlaksana', `${humanis?.completedStages.length ?? 0} dari 7 Tahap (${humanis?.completedStages.join(', ') || '-'})`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
  });

  let nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (diagnostic) {
    autoTable(doc, {
      startY: nextY,
      head: [['Aspek Kemandirian', 'Skor (1-5)']],
      body: [
        ['Tanggung Jawab', String(diagnostic.tanggungJawab)],
        ['Disiplin', String(diagnostic.disiplin)],
        ['Inisiatif', String(diagnostic.inisiatif)],
        ['Pengambilan Keputusan', String(diagnostic.pengambilanKeputusan)],
        ['Manajemen Diri', String(diagnostic.manajemenDiri)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 9 },
    });
    nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (aiAnalysis) {
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Analisis & Rekomendasi Gemini AI', 14, nextY);
    nextY += 5;
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const wrappedAnalysis = doc.splitTextToSize(aiAnalysis.analisisSiswa, 180);
    doc.text(wrappedAnalysis, 14, nextY);
    nextY += wrappedAnalysis.length * 4.5 + 4;
    doc.text(`Prediksi Perkembangan: ${aiAnalysis.prediksiPerkembangan}`, 14, nextY);
    nextY += 6;
  }

  if (processes.length > 0) {
    autoTable(doc, {
      startY: nextY,
      head: [['Tanggal', 'Tahap', 'Tindakan Pembinaan', 'Hasil Sementara']],
      body: processes.slice(0, 6).map((p) => [p.tanggal, p.tahapHumanis, p.tindakan, p.hasilSementara]),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 },
    });
  } else if (observations.length > 0) {
    autoTable(doc, {
      startY: nextY,
      head: [['Tanggal', 'Kemandirian', 'Akademik', 'Emosional']],
      body: observations.slice(0, 5).map((o) => [o.tanggal, o.tingkatKemandirian, o.kondisiAkademik, o.kondisiEmosional]),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 },
    });
  }

  doc.save(`Laporan_HUMANIS_${student.namaLengkap.replace(/\s+/g, '_')}.pdf`);
}

export function exportClassReportToPDF(params: {
  kelasFilter: string;
  students: Student[];
  diagnostics: Diagnostic[];
  humanisList: HumanisProgress[];
}) {
  const { kelasFilter, students, diagnostics, humanisList } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(15);
  doc.setTextColor(37, 99, 235);
  doc.text(`LAPORAN KEMANDIRIAN KELAS — ${kelasFilter}`, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Siswa: ${students.length} · Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 24);

  autoTable(doc, {
    startY: 30,
    head: [['No', 'NISN', 'Nama Lengkap', 'Kelas', 'Skor', 'Kategori', 'HUMANIS', 'Status']],
    body: students.map((s, idx) => {
      const diag = diagnostics.find((d) => d.studentId === s.id);
      const hum = humanisList.find((h) => h.studentId === s.id);
      const status =
        s.latestCondition === 'baik'
          ? 'Baik'
          : s.latestCondition === 'perlu_pendampingan'
            ? 'Prioritas'
            : 'Cukup';
      return [
        String(idx + 1),
        s.nisn,
        s.namaLengkap,
        s.kelas,
        String(diag?.totalScore ?? s.latestScore ?? 0),
        diag?.category ?? s.latestCategory ?? '-',
        `${hum?.completedStages.length ?? 0}/7`,
        status,
      ];
    }),
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 8 },
  });

  const label = kelasFilter === 'Semua' ? 'Semua_Kelas' : kelasFilter.replace(/\s+/g, '_');
  doc.save(`Laporan_Kelas_HUMANIS_${label}.pdf`);
}
