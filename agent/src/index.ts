/**
 * Ponto de entrada do agente. Orquestra tudo:
 *   entrevista → plano (você aprova) → implementação autônoma → build/test →
 *   commit → push → Pull Request.
 *
 * Rode com:  npm run agent
 * Autopilot: npm run agent -- --yes "seu pedido aqui"
 * Só simular: npm run agent -- --dry-run
 */

import * as p from '@clack/prompts';
import { execFileSync } from 'node:child_process';
import { loadDotEnv } from './env.js';

// Carrega .env / .env.local ANTES de ler qualquer configuração.
loadDotEnv(process.cwd());

import { loadConfig, type AgentConfig, type Engine } from './config.js';
import { getModel, isOllamaReachable, listOllamaModels } from './llm.js';
import { gatherRepoContext } from './repoContext.js';
import { runInterview } from './interview.js';
import { makePlan } from './planner.js';
import { runCoder } from './coder.js';
import { newChangeSet } from './tools.js';
import {
  commitAll,
  createBranch,
  currentBranch,
  hasUncommittedChanges,
  parseOriginRepo,
  push,
  slugify,
} from './git.js';
import { defaultBranch, openPullRequest } from './github.js';

const ROOT = process.cwd();

interface Cli {
  autopilot: boolean;
  dryRun: boolean;
  request: string;
}

function parseArgs(argv: string[]): Cli {
  const args = argv.slice(2);
  const autopilot = args.includes('--yes') || args.includes('-y');
  const dryRun = args.includes('--dry-run');
  const request = args.filter((a) => !a.startsWith('-')).join(' ').trim();
  return { autopilot, dryRun, request };
}

async function confirmOrExit(message: string, autopilot: boolean): Promise<void> {
  if (autopilot) return;
  const ok = await p.confirm({ message });
  if (p.isCancel(ok) || !ok) {
    p.cancel('Operação interrompida por você.');
    process.exit(0);
  }
}

/** Resolve/ajusta os motores checando se o Ollama está disponível de fato. */
async function resolveEngines(config: AgentConfig): Promise<AgentConfig> {
  const needsOllama = config.coder === 'ollama' || config.planner === 'ollama';
  if (!needsOllama) return config;

  const up = await isOllamaReachable(config);
  if (up) {
    const models = await listOllamaModels(config);
    if (models.length && !models.some((m) => m.startsWith(config.ollama.model.split(':')[0]))) {
      p.log.warn(
        `Ollama está rodando, mas o modelo "${config.ollama.model}" não foi encontrado.\n` +
          `Modelos disponíveis: ${models.join(', ')}\n` +
          `Baixe com:  ollama pull ${config.ollama.model}`,
      );
    }
    return config;
  }

  // Ollama caiu → tenta cair para o Gemini onde for possível.
  const hasGemini = Boolean(config.gemini.apiKey);
  if (!hasGemini) {
    p.log.error(
      'O Ollama não está acessível em ' +
        config.ollama.baseURL +
        ' e não há GEMINI_API_KEY para fallback.\n' +
        'Suba o Ollama (`ollama serve`) ou configure a chave do Gemini.',
    );
    process.exit(1);
  }
  p.log.warn('Ollama indisponível — usando Gemini como fallback nesta execução.');
  return {
    ...config,
    coder: config.coder === 'ollama' ? 'gemini' : config.coder,
    planner: config.planner === 'ollama' ? 'gemini' : config.planner,
  };
}

