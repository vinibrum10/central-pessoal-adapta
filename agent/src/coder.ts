/**
 * O coração autônomo: o loop de "agente que programa".
 *
 * Usa o tool calling do AI SDK. O modelo recebe a tarefa + o plano aprovado e
 * um conjunto de ferramentas (ler/escrever/apagar arquivo, buscar, rodar
 * build/test). Ele decide sozinho a sequência de ações, executa, lê os
 * resultados dos testes, corrige, e repete — até chamar `finish` ou atingir o
 * limite de passos (`maxSteps`).
 *
 * Por que Gemini é o padrão aqui: escrever TypeScript/React correto exige um
 * modelo forte de raciocínio. Um modelo local pequeno tende a quebrar o build.
 * Você ainda pode forçar Ollama com AGENT_CODER=ollama (mas leia o README).
 */

import { generateText, stepCountIs, hasToolCall } from 'ai';
import type { LanguageModel } from 'ai';
import { coderSystemPrompt } from './prompts.js';
import { createTools, type ChangeSet } from './tools.js';
import type { RepoContext } from './repoContext.js';

export async function runCoder(opts: {
  model: LanguageModel;
  ctx: RepoContext;
  task: string;
  plan: string;
  changes: ChangeSet;
  maxSteps: number;
  maxRetries: number;
  log: (msg: string) => void;
}): Promise<void> {
  const { model, ctx, task, plan, changes, maxSteps, maxRetries, log } = opts;
  const tools = createTools(ctx.root, changes, log);

  await generateText({
    model,
    system: coderSystemPrompt(ctx),
    tools,
    // Espera e repete em caso de erro transitório (ex.: 429 de cota por minuto).
    maxRetries,
    // Para quando: chamar finish OU estourar o teto de passos (rede de segurança).
    stopWhen: [hasToolCall('finish'), stepCountIs(maxSteps)],
    temperature: 0.1,
    prompt:
      `TAREFA:\n${task}\n\n` +
      `PLANO APROVADO:\n${plan}\n\n` +
      'Implemente agora. Leia os arquivos antes de editar, rode build e test ao final e só então chame finish.',
    onStepFinish: ({ text }) => {
      const t = text.trim();
      if (t) log(`  💭 ${t.slice(0, 300)}${t.length > 300 ? '…' : ''}`);
    },
  });
}
