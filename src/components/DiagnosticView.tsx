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
import { ClipboardCheck, CheckCircle2, Loader2, CalendarRange, FileText, TrendingUp } from 'lucide-react';
import type {
  Diagnostic,
  IndependenceCategory,
  StaffRole,
  Student,
} from '../types/humanis';
import { saveDiagnostic } from '../lib/firestoreService';
import {
  ASSESSMENT_PERIOD_OPTIONS,
  REPORT_PERIOD_OPTIONS,
  filterByPeriodWindow,
  getAssessmentPeriodLabel,
  type AssessmentPeriodMonths,
  type ReportPeriodFilter,
} from '../lib/periodUtils';

interface DiagnosticViewProps {
  ownerId: string;
  students: Student[];
  diagnostics: Diagnostic[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  staffRole: StaffRole;
  onOpenStudentReport?: (studentId: string) => void;
}

interface LikertQuestion {
  id: string;
  aspect: 'tanggungJawab' | 'disiplin' | 'inisiatif' | 'pengambilanKeputusan' | 'manajemenDiri';
  aspectLabel: string;
  text: string;
}

const QUESTIONS: LikertQuestion[] = [
  {
    id: 'tj1',
    aspect: 'tanggungJawab',
    aspectLabel: 'Tanggung Jawab',
    text: 'Saya menyelesaikan tugas tanpa harus diingatkan.',
  },
  {
    id: 'tj2',
    aspect: 'tanggungJawab',
    aspectLabel: 'Tanggung Jawab',
    text: 'Saya membuat jadwal belajar sendiri.',
  },
  {
    id: 'ds1',
    aspect: 'disiplin',
    aspectLabel: 'Disiplin',
    text: 'Saya datang tepat waktu.',
  },
  {
    id: 'ds2',
    aspect: 'disiplin',
    aspectLabel: 'Disiplin',
    text: 'Saya menaati aturan sekolah.',
  },
  {
    id: 'in1',
    aspect: 'inisiatif',
    aspectLabel: 'Inisiatif',
    text: 'Saya mencari solusi sendiri saat mengalami kesulitan.',
  },
  {
    id: 'in2',
    aspect: 'inisiatif',
    aspectLabel: 'Inisiatif',
    text: 'Saya berusaha menemukan sumber belajar tambahan.',
  },
  {
    id: 'pk1',
    aspect: 'pengambilanKeputusan',
    aspectLabel: 'Pengambilan Keputusan',
    text: 'Saya mampu menentukan prioritas pekerjaan.',
  },
  {
    id: 'md1',
    aspect: 'manajemenDiri',
    aspectLabel: 'Manajemen Diri',
    text: 'Saya dapat mengatur waktu dengan baik.',
  },
];

function classifyScore(totalScore: number): IndependenceCategory {
  if (totalScore < 36) return 'Sangat Rendah';
  if (totalScore < 52) return 'Rendah';
  if (totalScore < 68) return 'Sedang';
  if (totalScore < 84) return 'Baik';
  return 'Sangat Baik';
}

export const DiagnosticView: React.FC<DiagnosticViewProps> = ({
  ownerId,
  students,
  diagnostics,
  selectedStudentId,
  onSelectStudent,
  staffRole,
  onOpenStudentReport,
}) => {
  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0] || null,
    [students, selectedStudentId]
  );

  const [answers, setAnswers] = useState<Record<string, number>>({
    tj1: 3,
    tj2: 3,
    ds1: 4,
    ds2: 4,
    in1: 3,
    in2: 3,
    pk1: 3,
    md1: 3,
  });
  const [assessedDate, setAssessedDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [periodMonths, setPeriodMonths] = useState<AssessmentPeriodMonths>(3);
  const [historyFilter, setHistoryFilter] = useState<ReportPeriodFilter>('all');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const computed = useMemo(() => {
    const tanggungJawab = Number(((answers.tj1 + answers.tj2) / 2).toFixed(2));
    const disiplin = Number(((answers.ds1 + answers.ds2) / 2).toFixed(2));
    const inisiatif = Number(((answers.in1 + answers.in2) / 2).toFixed(2));
    const pengambilanKeputusan = Number(answers.pk1.toFixed(2));
    const manajemenDiri = Number(answers.md1.toFixed(2));

    const avgAspect =
      (tanggungJawab + disiplin + inisiatif + pengambilanKeputusan + manajemenDiri) / 5;
    const totalScore = Math.round((avgAspect / 5) * 100);
    const category = classifyScore(totalScore);

    return {
      tanggungJawab,
      disiplin,
      inisiatif,
      pengambilanKeputusan,
      manajemenDiri,
      totalScore,
      category,
    };
  }, [answers]);

  const radarData = useMemo(
    () => [
      { aspect: 'Tanggung Jawab', nilai: computed.tanggungJawab, fullMark: 5 },
      { aspect: 'Disiplin', nilai: computed.disiplin, fullMark: 5 },
      { aspect: 'Inisiatif', nilai: computed.inisiatif, fullMark: 5 },
      { aspect: 'Keputusan', nilai: computed.pengambilanKeputusan, fullMark: 5 },
      { aspect: 'Manajemen Diri', nilai: computed.manajemenDiri, fullMark: 5 },
    ],
    [computed]
  );

  const studentDiagnostics = useMemo(() => {
    if (!activeStudent) return [];
    return diagnostics
      .filter((d) => d.studentId === activeStudent.id)
      .sort((a, b) => b.assessedDate.localeCompare(a.assessedDate));
  }, [diagnostics, activeStudent]);

  const filteredDiagnostics = useMemo(() => {
    if (historyFilter === 'all') return studentDiagnostics;
    const byDate = filterByPeriodWindow(
      studentDiagnostics,
      (d) => d.assessedDate,
      historyFilter
    );
    // Also retain items explicitly tagged with that exact periodic bucket if date is older
    const matchingPeriod = studentDiagnostics.filter(
      (d) => d.periodMonths === historyFilter || byDate.includes(d)
    );
    return matchingPeriod;
  }, [studentDiagnostics, historyFilter]);

  const previousDiagnostic = studentDiagnostics[0] || null;
  const scoreDelta = previousDiagnostic ? computed.totalScore - previousDiagnostic.totalScore : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) return;
    setSaving(true);
    setSavedNotice(null);
    try {
      await saveDiagnostic(ownerId, {
        studentId: activeStudent.id,
        studentName: activeStudent.namaLengkap,
        kelas: activeStudent.kelas,
        tanggungJawab: computed.tanggungJawab,
        disiplin: computed.disiplin,
        inisiatif: computed.inisiatif,
        pengambilanKeputusan: computed.pengambilanKeputusan,
        manajemenDiri: computed.manajemenDiri,
        totalScore: computed.totalScore,
        category: computed.category,
        assessedDate,
        periodMonths,
        notes,
      });
      setSavedNotice(
        `Hasil penilaian ${getAssessmentPeriodLabel(periodMonths)} untuk ${activeStudent.namaLengkap} (Skor ${computed.totalScore} · ${computed.category}) tersimpan.`
      );
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  // Progress circle geometry
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (computed.totalScore / 100) * circumference;

  if (!activeStudent) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-600 dark:text-slate-400">
        Tambahkan data siswa terlebih dahulu di menu Data Siswa sebelum mengisi Tes Diagnostik.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Tes Diagnostik Awal Kemandirian
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Instrumen asesmen skala Likert 1–5 untuk memetakan 5 aspek kemandirian siswa SMK.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={activeStudent.id}
            onChange={(e) => onSelectStudent(e.target.value)}
            className="w-full sm:w-64 px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.namaLengkap} ({s.kelas})
              </option>
            ))}
          </select>
          {onOpenStudentReport && (
            <button
              type="button"
              onClick={() => onOpenStudentReport(activeStudent.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Lihat &amp; Cetak Laporan</span>
            </button>
          )}
        </div>
      </div>

      {savedNotice && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Likert 1-5 Instrument Form */}
        <form
          onSubmit={handleSave}
          className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Instrumen Skala Likert (1 = Sangat Tidak Sesuai, 5 = Sangat Sesuai)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Siswa: {activeStudent.namaLengkap} · {activeStudent.kelas}
              </p>
            </div>
            <input
              type="date"
              value={assessedDate}
              onChange={(e) => setAssessedDate(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Rentang Periodik Penilaian (Awal / 3 / 6 / 12 Bulan) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
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
                  className={`py-2 px-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    periodMonths === opt.value
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {QUESTIONS.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      0{idx + 1}. {q.aspectLabel}
                    </span>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                      {q.text}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
                    {answers[q.id]}/5
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      disabled={staffRole === 'kepala_sekolah'}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                      className={`py-2 text-xs font-mono font-semibold rounded-lg border transition-colors cursor-pointer ${
                        answers[q.id] === val
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Catatan Tambahan Asesmen
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tuliskan temuan singkat perilaku siswa saat pengisian instrumen..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
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
                  <ClipboardCheck className="w-4 h-4" />
                )}
                <span>{saving ? 'Menyimpan...' : 'Simpan Hasil Diagnostik'}</span>
              </button>
            </div>
          )}
        </form>

        {/* Right: Live Progress Circle + Radar Chart + History */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Visualisasi Skor Kemandirian
            </h2>

            {/* Progress Circle */}
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  <circle
                    cx="64"
                    cy="64"
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
                    {computed.totalScore}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">dari 100</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">Kategori Kemandirian</p>
                <p className="font-display text-xl font-bold text-blue-600 dark:text-blue-400">
                  {computed.category}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Klasifikasi otomatis: Sangat Rendah, Rendah, Sedang, Baik, atau Sangat Baik.
                </p>
                {previousDiagnostic && scoreDelta !== null && (
                  <div className="inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>
                      Selisih vs penilaian sebelumnya ({previousDiagnostic.totalScore}):{' '}
                      <strong
                        className={
                          scoreDelta >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                      >
                        {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} poin
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Radar Chart */}
            <div className="h-64 w-full pt-2 border-t border-slate-100 dark:border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                  <PolarGrid stroke="#94a3b8" strokeOpacity={0.3} />
                  <PolarAngleAxis dataKey="aspect" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
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

          {/* Diagnostic History with Periodic Range Filter */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Riwayat Penilaian ({filteredDiagnostics.length})
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

            {filteredDiagnostics.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada riwayat penilaian pada rentang periode ini.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDiagnostics.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {d.category} · <span className="font-mono">{d.assessedDate}</span>
                      </p>
                      <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                        {getAssessmentPeriodLabel(d.periodMonths)}
                      </p>
                      {d.notes && (
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">{d.notes}</p>
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
  );
};
