import React, { useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  Trash2,
  Loader2,
  Power,
  AlertCircle,
} from 'lucide-react';
import type { RoleAssignment, StaffRole, UserProfile } from '../types/humanis';
import {
  createRoleAssignment,
  deleteRoleAssignment,
  updateRoleAssignment,
  updateUserProfile,
} from '../lib/firestoreService';

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

export const RoleManagementView: React.FC<RoleManagementViewProps> = ({
  ownerId,
  currentRole,
  isAdminEmail,
  roleAssignments,
  userProfiles,
  onSwitchPreviewRole,
}) => {
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('wali_kelas');
  const [kelasBinaan, setKelasBinaan] = useState('X TKJ 1');
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_PERMS_BY_ROLE.wali_kelas);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const canManage = currentRole === 'admin' || isAdminEmail;

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Manajemen Peran &amp; Operator
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Kelola hak akses Admin Operator, Wali Kelas, Guru BK, dan Kepala Sekolah.
          </p>
        </div>

        {/* Role Switcher for Testing / Operator Preview */}
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
            Anda sedang melihat mode <strong>{ROLE_LABELS[currentRole]}</strong>. Penambahan atau
            perubahan daftar staf hanya tersedia pada peran <strong>Admin / Operator</strong>.
          </span>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Tambah Penugasan Staf */}
        {canManage && (
          <form
            onSubmit={handleCreateAssignment}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 brand-text" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Tambah Penugasan Peran Staf
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

        {/* Right: Daftar Staf & Akun Terdaftar */}
        <div
          className={`${
            canManage ? 'lg:col-span-7' : 'lg:col-span-12'
          } space-y-6`}
        >
          {/* Daftar Penugasan Peran */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Daftar Penugasan Peran ({roleAssignments.length})
              </h2>
            </div>

            {roleAssignments.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                Belum ada penugasan staf tambahan. Tambahkan operator, wali kelas, atau guru BK di
                formulir samping.
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

          {/* Akun Login Firebase Aktif (untuk Admin Email) */}
          {userProfiles.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Akun Pengguna Terdaftar di Firebase ({userProfiles.length})
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
    </div>
  );
};
