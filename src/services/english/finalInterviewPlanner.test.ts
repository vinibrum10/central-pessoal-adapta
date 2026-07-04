import { describe, expect, it } from 'vitest';
import type { InterviewQuestion, JobTarget, StarAnswer } from '../../types/englishInterview';
import { buildFinalInterviewQuestions } from './finalInterviewPlanner';

function bankQuestion(id: string, category: string, themes: string[] = []): InterviewQuestion {
  return {
    id,
    category,
    question_en: `Question ${id}?`,
    o_que_avaliam: '',
    como_responder: '',
    temas_relacionados: themes,
    timer_sugerido_min: 3,
  };
}

const BANK: InterviewQuestion[] = [
  bankQuestion('B1', 'comportamental'),
  bankQuestion('B2', 'comportamental'),
  bankQuestion('B3', 'comportamental'),
  bankQuestion('T1', 'tecnica', ['substations']),
  bankQuestion('T2', 'tecnica', ['safety']),
  bankQuestion('T3', 'tecnica', ['protection']),
  bankQuestion('T4', 'tecnica', ['outages']),
  bankQuestion('T5', 'tecnica', ['safety']),
  bankQuestion('P1', 'perfil'),
  bankQuestion('P2', 'perfil'),
];

function starAnswer(questionId: string): StarAnswer {
  return {
    id: `star-${questionId}`,
    user_id: 'user-1',
    question_id: questionId,
    title: 'Story',
    situation: 's',
    task: 't',
    action: 'a',
    result: 'r',
    final_answer_en: 'answer',
    notes_pt: '',
    created_at: '2026-07-01',
    updated_at: '2026-07-01',
  };
}

function jobTargetWithQuestions(questions: string[]): JobTarget {
  return {
    id: 'job-1',
    user_id: 'user-1',
    title: 'Substation Engineer',
    company: 'Duke Energy',
    location: 'Charlotte, NC',
    job_url: null,
    description: 'desc',
    status: 'to_apply',
    ai_analysis: {
      match_score: 8,
      role_type: 'Substation Engineer',
      summary_pt: 'resumo',
      required_skills: [],
      preferred_skills: [],
      technical_keywords: [],
      missing_vocabulary: [],
      strengths_pt: [],
      gaps_pt: [],
      likely_interview_questions: questions,
      star_story_suggestions: [],
      study_plan_7_days_pt: [],
      recommended_mock_focus: 'foco',
    },
    match_score: 8,
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
    created_at: '2026-07-01',
    updated_at: '2026-07-01',
    archived_at: null,
  };
}

describe('buildFinalInterviewQuestions (Fase 6 — simulado final)', () => {
  it('gera 10 perguntas na estrutura padrão: abertura, 2 STAR, 3 técnicas, 2 vaga/experiência, adaptação e encerramento', () => {
    const result = buildFinalInterviewQuestions({
      focus: 'general',
      questionCount: 10,
      bankQuestions: BANK,
      starAnswers: [],
      jobTarget: null,
    });

    expect(result).toHaveLength(10);
    expect(result[0].question_category).toBe('opening');
    expect(result[result.length - 2].question_category).toBe('adaptation');
    expect(result[result.length - 1].question_category).toBe('closing');
    expect(result.filter(q => q.question_category === 'behavioral')).toHaveLength(2);
    expect(result.filter(q => q.question_category === 'technical')).toHaveLength(3);
    expect(result.filter(q => q.question_category === 'experience' || q.question_category === 'job_specific')).toHaveLength(2);
    // sort_order sequencial e sem duplicatas
    expect(result.map(q => q.sort_order)).toEqual(result.map((_, index) => index));
    expect(new Set(result.map(q => q.question_text.toLowerCase())).size).toBe(result.length);
  });

  it('respeita os limites de 8 e 12 perguntas', () => {
    const small = buildFinalInterviewQuestions({
      focus: 'general', questionCount: 8, bankQuestions: BANK, starAnswers: [], jobTarget: null,
    });
    const large = buildFinalInterviewQuestions({
      focus: 'general', questionCount: 12, bankQuestions: BANK, starAnswers: [], jobTarget: null,
    });
    const clampedLow = buildFinalInterviewQuestions({
      focus: 'general', questionCount: 3, bankQuestions: BANK, starAnswers: [], jobTarget: null,
    });
    const clampedHigh = buildFinalInterviewQuestions({
      focus: 'general', questionCount: 50, bankQuestions: BANK, starAnswers: [], jobTarget: null,
    });

    expect(small).toHaveLength(8);
    expect(large).toHaveLength(12);
    expect(clampedLow).toHaveLength(8);
    expect(clampedHigh).toHaveLength(12);
  });

  it('usa perguntas prováveis da vaga-alvo como job_specific com source_ref_id da vaga', () => {
    const jobTarget = jobTargetWithQuestions([
      'How would you design protection for a 230kV substation?',
      'Tell me about your experience with NERC standards.',
    ]);
    const result = buildFinalInterviewQuestions({
      focus: 'priority_job',
      questionCount: 10,
      bankQuestions: BANK,
      starAnswers: [],
      jobTarget,
    });

    const jobQuestions = result.filter(q => q.question_category === 'job_specific');
    expect(jobQuestions).toHaveLength(2);
    expect(jobQuestions.every(q => q.source_type === 'job_target' && q.source_ref_id === 'job-1')).toBe(true);
  });

  it('prioriza temas de segurança quando o foco é segurança elétrica', () => {
    const result = buildFinalInterviewQuestions({
      focus: 'electrical_safety',
      questionCount: 10,
      bankQuestions: BANK,
      starAnswers: [],
      jobTarget: null,
    });

    const technical = result.filter(q => q.question_category === 'technical');
    // T2 e T5 têm tema safety e devem vir primeiro
    expect(technical[0].source_ref_id).toBe('T2');
    expect(technical[1].source_ref_id).toBe('T5');
  });

  it('prioriza perguntas comportamentais que já têm resposta STAR salva', () => {
    const result = buildFinalInterviewQuestions({
      focus: 'general',
      questionCount: 10,
      bankQuestions: BANK,
      starAnswers: [starAnswer('B3')],
      jobTarget: null,
    });

    const behavioral = result.filter(q => q.question_category === 'behavioral');
    expect(behavioral[0].source_ref_id).toBe('B3');
  });

  it('completa com perguntas built-in quando o banco é pequeno, sem duplicar', () => {
    const result = buildFinalInterviewQuestions({
      focus: 'general',
      questionCount: 10,
      bankQuestions: [bankQuestion('T1', 'tecnica')],
      starAnswers: [],
      jobTarget: null,
    });

    expect(result[0].question_category).toBe('opening');
    expect(result[result.length - 1].question_category).toBe('closing');
    expect(new Set(result.map(q => q.question_text.toLowerCase())).size).toBe(result.length);
    // banco de 1 pergunta: ainda entrega abertura + técnica + fallbacks + adaptação + encerramento
    expect(result.length).toBeGreaterThanOrEqual(6);
  });
});
