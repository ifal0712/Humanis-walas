/**
 * Phase 0 Security Rules Verification Spec — HUMANIS SMK
 * Covers the "Dirty Dozen" adversarial payloads against firestore.rules.
 */
export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: '1. Shadow Field Injection on Student',
    collection: 'students',
    op: 'create',
    payload: {
      ownerId: 'uid_teacher_1',
      nisn: '0081234567',
      namaLengkap: 'Fajar Pratama',
      jenisKelamin: 'L',
      jurusan: 'TKJ',
      kelas: 'X TKJ 1',
      isAdmin: true // Ghost field -> rejected by hasOnly
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '2. Identity Spoofing on Student Create',
    collection: 'students',
    op: 'create',
    authUid: 'uid_teacher_1',
    payload: {
      ownerId: 'uid_teacher_2', // Mismatch with auth.uid
      nisn: '0081234567',
      namaLengkap: 'Fajar Pratama',
      jenisKelamin: 'L',
      jurusan: 'TKJ',
      kelas: 'X TKJ 1'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '3. Unverified Email Write',
    collection: 'students',
    op: 'create',
    auth: { uid: 'uid_1', email_verified: false },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '4. Email Spoofing Admin Bypass',
    collection: 'students',
    op: 'list',
    auth: { uid: 'uid_attacker', email: 'alamifal@smkn1sidayu.sch.id', email_verified: false },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '5. Orphaned Diagnostic Record',
    collection: 'diagnostics',
    op: 'create',
    payload: { studentId: 'non_existent_999', ownerId: 'uid_teacher_1' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '6. Cross-Tenant Parent Hijack',
    collection: 'observations',
    op: 'create',
    authUid: 'uid_teacher_2',
    payload: { studentId: 'student_owned_by_teacher_1', ownerId: 'uid_teacher_2' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '7. PII Blanket List Read',
    collection: 'users',
    op: 'list',
    authUid: 'uid_teacher_1',
    query: 'unfiltered collection(users)',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '8. Resource Exhaustion / 1MB String Poisoning',
    collection: 'students',
    op: 'create',
    payload: { namaLengkap: 'A'.repeat(5000) },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '9. Immutable Field Mutation',
    collection: 'students',
    op: 'update',
    payload: { ownerId: 'uid_hijacker' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '10. Client Timestamp Forgery',
    collection: 'students',
    op: 'create',
    payload: { createdAt: new Date('2020-01-01T00:00:00Z') },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '11. Array Type Poisoning',
    collection: 'humanis',
    op: 'create',
    payload: { completedStages: [123, 456, 789, 10, 11, 12, 13, 14] },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '12. Blanket Unauthenticated Access',
    collection: 'students',
    op: 'get',
    auth: null,
    expected: 'PERMISSION_DENIED'
  }
];
