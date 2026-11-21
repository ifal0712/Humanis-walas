import React, { useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Plus, Trash2, MessageSquareQuote, Loader2 } from 'lucide-react';
import type { GoodStatement, StaffRole, Student } from '../types/humanis';
import { deleteGoodStatement, saveGoodStatement } from '../lib/firestoreService';

interface GoodStatementsViewProps {
  ownerId: string;
  students: Student[];
  statements: GoodStatement[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  staffRole: StaffRole;
}

const STOPWORDS = new Set([
  'saya', 'akan', 'lebih', 'yang', 'dan', 'untuk', 'dengan', 'tanpa', 'agar', 'di',
  'ke', 'dari', 'pada', 'dalam', 'tidak', 'harus', 'bisa', 'dapat', 'juga', 'atau',
  'sudah', 'belum', 'mau', 'ingin', 'setiap', 'ini', 'itu', 'hal', 'supaya',
]);

const QUICK_AFFIRMATIONS = [
  'Saya ingin lebih bertanggung jawab.',
  'Saya akan belajar mengatur waktu.',
  'Saya akan menyelesaikan tugas tanpa disuruh.',
];

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const GoodStatementsView: React.FC<GoodStatementsViewProps> = ({
  ownerId,
  students,
  statements,
  selectedStudentId,
  onSelectStudent,
  staffRole,
}) => {
  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0] || null,
    [students, selectedStudentId]
  );

  const [kalimat, setKalimat] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [sumber, setSumber] = useState<'manual' | 'voice'>('manual');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterMode, setFilterMode] = useState<'semua' | 'siswa'>('semua');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const visibleStatements = useMemo(() => {
    const base =
      filterMode === 'siswa' && activeStudent
        ? statements.filter((st) => st.studentId === activeStudent.id)
        : statements;
    return [...base].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [statements, filterMode, activeStudent]);

  // Dynamic Positive Word Cloud from actual statements
  const wordCloud = useMemo(() => {
    const freq: Record<string, number> = {};
    visibleStatements.forEach((st) => {
      const words = st.kalimat
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
      words.forEach((w) => {
        freq[w] = (freq[w] || 0) + 1;
      });
    });

    const entries = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 28);

    const maxCount = entries[0]?.[1] || 1;
    return entries.map(([word, count]) => ({
      word,
      count,
      sizePx: Math.round(13 + (count / maxCount) * 17),
      weight: count >= maxCount * 0.6 ? 'font-bold' : 'font-medium',
    }));
  }, [visibleStatements]);

  const toggleVoice = () => {
    setVoiceError(null);
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceError(
        'Browser ini tidak mendukung Web Speech API. Gunakan Chrome/Edge atau ketik pernyataan secara manual.'
      );
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        setKalimat((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setSumber('voice');
      }
    };

    recognition.onerror = (event) => {
      setVoiceError(`Perekaman suara terhenti (${event.error}). Anda tetap dapat mengetik manual.`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent || kalimat.trim().length < 2) return;
    setSaving(true);
    try {
      await saveGoodStatement(ownerId, {
        studentId: activeStudent.id,
        studentName: activeStudent.namaLengkap,
        kelas: activeStudent.kelas,
        kalimat: kalimat.trim(),
        sumber,
        tanggal,
      });
      setKalimat('');
      setSumber('manual');
    } finally {
      setSaving(false);
    }
  };

  if (!activeStudent) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-600 dark:text-slate-400">
        Tambahkan siswa terlebih dahulu untuk mencatat Pernyataan Baik Siswa.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Pernyataan Baik Siswa
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Dokumentasi komitmen dan afirmasi positif siswa melalui input suara maupun manual.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setFilterMode('semua')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterMode === 'semua'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Semua Siswa
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('siswa')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterMode === 'siswa'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Siswa Terpilih
            </button>
          </div>

          <select
            value={activeStudent.id}
            onChange={(e) => onSelectStudent(e.target.value)}
            className="px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.namaLengkap} ({s.kelas})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Input Manual + Voice-to-Text */}
        {staffRole !== 'kepala_sekolah' && (
          <form
            onSubmit={handleSave}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Catat Pernyataan Positif
              </h2>
              <button
                type="button"
                onClick={toggleVoice}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  listening
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                }`}
              >
                {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{listening ? 'Hentikan Rekam' : 'Voice to Text'}</span>
              </button>
            </div>

            {voiceError && (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg">
                {voiceError}
              </p>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Tanggal
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Kalimat Positif Siswa ({activeStudent.namaLengkap})
              </label>
              <textarea
                rows={3}
                required
                value={kalimat}
                onChange={(e) => {
                  setKalimat(e.target.value);
                  setSumber('manual');
                }}
                placeholder="Contoh: Saya akan menyelesaikan tugas tanpa disuruh."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Contoh cepat (klik untuk isi):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_AFFIRMATIONS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setKalimat(sample);
                      setSumber('manual');
                    }}
                    className="text-left text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-blue-400 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    &ldquo;{sample}&rdquo;
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
              <span>{saving ? 'Menyimpan...' : 'Simpan Pernyataan Baik'}</span>
            </button>
          </form>
        )}

        {/* Right: Word Cloud Positif + Riwayat Pernyataan */}
        <div
          className={`${
            staffRole !== 'kepala_sekolah' ? 'lg:col-span-7' : 'lg:col-span-12'
          } space-y-6`}
        >
          {/* Word Cloud Positif */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Word Cloud Positif
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kata kunci komitmen yang paling sering diucapkan siswa
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {wordCloud.length} kata kunci
              </span>
            </div>

            {wordCloud.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                Word Cloud akan muncul otomatis setelah ada pernyataan baik siswa tersimpan.
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-4 px-2 bg-slate-50/70 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
                {wordCloud.map((item, i) => (
                  <span
                    key={item.word}
                    style={{ fontSize: `${item.sizePx}px` }}
                    className={`${item.weight} ${
                      i % 3 === 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : i % 3 === 1
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-emerald-600 dark:text-emerald-400'
                    } leading-tight`}
                    title={`Muncul ${item.count} kali`}
                  >
                    {item.word}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Riwayat Pernyataan */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Riwayat Pernyataan ({visibleStatements.length})
            </h3>
            {visibleStatements.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada pernyataan baik tercatat.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleStatements.map((st) => (
                  <div key={st.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-900 dark:text-slate-100 flex items-start gap-2">
                        <MessageSquareQuote className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <span>&ldquo;{st.kalimat}&rdquo;</span>
                      </p>
                      <div className="text-xs text-slate-500 dark:text-slate-400 pl-6">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {st.studentName}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{st.kelas}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">{st.tanggal}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{st.sumber === 'voice' ? 'Suara' : 'Manual'}</span>
                      </div>
                    </div>
                    {staffRole !== 'kepala_sekolah' && (
                      <button
                        type="button"
                        onClick={() => deleteGoodStatement(st.id)}
                        aria-label="Hapus pernyataan"
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
