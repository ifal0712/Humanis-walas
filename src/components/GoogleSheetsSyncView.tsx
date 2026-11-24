import React, { useCallback, useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  FolderOpen,
  RefreshCw,
  Plus,
  ExternalLink,
  UploadCloud,
  DownloadCloud,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ShieldAlert,
} from 'lucide-react';
import type {
  CoachingProcess,
  Diagnostic,
  GoodStatement,
  HumanisProgress,
  Observation,
  ReportRecord,
  StaffRole,
  Student,
} from '../types/humanis';
import {
  connectGoogleWorkspace,
  createHumanisSpreadsheetInDrive,
  deleteDriveSpreadsheet,
  ensureHumanisDriveFolder,
  getConnectedGoogleEmail,
  getSpreadsheetMetadata,
  getWorkspaceAccessToken,
  HUMANIS_DRIVE_FOLDER_NAME,
  listAppSpreadsheets,
  previewStudentsFromSpreadsheet,
  syncAllDataToSpreadsheet,
  WorkspaceAuthError,
  type DriveFolderInfo,
  type DriveSpreadsheetFile,
  type ImportedStudentRow,
  type SpreadsheetTabInfo,
} from '../lib/googleWorkspaceService';
import { createStudent } from '../lib/firestoreService';

interface GoogleSheetsSyncViewProps {
  ownerId: string;
  schoolName: string;
  staffRole: StaffRole;
  students: Student[];
  diagnostics: Diagnostic[];
  humanisList: HumanisProgress[];
  observations: Observation[];
  processes: CoachingProcess[];
  statements: GoodStatement[];
  reports: ReportRecord[];
}

