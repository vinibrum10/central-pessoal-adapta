// Origem das frases de shadowing, em ordem de preferência (quando a origem é "vídeo"):
//   1. Transcript/legenda real do vídeo (melhor esforço — depende de o vídeo
//      ter legendas públicas e do navegador conseguir buscá-las; em muitos
//      casos o YouTube bloqueia essa busca por CORS a partir do navegador,
//      então esta etapa falha silenciosamente e cai para a próxima).
//   2. Título + descrição reais do vídeo (via YouTube Data API).
//   3. Gemini gerando frases novas a partir do título, se não houver mais nada.
// Quando a origem é "tema manual", o Gemini gera frases direto a partir do
// tema digitado. Um fallback local fixo cobre o caso raro de a IA falhar
// durante o preenchimento automático de um vídeo novo (nunca deixa a seção
// vazia, mas deixa a origem clara como "fallback").
//
// A chave GEMINI_API_KEY nunca é lida aqui — só no backend
// (api/english/generate-shadowing-phrases.ts).

import { getDefaultShadowingPhrases, type ShadowingPhrase, type ShadowingPhraseSource } from './englishStorage';

export interface ShadowingPhraseSeed {
  text: string;
  translation: string;
}

interface GenerateShadowingPhrasesResponse {
  source: ShadowingPhraseSource;
  phrases: ShadowingPhraseSeed[];
}

interface ErrorResponse {
  success?: false;
  error?: string;
}

const GENERIC_ERROR = 'Não foi possível gerar frases de shadowing com a IA agora. Tente novamente em instantes.';
const MAX_TRANSCRIPT_EXCERPT = 8000;

export const NO_VIDEO_ERROR = 'Carregue um vídeo de shadowing para gerar frases com base nele.';
export const NO_THEME_ERROR = 'Informe um tema para gerar frases.';

function isSeed(value: unknown): value is ShadowingPhraseSeed {
  const seed = value as Partial<ShadowingPhraseSeed> | null;
  return Boolean(seed && typeof seed.text === 'string' && typeof seed.translation === 'string');
}

function isValidResponse(value: unknown): value is GenerateShadowingPhrasesResponse {
  const result = value as Partial<GenerateShadowingPhrasesResponse> | null;
  return Boolean(
    result
    && Array.isArray(result.phrases) && result.phrases.length > 0 && result.phrases.every(isSeed)
    && typeof result.source === 'string',
  );
}

/**
 * Tenta buscar a legenda/transcript pública de um vídeo do YouTube direto do
 * navegador (endpoint não-oficial `timedtext`, sem necessidade de API key).
 * Best-effort: navegadores costumam bloquear isso por CORS, então qualquer
 * falha (rede, CORS, sem legenda) retorna `null` silenciosamente — nunca
 * lança exceção nem trava a tela. Quando funciona, é a fonte mais fiel.
 */
export async function fetchVideoTranscriptBestEffort(videoId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://video.google.com/timedtext?lang=en&v=${encodeURIComponent(videoId)}`);
    if (!response.ok) return null;
    const xml = await response.text();
    if (!xml || !xml.includes('<text')) return null;

    const matches = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)];
    if (matches.length === 0) return null;

    const decoded = matches
      .map(match => match[1]
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim())
      .filter(Boolean)
      .join(' ');

    return decoded.slice(0, MAX_TRANSCRIPT_EXCERPT) || null;
  } catch {
    // CORS, rede indisponível, endpoint mudou etc. — tratado como "sem transcript".
    return null;
  }
}

