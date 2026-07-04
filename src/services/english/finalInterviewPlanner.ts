import type {
  FinalInterviewFocusArea,
  FinalInterviewQuestionCategory,
  GeneratedFinalInterviewQuestion,
  InterviewQuestion,
  JobTarget,
  StarAnswer,
} from '../../types/englishInterview';

export const FINAL_INTERVIEW_MIN_QUESTIONS = 8;
export const FINAL_INTERVIEW_MAX_QUESTIONS = 12;
export const FINAL_INTERVIEW_DEFAULT_QUESTIONS = 10;

interface BuiltinQuestion {
  question_text: string;
  guidance: string;
  suggested_duration_sec: number;
}

const OPENING_QUESTION: BuiltinQuestion = {
  question_text: 'To start, tell me about yourself and your background as an electrical engineer.',
  guidance: 'Apresentação de 1–2 minutos: quem você é, sua experiência no setor elétrico e por que está buscando vagas nos EUA.',
  suggested_duration_sec: 120,
};

const ADAPTATION_QUESTION: BuiltinQuestion = {
  question_text: 'How do you handle working and communicating in English with a US-based team, and how are you preparing to relocate?',
  guidance: 'Mostre confiança na comunicação em inglês, cite ferramentas/rotinas de estudo e disposição para se adaptar à cultura de trabalho americana.',
  suggested_duration_sec: 120,
};

const CLOSING_QUESTION: BuiltinQuestion = {
  question_text: 'Why should we hire you for this role, and do you have any questions for us?',
  guidance: 'Feche com 2–3 pontos fortes ligados à vaga e faça 1–2 perguntas inteligentes sobre o time ou os projetos.',
  suggested_duration_sec: 120,
};

const EXPERIENCE_FALLBACK_QUESTIONS: BuiltinQuestion[] = [
  {
    question_text: 'Walk me through the most challenging project you have worked on in substations or power systems.',
    guidance: 'Escolha um projeto real, explique o contexto técnico, seu papel e o resultado com números quando possível.',
    suggested_duration_sec: 180,
  },
  {
    question_text: 'What was your role in commissioning or maintaining critical electrical equipment, and what did you learn from it?',
    guidance: 'Detalhe responsabilidades reais e uma lição prática — entrevistadores valorizam aprendizado concreto.',
    suggested_duration_sec: 180,
  },
];

const GUIDANCE_BY_CATEGORY: Record<FinalInterviewQuestionCategory, string> = {
  opening: OPENING_QUESTION.guidance,
  behavioral: 'Responda no formato STAR: situação, tarefa, ação e resultado. Use uma história real.',
  technical: 'Explique o conceito com clareza, como se estivesse ensinando um colega. Cite normas ou práticas dos EUA se souber.',
  job_specific: 'Conecte sua experiência aos requisitos da vaga. Use os termos técnicos da descrição da vaga.',
  experience: 'Fale de experiência real, com contexto, seu papel e resultado mensurável.',
  adaptation: ADAPTATION_QUESTION.guidance,
  closing: CLOSING_QUESTION.guidance,
};

const FOCUS_THEMES: Partial<Record<FinalInterviewFocusArea, string[]>> = {
  electrical_safety: ['safety'],
  substations_transmission: ['substations', 'interconnection', 'transmission', 'protection'],
};

export interface FinalInterviewPlannerInput {
  focus: FinalInterviewFocusArea;
  questionCount: number;
  bankQuestions: InterviewQuestion[];
  starAnswers: StarAnswer[];
  jobTarget: JobTarget | null;
}

function clampQuestionCount(count: number): number {
  if (!Number.isFinite(count)) return FINAL_INTERVIEW_DEFAULT_QUESTIONS;
  return Math.min(FINAL_INTERVIEW_MAX_QUESTIONS, Math.max(FINAL_INTERVIEW_MIN_QUESTIONS, Math.round(count)));
}

