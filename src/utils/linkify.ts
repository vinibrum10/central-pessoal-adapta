const URL_PATTERN = /https?:\/\/[^\s]+/g;
// Pontuação de frase e marcadores de markdown que costumam ficar colados no fim de uma URL
// dentro de texto corrido — não fazem parte do link em si.
const SUFIXO_RE = /[),.;:!?'"*`\]]+$/;

export interface UrlMatch {
  start: number;
  end: number;
  url: string;
  sufixo: string;
}

/**
 * Encontra todas as URLs http(s) soltas dentro de um texto, separando pontuação de frase e
 * marcadores de markdown (ex.: "**url**.") da URL em si, sem perder esses caracteres — eles
 * voltam para o texto ao redor do link em vez de virarem parte do href ou desaparecerem.
 */
export function encontrarUrls(texto: string): UrlMatch[] {
  const matches: UrlMatch[] = [];
  for (const match of texto.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const bruto = match[0];
    const sufixoMatch = bruto.match(SUFIXO_RE);
    const sufixo = sufixoMatch ? sufixoMatch[0] : '';
    const url = sufixo ? bruto.slice(0, -sufixo.length) : bruto;
    if (!url) continue;
    matches.push({ start, end: start + bruto.length, url, sufixo });
  }
  return matches;
}
