import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  Trash2,
  Loader2,
  Power,
  AlertCircle,
  KeyRound,
  RefreshCw,
  Search,
  Users,
  GraduationCap,
  Settings2,
  X,
} from 'lucide-react';
import type {
  RoleAssignment,
  StaffAccountSummary,
  StaffRole,
  StudentAccountSummary,
  UserProfile,
} from '../types/humanis';
import {
  createRoleAssignment,
  deleteRoleAssignment,
  updateRoleAssignment,
  updateUserProfile,
} from '../lib/firestoreService';
import {
  createRegisteredStaffAccount,
  createRegisteredStudentAccount,
  deleteRegisteredStaffAccount,
  deleteRegisteredStudentAccount,
  fetchRegisteredAccounts,
  updateRegisteredStaffAccount,
  updateRegisteredStudentAccount,
} from '../lib/staffPortalService';

interface RoleManagementViewProps {
  ownerId: string;
  currentRole: StaffRole;
  isAdminEmail: boolean;
  roleAssignments: RoleAssignment[];
  userProfiles: UserProfile[];
  onSwitchPreviewRole: (role: StaffRole) => Promise<void>;
}

const ALL_PERMISSIONS = [
  { id: 'kelola_siswa', label: 'Kelola Data Siswa' },
  { id: 'tes_diagnostik', label: 'Tes Diagnostik Awal' },
  { id: 'tahap_humanis', label: 'Isi Tahapan HUMANIS' },
  { id: 'observasi_pembinaan', label: 'Observasi & Pembinaan' },
  { id: 'ai_advisor', label: 'Analisis AI Gemini' },
  { id: 'cetak_laporan', label: 'Ekspor & Cetak Laporan' },
  { id: 'kelola_peran_tema', label: 'Manajemen Peran & Tema' },
];

const DEFAULT_PERMS_BY_ROLE: Record<StaffRole, string[]> = {
  admin: ALL_PERMISSIONS.map((p) => p.id),
  wali_kelas: [
    'kelola_siswa',
    'tes_diagnostik',
    'tahap_humanis',
    'observasi_pembinaan',
    'ai_advisor',
    'cetak_laporan',
  ],
  guru_bk: ['tes_diagnostik', 'tahap_humanis', 'observasi_pembinaan', 'ai_advisor', 'cetak_laporan'],
  kepala_sekolah: ['cetak_laporan'],
};

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin / Operator',
  wali_kelas: 'Wali Kelas',
  guru_bk: 'Guru BK',
  kepala_sekolah: 'Kepala Sekolah',
};

type AccountTab = 'staff_accounts' | 'student_accounts' | 'google_roles';

