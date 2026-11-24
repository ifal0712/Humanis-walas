import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Compass,
  Activity,
  GitBranch,
  MessageSquareHeart,
  Sparkles,
  FileBarChart2,
  ShieldCheck,
  Palette,
  Database,
  FileSpreadsheet,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { StaffRole, Student, ThemeSetting } from '../types/humanis';

export type AppMenuKey =
  | 'home'
  | 'dashboard'
  | 'siswa'
  | 'diagnostik'
  | 'humanis'
  | 'kondisi'
  | 'pembinaan'
  | 'pernyataan'
  | 'ai'
  | 'laporan'
  | 'peran'
  | 'tema'
  | 'spreadsheet';

interface GridMenuHomeProps {
  staffName: string;
  staffRole: StaffRole;
  nip?: string;
  theme: ThemeSetting;
  students: Student[];
  onSelectMenu: (key: AppMenuKey) => void;
  onSeedDemo: () => Promise<void>;
  seeding: boolean;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin / Operator',
  wali_kelas: 'Wali Kelas',
  guru_bk: 'Guru BK',
  kepala_sekolah: 'Kepala Sekolah',
};

interface TileDef {
  id: AppMenuKey;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: StaffRole[];
}

const GRID_COL_CLASSES: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
};

export const GridMenuHome: React.FC<GridMenuHomeProps> = ({
  staffName,
  staffRole,
  nip,
  theme,
  students,
  onSelectMenu,
  onSeedDemo,
  seeding,
}) => {
  const highCount = students.filter(
    (s) => s.latestCondition === 'baik' || (s.latestScore ?? 0) >= 75
  ).length;
  const attentionCount = students.filter(
    (s) =>
      s.latestCondition === 'perlu_pendampingan' ||
      ((s.latestScore ?? 0) > 0 && (s.latestScore ?? 0) < 55)
  ).length;

  const tiles: TileDef[] = [
    {
      id: 'dashboard',
      title: 'Dashboard Analitik',
      icon: LayoutDashboard,
      roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
    },
    {
      id: 'siswa',
      title: 'Data Siswa',
      icon: Users,
      roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
    },
    {
      id: 'diagnostik',
      title: 'Tes Diagnostik Awal',
      icon: ClipboardList,
      roles: ['admin', 'wali_kelas', 'guru_bk'],
    },
    {
      id: 'humanis',
      title: 'Tahapan HUMANIS',
      icon: Compass,
      roles: ['admin', 'wali_kelas', 'guru_bk'],
    },
    {
      id: 'kondisi',
      title: 'Kondisi Saat Ini',
      icon: Activity,
      roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
    },
    {
      id: 'pembinaan',
      title: 'Proses Pembinaan',
      icon: GitBranch,
      roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
    },
    {
      id: 'pernyataan',
      title: 'Pernyataan Baik',
      icon: MessageSquareHeart,
      roles: ['admin', 'wali_kelas', 'guru_bk'],
    },
    {
      id: 'ai',
      title: 'AI Advisor Gemini',
      icon: Sparkles,
      roles: ['admin', 'wali_kelas', 'guru_bk'],
    },
    {
      id: 'laporan',
      title: 'Laporan & Cetak',
      icon: FileBarChart2,
      roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
    },
    {
      id: 'peran',
      title: 'Manajemen Peran',
      icon: ShieldCheck,
      roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
    },
    {
      id: 'tema',
      title: 'Kostumisasi Tema',
      icon: Palette,
      roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
    },
    {
      id: 'spreadsheet',
      title: 'Google Sheets & Drive',
      icon: FileSpreadsheet,
      roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
    },
  ];

  const visibleTiles = tiles.filter((t) => t.roles.includes(staffRole));
  const cols = Math.min(6, Math.max(2, Math.round(theme.gridColumns ?? 4)));
  const rows = Math.min(6, Math.max(2, Math.round(theme.gridRows ?? 3)));
  const pageSize = cols * rows;
  const totalPages = Math.max(1, Math.ceil(visibleTiles.length / pageSize));
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (page >= totalPages) {
      setPage(0);
    }
  }, [page, totalPages]);

  const pagedTiles = visibleTiles.slice(page * pageSize, (page + 1) * pageSize);
  const gridColClass = GRID_COL_CLASSES[cols] || GRID_COL_CLASSES[4];
  const padClass = theme.density === 'compact' ? 'py-4 px-3' : 'py-6 px-4';

  return (
    <div className="space-y-6">
      {/* Welcome & School Identity Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold brand-text">{ROLE_LABELS[staffRole]}</span>
            <span aria-hidden="true">·</span>
            <span>{theme.schoolName || 'SMK Negeri 1 Sidayu'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">TA {theme.academicYear || '2026/2027'}</span>
            {nip && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">NIP/ID {nip}</span>
              </>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white [text-wrap:balance]">
            Selamat Datang, {staffName}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {theme.programSubtitle ||
              'Implementasi Tahap HUMANIS Kemandirian Siswa SMK'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0">
          {students.length === 0 ? (
            <button
              type="button"
              disabled={seeding}
              onClick={onSeedDemo}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-xs font-medium transition-opacity cursor-pointer"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              <span>{seeding ? 'Memuat Data...' : 'Muat Data Contoh Siswa'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-6 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Siswa</p>
                <p className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {students.length}
                </p>
              </div>
              <div className="h-7 w-px bg-slate-200 dark:bg-slate-800" />
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Mandiri Tinggi</p>
                <p className="font-display text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {highCount}
                </p>
              </div>
              <div className="h-7 w-px bg-slate-200 dark:bg-slate-800" />
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Pendampingan</p>
                <p className="font-display text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {attentionCount}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid Menu Kisi (Hanya Ikon & Judul, Default 4 x 3 Baris) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-slate-700 dark:text-slate-300">
            Menu Utama
          </h2>
          <div className="flex items-center gap-2">
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Halaman sebelumnya"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums px-1">
                  {page + 1}/{totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  aria-label="Halaman berikutnya"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {cols} × {rows}
            </span>
          </div>
        </div>

        <div className={`grid ${gridColClass} gap-4`}>
          {pagedTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => onSelectMenu(tile.id)}
                className={`group min-h-[116px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 ui-card-radius ${padClass} flex flex-col items-center justify-center text-center gap-3 transition-all hover:-translate-y-0.5 cursor-pointer`}
              >
                <div className="w-12 h-12 rounded-2xl brand-soft-bg brand-text flex items-center justify-center transition-transform group-hover:scale-105 shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="font-display text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                  {tile.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
