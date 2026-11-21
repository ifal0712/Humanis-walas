# Security Specification — HUMANIS SMK Firestore Rules

## 1. Data Invariants
1. Every document in `users` is strictly isolated to its owner UID (`request.auth.uid == userId`) or the verified bootstrapped school admin (`alamifal@smkn1sidayu.sch.id`).
2. Every student record (`students/{studentId}`) must be owned by an authenticated, email-verified educator (`ownerId == request.auth.uid`) and enforce bounded string sizes on PII fields (`noHp`, `nomorOrangTua`, `alamat`).
3. Every child record (`diagnostics`, `humanis`, `observations`, `processes`, `goodStatements`) must reference an existing `studentId` whose parent document exists in `/students/{studentId}` and shares the same `ownerId` (or admin), preventing orphaned records.
4. `ownerId` and `createdAt` are immutable after document creation (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
5. All `createdAt` and `updatedAt` timestamps must equal `request.time` (enforcing server timestamp integrity).
6. All `list` queries enforce `resource.data.ownerId == request.auth.uid || isEmailAdmin()` without calling `get()` or `exists()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Student**: Creating a student with extra `"isAdmin": true` ghost field -> MUST FAIL (`hasOnly` check).
2. **Identity Spoofing on Student Create**: Creating a student where `ownerId` != `request.auth.uid` -> MUST FAIL.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting any write -> MUST FAIL.
4. **Email Spoofing Admin Bypass**: Token with `email: "alamifal@smkn1sidayu.sch.id"` and `email_verified: false` -> MUST FAIL.
5. **Orphaned Diagnostic Record**: Creating a diagnostic with non-existent `studentId: "ghost_999"` -> MUST FAIL (`exists()` check).
6. **Cross-Tenant Parent Hijack**: Creating an observation referencing another teacher's `studentId` -> MUST FAIL.
7. **PII Blanket List Read**: Non-admin user calling `list` on `users` or `students` without `ownerId == request.auth.uid` -> MUST FAIL.
8. **Resource Exhaustion / 1MB String Poisoning**: Sending a 5,000-character string into `namaLengkap` or `studentId` -> MUST FAIL (`.size()` checks + `isValidId()`).
9. **Immutable Field Mutation**: Updating `ownerId` or `createdAt` on an existing `student` -> MUST FAIL.
10. **Client Timestamp Forgery**: Sending a backdated `createdAt` instead of `request.time` -> MUST FAIL.
11. **Array Type Poisoning**: Sending `[123, 456]` instead of `string[]` in `completedStages` or `saranTindakan`, or exceeding max array length -> MUST FAIL.
12. **Blanket Unauthenticated Access**: Unauthenticated read or write on any collection -> MUST FAIL (global catch-all deny).
