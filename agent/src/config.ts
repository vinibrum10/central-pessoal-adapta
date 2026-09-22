/**
 * Configuração central do agente.
 *
 * POR QUE ESTE ARQUIVO EXISTE:
 * Concentrar num único lugar toda a leitura de variáveis de ambiente e a
 * decisão de "qual motor de IA usar para qual tarefa". Assim o resto do
 * código nunca lê `process.env` diretamente — ele só pergunta ao `config`
 * "qual é o modelo do coder?" e recebe a resposta já resolvida (com fallback).
 *
 * MOTOR HÍBRIDO (Ollama local + Gemini):
 *  - Ollama roda 100% na sua máquina, offline, sem chave e sem custo. É ótimo
 *    para tarefas onde privacidade importa (entender seu pedido, resumir seus
 *    dados) e para classificação/planejamento simples.
 *  - Gemini é muito mais forte em RACIOCÍNIO DE CÓDIGO, mas seus dados saem da
 *    máquina e há cota diária no free tier. Por isso ele é o padrão para
 *    ESCREVER código, não para as etapas sensíveis.
 *
 * Você controla tudo por variáveis de ambiente (veja agent/README.md).
 */

export type Engine = 'ollama' | 'gemini';

export interface AgentConfig {
  /** Motor usado para ESCREVER/EDITAR código (loop de ferramentas). */
  coder: Engine;
  /** Motor usado para ENTREVISTA + PLANEJAMENTO (etapas sensíveis/leves). */
  planner: Engine;

  gemini: {
    apiKey: string | undefined;
    model: string;
    /** Intervalo mínimo entre chamadas ao Gemini (ms), para respeitar o RPM do free tier. */
    minIntervalMs: number;
  };
  ollama: {
    baseURL: string;
    model: string;
  };

  github: {
    token: string | undefined;
  };

  /** Quantas vezes repetir uma chamada que falhou (ex.: 429 de cota) antes de desistir. */
  maxRetries: number;
  /** Se true, não pede confirmação humana antes de commit/push/PR. */
  autopilot: boolean;
  /** Máximo de passos (chamadas de ferramenta) que o coder pode dar por tarefa. */
  maxSteps: number;
  /** true = só planeja e edita arquivos, mas NÃO faz commit/push/PR. */
  dryRun: boolean;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(v.toLowerCase());
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function pickEngine(explicit: string | undefined, preferForCode: boolean, hasGemini: boolean): Engine {
  // 1) Se o usuário forçou explicitamente, respeitamos.
  if (explicit === 'ollama' || explicit === 'gemini') return explicit;
  // 2) Sem chave Gemini → só resta Ollama.
  if (!hasGemini) return 'ollama';
  // 3) Escrita de código prefere Gemini; etapas leves preferem Ollama (privado + grátis).
  return preferForCode ? 'gemini' : 'ollama';
}

export function loadConfig(cliFlags: { autopilot?: boolean; dryRun?: boolean } = {}): AgentConfig {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const hasGemini = Boolean(geminiKey && geminiKey.trim() && geminiKey !== 'your_gemini_api_key_here');

  return {
    coder: pickEngine(process.env.AGENT_CODER, /* preferForCode */ true, hasGemini),
    planner: pickEngine(process.env.AGENT_PLANNER, /* preferForCode */ false, hasGemini),
    gemini: {
      apiKey: geminiKey,
      // Padrão: flash-lite tem cota gratuita MUITO maior (mais req/min e req/dia)
      // que o 2.5-flash — essencial para o loop do agente não estourar o free tier.
      // Variável própria do agente (AGENT_GEMINI_MODEL) para não afetar o
      // GEMINI_MODEL que o app usa no servidor (api/english/*).
      model: process.env.AGENT_GEMINI_MODEL || 'gemini-2.5-flash-lite',
      minIntervalMs: envInt('AGENT_MIN_INTERVAL_MS', 4500),
    },
    ollama: {
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
      model: process.env.AGENT_OLLAMA_MODEL || 'qwen2.5-coder:7b',
    },
    github: {
      token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
    },
    maxRetries: envInt('AGENT_MAX_RETRIES', 6),
    autopilot: cliFlags.autopilot ?? envBool('AGENT_AUTOPILOT', false),
    maxSteps: envInt('AGENT_MAX_STEPS', 40),
    dryRun: cliFlags.dryRun ?? envBool('AGENT_DRY_RUN', false),
  };
}
