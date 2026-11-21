import React, { useState } from 'react';
import {
  Palette,
  Sun,
  Moon,
  Check,
  RotateCcw,
  Save,
  Loader2,
  CheckCircle2,
  LayoutGrid,
} from 'lucide-react';
import type { ThemeSetting } from '../types/humanis';

interface ThemeSettingsViewProps {
  theme: ThemeSetting;
  onUpdateLocalTheme: (next: ThemeSetting) => void;
  onPersistTheme: (next: ThemeSetting) => Promise<void>;
}

const ACCENT_PALETTES = [
  { name: 'Biru Profesional', hex: '#2563EB' },
  { name: 'Indigo Sekolah', hex: '#4F46E5' },
  { name: 'Zamrud Vokasi', hex: '#059669' },
  { name: 'Teal Modern', hex: '#0D9488' },
  { name: 'Amber Hangat', hex: '#D97706' },
  { name: 'Crimson Akademik', hex: '#E11D48' },
];

const GRID_PRESETS = [
  { label: '4 × 3 (Default)', cols: 4, rows: 3 },
  { label: '3 × 4', cols: 3, rows: 4 },
  { label: '2 × 6', cols: 2, rows: 6 },
  { label: '6 × 2', cols: 6, rows: 2 },
];

export const ThemeSettingsView: React.FC<ThemeSettingsViewProps> = ({
  theme,
  onUpdateLocalTheme,
  onPersistTheme,
}) => {
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const currentCols = Math.min(6, Math.max(2, Math.round(theme.gridColumns ?? 4)));
  const currentRows = Math.min(6, Math.max(2, Math.round(theme.gridRows ?? 3)));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onPersistTheme({
        ...theme,
        gridColumns: currentCols,
        gridRows: currentRows,
      });
      setSavedNotice(true);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaultTheme: ThemeSetting = {
      userId: theme.userId,
      mode: 'light',
      accentColor: '#2563EB',
      cardRadius: 'balanced',
      density: 'comfortable',
      schoolName: 'SMK Negeri 1 Sidayu',
      academicYear: '2026/2027',
      programSubtitle: 'Implementasi Tahap HUMANIS Kemandirian Siswa SMK',
      gridColumns: 4,
      gridRows: 3,
    };
    onUpdateLocalTheme(defaultTheme);
    setSaving(true);
    try {
      await onPersistTheme(defaultTheme);
      setSavedNotice(true);
    } finally {
      setSaving(false);
    }
  };

  const previewSlots = Array.from({ length: Math.min(12, currentCols * currentRows) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Kostumisasi Tema &amp; Tata Letak Menu
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Sesuaikan mode tampilan, warna aksen, susunan menu kisi (kolom × baris), dan identitas sekolah.
        </p>
      </div>

      {savedNotice && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Pengaturan tema dan tata letak kisi berhasil disimpan ke Firestore.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-6">
          {/* Mode Gelap / Terang */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mode Tampilan
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdateLocalTheme({ ...theme, mode: 'light' })}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                  theme.mode === 'light'
                    ? 'brand-border brand-soft-bg brand-text'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Light Mode</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateLocalTheme({ ...theme, mode: 'dark' })}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                  theme.mode === 'dark'
                    ? 'brand-border brand-soft-bg brand-text'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Dark Mode</span>
              </button>
            </div>
          </div>

          {/* Susunan Menu Kisi (Kolom x Baris) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Susunan Menu Kisi (Kolom × Baris)
              </label>
              <span className="text-xs font-mono brand-text font-semibold tabular-nums">
                {currentCols} × {currentRows}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GRID_PRESETS.map((preset) => {
                const active = currentCols === preset.cols && currentRows === preset.rows;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onUpdateLocalTheme({
                        ...theme,
                        gridColumns: preset.cols,
                        gridRows: preset.rows,
                      })
                    }
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'brand-border brand-soft-bg brand-text font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Jumlah Kolom (Kanan)
                </span>
                <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onUpdateLocalTheme({ ...theme, gridColumns: n })}
                      className={`py-1.5 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer ${
                        currentCols === n
                          ? 'bg-white dark:bg-slate-900 brand-text shadow-xs font-semibold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Jumlah Baris per Halaman
                </span>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {[2, 3, 4, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onUpdateLocalTheme({ ...theme, gridRows: n })}
                      className={`py-1.5 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer ${
                        currentRows === n
                          ? 'bg-white dark:bg-slate-900 brand-text shadow-xs font-semibold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Palet Warna Aksen */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Warna Aksen Utama
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {ACCENT_PALETTES.map((pal) => {
                const active = theme.accentColor.toUpperCase() === pal.hex.toUpperCase();
                return (
                  <button
                    key={pal.hex}
                    type="button"
                    onClick={() => onUpdateLocalTheme({ ...theme, accentColor: pal.hex })}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-white"
                      style={{ backgroundColor: pal.hex }}
                    >
                      {active && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {pal.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sudut Kartu & Kepadatan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sudut Kartu (Radius)
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(
                  [
                    { id: 'compact', label: 'Kompak' },
                    { id: 'balanced', label: 'Seimbang' },
                    { id: 'rounded', label: 'Bulat' },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onUpdateLocalTheme({ ...theme, cardRadius: r.id })}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      theme.cardRadius === r.id
                        ? 'bg-white dark:bg-slate-900 brand-text shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Kepadatan Kartu Menu
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(
                  [
                    { id: 'comfortable', label: 'Nyaman' },
                    { id: 'compact', label: 'Ringkas' },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onUpdateLocalTheme({ ...theme, density: d.id })}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      theme.density === d.id
                        ? 'bg-white dark:bg-slate-900 brand-text shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Identitas Sekolah */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nama Sekolah
                </label>
                <input
                  type="text"
                  value={theme.schoolName || ''}
                  onChange={(e) => onUpdateLocalTheme({ ...theme, schoolName: e.target.value })}
                  placeholder="SMK Negeri 1 Sidayu"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Tahun Ajaran
                </label>
                <input
                  type="text"
                  value={theme.academicYear || ''}
                  onChange={(e) => onUpdateLocalTheme({ ...theme, academicYear: e.target.value })}
                  placeholder="2026/2027"
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Subjudul Program di Menu Utama
              </label>
              <input
                type="text"
                value={theme.programSubtitle || ''}
                onChange={(e) =>
                  onUpdateLocalTheme({ ...theme, programSubtitle: e.target.value })
                }
                placeholder="Implementasi Tahap HUMANIS Kemandirian Siswa SMK"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium transition-opacity cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Tema'}</span>
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 brand-text" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Pratinjau Menu Kisi
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {currentCols} × {currentRows}
            </span>
          </div>

          <div className="p-4 border border-slate-200 dark:border-slate-800 ui-card-radius bg-slate-50 dark:bg-slate-950 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold brand-text truncate">
                {theme.schoolName || 'SMK Negeri 1 Sidayu'}
              </p>
              <span className="text-[11px] font-mono text-slate-500">TA {theme.academicYear}</span>
            </div>

            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${currentCols}, minmax(0, 1fr))` }}
            >
              {previewSlots.map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-2.5 flex flex-col items-center justify-center gap-1.5 text-center"
                >
                  <div className="w-7 h-7 rounded-lg brand-soft-bg brand-text flex items-center justify-center">
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-full">
                    Modul {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
