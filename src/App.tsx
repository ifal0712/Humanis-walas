import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  LayoutGrid,
  LayoutDashboard,
  Users,
  Compass,
  Palette,
  ShieldCheck,
  Sun,
  Moon,
  LogOut,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { auth } from './lib/firebase';
import {
  createStudent,
  getOrCreateUserProfile,
  saveDiagnostic,
  saveGoodStatement,
  saveThemeSetting,
  subscribeOwnedCollection,
  subscribeThemeSetting,
  updateStudent,
  updateUserProfile,
} from './lib/firestoreService';
import {
  clearSavedStaffSession,
  exchangeFirebaseTokenForStaffToken,
  fetchStaffWorkspace,
  getSavedStaffSession,
  onStaffWorkspaceMutated,
  setStaffAuthToken,
  type StaffWorkspaceSnapshot,
} from './lib/staffPortalService';
import {
  ackPendingStudentUpdates,
  fetchPendingStudentUpdates,
  fetchStudentPortal,
  getSavedStudentSession,
  saveStudentSession,
  syncStaffSnapshotToStudentPortal,
} from './lib/studentPortalService';
import { seedSampleSchoolData } from './lib/seedData';
import type {
  CoachingProcess,
  Diagnostic,
  GoodStatement,
  HumanisProgress,
  Observation,
  ReportRecord,
  RoleAssignment,
  StaffRole,
  StaffSession,
  Student,
  StudentPortalData,
  StudentSession,
  ThemeSetting,
  UserProfile,
} from './types/humanis';
import { LoginPage } from './components/LoginPage';
import { StudentPortal } from './components/StudentPortal';
import { GridMenuHome, type AppMenuKey } from './components/GridMenuHome';
import { DashboardView } from './components/DashboardView';
import { StudentsView } from './components/StudentsView';
import { DiagnosticView } from './components/DiagnosticView';
import { HumanisView } from './components/HumanisView';
import { ObservationsView } from './components/ObservationsView';
import { ProcessesView } from './components/ProcessesView';
import { GoodStatementsView } from './components/GoodStatementsView';
import { AIAdvisorView } from './components/AIAdvisorView';
import { ReportsView } from './components/ReportsView';
import { RoleManagementView } from './components/RoleManagementView';
import { ThemeSettingsView } from './components/ThemeSettingsView';
import { GoogleSheetsSyncView } from './components/GoogleSheetsSyncView';
import { setWorkspaceAccessToken } from './lib/googleWorkspaceService';

const MENU_TITLES: Record<AppMenuKey, string> = {
  home: 'Menu Utama',
  dashboard: 'Dashboard Analitik',
  siswa: 'Data Siswa',
  diagnostik: 'Tes Diagnostik Awal',
  humanis: 'Tahapan HUMANIS',
  kondisi: 'Kondisi Saat Ini',
  pembinaan: 'Proses Pembinaan',
  pernyataan: 'Pernyataan Baik',
  ai: 'AI Advisor (Gemini)',
  laporan: 'Laporan',
  peran: 'Manajemen Peran',
  tema: 'Kostumisasi Tema',
  spreadsheet: 'Google Sheets & Drive',
};

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin / Operator',
  wali_kelas: 'Wali Kelas',
  guru_bk: 'Guru BK',
  kepala_sekolah: 'Kepala Sekolah',
};

