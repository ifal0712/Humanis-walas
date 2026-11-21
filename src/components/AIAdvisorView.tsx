import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Minus,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import type {
  AIStudentAnalysisResult,
  CoachingProcess,
  Diagnostic,
  GoodStatement,
  HumanisProgress,
  Observation,
  ReportRecord,
  Student,
} from '../types/humanis';
import { requestStudentAIAnalysis } from '../lib/aiService';
import { saveReportRecord } from '../lib/firestoreService';

interface AIAdvisorViewProps {
  ownerId: string;
  students: Student[];
  diagnostics: Diagnostic[];
  humanisList: HumanisProgress[];
  observations: Observation[];
  processes: CoachingProcess[];
  statements: GoodStatement[];
  reports: ReportRecord[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  staffName: string;
}

export const AIAdvisorView: React.FC<AIAdvisorViewProps> = ({
  ownerId,
  students,
  diagnostics,
  humanisList,
  observations,
  processes,
  statements,
  reports,
  selectedStudentId,
  onSelectStudent,
  staffName,
}) => {
  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0] || null,
    [students, selectedStudentId]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<AIStudentAnalysisResult | null>(null);

  const studentContext = useMemo(() => {
    if (!activeStudent) return null;
    const diagnostic = diagnostics
      .filter((d) => d.studentId === activeStudent.id)
      .sort((a, b) => b.assessedDate.localeCompare(a.assessedDate))[0];
    const humanis = humanisList.find((h) => h.studentId === activeStudent.id);
    const obs = observations
      .filter((o) => o.studentId === activeStudent.id)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const procs = processes
      .filter((p) => p.studentId === activeStudent.id)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const stmts = statements.filter((s) => s.studentId === activeStudent.id);
    const savedReports = reports.filter((r) => r.studentId === activeStudent.id);

    return { diagnostic, humanis, obs, procs, stmts, savedReports };
  }, [activeStudent, diagnostics, humanisList, observations, processes, statements, reports]);

  const handleAnalyze = async () => {
    if (!activeStudent || !studentContext) return;
    setError(null);
    setLoading(true);
    try {
      const result = await requestStudentAIAnalysis({
        student: activeStudent,
        diagnostic: studentContext.diagnostic,
        humanis: studentContext.humanis,
        observations: studentContext.obs,
        processes: studentContext.procs,
        goodStatements: studentContext.stmts,
      });
      setLatestResult(result);

      await saveReportRecord(ownerId, {
        reportType: 'ai_insight',
        studentId: activeStudent.id,
        studentName: activeStudent.namaLengkap,
        kelas: activeStudent.kelas,
        title: `Analisis AI Gemini — ${activeStudent.namaLengkap}`,
        analisisSiswa: result.analisisSiswa,
        saranTindakan: result.saranTindakan,
        prediksiPerkembangan: result.prediksiPerkembangan,
        generatedBy: staffName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menjalankan analisis AI.');
    } finally {
      setLoading(false);
    }
  };

  if (!activeStudent || !studentContext) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-600 dark:text-slate-400">
        Tambahkan siswa terlebih dahulu untuk menggunakan Analisis AI Gemini.
      </div>
    );
  }

  const displayedReport =
    latestResult ||
    (studentContext.savedReports[0]
      ? {
          analisisSiswa: studentContext.savedReports[0].analisisSiswa,
          saranTindakan: studentContext.savedReports[0].saranTindakan,
          prediksiPerkembangan: studentContext.savedReports[0].prediksiPerkembangan,
          alasanPrediksi: '',
          fokusHumanis: '',
        }
      : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            AI Advisor Kemandirian (Gemini)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Menganalisis diagnostik, observasi, tahapan HUMANIS, dan pernyataan baik secara
            real-time.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={activeStudent.id}
            onChange={(e) => {
              onSelectStudent(e.target.value);
              setLatestResult(null);
            }}
            className="px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.namaLengkap} ({s.kelas})
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={loading}
            onClick={handleAnalyze}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{loading ? 'Menganalisis Siswa...' : 'Jalankan Analisis AI'}</span>
          </button>
        </div>
      </div>

      {/* Data Context Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Skor Diagnostik</p>
          <p className="font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {studentContext.diagnostic?.totalScore ?? activeStudent.latestScore ?? 0}/100
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {studentContext.diagnostic?.category ?? activeStudent.latestCategory ?? 'Belum dites'}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tahap HUMANIS</p>
          <p className="font-display text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-1">
            {studentContext.humanis?.completedStages.length ?? 0}/7
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tahap terlaksana</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Catatan Observasi</p>
          <p className="font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {studentContext.obs.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Sesi pengamatan</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Log Pembinaan</p>
          <p className="font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {studentContext.procs.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {studentContext.stmts.length} pernyataan baik
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-800 dark:text-rose-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {displayedReport ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Analisis & Saran */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Analisis Siswa
              </h2>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                {displayedReport.analisisSiswa}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Saran Tindakan Wali Kelas
              </h3>
              <ul className="space-y-2.5">
                {displayedReport.saranTindakan.map((saran, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>{saran}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Prediksi Perkembangan & Fokus HUMANIS */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Prediksi Perkembangan
              </h3>
              <div className="flex items-center gap-3">
                {displayedReport.prediksiPerkembangan === 'Meningkat' ? (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                ) : displayedReport.prediksiPerkembangan === 'Berisiko Menurun' ? (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                    <Minus className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <p className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {displayedReport.prediksiPerkembangan}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Proyeksi 30 hari ke depan
                  </p>
                </div>
              </div>
              {displayedReport.alasanPrediksi && (
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800">
                  {displayedReport.alasanPrediksi}
                </p>
              )}
            </div>

            {displayedReport.fokusHumanis && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-2">
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Prioritas Tahap HUMANIS
                </h3>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                  {displayedReport.fokusHumanis}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto" />
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Siap Menganalisis {activeStudent.namaLengkap}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Klik <strong>Jalankan Analisis AI</strong> untuk mengirim data diagnostik, observasi,
            dan progres HUMANIS ke Gemini API serta menyimpan rekomendasinya secara otomatis.
          </p>
        </div>
      )}
    </div>
  );
};
