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

export function getModel(config: AgentConfig, engine: Engine): LanguageModel {
  if (engine === 'gemini') {
    if (!config.gemini.apiKey) {
      throw new Error(
        'Gemini foi selecionado mas GEMINI_API_KEY não está definida. ' +
          'Defina AGENT_CODER=ollama para rodar 100% local, ou configure a chave.',
      );
    }
    const google = createGoogleGenerativeAI({ apiKey: config.gemini.apiKey });
    return google(config.gemini.model);
  }

  const ollama = createOllama({ baseURL: config.ollama.baseURL });
  return ollama(config.ollama.model);
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