export const RoleManagementView: React.FC<RoleManagementViewProps> = ({
  ownerId,
  currentRole,
  isAdminEmail,
  roleAssignments,
  userProfiles,
  onSwitchPreviewRole,
}) => {
  const canManage = currentRole === 'admin' || isAdminEmail;
  const [activeTab, setActiveTab] = useState<AccountTab>('staff_accounts');

  // Registered accounts fetched from server (Admin only)
  const [staffAccounts, setStaffAccounts] = useState<StaffAccountSummary[]>([]);
  const [studentAccounts, setStudentAccounts] = useState<StudentAccountSummary[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Add Staff Account form
  const [staffForm, setStaffForm] = useState({
    username: '',
    password: '',
    nama: '',
    nip: '',
    email: '',
    role: 'wali_kelas' as StaffRole,
    kelasBinaan: 'X TKJ 1',
    permissions: DEFAULT_PERMS_BY_ROLE.wali_kelas,
  });

  // Add Student Account form
  const [studentForm, setStudentForm] = useState({
    nisn: '',
    namaLengkap: '',
    jenisKelamin: 'L' as 'L' | 'P',
    kelas: 'X TKJ 1',
    jurusan: 'Teknik Komputer & Jaringan',
    username: '',
    password: '',
  });
  const [studentSearch, setStudentSearch] = useState('');

  // Reset Password / Edit Credentials modal state
  const [resetTarget, setResetTarget] = useState<
    | { kind: 'staff'; item: StaffAccountSummary }
    | { kind: 'student'; item: StudentAccountSummary }
    | null
  >(null);
  const [editUsername, setEditUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Google Role Assignments form (legacy / Google Workspace)
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('wali_kelas');
  const [kelasBinaan, setKelasBinaan] = useState('X TKJ 1');
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_PERMS_BY_ROLE.wali_kelas);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!canManage) return;
    setLoadingAccounts(true);
    try {
      const data = await fetchRegisteredAccounts();
      setStaffAccounts(data.staffAccounts);
      setStudentAccounts(data.studentAccounts);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar akun terdaftar.',
      });
    } finally {
      setLoadingAccounts(false);
    }
  }, [canManage]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const filteredStudentAccounts = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return studentAccounts;
    return studentAccounts.filter(
      (s) =>
        s.namaLengkap.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q)
    );
  }, [studentAccounts, studentSearch]);

  // --- Staff Account CRUD Handlers ---

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const created = await createRegisteredStaffAccount({
        username: staffForm.username,
        password: staffForm.password,
        nama: staffForm.nama,
        nip: staffForm.nip,
        email: staffForm.email,
        role: staffForm.role,
        kelasBinaan: staffForm.kelasBinaan,
        aktif: true,
        permissions: staffForm.permissions,
      });
      setStaffAccounts((prev) => [...prev, created]);
      setStaffForm({
        username: '',
        password: '',
        nama: '',
        nip: '',
        email: '',
        role: 'wali_kelas',
        kelasBinaan: 'X TKJ 1',
        permissions: DEFAULT_PERMS_BY_ROLE.wali_kelas,
      });
      setFeedback({
        type: 'ok',
        text: `Akun staf "${created.username}" (${created.nama}) berhasil didaftarkan.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mendaftarkan akun staf.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStaffRole = async (acc: StaffAccountSummary, nextRole: StaffRole) => {
    setFeedback(null);
    try {
      const updated = await updateRegisteredStaffAccount(acc.id, {
        role: nextRole,
        permissions: DEFAULT_PERMS_BY_ROLE[nextRole],
      });
      setStaffAccounts((prev) => prev.map((a) => (a.id === acc.id ? updated : a)));
      setFeedback({
        type: 'ok',
        text: `Peran akun "${acc.username}" diubah menjadi ${ROLE_LABELS[nextRole]}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengubah peran staf.',
      });
    }
  };

  const handleToggleStaffActive = async (acc: StaffAccountSummary) => {
    setFeedback(null);
    try {
      const updated = await updateRegisteredStaffAccount(acc.id, { aktif: !acc.aktif });
      setStaffAccounts((prev) => prev.map((a) => (a.id === acc.id ? updated : a)));
      setFeedback({
        type: 'ok',
        text: `Status akun "${acc.username}" kini ${updated.aktif ? 'Aktif' : 'Nonaktif'}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengubah status akun staf.',
      });
    }
  };

  const handleDeleteStaff = async (acc: StaffAccountSummary) => {
    setFeedback(null);
    try {
      await deleteRegisteredStaffAccount(acc.id);
      setStaffAccounts((prev) => prev.filter((a) => a.id !== acc.id));
      setFeedback({ type: 'ok', text: `Akun staf "${acc.username}" berhasil dihapus.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus akun staf.',
      });
    }
  };

  // --- Student Account CRUD Handlers ---

  const handleCreateStudentAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const created = await createRegisteredStudentAccount({
        ...studentForm,
        aktif: true,
      });
      setStudentAccounts((prev) => [...prev, created]);
      setStudentForm({
        nisn: '',
        namaLengkap: '',
        jenisKelamin: 'L',
        kelas: 'X TKJ 1',
        jurusan: 'Teknik Komputer & Jaringan',
        username: '',
        password: '',
      });
      setFeedback({
        type: 'ok',
        text: `Akun siswa "${created.username}" (${created.namaLengkap}) berhasil dibuat.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mendaftarkan akun siswa.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStudentActive = async (stu: StudentAccountSummary) => {
    setFeedback(null);
    try {
      const updated = await updateRegisteredStudentAccount(stu.studentId, { aktif: !stu.aktif });
      setStudentAccounts((prev) =>
        prev.map((s) => (s.studentId === stu.studentId ? updated : s))
      );
      setFeedback({
        type: 'ok',
        text: `Akun siswa "${stu.username}" kini ${updated.aktif ? 'Aktif' : 'Nonaktif'}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengubah status akun siswa.',
      });
    }
  };

  const handleDeleteStudentAcc = async (stu: StudentAccountSummary) => {
    setFeedback(null);
    try {
      await deleteRegisteredStudentAccount(stu.studentId);
      setStudentAccounts((prev) => prev.filter((s) => s.studentId !== stu.studentId));
      setFeedback({ type: 'ok', text: `Akun siswa "${stu.namaLengkap}" telah dihapus.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus akun siswa.',
      });
    }
  };

  const handleSubmitCredentialReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    setFeedback(null);
    try {
      if (resetTarget.kind === 'staff') {
        const updated = await updateRegisteredStaffAccount(resetTarget.item.id, {
          ...(editUsername.trim() && resetTarget.item.id !== 'staff_admin'
            ? { username: editUsername.trim() }
            : {}),
          ...(newPassword ? { newPassword } : {}),
        });
        setStaffAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setFeedback({
          type: 'ok',
          text: `Kredensial akun staf "${updated.username}" berhasil diperbarui.`,
        });
      } else {
        const updated = await updateRegisteredStudentAccount(resetTarget.item.studentId, {
          ...(editUsername.trim() ? { username: editUsername.trim() } : {}),
          ...(newPassword ? { newPassword } : {}),
        });
        setStudentAccounts((prev) =>
          prev.map((s) => (s.studentId === updated.studentId ? updated : s))
        );
        setFeedback({
          type: 'ok',
          text: `Kredensial akun siswa "${updated.username}" berhasil diperbarui.`,
        });
      }
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memperbarui kredensial akun.',
      });
    } finally {
      setSaving(false);
    }
  };

  // --- Legacy Google Role Assignment Handlers ---

  const handleRoleSelectChange = (nextRole: StaffRole) => {
    setRole(nextRole);
    setPermissions(DEFAULT_PERMS_BY_ROLE[nextRole]);
  };

  const togglePerm = (permId: string) => {
    setPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim() || !email.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await createRoleAssignment(ownerId, {
        nama: nama.trim(),
        nip: nip.trim(),
        email: email.trim(),
        role,
        kelasBinaan: kelasBinaan.trim(),
        aktif: true,
        permissions,
      });
      setNama('');
      setNip('');
      setEmail('');
      setFeedback({ type: 'ok', text: `Penugasan peran untuk ${nama.trim()} berhasil disimpan.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan penugasan peran.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeAssignmentRole = async (item: RoleAssignment, nextRole: StaffRole) => {
    await updateRoleAssignment(item.id, {
      role: nextRole,
      permissions: DEFAULT_PERMS_BY_ROLE[nextRole],
    });
  };

  const handleToggleActive = async (item: RoleAssignment) => {
    await updateRoleAssignment(item.id, { aktif: !item.aktif });
  };

  const handleUserProfileRoleChange = async (prof: UserProfile, nextRole: StaffRole) => {
    try {
      await updateUserProfile(prof.uid, { staffRole: nextRole });
      setFeedback({
        type: 'ok',
        text: `Peran akun ${prof.displayName} diperbarui menjadi ${ROLE_LABELS[nextRole]}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memperbarui peran akun.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Preview Role Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Manajemen Akun &amp; Peran
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Kelola seluruh akun terdaftar (Admin, Guru/Staf, dan Siswa), reset password, serta hak
            akses peran.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
          {(['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'] as StaffRole[])
            .filter((r) => r !== 'admin' || isAdminEmail || currentRole === 'admin')
            .map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onSwitchPreviewRole(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentRole === r
                    ? 'bg-white dark:bg-slate-900 brand-text shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
        </div>
      </div>

      {!canManage && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Anda sedang melihat mode <strong>{ROLE_LABELS[currentRole]}</strong>. Pengelolaan
            akun terdaftar hanya dapat dilakukan melalui akun <strong>Admin / Operator</strong>.
          </span>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center justify-between gap-2.5 p-3.5 rounded-xl border text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('staff_accounts')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'staff_accounts'
                ? 'brand-bg text-white border-transparent'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="tabular-nums">Akun Staf &amp; Guru ({staffAccounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('student_accounts')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'student_accounts'
                ? 'brand-bg text-white border-transparent'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span className="tabular-nums">Akun Siswa ({studentAccounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('google_roles')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'google_roles'
                ? 'brand-bg text-white border-transparent'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span className="tabular-nums">
              Penugasan &amp; Akun Google ({roleAssignments.length + userProfiles.length})
            </span>
          </button>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={loadAccounts}
            disabled={loadingAccounts}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAccounts ? 'animate-spin' : ''}`} />
            <span>Muat Ulang Akun</span>
          </button>
        )}
      </div>

      {/* TAB 1: AKUN STAF & GURU TERDAFTAR */}
      {activeTab === 'staff_accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {canManage && (
            <form
              onSubmit={handleCreateStaff}
              className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 brand-text" />
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Daftarkan Akun Staf Baru
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Username Login *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffForm.username}
                    onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                    placeholder="wali.xtkj1"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Password Awal *
                  </label>
                  <input
                    type="password"
                    required
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    placeholder="Min. 4 karakter"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nama Lengkap &amp; Gelar *
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.nama}
                  onChange={(e) => setStaffForm({ ...staffForm, nama: e.target.value })}
                  placeholder="Contoh: Drs. Ahmad Suryadi, M.Pd"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    NIP / NUPTK
                  </label>
                  <input
                    type="text"
                    value={staffForm.nip}
                    onChange={(e) => setStaffForm({ ...staffForm, nip: e.target.value })}
                    placeholder="19850101..."
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Kelas Binaan
                  </label>
                  <input
                    type="text"
                    value={staffForm.kelasBinaan}
                    onChange={(e) => setStaffForm({ ...staffForm, kelasBinaan: e.target.value })}
                    placeholder="X TKJ 1 / Semua"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Email Sekolah (Opsional)
                  </label>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="guru@smkn1sidayu.sch.id"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Peran *
                  </label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as StaffRole;
                      setStaffForm({
                        ...staffForm,
                        role: nextRole,
                        permissions: DEFAULT_PERMS_BY_ROLE[nextRole],
                      });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="wali_kelas">Wali Kelas</option>
                    <option value="guru_bk">Guru BK</option>
                    <option value="kepala_sekolah">Kepala Sekolah</option>
                    <option value="admin">Admin / Operator</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium transition-opacity cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>{saving ? 'Mendaftarkan...' : 'Buat Akun Staf'}</span>
              </button>
            </form>
          )}

          <div
            className={`${
              canManage ? 'lg:col-span-7' : 'lg:col-span-12'
            } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4`}
          >
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Daftar Akun Staf Terdaftar ({staffAccounts.length})
            </h2>

            {loadingAccounts && staffAccounts.length === 0 ? (
              <div className="py-8 flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memuat akun staf...</span>
              </div>
            ) : staffAccounts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                Belum ada akun staf yang dimuat.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-3 font-medium">Pengguna &amp; Username</th>
                      <th className="py-2.5 px-3 font-medium">Peran</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      {canManage && <th className="py-2.5 pl-3 font-medium text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {staffAccounts.map((acc) => {
                      const isPrimaryAdmin = acc.id === 'staff_admin';
                      return (
                        <tr key={acc.id}>
                          <td className="py-3 pr-3">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {acc.nama}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              @{acc.username}
                              {acc.nip ? ` · NIP ${acc.nip}` : ''}
                            </div>
                            {acc.kelasBinaan && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Binaan: {acc.kelasBinaan}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {canManage && !isPrimaryAdmin ? (
                              <select
                                value={acc.role}
                                onChange={(e) =>
                                  handleChangeStaffRole(acc, e.target.value as StaffRole)
                                }
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                              >
                                <option value="admin">Admin / Operator</option>
                                <option value="wali_kelas">Wali Kelas</option>
                                <option value="guru_bk">Guru BK</option>
                                <option value="kepala_sekolah">Kepala Sekolah</option>
                              </select>
                            ) : (
                              <span className="text-xs font-medium brand-text">
                                {ROLE_LABELS[acc.role]}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs font-medium whitespace-nowrap">
                            {acc.aktif ? (
                              <span className="text-emerald-600 dark:text-emerald-400">Aktif</span>
                            ) : (
                              <span className="text-slate-400">Nonaktif</span>
                            )}
                          </td>
                          {canManage && (
                            <td className="py-3 pl-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  title="Reset Password / Ubah Username"
                                  onClick={() => {
                                    setResetTarget({ kind: 'staff', item: acc });
                                    setEditUsername(acc.username);
                                    setNewPassword('');
                                  }}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>
                                {!isPrimaryAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStaffActive(acc)}
                                      title={acc.aktif ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                                      className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      <Power className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStaff(acc)}
                                      title="Hapus Akun Staf"
                                      className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AKUN SISWA TERDAFTAR */}
      {activeTab === 'student_accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {canManage && (
            <form
              onSubmit={handleCreateStudentAccount}
              className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 brand-text" />
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Buat Akun Siswa Baru
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    NISN *
                  </label>
                  <input
                    type="text"
                    required
                    value={studentForm.nisn}
                    onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                    placeholder="0084129001"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Jenis Kelamin
                  </label>
                  <select
                    value={studentForm.jenisKelamin}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        jenisKelamin: e.target.value as 'L' | 'P',
                      })
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
                  Nama Lengkap Siswa *
                </label>
                <input
                  type="text"
                  required
                  value={studentForm.namaLengkap}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, namaLengkap: e.target.value })
                  }
                  placeholder="Nama lengkap siswa"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
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
                    value={studentForm.kelas}
                    onChange={(e) => setStudentForm({ ...studentForm, kelas: e.target.value })}
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
                    value={studentForm.jurusan}
                    onChange={(e) => setStudentForm({ ...studentForm, jurusan: e.target.value })}
                    placeholder="Teknik Komputer & Jaringan"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Username Siswa *
                  </label>
                  <input
                    type="text"
                    required
                    value={studentForm.username}
                    onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                    placeholder="fajar.tkj"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Password Awal *
                  </label>
                  <input
                    type="password"
                    required
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                    placeholder="Min. 4 karakter"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium transition-opacity cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>{saving ? 'Menyimpan...' : 'Daftarkan Akun Siswa'}</span>
              </button>
            </form>
          )}

          <div
            className={`${
              canManage ? 'lg:col-span-7' : 'lg:col-span-12'
            } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Daftar Akun Siswa ({filteredStudentAccounts.length})
              </h2>
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Cari nama, NISN, kelas..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {filteredStudentAccounts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                Belum ada akun siswa terdaftar atau tidak ditemukan kecocokan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-3 font-medium">Siswa &amp; NISN</th>
                      <th className="py-2.5 px-3 font-medium">Username Login</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      {canManage && <th className="py-2.5 pl-3 font-medium text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStudentAccounts.map((stu) => (
                      <tr key={stu.studentId}>
                        <td className="py-3 pr-3">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {stu.namaLengkap}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            NISN {stu.nisn} · {stu.kelas}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                          @{stu.username}
                        </td>
                        <td className="py-3 px-3 text-xs font-medium whitespace-nowrap">
                          {stu.aktif ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Aktif</span>
                          ) : (
                            <span className="text-slate-400">Nonaktif</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-3 pl-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                title="Ubah Username / Reset Password"
                                onClick={() => {
                                  setResetTarget({ kind: 'student', item: stu });
                                  setEditUsername(stu.username);
                                  setNewPassword('');
                                }}
                                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStudentActive(stu)}
                                title={stu.aktif ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                                className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Power className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStudentAcc(stu)}
                                title="Hapus Akun Siswa"
                                className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PENUGASAN PERAN & AKUN GOOGLE */}
      {activeTab === 'google_roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {canManage && (
            <form
              onSubmit={handleCreateAssignment}
              className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 brand-text" />
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Tambah Penugasan Email Google
                </h2>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nama Lengkap Guru / Operator *
                </label>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Drs. Ahmad Suryadi"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    NIP / ID Operator
                  </label>
                  <input
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    placeholder="19850101..."
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Kelas Binaan
                  </label>
                  <input
                    type="text"
                    value={kelasBinaan}
                    onChange={(e) => setKelasBinaan(e.target.value)}
                    placeholder="X TKJ 1 / Semua"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Email Akun Google *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guru@smkn1sidayu.sch.id"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Peran *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleSelectChange(e.target.value as StaffRole)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="admin">Admin / Operator</option>
                    <option value="wali_kelas">Wali Kelas</option>
                    <option value="guru_bk">Guru BK</option>
                    <option value="kepala_sekolah">Kepala Sekolah</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Hak Akses Modul
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label
                      key={perm.id}
                      className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={permissions.includes(perm.id)}
                        onChange={() => togglePerm(perm.id)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium transition-opacity cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>{saving ? 'Menyimpan...' : 'Simpan Penugasan Peran'}</span>
              </button>
            </form>
          )}

          <div className={`${canManage ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Daftar Penugasan Peran ({roleAssignments.length})
              </h2>

              {roleAssignments.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                  Belum ada penugasan email Google tambahan.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 pr-3 font-medium">Nama &amp; Email</th>
                        <th className="py-2.5 px-3 font-medium">Peran</th>
                        <th className="py-2.5 px-3 font-medium">Status</th>
                        {canManage && <th className="py-2.5 pl-3 font-medium text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {roleAssignments.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 pr-3">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {item.nama}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {item.email} · {item.kelasBinaan || 'Umum'}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {canManage ? (
                              <select
                                value={item.role}
                                onChange={(e) =>
                                  handleChangeAssignmentRole(item, e.target.value as StaffRole)
                                }
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                              >
                                <option value="admin">Admin / Operator</option>
                                <option value="wali_kelas">Wali Kelas</option>
                                <option value="guru_bk">Guru BK</option>
                                <option value="kepala_sekolah">Kepala Sekolah</option>
                              </select>
                            ) : (
                              <span className="text-xs font-medium">{ROLE_LABELS[item.role]}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs font-medium">
                            {item.aktif ? (
                              <span className="text-emerald-600 dark:text-emerald-400">Aktif</span>
                            ) : (
                              <span className="text-slate-400">Nonaktif</span>
                            )}
                          </td>
                          {canManage && (
                            <td className="py-3 pl-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(item)}
                                  title={item.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Power className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRoleAssignment(item.id)}
                                  title="Hapus"
                                  className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {userProfiles.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Akun Google Terdaftar di Firebase ({userProfiles.length})
                </h2>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {userProfiles.map((prof) => (
                    <div
                      key={prof.uid}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {prof.displayName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {prof.email} {prof.nip ? `· NIP ${prof.nip}` : ''}
                        </p>
                      </div>
                      {isAdminEmail ? (
                        <select
                          value={prof.staffRole}
                          onChange={(e) =>
                            handleUserProfileRoleChange(prof, e.target.value as StaffRole)
                          }
                          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                        >
                          <option value="admin">Admin / Operator</option>
                          <option value="wali_kelas">Wali Kelas</option>
                          <option value="guru_bk">Guru BK</option>
                          <option value="kepala_sekolah">Kepala Sekolah</option>
                        </select>
                      ) : (
                        <span className="text-xs font-medium brand-text">
                          {ROLE_LABELS[prof.staffRole]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Ubah Username & Reset Password */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Kelola Kredensial{' '}
                {resetTarget.kind === 'staff'
                  ? resetTarget.item.nama
                  : resetTarget.item.namaLengkap}
              </h3>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCredentialReset} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Username Login
                </label>
                <input
                  type="text"
                  required
                  disabled={
                    resetTarget.kind === 'staff' && resetTarget.item.id === 'staff_admin'
                  }
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Password Baru (kosongkan jika tidak diubah)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 4 karakter"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg brand-bg text-white font-medium disabled:opacity-60 cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
