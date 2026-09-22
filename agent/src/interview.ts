/**
 * Entrevista: transforma um pedido vago ("melhore as finanças") numa tarefa
 * clara. Roda no motor "planner" (por padrão o Ollama local — privado e grátis).
 *
 * Protocolo simples e robusto mesmo com modelos locais fracos: a cada rodada o
 * modelo responde OU com "PERGUNTA: ..." (precisa de mais um esclarecimento) OU
 * com "TAREFA: ..." (entendeu e fechou o enunciado). Limitamos as rodadas para
 * a conversa não se arrastar.
 */

import { generateText, type ModelMessage } from 'ai';
import * as p from '@clack/prompts';
import type { LanguageModel } from 'ai';
import { interviewSystemPrompt } from './prompts.js';
import type { RepoContext } from './repoContext.js';

const MAX_ROUNDS = 5;

export async function runInterview(
  model: LanguageModel,
  ctx: RepoContext,
  initialRequest: string,
  maxRetries = 6,
): Promise<string> {
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content:
        `Meu pedido inicial: "${initialRequest}".\n` +
        'Se precisar de esclarecimento, responda começando com "PERGUNTA:" e faça UMA pergunta. ' +
        'Se já entendeu, responda começando com "TAREFA:" e escreva o enunciado final, objetivo e pequeno.',
    },
  ];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const spin = p.spinner();
    spin.start('Pensando na próxima pergunta…');
    const { text } = await generateText({
      model,
      system: interviewSystemPrompt(ctx),
      messages,
      temperature: 0.4,
      maxRetries,
    });
    spin.stop('');

    const trimmed = text.trim();
    const taskMatch = trimmed.match(/TAREFA:\s*([\s\S]+)/i);
    if (taskMatch || round === MAX_ROUNDS - 1) {
      const task = taskMatch ? taskMatch[1].trim() : trimmed.replace(/^PERGUNTA:\s*/i, '').trim();
      return task;
    }

    const question = trimmed.replace(/^PERGUNTA:\s*/i, '').trim();
    const answer = await p.text({
      message: question || 'Pode dar mais detalhes?',
      placeholder: 'Responda em uma ou duas frases…',
    });
    if (p.isCancel(answer)) {
      p.cancel('Entrevista cancelada.');
      process.exit(0);
    }
    messages.push({ role: 'assistant', content: text });
    messages.push({
      role: 'user',
      content: `${String(answer)}\n(Lembre: responda com "PERGUNTA:" ou "TAREFA:".)`,
    });
  }

  return initialRequest;
}
