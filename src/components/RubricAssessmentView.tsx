import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';
import {
  ListChecks,
  BookOpenCheck,
  CheckCircle2,
  Loader2,
  Printer,
  FileText,
  CalendarRange,
  TrendingUp,
  Compass,
  RotateCcw,
} from 'lucide-react';
import type { Diagnostic, StaffRole, Student } from '../types/humanis';
import { saveDiagnostic } from '../lib/firestoreService';
import {
  INDEPENDENCE_CLASSIFICATION_GUIDE,
  RUBRIC_ASPECTS,
  RUBRIC_INDICATORS,
  RUBRIC_LEVEL_META,
  computeRubricSummary,
  getDefaultRubricSelections,
  type RubricAspectKey,
} from '../lib/independenceRubric';
import {
  ASSESSMENT_PERIOD_OPTIONS,
  REPORT_PERIOD_OPTIONS,
  filterByPeriodWindow,
  getAssessmentPeriodLabel,
  type AssessmentPeriodMonths,
  type ReportPeriodFilter,
} from '../lib/periodUtils';

interface RubricAssessmentViewProps {
  ownerId: string;
  students: Student[];
  diagnostics: Diagnostic[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  staffRole: StaffRole;
  schoolName?: string;
  evaluatorName?: string;
  onOpenStudentReport?: (studentId: string) => void;
}

export const RubricAssessmentView: React.FC<RubricAssessmentViewProps> = ({
  ownerId,
  students,
  diagnostics,
  selectedStudentId,
  onSelectStudent,
  staffRole,
  schoolName = 'SMK Negeri 1 Sidayu',
  evaluatorName = 'Wali Kelas Pembina',
  onOpenStudentReport,
}) => {
  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0] || null,
    [students, selectedStudentId]
  );

  const [subTab, setSubTab] = useState<'assess' | 'guide'>('assess');
  const [aspectFilter, setAspectFilter] = useState<'all' | RubricAspectKey>('all');
  const [selections, setSelections] = useState<Record<string, 1 | 2 | 3 | 4 | 5>>(() =>
    getDefaultRubricSelections(3)
  );
  const [assessedDate, setAssessedDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [periodMonths, setPeriodMonths] = useState<AssessmentPeriodMonths>(3);
  const [historyFilter, setHistoryFilter] = useState<ReportPeriodFilter>('all');
  const [customNotes, setCustomNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const summary = useMemo(() => computeRubricSummary(selections), [selections]);

  const radarData = useMemo(
    () =>
      RUBRIC_ASPECTS.map((asp) => ({
        aspect: asp.shortLabel,
        nilai: summary.aspectScores[asp.key],
        fullMark: 5,
      })),
    [summary]
  );

  const studentDiagnostics = useMemo(() => {
    if (!activeStudent) return [];
    return diagnostics
      .filter((d) => d.studentId === activeStudent.id)
      .sort((a, b) => b.assessedDate.localeCompare(a.assessedDate));
  }, [diagnostics, activeStudent]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return studentDiagnostics;
    if (historyFilter === 0) {
      return studentDiagnostics.filter((d) => (d.periodMonths ?? 0) === 0);
    }
    const byDate = filterByPeriodWindow(
      studentDiagnostics,
      (d) => d.assessedDate,
      historyFilter
    );
    return studentDiagnostics.filter(
      (d) => d.periodMonths === historyFilter || byDate.includes(d)
    );
  }, [studentDiagnostics, historyFilter]);

  const previousDiagnostic = studentDiagnostics[0] || null;
  const scoreDelta = previousDiagnostic ? summary.totalScore - previousDiagnostic.totalScore : null;

  const visibleAspects = useMemo(
    () =>
      aspectFilter === 'all'
        ? RUBRIC_ASPECTS
        : RUBRIC_ASPECTS.filter((a) => a.key === aspectFilter),
    [aspectFilter]
  );

  const handleSetLevel = (indicatorId: string, level: 1 | 2 | 3 | 4 | 5) => {
    if (staffRole === 'kepala_sekolah') return;
    setSelections((prev) => ({ ...prev, [indicatorId]: level }));
  };

  const handleApplyPreset = (level: 1 | 2 | 3 | 4 | 5) => {
    if (staffRole === 'kepala_sekolah') return;
    setSelections(getDefaultRubricSelections(level));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent || staffRole === 'kepala_sekolah') return;
    setSaving(true);
    setSavedNotice(null);
    try {
      const trimmedCustom = customNotes.trim();
      const combinedNotes = trimmedCustom
        ? `${summary.autoNotesSummary} Catatan: ${trimmedCustom}`.slice(0, 500)
        : summary.autoNotesSummary.slice(0, 500);

      await saveDiagnostic(ownerId, {
        studentId: activeStudent.id,
        studentName: activeStudent.namaLengkap,
        kelas: activeStudent.kelas,
        tanggungJawab: summary.aspectScores.tanggungJawab,
        disiplin: summary.aspectScores.disiplin,
        inisiatif: summary.aspectScores.inisiatif,
        pengambilanKeputusan: summary.aspectScores.pengambilanKeputusan,
        manajemenDiri: summary.aspectScores.manajemenDiri,
        totalScore: summary.totalScore,
        category: summary.category,
        assessedDate,
        periodMonths,
        notes: combinedNotes,
      });

      setSavedNotice(
        `Penilaian rubrik ${getAssessmentPeriodLabel(periodMonths)} untuk ${activeStudent.namaLengkap} (Skor ${summary.totalScore}/100 · ${summary.category}) berhasil disimpan.`
      );
      setCustomNotes('');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (summary.totalScore / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Header & Top Action Bar */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Penilaian Kemandirian (Rubrik Lengkap)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Asesmen terstandar 5 aspek × 15 indikator perilaku SMK dengan deskriptor rubrik level 1–5.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setSubTab('assess')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                subTab === 'assess'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Penilaian Siswa</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('guide')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                subTab === 'guide'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <BookOpenCheck className="w-3.5 h-3.5" />
              <span>Panduan Rubrik (15 Indikator)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Rubrik</span>
          </button>

          {activeStudent && onOpenStudentReport && (
            <button
              type="button"
              onClick={() => onOpenStudentReport(activeStudent.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Laporan Individu</span>
            </button>
          )}
        </div>
      </div>

      {/* Print Header */}
      <div className="print-only border-b-2 border-slate-800 pb-3 mb-4">
        <p className="text-xs uppercase tracking-wider text-slate-600">
          {schoolName} · Program HUMANIS Kemandirian Siswa SMK
        </p>
        <h2 className="text-xl font-bold text-slate-900">
          {subTab === 'guide'
            ? 'Panduan Matriks Rubrik Lengkap Penilaian Kemandirian Siswa'
            : `Lembar Penilaian Rubrik Kemandirian — ${activeStudent?.namaLengkap || '-'}`}
        </h2>
        {subTab === 'assess' && activeStudent && (
          <p className="text-xs text-slate-700 mt-1">
            NISN: {activeStudent.nisn} · Kelas: {activeStudent.kelas} ({activeStudent.jurusan}) ·{' '}
            Periode: {getAssessmentPeriodLabel(periodMonths)} · Tanggal: {assessedDate} · Penilai:{' '}
            {evaluatorName}
          </p>
        )}
      </div>

      {savedNotice && (
        <div className="no-print flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {subTab === 'guide' ? (
        /* TAB 2: COMPLETE REFERENCE MATRIX */
        <div className="space-y-6">
          {/* Classification Guide Cards */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Pedoman Konversi Skor &amp; Klasifikasi Kemandirian (Skala 0–100)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {INDEPENDENCE_CLASSIFICATION_GUIDE.map((g) => (
                <div
                  key={g.category}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {g.range}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {g.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {g.meaning}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-500 border-t border-slate-200/70 dark:border-slate-800 pt-1.5">
                    <strong className="text-slate-700 dark:text-slate-300">Tindak Lanjut:</strong>{' '}
                    {g.action}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Full 15-Indicator Matrix */}
          {RUBRIC_ASPECTS.map((aspect) => {
            const indicators = RUBRIC_INDICATORS.filter((i) => i.aspect === aspect.key);
            return (
              <div
                key={aspect.key}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
              >
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Aspek {aspect.label} (Bobot {aspect.weightPercent}% · Fokus HUMANIS: Tahap{' '}
                      {aspect.humanisFocus})
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {aspect.description}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-950/40">
                        <th className="py-3 px-4 w-56 font-semibold">Indikator Perilaku</th>
                        <th className="py-3 px-3 font-semibold text-rose-700 dark:text-rose-400">
                          Skor 1 (Intensif)
                        </th>
                        <th className="py-3 px-3 font-semibold text-orange-700 dark:text-orange-400">
                          Skor 2 (Mulai)
                        </th>
                        <th className="py-3 px-3 font-semibold text-amber-700 dark:text-amber-400">
                          Skor 3 (Cukup)
                        </th>
                        <th className="py-3 px-3 font-semibold text-blue-700 dark:text-blue-400">
                          Skor 4 (Mandiri)
                        </th>
                        <th className="py-3 px-3 font-semibold text-emerald-700 dark:text-emerald-400">
                          Skor 5 (Teladan)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {indicators.map((ind) => (
                        <tr key={ind.id} className="align-top">
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                              {ind.code}
                            </span>
                            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                              {ind.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {ind.contextSmk}
                            </p>
                          </td>
                          {([1, 2, 3, 4, 5] as const).map((lvl) => (
                            <td
                              key={lvl}
                              className="py-3 px-3 text-slate-700 dark:text-slate-300 leading-relaxed min-w-[155px]"
                            >
                              {ind.levels[lvl]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : !activeStudent ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-600 dark:text-slate-400">
          Tambahkan data siswa terlebih dahulu di menu Siswa sebelum melakukan penilaian rubrik kemandirian.
        </div>
      ) : (
        /* TAB 1: INTERACTIVE RUBRIC ASSESSMENT */
        <div className="space-y-6">
          {/* Student, Date & Period Selection Bar */}
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Pilih Siswa yang Dinilai
                </label>
                <select
                  value={activeStudent.id}
                  onChange={(e) => onSelectStudent(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.namaLengkap} ({s.kelas} · NISN {s.nisn})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Tanggal Penilaian
                </label>
                <input
                  type="date"
                  value={assessedDate}
                  onChange={(e) => setAssessedDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="md:col-span-4 flex flex-wrap items-center justify-end gap-2">
                {staffRole !== 'kepala_sekolah' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(3)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset ke Skor 3</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(4)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50 cursor-pointer"
                    >
                      <span>Preset Mandiri (4)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Periodic Range Selector */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <CalendarRange className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Rentang Periodik Penilaian</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {ASSESSMENT_PERIOD_OPTIONS.find((p) => p.value === periodMonths)?.description}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ASSESSMENT_PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={staffRole === 'kepala_sekolah'}
                    onClick={() => setPeriodMonths(opt.value)}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      periodMonths === opt.value
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

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Complete Rubric Scoring Cards */}
            <form onSubmit={handleSave} className="xl:col-span-8 space-y-5">
              {/* Aspect Filter Bar */}
              <div className="no-print flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAspectFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    aspectFilter === 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Semua Aspek (5)
                </button>
                {RUBRIC_ASPECTS.map((asp) => (
                  <button
                    key={asp.key}
                    type="button"
                    onClick={() => setAspectFilter(asp.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      aspectFilter === asp.key
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {asp.shortLabel} ({summary.aspectScores[asp.key]})
                  </button>
                ))}
              </div>

              {/* Aspects & Clickable Descriptor Matrix */}
              {visibleAspects.map((aspect, aspIdx) => {
                const indicators = RUBRIC_INDICATORS.filter((i) => i.aspect === aspect.key);
                const aspectScore = summary.aspectScores[aspect.key];

                return (
                  <section
                    key={aspect.key}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                          Aspek {aspectFilter === 'all' ? aspIdx + 1 : ''} · Bobot{' '}
                          {aspect.weightPercent}% · Tahap {aspect.humanisFocus}
                        </span>
                        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                          {aspect.label}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {aspect.description}
                        </p>
                      </div>
                      <div className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 shrink-0 text-center">
                        <p className="text-[10px] text-blue-700 dark:text-blue-300 font-medium">
                          Rata-rata Aspek
                        </p>
                        <p className="font-mono text-lg font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                          {aspectScore} / 5
                        </p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {indicators.map((ind) => {
                        const chosen = selections[ind.id] || 3;
                        const meta = RUBRIC_LEVEL_META[chosen];
                        return (
                          <div
                            key={ind.id}
                            className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                    {ind.code}
                                  </span>
                                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {ind.title}
                                  </h3>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  Konteks SMK: {ind.contextSmk}
                                </p>
                              </div>
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap shrink-0 ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                            </div>

                            {/* 5 Descriptive Rubric Options */}
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                              {([1, 2, 3, 4, 5] as const).map((lvl) => {
                                const isSelected = chosen === lvl;
                                const lvlMeta = RUBRIC_LEVEL_META[lvl];
                                return (
                                  <button
                                    key={lvl}
                                    type="button"
                                    disabled={staffRole === 'kepala_sekolah'}
                                    onClick={() => handleSetLevel(ind.id, lvl)}
                                    className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                                      isSelected
                                        ? `${lvlMeta.activeClass} shadow-xs`
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-mono text-xs font-bold">
                                        {lvlMeta.shortLabel}
                                      </span>
                                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                                    </div>
                                    <p
                                      className={`text-[11px] leading-snug ${
                                        isSelected
                                          ? 'text-white/95'
                                          : 'text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      {ind.levels[lvl]}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {/* Custom Notes & Save Action */}
              <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Catatan Bukti Perilaku &amp; Tindak Lanjut Wali Kelas / Guru BK
                  </label>
                  <textarea
                    rows={3}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    disabled={staffRole === 'kepala_sekolah'}
                    placeholder="Contoh: Siswa konsisten menerapkan K3 bengkel (Skor 5), namun masih perlu pendampingan manajemen waktu saat proyek kelompok..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ringkasan otomatis rubrik: {summary.autoNotesSummary}
                  </p>
                </div>

                {staffRole !== 'kepala_sekolah' && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ListChecks className="w-4 h-4" />
                      )}
                      <span>
                        {saving ? 'Menyimpan Penilaian...' : 'Simpan Hasil Penilaian Rubrik'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </form>

            {/* Right Column: Live Rubric Score, Radar, Weakest Indicators & History */}
            <div className="xl:col-span-4 space-y-6">
              {/* Live Summary Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    Rekapitulasi Skor Rubrik
                  </h2>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {summary.ratedCount}/{summary.totalIndicators} indikator
                  </span>
                </div>

                <div className="flex items-center gap-5">
                  <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="10"
                        className="text-slate-100 dark:text-slate-800"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke="#2563EB"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-300"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                        {summary.totalScore}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        dari 100
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Kategori</p>
                    <p className="font-display text-xl font-bold text-blue-600 dark:text-blue-400">
                      {summary.category}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {getAssessmentPeriodLabel(periodMonths)}
                    </p>
                    {previousDiagnostic && scoreDelta !== null && (
                      <p className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300 pt-1">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>
                          vs sebelumnya ({previousDiagnostic.totalScore}):{' '}
                          <strong
                            className={
                              scoreDelta >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}
                          </strong>
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Aspect Bars */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {RUBRIC_ASPECTS.map((asp) => {
                    const score = summary.aspectScores[asp.key];
                    const pct = Math.round((score / 5) * 100);
                    return (
                      <div key={asp.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {asp.label}
                          </span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                            {score}/5 ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Radar Chart */}
                <div className="h-56 w-full pt-2 border-t border-slate-100 dark:border-slate-800">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#94a3b8" strokeOpacity={0.3} />
                      <PolarAngleAxis dataKey="aspect" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} />
                      <Radar
                        name={activeStudent.namaLengkap}
                        dataKey="nilai"
                        stroke="#2563EB"
                        fill="#2563EB"
                        fillOpacity={0.28}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pedagogical Coaching Recommendation based on Rubric */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Saran Pembinaan Otomatis Rubrik
                  </h3>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Prioritas Penguatan: {summary.weakestAspect.label} (Tahap{' '}
                    {summary.weakestAspect.humanisFocus})
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                    {summary.weakestAspect.coachingTip}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    3 Indikator Terendah Saat Ini
                  </p>
                  {summary.weakestIndicators.map(({ indicator, score }) => (
                    <div
                      key={indicator.id}
                      className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                    >
                      <span className="text-slate-700 dark:text-slate-300">
                        <strong className="font-mono text-blue-600 dark:text-blue-400">
                          {indicator.code}
                        </strong>{' '}
                        {indicator.title}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                        {score}/5
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assessment History with 3/6/12 Month Filter */}
              <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Riwayat Penilaian ({filteredHistory.length})
                  </h3>
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {REPORT_PERIOD_OPTIONS.map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setHistoryFilter(opt.value)}
                        className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                          historyFilter === opt.value
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {opt.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Belum ada riwayat penilaian pada rentang periode ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredHistory.map((d) => (
                      <div key={d.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {d.category} · <span className="font-mono">{d.assessedDate}</span>
                          </p>
                          <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                            {getAssessmentPeriodLabel(d.periodMonths)}
                          </p>
                          {d.notes && (
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                              {d.notes}
                            </p>
                          )}
                        </div>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
                          {d.totalScore}/100
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
