import { supabase } from '../../lib/supabase';
import type {
  EmployabilityTermStatus,
  GlossaryTerm,
  UserGlossaryTermStatus,
  UserGlossaryTermStatusValue,
  UsJobVocabularyTerm,
} from '../../types/englishInterview';

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

function devLog(message: string, details: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.info('[EnglishEmployability]', message, details);
  }
}

function toDatabaseStatus(status: EmployabilityTermStatus): UserGlossaryTermStatusValue {
  if (status === 'domino') return 'mastered';
  if (status === 'revisar') return 'review';
  return 'not_mastered';
}

function fromDatabaseStatus(status?: UserGlossaryTermStatusValue | null): EmployabilityTermStatus {
  if (status === 'mastered') return 'domino';
  if (status === 'review') return 'revisar';
  return 'nao_domino';
}

export async function listUsJobVocabularyTerms(category = 'all', userId: string): Promise<UsJobVocabularyTerm[]> {
  if (!userId) throw new Error('Usuário autenticado não encontrado para carregar o progresso do vocabulário.');

  let query = supabase
    .from('glossary_terms')
    .select('*')
    .eq('source', 'job_posting')
    .order('importance_level', { ascending: false })
    .order('term', { ascending: true });

  if (category !== 'all') query = query.eq('category', category);

  const terms = await throwIfError<GlossaryTerm[]>(query as never);
  if (terms.length === 0) return [];

  const statuses = await throwIfError<UserGlossaryTermStatus[]>(
    supabase
      .from('user_glossary_term_status')
      .select('*')
      .eq('user_id', userId)
      .in('term_id', terms.map(term => term.id)) as never,
  );

  const statusByTermId = new Map(statuses.map(status => [status.term_id, status]));
  return terms.map(term => {
    const userStatus = statusByTermId.get(term.id) ?? null;
    return {
      term,
      review: null,
      userStatus,
      status: fromDatabaseStatus(userStatus?.status),
    };
  });
}

export async function listUsJobVocabularyCategories(): Promise<string[]> {
  const terms = await throwIfError<Array<{ category: string | null }>>(
    supabase
      .from('glossary_terms')
      .select('category')
      .eq('source', 'job_posting')
      .order('category', { ascending: true }) as never,
  );

  return Array.from(new Set(terms.map(row => row.category).filter((value): value is string => Boolean(value)))).sort();
}

export async function setUsJobVocabularyStatus(params: {
  userId: string;
  termId: string;
  status: EmployabilityTermStatus;
}): Promise<UserGlossaryTermStatus> {
  if (!params.userId) throw new Error('Usuário autenticado não encontrado para salvar o progresso do vocabulário.');
  if (!params.termId) throw new Error('Termo inválido para salvar o progresso do vocabulário.');

  const databaseStatus = toDatabaseStatus(params.status);
  devLog('saving vocabulary status', {
    clickedTermId: params.termId,
    requestedStatus: params.status,
    hasUserId: Boolean(params.userId),
  });

  const { data, error } = await supabase
    .from('user_glossary_term_status')
    .upsert({
      user_id: params.userId,
      term_id: params.termId,
      status: databaseStatus,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,term_id' })
    .select('*')
    .single();

  devLog('vocabulary status save result', {
    clickedTermId: params.termId,
    requestedStatus: params.status,
    hasUserId: Boolean(params.userId),
    saveSuccess: !error,
    supabaseErrorMessage: error?.message ?? null,
  });

  if (error) throw new Error(error.message);
  return data as UserGlossaryTermStatus;
}
