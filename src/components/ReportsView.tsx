import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { FileText, FileSpreadsheet, Printer, CloudUpload } from 'lucide-react';
import type {
  CoachingProcess,
  Diagnostic,
  GoodStatement,
  HumanisProgress,
  Observation,
  ReportRecord,
  Student,
} from '../types/humanis';
import {
  exportClassReportToExcel,
  exportClassReportToPDF,
  exportIndividualReportToPDF,
} from '../lib/exportUtils';

interface ReportsViewProps {
  students: Student[];
  diagnostics: Diagnostic[];
  humanisList: HumanisProgress[];
  observations: Observation[];
  processes: CoachingProcess[];
  statements: GoodStatement[];
  reports: ReportRecord[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  onOpenGoogleSheets?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  students,
  diagnostics,
  humanisList,
  observations,
  processes,
  statements,
  reports,
  selectedStudentId,
  onSelectStudent,
  onOpenGoogleSheets,
}) => {
  const [reportTab, setReportTab] = useState<'individu' | 'kelas'>('individu');
  const [classFilter, setClassFilter] = useState('Semua');

  const classes = useMemo(() => {
    const set = new Set(students.map((s) => s.kelas).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [students]);

  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0] || null,
    [students, selectedStudentId]
  );

  const indivData = useMemo(() => {
    if (!activeStudent) return null;
    const diagnostic = diagnostics
      .filter((d) => d.studentId === activeStudent.id)
      .sort((a, b) => b.assessedDate.localeCompare(a.assessedDate))[0];
    const humanis = humanisList.find((h) => h.studentId === activeStudent.id);
    const obs = observations
      .filter((o) => o.studentId === activeStudent.id)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const procs = processes
      .filter((p) => p.studentId === activeStudent.id)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const stmts = statements.filter((s) => s.studentId === activeStudent.id);
    const aiReport = reports.find((r) => r.studentId === activeStudent.id);

    return { diagnostic, humanis, obs, procs, stmts, aiReport };
  }, [activeStudent, diagnostics, humanisList, observations, processes, statements, reports]);

  const classStudents = useMemo(() => {
    if (classFilter === 'Semua') return students;
    return students.filter((s) => s.kelas === classFilter);
  }, [students, classFilter]);

  const classPriority = useMemo(
    () =>
      classStudents.filter(
        (s) => s.latestCondition === 'perlu_pendampingan' || (s.latestScore ?? 0) < 55
      ),
    [classStudents]
  );

  if (students.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-600 dark:text-slate-400">
        Belum ada data siswa untuk menghasilkan laporan individu atau kelas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Laporan Perkembangan Siswa
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Generate laporan individu maupun laporan kelas dalam format PDF, Excel, atau Cetak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setReportTab('individu')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                reportTab === 'individu'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Laporan Individu
            </button>
            <button
              type="button"
              onClick={() => setReportTab('kelas')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                reportTab === 'kelas'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Laporan Kelas
            </button>
          </div>

          {reportTab === 'individu' && activeStudent && indivData && (
            <>
              <select
                value={activeStudent.id}
                onChange={(e) => onSelectStudent(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.namaLengkap} ({s.kelas})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  exportIndividualReportToPDF({
                    student: activeStudent,
                    diagnostic: indivData.diagnostic,
                    humanis: indivData.humanis,
                    observations: indivData.obs,
                    processes: indivData.procs,
                    statements: indivData.stmts,
                    aiAnalysis: indivData.aiReport
                      ? {
                          analisisSiswa: indivData.aiReport.analisisSiswa,
                          saranTindakan: indivData.aiReport.saranTindakan,
                          prediksiPerkembangan: indivData.aiReport.prediksiPerkembangan,
                          alasanPrediksi: '',
                          fokusHumanis: '',
                        }
                      : null,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>PDF</span>
              </button>
            </>
          )}

          {reportTab === 'kelas' && (
            <>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
              >
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  exportClassReportToPDF({
                    kelasFilter: classFilter,
                    students: classStudents,
                    diagnostics,
                    humanisList,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  exportClassReportToExcel(classStudents, diagnostics, humanisList, classFilter)
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak</span>
          </button>

          {onOpenGoogleSheets && (
            <button
              type="button"
              onClick={onOpenGoogleSheets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <CloudUpload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Simpan ke Google Drive</span>
            </button>
          )}
        </div>
      </div>

      {/* Report Document Body */}
      {reportTab === 'individu' && activeStudent && indivData && (
        <div className="print-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Laporan Individu Program HUMANIS SMK
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {activeStudent.namaLengkap}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                NISN {activeStudent.nisn} · {activeStudent.kelas} · {activeStudent.jurusan}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400">Skor Kemandirian</p>
              <p className="font-display text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {indivData.diagnostic?.totalScore ?? activeStudent.latestScore ?? 0}/100 (
                {indivData.diagnostic?.category ?? activeStudent.latestCategory ?? '-'})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Biodata &amp; Hasil Diagnostik
              </h3>
              <dl className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <dt>Orang Tua / Wali</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-200">
                    {activeStudent.namaOrangTua || '-'} ({activeStudent.nomorOrangTua || '-'})
                  </dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <dt>Tanggung Jawab</dt>
                  <dd className="font-mono font-semibold">{indivData.diagnostic?.tanggungJawab ?? '-'}/5</dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <dt>Disiplin</dt>
                  <dd className="font-mono font-semibold">{indivData.diagnostic?.disiplin ?? '-'}/5</dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <dt>Inisiatif</dt>
                  <dd className="font-mono font-semibold">{indivData.diagnostic?.inisiatif ?? '-'}/5</dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <dt>Pengambilan Keputusan</dt>
                  <dd className="font-mono font-semibold">
                    {indivData.diagnostic?.pengambilanKeputusan ?? '-'}/5
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Manajemen Diri</dt>
                  <dd className="font-mono font-semibold">{indivData.diagnostic?.manajemenDiri ?? '-'}/5</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Grafik Perkembangan Observasi
              </h3>
              <div className="h-44 w-full">
                {indivData.obs.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={indivData.obs}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                      <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="skorKemandirian"
                        stroke="#2563EB"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Belum ada data tren observasi.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tahapan HUMANIS Summary */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Tahapan HUMANIS ({indivData.humanis?.completedStages.length ?? 0}/7 Terlaksana)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Tahap Selesai:</strong>{' '}
              {indivData.humanis?.completedStages.join(', ') || 'Belum ada tahap ditandai selesai'} ·{' '}
              <strong>Cita-cita &amp; Potensi:</strong> {indivData.humanis?.hCitaCita || '-'} ·{' '}
              <strong>Pembiasaan:</strong> {indivData.humanis?.nKebiasaanPositif || '-'} ·{' '}
              <strong>Tindak Lanjut:</strong> {indivData.humanis?.sTindakLanjut || '-'}
            </p>
          </div>

          {/* Rekomendasi AI */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Rekomendasi AI Gemini
            </h3>
            {indivData.aiReport ? (
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2">
                <p className="leading-relaxed">{indivData.aiReport.analisisSiswa}</p>
                <p>
                  <strong>Prediksi:</strong> {indivData.aiReport.prediksiPerkembangan}
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {indivData.aiReport.saranTindakan.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada analisis AI tersimpan untuk siswa ini. Jalankan di menu AI Advisor terlebih
                dahulu.
              </p>
            )}
          </div>
        </div>
      )}

      {reportTab === 'kelas' && (
        <div className="print-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Laporan Rekapitulasi Kelas HUMANIS SMK
            </p>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {classFilter === 'Semua' ? 'Seluruh Kelas Binaan' : `Kelas ${classFilter}`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total {classStudents.length} siswa · {classPriority.length} siswa prioritas pembinaan
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3 font-medium">NISN</th>
                  <th className="py-2.5 px-3 font-medium">Nama Siswa</th>
                  <th className="py-2.5 px-3 font-medium">Kelas</th>
                  <th className="py-2.5 px-3 font-medium text-right">Skor</th>
                  <th className="py-2.5 px-3 font-medium">Kategori</th>
                  <th className="py-2.5 px-3 font-medium text-right">HUMANIS</th>
                  <th className="py-2.5 pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                {classStudents.map((s) => {
                  const hum = humanisList.find((h) => h.studentId === s.id);
                  return (
                    <tr key={s.id}>
                      <td className="py-2.5 pr-3 font-mono text-xs tabular-nums">{s.nisn}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                        {s.namaLengkap}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{s.kelas}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {s.latestScore ?? 0}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {s.latestCategory || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {hum?.completedStages.length ?? 0}/7
                      </td>
                      <td className="py-2.5 pl-3">
                        {s.latestCondition === 'perlu_pendampingan'
                          ? 'Prioritas Pembinaan'
                          : s.latestCondition === 'baik'
                            ? 'Baik'
                            : 'Cukup'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