function engineLabel(engine: Engine, config: AgentConfig): string {
  return engine === 'gemini' ? `Gemini (${config.gemini.model})` : `Ollama local (${config.ollama.model})`;
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv);
  let config = loadConfig({ autopilot: cli.autopilot, dryRun: cli.dryRun });

  p.intro('🤖 Agente de melhoria do SGP');
  config = await resolveEngines(config);

  p.log.info(
    [
      `Motor de PLANEJAMENTO/ENTREVISTA: ${engineLabel(config.planner, config)}`,
      `Motor de CÓDIGO:                 ${engineLabel(config.coder, config)}`,
      config.dryRun ? 'Modo: DRY-RUN (não commita/push/PR)' : 'Modo: completo (commit + push + PR)',
    ].join('\n'),
  );

  if (config.coder === 'ollama') {
    p.log.warn(
      'Você escolheu escrever código com o modelo LOCAL. Modelos pequenos erram muito em ' +
        'React/TypeScript e podem quebrar o build. Recomendado: AGENT_CODER=gemini.',
    );
  }

  // 0) Estado do git.
  if (hasUncommittedChanges(ROOT)) {
    p.log.warn(
      `A árvore de trabalho tem mudanças não commitadas (branch atual: ${currentBranch(ROOT)}). ` +
        'Elas serão incluídas na branch do agente.',
    );
    await confirmOrExit('Continuar mesmo assim?', config.autopilot);
  }

  // 1) Contexto do repositório.
  const ctx = gatherRepoContext(ROOT);

  // 2) Pedido inicial.
  let request = cli.request;
  if (!request) {
    const answer = await p.text({
      message: 'O que você precisa? (descreva a melhoria/mudança que quer no SGP)',
      placeholder: 'Ex: melhorar o dashboard de finanças e remover o que não uso',
    });
    if (p.isCancel(answer)) {
      p.cancel('Até logo!');
      process.exit(0);
    }
    request = String(answer);
  }

  // 3) Entrevista → tarefa.
  const plannerModel = getModel(config, config.planner);
  const task = await runInterview(plannerModel, ctx, request);
  p.note(task, '📋 Tarefa entendida');
  await confirmOrExit('Esse é o objetivo correto?', config.autopilot);

  // 4) Plano.
  const planSpin = p.spinner();
  planSpin.start('Montando o plano de implementação…');
  const plan = await makePlan(plannerModel, ctx, task);
  planSpin.stop('Plano pronto.');
  p.note(plan, '🗺️  Plano');
  await confirmOrExit('Posso implementar seguindo esse plano?', config.autopilot);

  // 5) Branch dedicada.
  const branch = createBranch(ROOT, slugify(task.split('\n')[0]));
  p.log.step(`Branch criada: ${branch}`);

  // 6) Implementação autônoma.
  const changes = newChangeSet();
  const coderModel = getModel(config, config.coder);
  p.log.info('Implementando (o agente vai ler, editar e testar sozinho)…');
  await runCoder({
    model: coderModel,
    ctx,
    task,
    plan,
    changes,
    maxSteps: config.maxSteps,
    log: (m) => p.log.message(m),
  });

  const touched = [...changes.written].map((f) => `+ ${f}`).concat([...changes.deleted].map((f) => `- ${f}`));
  if (touched.length === 0) {
    p.log.error('O agente não alterou nenhum arquivo. Talvez a tarefa precise ser mais específica.');
    p.outro('Nada a commitar.');
    return;
  }
  p.note(touched.join('\n'), '📝 Arquivos alterados');
  if (changes.summary) p.note(changes.summary, '✅ Resumo do agente');

  if (config.dryRun) {
    p.log.info('DRY-RUN: as edições estão na branch, mas não vou commitar/push/PR. Revise com `git diff`.');
    p.outro('Concluído (dry-run).');
    return;
  }

  // 7) Commit.
  await confirmOrExit('Fazer commit dessas mudanças?', config.autopilot);
  const prTitle = changes.prTitle || `Melhoria: ${task.split('\n')[0].slice(0, 60)}`;
  const commitMsg = `${prTitle}\n\n${changes.summary ?? ''}`.trim();
  commitAll(ROOT, commitMsg);
  p.log.step('Commit criado.');

  // 8) Push.
  await confirmOrExit('Enviar (push) a branch para o GitHub?', config.autopilot);
  const pushSpin = p.spinner();
  pushSpin.start('Fazendo push…');
  push(ROOT, branch);
  pushSpin.stop('Push concluído.');

  // 9) Pull Request.
  const repo = parseOriginRepo(ROOT);
  if (!repo) {
    p.log.warn('Não consegui identificar owner/repo do remote origin. Abra o PR manualmente.');
    p.outro('Feito (sem PR automático).');
    return;
  }

  if (!config.github.token) {
    const compare = `https://github.com/${repo.owner}/${repo.repo}/compare/…${branch}?expand=1`;
    p.log.warn(
      'Sem GITHUB_TOKEN — não abro o PR automaticamente.\n' +
        `Abra manualmente aqui: ${compare}\n` +
        '(Crie um token em github.com/settings/tokens com escopo "repo" e exporte GITHUB_TOKEN.)',
    );
    p.outro('Branch no GitHub, pronta para virar PR.');
    return;
  }

  await confirmOrExit('Abrir o Pull Request agora?', config.autopilot);
  const base = await resolveBase(config.github.token, repo.owner, repo.repo);
  const prSpin = p.spinner();
  prSpin.start('Abrindo Pull Request…');
  try {
    const pr = await openPullRequest({
      token: config.github.token,
      owner: repo.owner,
      repo: repo.repo,
      head: branch,
      base,
      title: prTitle,
      body: buildPrBody(changes.prBody, task, plan, touched),
    });
    prSpin.stop('Pull Request aberto!');
    p.outro(`🎉 PR #${pr.number}: ${pr.url}`);
  } catch (err) {
    prSpin.stop('Falha ao abrir o PR.');
    p.log.error(String((err as Error).message));
    p.outro('A branch está no GitHub; você pode abrir o PR manualmente.');
  }
}

async function resolveBase(token: string, owner: string, repo: string): Promise<string> {
  try {
    return await defaultBranch(token, owner, repo);
  } catch {
    try {
      const ref = execFileSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim();
      return ref.replace('refs/remotes/origin/', '') || 'master';
    } catch {
      return 'master';
    }
  }
}

function buildPrBody(agentBody: string | null, task: string, plan: string, touched: string[]): string {
  return [
    agentBody?.trim() || '## O que muda\n\n' + task,
    '',
    '## Plano seguido',
    '',
    plan,
    '',
    '## Arquivos alterados',
    '',
    touched.map((t) => `- \`${t}\``).join('\n'),
    '',
    '---',
    '_Gerado automaticamente pelo agente local do SGP (motor híbrido Ollama + Gemini)._',
  ].join('\n');
}

main().catch((err) => {
  p.log.error(String((err as Error).stack || err));
  process.exit(1);
});
