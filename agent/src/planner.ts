/**
 * Planejamento: dado o enunciado da tarefa, gera um plano curto em markdown
 * para você aprovar ANTES de qualquer edição. É o ponto onde você mantém o
 * controle: nada é escrito no código sem o plano passar pelo seu olho.
 */

import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import { plannerSystemPrompt } from './prompts.js';
import type { RepoContext } from './repoContext.js';

export async function makePlan(model: LanguageModel, ctx: RepoContext, task: string): Promise<string> {
  const { text } = await generateText({
    model,
    system: plannerSystemPrompt(ctx),
    prompt:
      `Tarefa a planejar:\n${task}\n\n` +
      'Produza um plano curto com estas seções: **Arquivos**, **Passos**, **Riscos**.',
    temperature: 0.3,
  });
  return text.trim();
}
