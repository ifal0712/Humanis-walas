import React, { useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserPlus,
  FileSpreadsheet,
  FileDown,
  ClipboardPaste,
  Table2,
} from 'lucide-react';
import type { StaffRole, Student } from '../types/humanis';
import { createStudent, deleteStudent, updateStudent } from '../lib/firestoreService';
import { setStudentPortalCredentials } from '../lib/studentPortalService';
import {
  downloadStudentTemplateCsv,
  downloadStudentTemplateExcel,
  exportStudentsToExcel,
  parseStudentsFromExcel,
  parseStudentTemplateFile,
  parseStudentTemplateText,
  type ParsedStudentTemplateRow,
} from '../lib/exportUtils';

interface StudentsViewProps {
  ownerId: string;
  students: Student[];
  staffRole: StaffRole;
  onSelectForDiagnostic: (studentId: string) => void;
  onOpenGoogleSheets?: () => void;
}

const emptyForm = {
  nisn: '',
  namaLengkap: '',
  jenisKelamin: 'L' as 'L' | 'P',
  jurusan: 'Teknik Komputer & Jaringan',
  kelas: 'X TKJ 1',
  noHp: '',
  namaOrangTua: '',
  nomorOrangTua: '',
  alamat: '',
  portalUsername: '',
  portalPassword: '',
};

