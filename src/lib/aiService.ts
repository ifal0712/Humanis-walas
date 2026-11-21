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

export async function requestStudentAIAnalysis(payload: {
  student: Student;
  diagnostic?: Diagnostic;
  humanis?: HumanisProgress;
  observations: Observation[];
  processes: CoachingProcess[];
  goodStatements: GoodStatement[];
}): Promise<AIStudentAnalysisResult> {
  const response = await fetch('/api/ai/analyze-student', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Gagal mendapatkan analisis AI siswa.');
  }
  return data as AIStudentAnalysisResult;
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
  const response = await fetch('/api/ai/class-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Gagal menghasilkan AI Insight kelas.');
  }
  return data as AIClassInsightResult;
}
