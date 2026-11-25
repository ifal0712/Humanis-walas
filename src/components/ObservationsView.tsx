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
import { CheckCircle2, AlertTriangle, MinusCircle, Plus, Loader2 } from 'lucide-react';
import type { ConditionLevel, Observation, StaffRole, Student } from '../types/humanis';
import { saveObservation } from '../lib/firestoreService';
import {
  REPORT_PERIOD_OPTIONS,
  filterByPeriodWindow,
  type ReportPeriodFilter,
} from '../lib/periodUtils';

interface ObservationsViewProps {
  ownerId: string;
  students: Student[];
  observations: Observation[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  staffRole: StaffRole;
  observerName: string;
}

export const ObservationsView: React.FC<ObservationsViewProps> = ({
  ownerId,
  students,
  observations,
  selectedStudentId,
  onSelectStudent,
  staffRole,
  observerName,
}) => {
  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0] || null,
    [students, selectedStudentId]
  );

  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [kondisiAkademik, setKondisiAkademik] = useState('');
  const [kondisiSosial, setKondisiSosial] = useState('');
  const [kondisiEmosional, setKondisiEmosional] = useState('');
  const [tingkatKemandirian, setTingkatKemandirian] = useState<ConditionLevel>('cukup');
  const [skorKemandirian, setSkorKemandirian] = useState(70);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [periodRange, setPeriodRange] = useState<ReportPeriodFilter>('all');

  const studentObservations = useMemo(() => {
    if (!activeStudent) return [];
    const sorted = observations
      .filter((o) => o.studentId === activeStudent.id)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    return filterByPeriodWindow(sorted, (o) => o.tanggal, periodRange);
  }, [observations, activeStudent, periodRange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) return;
    setSaving(true);
    setNotice(null);
    try {
      await saveObservation(ownerId, {
        studentId: activeStudent.id,
        studentName: activeStudent.namaLengkap,
        kelas: activeStudent.kelas,
        tanggal,
        kondisiAkademik: kondisiAkademik.trim() || 'Mengikuti pembelajaran dengan baik',
        kondisiSosial: kondisiSosial.trim() || 'Berinteraksi wajar dengan teman',
        kondisiEmosional: kondisiEmosional.trim() || 'Stabil',
        tingkatKemandirian,
        skorKemandirian: Number(skorKemandirian),
        observerName,
      });
      setKondisiAkademik('');
      setKondisiSosial('');
      setKondisiEmosional('');
      setNotice(`Observasi kondisi ${activeStudent.namaLengkap} berhasil dicatat.`);
    } finally {
      setSaving(false);
    }
  };

  if (!activeStudent) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-600 dark:text-slate-400">
        Tambahkan siswa terlebih dahulu untuk mencatat observasi kondisi terkini.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Kondisi Saat Ini &amp; Tren Perkembangan
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Observasi berkala aspek akademik, sosial, emosional, dan tingkat kemandirian siswa.
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
        {/* Form Observasi */}
        {staffRole !== 'kepala_sekolah' && (
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Catat Observasi Baru
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
                  Skor Kemandirian ({skorKemandirian})
                </label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={skorKemandirian}
                  onChange={(e) => setSkorKemandirian(Number(e.target.value))}
                  className="w-full mt-2 accent-blue-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Kondisi Akademik
              </label>
              <input
                type="text"
                required
                value={kondisiAkademik}
                onChange={(e) => setKondisiAkademik(e.target.value)}
                placeholder="Contoh: Menyelesaikan tugas praktik tepat waktu"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Kondisi Sosial
              </label>
              <input
                type="text"
                required
                value={kondisiSosial}
                onChange={(e) => setKondisiSosial(e.target.value)}
                placeholder="Contoh: Aktif berkolaborasi saat praktik kelompok"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Kondisi Emosional
              </label>
              <input
                type="text"
                required
                value={kondisiEmosional}
                onChange={(e) => setKondisiEmosional(e.target.value)}
                placeholder="Contoh: Tenang, percaya diri saat presentasi"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Tingkat Kemandirian
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'baik', label: 'Baik', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
                    { id: 'cukup', label: 'Cukup', activeClass: 'bg-amber-600 text-white border-amber-600' },
                    {
                      id: 'perlu_pendampingan',
                      label: 'Pendampingan',
                      activeClass: 'bg-rose-600 text-white border-rose-600',
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTingkatKemandirian(opt.id)}
                    className={`py-2 px-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      tingkatKemandirian === opt.id
                        ? opt.activeClass
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Observasi'}</span>
            </button>
          </form>
        )}

        {/* Right: Trend Chart + History */}
        <div
          className={`${
            staffRole !== 'kepala_sekolah' ? 'lg:col-span-7' : 'lg:col-span-12'
          } space-y-6`}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Tren Perkembangan — {activeStudent.namaLengkap}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Perubahan skor observasi kemandirian dari waktu ke waktu
                </p>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto">
                {REPORT_PERIOD_OPTIONS.filter((opt) => opt.value !== 0).map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setPeriodRange(opt.value)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                      periodRange === opt.value
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 w-full">
              {studentObservations.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={studentObservations} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="tanggal" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="skorKemandirian"
                      name="Skor Kemandirian"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#2563EB' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  Belum ada data observasi untuk siswa ini.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Riwayat Observasi ({studentObservations.length})
            </h3>
            {studentObservations.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada catatan.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...studentObservations].reverse().map((obs) => (
                  <div key={obs.id} className="py-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {obs.tanggal}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          Skor {obs.skorKemandirian}
                        </span>
                        {obs.tingkatKemandirian === 'baik' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Baik
                          </span>
                        ) : obs.tingkatKemandirian === 'perlu_pendampingan' ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" /> Perlu Pendampingan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <MinusCircle className="w-3.5 h-3.5" /> Cukup
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      <strong>Akademik:</strong> {obs.kondisiAkademik} · <strong>Sosial:</strong>{' '}
                      {obs.kondisiSosial} · <strong>Emosional:</strong> {obs.kondisiEmosional}
                    </p>
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