// Distribui as vagas do meio (entre abertura e adaptação/encerramento) de forma determinística.
// Para 10 perguntas: 1 abertura + 2 STAR + 3 técnicas + 2 vaga/experiência + 1 adaptação + 1 encerramento.
function middleSlotCounts(total: number, focus: FinalInterviewFocusArea): { behavioral: number; technical: number; jobExperience: number } {
  let behavioral = 2;
  let technical = 3;
  let jobExperience = 2;

  let delta = total - FINAL_INTERVIEW_DEFAULT_QUESTIONS;
  while (delta > 0) {
    technical += 1;
    delta -= 1;
    if (delta > 0) {
      jobExperience += 1;
      delta -= 1;
    }
  }
  while (delta < 0) {
    if (technical > 1) technical -= 1;
    else if (jobExperience > 1) jobExperience -= 1;
    else behavioral -= 1;
    delta += 1;
  }

  if (focus === 'behavioral' && technical > 1) {
    behavioral += 1;
    technical -= 1;
  }

  return { behavioral, technical, jobExperience };
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

export function buildFinalInterviewQuestions(input: FinalInterviewPlannerInput): GeneratedFinalInterviewQuestion[] {
  const count = clampQuestionCount(input.questionCount);
  const slots = middleSlotCounts(count, input.focus);

  const usedBankIds = new Set<string>();
  const usedTexts = new Set<string>();
  const result: GeneratedFinalInterviewQuestion[] = [];

  const push = (
    category: FinalInterviewQuestionCategory,
    questionText: string,
    options: { guidance?: string; durationSec?: number; sourceType: string; sourceRefId?: string | null },
  ) => {
    const normalized = normalizeText(questionText);
    if (!questionText.trim() || usedTexts.has(normalized)) return false;
    usedTexts.add(normalized);
    result.push({
      question_text: questionText.trim(),
      question_category: category,
      guidance: options.guidance ?? GUIDANCE_BY_CATEGORY[category],
      suggested_duration_sec: options.durationSec ?? 180,
      sort_order: result.length,
      source_type: options.sourceType,
      source_ref_id: options.sourceRefId ?? null,
    });
    return true;
  };

  const pushFromBank = (category: FinalInterviewQuestionCategory, question: InterviewQuestion) => {
    if (usedBankIds.has(question.id)) return false;
    const added = push(category, question.question_en, {
      durationSec: Math.max(60, (question.timer_sugerido_min || 3) * 60),
      sourceType: 'question_bank',
      sourceRefId: question.id,
    });
    if (added) usedBankIds.add(question.id);
    return added;
  };

  // 1. Abertura
  push('opening', OPENING_QUESTION.question_text, {
    guidance: OPENING_QUESTION.guidance,
    durationSec: OPENING_QUESTION.suggested_duration_sec,
    sourceType: 'builtin',
  });

  // 2. Comportamentais STAR — prioriza perguntas do banco que já têm resposta STAR salva
  const behavioralBank = input.bankQuestions.filter(question => question.category === 'comportamental');
  const starQuestionIds = new Set(input.starAnswers.map(answer => answer.question_id));
  const behavioralWithStar = behavioralBank.filter(question => starQuestionIds.has(question.id));
  const behavioralPool = [...behavioralWithStar, ...behavioralBank.filter(question => !starQuestionIds.has(question.id))];
  let behavioralAdded = 0;
  for (const question of behavioralPool) {
    if (behavioralAdded >= slots.behavioral) break;
    if (pushFromBank('behavioral', question)) behavioralAdded += 1;
  }

  // 3. Técnicas — filtra pelos temas do foco e completa com o restante do banco técnico
  const technicalBank = input.bankQuestions.filter(question => question.category === 'tecnica');
  const focusThemes = FOCUS_THEMES[input.focus];
  const technicalPreferred = focusThemes
    ? technicalBank.filter(question => question.temas_relacionados.some(theme => focusThemes.includes(theme)))
    : technicalBank;
  const technicalPool = [...technicalPreferred, ...technicalBank.filter(question => !technicalPreferred.includes(question))];
  let technicalAdded = 0;
  for (const question of technicalPool) {
    if (technicalAdded >= slots.technical) break;
    if (pushFromBank('technical', question)) technicalAdded += 1;
  }

  // 4. Vaga-alvo ou experiência
  let jobExperienceAdded = 0;
  const likelyQuestions = input.jobTarget?.ai_analysis?.likely_interview_questions ?? [];
  for (const questionText of likelyQuestions) {
    if (jobExperienceAdded >= slots.jobExperience) break;
    if (push('job_specific', questionText, { sourceType: 'job_target', sourceRefId: input.jobTarget?.id ?? null })) {
      jobExperienceAdded += 1;
    }
  }
  const experiencePool = [
    ...input.bankQuestions.filter(question => question.category === 'perfil'),
  ];
  for (const question of experiencePool) {
    if (jobExperienceAdded >= slots.jobExperience) break;
    if (pushFromBank('experience', question)) jobExperienceAdded += 1;
  }
  for (const fallback of EXPERIENCE_FALLBACK_QUESTIONS) {
    if (jobExperienceAdded >= slots.jobExperience) break;
    if (push('experience', fallback.question_text, {
      guidance: fallback.guidance,
      durationSec: fallback.suggested_duration_sec,
      sourceType: 'builtin',
    })) {
      jobExperienceAdded += 1;
    }
  }

  // Completa lacunas (banco pequeno) com técnicas/comportamentais restantes para chegar perto do total
  const remainingSlots = () => count - 2 - result.length; // reserva adaptação + encerramento
  if (remainingSlots() > 0) {
    for (const question of [...technicalBank, ...behavioralBank, ...experiencePool]) {
      if (remainingSlots() <= 0) break;
      pushFromBank(
        question.category === 'comportamental' ? 'behavioral' : question.category === 'perfil' ? 'experience' : 'technical',
        question,
      );
    }
  }

  // 5. Adaptação aos EUA / comunicação
  push('adaptation', ADAPTATION_QUESTION.question_text, {
    guidance: ADAPTATION_QUESTION.guidance,
    durationSec: ADAPTATION_QUESTION.suggested_duration_sec,
    sourceType: 'builtin',
  });

  // 6. Encerramento
  push('closing', CLOSING_QUESTION.question_text, {
    guidance: CLOSING_QUESTION.guidance,
    durationSec: CLOSING_QUESTION.suggested_duration_sec,
    sourceType: 'builtin',
  });

  return result.map((question, index) => ({ ...question, sort_order: index }));
}