export const StudentsView: React.FC<StudentsViewProps> = ({
  ownerId,
  students,
  staffRole,
  onSelectForDiagnostic,
  onOpenGoogleSheets,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('Semua');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Template Import Modal State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateInputMode, setTemplateInputMode] = useState<'file' | 'paste'>('file');
  const [templatePasteText, setTemplatePasteText] = useState('');
  const [templateFileName, setTemplateFileName] = useState('');
  const [templateRows, setTemplateRows] = useState<ParsedStudentTemplateRow[]>([]);
  const [skipDuplicateNisn, setSkipDuplicateNisn] = useState(true);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const templateFileRef = useRef<HTMLInputElement | null>(null);

  const canEdit = staffRole === 'wali_kelas';

  const classes = useMemo(() => {
    const set = new Set(students.map((s) => s.kelas).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [students]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const matchClass = classFilter === 'Semua' || s.kelas === classFilter;
      if (!matchClass) return false;
      if (!q) return true;
      return (
        s.namaLengkap.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q) ||
        s.jurusan.toLowerCase().includes(q)
      );
    });
  }, [students, searchQuery, classFilter]);

  const openAddModal = () => {
    setEditingStudent(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (s: Student) => {
    setEditingStudent(s);
    setForm({
      nisn: s.nisn,
      namaLengkap: s.namaLengkap,
      jenisKelamin: s.jenisKelamin,
      jurusan: s.jurusan,
      kelas: s.kelas,
      noHp: s.noHp || '',
      namaOrangTua: s.namaOrangTua || '',
      nomorOrangTua: s.nomorOrangTua || '',
      alamat: s.alamat || '',
      portalUsername: s.portalUsername || s.nisn || '',
      portalPassword: '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.nisn.trim().length < 4 || form.namaLengkap.trim().length < 2) {
      setFeedback({ type: 'err', text: 'NISN (min. 4 digit) dan Nama Lengkap wajib diisi.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const { portalPassword, ...studentPayload } = form;
    const cleanUsername = (form.portalUsername || form.nisn).trim().toLowerCase();
    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, {
          ...studentPayload,
          portalUsername: cleanUsername,
        });
        await setStudentPortalCredentials({
          studentId: editingStudent.id,
          username: cleanUsername,
          password: portalPassword.trim() || undefined,
          student: { ...editingStudent, ...studentPayload, portalUsername: cleanUsername },
        });
        setFeedback({ type: 'ok', text: `Data ${form.namaLengkap} berhasil diperbarui.` });
      } else {
        const newId = await createStudent(ownerId, {
          ...studentPayload,
          portalUsername: cleanUsername,
        });
        await setStudentPortalCredentials({
          studentId: newId,
          username: cleanUsername,
          password: portalPassword.trim() || 'smk12345',
          student: { id: newId, ownerId, ...studentPayload, portalUsername: cleanUsername },
        });
        setFeedback({
          type: 'ok',
          text: `Siswa ${form.namaLengkap} berhasil ditambahkan (Username: ${cleanUsername}).`,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan data siswa.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteStudent(deleteTarget.id);
      setFeedback({ type: 'ok', text: `Data ${deleteTarget.namaLengkap} telah dihapus.` });
      setDeleteTarget(null);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus data siswa.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setFeedback(null);
    try {
      const parsedRows = await parseStudentsFromExcel(file);
      if (parsedRows.length === 0) {
        setFeedback({
          type: 'err',
          text: 'File Excel kosong atau tidak memiliki kolom NISN & Nama Lengkap.',
        });
        return;
      }
      const existingNisn = new Set(students.map((s) => s.nisn.trim()));
      const newRows = parsedRows.filter((row) => !existingNisn.has(row.nisn.trim()));
      for (const row of newRows) {
        const newId = await createStudent(ownerId, row);
        await setStudentPortalCredentials({
          studentId: newId,
          username: (row.portalUsername || row.nisn).trim().toLowerCase(),
          password: 'smk12345',
          student: { id: newId, ownerId, ...row },
        }).catch(() => {});
      }
      const skipped = parsedRows.length - newRows.length;
      setFeedback({
        type: 'ok',
        text:
          skipped > 0
            ? `${newRows.length} data siswa berhasil diimpor (${skipped} NISN duplikat dilewati).`
            : `${newRows.length} data siswa berhasil diimpor dari Excel.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal membaca file Excel.',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const existingNisnSet = useMemo(
    () => new Set(students.map((s) => s.nisn.trim())),
    [students]
  );

  const analyzedTemplateRows = useMemo(() => {
    const seenBatchNisn = new Set<string>();
    return templateRows.map((row) => {
      const cleanNisn = row.nisn.trim();
      const isExistingDup = existingNisnSet.has(cleanNisn);
      const isBatchDup = cleanNisn.length >= 4 && seenBatchNisn.has(cleanNisn);
      if (cleanNisn) seenBatchNisn.add(cleanNisn);
      const isDuplicate = isExistingDup || isBatchDup;
      return {
        ...row,
        isDuplicate,
        duplicateLabel: isExistingDup
          ? 'NISN sudah ada'
          : isBatchDup
            ? 'Duplikat di template'
            : undefined,
      };
    });
  }, [templateRows, existingNisnSet]);

  const validTemplateRowsToSave = useMemo(
    () =>
      analyzedTemplateRows.filter(
        (r) => !r.validationError && (!skipDuplicateNisn || !r.isDuplicate)
      ),
    [analyzedTemplateRows, skipDuplicateNisn]
  );

  const openTemplateModal = () => {
    setTemplateModalOpen(true);
    setTemplateInputMode('file');
    setTemplatePasteText('');
    setTemplateFileName('');
    setTemplateRows([]);
    setTemplateError(null);
    setSkipDuplicateNisn(true);
  };

  const handleTemplateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateError(null);
    setTemplateFileName(file.name);
    try {
      const parsed = await parseStudentTemplateFile(file);
      if (parsed.length === 0) {
        setTemplateError('File template tidak berisi baris data siswa.');
        setTemplateRows([]);
      } else {
        setTemplateRows(parsed);
      }
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Gagal membaca file template.');
      setTemplateRows([]);
    } finally {
      if (templateFileRef.current) templateFileRef.current.value = '';
    }
  };

  const handleParseTemplatePaste = () => {
    setTemplateError(null);
    const parsed = parseStudentTemplateText(templatePasteText);
    if (parsed.length === 0) {
      setTemplateError(
        'Data tempel kosong atau format tidak dikenali. Pastikan minimal terdapat NISN dan Nama Lengkap.'
      );
      setTemplateRows([]);
      return;
    }
    setTemplateRows(parsed);
  };

  const handleConfirmTemplateImport = async () => {
    if (validTemplateRowsToSave.length === 0) return;
    setTemplateSaving(true);
    setTemplateError(null);
    try {
      let savedCount = 0;
      for (const row of validTemplateRowsToSave) {
        const cleanUsername = (row.portalUsername || row.nisn)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '.')
          .slice(0, 60);
        const studentPayload: Omit<Student, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> = {
          nisn: row.nisn,
          namaLengkap: row.namaLengkap,
          jenisKelamin: row.jenisKelamin,
          jurusan: row.jurusan,
          kelas: row.kelas,
          noHp: row.noHp,
          namaOrangTua: row.namaOrangTua,
          nomorOrangTua: row.nomorOrangTua,
          alamat: row.alamat,
          portalUsername: cleanUsername,
          latestScore: 0,
          latestCategory: 'Sedang',
          latestCondition: 'cukup',
        };
        const newId = await createStudent(ownerId, studentPayload);
        await setStudentPortalCredentials({
          studentId: newId,
          username: cleanUsername,
          password: row.portalPassword.trim() || 'smk12345',
          student: { id: newId, ownerId, ...studentPayload },
        }).catch(() => {});
        savedCount += 1;
      }

      const skippedCount = analyzedTemplateRows.length - savedCount;
      setTemplateModalOpen(false);
      setFeedback({
        type: 'ok',
        text:
          skippedCount > 0
            ? `${savedCount} siswa berhasil ditambahkan dari template (${skippedCount} baris dilewati).`
            : `${savedCount} siswa berhasil ditambahkan dari template.`,
      });
    } catch (err) {
      setTemplateError(
        err instanceof Error ? err.message : 'Gagal menyimpan data siswa dari template.'
      );
    } finally {
      setTemplateSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Data Siswa SMK
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Kelola biodata siswa, kontak orang tua, serta impor atau ekspor spreadsheet Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportExcel}
                className="hidden"
              />
              <button
                type="button"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{importing ? 'Mengimpor...' : 'Import Excel'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => exportStudentsToExcel(filtered)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          {onOpenGoogleSheets && (
            <button
              type="button"
              onClick={onOpenGoogleSheets}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Google Sheets</span>
            </button>
          )}

          {canEdit && (
            <>
              <button
                type="button"
                onClick={openTemplateModal}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Table2 className="w-4 h-4" />
                <span>Tambah via Template</span>
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Siswa</span>
              </button>
            </>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Class Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari cepat nama siswa, NISN, kelas, atau jurusan..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
          {classes.map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => setClassFilter(cls)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                classFilter === cls
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <UserPlus className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {students.length === 0
                ? 'Belum ada data siswa tersimpan. Klik "Tambah Siswa" atau "Tambah via Template" untuk memulai.'
                : 'Tidak ada siswa yang sesuai dengan kata kunci pencarian.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">NISN</th>
                  <th className="py-3 px-4 font-medium">Nama Lengkap</th>
                  <th className="py-3 px-4 font-medium">L/P</th>
                  <th className="py-3 px-4 font-medium">Kelas &amp; Jurusan</th>
                  <th className="py-3 px-4 font-medium">Orang Tua / Kontak</th>
                  <th className="py-3 px-4 font-medium text-right">Skor</th>
                  <th className="py-3 px-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      <div>{s.nisn}</div>
                      <div className="text-[11px] text-slate-400">
                        @{s.portalUsername || s.nisn}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {s.namaLengkap}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {s.noHp || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {s.jenisKelamin}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {s.kelas}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                        {s.jurusan}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-200">
                        {s.namaOrangTua || '-'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {s.nomorOrangTua || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {s.latestScore ?? 0}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {s.latestCategory || 'Belum dites'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectForDiagnostic(s.id)}
                          className="px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors cursor-pointer"
                        >
                          Tes
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(s)}
                              aria-label={`Edit ${s.namaLengkap}`}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(s)}
                              aria-label={`Hapus ${s.namaLengkap}`}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    NISN *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nisn}
                    onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                    placeholder="0081234567"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.namaLengkap}
                    onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })}
                    placeholder="Nama lengkap siswa"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Jenis Kelamin *
                  </label>
                  <select
                    value={form.jenisKelamin}
                    onChange={(e) =>
                      setForm({ ...form, jenisKelamin: e.target.value as 'L' | 'P' })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Kelas *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.kelas}
                    onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                    placeholder="Contoh: X TKJ 1"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Jurusan / Kompetensi Keahlian *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.jurusan}
                    onChange={(e) => setForm({ ...form, jurusan: e.target.value })}
                    placeholder="Contoh: Teknik Komputer & Jaringan"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    No HP Siswa
                  </label>
                  <input
                    type="text"
                    value={form.noHp}
                    onChange={(e) => setForm({ ...form, noHp: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nama Orang Tua / Wali
                  </label>
                  <input
                    type="text"
                    value={form.namaOrangTua}
                    onChange={(e) => setForm({ ...form, namaOrangTua: e.target.value })}
                    placeholder="Nama ayah/ibu/wali"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nomor HP Orang Tua
                  </label>
                  <input
                    type="text"
                    value={form.nomorOrangTua}
                    onChange={(e) => setForm({ ...form, nomorOrangTua: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Alamat Domisili
                  </label>
                  <input
                    type="text"
                    value={form.alamat}
                    onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                    placeholder="Alamat lengkap siswa"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Username Login Siswa
                  </label>
                  <input
                    type="text"
                    value={form.portalUsername}
                    onChange={(e) => setForm({ ...form, portalUsername: e.target.value })}
                    placeholder="Default: NISN siswa"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {editingStudent ? 'Reset Password Siswa (Opsional)' : 'Password Login Siswa'}
                  </label>
                  <input
                    type="password"
                    value={form.portalPassword}
                    onChange={(e) => setForm({ ...form, portalPassword: e.target.value })}
                    placeholder={
                      editingStudent ? 'Kosongkan jika tidak diubah' : 'Default: smk12345'
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingStudent ? 'Simpan Perubahan' : 'Simpan Siswa'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Hapus Data Siswa?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Anda yakin ingin menghapus data <strong>{deleteTarget.namaLengkap}</strong> (NISN{' '}
              {deleteTarget.nisn}) dari daftar siswa?
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium cursor-pointer"
              >
                {saving ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Import Modal */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Tambah Siswa dengan Template
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Unduh template resmi, isi daftar siswa secara massal, lalu unggah file atau
                  tempel langsung baris tabel dari Excel / Google Sheets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                aria-label="Tutup modal template"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Download Template */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  1. Unduh Template &amp; Panduan Pengisian
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kolom wajib: NISN, Nama Lengkap, L/P, Kelas, Jurusan. Username &amp; password
                  portal siswa otomatis dibuatkan jika dikosongkan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadStudentTemplateExcel()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Template Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadStudentTemplateCsv()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template CSV</span>
                </button>
              </div>
            </div>

            {/* Step 2: Input Source Mode Tabs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  2. Masukkan Data Siswa dari Template
                </p>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTemplateInputMode('file')}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      templateInputMode === 'file'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateInputMode('paste')}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      templateInputMode === 'paste'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Tempel dari Excel</span>
                  </button>
                </div>
              </div>

              {templateInputMode === 'file' ? (
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center space-y-2.5 bg-slate-50/50 dark:bg-slate-950/50">
                  <input
                    ref={templateFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleTemplateFileChange}
                    className="hidden"
                  />
                  <FileSpreadsheet className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {templateFileName
                        ? `File dimuat: ${templateFileName}`
                        : 'Pilih file template Excel (.xlsx / .xls) atau CSV'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Data akan diperiksa dan ditampilkan pada pratinjau sebelum disimpan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => templateFileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{templateFileName ? 'Pilih File Lain' : 'Pilih File Template'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <textarea
                    rows={5}
                    value={templatePasteText}
                    onChange={(e) => setTemplatePasteText(e.target.value)}
                    placeholder={
                      'Tempel (Ctrl+V) baris data dari Excel / Google Sheets (dengan atau tanpa baris header):\n0085123001\tAndi Wijaya\tL\tX TKJ 1\tTeknik Komputer & Jaringan\n0085123002\tRina Kusuma\tP\tXI RPL 1\tRekayasa Perangkat Lunak'
                    }
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleParseTemplatePaste}
                      disabled={!templatePasteText.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      <span>Proses Data Tempel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {templateError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{templateError}</span>
              </div>
            )}

            {/* Step 3: Preview Table */}
            {analyzedTemplateRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    Pratinjau: <strong className="tabular-nums">{analyzedTemplateRows.length}</strong>{' '}
                    baris terbaca ·{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                      {validTemplateRowsToSave.length} siap disimpan
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipDuplicateNisn}
                      onChange={(e) => setSkipDuplicateNisn(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span>Lewati NISN duplikat secara otomatis</span>
                  </label>
                </div>

                <div className="max-h-64 overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2 px-3 font-medium">NISN</th>
                        <th className="py-2 px-3 font-medium">Nama Lengkap</th>
                        <th className="py-2 px-3 font-medium">L/P</th>
                        <th className="py-2 px-3 font-medium">Kelas &amp; Jurusan</th>
                        <th className="py-2 px-3 font-medium">Status</th>
                        <th className="py-2 px-3 font-medium text-right">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {analyzedTemplateRows.map((row, idx) => {
                        const willSkip =
                          Boolean(row.validationError) ||
                          (skipDuplicateNisn && row.isDuplicate);
                        return (
                          <tr
                            key={`${row.rowNumber}-${row.nisn}-${idx}`}
                            className={
                              willSkip
                                ? 'bg-slate-50/70 dark:bg-slate-900/40 opacity-65'
                                : 'bg-white dark:bg-slate-900'
                            }
                          >
                            <td className="py-2 px-3 font-mono whitespace-nowrap">
                              {row.nisn || '-'}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                              {row.namaLengkap || '-'}
                            </td>
                            <td className="py-2 px-3">{row.jenisKelamin}</td>
                            <td className="py-2 px-3">
                              <div>{row.kelas}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                {row.jurusan}
                              </div>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {row.validationError ? (
                                <span className="text-rose-600 dark:text-rose-400 font-medium">
                                  {row.validationError}
                                </span>
                              ) : row.isDuplicate ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  {row.duplicateLabel}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  Siap disimpan
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                aria-label={`Hapus baris ${row.namaLengkap}`}
                                onClick={() =>
                                  setTemplateRows((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={templateSaving || validTemplateRowsToSave.length === 0}
                onClick={handleConfirmTemplateImport}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium cursor-pointer"
              >
                {templateSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {templateSaving
                    ? 'Menyimpan...'
                    : `Simpan ${validTemplateRowsToSave.length} Siswa`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
