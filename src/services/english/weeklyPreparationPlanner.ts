import { supabase } from '../../lib/supabase';
import type {
  GeneratedWeeklyPreparationPlan,
  GeneratedWeeklyPreparationTask,
  InterviewAnswer,
  JobApplicationMaterials,
  JobTarget,
  MockInterviewSession,
  StarAnswer,
  WeeklyPreparationTaskType,
} from '../../types/englishInterview';
import { getCurrentWeekRange } from './weeklyPreparationRepository';

type TaskDraft = Omit<GeneratedWeeklyPreparationTask, 'task_date' | 'sort_order'>;

function addDaysISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function sevenDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index));
}

async function safeSelect<T>(table: string, select = '*'): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(select);
  if (error) {
    console.warn('[WeeklyPreparation] Optional source unavailable', { table, message: error.message });
    return [];
  }
  return (data ?? []) as T[];
}

function scoreAverage(answers: InterviewAnswer[]) {
  const scores = answers
    .map(answer => answer.gemini_feedback?.score)
    .filter((score): score is number => typeof score === 'number');
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
}

function pushUnique(tasks: TaskDraft[], task: TaskDraft) {
  const key = `${task.task_type}:${task.source_type}:${task.source_ref_id ?? task.title}`;
  const exists = tasks.some(item => `${item.task_type}:${item.source_type}:${item.source_ref_id ?? item.title}` === key);
  if (!exists) tasks.push(task);
}

function distributeTasks(weekStart: string, drafts: TaskDraft[]): GeneratedWeeklyPreparationTask[] {
  const dates = sevenDays(weekStart);
  const dayCounts = new Map(dates.map(date => [date, 0]));

  return drafts.slice(0, 24).map((draft, index) => {
    const preferredIndex = index % dates.length;
    const date = dates
      .slice(preferredIndex)
      .concat(dates.slice(0, preferredIndex))
      .find(candidate => (dayCounts.get(candidate) ?? 0) < 4) ?? dates[preferredIndex];
    const count = dayCounts.get(date) ?? 0;
    dayCounts.set(date, count + 1);
    return {
      ...draft,
      task_date: date,
      sort_order: count,
    };
  });
}

