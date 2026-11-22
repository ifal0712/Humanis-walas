import type {
  AIClassInsightResult,
  AIStudentAnalysisResult,
  CoachingProcess,
  Diagnostic,
  GoodStatement,
  HumanisProgress,
  Observation,
  Student,
} from '../types/humanis';
import { apiFetchJson } from './apiClient';

export async function requestStudentAIAnalysis(payload: {
  student: Student;
  diagnostic?: Diagnostic;
  humanis?: HumanisProgress;
  observations: Observation[];
  processes: CoachingProcess[];
  goodStatements: GoodStatement[];
}): Promise<AIStudentAnalysisResult> {
  return apiFetchJson<AIStudentAnalysisResult>(
    '/api/ai/analyze-student',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Gagal mendapatkan analisis AI siswa.'
  );
}

export async function requestClassAIInsight(summary: {
  totalStudents: number;
  highCount: number;
  mediumCount: number;
  attentionCount: number;
  aspectAverages: {
    tanggungJawab: number;
    disiplin: number;
    inisiatif: number;
    pengambilanKeputusan: number;
    manajemenDiri: number;
  };
  classes: string[];
  avgHumanisStages: number;
  priorityNames: string[];
}): Promise<AIClassInsightResult> {
  return apiFetchJson<AIClassInsightResult>(
    '/api/ai/class-insight',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    },
    'Gagal menghasilkan AI Insight kelas.'
  );
}
