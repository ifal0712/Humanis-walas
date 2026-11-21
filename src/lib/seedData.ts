import {
  createStudent,
  saveDiagnostic,
  saveHumanisProgress,
  saveObservation,
  saveProcess,
  saveGoodStatement,
} from './firestoreService';
import type { HumanisStageKey } from '../types/humanis';

export async function seedSampleSchoolData(ownerId: string, staffName: string): Promise<number> {
  const sampleStudents = [
    {
      nisn: '0084129001',
      namaLengkap: 'Fajar Pratama',
      jenisKelamin: 'L' as const,
      jurusan: 'Teknik Komputer & Jaringan',
      kelas: 'X TKJ 1',
      noHp: '081234560001',
      namaOrangTua: 'Budi Pratama',
      nomorOrangTua: '081234569901',
      alamat: 'Jl. Pendidikan No. 14, Sidayu',
      latestScore: 72,
      latestCategory: 'Baik' as const,
      latestCondition: 'cukup' as const,
      diag: { tj: 3.5, ds: 3.5, in: 4.5, pk: 3.5, md: 3.0, score: 72, cat: 'Baik' as const, notes: 'Inisiatif praktik jaringan tinggi, manajemen jadwal tugas masih perlu pembiasaan.' },
      stages: ['H', 'U', 'M', 'A'] as HumanisStageKey[],
      obs: [
        { tanggal: '2026-08-12', skor: 58, level: 'perlu_pendampingan' as const, ak: 'Sering menunda laporan praktikum', so: 'Aktif diskusi kelompok', em: 'Cukup stabil namun mudah teralihkan' },
        { tanggal: '2026-09-18', skor: 65, level: 'cukup' as const, ak: 'Mulai mengumpulkan tugas tepat waktu', so: 'Kooperatif dengan teman sebangku', em: 'Lebih tenang saat presentasi' },
        { tanggal: '2026-10-22', skor: 72, level: 'cukup' as const, ak: 'Proyek konfigurasi Mikrotik tuntas mandiri', so: 'Membantu teman saat lab', em: 'Percaya diri meningkat' },
      ],
      proc: { tanggal: '2026-10-24', tahap: 'A' as HumanisStageKey, tindakan: 'Memberikan apresiasi tertulis dan peran asisten lab jaringan atas ketuntasan modul.', hasil: 'Siswa lebih antusias menyiapkan checklist kerja mingguan.' },
      stmt: 'Saya akan membuat jadwal belajar mandiri setiap malam pukul 19.30 agar tidak menunda tugas.',
    },
    {
      nisn: '0084129002',
      namaLengkap: 'Siti Nurhaliza',
      jenisKelamin: 'P' as const,
      jurusan: 'Rekayasa Perangkat Lunak',
      kelas: 'XI RPL 1',
      noHp: '081234560002',
      namaOrangTua: 'Hasan Basri',
      nomorOrangTua: '081234569902',
      alamat: 'Jl. Merdeka No. 28, Gresik',
      latestScore: 88,
      latestCategory: 'Sangat Baik' as const,
      latestCondition: 'baik' as const,
      diag: { tj: 4.5, ds: 4.5, in: 4.5, pk: 4.0, md: 4.5, score: 88, cat: 'Sangat Baik' as const, notes: 'Sangat konsisten menyelesaikan proyek web sebelum tenggat.' },
      stages: ['H', 'U', 'M', 'A', 'N', 'I', 'S'] as HumanisStageKey[],
      obs: [
        { tanggal: '2026-08-15', skor: 78, level: 'baik' as const, ak: 'Konsisten menyelesaikan tugas pemrograman', so: 'Menjadi tutor sebaya di kelas', em: 'Stabil dan fokus' },
        { tanggal: '2026-09-20', skor: 84, level: 'baik' as const, ak: 'Aktif riset dokumentasi secara mandiri', so: 'Kepemimpinan kelompok baik', em: 'Sangat positif' },
        { tanggal: '2026-10-25', skor: 88, level: 'baik' as const, ak: 'Menjadi perwakilan lomba LKS Web', so: 'Komunikasi efektif dengan guru', em: 'Tangguh menghadapi tekanan' },
      ],
      proc: { tanggal: '2026-10-26', tahap: 'S' as HumanisStageKey, tindakan: 'Koordinasi dengan orang tua untuk mendukung persiapan magang industri semester depan.', hasil: 'Orang tua berkomitmen memfasilitasi jam latihan proyek di rumah.' },
      stmt: 'Saya ingin menyelesaikan proyek portofolio aplikasi tanpa menunggu diingatkan guru.',
    },
    {
      nisn: '0084129003',
      namaLengkap: 'Bagus Santoso',
      jenisKelamin: 'L' as const,
      jurusan: 'Teknik Komputer & Jaringan',
      kelas: 'X TKJ 1',
      noHp: '081234560003',
      namaOrangTua: 'Slamet Riyadi',
      nomorOrangTua: '081234569903',
      alamat: 'Dusun Krajan RT 02 RW 01, Bungah',
      latestScore: 44,
      latestCategory: 'Rendah' as const,
      latestCondition: 'perlu_pendampingan' as const,
      diag: { tj: 2.0, ds: 2.0, in: 2.5, pk: 2.5, md: 2.0, score: 44, cat: 'Rendah' as const, notes: 'Sering terlambat dan belum memiliki target belajar mandiri.' },
      stages: ['H', 'U'] as HumanisStageKey[],
      obs: [
        { tanggal: '2026-08-18', skor: 48, level: 'perlu_pendampingan' as const, ak: 'Tiga tugas praktik belum dikumpulkan', so: 'Cenderung pasif di kelas', em: 'Mudah cemas saat ditanya' },
        { tanggal: '2026-09-22', skor: 45, level: 'perlu_pendampingan' as const, ak: 'Terlambat 2 kali dalam seminggu', so: 'Mulai terbuka pada guru BK', em: 'Butuh penguatan motivasi' },
        { tanggal: '2026-10-28', skor: 44, level: 'perlu_pendampingan' as const, ak: 'Masih perlu pendampingan menyusun prioritas', so: 'Nyaman bekerja berpasangan', em: 'Cukup kooperatif saat sesi empatik' },
      ],
      proc: { tanggal: '2026-10-29', tahap: 'U' as HumanisStageKey, tindakan: 'Konseling empatik 1-on-1 mengenai pentingnya kedisiplinan kerja di industri IT.', hasil: 'Siswa menyadari dampak kebiasaan menunda dan menyepakati target harian kecil.' },
      stmt: 'Saya ingin lebih bertanggung jawab dan berusaha berangkat sekolah lebih pagi.',
    },
    {
      nisn: '0084129004',
      namaLengkap: 'Dewi Kartika',
      jenisKelamin: 'P' as const,
      jurusan: 'Teknik Komputer & Jaringan',
      kelas: 'X TKJ 1',
      noHp: '081234560004',
      namaOrangTua: 'Suyanto',
      nomorOrangTua: '081234569904',
      alamat: 'Jl. Raya Dukun No. 9, Gresik',
      latestScore: 64,
      latestCategory: 'Sedang' as const,
      latestCondition: 'cukup' as const,
      diag: { tj: 3.0, ds: 4.0, in: 3.0, pk: 3.0, md: 3.0, score: 64, cat: 'Sedang' as const, notes: 'Disiplin kehadiran sangat baik, namun ragu mengambil keputusan teknis.' },
      stages: ['H', 'U', 'M', 'A', 'N'] as HumanisStageKey[],
      obs: [
        { tanggal: '2026-08-20', skor: 56, level: 'cukup' as const, ak: 'Tertib mencatat namun jarang bertanya', so: 'Rukun dengan semua teman', em: 'Tenang namun kurang percaya diri' },
        { tanggal: '2026-09-24', skor: 60, level: 'cukup' as const, ak: 'Mulai berani presentasi hasil lab', so: 'Aktif dalam piket kelas', em: 'Lebih ekspresif' },
        { tanggal: '2026-10-29', skor: 64, level: 'cukup' as const, ak: 'Mandiri mengerjakan soal evaluasi', so: 'Menunjukkan kepedulian sosial', em: 'Stabil' },
      ],
      proc: { tanggal: '2026-10-30', tahap: 'N' as HumanisStageKey, tindakan: 'Menugaskan peran ketua kelompok kecil bergiliran untuk melatih pengambilan keputusan.', hasil: 'Mulai berani membagi tugas rekan satu tim.' },
      stmt: 'Saya akan belajar mengambil keputusan lebih cepat tanpa takut salah.',
    },
    {
      nisn: '0084129005',
      namaLengkap: 'Rizky Ramadhan',
      jenisKelamin: 'L' as const,
      jurusan: 'Teknik Kendaraan Ringan',
      kelas: 'XII TKR 1',
      noHp: '081234560005',
      namaOrangTua: 'Mulyono',
      nomorOrangTua: '081234569905',
      alamat: 'Jl. Pelabuhan No. 41, Ujungpangkah',
      latestScore: 52,
      latestCategory: 'Sedang' as const,
      latestCondition: 'perlu_pendampingan' as const,
      diag: { tj: 2.5, ds: 2.5, in: 3.0, pk: 2.5, md: 2.5, score: 52, cat: 'Sedang' as const, notes: 'Terampil di bengkel otomotif tetapi manajemen waktu istirahat & tugas lemah.' },
      stages: ['H', 'U', 'M'] as HumanisStageKey[],
      obs: [
        { tanggal: '2026-08-22', skor: 50, level: 'perlu_pendampingan' as const, ak: 'Praktik bengkel bagus, teori tertinggal', so: 'Supel dengan teman jurusan', em: 'Sering lelah di jam siang' },
        { tanggal: '2026-09-26', skor: 51, level: 'perlu_pendampingan' as const, ak: 'Memerlukan pengingat untuk jurnal PKL', so: 'Aktif membantu peralatan bengkel', em: 'Stabil' },
        { tanggal: '2026-10-30', skor: 52, level: 'perlu_pendampingan' as const, ak: 'Mulai menyicil laporan PKL', so: 'Sopan terhadap instruktur', em: 'Termotivasi saat diberi target jelas' },
      ],
      proc: { tanggal: '2026-11-01', tahap: 'M' as HumanisStageKey, tindakan: 'Menunjukkan contoh logbook teknisi profesional dan simulasi manajemen waktu bengkel.', hasil: 'Siswa meniru format checklist perawatan alat.' },
      stmt: 'Saya ingin mengatur waktu antara praktik bengkel dan laporan sekolah dengan lebih disiplin.',
    },
    {
      nisn: '0084129006',
      namaLengkap: 'Nadia Putri',
      jenisKelamin: 'P' as const,
      jurusan: 'Rekayasa Perangkat Lunak',
      kelas: 'XI RPL 1',
      noHp: '081234560006',
      namaOrangTua: 'Ahmad Fauzi',
      nomorOrangTua: '081234569906',
      alamat: 'Perum Griya Indah Blok B-5, Gresik',
      latestScore: 82,
      latestCategory: 'Sangat Baik' as const,
      latestCondition: 'baik' as const,
      diag: { tj: 4.0, ds: 4.5, in: 4.0, pk: 4.0, md: 4.0, score: 82, cat: 'Sangat Baik' as const, notes: 'Mandiri dalam mencari sumber belajar tambahan dan teladan disiplin kelas.' },
      stages: ['H', 'U', 'M', 'A', 'N', 'I'] as HumanisStageKey[],
      obs: [
        { tanggal: '2026-08-19', skor: 74, level: 'baik' as const, ak: 'Menyelesaikan modul basis data lebih cepat', so: 'Membantu koordinasi tugas kelompok', em: 'Tenang dan terstruktur' },
        { tanggal: '2026-09-25', skor: 79, level: 'baik' as const, ak: 'Inisiatif membuat catatan ringkas kelas', so: 'Dipercaya teman sebagai koordinator', em: 'Positif' },
        { tanggal: '2026-10-27', skor: 82, level: 'baik' as const, ak: 'Konsisten reflektif tiap pekan', so: 'Komunikasi sangat baik', em: 'Matang dan mandiri' },
      ],
      proc: { tanggal: '2026-10-31', tahap: 'I' as HumanisStageKey, tindakan: 'Memfasilitasi jurnal refleksi nilai kemandirian akhir bulan.', hasil: 'Siswa mampu mengevaluasi kemajuan dirinya secara objektif.' },
      stmt: 'Saya akan terus menjaga konsistensi belajar mandiri agar siap menghadapi uji kompetensi.',
    },
  ];

  // Phase 1: Create parent student records first so Firestore exists() parent gate passes
  const createdIds: string[] = [];
  for (const item of sampleStudents) {
    const studentId = await createStudent(ownerId, {
      nisn: item.nisn,
      namaLengkap: item.namaLengkap,
      jenisKelamin: item.jenisKelamin,
      jurusan: item.jurusan,
      kelas: item.kelas,
      noHp: item.noHp,
      namaOrangTua: item.namaOrangTua,
      nomorOrangTua: item.nomorOrangTua,
      alamat: item.alamat,
      latestScore: item.latestScore,
      latestCategory: item.latestCategory,
      latestCondition: item.latestCondition,
    });
    createdIds.push(studentId);
  }

  // Phase 2: Create child documents referencing committed studentIds
  await Promise.all(
    sampleStudents.map(async (item, index) => {
      const studentId = createdIds[index];
      await saveDiagnostic(ownerId, {
        studentId,
        studentName: item.namaLengkap,
        kelas: item.kelas,
        tanggungJawab: item.diag.tj,
        disiplin: item.diag.ds,
        inisiatif: item.diag.in,
        pengambilanKeputusan: item.diag.pk,
        manajemenDiri: item.diag.md,
        totalScore: item.diag.score,
        category: item.diag.cat,
        assessedDate: '2026-08-10',
        notes: item.diag.notes,
      });

      await saveHumanisProgress(ownerId, studentId, {
        studentName: item.namaLengkap,
        kelas: item.kelas,
        completedStages: item.stages,
        hMinat: `${item.jurusan} dan pengembangan proyek terapan`,
        hBakat: 'Ketekunan praktik bengkel/laboratorium',
        hCitaCita: 'Teknisi / Engineer profesional siap kerja',
        hKeunggulan: 'Antusias saat praktik langsung',
        uPemahamanKerja: 'Memahami standar kedisiplinan industri DUDI',
        uKesadaranMandiri: 'Menyadari kemandirian menentukan kesiapan PKL',
        uCatatanDiskusi: 'Diskusi klasikal dan refleksi tujuan karier',
        mKeteladananGuru: 'Guru memberi contoh checklist kerja tepat waktu',
        mResponSiswa: 'Siswa mengikuti pola pencatatan harian',
        aProgresDicapai: 'Peningkatan inisiatif menyelesaikan tugas mandiri',
        aBentukApresiasi: 'Pujian spesifik & catatan progres positif',
        aTanggal: '2026-10-15',
        nKebiasaanPositif: 'Menyusun prioritas kerja 10 menit sebelum praktik',
        nTugasKemandirian: 'Proyek individu mingguan terukur',
        iNilaiTertanam: 'Tanggung jawab & integritas kerja',
        iRefleksiSiswa: item.stmt,
        sPeranOrangTua: 'Memantau jam belajar dan istirahat di rumah',
        sPeranGuru: 'Coaching mingguan dan umpan balik terstruktur',
        sTindakLanjut: 'Evaluasi berkala akhir bulan bersama orang tua',
      });

      for (const ob of item.obs) {
        await saveObservation(ownerId, {
          studentId,
          studentName: item.namaLengkap,
          kelas: item.kelas,
          tanggal: ob.tanggal,
          kondisiAkademik: ob.ak,
          kondisiSosial: ob.so,
          kondisiEmosional: ob.em,
          tingkatKemandirian: ob.level,
          skorKemandirian: ob.skor,
          observerName: staffName,
        });
      }

      await saveProcess(ownerId, {
        studentId,
        studentName: item.namaLengkap,
        kelas: item.kelas,
        tanggal: item.proc.tanggal,
        tindakan: item.proc.tindakan,
        tahapHumanis: item.proc.tahap,
        hasilSementara: item.proc.hasil,
        petugasRole: 'wali_kelas',
        petugasNama: staffName,
      });

      await saveGoodStatement(ownerId, {
        studentId,
        studentName: item.namaLengkap,
        kelas: item.kelas,
        kalimat: item.stmt,
        sumber: 'manual',
        tanggal: '2026-10-30',
      });
    })
  );

  return createdIds.length;
}
