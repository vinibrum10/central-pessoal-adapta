import type { EnglishCefrLevel, EnglishLevel } from '../types/englishStudy';

/**
 * Fallback local de vídeos do "Inglês Diário", usado quando VITE_YOUTUBE_API_KEY
 * não está configurada ou a API do YouTube falha/está sem cota.
 *
 * A seleção de vídeo (src/services/dailyVideoSelector.ts) NÃO depende de ter
 * um vídeo de todos os 6 níveis aqui — ela relaxa nível e duração
 * progressivamente e, em último caso, reaproveita um vídeo já assistido em
 * modo revisão. Então é seguro ter poucos vídeos: o app nunca trava, mas
 * quanto mais vídeos (e mais variados em nível/duração), melhor a
 * experiência sem a API configurada.
 *
 * Como adicionar um vídeo novo com segurança:
 * 1. Confirme no YouTube que o vídeo permite incorporação (não é um vídeo
 *    com "assistir no YouTube" forçado) e que é público.
 * 2. Pegue o ID de 11 caracteres da URL (ex.: youtube.com/watch?v=XXXXXXXXXXX).
 * 3. Preencha durationSeconds com a duração REAL do vídeo (em segundos) —
 *    se errado, o vídeo pode ser descartado pelo filtro de duração ou o
 *    progresso de "assistido" fica incorreto.
 * 4. cefrLevel deve ser um de: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'.
 *    Vídeos C1/C2 (avançado) são os mais úteis aqui, já que a seção usa
 *    nível "Avançado" por padrão e cai para B1/B2 só como fallback.
 * 5. NUNCA invente um videoId — um ID errado carrega um vídeo aleatório (ou
 *    nenhum) e quebra a experiência. Se não puder validar o vídeo agora,
 *    não adicione a entrada.
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

export const dailyEnglishVideos: DailyEnglishVideo[] = [
  {
    videoId: 'n3kNlFMXslo',
    title: 'How to Introduce Yourself in English',
    channel: 'English with Emma',
    level: 'iniciante',
    cefrLevel: 'A2',
    theme: 'Apresentação pessoal',
    durationSeconds: 360,
    summary: [
      'The video teaches learners how to introduce themselves in simple English.',
      'It covers common personal information such as name, country, job, studies, hobbies, and simple polite phrases.',
      'Learners practice natural sentences like saying where they are from and what they do.',
    ].join(' '),
  },
  {
    videoId: 'qZhl1UDf63s',
    title: 'Learn English Conversation: Daily Routine',
    channel: 'English Singsing',
    level: 'iniciante',
    cefrLevel: 'A1',
    theme: 'Rotina diária',
    durationSeconds: 300,
    summary: [
      'The video presents basic daily routine vocabulary and short conversations.',
      'It focuses on actions such as waking up, eating breakfast, going to work or school, studying, and going to bed.',
      'The language is simple and useful for describing a normal day.',
    ].join(' '),
  },
  {
    videoId: 'HAnw168huqA',
    title: 'English Conversation Practice: At the Restaurant',
    channel: 'Learn English with EnglishClass101.com',
    level: 'intermediário',
    cefrLevel: 'B1',
    theme: 'Restaurante',
    durationSeconds: 420,
    summary: [
      'The video practices a restaurant conversation in English.',
      'It includes useful phrases for asking for a menu, ordering food, asking questions about dishes, and paying the bill.',
      'The learner hears polite requests and common service interactions.',
    ].join(' '),
  },
  {
    videoId: 'F4Zu5ZZAG7I',
    title: 'Business English Conversation: Meetings',
    channel: 'Learn English with Rebecca',
    level: 'intermediário',
    cefrLevel: 'B1',
    theme: 'Reuniões de trabalho',
    durationSeconds: 480,
    summary: [
      'The video introduces practical English for work meetings.',
      'It covers phrases for starting a meeting, sharing opinions, asking for clarification, agreeing, disagreeing politely, and closing a discussion.',
      'The focus is professional communication with clear and useful expressions.',
    ].join(' '),
  },
];

export function getDailyEnglishVideoById(videoId: string) {
  return dailyEnglishVideos.find(video => video.videoId === videoId) ?? dailyEnglishVideos[0];
}