export const GoogleSheetsSyncView: React.FC<GoogleSheetsSyncViewProps> = ({
  ownerId,
  schoolName,
  staffRole,
  students,
  diagnostics,
  humanisList,
  observations,
  processes,
  statements,
  reports,
}) => {
  const [hasToken, setHasToken] = useState(() => Boolean(getWorkspaceAccessToken()));
  const [googleEmail, setGoogleEmail] = useState<string | null>(() => getConnectedGoogleEmail());
  const [authBusy, setAuthBusy] = useState(false);

  const [folderInfo, setFolderInfo] = useState<DriveFolderInfo | null>(null);
  const [files, setFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [newTitle, setNewTitle] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return `Database HUMANIS ${schoolName || 'SMK'} (${today})`;
  });
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Explicit Confirmation Modals (Required before modifying/deleting user Drive files)
  const [confirmSyncTarget, setConfirmSyncTarget] = useState<DriveSpreadsheetFile | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<DriveSpreadsheetFile | null>(null);

  // Import state
  const [importFileId, setImportFileId] = useState<string>('');
  const [importTabs, setImportTabs] = useState<SpreadsheetTabInfo[]>([]);
  const [importTabTitle, setImportTabTitle] = useState<string>('');
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportedStudentRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importingStudents, setImportingStudents] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
    linkUrl?: string;
    linkLabel?: string;
  } | null>(null);

  const canWriteApp = staffRole === 'admin' || staffRole === 'wali_kelas';

  const handleWorkspaceError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof WorkspaceAuthError) {
      setHasToken(false);
      setFeedback({ type: 'err', text: err.message });
      return;
    }
    setFeedback({
      type: 'err',
      text: err instanceof Error ? err.message : fallback,
    });
  }, []);

  const refreshDriveData = useCallback(async () => {
    if (!getWorkspaceAccessToken()) {
      setHasToken(false);
      return;
    }
    setLoadingFiles(true);
    try {
      const [folder, list] = await Promise.all([
        ensureHumanisDriveFolder(),
        listAppSpreadsheets(),
      ]);
      setFolderInfo(folder);
      setFiles(list);
      setHasToken(true);
      setGoogleEmail(getConnectedGoogleEmail());
      if (list.length > 0 && !importFileId) {
        setImportFileId(list[0].id);
      }
    } catch (err) {
      handleWorkspaceError(err, 'Gagal memuat daftar Spreadsheet dari Google Drive.');
    } finally {
      setLoadingFiles(false);
    }
  }, [handleWorkspaceError, importFileId]);

  useEffect(() => {
    if (getWorkspaceAccessToken()) {
      refreshDriveData();
    }
  }, [refreshDriveData]);

  // Fetch tab metadata dynamically whenever user picks a spreadsheet to import
  useEffect(() => {
    if (!hasToken || !importFileId) {
      setImportTabs([]);
      setImportTabTitle('');
      setPreviewRows([]);
      return;
    }
    let cancelled = false;
    setLoadingTabs(true);
    setPreviewRows([]);
    getSpreadsheetMetadata(importFileId)
      .then((meta) => {
        if (cancelled) return;
        setImportTabs(meta.sheets);
        const preferred =
          meta.sheets.find((s) => s.title.toLowerCase().includes('siswa')) || meta.sheets[0];
        setImportTabTitle(preferred?.title || '');
      })
      .catch((err) => {
        if (!cancelled) handleWorkspaceError(err, 'Gagal membaca tab spreadsheet.');
      })
      .finally(() => {
        if (!cancelled) setLoadingTabs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasToken, importFileId, handleWorkspaceError]);

  const handleConnectGoogle = async () => {
    setAuthBusy(true);
    setFeedback(null);
    try {
      const res = await connectGoogleWorkspace();
      setHasToken(true);
      setGoogleEmail(res.email);
      setFeedback({
        type: 'ok',
        text: `Akun Google ${res.email || res.displayName} terhubung dengan Google Sheets & Drive.`,
      });
      await refreshDriveData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghubungkan akun Google.';
      setFeedback({
        type: 'err',
        text: msg.includes('popup-closed-by-user')
          ? 'Jendela otorisasi Google ditutup sebelum selesai.'
          : msg,
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setFeedback(null);
    try {
      const result = await createHumanisSpreadsheetInDrive({
        title: newTitle.trim(),
        datasets: {
          students,
          diagnostics,
          humanisList,
          observations,
          processes,
          statements,
          reports,
        },
      });
      setFolderInfo(result.folder);
      setFeedback({
        type: 'ok',
        text: `Spreadsheet "${result.title}" berhasil dibuat di folder Google Drive "${result.folder.name}" dengan 7 tab data.`,
        linkUrl: result.webViewLink,
        linkLabel: 'Buka Spreadsheet',
      });
      const updated = await listAppSpreadsheets();
      setFiles(updated);
      setImportFileId(result.spreadsheetId);
    } catch (err) {
      handleWorkspaceError(err, 'Gagal membuat Spreadsheet di Google Drive.');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmSyncOverwrite = async () => {
    if (!confirmSyncTarget) return;
    const target = confirmSyncTarget;
    setSyncingId(target.id);
    setFeedback(null);
    try {
      const res = await syncAllDataToSpreadsheet({
        spreadsheetId: target.id,
        datasets: {
          students,
          diagnostics,
          humanisList,
          observations,
          processes,
          statements,
          reports,
        },
      });
      setConfirmSyncTarget(null);
      setFeedback({
        type: 'ok',
        text: `Data terbaru (${students.length} siswa & seluruh catatan HUMANIS) berhasil disinkronkan ke "${res.title}".`,
        linkUrl: res.spreadsheetUrl,
        linkLabel: 'Lihat di Google Sheets',
      });
      await refreshDriveData();
    } catch (err) {
      setConfirmSyncTarget(null);
      handleWorkspaceError(err, 'Gagal menyinkronkan data ke Google Sheets.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleConfirmDeleteSpreadsheet = async () => {
    if (!confirmDeleteTarget) return;
    const target = confirmDeleteTarget;
    setDeletingId(target.id);
    setFeedback(null);
    try {
      await deleteDriveSpreadsheet(target.id);
      setConfirmDeleteTarget(null);
      setFiles((prev) => prev.filter((f) => f.id !== target.id));
      if (importFileId === target.id) {
        setImportFileId('');
      }
      setFeedback({
        type: 'ok',
        text: `Spreadsheet "${target.name}" telah dihapus dari Google Drive.`,
      });
    } catch (err) {
      setConfirmDeleteTarget(null);
      handleWorkspaceError(err, 'Gagal menghapus Spreadsheet dari Google Drive.');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePreviewImport = async () => {
    if (!importFileId || !importTabTitle) return;
    setLoadingPreview(true);
    setFeedback(null);
    try {
      const rows = await previewStudentsFromSpreadsheet(importFileId, importTabTitle);
      setPreviewRows(rows);
      if (rows.length === 0) {
        setFeedback({
          type: 'err',
          text: `Tidak ada baris data siswa ditemukan di tab "${importTabTitle}".`,
        });
      }
    } catch (err) {
      handleWorkspaceError(err, 'Gagal membaca baris data siswa dari Spreadsheet.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const existingNisnSet = new Set(students.map((s) => s.nisn.trim()));
  const newRowsToImport = previewRows.filter((r) => !existingNisnSet.has(r.nisn.trim()));

  const handleImportNewStudents = async () => {
    if (!canWriteApp || newRowsToImport.length === 0) return;
    setImportingStudents(true);
    setFeedback(null);
    try {
      for (const row of newRowsToImport) {
        await createStudent(ownerId, row);
      }
      setFeedback({
        type: 'ok',
        text: `${newRowsToImport.length} siswa baru berhasil diimpor dari Google Sheets ke aplikasi.`,
      });
      setPreviewRows([]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengimpor siswa ke database.',
      });
    } finally {
      setImportingStudents(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Integrasi Google Sheets &amp; Google Drive
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Ekspor langsung seluruh data siswa, diagnostik, tahapan HUMANIS, observasi, dan laporan ke
            Google Spreadsheet di Google Drive Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {folderInfo?.webViewLink && (
            <a
              href={folderInfo.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap"
            >
              <FolderOpen className="w-4 h-4 brand-text" />
              <span>Buka Folder Drive</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>
          )}

          {hasToken && (
            <button
              type="button"
              disabled={loadingFiles}
              onClick={refreshDriveData}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
              <span>Muat Ulang Drive</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {feedback.linkUrl && (
              <a
                href={feedback.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-semibold whitespace-nowrap"
              >
                <span>{feedback.linkLabel || 'Buka Tautan'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Tutup pesan"
              className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* OAuth Connection Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium">
            <FileSpreadsheet className="w-4 h-4 brand-text" />
            <span className={hasToken ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
              {hasToken
                ? `Terhubung ke Google Drive & Sheets${googleEmail ? ` (${googleEmail})` : ''}`
                : 'Otorisasi Google Drive & Sheets diperlukan'}
            </span>
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {hasToken
              ? `Folder Tujuan: ${folderInfo?.name || HUMANIS_DRIVE_FOLDER_NAME}`
              : 'Hubungkan Akun Google Anda'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            {hasToken
              ? 'Aplikasi hanya mengakses folder dan file Spreadsheet yang dibuat melalui HUMANIS SMK. Token akses disimpan aman sementara di memori sesi browser.'
              : 'Klik tombol Sign in with Google untuk memberi izin pembuatan Spreadsheet dan penyimpanan otomatis ke Google Drive sekolah Anda.'}
          </p>
        </div>

        <button
          type="button"
          disabled={authBusy}
          onClick={handleConnectGoogle}
          className="inline-flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          {authBusy ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
          ) : (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.2 8.9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.7c-.2-.8-.4-1.7-.4-2.7s.1-1.9.4-2.7L1.6 6.4C.6 8.1 0 10 0 12s.6 3.9 1.6 5.6l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.9C3.5 20.4 7.4 23 12 23z"
              />
            </svg>
          )}
          <span>{hasToken ? 'Ganti / Hubungkan Ulang Google' : 'Sign in with Google'}</span>
        </button>
      </div>

      {hasToken && (
        <>
          {/* Section 1: Create New Spreadsheet directly inside Google Drive */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  1. Buat Spreadsheet Baru Langsung ke Google Drive
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Membuat file Google Sheets dengan 7 tab terstruktur di dalam folder{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {HUMANIS_DRIVE_FOLDER_NAME}
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Dataset Readiness Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: 'Data Siswa', count: students.length },
                { label: 'Diagnostik', count: diagnostics.length },
                { label: 'HUMANIS', count: humanisList.length },
                { label: 'Observasi', count: observations.length },
                { label: 'Pembinaan', count: processes.length },
                { label: 'Pernyataan', count: statements.length },
                { label: 'Laporan AI', count: reports.length },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {stat.label}
                  </p>
                  <p className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                    {stat.count}
                  </p>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleCreateSpreadsheet}
              className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
            >
              <div className="flex-1 space-y-1">
                <label
                  htmlFor="new-sheet-title"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Nama File Google Spreadsheet
                </label>
                <input
                  id="new-sheet-title"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Database HUMANIS SMK 2026"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg brand-bg hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>{creating ? 'Membuat di Drive...' : 'Buat & Simpan ke Drive'}</span>
              </button>
            </form>
          </div>

          {/* Section 2: Existing Spreadsheets in Google Drive & Sync */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  2. Daftar Spreadsheet HUMANIS di Google Drive ({files.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pilih file untuk dibuka langsung, diperbarui dengan data terbaru, atau dihapus.
                </p>
              </div>
            </div>

            {loadingFiles ? (
              <div className="p-8 flex items-center justify-center gap-2.5 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin brand-text" />
                <span>Memuat daftar Spreadsheet dari Google Drive...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Belum ada file Google Spreadsheet yang dibuat oleh aplikasi ini di Google Drive Anda.
                Gunakan formulir di atas untuk membuat Spreadsheet pertama Anda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-5 font-medium">Nama Spreadsheet</th>
                      <th className="py-3 px-4 font-medium">Terakhir Diubah</th>
                      <th className="py-3 px-5 font-medium text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {files.map((file) => (
                      <tr
                        key={file.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-medium text-slate-900 dark:text-white">
                              {file.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                          {file.modifiedTime
                            ? new Date(file.modifiedTime).toLocaleString('id-ID', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : '-'}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <span>Buka</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              disabled={syncingId === file.id}
                              onClick={() => setConfirmSyncTarget(file)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg brand-soft-bg brand-text text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
                            >
                              {syncingId === file.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UploadCloud className="w-3.5 h-3.5" />
                              )}
                              <span>Sinkronkan Data</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setImportFileId(file.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <DownloadCloud className="w-3.5 h-3.5" />
                              <span>Pilih Impor</span>
                            </button>

                            <button
                              type="button"
                              disabled={deletingId === file.id}
                              onClick={() => setConfirmDeleteTarget(file)}
                              aria-label={`Hapus ${file.name}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Import Students from Google Sheets */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ui-card-radius p-6 space-y-5">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                3. Impor Data Siswa dari Google Sheets ke Aplikasi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Baca daftar tab langsung dari Spreadsheet Google Drive lalu tambahkan siswa baru yang
                belum terdaftar berdasarkan NISN.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Pilih Spreadsheet Sumber
                </label>
                <select
                  value={importFileId}
                  onChange={(e) => setImportFileId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Pilih file Spreadsheet --</option>
                  {files.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Pilih Nama Tab Sheet
                </label>
                <select
                  value={importTabTitle}
                  disabled={loadingTabs || importTabs.length === 0}
                  onChange={(e) => setImportTabTitle(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                >
                  {loadingTabs ? (
                    <option value="">Memuat daftar tab...</option>
                  ) : importTabs.length === 0 ? (
                    <option value="">-- Belum ada tab --</option>
                  ) : (
                    importTabs.map((t) => (
                      <option key={t.sheetId} value={t.title}>
                        {t.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <button
                type="button"
                disabled={!importFileId || !importTabTitle || loadingPreview}
                onClick={handlePreviewImport}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {loadingPreview ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DownloadCloud className="w-4 h-4" />
                )}
                <span>{loadingPreview ? 'Membaca Sheet...' : 'Pratinjau Data Siswa'}</span>
              </button>
            </div>

            {previewRows.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Ditemukan <strong>{previewRows.length}</strong> baris siswa (
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {newRowsToImport.length} siswa baru
                    </strong>
                    , {previewRows.length - newRowsToImport.length} sudah ada berdasarkan NISN).
                  </p>
                  {canWriteApp && newRowsToImport.length > 0 && (
                    <button
                      type="button"
                      disabled={importingStudents}
                      onClick={handleImportNewStudents}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg brand-bg text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                    >
                      {importingStudents ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>
                        {importingStudents
                          ? 'Mengimpor...'
                          : `Impor ${newRowsToImport.length} Siswa Baru`}
                      </span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto max-h-64 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 sticky top-0">
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2 px-3 font-medium">NISN</th>
                        <th className="py-2 px-3 font-medium">Nama Lengkap</th>
                        <th className="py-2 px-3 font-medium">Kelas</th>
                        <th className="py-2 px-3 font-medium">Jurusan</th>
                        <th className="py-2 px-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewRows.map((row) => {
                        const exists = existingNisnSet.has(row.nisn.trim());
                        return (
                          <tr key={row.nisn}>
                            <td className="py-2 px-3 font-mono tabular-nums">{row.nisn}</td>
                            <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                              {row.namaLengkap}
                            </td>
                            <td className="py-2 px-3">{row.kelas}</td>
                            <td className="py-2 px-3">{row.jurusan}</td>
                            <td className="py-2 px-3">
                              <span
                                className={
                                  exists
                                    ? 'text-slate-400 dark:text-slate-500'
                                    : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                }
                              >
                                {exists ? 'Sudah terdaftar' : 'Baru (Siap impor)'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Explicit Confirmation Modal: Sync/Overwrite Existing Spreadsheet */}
      {confirmSyncTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Perbarui Isi Spreadsheet?
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Tindakan ini akan menimpa ulang 7 tab data (Data Siswa, Diagnostik, HUMANIS,
                  Observasi, Pembinaan, Pernyataan Baik, Laporan AI) di file{' '}
                  <strong>{confirmSyncTarget.name}</strong> dengan {students.length} data siswa
                  terbaru dari aplikasi.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={Boolean(syncingId)}
                onClick={() => setConfirmSyncTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(syncingId)}
                onClick={handleConfirmSyncOverwrite}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg brand-bg text-white font-medium cursor-pointer disabled:opacity-60"
              >
                {syncingId && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{syncingId ? 'Menyinkronkan...' : 'Ya, Perbarui Spreadsheet'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal: Delete Spreadsheet from Google Drive */}
      {confirmDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Hapus Spreadsheet dari Google Drive?
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Anda yakin ingin menghapus file <strong>{confirmDeleteTarget.name}</strong> secara
                  permanen dari Google Drive Anda?
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleConfirmDeleteSpreadsheet}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium cursor-pointer disabled:opacity-60"
              >
                {deletingId && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{deletingId ? 'Menghapus...' : 'Ya, Hapus dari Drive'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
