import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Users,
  Award,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  Database,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type {
  AIClassInsightResult,
  Diagnostic,
  HumanisProgress,
  HumanisStageKey,
  Observation,
  StaffRole,
  Student,
} from '../types/humanis';
import { requestClassAIInsight } from '../lib/aiService';

interface DashboardViewProps {
  students: Student[];
  diagnostics: Diagnostic[];
  humanisList: HumanisProgress[];
  observations: Observation[];
  staffRole: StaffRole;
  onSeedDemo: () => Promise<void>;
  seeding: boolean;
  onNavigateStudent: (studentId: string, tab: 'humanis' | 'ai' | 'diagnostik' | 'laporan') => void;
  onNavigateMenu: (menu: string) => void;
}

const STAGE_LABELS: Record<HumanisStageKey, string> = {
  H: 'Humanisasi Potensi',
  U: 'Urgensi & Pemahaman',
  M: 'Modeling & Keteladanan',
  A: 'Apresiasi Progres Kecil',
  N: 'Normalisasi & Pembiasaan',
  I: 'Internalisasi Nilai',
  S: 'Sinergi & Keberlanjutan',
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  diagnostics,
  humanisList,
  observations,
  staffRole,
  onSeedDemo,
  seeding,
  onNavigateStudent,
  onNavigateMenu,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  const [aiInsight, setAiInsight] = useState<AIClassInsightResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const classes = useMemo(() => {
    const set = new Set(students.map((s) => s.kelas).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (selectedClass === 'Semua') return students;
    return students.filter((s) => s.kelas === selectedClass);
  }, [students, selectedClass]);

  const filteredStudentIds = useMemo(
    () => new Set(filteredStudents.map((s) => s.id)),
    [filteredStudents]
  );

  const stats = useMemo(() => {
    let highCount = 0;
    let mediumCount = 0;
    let attentionCount = 0;

    filteredStudents.forEach((s) => {
      const score = s.latestScore ?? 0;
      const cond = s.latestCondition;
      if (cond === 'perlu_pendampingan' || (score > 0 && score < 55)) {
        attentionCount++;
      } else if (score >= 75 || cond === 'baik') {
        highCount++;
      } else {
        mediumCount++;
      }
    });

    return {
      total: filteredStudents.length,
      highCount,
      mediumCount,
      attentionCount,
    };
  }, [filteredStudents]);

  // Radar Chart averages across 5 independence aspects
  const aspectAverages = useMemo(() => {
    const relevant = diagnostics.filter((d) => filteredStudentIds.has(d.studentId));
    if (relevant.length === 0) {
      return {
        tanggungJawab: 0,
        disiplin: 0,
        inisiatif: 0,
        pengambilanKeputusan: 0,
        manajemenDiri: 0,
      };
    }
    const sum = relevant.reduce(
      (acc, d) => ({
        tanggungJawab: acc.tanggungJawab + d.tanggungJawab,
        disiplin: acc.disiplin + d.disiplin,
        inisiatif: acc.inisiatif + d.inisiatif,
        pengambilanKeputusan: acc.pengambilanKeputusan + d.pengambilanKeputusan,
        manajemenDiri: acc.manajemenDiri + d.manajemenDiri,
      }),
      {
        tanggungJawab: 0,
        disiplin: 0,
        inisiatif: 0,
        pengambilanKeputusan: 0,
        manajemenDiri: 0,
      }
    );
    const n = relevant.length;
    return {
      tanggungJawab: Number((sum.tanggungJawab / n).toFixed(2)),
      disiplin: Number((sum.disiplin / n).toFixed(2)),
      inisiatif: Number((sum.inisiatif / n).toFixed(2)),
      pengambilanKeputusan: Number((sum.pengambilanKeputusan / n).toFixed(2)),
      manajemenDiri: Number((sum.manajemenDiri / n).toFixed(2)),
    };
  }, [diagnostics, filteredStudentIds]);

  const radarData = useMemo(
    () => [
      { aspect: 'Tanggung Jawab', nilai: aspectAverages.tanggungJawab, fullMark: 5 },
      { aspect: 'Disiplin', nilai: aspectAverages.disiplin, fullMark: 5 },
      { aspect: 'Inisiatif', nilai: aspectAverages.inisiatif, fullMark: 5 },
      { aspect: 'Keputusan', nilai: aspectAverages.pengambilanKeputusan, fullMark: 5 },
      { aspect: 'Manajemen Diri', nilai: aspectAverages.manajemenDiri, fullMark: 5 },
    ],
    [aspectAverages]
  );

  // Monthly Trend Chart from observations
  const monthlyTrend = useMemo(() => {
    const relevantObs = observations.filter((o) => filteredStudentIds.has(o.studentId));
    if (relevantObs.length === 0) return [];
    const grouped: Record<string, { sum: number; count: number }> = {};
    relevantObs.forEach((o) => {
      const monthKey = o.tanggal.slice(0, 7); // YYYY-MM
      if (!grouped[monthKey]) grouped[monthKey] = { sum: 0, count: 0 };
      grouped[monthKey].sum += o.skorKemandirian;
      grouped[monthKey].count += 1;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        bulan: month,
        rataSkor: Math.round(v.sum / v.count),
      }));
  }, [observations, filteredStudentIds]);

  // HUMANIS Stage completion stats
  const humanisStageStats = useMemo(() => {
    const stages: HumanisStageKey[] = ['H', 'U', 'M', 'A', 'N', 'I', 'S'];
    const total = filteredStudents.length || 1;
    const relevantHum = humanisList.filter((h) => filteredStudentIds.has(h.studentId));
    return stages.map((key) => {
      const count = relevantHum.filter((h) => h.completedStages.includes(key)).length;
      const pct = filteredStudents.length === 0 ? 0 : Math.round((count / total) * 100);
      return { key, label: STAGE_LABELS[key], count, pct };
    });
  }, [humanisList, filteredStudents, filteredStudentIds]);

  // Priority students needing special attention
  const priorityStudents = useMemo(() => {
    return filteredStudents.filter(
      (s) => s.latestCondition === 'perlu_pendampingan' || (s.latestScore ?? 0) < 55
    );
  }, [filteredStudents]);

  const handleGenerateInsight = async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const avgStages =
        humanisList.length > 0
          ? Number(
              (
                humanisList
                  .filter((h) => filteredStudentIds.has(h.studentId))
                  .reduce((acc, h) => acc + h.completedStages.length, 0) /
                Math.max(1, filteredStudents.length)
              ).toFixed(1)
            )
          : 0;

      const result = await requestClassAIInsight({
        totalStudents: stats.total,
        highCount: stats.highCount,
        mediumCount: stats.mediumCount,
        attentionCount: stats.attentionCount,
        aspectAverages,
        classes: classes.filter((c) => c !== 'Semua'),
        avgHumanisStages: avgStages,
        priorityNames: priorityStudents.map((s) => `${s.namaLengkap} (${s.kelas})`),
      });
      setAiInsight(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Gagal menghubungi Gemini AI.');
    } finally {
      setAiLoading(false);
    }
  };

  if (students.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 space-y-5">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
          <Database className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Belum Ada Data Siswa Terdaftar
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Mulai dengan menambahkan data siswa SMK secara manual/Excel, atau muat 6 contoh data
            siswa lengkap (diagnostik, progres HUMANIS, observasi bulanan, dan pernyataan baik) ke
            Firestore untuk langsung mencoba dashboard dan analisis Gemini AI.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={seeding}
            onClick={onSeedDemo}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            <span>{seeding ? 'Menyimpan ke Firestore...' : 'Muat Data Contoh Siswa SMK'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateMenu('siswa')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
          >
            <span>Tambah Siswa Manual</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Class Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {staffRole === 'kepala_sekolah'
              ? 'Monitoring Kemandirian Seluruh Kelas'
              : staffRole === 'guru_bk'
                ? 'Dashboard Konseling & Diagnostik Siswa'
                : 'Dashboard Pembinaan Wali Kelas'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Ringkasan indikator kemandirian, keterlaksanaan tahapan HUMANIS, dan prioritas
            intervensi.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto max-w-full">
            {classes.map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedClass === cls
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Jumlah Siswa</p>
            <p className="font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.total}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Terdaftar di {selectedClass === 'Semua' ? 'semua kelas' : selectedClass}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Siswa Mandiri Tinggi
            </p>
            <p className="font-display text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {stats.highCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {stats.total ? Math.round((stats.highCount / stats.total) * 100) : 0}% kategori Baik /
              Sangat Baik
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Siswa Kategori Sedang
            </p>
            <p className="font-display text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {stats.mediumCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {stats.total ? Math.round((stats.mediumCount / stats.total) * 100) : 0}% perlu
              penguatan rutin
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Perlu Pendampingan
            </p>
            <p className="font-display text-3xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {stats.attentionCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Prioritas intervensi wali kelas
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Gemini AI Insight Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                AI Insight Kemandirian (Gemini)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Analisis otomatis pola kelemahan aspek dan rekomendasi intervensi kelas
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={aiLoading}
            onClick={handleGenerateInsight}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {aiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{aiLoading ? 'Menganalisis...' : 'Hasilkan AI Insight Kelas'}</span>
          </button>
        </div>

        {aiError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg">
            {aiError}
          </p>
        )}

        {aiInsight ? (
          <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed pt-2">
              {aiInsight.ringkasanEksekutif}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
              <span>
                Aspek Terkuat: <strong className="text-emerald-600 dark:text-emerald-400">{aiInsight.aspekTerkuat}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Perlu Penguatan: <strong className="text-amber-600 dark:text-amber-400">{aiInsight.aspekTerlemah}</strong>
              </span>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {aiInsight.rekomendasiStrategis.map((rek, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg"
                >
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span>{rek}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Klik tombol <strong>Hasilkan AI Insight Kelas</strong> untuk mendapatkan pembacaan
            Gemini AI atas rata-rata aspek diagnostik dan daftar siswa prioritas pada filter kelas
            saat ini.
          </p>
        )}
      </div>

      {/* Charts Grid: Radar Chart + Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart Kemandirian */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Radar Kemandirian Siswa
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rata-rata skor 5 aspek kemandirian (skala 1–5)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateMenu('diagnostik')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Input Diagnostik
            </button>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="74%" data={radarData}>
                <PolarGrid stroke="#94a3b8" strokeOpacity={0.3} />
                <PolarAngleAxis
                  dataKey="aspect"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
                <Radar
                  name="Rata-rata Kelas"
                  dataKey="nilai"
                  stroke="#2563EB"
                  fill="#2563EB"
                  fillOpacity={0.25}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Progress Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Grafik Perkembangan Bulanan
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tren rata-rata skor kemandirian hasil observasi berkala
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateMenu('kondisi')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Catat Observasi
            </button>
          </div>

          <div className="h-72 w-full">
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="blueTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="bulan" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="rataSkor"
                    name="Rata-rata Skor"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fill="url(#blueTrend)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                Belum ada data observasi bulanan untuk kelas ini.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: HUMANIS Stage Progress + Priority Attention Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* HUMANIS Stages Completion */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Keterlaksanaan Tahapan HUMANIS
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Persentase siswa yang telah menuntaskan setiap tahap
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateMenu('humanis')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Buka Modul
            </button>
          </div>

          <div className="space-y-3.5">
            {humanisStageStats.map((stage) => (
              <div key={stage.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 mr-1.5">
                      {stage.key}
                    </span>
                    {stage.label}
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {stage.count}/{filteredStudents.length} ({stage.pct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${stage.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Students Alert Table */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Siswa Membutuhkan Perhatian Khusus
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Siswa dengan kategori Perlu Pendampingan atau skor diagnostik di bawah 55
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-rose-600 dark:text-rose-400 tabular-nums">
              {priorityStudents.length} siswa
            </span>
          </div>

          {priorityStudents.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Seluruh siswa pada filter ini berada dalam kondisi Baik atau Cukup.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-3 font-medium">Nama Siswa</th>
                    <th className="py-2.5 px-3 font-medium">Kelas</th>
                    <th className="py-2.5 px-3 font-medium text-right">Skor</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                    <th className="py-2.5 pl-3 font-medium text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {priorityStudents.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 pr-3 font-medium text-slate-900 dark:text-white">
                        <div>{s.namaLengkap}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          NISN {s.nisn}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {s.kelas}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {s.latestScore ?? 0}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Perlu Pendampingan
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onNavigateStudent(s.id, 'laporan')}
                            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            Laporan
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            type="button"
                            onClick={() => onNavigateStudent(s.id, 'ai')}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            <span>Analisis AI</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            type="button"
                            onClick={() => onNavigateStudent(s.id, 'humanis')}
                            className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                          >
                            Bina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
