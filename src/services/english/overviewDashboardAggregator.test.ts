import { describe, expect, it } from 'vitest';
import { summarizeFinalReadiness, summarizeJobPipeline, summarizeWeeklyPlanTasks } from './overviewDashboardAggregator';
import type { FinalInterviewSimulation, JobTarget, WeeklyPreparationTask } from '../../types/englishInterview';

function makeTask(overrides: Partial<WeeklyPreparationTask> = {}): WeeklyPreparationTask {
  return {
    id: 'task-1',
    user_id: 'user-1',
    plan_id: 'plan-1',
    task_date: '2026-07-06',
    title: 'Gravar resposta STAR',
    description: null,
    task_type: 'star',
    source_type: null,
    source_ref_id: null,
    status: 'pending',
    sort_order: 0,
    created_at: '2026-07-06T00:00:00.000Z',
    updated_at: '2026-07-06T00:00:00.000Z',
    ...overrides,
  };
}

function makeJobTarget(overrides: Partial<JobTarget> = {}): JobTarget {
  return {
    id: 'job-1',
    user_id: 'user-1',
    title: 'Data Analyst',
    company: 'Meridian Analytics',
    location: 'Remote',
    job_url: null,
    description: '',
    status: 'applied',
    ai_analysis: null,
    match_score: null,
    applied_at: null,
    interview_at: null,
    follow_up_at: null,
    next_action: null,
    application_notes: null,
    recruiter_name: null,
    recruiter_contact: null,
    salary_range: null,
    work_model: null,
    visa_sponsorship: null,
    priority: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    archived_at: null,
    ...overrides,
  };
}

function makeSimulation(overrides: Partial<FinalInterviewSimulation> = {}): FinalInterviewSimulation {
  return {
    id: 'sim-1',
    user_id: 'user-1',
    title: 'Simulado final',
    focus_area: 'general',
    job_target_id: null,
    status: 'evaluated',
    estimated_duration_min: 30,
    question_count: 8,
    overall_feedback: null,
    readiness_score: 76,
    started_at: '2026-07-05T10:00:00.000Z',
    completed_at: '2026-07-05T10:30:00.000Z',
    created_at: '2026-07-05T10:00:00.000Z',
    updated_at: '2026-07-05T10:30:00.000Z',
    ...overrides,
  };
}

describe('summarizeWeeklyPlanTasks', () => {
  it('conta tarefas por status e calcula o percentual concluído', () => {
    const tasks = [
      makeTask({ id: 't1', status: 'completed' }),
      makeTask({ id: 't2', status: 'completed' }),
      makeTask({ id: 't3', status: 'pending' }),
      makeTask({ id: 't4', status: 'ignored' }),
    ];

    const summary = summarizeWeeklyPlanTasks(tasks);

    expect(summary).toEqual({ completed: 2, pending: 1, ignored: 1, total: 4, percentComplete: 50 });
  });

  it('retorna zeros e 0% quando não há tarefas', () => {
    const summary = summarizeWeeklyPlanTasks([]);

    expect(summary).toEqual({ completed: 0, pending: 0, ignored: 0, total: 0, percentComplete: 0 });
  });

  it('arredonda o percentual concluído', () => {
    const tasks = [
      makeTask({ id: 't1', status: 'completed' }),
      makeTask({ id: 't2', status: 'pending' }),
      makeTask({ id: 't3', status: 'pending' }),
    ];

    const summary = summarizeWeeklyPlanTasks(tasks);

    expect(summary.percentComplete).toBe(33);
  });
});

describe('summarizeJobPipeline', () => {
  it('conta vagas por status e soma as ativas (exclui rejeitadas e arquivadas)', () => {
    const jobTargets = [
      makeJobTarget({ id: 'j1', status: 'researching' }),
      makeJobTarget({ id: 'j2', status: 'applied' }),
      makeJobTarget({ id: 'j3', status: 'applied' }),
      makeJobTarget({ id: 'j4', status: 'interview' }),
      makeJobTarget({ id: 'j5', status: 'offer' }),
      makeJobTarget({ id: 'j6', status: 'rejected' }),
      makeJobTarget({ id: 'j7', status: 'archived' }),
    ];

    const summary = summarizeJobPipeline(jobTargets);

    expect(summary.byStatus).toEqual({
      researching: 1,
      applied: 2,
      interview: 1,
      offer: 1,
      rejected: 1,
      archived: 1,
    });
    expect(summary.activeCount).toBe(5);
  });

  it('retorna contagens vazias quando não há vagas', () => {
    const summary = summarizeJobPipeline([]);

    expect(summary).toEqual({ activeCount: 0, byStatus: {} });
  });
});

describe('summarizeFinalReadiness', () => {
  it('identifica melhor nota, última nota e total concluído', () => {
    const simulations = [
      makeSimulation({ id: 's1', readiness_score: 62, completed_at: '2026-06-20T10:00:00.000Z' }),
      makeSimulation({ id: 's2', readiness_score: 82, completed_at: '2026-06-28T10:00:00.000Z' }),
      makeSimulation({ id: 's3', readiness_score: 76, completed_at: '2026-07-05T10:00:00.000Z' }),
      makeSimulation({ id: 's4', status: 'draft', readiness_score: null, completed_at: null }),
    ];

    const summary = summarizeFinalReadiness(simulations);

    expect(summary).toEqual({
      completedCount: 3,
      bestScore: 82,
      lastScore: 76,
      lastCompletedAt: '2026-07-05T10:00:00.000Z',
    });
  });

  it('retorna nulos quando nenhum simulado foi concluído', () => {
    const simulations = [makeSimulation({ id: 's1', status: 'draft', readiness_score: null, completed_at: null })];

    const summary = summarizeFinalReadiness(simulations);

    expect(summary).toEqual({ completedCount: 0, bestScore: null, lastScore: null, lastCompletedAt: null });
  });
});
