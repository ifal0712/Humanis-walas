import {
  createRoleAssignment,
  createStudent,
  saveDiagnostic,
  saveGoodStatement,
  saveHumanisProgress,
  saveObservation,
  saveProcess,
  saveReportRecord,
} from './firestoreService';
import {
  buildGuruPenggerakDemoBundles,
  buildGuruPenggerakDemoRoles,
} from './guruDemoData';

export async function seedSampleSchoolData(ownerId: string, staffName: string): Promise<number> {
  const bundles = buildGuruPenggerakDemoBundles(staffName);

  // Phase 1: Create parent student records first so Firestore exists() parent gate passes
  const createdIds: string[] = [];
  for (const bundle of bundles) {
    const studentId = await createStudent(ownerId, bundle.student);
    createdIds.push(studentId);
  }

  // Phase 2: Create all child documents (diagnostics, 7-stage HUMANIS, observations,
  // coaching logs, good statements, and Guru Penggerak action reports)
  await Promise.all(
    bundles.map(async (bundle, index) => {
      const studentId = createdIds[index];

      for (const diag of bundle.diagnostics) {
        await saveDiagnostic(ownerId, {
          ...diag,
          studentId,
        });
      }

      await saveHumanisProgress(ownerId, studentId, bundle.humanis);

      for (const ob of bundle.observations) {
        await saveObservation(ownerId, {
          ...ob,
          studentId,
        });
      }

      for (const proc of bundle.processes) {
        await saveProcess(ownerId, {
          ...proc,
          studentId,
        });
      }

      for (const stmt of bundle.statements) {
        await saveGoodStatement(ownerId, {
          ...stmt,
          studentId,
        });
      }

      await saveReportRecord(ownerId, {
        ...bundle.report,
        studentId,
      });
    })
  );

  // Phase 3: Seed sample teacher/BK/principal role matrix
  const roles = buildGuruPenggerakDemoRoles(ownerId);
  for (const roleItem of roles) {
    await createRoleAssignment(ownerId, {
      nama: roleItem.nama,
      nip: roleItem.nip,
      email: roleItem.email,
      role: roleItem.role,
      kelasBinaan: roleItem.kelasBinaan,
      aktif: roleItem.aktif,
      permissions: roleItem.permissions,
    });
  }

  return createdIds.length;
}
