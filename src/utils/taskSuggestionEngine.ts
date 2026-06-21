import type { Tarefa, Meta } from '../types';
import type { WeekClassification } from './nightAvailability';

// FaixaTarefa: 'urgente' | 'alto impacto' | 'médio impacto' | 'baixo impacto'
const PRIORITY_ORDER: Record<string, number> = {
  'urgente': 4,
  'alto impacto': 3,
  'médio impacto': 2,
  'baixo impacto': 1,
};

export interface SuggestionCandidate {
  tarefa: Tarefa;
  meta: Meta | null;
  score: number;
  reason: string;
}

export function rankEligibleTasks(tarefas: Tarefa[], metas: Meta[]): SuggestionCandidate[] {
  return tarefas
    .filter(t => {
      if (t.status === 'concluído') return false;
      const meta = metas.find(m => m.id === t.metaId);
      if (meta && meta.status !== 'ativa') return false;
      return true;
    })
    .map(t => {
      const meta = metas.find(m => m.id === t.metaId) ?? null;
      const priorityScore = PRIORITY_ORDER[t.faixa] ?? 0;
      const metaGrau = meta?.grau ?? 0;
      const score = priorityScore * 10 + metaGrau;
      const reason = buildSuggestionReason(t, meta, 'leve');
      return { tarefa: t, meta, score, reason };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildSuggestionReason(tarefa: Tarefa, meta: Meta | null, weekClass: WeekClassification): string {
  const parts: string[] = [];
  if (meta) parts.push(`Meta: ${meta.nome} (grau ${meta.grau})`);
  parts.push(`Prioridade: ${tarefa.faixa}`);
  if (weekClass === 'pesada') parts.push('Semana pesada — sugestão prioritária');
  return parts.join(' · ') || 'Tarefa pendente na sua lista';
}

export function selectTasksForFreeNights(
  freeNights: Date[],
  tarefas: Tarefa[],
  metas: Meta[],
  weekClass: WeekClassification,
  existingSuggestionTaskIds: string[]
): SuggestionCandidate[] {
  const maxSuggestions = weekClass === 'pesada' ? 2 : weekClass === 'mediana' ? 3 : freeNights.length;
  const allowedFaixas = weekClass === 'pesada'
    ? ['urgente', 'alto impacto']
    : weekClass === 'mediana'
    ? ['urgente', 'alto impacto', 'médio impacto']
    : Object.keys(PRIORITY_ORDER);

  return rankEligibleTasks(tarefas, metas)
    .filter(c => {
      if (existingSuggestionTaskIds.includes(c.tarefa.id)) return false;
      if (weekClass !== 'leve' && !allowedFaixas.includes(c.tarefa.faixa)) return false;
      return true;
    })
    .slice(0, maxSuggestions)
    .map(c => ({ ...c, reason: buildSuggestionReason(c.tarefa, c.meta, weekClass) }));
}
