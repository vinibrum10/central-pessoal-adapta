import { supabase } from '../../lib/supabase';
import { translateWeeklyWord } from '../englishWordTranslateApi';
import { createStarAnswer } from './starAnswerRepository';
import { createMockSession } from './mockInterviewRepository';
import type {
  InterviewQuestion,
  JobTarget,
  MockInterviewSession,
  StarAnswer,
} from '../../types/englishInterview';

export interface AddVocabularyResult {
  requested: number;
  inserted: number;
  skipped: number;
}

const TARGETED_MOCK_QUESTION_COUNT = 5;

/**
 * Traduz os termos com a rota já existente (falha de tradução vira placeholder,
 * nunca bloqueia a ação) e insere no glossário compartilhado via RPC security definer.
 */
export async function addJobVocabularyTerms(terms: string[]): Promise<AddVocabularyResult> {
  const unique = Array.from(new Set(terms.map(term => term.trim()).filter(Boolean)));
  if (unique.length === 0) return { requested: 0, inserted: 0, skipped: 0 };

  const payload = await Promise.all(unique.map(async term => {
    try {
      const result = await translateWeeklyWord(term);
      return { term, translation: result.translation, example: result.example };
    } catch {
      return { term, translation: '', example: '' };
    }
  }));

  const { data, error } = await supabase.rpc('import_job_target_vocabulary', { terms: payload });
  if (error) throw new Error(error.message);

  const inserted = typeof data === 'number' ? data : 0;
  return { requested: unique.length, inserted, skipped: unique.length - inserted };
}

export async function createStarDraftFromSuggestion(params: {
  userId: string;
  jobTarget: JobTarget;
  suggestion: string;
  questionId: string;
}): Promise<StarAnswer> {
  const company = params.jobTarget.company?.trim();
  return createStarAnswer(params.userId, {
    question_id: params.questionId,
    title: params.suggestion.slice(0, 200),
    situation: '',
    task: '',
    action: '',
    result: '',
    final_answer_en: '',
    notes_pt: `Rascunho sugerido pela vaga "${params.jobTarget.title}"${company ? ` (${company})` : ''}. Tema: ${params.suggestion}`,
  });
}

/**
 * Seleciona do banco as perguntas mais relacionadas às palavras-chave da vaga
 * (por interseção simples de texto) e cria um mock em rascunho.
 */
export async function createTargetedMock(params: {
  userId: string;
  jobTarget: JobTarget;
  questions: InterviewQuestion[];
}): Promise<MockInterviewSession> {
  if (params.questions.length === 0) {
    throw new Error('Banco de perguntas vazio. Rode o seed do Modo Entrevista antes de criar um mock.');
  }

  const analysis = params.jobTarget.ai_analysis;
  const keywords = (analysis
    ? [...analysis.technical_keywords, ...analysis.required_skills, analysis.role_type]
    : []
  ).flatMap(keyword => keyword.toLowerCase().split(/[^a-z0-9]+/)).filter(word => word.length > 3);
  const keywordSet = new Set(keywords);

  const scored = params.questions.map(question => {
    const haystack = `${question.question_en} ${question.temas_relacionados.join(' ')} ${question.category}`
      .toLowerCase()
      .split(/[^a-z0-9]+/);
    const score = haystack.reduce((total, word) => total + (keywordSet.has(word) ? 1 : 0), 0);
    return { question, score };
  });

  const selected = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, TARGETED_MOCK_QUESTION_COUNT)
    .map(item => item.question.id);

  const focus = analysis?.recommended_mock_focus?.trim();
  const title = `Mock direcionado — ${params.jobTarget.title}`.slice(0, 200);

  const session = await createMockSession({
    userId: params.userId,
    questionIds: selected,
    title: focus ? `${title} (foco: ${focus.slice(0, 120)})` : title,
  });

  return session;
}
