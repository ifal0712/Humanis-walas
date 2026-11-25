import type { HumanisStageKey, IndependenceCategory } from '../types/humanis';

export type RubricAspectKey =
  | 'tanggungJawab'
  | 'disiplin'
  | 'inisiatif'
  | 'pengambilanKeputusan'
  | 'manajemenDiri';

export interface RubricIndicator {
  id: string;
  code: string;
  aspect: RubricAspectKey;
  title: string;
  contextSmk: string;
  levels: Record<1 | 2 | 3 | 4 | 5, string>;
}

export interface RubricAspectDef {
  key: RubricAspectKey;
  label: string;
  shortLabel: string;
  weightPercent: number;
  description: string;
  humanisFocus: HumanisStageKey;
  coachingTip: string;
}

export const RUBRIC_LEVEL_META: Record<
  1 | 2 | 3 | 4 | 5,
  {
    score: 1 | 2 | 3 | 4 | 5;
    label: string;
    shortLabel: string;
    badgeClass: string;
    activeClass: string;
  }
> = {
  1: {
    score: 1,
    label: 'Skor 1 · Perlu Bimbingan Intensif',
    shortLabel: '1 · Intensif',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    activeClass: 'bg-rose-600 border-rose-600 text-white',
  },
  2: {
    score: 2,
    label: 'Skor 2 · Mulai Berkembang',
    shortLabel: '2 · Mulai',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
    activeClass: 'bg-orange-600 border-orange-600 text-white',
  },
  3: {
    score: 3,
    label: 'Skor 3 · Cukup Mandiri',
    shortLabel: '3 · Cukup',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    activeClass: 'bg-amber-600 border-amber-600 text-white',
  },
  4: {
    score: 4,
    label: 'Skor 4 · Mandiri',
    shortLabel: '4 · Mandiri',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    activeClass: 'bg-blue-600 border-blue-600 text-white',
  },
  5: {
    score: 5,
    label: 'Skor 5 · Sangat Mandiri & Teladan',
    shortLabel: '5 · Teladan',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    activeClass: 'bg-emerald-600 border-emerald-600 text-white',
  },
};

export const RUBRIC_ASPECTS: RubricAspectDef[] = [
  {
    key: 'tanggungJawab',
    label: 'Tanggung Jawab',
    shortLabel: 'Tanggung Jawab',
    weightPercent: 20,
    description:
      'Ketuntasan tugas teori & praktik kejuruan, keberanian mengakui dan memperbaiki kesalahan, serta perawatan alat kerja.',
    humanisFocus: 'N',
    coachingTip:
      'Berikan target proyek bertahap dengan daftar periksa (checklist) tertulis dan refleksi tanggung jawab harian (Tahap N - Nurturing).',
  },
  {
    key: 'disiplin',
    label: 'Disiplin',
    shortLabel: 'Disiplin',
    weightPercent: 20,
    description:
      'Ketepatan hadir di kelas/bengkel, kepatuhan tata tertib dan standar K3 industri, serta konsistensi fokus selama praktik.',
    humanisFocus: 'M',
    coachingTip:
      'Lakukan kesepakatan kelas positif, keteladanan kedisiplinan guru, dan pemantauan kehadiran mingguan (Tahap M - Modeling).',
  },
  {
    key: 'inisiatif',
    label: 'Inisiatif',
    shortLabel: 'Inisiatif',
    weightPercent: 20,
    description:
      'Kemauan mencari solusi awal saat menemui kendala teknis, eksplorasi sumber belajar tambahan, dan keaktifan dalam tim.',
    humanisFocus: 'U',
    coachingTip:
      'Terapkan coaching berbasis pertanyaan pemantik (alur TIRTA) sebelum memberi solusi langsung (Tahap U - Understanding).',
  },
  {
    key: 'pengambilanKeputusan',
    label: 'Pengambilan Keputusan',
    shortLabel: 'Keputusan',
    weightPercent: 20,
    description:
      'Kemampuan menyusun skala prioritas kerja, menimbang risiko keselamatan/etika, dan ketegasan memilih sikap positif.',
    humanisFocus: 'I',
    coachingTip:
      'Latih analisis opsi dan konsekuensi melalui studi kasus dunia kerja/PKL dan jurnal refleksi (Tahap I - Internalization).',
  },
  {
    key: 'manajemenDiri',
    label: 'Manajemen Diri',
    shortLabel: 'Manajemen Diri',
    weightPercent: 20,
    description:
      'Pengaturan jadwal belajar mandiri, regulasi emosi saat tertekan, serta kebiasaan evaluasi dan perbaikan diri berkelanjutan.',
    humanisFocus: 'S',
    coachingTip:
      'Bangun teknik jeda sadar (STOP), penjadwalan mingguan bersama siswa, dan sinergi pendampingan orang tua (Tahap S - Synergy).',
  },
];