function hexToSoftRgba(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 'rgba(37, 99, 235, 0.12)';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

export default function App() {
  const [theme, setTheme] = useState<ThemeSetting>(() => ({
    userId: 'local',
    mode: localStorage.getItem('humanis_theme') === 'dark' ? 'dark' : 'light',
    accentColor: localStorage.getItem('humanis_accent') || '#2563EB',
    cardRadius:
      (localStorage.getItem('humanis_radius') as ThemeSetting['cardRadius']) || 'balanced',
    density: (localStorage.getItem('humanis_density') as ThemeSetting['density']) || 'comfortable',
    schoolName: localStorage.getItem('humanis_school') || 'SMK Negeri 1 Sidayu',
    academicYear: '2026/2027',
    programSubtitle: 'Implementasi Tahap HUMANIS Kemandirian Siswa SMK',
    gridColumns: Math.min(
      6,
      Math.max(2, Number(localStorage.getItem('humanis_grid_cols')) || 4)
    ),
    gridRows: Math.min(
      6,
      Math.max(2, Number(localStorage.getItem('humanis_grid_rows')) || 3)
    ),
  }));

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const pendingMetaRef = useRef<{ nip: string; role: StaffRole } | null>(null);
  const prevFirebaseUidRef = useRef<string | null>(null);

  // Admin / Staff Credential Session (persisted in localStorage for static preview mode)
  const [staffSession, setStaffSession] = useState<StaffSession | null>(() =>
    getSavedStaffSession()
  );
  const staffSessionRef = useRef<StaffSession | null>(null);
  staffSessionRef.current = staffSession;
  const [previewRole, setPreviewRole] = useState<StaffRole | null>(null);

  // Student Portal Session State (Username & Password login)
  const [studentSession, setStudentSession] = useState<StudentSession | null>(() =>
    getSavedStudentSession()
  );
  const [studentPortalData, setStudentPortalData] = useState<StudentPortalData | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);

  // Default landing screen after login is the Grid Menu ('home')
  const [activeMenu, setActiveMenu] = useState<AppMenuKey>('home');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [seeding, setSeeding] = useState(false);
  const [emblemFailed, setEmblemFailed] = useState(false);

  // Synced collections (Firestore or Server Staff Workspace)
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [humanisList, setHumanisList] = useState<HumanisProgress[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [processes, setProcesses] = useState<CoachingProcess[]>([]);
  const [statements, setStatements] = useState<GoodStatement[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);

  // Apply theme CSS variables and dark class dynamically
  useEffect(() => {
    const root = document.documentElement;
    if (theme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.setProperty('--brand-accent', theme.accentColor || '#2563EB');
    root.style.setProperty('--brand-accent-soft', hexToSoftRgba(theme.accentColor || '#2563EB'));
    const radiusPx =
      theme.cardRadius === 'compact' ? '8px' : theme.cardRadius === 'rounded' ? '18px' : '12px';
    root.style.setProperty('--ui-radius', radiusPx);

    localStorage.setItem('humanis_theme', theme.mode);
    localStorage.setItem('humanis_accent', theme.accentColor);
    localStorage.setItem('humanis_radius', theme.cardRadius);
    localStorage.setItem('humanis_density', theme.density);
    if (theme.schoolName) localStorage.setItem('humanis_school', theme.schoolName);
    localStorage.setItem('humanis_grid_cols', String(theme.gridColumns ?? 4));
    localStorage.setItem('humanis_grid_rows', String(theme.gridRows ?? 3));
  }, [theme]);

  const isEmailAdmin =
    Boolean(user?.emailVerified) && user?.email === 'alamifal@smkn1sidayu.sch.id';

  const applyWorkspaceSnapshot = useCallback((snap: StaffWorkspaceSnapshot) => {
    const sorted = [...snap.students].sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap));
    setStudents(sorted);
    setStudentsLoaded(true);
    setSelectedStudentId((prev) =>
      prev && sorted.some((s) => s.id === prev) ? prev : sorted[0]?.id || ''
    );
    setDiagnostics(snap.diagnostics);
    setHumanisList(snap.humanisList);
    setObservations(snap.observations);
    setProcesses(snap.processes);
    setStatements(snap.goodStatements);
    setReports(snap.reports);
    setRoleAssignments(snap.roleAssignments);
    if (snap.theme) {
      setTheme((prev) => ({ ...prev, ...snap.theme }));
    }
  }, []);

  // Firebase Auth listener (registered once; uses refs to avoid mid-login listener teardown)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const previousUid = prevFirebaseUidRef.current;
      prevFirebaseUidRef.current = firebaseUser?.uid || null;
      setUser(firebaseUser);
      if (firebaseUser) {
        if (staffSessionRef.current) {
          // Staff logged in via credentials connecting Google mid-session for Drive/Sheets only
          setAuthReady(true);
          return;
        }
        if (previousUid !== firebaseUser.uid) {
          setActiveMenu('home'); // Start on Grid Menu on fresh Google sign-in
        }
        const meta = pendingMetaRef.current;
        firebaseUser
          .getIdToken()
          .then((idToken) => exchangeFirebaseTokenForStaffToken(idToken, meta?.role))
          .catch(() => null);
        try {
          const prof = await getOrCreateUserProfile({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Pendidik SMK',
            email: firebaseUser.email || '',
            preferredRole: meta?.role,
            nip: meta?.nip,
          });
          const adminEmail =
            firebaseUser.emailVerified && firebaseUser.email === 'alamifal@smkn1sidayu.sch.id';
          if (meta && (meta.nip || meta.role !== prof.staffRole)) {
            const safeRole: StaffRole =
              meta.role === 'admin' && !adminEmail && prof.staffRole !== 'admin'
                ? prof.staffRole
                : meta.role;
            await updateUserProfile(firebaseUser.uid, {
              ...(meta.nip ? { nip: meta.nip } : {}),
              staffRole: safeRole,
            });
            setProfile({
              ...prof,
              ...(meta.nip ? { nip: meta.nip } : {}),
              staffRole: safeRole,
            });
          } else {
            setProfile(prof);
          }
        } catch (err) {
          console.error('Gagal memuat profil pengguna:', err);
        }
      } else {
        setWorkspaceAccessToken(null);
        setProfile(null);
        setUserProfiles([]);
        if (!staffSessionRef.current) {
          setStudentsLoaded(false);
          setStudents([]);
          setDiagnostics([]);
          setHumanisList([]);
          setObservations([]);
          setProcesses([]);
          setStatements([]);
          setReports([]);
          setRoleAssignments([]);
        }
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firestore real-time subscriptions once authenticated via Google (when not in credential staffSession)
  useEffect(() => {
    if (!authReady || !user || staffSession) return;

    const unsubs = [
      subscribeOwnedCollection<Student>('students', user.uid, isEmailAdmin, (items) => {
        const sorted = [...items].sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap));
        setStudents(sorted);
        setStudentsLoaded(true);
        setSelectedStudentId((prev) =>
          prev && sorted.some((s) => s.id === prev) ? prev : sorted[0]?.id || ''
        );
      }),
      subscribeOwnedCollection<Diagnostic>('diagnostics', user.uid, isEmailAdmin, setDiagnostics),
      subscribeOwnedCollection<HumanisProgress>('humanis', user.uid, isEmailAdmin, setHumanisList),
      subscribeOwnedCollection<Observation>('observations', user.uid, isEmailAdmin, setObservations),
      subscribeOwnedCollection<CoachingProcess>('processes', user.uid, isEmailAdmin, setProcesses),
      subscribeOwnedCollection<GoodStatement>('goodStatements', user.uid, isEmailAdmin, setStatements),
      subscribeOwnedCollection<ReportRecord>('reports', user.uid, isEmailAdmin, setReports),
      subscribeOwnedCollection<RoleAssignment>('roleAssignments', user.uid, isEmailAdmin, setRoleAssignments),
      subscribeOwnedCollection<UserProfile>('users', user.uid, isEmailAdmin, setUserProfiles),
      subscribeThemeSetting(user.uid, (savedTheme) => {
        if (savedTheme) {
          setTheme((prev) => ({ ...prev, ...savedTheme }));
        }
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, user, isEmailAdmin]);

  // Load & refresh Server Staff Workspace when logged in via Admin/Staff credentials
  useEffect(() => {
    if (!staffSession) {
      onStaffWorkspaceMutated(null);
      return;
    }

    let cancelled = false;
    const refresh = () => {
      fetchStaffWorkspace()
        .then((snap) => {
          if (!cancelled) applyWorkspaceSnapshot(snap);
        })
        .catch((err) => {
          console.error('Gagal memuat ruang kerja staf:', err);
          if (!cancelled) {
            clearSavedStaffSession();
            setStaffSession(null);
          }
        });
    };

    refresh();
    onStaffWorkspaceMutated(refresh);
    return () => {
      cancelled = true;
      onStaffWorkspaceMutated(null);
    };
  }, [staffSession, applyWorkspaceSnapshot]);

  // Hydrate saved Student Portal session if active and no Staff user
  useEffect(() => {
    if (!studentSession || studentPortalData || user || staffSession) return;
    let active = true;
    setStudentLoading(true);
    fetchStudentPortal(studentSession.token)
      .then((portal) => {
        if (active) setStudentPortalData(portal);
      })
      .catch(() => {
        if (active) {
          saveStudentSession(null);
          setStudentSession(null);
          setStudentPortalData(null);
        }
      })
      .finally(() => {
        if (active) setStudentLoading(false);
      });
    return () => {
      active = false;
    };
  }, [studentSession, studentPortalData, user, staffSession]);

  // Synchronize pending student actions & Firestore snapshot whenever Staff is authenticated via Google
  useEffect(() => {
    if (!authReady || !user || !studentsLoaded || staffSession) return;
    let cancelled = false;
    const runSync = async () => {
      try {
        const pending = await fetchPendingStudentUpdates();
        const remappedIds: Array<{ tempStudentId: string; firestoreId: string }> = [];
        const processedProfileUpdateIds: string[] = [];
        const processedAssessmentIds: string[] = [];

        for (const reg of pending.pendingRegistrations) {
          const createdId = await createStudent(user.uid, reg.student);
          remappedIds.push({ tempStudentId: reg.tempStudentId, firestoreId: createdId });
        }

        const resolveId = (sid: string) =>
          remappedIds.find((m) => m.tempStudentId === sid)?.firestoreId || sid;

        for (const profUpd of pending.pendingProfileUpdates) {
          const targetId = resolveId(profUpd.studentId);
          if (
            students.some((s) => s.id === targetId) ||
            remappedIds.some((m) => m.firestoreId === targetId)
          ) {
            await updateStudent(targetId, profUpd.updates);
            processedProfileUpdateIds.push(profUpd.id);
          }
        }

        for (const pa of pending.pendingAssessments) {
          const targetId = resolveId(pa.studentId);
          if (
            students.some((s) => s.id === targetId) ||
            remappedIds.some((m) => m.firestoreId === targetId)
          ) {
            await saveDiagnostic(user.uid, {
              ...pa.diagnostic,
              studentId: targetId,
            });
            if (pa.statement) {
              await saveGoodStatement(user.uid, {
                ...pa.statement,
                studentId: targetId,
              });
            }
            processedAssessmentIds.push(pa.id);
          }
        }

        if (
          remappedIds.length > 0 ||
          processedProfileUpdateIds.length > 0 ||
          processedAssessmentIds.length > 0
        ) {
          await ackPendingStudentUpdates({
            remappedIds,
            processedProfileUpdateIds,
            processedAssessmentIds,
          });
        }

        if (!cancelled) {
          await syncStaffSnapshotToStudentPortal({
            students,
            diagnostics,
            humanisList,
            observations,
            processes,
            statements,
          });
        }
      } catch (err) {
        console.error('Student portal sync error:', err);
      }
    };

    runSync();
    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    user,
    studentsLoaded,
    students,
    diagnostics,
    humanisList,
    observations,
    processes,
    statements,
  ]);

  const effectiveUid = staffSession?.id || user?.uid || '';
  const effectiveDisplayName =
    staffSession?.displayName || profile?.displayName || user?.displayName || 'Pendidik SMK';
  const effectiveNip = staffSession?.nip || profile?.nip || pendingMetaRef.current?.nip;
  const baseStaffRole: StaffRole =
    staffSession?.staffRole ||
    profile?.staffRole ||
    (isEmailAdmin ? 'admin' : pendingMetaRef.current?.role) ||
    'wali_kelas';
  const staffRole: StaffRole = previewRole || baseStaffRole;
  const isAdminCapable = isEmailAdmin || baseStaffRole === 'admin';

  // Effective role for views that accept Wali/BK/Kepsek (Admin has full Wali Kelas write capabilities + full monitoring)
  const effectiveModuleRole = staffRole === 'admin' ? 'wali_kelas' : staffRole;

  const handleRoleSwitch = async (nextRole: StaffRole) => {
    if (nextRole === 'admin' && !isAdminCapable) return;
    setPreviewRole(nextRole);
    if (user && profile) {
      setProfile({ ...profile, staffRole: nextRole });
      await updateUserProfile(user.uid, { staffRole: nextRole });
    }
  };

  const handlePersistTheme = async (next: ThemeSetting) => {
    setTheme(next);
    if (effectiveUid) {
      await saveThemeSetting(effectiveUid, {
        mode: next.mode,
        accentColor: next.accentColor,
        cardRadius: next.cardRadius,
        density: next.density,
        schoolName: next.schoolName,
        academicYear: next.academicYear,
        programSubtitle: next.programSubtitle,
        gridColumns: next.gridColumns ?? 4,
        gridRows: next.gridRows ?? 3,
      });
    }
  };

  const handleToggleQuickDark = async () => {
    const next: ThemeSetting = {
      ...theme,
      mode: theme.mode === 'dark' ? 'light' : 'dark',
    };
    setTheme(next);
    if (effectiveUid) {
      await saveThemeSetting(effectiveUid, {
        mode: next.mode,
        accentColor: next.accentColor,
        cardRadius: next.cardRadius,
        density: next.density,
        schoolName: next.schoolName,
        academicYear: next.academicYear,
        programSubtitle: next.programSubtitle,
        gridColumns: next.gridColumns ?? 4,
        gridRows: next.gridRows ?? 3,
      });
    }
  };

  const handleSeedDemo = async () => {
    if (!effectiveUid) return;
    setSeeding(true);
    try {
      await seedSampleSchoolData(effectiveUid, effectiveDisplayName);
    } finally {
      setSeeding(false);
    }
  };

  const handleStaffLogout = async () => {
    setWorkspaceAccessToken(null);
    if (user) {
      await signOut(auth);
    }
    setStaffSession(null);
    setPreviewRole(null);
    clearSavedStaffSession();
    setStaffAuthToken(null);
    setStudentsLoaded(false);
    setStudents([]);
    setDiagnostics([]);
    setHumanisList([]);
    setObservations([]);
    setProcesses([]);
    setStatements([]);
    setReports([]);
    setRoleAssignments([]);
    setUserProfiles([]);
  };

  if (!authReady || studentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-sm">
          <Loader2 className="w-5 h-5 animate-spin brand-text" />
          <span>Menyiapkan ruang kerja HUMANIS SMK...</span>
        </div>
      </div>
    );
  }

  if (!user && !staffSession && studentSession && studentPortalData) {
    return (
      <StudentPortal
        session={studentSession}
        portalData={studentPortalData}
        darkMode={theme.mode === 'dark'}
        schoolName={theme.schoolName}
        onToggleDark={() =>
          setTheme((prev) => ({ ...prev, mode: prev.mode === 'dark' ? 'light' : 'dark' }))
        }
        onUpdatePortalData={(nextPortal, nextSess) => {
          setStudentPortalData(nextPortal);
          if (nextSess) setStudentSession(nextSess);
        }}
        onLogout={() => {
          saveStudentSession(null);
          setStudentSession(null);
          setStudentPortalData(null);
        }}
      />
    );
  }

  if (!user && !staffSession) {
    return (
      <LoginPage
        darkMode={theme.mode === 'dark'}
        onToggleDark={() =>
          setTheme((prev) => ({ ...prev, mode: prev.mode === 'dark' ? 'light' : 'dark' }))
        }
        onSavePendingMeta={(meta) => {
          pendingMetaRef.current = meta;
        }}
        onStaffLoginSuccess={(sess) => {
          setStaffSession(sess);
          setPreviewRole(null);
          setActiveMenu('home');
        }}
        onStudentLoginSuccess={(sess, portal) => {
          setStudentSession(sess);
          setStudentPortalData(portal);
        }}
      />
    );
  }

  // Static Bottom Navbar items (5 ergonomic single-line items)
  const bottomNavItems: Array<{
    id: AppMenuKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'home', label: 'Menu', icon: LayoutGrid },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'siswa', label: 'Siswa', icon: Users },
    {
      id: staffRole === 'kepala_sekolah' ? 'laporan' : 'humanis',
      label: staffRole === 'kepala_sekolah' ? 'Laporan' : 'HUMANIS',
      icon: Compass,
    },
    {
      id: isAdminCapable ? 'peran' : 'tema',
      label: isAdminCapable ? 'Akun' : 'Tema',
      icon: isAdminCapable ? ShieldCheck : Palette,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      {/* Clean Non-Sticky Top Header */}
      <header className="no-print h-14 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {activeMenu !== 'home' ? (
            <button
              type="button"
              onClick={() => setActiveMenu('home')}
              aria-label="Kembali ke Menu Kisi"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Menu</span>
            </button>
          ) : !emblemFailed ? (
            <img
              src="/src/assets/images/humanis_emblem_1794880387572.jpg"
              alt="Logo HUMANIS"
              referrerPolicy="no-referrer"
              onError={() => setEmblemFailed(true)}
              className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg brand-bg text-white font-bold flex items-center justify-center text-sm shrink-0">
              H
            </div>
          )}

          <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
            <span className="font-display font-bold text-slate-900 dark:text-white truncate">
              {theme.schoolName || 'HUMANIS SMK'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="font-medium brand-text truncate">{MENU_TITLES[activeMenu]}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap mr-1">
            {ROLE_LABELS[staffRole]}
          </span>
          <button
            type="button"
            onClick={handleToggleQuickDark}
            aria-label="Ubah mode gelap atau terang"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {theme.mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleStaffLogout}
            aria-label="Keluar"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
        {activeMenu === 'home' && (
          <GridMenuHome
            staffName={effectiveDisplayName}
            staffRole={staffRole}
            nip={effectiveNip}
            theme={theme}
            students={students}
            onSelectMenu={(key) => setActiveMenu(key)}
            onSeedDemo={handleSeedDemo}
            seeding={seeding}
          />
        )}

        {activeMenu === 'dashboard' && (
          <DashboardView
            students={students}
            diagnostics={diagnostics}
            humanisList={humanisList}
            observations={observations}
            staffRole={effectiveModuleRole}
            onSeedDemo={handleSeedDemo}
            seeding={seeding}
            onNavigateStudent={(studentId, tab) => {
              setSelectedStudentId(studentId);
              setActiveMenu(tab);
            }}
            onNavigateMenu={(menu) => setActiveMenu(menu as AppMenuKey)}
          />
        )}

        {activeMenu === 'siswa' && (
          <StudentsView
            ownerId={effectiveUid}
            students={students}
            staffRole={effectiveModuleRole}
            onSelectForDiagnostic={(id) => {
              setSelectedStudentId(id);
              setActiveMenu('diagnostik');
            }}
            onOpenGoogleSheets={() => setActiveMenu('spreadsheet')}
          />
        )}

        {activeMenu === 'diagnostik' && (
          <DiagnosticView
            ownerId={effectiveUid}
            students={students}
            diagnostics={diagnostics}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            staffRole={effectiveModuleRole}
          />
        )}

        {activeMenu === 'humanis' && (
          <HumanisView
            ownerId={effectiveUid}
            students={students}
            humanisList={humanisList}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            staffRole={effectiveModuleRole}
          />
        )}

        {activeMenu === 'kondisi' && (
          <ObservationsView
            ownerId={effectiveUid}
            students={students}
            observations={observations}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            staffRole={effectiveModuleRole}
            observerName={effectiveDisplayName}
          />
        )}

        {activeMenu === 'pembinaan' && (
          <ProcessesView
            ownerId={effectiveUid}
            students={students}
            processes={processes}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            staffRole={effectiveModuleRole}
            staffName={effectiveDisplayName}
          />
        )}

        {activeMenu === 'pernyataan' && (
          <GoodStatementsView
            ownerId={effectiveUid}
            students={students}
            statements={statements}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            staffRole={effectiveModuleRole}
          />
        )}

        {activeMenu === 'ai' && (
          <AIAdvisorView
            ownerId={effectiveUid}
            students={students}
            diagnostics={diagnostics}
            humanisList={humanisList}
            observations={observations}
            processes={processes}
            statements={statements}
            reports={reports}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            staffName={effectiveDisplayName}
          />
        )}

        {activeMenu === 'laporan' && (
          <ReportsView
            students={students}
            diagnostics={diagnostics}
            humanisList={humanisList}
            observations={observations}
            processes={processes}
            statements={statements}
            reports={reports}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            onOpenGoogleSheets={() => setActiveMenu('spreadsheet')}
          />
        )}

        {activeMenu === 'peran' && (
          <RoleManagementView
            ownerId={effectiveUid}
            currentRole={staffRole}
            isAdminEmail={isAdminCapable}
            roleAssignments={roleAssignments}
            userProfiles={userProfiles}
            onSwitchPreviewRole={handleRoleSwitch}
          />
        )}

        {activeMenu === 'tema' && (
          <ThemeSettingsView
            theme={theme}
            onUpdateLocalTheme={setTheme}
            onPersistTheme={handlePersistTheme}
          />
        )}

        {activeMenu === 'spreadsheet' && (
          <GoogleSheetsSyncView
            ownerId={effectiveUid}
            schoolName={theme.schoolName || 'SMK Negeri 1 Sidayu'}
            staffRole={staffRole}
            students={students}
            diagnostics={diagnostics}
            humanisList={humanisList}
            observations={observations}
            processes={processes}
            statements={statements}
            reports={reports}
          />
        )}
      </main>

      {/* Static Bottom Navigation Bar (Replaces Sidebar) */}
      <nav
        aria-label="Navigasi Utama Bawah"
        className="no-print fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800"
      >
        <div className="max-w-3xl mx-auto h-full grid grid-cols-5 items-center px-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeMenu === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveMenu(item.id)}
                className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active
                    ? 'brand-text font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div
                  className={`px-3 py-1 rounded-full transition-colors ${
                    active ? 'brand-soft-bg' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] leading-none whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
