import React from 'react';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  ListChecks,
  Compass,
  Activity,
  GitBranch,
  MessageSquareHeart,
  Sparkles,
  FileBarChart2,
  FileSpreadsheet,
  ShieldCheck,
  Palette,
  PanelLeftClose,
  X,
  Database,
  Loader2,
} from 'lucide-react';
import type { StaffRole, ThemeSetting } from '../types/humanis';
import type { AppMenuKey } from './GridMenuHome';

interface SidebarItem {
  id: AppMenuKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: StaffRole[];
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    title: 'Utama & Asesmen',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard Analitik',
        icon: LayoutDashboard,
        roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
      },
      {
        id: 'siswa',
        label: 'Data Siswa',
        icon: Users,
        roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
      },
      {
        id: 'diagnostik',
        label: 'Tes Diagnostik Awal',
        icon: ClipboardList,
        roles: ['admin', 'wali_kelas', 'guru_bk'],
      },
      {
        id: 'rubrik',
        label: 'Penilaian Rubrik',
        icon: ListChecks,
        roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
      },
    ],
  },
  {
    title: 'Pembinaan HUMANIS',
    items: [
      {
        id: 'humanis',
        label: 'Tahapan HUMANIS',
        icon: Compass,
        roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
      },
      {
        id: 'kondisi',
        label: 'Kondisi Saat Ini',
        icon: Activity,
        roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
      },
      {
        id: 'pembinaan',
        label: 'Proses Pembinaan',
        icon: GitBranch,
        roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
      },
      {
        id: 'pernyataan',
        label: 'Pernyataan Baik',
        icon: MessageSquareHeart,
        roles: ['admin', 'wali_kelas', 'guru_bk'],
      },
    ],
  },
  {
    title: 'Analisis & Laporan',
    items: [
      {
        id: 'ai',
        label: 'AI Advisor Gemini',
        icon: Sparkles,
        roles: ['admin', 'wali_kelas', 'guru_bk'],
      },
      {
        id: 'laporan',
        label: 'Laporan & Cetak',
        icon: FileBarChart2,
        roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
      },
      {
        id: 'spreadsheet',
        label: 'Google Sheets & Drive',
        icon: FileSpreadsheet,
        roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
      },
    ],
  },
  {
    title: 'Pengaturan',
    items: [
      {
        id: 'peran',
        label: 'Manajemen Peran',
        icon: ShieldCheck,
        roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
      },
      {
        id: 'tema',
        label: 'Kostumisasi Tema',
        icon: Palette,
        roles: ['admin', 'wali_kelas', 'guru_bk', 'kepala_sekolah'],
      },
    ],
  },
];

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin / Operator',
  wali_kelas: 'Wali Kelas',
  guru_bk: 'Guru BK',
  kepala_sekolah: 'Kepala Sekolah',
};

interface AppSidebarProps {
  open: boolean;
  mobileOpen: boolean;
  activeMenu: AppMenuKey;
  staffName: string;
  staffRole: StaffRole;
  nip?: string;
  theme: ThemeSetting;
  studentsCount: number;
  emblemFailed: boolean;
  onEmblemError: () => void;
  onSelectMenu: (menu: AppMenuKey) => void;
  onHideDesktop: () => void;
  onCloseMobile: () => void;
  onSeedDemo: () => Promise<void>;
  seeding: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  open,
  mobileOpen,
  activeMenu,
  staffName,
  staffRole,
  nip,
  theme,
  studentsCount,
  emblemFailed,
  onEmblemError,
  onSelectMenu,
  onHideDesktop,
  onCloseMobile,
  onSeedDemo,
  seeding,
}) => {
  const renderNavBody = (isMobile: boolean) => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Sidebar Brand Header */}
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {!emblemFailed ? (
            <img
              src="/src/assets/images/humanis_emblem_1794880387572.jpg"
              alt="Logo HUMANIS"
              referrerPolicy="no-referrer"
              onError={onEmblemError}
              className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg brand-bg text-white font-bold flex items-center justify-center text-sm shrink-0">
              H
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
              HUMANIS SMK
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight">
              TA {theme.academicYear || '2026/2027'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={isMobile ? onCloseMobile : onHideDesktop}
          title="Sembunyikan Sidebar"
          aria-label="Sembunyikan Sidebar"
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
        >
          {isMobile ? <X className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Scrollable Menu Groups */}
      <nav aria-label="Menu Navigasi Sidebar" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {SIDEBAR_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(staffRole));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="space-y-1">
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeMenu === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectMenu(item.id);
                        if (isMobile) onCloseMobile();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-[13px] transition-colors cursor-pointer text-left ${
                        active
                          ? 'brand-soft-bg brand-text font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white font-medium'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {studentsCount === 0 && (
          <div className="pt-2 px-1">
            <button
              type="button"
              disabled={seeding}
              onClick={onSeedDemo}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl brand-bg hover:opacity-95 disabled:opacity-60 text-white text-xs font-medium transition-opacity cursor-pointer"
            >
              {seeding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Database className="w-3.5 h-3.5" />
              )}
              <span>{seeding ? 'Memuat Data...' : 'Muat Data Contoh'}</span>
            </button>
          </div>
        )}
      </nav>

      {/* Compact User Profile Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/70 dark:bg-slate-950/60">
        <div className="px-2 py-1 space-y-0.5">
          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
            {staffName}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {ROLE_LABELS[staffRole]}
            {nip ? ` · ${nip}` : ''}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside
        aria-hidden={!open}
        className={`no-print hidden lg:block shrink-0 transition-all duration-200 ease-out overflow-hidden ${
          open ? 'w-64' : 'w-0'
        }`}
      >
        <div className="w-64 h-screen sticky top-0">{renderNavBody(false)}</div>
      </aside>

      {/* Mobile / Tablet Slide-Over Sidebar Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[82vw] h-full shadow-xl">
            {renderNavBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