export const RUBRIC_INDICATORS: RubricIndicator[] = [
  // 1. Tanggung Jawab
  {
    id: 'tj_1',
    code: 'TJ-1',
    aspect: 'tanggungJawab',
    title: 'Penyelesaian Tugas & Jobsheet Praktik Kejuruan',
    contextSmk: 'Ketuntasan LKPD, jobsheet bengkel/lab, dan laporan praktik tepat tenggat.',
    levels: {
      1: 'Sering menunda atau tidak menuntaskan tugas/jobsheet meski telah diberi pengingat berulang.',
      2: 'Menyelesaikan tugas hanya jika didampingi secara langsung dan diingatkan beberapa kali oleh guru.',
      3: 'Menuntaskan tugas rutin sesuai jadwal, namun sesekali perlu pengingat pada tugas proyek kompleks.',
      4: 'Menyelesaikan seluruh tugas teori maupun praktik tepat waktu dengan hasil rapi tanpa diingatkan.',
      5: 'Menuntaskan pekerjaan sebelum tenggat, mengecek ulang mutu hasil, dan siap membantu rekan yang tertinggal.',
    },
  },
  {
    id: 'tj_2',
    code: 'TJ-2',
    aspect: 'tanggungJawab',
    title: 'Akuntabilitas Kesalahan & Komitmen Perbaikan',
    contextSmk: 'Sikap saat hasil kerja praktik keliru, telat, atau belum sesuai standar mutu.',
    levels: {
      1: 'Cenderung menyalahkan keadaan atau rekan saat terjadi kesalahan kerja maupun keterlambatan.',
      2: 'Mengakui kekeliruan setelah dikonfrontasi, tetapi belum menunjukkan usaha memperbaiki hasilnya.',
      3: 'Mengakui kesalahan dan bersedia memperbaiki pekerjaan setelah diberi arahan langkah revisi.',
      4: 'Terbuka mengakui kekurangan, langsung melakukan revisi mandiri, dan mencatat pelajaran perbaikan.',
      5: 'Menjadikan evaluasi kesalahan sebagai standar perbaikan kerja diri dan pencegahan risiko bagi kelompok.',
    },
  },
  {
    id: 'tj_3',
    code: 'TJ-3',
    aspect: 'tanggungJawab',
    title: 'Perawatan Alat, Bahan & Area Kerja (Budaya 5R)',
    contextSmk: 'Tanggung jawab menjaga peralatan lab/bengkel serta kerapian area praktik.',
    levels: {
      1: 'Meninggalkan alat atau meja praktik berantakan dan sering lalai menjaga kelengkapan inventaris.',
      2: 'Merapikan peralatan kerja hanya apabila diperiksa langsung oleh guru atau teknisi bengkel.',
      3: 'Mengembalikan alat sesuai daftar pinjam meskipun penataan area kerja masih perlu dirapikan.',
      4: 'Konsisten membersihkan, merawat, dan mengembalikan alat kerja sesuai prosedur operasional standar.',
      5: 'Memastikan area kerja pribadi maupun tim tertib menerapkan budaya 5R industri tanpa diminta.',
    },
  },

  // 2. Disiplin
  {
    id: 'ds_1',
    code: 'DS-1',
    aspect: 'disiplin',
    title: 'Ketepatan Waktu & Kehadiran Pembelajaran',
    contextSmk: 'Kedisiplinan hadir di kelas, apel jurusan, bengkel praktik, atau tempat PKL.',
    levels: {
      1: 'Sering datang terlambat atau absen tanpa keterangan yang jelas sehingga tertinggal materi inti.',
      2: 'Masih terlambat 2–3 kali dalam sebulan dan memerlukan pemantauan rutin kedisiplinan pagi.',
      3: 'Hadir tepat waktu pada mayoritas jadwal, sesekali terlambat karena kendala teknis tertentu.',
      4: 'Konsisten hadir tepat waktu dan siap mengikuti pembelajaran maupun praktik sejak menit awal.',
      5: 'Selalu hadir lebih awal, menyiapkan perangkat kerja mandiri, dan memberi teladan ketertiban kelas.',
    },
  },
  {
    id: 'ds_2',
    code: 'DS-2',
    aspect: 'disiplin',
    title: 'Kepatuhan Tata Tertib & Standar K3 Bengkel/Lab',
    contextSmk: 'Penggunaan wearpack/APD, etika seragam, serta kepatuhan SOP keselamatan kerja.',
    levels: {
      1: 'Kerap mengabaikan atribut praktik, APD, dan aturan dasar keselamatan kerja di lingkungan sekolah.',
      2: 'Memakai perlengkapan praktik dan mematuhi SOP hanya ketika ditegur atau diawasi langsung.',
      3: 'Mematuhi tata tertib sekolah serta SOP K3 standar selama kegiatan praktik berlangsung.',
      4: 'Disiplin menerapkan tata tertib dan seluruh prosedur keselamatan kerja secara konsisten.',
      5: 'Menjadikan budaya K3 dan etika profesi sebagai kebiasaan melekat serta mengingatkan rekan sebaya.',
    },
  },
  {
    id: 'ds_3',
    code: 'DS-3',
    aspect: 'disiplin',
    title: 'Ketekunan & Konsistensi Fokus Selama Belajar',
    contextSmk: 'Pengendalian distraksi gawai dan konsistensi menuntaskan sesi pembelajaran.',
    levels: {
      1: 'Mudah teralihkan oleh gawai/obrolan dan sering berhenti mengerjakan sebelum sesi selesai.',
      2: 'Fokus bertahan singkat dan perlu berkali-kali diarahkan agar kembali pada lembar kerja.',
      3: 'Mengikuti alur pembelajaran dengan cukup tertib meski konsentrasi terkadang menurun di akhir sesi.',
      4: 'Menjaga fokus, ketekunan, dan ritme kerja yang stabil dari awal hingga penutupan kegiatan.',
      5: 'Mempertahankan konsentrasi optimal, menuntaskan target sesi, dan mengevaluasi mutu capaian sendiri.',
    },
  },

  // 3. Inisiatif
  {
    id: 'in_1',
    code: 'IN-1',
    aspect: 'inisiatif',
    title: 'Upaya Pemecahan Masalah Awal Sebelum Bertanya',
    contextSmk: 'Sikap menghadapi troubleshooting teknis atau kebuntuan soal/proyek.',
    levels: {
      1: 'Langsung berhenti bekerja saat menemui hambatan ringan dan menunggu jawaban jadi dari guru.',
      2: 'Mencoba sebentar lalu mudah menyerah jika tidak dibantu langkah demi langkah.',
      3: 'Mencoba memeriksa panduan/modul dasar terlebih dahulu sebelum meminta bantuan pembimbing.',
      4: 'Proaktif menganalisis sumber kendala dan menguji beberapa alternatif solusi secara mandiri.',
      5: 'Menemukan solusi kreatif secara mandiri, mendokumentasikan langkahnya, dan membagikan ke teman.',
    },
  },
  {
    id: 'in_2',
    code: 'IN-2',
    aspect: 'inisiatif',
    title: 'Eksplorasi Sumber Belajar & Pengayaan Kompetensi',
    contextSmk: 'Kemauan memperdalam keterampilan kejuruan di luar materi minimum kelas.',
    levels: {
      1: 'Hanya bergantung pada penjelasan lisan di kelas dan enggan membaca modul maupun referensi.',
      2: 'Membuka sumber belajar tambahan sebatas apabila diwajibkan menjadi komponen nilai tugas.',
      3: 'Sesekali menelusuri referensi video atau artikel teknis ketika mengerjakan proyek khusus.',
      4: 'Rutin memperkaya diri lewat dokumentasi industri, latihan mandiri, dan referensi terbaru.',
      5: 'Proaktif membangun portofolio karya kejuruan, mengikuti uji kompetensi, atau proyek kolaboratif.',
    },
  },
  {
    id: 'in_3',
    code: 'IN-3',
    aspect: 'inisiatif',
    title: 'Kontribusi Aktif dalam Kolaborasi Tim',
    contextSmk: 'Peran serta saat kerja kelompok, proyek P5, atau unit produksi jurusan.',
    levels: {
      1: 'Pasif menunggu pembagian tugas dan jarang menyumbangkan ide dalam diskusi kelompok.',
      2: 'Bersedia mengerjakan porsi kecil apabila ditunjuk langsung oleh ketua kelompok atau guru.',
      3: 'Menjalankan bagian tugas masing-masing sesuai kesepakatan awal tim tanpa banyak kendala.',
      4: 'Proaktif mengambil tanggung jawab yang diperlukan tim serta ringan tangan membantu rekan.',
      5: 'Menggerakkan koordinasi tim secara inklusif, menghargai pendapat rekan, dan menjaga target bersama.',
    },
  },

  // 4. Pengambilan Keputusan
  {
    id: 'pk_1',
    code: 'PK-1',
    aspect: 'pengambilanKeputusan',
    title: 'Penentuan Skala Prioritas Pekerjaan',
    contextSmk: 'Kemampuan memilih urutan kerja berdasarkan urgensi, tenggat, dan bobot tugas.',
    levels: {
      1: 'Kesulitan menentukan urutan kerja sehingga tugas penting sering terbengkalai hingga tenggat.',
      2: 'Cenderung memilih aktivitas termudah terlebih dahulu tanpa menimbang jadwal pengumpulan.',
      3: 'Mampu menyusun urutan prioritas bila dibantu kerangka daftar periksa dari guru/wali kelas.',
      4: 'Terampil memilah pekerjaan mendesak dan penting serta menuntaskannya secara sistematis.',
      5: 'Merancang strategi prioritas jangka pendek–menengah secara matang lengkap dengan rencana cadangan.',
    },
  },
  {
    id: 'pk_2',
    code: 'PK-2',
    aspect: 'pengambilanKeputusan',
    title: 'Pertimbangan Risiko Teknis & Konsekuensi Kerja',
    contextSmk: 'Ketelitian menimbang dampak keselamatan, biaya bahan, dan mutu sebelum eksekusi.',
    levels: {
      1: 'Bertindak tergesa-gesa tanpa memperhitungkan potensi kerusakan alat, bahan, atau keselamatan.',
      2: 'Baru menyadari risiko keputusan setelah ditegur atau sesudah pekerjaan mengalami kesalahan.',
      3: 'Mempertimbangkan risiko yang umum dan terlihat pada tugas praktik rutin sehari-hari.',
      4: 'Menimbang aspek teknis, ketepatan waktu, dan keselamatan kerja sebelum mengambil tindakan.',
      5: 'Menganalisis berbagai opsi langkah secara objektif, memilih solusi teraman, dan siap bertanggung jawab.',
    },
  },
  {
    id: 'pk_3',
    code: 'PK-3',
    aspect: 'pengambilanKeputusan',
    title: 'Ketegasan Memilih Sikap Positif di Lingkungan Sebaya',
    contextSmk: 'Kemandirian bersikap agar tidak terbawa ajakan negatif atau pelanggaran aturan.',
    levels: {
      1: 'Mudah terbawa arus pergaulan kurang baik tanpa mempertimbangkan aturan maupun masa depan.',
      2: 'Masih sering ragu dan bergantung penuh pada keputusan kelompok teman terdekat.',
      3: 'Mampu menolak ajakan yang jelas melanggar aturan meski sesekali masih bimbang.',
      4: 'Teguh menentukan sikap positif dan etis walaupun berbeda pilihan dengan sebagian teman.',
      5: 'Menjadi penyeimbang bijak di komunitas kelas dengan menyampaikan alasan santun dan konstruktif.',
    },
  },

  // 5. Manajemen Diri
  {
    id: 'md_1',
    code: 'MD-1',
    aspect: 'manajemenDiri',
    title: 'Perencanaan Jadwal Belajar & Keseimbangan Harian',
    contextSmk: 'Pengelolaan waktu sekolah, praktik, istirahat, dan penggunaan gawai.',
    levels: {
      1: 'Belum memiliki rutinitas harian teratur; waktu belajar, istirahat, dan gawai sering tidak terkendali.',
      2: 'Pernah menyusun jadwal belajar, tetapi jarang konsisten dijalankan lebih dari beberapa hari.',
      3: 'Menjalankan jadwal belajar dengan cukup teratur khususnya menjelang ujian atau pengumpulan proyek.',
      4: 'Memiliki agenda harian seimbang antara tugas sekolah, latihan kejuruan, dan istirahat.',
      5: 'Konsisten mengelola kalender target mingguan secara disiplin dan mengevaluasi ketercapaiannya.',
    },
  },
  {
    id: 'md_2',
    code: 'MD-2',
    aspect: 'manajemenDiri',
    title: 'Regulasi Emosi & Ketahanan Saat Menghadapi Tekanan',
    contextSmk: 'Pengendalian diri (KSE) saat menerima kritik, revisi berulang, atau tenggat padat.',
    levels: {
      1: 'Mudah panik, tersinggung, atau menarik diri ketika menghadapi kritik maupun beban tugas.',
      2: 'Emosi masih labil dan membutuhkan waktu lama untuk kembali fokus setelah mengalami kegagalan.',
      3: 'Mampu menahan luapan emosi dasar walau motivasi belajar terkadang menurun saat tertekan.',
      4: 'Terampil menenangkan diri (teknik jeda/STOP), menerima umpan balik positif, dan lanjut berkarya.',
      5: 'Tetap tenang, solutif, dan menjaga komunikasi empatik bahkan dalam situasi praktik bertekanan.',
    },
  },
  {
    id: 'md_3',
    code: 'MD-3',
    aspect: 'manajemenDiri',
    title: 'Refleksi Diri & Tindak Lanjut Pengembangan Pribadi',
    contextSmk: 'Kesadaran mengevaluasi capaian diri serta menyusun langkah perbaikan periodik.',
    levels: {
      1: 'Belum terbiasa merefleksikan capaian maupun mengenali kebiasaan yang perlu diperbaiki.',
      2: 'Melakukan refleksi terbatas hanya apabila diminta mengisi lembar evaluasi bimbingan.',
      3: 'Dapat mengidentifikasi kekuatan dan hambatan pribadi secara umum bersama wali kelas.',
      4: 'Rutin melakukan evaluasi diri dan menetapkan target perbaikan konkret setiap periode.',
      5: 'Proaktif meminta umpan balik bermakna dan mengeksekusi rencana pengembangan diri berkelanjutan.',
    },
  },
];