async function callGenerateEndpoint(payload: {
  videoId?: string;
  videoTitle?: string;
  videoDescription?: string;
  transcriptExcerpt?: string;
  theme?: string;
  count?: number;
}): Promise<GenerateShadowingPhrasesResponse> {
  let response: Response;
  try {
    response = await fetch('/api/english/generate-shadowing-phrases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    console.error('[Shadowing] Network error calling /api/english/generate-shadowing-phrases', networkError);
    throw new Error('Sem conexão com o servidor de IA. Verifique sua internet e tente novamente.');
  }

  const data = await response.json().catch(() => ({})) as GenerateShadowingPhrasesResponse | ErrorResponse;
  if (!response.ok || !isValidResponse(data)) {
    const error = 'error' in data && typeof data.error === 'string' ? data.error : GENERIC_ERROR;
    console.error('[Shadowing] generate-shadowing-phrases request failed', { status: response.status, error });
    throw new Error(error);
  }
  return data;
}

function toShadowingPhrases(
  seeds: ShadowingPhraseSeed[],
  source: ShadowingPhraseSource,
  extra: { videoId?: string; videoUrl?: string; videoTitle?: string; theme?: string },
): ShadowingPhrase[] {
  const now = new Date().toISOString();
  return seeds.map((seed, index) => ({
    id: `${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    text: seed.text,
    translation: seed.translation,
    source,
    videoId: extra.videoId,
    videoUrl: extra.videoUrl,
    videoTitle: extra.videoTitle,
    theme: extra.theme,
    repetitionsDone: 0,
    repetitionsTarget: 5,
    completed: false,
    createdAt: now,
    updatedAt: now,
  }));
}

export interface ShadowingVideoContext {
  videoId?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoDescription?: string;
}

/**
 * Ação explícita do botão "Gerar com vídeo atual" — usa sempre o vídeo de
 * shadowing atualmente carregado (por `videoId`, mesmo sem título/descrição
 * — ex.: link colado manualmente), nunca um tema. Propaga o erro real em
 * caso de falha (não substitui por fallback silenciosamente): o usuário
 * pediu IA de forma explícita e precisa saber se ela não respondeu.
 */
export async function generateAiShadowingPhrasesFromVideo(
  context: ShadowingVideoContext,
  count = 5,
): Promise<ShadowingPhrase[]> {
  if (!context.videoId) {
    throw new Error(NO_VIDEO_ERROR);
  }

  const transcriptExcerpt = (await fetchVideoTranscriptBestEffort(context.videoId)) ?? undefined;

  const result = await callGenerateEndpoint({
    videoId: context.videoId,
    videoTitle: context.videoTitle,
    videoDescription: context.videoDescription,
    transcriptExcerpt,
    count,
  });

  return toShadowingPhrases(result.phrases, 'aiGeneratedFromVideo', {
    videoId: context.videoId,
    videoUrl: context.videoUrl,
    videoTitle: context.videoTitle,
  });
}

/**
 * Ação explícita do botão "Usar tema manual" — usa sempre o tema digitado,
 * nunca o vídeo carregado (mesmo que haja um). Isso deixa 100% claro qual
 * fonte foi usada: a escolha é do usuário, não uma prioridade implícita.
 */
export async function generateAiShadowingPhrasesFromTheme(theme: string, count = 5): Promise<ShadowingPhrase[]> {
  const trimmedTheme = theme.trim();
  if (!trimmedTheme) {
    throw new Error(NO_THEME_ERROR);
  }

  const result = await callGenerateEndpoint({ theme: trimmedTheme, count });

  return toShadowingPhrases(result.phrases, 'aiGeneratedFromTheme', { theme: trimmedTheme });
}

/**
 * Preenche automaticamente as frases de um vídeo novo de shadowing, tentando
 * nesta ordem: transcript real -> descrição real do vídeo -> IA a partir do
 * título -> fallback local fixo. Diferente das funções acima, esta NUNCA
 * lança exceção e NUNCA deixa a seção vazia — é uma ação automática de
 * fundo (dispara sozinha ao carregar um vídeo novo), não um clique
 * explícito em "gerar com IA".
 */
export async function generateShadowingPhrasesForVideo(
  context: ShadowingVideoContext,
  count = 5,
): Promise<ShadowingPhrase[]> {
  if (!context.videoId) return getDefaultShadowingPhrases();

  const transcriptExcerpt = (await fetchVideoTranscriptBestEffort(context.videoId)) ?? undefined;

  try {
    const result = await callGenerateEndpoint({
      videoId: context.videoId,
      videoTitle: context.videoTitle,
      videoDescription: context.videoDescription,
      transcriptExcerpt,
      count,
    });
    return toShadowingPhrases(result.phrases, result.source, {
      videoId: context.videoId,
      videoUrl: context.videoUrl,
      videoTitle: context.videoTitle,
    });
  } catch (error) {
    console.warn('[Shadowing] IA indisponível para gerar frases automaticamente — usando frases padrão (fallback).', error);
    return getDefaultShadowingPhrases().map(phrase => ({
      ...phrase,
      videoId: context.videoId,
      videoUrl: context.videoUrl,
      videoTitle: context.videoTitle,
    }));
  }
}
