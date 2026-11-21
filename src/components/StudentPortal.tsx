import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardCheck,
  UserCog,
  Sun,
  Moon,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Compass,
  GitBranch,
  MessageSquareHeart,
  TrendingUp,
  Save,
  Lock,
  User,
} from 'lucide-react';
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
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type {
  HumanisStageKey,
  StudentPortalData,
  StudentSession,
} from '../types/humanis';
import {
  submitStudentAssessment,
  updateStudentBiodata,
} from '../lib/studentPortalService';

type StudentTab = 'ringkasan' | 'penilaian' | 'biodata';

interface StudentPortalProps {
  session: StudentSession;
  portalData: StudentPortalData;
  darkMode: boolean;
  schoolName?: string;
  onToggleDark: () => void;
  onUpdatePortalData: (next: StudentPortalData, nextSession?: StudentSession) => void;
  onLogout: () => void;
}

const HUMANIS_STAGES: Array<{ key: HumanisStageKey; name: string }> = [
  { key: 'H', name: 'Humanisasi Potensi' },
  { key: 'U', name: 'Urgensi & Pemahaman' },
  { key: 'M', name: 'Modeling & Keteladanan' },
  { key: 'A', name: 'Apresiasi Progres Kecil' },
  { key: 'N', name: 'Normalisasi & Pembiasaan' },
  { key: 'I', name: 'Internalisasi Nilai' },
  { key: 'S', name: 'Sinergi & Keberlanjutan' },
];

const LIKERT_ASPECTS = [
  {
    key: 'tanggungJawab',
    label: 'Tanggung Jawab',
    prompt: 'Saya menyelesaikan tugas praktik/belajar tepat waktu dan membuat jadwal belajar sendiri.',
  },
  {
    key: 'disiplin',
    label: 'Disiplin',
    prompt: 'Saya hadir tepat waktu dan menaati tata tertib sekolah maupun bengkel/lab.',
  },
  {
    key: 'inisiatif',
    label: 'Inisiatif',
    prompt: 'Saya mencari solusi dan sumber belajar tambahan saat menemui kesulitan.',
  },
  {
    key: 'pengambilanKeputusan',
    label: 'Pengambilan Keputusan',
    prompt: 'Saya mampu menentukan prioritas pekerjaan dan mengambil keputusan secara bijak.',
  },
  {
    key: 'manajemenDiri',
    label: 'Manajemen Diri',
    prompt: 'Saya mampu mengatur waktu, fokus belajar, dan emosi dengan baik.',
  },
] as const;

const LIKERT_LABELS = [
  { val: 1, text: '1 · Sangat Kurang' },
  { val: 2, text: '2 · Kurang' },
  { val: 3, text: '3 · Cukup' },
  { val: 4, text: '4 · Baik' },
  { val: 5, text: '5 · Sangat Baik' },
];

