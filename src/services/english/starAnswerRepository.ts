import { supabase } from '../../lib/supabase';
import type { StarAnswer, StarAnswerInput } from '../../types/englishInterview';

async function throwIfError<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

const STAR_SELECT = '*, interview_questions(*)';

export async function listStarAnswers(): Promise<StarAnswer[]> {
  return throwIfError<StarAnswer[]>(
    supabase
      .from('star_answers')
      .select(STAR_SELECT)
      .order('updated_at', { ascending: false }) as never,
  );
}

export async function createStarAnswer(userId: string, input: StarAnswerInput): Promise<StarAnswer> {
  return throwIfError<StarAnswer>(
    supabase
      .from('star_answers')
      .insert({
        user_id: userId,
        ...input,
      })
      .select(STAR_SELECT)
      .single() as never,
  );
}

export async function updateStarAnswer(id: string, input: StarAnswerInput): Promise<StarAnswer> {
  return throwIfError<StarAnswer>(
    supabase
      .from('star_answers')
      .update(input)
      .eq('id', id)
      .select(STAR_SELECT)
      .single() as never,
  );
}

export async function deleteStarAnswer(id: string): Promise<void> {
  const { error } = await supabase
    .from('star_answers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