export const INDEPENDENCE_CLASSIFICATION_GUIDE: Array<{
  range: string;
  category: IndependenceCategory;
  meaning: string;
  action: string;
}> = [
  {
    range: '0 – 35',
    category: 'Sangat Rendah',
    meaning: 'Memerlukan struktur dan pendampingan intensif di hampir seluruh aspek kemandirian.',
    action: 'Coaching individual mingguan, kontrak perilaku harian, dan komunikasi erat dengan orang tua.',
  },
  {
    range: '36 – 51',
    category: 'Rendah',
    meaning: 'Mulai menunjukkan pemahaman dasar, namun masih sangat bergantung pada pengingat guru.',
    action: 'Pendampingan rutin melalui Tahap H–U–M, penjadwalan sederhana, dan target jangka pendek.',
  },
  {
    range: '52 – 67',
    category: 'Sedang',
    meaning: 'Kemandirian mulai terbentuk secara bertahap meski belum merata di semua situasi praktik.',
    action: 'Penguatan pembiasaan (Tahap N), checklist prioritas mandiri, dan apresiasi progres kecil.',
  },
  {
    range: '68 – 83',
    category: 'Baik',
    meaning: 'Mandiri dalam belajar, mematuhi SOP kerja, dan mampu mengelola keputusan serta emosi.',
    action: 'Berikan tantangan proyek kejuruan bermakna dan ruang refleksi internalisasi nilai (Tahap I).',
  },
  {
    range: '84 – 100',
    category: 'Sangat Baik',
    meaning: 'Sangat mandiri, konsisten menjadi teladan 5R & K3, serta siap memimpin kolaborasi sebaya.',
    action: 'Libatkan sebagai tutor sebaya / pemimpin proyek dan perluas proyeksi karier atau PKL unggulan.',
  },
];