export async function generateWeeklyPreparationPlan(userId: string, date = new Date()): Promise<GeneratedWeeklyPreparationPlan> {
  if (!userId) throw new Error('Usuário autenticado não encontrado para gerar o plano semanal.');

  const { weekStart, weekEnd } = getCurrentWeekRange(date);
  const sevenDaysAgo = new Date(date.getTime() - 7 * 86_400_000).toISOString();
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();

  const [
    answers,
    termStatuses,
    starAnswers,
    mocks,
    mockQuestions,
    jobTargets,
    materials,
  ] = await Promise.all([
    safeSelect<InterviewAnswer>('interview_answers'),
    safeSelect<{ status: string; term_id: string }>('user_glossary_term_status'),
    safeSelect<StarAnswer>('star_answers'),
    safeSelect<MockInterviewSession>('mock_sessions'),
    safeSelect<{ mock_session_id: string; answer_id: string | null }>('mock_session_questions'),
    safeSelect<JobTarget>('job_targets'),
    safeSelect<JobApplicationMaterials>('job_application_materials'),
  ]);

  const recentAnswers = answers.filter(answer => answer.created_at >= sevenDaysAgo);
  const averageScore = scoreAverage(answers);
  const notMasteredTerms = termStatuses.filter(status => status.status === 'not_mastered');
  const reviewTerms = termStatuses.filter(status => status.status === 'review');
  const completedMockThisMonth = mocks.some(mock => mock.status === 'completed' && (mock.completed_at ?? mock.created_at) >= monthStart);
  const pendingMock = mocks.find(mock => mock.status !== 'completed');
  const answeredMockQuestionIds = new Set(mockQuestions.filter(row => row.answer_id).map(row => row.mock_session_id));
  const activeJobs = jobTargets.filter(job => job.status !== 'archived' && job.status !== 'rejected');
  const overdueFollowUps = activeJobs.filter(job => job.follow_up_at && new Date(job.follow_up_at).getTime() <= Date.now());
  const highPriorityJobs = activeJobs.filter(job => job.priority === 'high');
  const toApplyJobs = activeJobs.filter(job => job.status === 'to_apply');
  const materialJobIds = new Set(materials.map(item => item.job_target_id));
  const jobsWithoutMaterials = activeJobs.filter(job => !materialJobIds.has(job.id));
  const jobsWithNextAction = activeJobs.filter(job => job.next_action);
  const tasks: TaskDraft[] = [];

  overdueFollowUps.slice(0, 3).forEach(job => pushUnique(tasks, {
    title: `Fazer follow-up: ${job.title}`,
    description: job.next_action || 'Enviar uma mensagem curta e objetiva para manter a candidatura ativa.',
    task_type: 'follow_up',
    source_type: 'follow-up vencido',
    source_ref_id: job.id,
  }));

  highPriorityJobs.slice(0, 3).forEach(job => pushUnique(tasks, {
    title: `Revisar vaga prioritária: ${job.title}`,
    description: 'Revise requisitos, palavras-chave e próximos passos antes de avançar no funil.',
    task_type: 'job_target',
    source_type: 'vaga prioritária',
    source_ref_id: job.id,
  }));

  toApplyJobs.slice(0, 2).forEach(job => pushUnique(tasks, {
    title: `Preparar aplicação: ${job.title}`,
    description: 'Revise a descrição da vaga e deixe currículo, LinkedIn e mensagem alinhados.',
    task_type: 'application',
    source_type: 'candidatura marcada como aplicar',
    source_ref_id: job.id,
  }));

  jobsWithoutMaterials.slice(0, 2).forEach(job => pushUnique(tasks, {
    title: `Gerar ou revisar materiais: ${job.title}`,
    description: 'Use os materiais por vaga como rascunho e revise manualmente antes de usar.',
    task_type: 'application',
    source_type: 'vaga sem materiais',
    source_ref_id: job.id,
  }));

  jobsWithNextAction.slice(0, 2).forEach(job => pushUnique(tasks, {
    title: `Executar próxima ação: ${job.title}`,
    description: job.next_action ?? 'Avance um passo manual no controle da candidatura.',
    task_type: 'job_target',
    source_type: 'candidatura com próxima ação',
    source_ref_id: job.id,
  }));

  if (notMasteredTerms.length > 0 || reviewTerms.length > 0) {
    pushUnique(tasks, {
      title: 'Revisar 5 termos técnicos de vagas dos EUA',
      description: `${notMasteredTerms.length} termos ainda não dominados e ${reviewTerms.length} em revisão.`,
      task_type: 'vocabulary',
      source_type: 'vocabulário não dominado',
      source_ref_id: null,
    });
  }

  if (recentAnswers.length < 2) {
    pushUnique(tasks, {
      title: 'Gravar uma resposta de entrevista',
      description: 'Escolha uma pergunta técnica e grave uma resposta de 2 a 3 minutos.',
      task_type: 'speaking',
      source_type: 'baixa frequência de gravação',
      source_ref_id: null,
    });
  }

  if (averageScore !== null && averageScore < 7) {
    pushUnique(tasks, {
      title: 'Treinar clareza técnica com estrutura STAR',
      description: `A média recente de IA está em ${averageScore}/10. Foque em resposta direta, exemplo técnico e resultado.`,
      task_type: 'speaking',
      source_type: 'feedback da IA',
      source_ref_id: null,
    });
  }

  if (pendingMock) {
    pushUnique(tasks, {
      title: 'Continuar mock interview pendente',
      description: answeredMockQuestionIds.has(pendingMock.id)
        ? 'Continue a partir das perguntas ainda sem resposta gravada.'
        : 'Inicie as respostas gravadas do mock em rascunho.',
      task_type: 'mock',
      source_type: 'mock pendente',
      source_ref_id: pendingMock.id,
    });
  } else if (!completedMockThisMonth) {
    pushUnique(tasks, {
      title: 'Criar ou finalizar um mock interview mensal',
      description: 'Monte um simulado com perguntas técnicas e avalie as respostas com IA.',
      task_type: 'mock',
      source_type: 'mock pendente',
      source_ref_id: null,
    });
  }

  if (starAnswers.length < 3) {
    pushUnique(tasks, {
      title: 'Criar uma nova resposta STAR',
      description: 'Escolha uma pergunta importante e escreva Situation, Task, Action e Result.',
      task_type: 'star',
      source_type: 'resposta STAR ausente',
      source_ref_id: null,
    });
  } else {
    pushUnique(tasks, {
      title: 'Melhorar uma resposta STAR existente',
      description: 'Revise uma resposta salva e torne o resultado mais mensurável em inglês.',
      task_type: 'star',
      source_type: 'revisão STAR',
      source_ref_id: starAnswers[0]?.id ?? null,
    });
  }

  ['Fazer shadowing com material técnico', 'Revisar uma vaga-alvo ativa', 'Gravar uma resposta curta de manutenção', 'Revisar 5 termos técnicos'].forEach((title, index) => {
    const fallbackTypes: WeeklyPreparationTaskType[] = ['review', 'job_target', 'speaking', 'vocabulary'];
    pushUnique(tasks, {
      title,
      description: 'Tarefa de manutenção para manter consistência durante a semana.',
      task_type: fallbackTypes[index],
      source_type: 'manutenção',
      source_ref_id: null,
    });
  });

  const snapshot = {
    answersTotal: answers.length,
    answersLast7Days: recentAnswers.length,
    averageAiScore: averageScore,
    notMasteredTerms: notMasteredTerms.length,
    reviewTerms: reviewTerms.length,
    starAnswers: starAnswers.length,
    mocksTotal: mocks.length,
    completedMockThisMonth,
    pendingMockId: pendingMock?.id ?? null,
    activeJobs: activeJobs.length,
    overdueFollowUps: overdueFollowUps.length,
    highPriorityJobs: highPriorityJobs.map(job => ({ id: job.id, title: job.title })),
    toApplyJobs: toApplyJobs.length,
    jobsWithoutMaterials: jobsWithoutMaterials.length,
  };

  const focusArea = overdueFollowUps.length > 0
    ? 'Follow-ups e candidaturas ativas'
    : highPriorityJobs.length > 0
      ? 'Vagas prioritárias e materiais'
      : recentAnswers.length < 2
        ? 'Speaking e consistência de gravação'
        : 'Manutenção técnica semanal';

  return {
    week_start: weekStart,
    week_end: weekEnd,
    main_goal: 'Avançar candidaturas dos EUA enquanto mantém prática de speaking, vocabulário e STAR.',
    focus_area: focusArea,
    generated_from_snapshot: snapshot,
    tasks: distributeTasks(weekStart, tasks),
  };
}
