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
import {
  FileText,
  FileSpreadsheet,
  Printer,
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  TrendingUp,
  CalendarRange,
  MessageSquareQuote,
  Compass,
  BookOpen,
} from 'lucide-react';
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
import {
  REPORT_PERIOD_OPTIONS,
  filterByPeriodWindow,
  getAssessmentPeriodLabel,
  getConditionSummary,
  getReportPeriodLabel,
  type ReportPeriodFilter,
} from '../lib/periodUtils';

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
  schoolName?: string;
  waliKelasName?: string;
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
  schoolName = 'SMK Negeri 1 Sidayu',
  waliKelasName = 'Wali Kelas Pembina',
}) => {
  const [reportTab, setReportTab] = useState<'individu' | 'kelas'>('individu');
  const [classFilter, setClassFilter] = useState('Semua');
  const [periodFilter, setPeriodFilter] = useState<ReportPeriodFilter>('all');

  const classes = useMemo(() => {
    const set = new Set(students.map((s) => s.kelas).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [students]);

  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0] || null,
    [students, selectedStudentId]
  );

  const periodLabel = getReportPeriodLabel(periodFilter);

  const indivData = useMemo(() => {
    if (!activeStudent) return null;
    const allStudentDiags = diagnostics
      .filter((d) => d.studentId === activeStudent.id)
      .sort((a, b) => a.assessedDate.localeCompare(b.assessedDate));

    const periodDiags =
      periodFilter === 'all'
        ? allStudentDiags
        : periodFilter === 0
          ? allStudentDiags.filter((d) => (d.periodMonths ?? 0) === 0)
          : allStudentDiags.filter(
              (d) =>
                d.periodMonths === periodFilter ||
                filterByPeriodWindow([d], (item) => item.assessedDate, periodFilter).length > 0
            );

    const latestDiagnostic =
      periodDiags[periodDiags.length - 1] || allStudentDiags[allStudentDiags.length - 1];
    const earliestDiagnostic = periodDiags[0] || allStudentDiags[0];
    const diagDelta =
      periodDiags.length >= 2
        ? periodDiags[periodDiags.length - 1].totalScore - periodDiags[0].totalScore
        : allStudentDiags.length >= 2 && periodFilter !== 0
          ? (latestDiagnostic?.totalScore ?? 0) - allStudentDiags[0].totalScore
          : null;

    const humanis = humanisList.find((h) => h.studentId === activeStudent.id);

    const allObs = observations
      .filter((o) => o.studentId === activeStudent.id)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const periodObs = filterByPeriodWindow(allObs, (o) => o.tanggal, periodFilter);
    const latestObs = periodObs[periodObs.length - 1] || allObs[allObs.length - 1];

    const allProcs = processes
      .filter((p) => p.studentId === activeStudent.id)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const periodProcs = filterByPeriodWindow(allProcs, (p) => p.tanggal, periodFilter);

    const allStmts = statements
      .filter((s) => s.studentId === activeStudent.id)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const periodStmts = filterByPeriodWindow(allStmts, (s) => s.tanggal, periodFilter);

    const aiReport = reports.find((r) => r.studentId === activeStudent.id);
    const condition = getConditionSummary(
      activeStudent.latestCondition,
      latestDiagnostic?.totalScore ?? activeStudent.latestScore
    );

    return {
      diagnostic: latestDiagnostic,
      earliestDiagnostic,
      periodDiags,
      diagDelta,
      humanis,
      obs: periodObs,
      latestObs,
      procs: periodProcs,
      stmts: periodStmts,
      aiReport,
      condition,
    };
  }, [activeStudent, diagnostics, humanisList, observations, processes, statements, reports, periodFilter]);

  const classStudents = useMemo(() => {
    if (classFilter === 'Semua') return students;
    return students.filter((s) => s.kelas === classFilter);
  }, [students, classFilter]);

  const classDiagnostics = useMemo(
    () =>
      periodFilter === 'all'
        ? diagnostics
        : periodFilter === 0
          ? diagnostics.filter((d) => (d.periodMonths ?? 0) === 0)
          : diagnostics.filter(
              (d) =>
                d.periodMonths === periodFilter ||
                filterByPeriodWindow([d], (item) => item.assessedDate, periodFilter).length > 0
            ),
    [diagnostics, periodFilter]
  );

  const classProgressionRows = useMemo(() => {
    return classStudents.map((s) => {
      const allStudentDiags = diagnostics
        .filter((d) => d.studentId === s.id)
        .sort((a, b) => a.assessedDate.localeCompare(b.assessedDate));
      const periodStudentDiags = classDiagnostics
        .filter((d) => d.studentId === s.id)
        .sort((a, b) => a.assessedDate.localeCompare(b.assessedDate));

      const latestInPeriod =
        periodStudentDiags[periodStudentDiags.length - 1] ||
        allStudentDiags[allStudentDiags.length - 1];
      const baseline = allStudentDiags[0];
      const currentScore = latestInPeriod?.totalScore ?? s.latestScore ?? 0;
      const baselineScore = baseline?.totalScore ?? currentScore;
      const delta =
        periodFilter === 0
          ? null
          : periodStudentDiags.length >= 2
            ? periodStudentDiags[periodStudentDiags.length - 1].totalScore -
              periodStudentDiags[0].totalScore
            : allStudentDiags.length >= 2 && latestInPeriod && baseline && latestInPeriod.id !== baseline.id
              ? latestInPeriod.totalScore - baseline.totalScore
              : null;
      const hum = humanisList.find((h) => h.studentId === s.id);
      return {
        student: s,
        latestDiag: latestInPeriod,
        baselineScore,
        currentScore,
        delta,
        humStages: hum?.completedStages.length ?? 0,
      };
    });
  }, [classStudents, diagnostics, classDiagnostics, humanisList, periodFilter]);

  const classStats = useMemo(() => {
    const count = classProgressionRows.length;
    const avgScore =
      count > 0
        ? Math.round(
            classProgressionRows.reduce((acc, r) => acc + r.currentScore, 0) / count
          )
        : 0;
    const improvedCount = classProgressionRows.filter(
      (r) => typeof r.delta === 'number' && r.delta > 0
    ).length;
    const priorityCount = classStudents.filter(
      (s) => s.latestCondition === 'perlu_pendampingan' || (s.latestScore ?? 0) < 55
    ).length;
    return {
      count,
      avgScore,
      improvedCount,
      priorityCount,
      assessmentsCount: classDiagnostics.filter((d) =>
        classStudents.some((s) => s.id === d.studentId)
      ).length,
    };
  }, [classProgressionRows, classStudents, classDiagnostics]);

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
      <div className="no-print flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Lihat &amp; Cetak Laporan Perkembangan Siswa
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Pantau kondisi individu maupun rekap kelas dalam rentang periodik 3, 6, atau 12 bulan.
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
                      diagnosticsInPeriod: indivData.periodDiags,
                      humanis: indivData.humanis,
                      observations: indivData.obs,
                      processes: indivData.procs,
                      statements: indivData.stmts,
                      periodLabel,
                      schoolName,
                      waliKelasName,
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
                  <span>Unduh PDF</span>
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
                      diagnostics: classDiagnostics,
                      humanisList,
                      periodLabel,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Unduh PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    exportClassReportToExcel(classStudents, classDiagnostics, humanisList, classFilter)
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan</span>
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

        {/* Periodic Evaluation Selector (3, 6, 12 Bulan) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            <CalendarRange className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Rentang Periode Evaluasi &amp; Cetak:</span>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5">
            {REPORT_PERIOD_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setPeriodFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  periodFilter === opt.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Report Document Body — INDIVIDUAL STUDENT CONDITION DOSSIER */}
      {reportTab === 'individu' && activeStudent && indivData && (
        <div className="print-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Kop & Identitas Siswa */}
          <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wide text-blue-600 dark:text-blue-400">
                {schoolName} · Laporan Kondisi Individu Siswa (Program HUMANIS SMK)
              </p>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                {activeStudent.namaLengkap}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                NISN {activeStudent.nisn} · {activeStudent.jenisKelamin === 'P' ? 'Perempuan' : 'Laki-laki'} · {activeStudent.kelas} · {activeStudent.jurusan}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Periode Laporan: <strong className="text-slate-700 dark:text-slate-200">{periodLabel}</strong> · Tanggal Cetak:{' '}
                {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Skor Kemandirian Terkini</p>
              <p className="font-display text-3xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {indivData.diagnostic?.totalScore ?? activeStudent.latestScore ?? 0}
                <span className="text-base font-medium text-slate-400">/100</span>
              </p>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Kategori: {indivData.diagnostic?.category ?? activeStudent.latestCategory ?? '-'}
              </p>
            </div>
          </div>

          {/* Condition Summary Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              indivData.condition.tone === 'emerald'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200'
                : indivData.condition.tone === 'rose'
                  ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-200'
                  : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {indivData.condition.tone === 'emerald' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : indivData.condition.tone === 'rose' ? (
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <MinusCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">
                  Kondisi Siswa: {indivData.condition.label}
                </p>
                <p className="text-xs mt-0.5 opacity-90">{indivData.condition.description}</p>
              </div>
            </div>

            {indivData.diagDelta !== null && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-current/15 text-xs font-semibold shrink-0">
                <TrendingUp className="w-4 h-4" />
                <span>
                  Tren Skor: {indivData.diagDelta >= 0 ? `+${indivData.diagDelta}` : indivData.diagDelta} poin
                </span>
              </div>
            )}
          </div>

          {/* 4 Quick Condition Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Penilaian Periode Ini</p>
              <p className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {indivData.periodDiags.length} Kali
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Tahap HUMANIS</p>
              <p className="font-display text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-0.5">
                {indivData.humanis?.completedStages.length ?? 0}/7 Tahap
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Observasi Kondisi</p>
              <p className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {indivData.obs.length} Catatan
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Tindakan Coaching</p>
              <p className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {indivData.procs.length} Sesi
              </p>
            </div>
          </div>

          {/* Biodata & Profil Kemandirian 5 Aspek + Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Biodata Lengkap &amp; Skor 5 Aspek Kemandirian
              </h3>
              <dl className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <dt>No. HP Siswa</dt>
                  <dd className="font-mono font-medium text-slate-900 dark:text-slate-200">
                    {activeStudent.noHp || '-'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <dt>Alamat Domisili</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-200 text-right max-w-[240px]">
                    {activeStudent.alamat || '-'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <dt>Orang Tua / Wali</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-200 text-right">
                    {activeStudent.namaOrangTua || '-'} ({activeStudent.nomorOrangTua || '-'})
                  </dd>
                </div>

                {[
                  { label: 'Tanggung Jawab', val: indivData.diagnostic?.tanggungJawab },
                  { label: 'Disiplin', val: indivData.diagnostic?.disiplin },
                  { label: 'Inisiatif', val: indivData.diagnostic?.inisiatif },
                  { label: 'Pengambilan Keputusan', val: indivData.diagnostic?.pengambilanKeputusan },
                  { label: 'Manajemen Diri', val: indivData.diagnostic?.manajemenDiri },
                ].map((aspect) => {
                  const scoreVal = typeof aspect.val === 'number' ? aspect.val : 0;
                  return (
                    <div key={aspect.label} className="space-y-1 pt-0.5">
                      <div className="flex justify-between">
                        <dt>{aspect.label}</dt>
                        <dd className="font-mono font-semibold text-slate-900 dark:text-slate-200">
                          {typeof aspect.val === 'number' ? `${aspect.val}/5` : '-/5'}
                        </dd>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${(scoreVal / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </dl>
            </div>

            <div className="space-y-4">
              <div className="space-y-2.5">
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Grafik Perkembangan Skor Penilaian &amp; Observasi ({periodLabel})
                </h3>
                <div className="h-48 w-full">
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
                          name="Skor Observasi"
                          stroke="#2563EB"
                          strokeWidth={2.5}
                          dot={{ r: 3.5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : indivData.periodDiags.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={indivData.periodDiags}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                        <XAxis dataKey="assessedDate" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="totalScore"
                          name="Skor Penilaian"
                          stroke="#2563EB"
                          strokeWidth={2.5}
                          dot={{ r: 3.5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      Belum ada data tren penilaian pada rentang {periodLabel.toLowerCase()}.
                    </div>
                  )}
                </div>
              </div>

              {/* Latest Academic / Social / Emotional Snapshot */}
              {indivData.latestObs && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[11px]">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Akademik</p>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {indivData.latestObs.kondisiAkademik}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[11px]">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Sosial</p>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {indivData.latestObs.kondisiSosial}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[11px]">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Emosional</p>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {indivData.latestObs.kondisiEmosional}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Periodic Diagnostic History Table */}
          {indivData.periodDiags.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Riwayat Penilaian Periodik ({periodLabel})</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-3 font-medium">Tanggal</th>
                      <th className="py-2 px-3 font-medium">Periode</th>
                      <th className="py-2 px-3 font-medium text-right">Skor</th>
                      <th className="py-2 px-3 font-medium">Kategori</th>
                      <th className="py-2 pl-3 font-medium">Catatan Asesmen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {indivData.periodDiags.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 pr-3 font-mono whitespace-nowrap">{d.assessedDate}</td>
                        <td className="py-2 px-3 font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {getAssessmentPeriodLabel(d.periodMonths)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums">
                          {d.totalScore}/100
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">{d.category}</td>
                        <td className="py-2 pl-3 text-slate-600 dark:text-slate-400">{d.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tahapan HUMANIS Detail */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>
                Detail Pembinaan HUMANIS ({indivData.humanis?.completedStages.length ?? 0}/7 Terlaksana)
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  H — Humanisasi Potensi &amp; Cita-cita
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Minat: {indivData.humanis?.hMinat || '-'} · Bakat: {indivData.humanis?.hBakat || '-'} · Cita-cita:{' '}
                  {indivData.humanis?.hCitaCita || '-'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  U &amp; M — Kesadaran Mandiri &amp; Keteladanan
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  {indivData.humanis?.uKesadaranMandiri || '-'} · Respon siswa:{' '}
                  {indivData.humanis?.mResponSiswa || '-'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  A &amp; N — Apresiasi &amp; Pembiasaan
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Progres: {indivData.humanis?.aProgresDicapai || '-'} · Kebiasaan:{' '}
                  {indivData.humanis?.nKebiasaanPositif || '-'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  I &amp; S — Internalisasi &amp; Sinergi Tindak Lanjut
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Refleksi: {indivData.humanis?.iRefleksiSiswa || '-'} · Tindak lanjut:{' '}
                  {indivData.humanis?.sTindakLanjut || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Coaching Processes & Good Statements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Log Pembinaan &amp; Coaching ({indivData.procs.length})</span>
              </h3>
              {indivData.procs.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Belum ada log pembinaan pada rentang periode ini.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {indivData.procs.map((p) => (
                    <li
                      key={p.id}
                      className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-0.5"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{p.tanggal} · Tahap {p.tahapHumanis}</span>
                        <span>{p.petugasNama || p.petugasRole}</span>
                      </div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{p.tindakan}</p>
                      <p className="text-slate-600 dark:text-slate-400">Hasil: {p.hasilSementara}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquareQuote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Pernyataan Komitmen Baik Siswa ({indivData.stmts.length})</span>
              </h3>
              {indivData.stmts.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Belum ada pernyataan komitmen baik pada rentang periode ini.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {indivData.stmts.map((st) => (
                    <li
                      key={st.id}
                      className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50"
                    >
                      <p className="italic text-slate-800 dark:text-slate-200">"{st.kalimat}"</p>
                      <p className="text-[11px] font-mono text-slate-400 mt-1">{st.tanggal}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Rekomendasi Tindakan (AI / Guru Penggerak) */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Analisis Kondisi &amp; Rekomendasi Tindakan Wali Kelas
            </h3>
            {indivData.aiReport ? (
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2.5">
                <p className="leading-relaxed">{indivData.aiReport.analisisSiswa}</p>
                <p>
                  <strong>Prediksi Perkembangan:</strong> {indivData.aiReport.prediksiPerkembangan}
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {indivData.aiReport.saranTindakan.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada analisis AI tersimpan untuk siswa ini. Jalankan analisis di menu AI Advisor
                untuk melengkapi rekomendasi tindakan.
              </p>
            )}
          </div>

          {/* Print Signature Block */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-8 text-xs text-slate-700 dark:text-slate-300">
            <div>
              <p>Mengetahui,</p>
              <p className="font-medium">Orang Tua / Wali Siswa</p>
              <div className="h-14" />
              <p className="font-semibold underline decoration-slate-300 underline-offset-4">
                {activeStudent.namaOrangTua || '........................................'}
              </p>
            </div>
            <div className="text-right">
              <p>{schoolName}</p>
              <p className="font-medium">Wali Kelas Pembina</p>
              <div className="h-14" />
              <p className="font-semibold underline decoration-slate-300 underline-offset-4">
                {waliKelasName}
              </p>
            </div>
          </div>
        </div>
      )}

      {reportTab === 'kelas' && (
        <div className="print-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {schoolName} · Laporan Perkembangan Kelas HUMANIS SMK ({periodLabel})
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {classFilter === 'Semua' ? 'Seluruh Kelas Binaan' : `Kelas ${classFilter}`}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total {classPriority.length > 0 ? `${classStudents.length} siswa · ${classPriority.length} siswa prioritas pembinaan` : `${classStudents.length} siswa`}
              </p>
            </div>
          </div>

          {/* Class Progression KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Rata-rata Skor ({periodLabel})</p>
              <p className="font-display text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-0.5">
                {classStats.avgScore}/100
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Siswa Mengalami Kenaikan</p>
              <p className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                {classStats.improvedCount} Siswa
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Perlu Pendampingan</p>
              <p className="font-display text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
                {classStats.priorityCount} Siswa
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Asesmen pada Periode</p>
              <p className="font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {classStats.assessmentsCount} Data
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3 font-medium">NISN</th>
                  <th className="py-2.5 px-3 font-medium">Nama Siswa</th>
                  <th className="py-2.5 px-3 font-medium">Kelas</th>
                  <th className="py-2.5 px-3 font-medium text-right">Skor</th>
                  <th className="py-2.5 px-3 font-medium text-right">Perkembangan</th>
                  <th className="py-2.5 px-3 font-medium">Periode</th>
                  <th className="py-2.5 px-3 font-medium">Kategori</th>
                  <th className="py-2.5 px-3 font-medium text-right">HUMANIS</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 pl-3 font-medium text-right no-print">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                {classProgressionRows.map(({ student: s, latestDiag, currentScore, delta, humStages }) => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-3 font-mono text-xs tabular-nums">{s.nisn}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                      {s.namaLengkap}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{s.kelas}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                      {currentScore}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                      {delta === null ? (
                        <span className="text-slate-400">—</span>
                      ) : delta > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          +{delta} poin
                        </span>
                      ) : delta < 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          {delta} poin
                        </span>
                      ) : (
                        <span className="text-slate-500">Stabil</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {latestDiag ? getAssessmentPeriodLabel(latestDiag.periodMonths) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {latestDiag?.category ?? s.latestCategory ?? '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {humStages}/7
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {s.latestCondition === 'perlu_pendampingan'
                        ? 'Prioritas Pembinaan'
                        : s.latestCondition === 'baik'
                          ? 'Baik'
                          : 'Cukup'}
                    </td>
                    <td className="py-2.5 pl-3 text-right no-print whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStudent(s.id);
                          setReportTab('individu');
                        }}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Lihat Individu
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
