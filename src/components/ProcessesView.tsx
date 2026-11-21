import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, GitCommitHorizontal, CheckCircle2 } from 'lucide-react';
import type {
  CoachingProcess,
  HumanisStageKey,
  StaffRole,
  Student,
} from '../types/humanis';
import { deleteProcess, saveProcess } from '../lib/firestoreService';

interface ProcessesViewProps {
  ownerId: string;
  students: Student[];
  processes: CoachingProcess[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  staffRole: StaffRole;
  staffName: string;
}

const STAGE_NAMES: Record<HumanisStageKey, string> = {
  H: 'H · Humanisasi Potensi',
  U: 'U · Urgensi & Pemahaman',
  M: 'M · Modeling & Keteladanan',
  A: 'A · Apresiasi Progres Kecil',
  N: 'N · Normalisasi & Pembiasaan',
  I: 'I · Internalisasi Nilai',
  S: 'S · Sinergi & Keberlanjutan',
};

export const ProcessesView: React.FC<ProcessesViewProps> = ({
  ownerId,
  students,
  processes,
  selectedStudentId,
  onSelectStudent,
  staffRole,
  staffName,
}) => {
  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0] || null,
    [students, selectedStudentId]
  );

  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [tahapHumanis, setTahapHumanis] = useState<HumanisStageKey>('N');
  const [tindakan, setTindakan] = useState('');
  const [hasilSementara, setHasilSementara] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const studentProcesses = useMemo(() => {
    if (!activeStudent) return [];
    return processes
      .filter((p) => p.studentId === activeStudent.id)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [processes, activeStudent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent || !tindakan.trim() || !hasilSementara.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      await saveProcess(ownerId, {
        studentId: activeStudent.id,
        studentName: activeStudent.namaLengkap,
        kelas: activeStudent.kelas,
        tanggal,
        tindakan: tindakan.trim(),
        tahapHumanis,
        hasilSementara: hasilSementara.trim(),
        petugasRole: staffRole,
        petugasNama: staffName,
      });
      setTindakan('');
      setHasilSementara('');
      setNotice('Catatan proses pembinaan berhasil ditambahkan ke timeline.');
    } finally {
      setSaving(false);
    }
  };

  if (!activeStudent) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-600 dark:text-slate-400">
        Belum ada data siswa untuk dokumentasi proses pembinaan.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Proses Pembinaan Siswa
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Timeline vertikal intervensi pembinaan oleh Wali Kelas dan Guru BK.
          </p>
        </div>

        <div className="w-full md:w-72">
          <select
            value={activeStudent.id}
            onChange={(e) => onSelectStudent(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.namaLengkap} ({s.kelas})
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {staffRole !== 'kepala_sekolah' && (
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Tambah Catatan Pembinaan
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Tahap HUMANIS
                </label>
                <select
                  value={tahapHumanis}
                  onChange={(e) => setTahapHumanis(e.target.value as HumanisStageKey)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {(['H', 'U', 'M', 'A', 'N', 'I', 'S'] as HumanisStageKey[]).map((k) => (
                    <option key={k} value={k}>
                      {STAGE_NAMES[k]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Tindakan yang Dilakukan
              </label>
              <textarea
                rows={3}
                required
                value={tindakan}
                onChange={(e) => setTindakan(e.target.value)}
                placeholder="Deskripsikan pendampingan, konseling, atau penugasan yang diberikan..."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Hasil Sementara
              </label>
              <textarea
                rows={2}
                required
                value={hasilSementara}
                onChange={(e) => setHasilSementara(e.target.value)}
                placeholder="Respon awal dan perubahan perilaku yang teramati..."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{saving ? 'Menyimpan...' : 'Catat ke Timeline'}</span>
            </button>
          </form>
        )}

        {/* Vertical Professional Timeline */}
        <div
          className={`${
            staffRole !== 'kepala_sekolah' ? 'lg:col-span-7' : 'lg:col-span-12'
          } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Timeline Pembinaan — {activeStudent.namaLengkap}
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {studentProcesses.length} entri
            </span>
          </div>

          {studentProcesses.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Belum ada riwayat pembinaan untuk siswa ini.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
              {studentProcesses.map((proc) => (
                <div key={proc.id} className="relative space-y-1.5">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-mono font-bold">
                    {proc.tahapHumanis}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {proc.tanggal}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {STAGE_NAMES[proc.tahapHumanis]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {proc.petugasRole === 'guru_bk' ? 'Guru BK' : 'Wali Kelas'}
                        {proc.petugasNama ? ` (${proc.petugasNama})` : ''}
                      </span>
                    </div>
                    {staffRole !== 'kepala_sekolah' && (
                      <button
                        type="button"
                        onClick={() => deleteProcess(proc.id)}
                        aria-label="Hapus catatan"
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-1.5">
                    <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                      {proc.tindakan}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                      <GitCommitHorizontal className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                      <span>
                        <strong>Hasil sementara:</strong> {proc.hasilSementara}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
