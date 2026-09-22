/**
 * Camada de acesso aos modelos de IA usando o Vercel AI SDK (o "framework"
 * gratuito e open-source que unifica Ollama e Gemini sob a MESMA interface).
 *
 * POR QUE O AI SDK:
 *  - Uma única API (`generateText` / `streamText` / `tool`) funciona tanto para
 *    o modelo local (Ollama) quanto para o Gemini. Trocar de motor vira trocar
 *    de string, sem reescrever a lógica do agente.
 *  - Tool calling (função-chamada) nativo: é o que permite o agente LER e
 *    ESCREVER arquivos e RODAR testes de forma autônoma.
 *  - Zero custo: o SDK é MIT; Ollama é local; Gemini tem free tier.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';
import type { AgentConfig, Engine } from './config.js';

/**
 * Cria um `fetch` que serializa e ESPAÇA as chamadas em pelo menos
 * `minIntervalMs`. Serve para respeitar PROATIVAMENTE o limite de requisições
 * por minuto do free tier do Gemini (em vez de só reagir ao erro 429).
 */
function createThrottledFetch(minIntervalMs: number): typeof fetch {
  let last = 0;
  let chain: Promise<unknown> = Promise.resolve();
  const throttled = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const run = async () => {
      const wait = Math.max(0, last + minIntervalMs - Date.now());
      if (wait) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
      return fetch(input, init);
    };
    const result = chain.then(run, run);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  return throttled as typeof fetch;
}

export function getModel(config: AgentConfig, engine: Engine): LanguageModel {
  if (engine === 'gemini') {
    if (!config.gemini.apiKey) {
      throw new Error(
        'Gemini foi selecionado mas GEMINI_API_KEY não está definida. ' +
          'Defina AGENT_CODER=ollama para rodar 100% local, ou configure a chave.',
      );
    }
    const google = createGoogleGenerativeAI({
      apiKey: config.gemini.apiKey,
      fetch: createThrottledFetch(config.gemini.minIntervalMs),
    });
    return google(config.gemini.model);
  }

  // IMPORTANTE: usar .chat() → endpoint nativo /api/chat do Ollama.
  // O callable padrão ollama(modelId) usa a API "responses", que o Ollama não
  // expõe (resulta em 404 Not Found).
  const ollama = createOllama({ baseURL: config.ollama.baseURL, compatibility: 'strict' });
  return ollama.chat(config.ollama.model);
}

/**
 * Verifica se o Ollama está de pé na máquina. Usado para dar mensagens úteis
 * (e para fazer fallback automático para o Gemini quando o Ollama não responde).
 */
export async function isOllamaReachable(config: AgentConfig): Promise<boolean> {
  // baseURL costuma terminar em /api → a raiz responde "Ollama is running".
  const root = config.ollama.baseURL.replace(/\/api\/?$/, '');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(root, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Lista os modelos já baixados no Ollama (para avisar se o modelo pedido não existe). */
export async function listOllamaModels(config: AgentConfig): Promise<string[]> {
  const base = config.ollama.baseURL.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/tags`);
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    return (data.models ?? []).map((m) => m.name ?? '').filter(Boolean);
  } catch {
    return [];
  }
}
