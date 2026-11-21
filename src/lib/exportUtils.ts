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

export async function parseStudentsFromExcel(
  file: File
): Promise<Array<Omit<Student, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return rawRows
    .map((row) => {
      const nisn = String(row['NISN'] ?? row['nisn'] ?? '').trim();
      const nama = String(row['Nama Lengkap'] ?? row['Nama'] ?? row['namaLengkap'] ?? '').trim();
      const jkRaw = String(row['Jenis Kelamin'] ?? row['JK'] ?? row['jenisKelamin'] ?? 'L')
        .trim()
        .toUpperCase();
      const jenisKelamin: 'L' | 'P' = jkRaw.startsWith('P') ? 'P' : 'L';
      const jurusan = String(row['Jurusan'] ?? row['jurusan'] ?? 'TKJ').trim();
      const kelas = String(row['Kelas'] ?? row['kelas'] ?? 'X TKJ 1').trim();

      if (!nisn || !nama) return null;

      return {
        nisn,
        namaLengkap: nama,
        jenisKelamin,
        jurusan,
        kelas,
        noHp: String(row['No HP'] ?? row['noHp'] ?? '').trim(),
        namaOrangTua: String(row['Nama Orang Tua'] ?? row['namaOrangTua'] ?? '').trim(),
        nomorOrangTua: String(row['Nomor Orang Tua'] ?? row['nomorOrangTua'] ?? '').trim(),
        alamat: String(row['Alamat'] ?? row['alamat'] ?? '').trim(),
        latestScore: 0,
        latestCategory: 'Sedang' as const,
        latestCondition: 'cukup' as const,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
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
