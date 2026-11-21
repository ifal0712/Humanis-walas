import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Save } from 'lucide-react';
import type {
  HumanisProgress,
  HumanisStageKey,
  StaffRole,
  Student,
} from '../types/humanis';
import { saveHumanisProgress } from '../lib/firestoreService';

interface HumanisViewProps {
  ownerId: string;
  students: Student[];
  humanisList: HumanisProgress[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  staffRole: StaffRole;
}

const STAGES: Array<{
  key: HumanisStageKey;
  title: string;
  subtitle: string;
}> = [
  { key: 'H', title: 'H - Humanisasi Potensi', subtitle: 'Mengidentifikasi kekuatan dan potensi siswa.' },
  { key: 'U', title: 'U - Urgensi dan Pemahaman', subtitle: 'Menumbuhkan kesadaran dunia kerja & kemandirian.' },
  { key: 'M', title: 'M - Modeling dan Keteladanan', subtitle: 'Memberikan teladan nyata dan mengamati respon.' },
  { key: 'A', title: 'A - Apresiasi Progres Kecil', subtitle: 'Menghargai setiap langkah perbaikan siswa.' },
  { key: 'N', title: 'N - Normalisasi dan Pembiasaan', subtitle: 'Membangun rutinitas kebiasaan positif mandiri.' },
  { key: 'I', title: 'I - Internalisasi Nilai', subtitle: 'Menguatkan nilai dan refleksi diri siswa.' },
  { key: 'S', title: 'S - Sinergi dan Keberlanjutan', subtitle: 'Kolaborasi guru, orang tua, dan tindak lanjut.' },
];

export const HumanisView: React.FC<HumanisViewProps> = ({
  ownerId,
  students,
  humanisList,
  selectedStudentId,
  onSelectStudent,
  staffRole,
}) => {
  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0] || null,
    [students, selectedStudentId]
  );

  const existingRecord = useMemo(
    () => (activeStudent ? humanisList.find((h) => h.studentId === activeStudent.id) : undefined),
    [humanisList, activeStudent]
  );

  const [activeStage, setActiveStage] = useState<HumanisStageKey>('H');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    completedStages: [] as HumanisStageKey[],
    hMinat: '',
    hBakat: '',
    hCitaCita: '',
    hKeunggulan: '',
    uPemahamanKerja: '',
    uKesadaranMandiri: '',
    uCatatanDiskusi: '',
    mKeteladananGuru: '',
    mResponSiswa: '',
    aProgresDicapai: '',
    aBentukApresiasi: '',
    aTanggal: new Date().toISOString().slice(0, 10),
    nKebiasaanPositif: '',
    nTugasKemandirian: '',
    iNilaiTertanam: '',
    iRefleksiSiswa: '',
    sPeranOrangTua: '',
    sPeranGuru: '',
    sTindakLanjut: '',
  });

  useEffect(() => {
    if (existingRecord) {
      setFormState({
        completedStages: existingRecord.completedStages || [],
        hMinat: existingRecord.hMinat || '',
        hBakat: existingRecord.hBakat || '',
        hCitaCita: existingRecord.hCitaCita || '',
        hKeunggulan: existingRecord.hKeunggulan || '',
        uPemahamanKerja: existingRecord.uPemahamanKerja || '',
        uKesadaranMandiri: existingRecord.uKesadaranMandiri || '',
        uCatatanDiskusi: existingRecord.uCatatanDiskusi || '',
        mKeteladananGuru: existingRecord.mKeteladananGuru || '',
        mResponSiswa: existingRecord.mResponSiswa || '',
        aProgresDicapai: existingRecord.aProgresDicapai || '',
        aBentukApresiasi: existingRecord.aBentukApresiasi || '',
        aTanggal: existingRecord.aTanggal || new Date().toISOString().slice(0, 10),
        nKebiasaanPositif: existingRecord.nKebiasaanPositif || '',
        nTugasKemandirian: existingRecord.nTugasKemandirian || '',
        iNilaiTertanam: existingRecord.iNilaiTertanam || '',
        iRefleksiSiswa: existingRecord.iRefleksiSiswa || '',
        sPeranOrangTua: existingRecord.sPeranOrangTua || '',
        sPeranGuru: existingRecord.sPeranGuru || '',
        sTindakLanjut: existingRecord.sTindakLanjut || '',
      });
    } else {
      setFormState({
        completedStages: [],
        hMinat: '',
        hBakat: '',
        hCitaCita: '',
        hKeunggulan: '',
        uPemahamanKerja: '',
        uKesadaranMandiri: '',
        uCatatanDiskusi: '',
        mKeteladananGuru: '',
        mResponSiswa: '',
        aProgresDicapai: '',
        aBentukApresiasi: '',
        aTanggal: new Date().toISOString().slice(0, 10),
        nKebiasaanPositif: '',
        nTugasKemandirian: '',
        iNilaiTertanam: '',
        iRefleksiSiswa: '',
        sPeranOrangTua: '',
        sPeranGuru: '',
        sTindakLanjut: '',
      });
    }
    setSavedMsg(null);
  }, [existingRecord, activeStudent?.id]);

  const toggleStageCompleted = (key: HumanisStageKey) => {
    setFormState((prev) => {
      const exists = prev.completedStages.includes(key);
      return {
        ...prev,
        completedStages: exists
          ? prev.completedStages.filter((k) => k !== key)
          : [...prev.completedStages, key],
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      await saveHumanisProgress(
        ownerId,
        activeStudent.id,
        {
          studentName: activeStudent.namaLengkap,
          kelas: activeStudent.kelas,
          ...formState,
        },
        existingRecord?.id
      );
      setSavedMsg(
        `Tahap ${activeStage} untuk ${activeStudent.namaLengkap} berhasil disimpan ke Firestore.`
      );
    } finally {
      setSaving(false);
    }
  };

  if (!activeStudent) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-600 dark:text-slate-400">
        Belum ada data siswa untuk dokumentasi Tahapan HUMANIS.
      </div>
    );
  }

  const readOnly = staffRole === 'kepala_sekolah';
  const currentStageMeta = STAGES.find((s) => s.key === activeStage)!;
  const isCompleted = formState.completedStages.includes(activeStage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Tahapan Pembinaan HUMANIS
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Dokumentasi terstruktur 7 langkah implementasi karakter kemandirian siswa SMK.
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

      {/* Progress Summary Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-800 dark:text-slate-200">
            Progres HUMANIS — {activeStudent.namaLengkap}
          </span>
          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
            {formState.completedStages.length} / 7 Tahap Terlaksana
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${Math.round((formState.completedStages.length / 7) * 100)}%` }}
          />
        </div>
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Submenu Left: 7 Stages */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-1">
          {STAGES.map((stage) => {
            const done = formState.completedStages.includes(stage.key);
            const active = activeStage === stage.key;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => setActiveStage(stage.key)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-lg text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{stage.title}</div>
                  <div
                    className={`text-xs truncate ${
                      active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {stage.subtitle}
                  </div>
                </div>
                {done ? (
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-emerald-500'}`}
                  />
                ) : (
                  <Circle
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-blue-200' : 'text-slate-300 dark:text-slate-700'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Stage Detail Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {currentStageMeta.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentStageMeta.subtitle}
              </p>
            </div>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => toggleStageCompleted(activeStage)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isCompleted
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isCompleted ? 'Tahap Selesai' : 'Tandai Selesai'}</span>
            </button>
          </div>

          {activeStage === 'H' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput
                label="Minat Siswa"
                value={formState.hMinat}
                disabled={readOnly}
                placeholder="Contoh: Jaringan komputer, desain UI, instalasi kelistrikan"
                onChange={(v) => setFormState({ ...formState, hMinat: v })}
              />
              <FieldInput
                label="Bakat Siswa"
                value={formState.hBakat}
                disabled={readOnly}
                placeholder="Contoh: Logika troubleshooting cepat, teliti merakit"
                onChange={(v) => setFormState({ ...formState, hBakat: v })}
              />
              <FieldInput
                label="Cita-cita"
                value={formState.hCitaCita}
                disabled={readOnly}
                placeholder="Contoh: Network Engineer / Wirausaha IT"
                onChange={(v) => setFormState({ ...formState, hCitaCita: v })}
              />
              <FieldInput
                label="Keunggulan Siswa"
                value={formState.hKeunggulan}
                disabled={readOnly}
                placeholder="Contoh: Cepat tanggap saat praktik bengkel"
                onChange={(v) => setFormState({ ...formState, hKeunggulan: v })}
              />
            </div>
          )}

          {activeStage === 'U' && (
            <div className="space-y-4">
              <FieldTextArea
                label="Pemahaman Dunia Kerja (DUDI)"
                value={formState.uPemahamanKerja}
                disabled={readOnly}
                placeholder="Sejauh mana siswa memahami tuntutan kemandirian di industri..."
                onChange={(v) => setFormState({ ...formState, uPemahamanKerja: v })}
              />
              <FieldTextArea
                label="Kesadaran Pentingnya Mandiri"
                value={formState.uKesadaranMandiri}
                disabled={readOnly}
                placeholder="Kesadaran pribadi siswa atas tanggung jawab belajar & PKL..."
                onChange={(v) => setFormState({ ...formState, uKesadaranMandiri: v })}
              />
              <FieldTextArea
                label="Catatan Diskusi"
                value={formState.uCatatanDiskusi}
                disabled={readOnly}
                placeholder="Ringkasan dialog reflektif bersama wali kelas / guru BK..."
                onChange={(v) => setFormState({ ...formState, uCatatanDiskusi: v })}
              />
            </div>
          )}

          {activeStage === 'M' && (
            <div className="space-y-4">
              <FieldTextArea
                label="Keteladanan yang Diberikan Guru"
                value={formState.mKeteladananGuru}
                disabled={readOnly}
                placeholder="Contoh: Disiplin hadir, keterbukaan checklist proyek, manajemen waktu..."
                onChange={(v) => setFormState({ ...formState, mKeteladananGuru: v })}
              />
              <FieldTextArea
                label="Respon Siswa"
                value={formState.mResponSiswa}
                disabled={readOnly}
                placeholder="Bagaimana siswa meniru dan merespon keteladanan tersebut..."
                onChange={(v) => setFormState({ ...formState, mResponSiswa: v })}
              />
            </div>
          )}

          {activeStage === 'A' && (
            <div className="space-y-4">
              <FieldTextArea
                label="Progres yang Dicapai"
                value={formState.aProgresDicapai}
                disabled={readOnly}
                placeholder="Kemajuan kecil yang terlihat (misal: mulai mengumpulkan tugas tepat waktu)..."
                onChange={(v) => setFormState({ ...formState, aProgresDicapai: v })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldInput
                  label="Bentuk Apresiasi"
                  value={formState.aBentukApresiasi}
                  disabled={readOnly}
                  placeholder="Pujian spesifik, sertifikat mingguan, peran ketua lab"
                  onChange={(v) => setFormState({ ...formState, aBentukApresiasi: v })}
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Tanggal Apresiasi
                  </label>
                  <input
                    type="date"
                    disabled={readOnly}
                    value={formState.aTanggal}
                    onChange={(e) => setFormState({ ...formState, aTanggal: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {activeStage === 'N' && (
            <div className="space-y-4">
              <FieldTextArea
                label="Kebiasaan Positif yang Dibangun"
                value={formState.nKebiasaanPositif}
                disabled={readOnly}
                placeholder="Contoh: Membuat to-do list harian sebelum mulai praktik..."
                onChange={(v) => setFormState({ ...formState, nKebiasaanPositif: v })}
              />
              <FieldTextArea
                label="Tugas Kemandirian"
                value={formState.nTugasKemandirian}
                disabled={readOnly}
                placeholder="Proyek individu mingguan atau tanggung jawab mandiri siswa..."
                onChange={(v) => setFormState({ ...formState, nTugasKemandirian: v })}
              />
            </div>
          )}

          {activeStage === 'I' && (
            <div className="space-y-4">
              <FieldTextArea
                label="Nilai yang Mulai Tertanam"
                value={formState.iNilaiTertanam}
                disabled={readOnly}
                placeholder="Contoh: Tanggung jawab, kejujuran kerja, inisiatif belajar..."
                onChange={(v) => setFormState({ ...formState, iNilaiTertanam: v })}
              />
              <FieldTextArea
                label="Refleksi Siswa"
                value={formState.iRefleksiSiswa}
                disabled={readOnly}
                placeholder="Kutipan refleksi diri yang disampaikan oleh siswa..."
                onChange={(v) => setFormState({ ...formState, iRefleksiSiswa: v })}
              />
            </div>
          )}

          {activeStage === 'S' && (
            <div className="space-y-4">
              <FieldTextArea
                label="Peran Orang Tua"
                value={formState.sPeranOrangTua}
                disabled={readOnly}
                placeholder="Dukungan pemantauan belajar dan kebiasaan disiplin di rumah..."
                onChange={(v) => setFormState({ ...formState, sPeranOrangTua: v })}
              />
              <FieldTextArea
                label="Peran Guru"
                value={formState.sPeranGuru}
                disabled={readOnly}
                placeholder="Pendampingan berkelanjutan oleh wali kelas dan guru produktif..."
                onChange={(v) => setFormState({ ...formState, sPeranGuru: v })}
              />
              <FieldTextArea
                label="Tindak Lanjut"
                value={formState.sTindakLanjut}
                disabled={readOnly}
                placeholder="Rencana evaluasi bulanan dan target kemandirian berikutnya..."
                onChange={(v) => setFormState({ ...formState, sTindakLanjut: v })}
              />
            </div>
          )}

          {!readOnly && (
            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Menyimpan...' : 'Simpan Tahapan HUMANIS'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

function FieldInput(props: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
        {props.label}
      </label>
      <input
        type="text"
        disabled={props.disabled}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-70"
      />
    </div>
  );
}

function FieldTextArea(props: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
        {props.label}
      </label>
      <textarea
        rows={3}
        disabled={props.disabled}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-70"
      />
    </div>
  );
}
