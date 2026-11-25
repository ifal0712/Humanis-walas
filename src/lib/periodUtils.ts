import type { ConditionLevel } from '../types/humanis';

export type AssessmentPeriodMonths = 0 | 3 | 6 | 12;
export type ReportPeriodFilter = 'all' | 3 | 6 | 12;

export const ASSESSMENT_PERIOD_OPTIONS: Array<{
  value: AssessmentPeriodMonths;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: 0,
    label: 'Diagnostik Awal',
    shortLabel: 'Awal',
    description: 'Pemetaan awal sebelum atau di awal pendampingan',
  },
  {
    value: 3,
    label: 'Periodik 3 Bulan',
    shortLabel: '3 Bulan',
    description: 'Evaluasi perkembangan kemandirian per triwulan (3 bulan)',
  },
  {
    value: 6,
    label: 'Periodik 6 Bulan',
    shortLabel: '6 Bulan',
    description: 'Evaluasi tengah tahun / semester (6 bulan)',
  },
  {
    value: 12,
    label: 'Periodik 12 Bulan',
    shortLabel: '12 Bulan',
    description: 'Evaluasi komprehensif tahunan (12 bulan)',
  },
];

export const REPORT_PERIOD_OPTIONS: Array<{
  value: ReportPeriodFilter;
  label: string;
  shortLabel: string;
}> = [
  { value: 'all', label: 'Semua Periode', shortLabel: 'Semua' },
  { value: 3, label: 'Rentang 3 Bulan', shortLabel: '3 Bulan' },
  { value: 6, label: 'Rentang 6 Bulan', shortLabel: '6 Bulan' },
  { value: 12, label: 'Rentang 12 Bulan', shortLabel: '12 Bulan' },
];

export function getAssessmentPeriodLabel(periodMonths?: number): string {
  if (periodMonths === 3) return 'Periodik 3 Bulan';
  if (periodMonths === 6) return 'Periodik 6 Bulan';
  if (periodMonths === 12) return 'Periodik 12 Bulan';
  return 'Diagnostik Awal';
}

export function getReportPeriodLabel(rangeMonths: ReportPeriodFilter): string {
  if (rangeMonths === 3) return '3 Bulan Terakhir';
  if (rangeMonths === 6) return '6 Bulan Terakhir';
  if (rangeMonths === 12) return '12 Bulan Terakhir';
  return 'Semua Periode';
}

/**
 * Computes an inclusive YYYY-MM-DD cutoff date N months prior to referenceDate (defaults to today).
 */
export function getCutoffDateISO(months: 3 | 6 | 12, referenceDate = new Date()): string {
  const ref = new Date(
    Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  );
  ref.setUTCMonth(ref.getUTCMonth() - months);
  return ref.toISOString().slice(0, 10);
}

/**
 * Filters records with a YYYY-MM-DD date field against the chosen rolling periodic window.
 * If periodMonths on a diagnostic item matches the requested period filter explicitly,
 * or its date falls within the last N months, it is included.
 */
export function filterByPeriodWindow<T>(
  items: T[],
  getDate: (item: T) => string | undefined,
  rangeMonths: ReportPeriodFilter,
  referenceDate = new Date()
): T[] {
  if (rangeMonths === 'all') return items;
  const cutoff = getCutoffDateISO(rangeMonths, referenceDate);
  return items.filter((item) => {
    const d = (getDate(item) || '').slice(0, 10);
    if (!d) return false;
    return d >= cutoff;
  });
}

export function getConditionSummary(
  condition?: ConditionLevel,
  score?: number
): {
  label: string;
  description: string;
  tone: 'emerald' | 'amber' | 'rose';
} {
  if (condition === 'perlu_pendampingan' || (typeof score === 'number' && score > 0 && score < 55)) {
    return {
      label: 'Perlu Pendampingan Intensif',
      description: 'Memerlukan coaching terjadwal, penguatan KSE, dan komunikasi sinergis dengan orang tua.',
      tone: 'rose',
    };
  }
  if (condition === 'baik' || (typeof score === 'number' && score >= 75)) {
    return {
      label: 'Baik & Mandiri',
      description: 'Menunjukkan kemandirian belajar konsisten dan siap menjadi teladan atau tutor sebaya.',
      tone: 'emerald',
    };
  }
  return {
    label: 'Cukup & Berkembang',
    description: 'Menunjukkan perkembangan stabil; perlu pembiasaan konsisten dan penguatan inisiatif.',
    tone: 'amber',
  };
}