export function classifyRubricScore(totalScore: number): IndependenceCategory {
  if (totalScore < 36) return 'Sangat Rendah';
  if (totalScore < 52) return 'Rendah';
  if (totalScore < 68) return 'Sedang';
  if (totalScore < 84) return 'Baik';
  return 'Sangat Baik';
}

export function getDefaultRubricSelections(initialValue: 1 | 2 | 3 | 4 | 5 = 3): Record<string, 1 | 2 | 3 | 4 | 5> {
  const map: Record<string, 1 | 2 | 3 | 4 | 5> = {};
  RUBRIC_INDICATORS.forEach((ind) => {
    map[ind.id] = initialValue;
  });
  return map;
}

export interface ComputedRubricSummary {
  aspectScores: Record<RubricAspectKey, number>;
  totalScore: number;
  category: IndependenceCategory;
  ratedCount: number;
  totalIndicators: number;
  strongestAspect: RubricAspectDef;
  weakestAspect: RubricAspectDef;
  weakestIndicators: Array<{ indicator: RubricIndicator; score: number }>;
  autoNotesSummary: string;
}

export function computeRubricSummary(
  selections: Record<string, number>
): ComputedRubricSummary {
  const aspectScores: Record<RubricAspectKey, number> = {
    tanggungJawab: 3,
    disiplin: 3,
    inisiatif: 3,
    pengambilanKeputusan: 3,
    manajemenDiri: 3,
  };

  let ratedCount = 0;
  for (const aspect of RUBRIC_ASPECTS) {
    const inds = RUBRIC_INDICATORS.filter((i) => i.aspect === aspect.key);
    let sum = 0;
    let count = 0;
    for (const ind of inds) {
      const val = selections[ind.id];
      if (typeof val === 'number' && val >= 1 && val <= 5) {
        sum += val;
        count += 1;
        ratedCount += 1;
      }
    }
    aspectScores[aspect.key] = count > 0 ? Number((sum / count).toFixed(2)) : 3;
  }

  const avgAspect =
    (aspectScores.tanggungJawab +
      aspectScores.disiplin +
      aspectScores.inisiatif +
      aspectScores.pengambilanKeputusan +
      aspectScores.manajemenDiri) /
    5;
  const totalScore = Math.round((avgAspect / 5) * 100);
  const category = classifyRubricScore(totalScore);

  const sortedAspects = [...RUBRIC_ASPECTS].sort(
    (a, b) => aspectScores[a.key] - aspectScores[b.key]
  );
  const weakestAspect = sortedAspects[0];
  const strongestAspect = sortedAspects[sortedAspects.length - 1];

  const weakestIndicators = RUBRIC_INDICATORS.map((indicator) => ({
    indicator,
    score: selections[indicator.id] || 3,
  }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const autoNotesSummary =
    `[Rubrik Lengkap] Unggul: ${strongestAspect.label} (${aspectScores[strongestAspect.key]}/5). ` +
    `Fokus Pembinaan: ${weakestAspect.label} (${aspectScores[weakestAspect.key]}/5, Tahap ${weakestAspect.humanisFocus}).`;

  return {
    aspectScores,
    totalScore,
    category,
    ratedCount,
    totalIndicators: RUBRIC_INDICATORS.length,
    strongestAspect,
    weakestAspect,
    weakestIndicators,
    autoNotesSummary,
  };
}
