import type { EnglishCefrLevel, EnglishLevel } from '../types/englishStudy';
import { CURATED_ENGLISH_VIDEOS } from './curatedEnglishVideos';
import { curatedToDailyVideo } from '../services/englishVideoLibrary';

/**
 * @deprecated Este arquivo é um shim de compatibilidade. A fonte real dos
 * vídeos do "Inglês Diário" agora é o BANCO CURADO em
 * src/data/curatedEnglishVideos.ts — adicione vídeos novos lá, não aqui.
 *
 * `DailyEnglishVideo` continua existindo porque é o formato que a página
 * (src/pages/Ingles.tsx) e o player usam para renderizar o vídeo atual;
 * `dailyEnglishVideos` abaixo é apenas a projeção dos vídeos curados
 * ATIVOS nesse formato, para não precisar reescrever toda a UI.
 *
 * Por que essa separação: o banco curado guarda metadados ricos (status,
 * useCount, failureCount, shadowingSentences, suggestedVocabularyCards)
 * que não fazem sentido no objeto "vídeo do dia" simples que o player
 * consome — ver src/services/englishVideoLibrary.ts para o adapter.
 */
export interface DailyEnglishVideo {
  videoId: string;
  title: string;
  channel: string;
  level: EnglishLevel;
  cefrLevel: EnglishCefrLevel;
  theme: string;
  durationSeconds: number;
  summary: string;
  transcript?: string;
}

/** Projeção dos vídeos curados ATIVOS no formato DailyEnglishVideo (usado pelo seletor/player). */
export const dailyEnglishVideos: DailyEnglishVideo[] = CURATED_ENGLISH_VIDEOS
  .filter(video => video.status === 'active')
  .map(curatedToDailyVideo);

export function getDailyEnglishVideoById(videoId: string) {
  return dailyEnglishVideos.find(video => video.videoId === videoId) ?? dailyEnglishVideos[0];
}
