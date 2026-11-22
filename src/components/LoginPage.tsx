import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import {
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  HelpCircle,
  ArrowRight,
  Sun,
  Moon,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  GraduationCap,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import type { StaffRole, StaffSession, StudentPortalData, StudentSession } from '../types/humanis';
import { loginStaffCredentials } from '../lib/staffPortalService';
import { loginStudentAccount, registerStudentAccount } from '../lib/studentPortalService';

interface LoginPageProps {
  darkMode: boolean;
  onToggleDark: () => void;
  onSavePendingMeta: (meta: { nip: string; role: StaffRole }) => void;
  onStaffLoginSuccess: (session: StaffSession) => void;
  onStudentLoginSuccess: (session: StudentSession, portal: StudentPortalData) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  darkMode,
  onToggleDark,
  onSavePendingMeta,
  onStaffLoginSuccess,
  onStudentLoginSuccess,
}) => {
  const [loginMode, setLoginMode] = useState<'staff' | 'student'>('staff');

  // Staff Login State
  const [nip, setNip] = useState(() => localStorage.getItem('humanis_saved_nip') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('humanis_remember') === 'true');
  const [selectedRole, setSelectedRole] = useState<StaffRole>('wali_kelas');
  const [showPass, setShowPass] = useState(false);

  // Student Login / Registration State
  const [studentMode, setStudentMode] = useState<'login' | 'register'>('login');
  const [stuUsername, setStuUsername] = useState(
    () => localStorage.getItem('humanis_saved_stu_user') || ''
  );
  const [stuPassword, setStuPassword] = useState('');
  const [rememberStu, setRememberStu] = useState(
    () => localStorage.getItem('humanis_remember_stu') === 'true'
  );
  const [regForm, setRegForm] = useState({
    nisn: '',
    namaLengkap: '',
    jenisKelamin: 'L' as 'L' | 'P',
    kelas: 'X TKJ 1',
    jurusan: 'Teknik Komputer & Jaringan',
    username: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [emblemFailed, setEmblemFailed] = useState(false);

  const persistLoginPreferences = () => {
    if (rememberMe && nip.trim()) {
      localStorage.setItem('humanis_saved_nip', nip.trim());
      localStorage.setItem('humanis_remember', 'true');
    } else {
      localStorage.removeItem('humanis_saved_nip');
      localStorage.setItem('humanis_remember', 'false');
    }
    onSavePendingMeta({ nip: nip.trim(), role: selectedRole });
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    persistLoginPreferences();
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      setErrorMsg(
        msg.includes('popup-closed-by-user')
          ? 'Jendela login Google ditutup sebelum selesai. Silakan coba lagi.'
          : `Login Google gagal: ${msg}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!nip.trim() || !password) {
      setErrorMsg('Masukkan Username / NIP dan password akun terlebih dahulu.');
      return;
    }
    setLoading(true);
    persistLoginPreferences();
    try {
      const session = await loginStaffCredentials(nip.trim(), password);
      onStaffLoginSuccess(session);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal masuk. Periksa kembali Username / NIP dan password Anda.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!stuUsername.trim() || !stuPassword) {
      setErrorMsg('Masukkan Username dan Password siswa terlebih dahulu.');
      return;
    }
    if (rememberStu) {
      localStorage.setItem('humanis_saved_stu_user', stuUsername.trim());
      localStorage.setItem('humanis_remember_stu', 'true');
    } else {
      localStorage.removeItem('humanis_saved_stu_user');
      localStorage.setItem('humanis_remember_stu', 'false');
    }

    setLoading(true);
    try {
      const { session, portal } = await loginStudentAccount(stuUsername.trim(), stuPassword);
      onStudentLoginSuccess(session, portal);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal masuk sebagai siswa.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const { session, portal } = await registerStudentAccount(regForm);
      onStudentLoginSuccess(session, portal);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mendaftarkan akun siswa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Left Hero Panel */}
      <div className="relative lg:w-[50%] min-h-[260px] lg:min-h-screen overflow-hidden bg-slate-900 flex flex-col justify-between">
        {!heroImgFailed ? (
          <img
            src="/src/assets/images/smk_mentoring_hero_1794880388902.jpg"
            alt="Suasana pembinaan kemandirian siswa SMK"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-950/30" />

        <div className="relative z-10 p-6 lg:p-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!emblemFailed ? (
              <img
                src="/src/assets/images/humanis_emblem_1794880387572.jpg"
                alt="Logo Program HUMANIS SMK"
                referrerPolicy="no-referrer"
                onError={() => setEmblemFailed(true)}
                className="w-10 h-10 rounded-lg object-cover bg-white"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg brand-bg flex items-center justify-center text-white font-bold">
                H
              </div>
            )}
            <span className="font-display font-bold text-lg text-white tracking-tight">
              HUMANIS SMK
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleDark}
            aria-label="Ubah tema warna"
            className="lg:hidden p-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="relative z-10 p-6 lg:p-12 max-w-xl space-y-4">
          <p className="text-xs font-medium tracking-wider text-blue-300">
            Program Pembinaan Karakter &amp; Kemandirian Vokasi
          </p>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight [text-wrap:balance]">
            Implementasi Tahap HUMANIS untuk Meningkatkan Kemandirian Siswa SMK
          </h1>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
            Portal terintegrasi untuk Guru, Operator Sekolah, dan Siswa dalam memantau progres
            kemandirian, penilaian diri, serta pembaruan biodata.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
            <span>Humanisasi Potensi</span>
            <span aria-hidden="true">·</span>
            <span>Urgensi &amp; Modeling</span>
            <span aria-hidden="true">·</span>
            <span>Apresiasi &amp; Pembiasaan</span>
            <span aria-hidden="true">·</span>
            <span>Internalisasi &amp; Sinergi</span>
          </div>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-slate-50 dark:bg-slate-950">
        <div className="hidden lg:flex justify-end">
          <button
            type="button"
            onClick={onToggleDark}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{darkMode ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>
        </div>

        <div className="w-full max-w-md mx-auto my-auto py-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
            {/* Primary Mode Switch: Guru/Operator vs Siswa */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('staff');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  loginMode === 'staff'
                    ? 'bg-white dark:bg-slate-900 brand-text shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Guru &amp; Operator</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('student');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  loginMode === 'student'
                    ? 'bg-white dark:bg-slate-900 brand-text shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Login Siswa</span>
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {loginMode === 'staff' ? (
              <>
                <div className="space-y-1">
                  <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    Masuk Portal Sekolah
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Gunakan akun Admin / Operator atau akun Staf yang terdaftar untuk mengelola sistem.
                  </p>
                </div>

                <form onSubmit={handleCredentialSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="nip-input"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Username / NIP / Email Staf
                    </label>
                    <div className="relative">
                      <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="nip-input"
                        type="text"
                        autoComplete="username"
                        value={nip}
                        onChange={(e) => setNip(e.target.value)}
                        placeholder="Contoh: admin atau NIP guru"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="password-input"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="password-input"
                        type={showPass ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan password akun"
                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        aria-label="Tampilkan atau sembunyikan password"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span>Ingat Username</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotSent(false);
                        setShowForgotModal(true);
                      }}
                      className="inline-flex items-center gap-1 brand-text hover:underline font-medium cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Lupa Password?</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium transition-opacity cursor-pointer"
                  >
                    <span>{loading ? 'Memverifikasi...' : 'Masuk sebagai Admin / Staf'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="relative flex items-center py-0.5">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                  <span className="shrink mx-3 text-xs text-slate-400 dark:text-slate-500">
                    atau gunakan Akun Google Sekolah
                  </span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                </div>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {(
                      [
                        { id: 'wali_kelas', label: 'Wali Kelas' },
                        { id: 'guru_bk', label: 'Guru BK' },
                        { id: 'kepala_sekolah', label: 'Kepsek' },
                        { id: 'admin', label: 'Operator' },
                      ] as const
                    ).map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRole(role.id)}
                        className={`px-2 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          selectedRole === role.id
                            ? 'bg-white dark:bg-slate-900 brand-text shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                  {selectedRole === 'admin' && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Login Google Operator memverifikasi email admin terdaftar di sekolah.
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 text-slate-800 dark:text-slate-100 font-medium text-sm transition-colors cursor-pointer"
                  >
                    <svg className="w-5 h-5 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.2 8.9 5 12 5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.3 14.7c-.2-.8-.4-1.7-.4-2.7s.1-1.9.4-2.7L1.6 6.4C.6 8.1 0 10 0 12s.6 3.9 1.6 5.6l3.7-2.9z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.9C3.5 20.4 7.4 23 12 23z"
                      />
                    </svg>
                    <span>Login dengan Google</span>
                  </button>
                </div>
              </>
            ) : studentMode === 'login' ? (
              <>
                <div className="space-y-1">
                  <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    Portal Login Siswa
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Masuk dengan Username dan Password untuk melihat ringkasan progres, mengisi
                    penilaian mandiri, dan memperbarui biodata.
                  </p>
                </div>

                <form onSubmit={handleStudentLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="stu-username"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Username Siswa (atau NISN)
                    </label>
                    <div className="relative">
                      <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="stu-username"
                        type="text"
                        required
                        value={stuUsername}
                        onChange={(e) => setStuUsername(e.target.value)}
                        placeholder="Contoh: 0084129001"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="stu-password"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="stu-password"
                        type={showPass ? 'text' : 'password'}
                        required
                        value={stuPassword}
                        onChange={(e) => setStuPassword(e.target.value)}
                        placeholder="Masukkan password siswa"
                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        aria-label="Tampilkan atau sembunyikan password"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={rememberStu}
                        onChange={(e) => setRememberStu(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span>Ingat Username</span>
                    </label>
                    <span className="text-slate-400 dark:text-slate-500">
                      Default: NISN / smk12345
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium transition-opacity cursor-pointer"
                  >
                    <span>{loading ? 'Memverifikasi...' : 'Masuk sebagai Siswa'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentMode('register');
                      setErrorMsg(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium brand-text hover:underline cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Belum punya akun siswa? Aktivasi / Daftar Akun</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Aktivasi Akun Siswa Baru
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Lengkapi biodata singkat dan buat username serta password untuk mengakses portal siswa.
                  </p>
                </div>

                <form onSubmit={handleStudentRegister} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        NISN *
                      </label>
                      <input
                        type="text"
                        required
                        value={regForm.nisn}
                        onChange={(e) => setRegForm({ ...regForm, nisn: e.target.value })}
                        placeholder="0084129099"
                        className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Jenis Kelamin
                      </label>
                      <select
                        value={regForm.jenisKelamin}
                        onChange={(e) =>
                          setRegForm({ ...regForm, jenisKelamin: e.target.value as 'L' | 'P' })
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      >
                        <option value="L">Laki-laki (L)</option>
                        <option value="P">Perempuan (P)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      required
                      value={regForm.namaLengkap}
                      onChange={(e) => setRegForm({ ...regForm, namaLengkap: e.target.value })}
                      placeholder="Nama lengkap sesuai absen"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Kelas *
                      </label>
                      <input
                        type="text"
                        required
                        value={regForm.kelas}
                        onChange={(e) => setRegForm({ ...regForm, kelas: e.target.value })}
                        placeholder="X TKJ 1"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Jurusan *
                      </label>
                      <input
                        type="text"
                        required
                        value={regForm.jurusan}
                        onChange={(e) => setRegForm({ ...regForm, jurusan: e.target.value })}
                        placeholder="TKJ / RPL / TKR"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Username *
                      </label>
                      <input
                        type="text"
                        required
                        value={regForm.username}
                        onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                        placeholder="fajar.tkj"
                        className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={regForm.password}
                        onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                        placeholder="Min. 4 karakter"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium transition-opacity cursor-pointer"
                  >
                    <span>{loading ? 'Mendaftarkan...' : 'Buat Akun & Masuk'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentMode('login');
                      setErrorMsg(null);
                    }}
                    className="text-xs font-medium brand-text hover:underline cursor-pointer"
                  >
                    Sudah punya akun? Kembali ke Login Siswa
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="text-center text-xs text-slate-500 dark:text-slate-500">
          HUMANIS SMK · Platform Pembinaan Kemandirian Berbasis Data
        </footer>
      </div>

      {/* Lupa Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Pemulihan Akses Akun
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {forgotSent ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 text-sm text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  Permintaan pemulihan dicatat. Untuk akses tercepat dan terverifikasi, gunakan
                  tombol <strong>Login dengan Google</strong> menggunakan email sekolah Anda.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Masukkan NIP/NUPTK atau email sekolah Anda untuk verifikasi pemulihan akses dengan
                  admin operator sekolah.
                </p>
                <input
                  type="text"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Email dinas atau NIP/NUPTK"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotSent(true)}
                    className="px-4 py-2 text-sm rounded-lg brand-bg text-white font-medium"
                  >
                    Kirim Permintaan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