function computeCategory(score: number): string {
  if (score < 35) return 'Sangat Rendah';
  if (score < 55) return 'Rendah';
  if (score < 70) return 'Sedang';
  if (score < 85) return 'Baik';
  return 'Sangat Baik';
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  session,
  portalData,
  darkMode,
  schoolName,
  onToggleDark,
  onUpdatePortalData,
  onLogout,
}) => {
  const { student, diagnostics, humanis, observations, processes, goodStatements } = portalData;
  const [activeTab, setActiveTab] = useState<StudentTab>('ringkasan');

  // Assessment State
  const [scores, setScores] = useState({
    tanggungJawab: 4,
    disiplin: 4,
    inisiatif: 3,
    pengambilanKeputusan: 3,
    manajemenDiri: 3,
  });
  const [reflectNotes, setReflectNotes] = useState('');
  const [positiveStatement, setPositiveStatement] = useState('');
  const [assessSaving, setAssessSaving] = useState(false);
  const [assessFeedback, setAssessFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Biodata Form State
  const [bioForm, setBioForm] = useState({
    namaLengkap: student.namaLengkap || '',
    jenisKelamin: student.jenisKelamin || 'L',
    kelas: student.kelas || '',
    jurusan: student.jurusan || '',
    noHp: student.noHp || '',
    namaOrangTua: student.namaOrangTua || '',
    nomorOrangTua: student.nomorOrangTua || '',
    alamat: student.alamat || '',
    portalUsername: student.portalUsername || session.username || student.nisn || '',
    newPassword: '',
    confirmPassword: '',
  });
  const [bioSaving, setBioSaving] = useState(false);
  const [bioFeedback, setBioFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const latestDiagnostic = diagnostics[0] || null;
  const completedStages = humanis?.completedStages || [];
  const humanisPct = Math.round((completedStages.length / 7) * 100);

  const radarData = useMemo(() => {
    if (!latestDiagnostic) return [];
    return [
      { aspect: 'Tanggung Jawab', nilai: latestDiagnostic.tanggungJawab },
      { aspect: 'Disiplin', nilai: latestDiagnostic.disiplin },
      { aspect: 'Inisiatif', nilai: latestDiagnostic.inisiatif },
      { aspect: 'Keputusan', nilai: latestDiagnostic.pengambilanKeputusan },
      { aspect: 'Manajemen Diri', nilai: latestDiagnostic.manajemenDiri },
    ];
  }, [latestDiagnostic]);

  const obsTrendData = useMemo(
    () =>
      observations.map((o) => ({
        tanggal: o.tanggal,
        skor: o.skorKemandirian,
      })),
    [observations]
  );

  const previewScore = Math.round(
    ((scores.tanggungJawab +
      scores.disiplin +
      scores.inisiatif +
      scores.pengambilanKeputusan +
      scores.manajemenDiri) /
      25) *
      100
  );
  const previewCategory = computeCategory(previewScore);
  const circleRadius = 46;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (previewScore / 100) * circumference;

  const conditionInfo =
    student.latestCondition === 'baik'
      ? { label: 'Mandiri Baik', colorClass: 'text-emerald-600 dark:text-emerald-400' }
      : student.latestCondition === 'perlu_pendampingan'
        ? { label: 'Perlu Pendampingan', colorClass: 'text-rose-600 dark:text-rose-400' }
        : { label: 'Cukup Mandiri', colorClass: 'text-amber-600 dark:text-amber-400' };

  const handleSubmitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssessSaving(true);
    setAssessFeedback(null);
    try {
      const updated = await submitStudentAssessment(session.token, {
        ...scores,
        notes: reflectNotes,
        pernyataanBaik: positiveStatement,
      });
      onUpdatePortalData(updated);
      setReflectNotes('');
      setPositiveStatement('');
      setAssessFeedback({
        type: 'ok',
        text: `Penilaian mandiri berhasil disimpan dengan skor ${previewScore}/100 (${previewCategory}).`,
      });
    } catch (err) {
      setAssessFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan penilaian.',
      });
    } finally {
      setAssessSaving(false);
    }
  };

  const handleSaveBiodata = async (e: React.FormEvent) => {
    e.preventDefault();
    setBioFeedback(null);
    if (bioForm.namaLengkap.trim().length < 2) {
      setBioFeedback({ type: 'err', text: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    if (bioForm.newPassword && bioForm.newPassword !== bioForm.confirmPassword) {
      setBioFeedback({ type: 'err', text: 'Konfirmasi password baru tidak sama.' });
      return;
    }
    if (bioForm.newPassword && bioForm.newPassword.length < 4) {
      setBioFeedback({ type: 'err', text: 'Password baru minimal 4 karakter.' });
      return;
    }

    setBioSaving(true);
    try {
      const res = await updateStudentBiodata(session.token, {
        namaLengkap: bioForm.namaLengkap,
        jenisKelamin: bioForm.jenisKelamin,
        kelas: bioForm.kelas,
        jurusan: bioForm.jurusan,
        noHp: bioForm.noHp,
        namaOrangTua: bioForm.namaOrangTua,
        nomorOrangTua: bioForm.nomorOrangTua,
        alamat: bioForm.alamat,
        portalUsername: bioForm.portalUsername,
        newPassword: bioForm.newPassword || undefined,
      });
      onUpdatePortalData(res.portal, res.session);
      setBioForm((prev) => ({
        ...prev,
        portalUsername: res.session.username,
        newPassword: '',
        confirmPassword: '',
      }));
      setBioFeedback({
        type: 'ok',
        text: 'Biodata siswa dan pengaturan akun berhasil diperbarui.',
      });
    } catch (err) {
      setBioFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memperbarui biodata.',
      });
    } finally {
      setBioSaving(false);
    }
  };

  const TAB_TITLES: Record<StudentTab, string> = {
    ringkasan: 'Dashboard Siswa',
    penilaian: 'Penilaian Mandiri',
    biodata: 'Perbarui Biodata',
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      {/* Top Bar */}
      <header className="h-14 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg brand-bg text-white font-bold flex items-center justify-center text-sm shrink-0">
            H
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
            <span className="font-display font-bold text-slate-900 dark:text-white truncate">
              {schoolName || 'HUMANIS SMK'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="font-medium brand-text truncate">{TAB_TITLES[activeTab]}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 font-mono mr-1">
            @{session.username}
          </span>
          <button
            type="button"
            onClick={onToggleDark}
            aria-label="Ubah tema"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto space-y-6">
        {activeTab === 'ringkasan' && (
          <>
            {/* Student Welcome Summary Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold brand-text">Portal Siswa</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">NISN {student.nisn}</span>
                  <span aria-hidden="true">·</span>
                  <span>{student.kelas}</span>
                  <span aria-hidden="true">·</span>
                  <span>{student.jurusan}</span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white [text-wrap:balance]">
                  Halo, {student.namaLengkap}
                </h1>
                <p className={`text-xs font-medium flex items-center gap-1.5 ${conditionInfo.colorClass}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Status Kemandirian Saat Ini: {conditionInfo.label}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('penilaian')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl brand-bg hover:opacity-95 text-white text-xs font-medium transition-opacity cursor-pointer whitespace-nowrap"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Isi Penilaian Mandiri</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('biodata')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  <UserCog className="w-4 h-4" />
                  <span>Perbarui Biodata</span>
                </button>
              </div>
            </div>

            {/* 4-Column KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-5 space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">Skor Kemandirian</p>
                <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {student.latestScore ?? latestDiagnostic?.totalScore ?? 0}
                  <span className="text-sm font-normal text-slate-400">/100</span>
                </p>
                <p className="text-xs font-medium brand-text">
                  {student.latestCategory || latestDiagnostic?.category || 'Belum dinilai'}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-5 space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Tahap HUMANIS</p>
                <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {completedStages.length}
                  <span className="text-sm font-normal text-slate-400">/7 Tahap</span>
                </p>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full brand-bg rounded-full" style={{ width: `${humanisPct}%` }} />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-5 space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">Observasi &amp; Pembinaan</p>
                <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {observations.length + processes.length}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {observations.length} observasi · {processes.length} pembinaan
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-5 space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">Pernyataan Baik</p>
                <p className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {goodStatements.length}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Afirmasi positif tercatat
                </p>
              </div>
            </div>

            {/* Radar & HUMANIS Progress Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    Profil 5 Aspek Kemandirian
                  </h2>
                  {latestDiagnostic && (
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {latestDiagnostic.assessedDate}
                    </span>
                  )}
                </div>

                {radarData.length > 0 ? (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke={darkMode ? '#334155' : '#e2e8f0'} />
                        <PolarAngleAxis
                          dataKey="aspect"
                          tick={{ fill: darkMode ? '#cbd5e1' : '#475569', fontSize: 11 }}
                        />
                        <PolarRadiusAxis
                          domain={[0, 5]}
                          tick={{ fill: darkMode ? '#94a3b8' : '#64748b', fontSize: 10 }}
                        />
                        <Radar
                          name="Skor"
                          dataKey="nilai"
                          stroke="#2563EB"
                          fill="#2563EB"
                          fillOpacity={0.25}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-3">
                    <ClipboardCheck className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Belum ada hasil asesmen kemandirian. Isi penilaian mandiri pertama Anda.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('penilaian')}
                      className="px-4 py-2 rounded-lg brand-bg text-white text-xs font-medium cursor-pointer"
                    >
                      Mulai Penilaian
                    </button>
                  </div>
                )}
              </div>

              <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 brand-text" />
                    <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                      Progres 7 Tahapan HUMANIS
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-semibold brand-text tabular-nums">
                    {humanisPct}%
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {HUMANIS_STAGES.map((stage) => {
                    const done = completedStages.includes(stage.key);
                    return (
                      <div
                        key={stage.key}
                        className="py-2.5 flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                              done
                                ? 'brand-bg text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {stage.key}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {stage.name}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-medium whitespace-nowrap ${
                            done
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {done ? 'Terlaksana' : 'Proses'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Observation Trend & Recent Notes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 brand-text" />
                  <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    Tren Perkembangan Observasi
                  </h2>
                </div>

                {obsTrendData.length > 0 ? (
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={obsTrendData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={darkMode ? '#1e293b' : '#f1f5f9'}
                        />
                        <XAxis
                          dataKey="tanggal"
                          tick={{ fill: darkMode ? '#94a3b8' : '#64748b', fontSize: 11 }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: darkMode ? '#94a3b8' : '#64748b', fontSize: 11 }}
                        />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="skor"
                          stroke="#2563EB"
                          fill="#2563EB"
                          fillOpacity={0.18}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
                    Belum ada riwayat observasi berkala dari Wali Kelas atau Guru BK.
                  </p>
                )}
              </div>

              <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 brand-text" />
                  <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    Catatan Pembinaan &amp; Pernyataan Baik
                  </h2>
                </div>

                <div className="space-y-4">
                  {processes.slice(0, 2).map((p) => (
                    <div
                      key={p.id}
                      className="pb-3 border-b border-slate-100 dark:border-slate-800 space-y-1"
                    >
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span className="font-mono">{p.tanggal}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium brand-text">Tahap {p.tahapHumanis}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {p.tindakan}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Hasil: {p.hasilSementara}
                      </p>
                    </div>
                  ))}

                  {goodStatements.slice(0, 2).map((g) => (
                    <div
                      key={g.id}
                      className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <MessageSquareHeart className="w-4 h-4 brand-text shrink-0 mt-0.5" />
                      <div>
                        <p className="italic">"{g.kalimat}"</p>
                        <span className="text-xs font-mono text-slate-400">{g.tanggal}</span>
                      </div>
                    </div>
                  ))}

                  {processes.length === 0 && goodStatements.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                      Belum ada log pembinaan maupun afirmasi positif yang tercatat.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'penilaian' && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                Penilaian Kemandirian Mandiri Siswa
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Lakukan refleksi jujur skala 1–5 untuk memantau perkembangan kemandirian belajar dan kerja Anda.
              </p>
            </div>

            {assessFeedback && (
              <div
                className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-sm ${
                  assessFeedback.type === 'ok'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {assessFeedback.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{assessFeedback.text}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmitAssessment}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-5">
                {LIKERT_ASPECTS.map((aspect) => {
                  const currentVal = scores[aspect.key];
                  return (
                    <div
                      key={aspect.key}
                      className="pb-4 border-b border-slate-100 dark:border-slate-800 last:border-b-0 last:pb-0 space-y-2.5"
                    >
                      <div>
                        <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                          {aspect.label}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{aspect.prompt}</p>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {LIKERT_LABELS.map((item) => (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() =>
                              setScores((prev) => ({ ...prev, [aspect.key]: item.val }))
                            }
                            className={`min-h-[44px] px-2 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                              currentVal === item.val
                                ? 'brand-bg border-transparent text-white font-semibold'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {item.val}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Catatan Refleksi Diri (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={reflectNotes}
                      onChange={(e) => setReflectNotes(e.target.value)}
                      placeholder="Apa tantangan atau kemajuan utama yang Anda rasakan minggu ini?"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Pernyataan Baik / Komitmen Hari Ini (Opsional)
                    </label>
                    <input
                      type="text"
                      value={positiveStatement}
                      onChange={(e) => setPositiveStatement(e.target.value)}
                      placeholder="Contoh: Saya berkomitmen menyelesaikan tugas praktik tanpa menunda."
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-5">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white text-center">
                  Pratinjau Skor Penilaian
                </h2>

                <div className="flex flex-col items-center justify-center py-2">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 110 110">
                      <circle
                        cx="55"
                        cy="55"
                        r={circleRadius}
                        strokeWidth="10"
                        className="fill-none stroke-slate-100 dark:stroke-slate-800"
                      />
                      <circle
                        cx="55"
                        cy="55"
                        r={circleRadius}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="fill-none stroke-blue-600 transition-all duration-300"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                        {previewScore}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">dari 100</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold brand-text">{previewCategory}</p>
                </div>

                <button
                  type="submit"
                  disabled={assessSaving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium transition-opacity cursor-pointer"
                >
                  {assessSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{assessSaving ? 'Menyimpan...' : 'Simpan Penilaian Mandiri'}</span>
                </button>
              </div>
            </form>

            {/* Assessment History Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Riwayat Penilaian &amp; Diagnostik ({diagnostics.length})
                </h2>
              </div>
              {diagnostics.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Belum ada riwayat penilaian tersimpan.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4 font-medium">Tanggal</th>
                        <th className="py-3 px-4 font-medium text-right">TJ</th>
                        <th className="py-3 px-4 font-medium text-right">DS</th>
                        <th className="py-3 px-4 font-medium text-right">IN</th>
                        <th className="py-3 px-4 font-medium text-right">PK</th>
                        <th className="py-3 px-4 font-medium text-right">MD</th>
                        <th className="py-3 px-4 font-medium text-right">Skor</th>
                        <th className="py-3 px-4 font-medium">Kategori &amp; Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {diagnostics.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {d.assessedDate}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{d.tanggungJawab}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{d.disiplin}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{d.inisiatif}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {d.pengambilanKeputusan}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{d.manajemenDiri}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold brand-text tabular-nums">
                            {d.totalScore}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-900 dark:text-white">{d.category}</p>
                            {d.notes && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                {d.notes}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'biodata' && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                Perbarui Biodata &amp; Akun Siswa
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Pastikan nomor kontak aktif, data orang tua, domisili, dan kredensial akun Anda selalu mutakhir.
              </p>
            </div>

            {bioFeedback && (
              <div
                className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-sm ${
                  bioFeedback.type === 'ok'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {bioFeedback.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{bioFeedback.text}</span>
              </div>
            )}

            <form
              onSubmit={handleSaveBiodata}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    NISN (Nomor Induk Siswa Nasional)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={student.nisn}
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={bioForm.namaLengkap}
                    onChange={(e) => setBioForm({ ...bioForm, namaLengkap: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Jenis Kelamin
                  </label>
                  <select
                    value={bioForm.jenisKelamin}
                    onChange={(e) =>
                      setBioForm({ ...bioForm, jenisKelamin: e.target.value as 'L' | 'P' })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Kelas
                  </label>
                  <input
                    type="text"
                    value={bioForm.kelas}
                    onChange={(e) => setBioForm({ ...bioForm, kelas: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Jurusan / Kompetensi Keahlian
                  </label>
                  <input
                    type="text"
                    value={bioForm.jurusan}
                    onChange={(e) => setBioForm({ ...bioForm, jurusan: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    No HP Siswa
                  </label>
                  <input
                    type="text"
                    value={bioForm.noHp}
                    onChange={(e) => setBioForm({ ...bioForm, noHp: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nama Orang Tua / Wali
                  </label>
                  <input
                    type="text"
                    value={bioForm.namaOrangTua}
                    onChange={(e) => setBioForm({ ...bioForm, namaOrangTua: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nomor HP Orang Tua / Wali
                  </label>
                  <input
                    type="text"
                    value={bioForm.nomorOrangTua}
                    onChange={(e) => setBioForm({ ...bioForm, nomorOrangTua: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Alamat Domisili
                  </label>
                  <input
                    type="text"
                    value={bioForm.alamat}
                    onChange={(e) => setBioForm({ ...bioForm, alamat: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Account Credentials Section */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Kredensial Login Portal Siswa
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Username Login
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={bioForm.portalUsername}
                        onChange={(e) =>
                          setBioForm({ ...bioForm, portalUsername: e.target.value })
                        }
                        className="w-full pl-9 pr-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Password Baru (Opsional)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={bioForm.newPassword}
                        onChange={(e) => setBioForm({ ...bioForm, newPassword: e.target.value })}
                        placeholder="Kosongkan jika tetap"
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Konfirmasi Password Baru
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={bioForm.confirmPassword}
                        onChange={(e) =>
                          setBioForm({ ...bioForm, confirmPassword: e.target.value })
                        }
                        placeholder="Ulangi password baru"
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={bioSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium transition-opacity cursor-pointer"
                >
                  {bioSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{bioSaving ? 'Menyimpan...' : 'Simpan Perubahan Biodata'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Static Bottom Navigation Bar for Student */}
      <nav
        aria-label="Navigasi Portal Siswa"
        className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800"
      >
        <div className="max-w-xl mx-auto h-full grid grid-cols-3 items-center px-2">
          {(
            [
              { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
              { id: 'penilaian', label: 'Penilaian', icon: ClipboardCheck },
              { id: 'biodata', label: 'Biodata', icon: UserCog },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active
                    ? 'brand-text font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className={`px-3 py-1 rounded-full transition-colors ${active ? 'brand-soft-bg' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] leading-none whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
