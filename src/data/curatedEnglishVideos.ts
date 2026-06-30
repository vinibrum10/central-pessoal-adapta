import type { CuratedEnglishVideo, EnglishCefrLevel, CuratedVideoLevelGroup } from '../types/englishStudy';

/**
 * ============================================================
 * BANCO CURADO DE VÍDEOS — "Inglês Diário"
 * ============================================================
 *
 * Esta é a FONTE PRINCIPAL da aula diária. A API do YouTube
 * (src/services/youtubeEnglish.ts) só é usada para DESCOBRIR e VALIDAR
 * candidatos novos (ver `discoverYouTubeCandidates` em
 * src/services/englishVideoLibrary.ts) — a rotina diária do usuário nunca
 * depende de uma busca ao vivo na API para funcionar.
 *
 * Por quê: depender de busca em tempo real deixava o app frágil (quota
 * excedida, vídeo sem permissão de incorporação, região bloqueada, rede
 * instável) e o usuário ficava preso em "Vídeo indisponível". Com um banco
 * curado, o pior caso é sempre "modo revisão" — nunca uma tela travada.
 *
 * ------------------------------------------------------------
 * COMO ADICIONAR UM VÍDEO NOVO (sem internet/API disponível agora):
 * ------------------------------------------------------------
 * 1. NUNCA invente um youtubeVideoId. Um ID errado carrega um vídeo
 *    aleatório (ou nenhum) e quebra a experiência — pior que não adicionar.
 * 2. Confirme manualmente no YouTube que o vídeo:
 *    - é público;
 *    - permite incorporação (não força "Assistir no YouTube");
 *    - tem áudio em inglês claro.
 * 3. Pegue o ID de 11 caracteres da URL: youtube.com/watch?v=XXXXXXXXXXX
 *    (ou youtu.be/XXXXXXXXXXX).
 * 4. Preencha durationSeconds com a duração REAL em segundos — se errado,
 *    o vídeo pode ser descartado pelo filtro de duração do seletor.
 * 5. cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'.
 *    levelGroup: 'beginner' (A1/A2) | 'intermediate' (B1/B2) | 'advanced' (C1/C2).
 *    O Inglês Diário usa nível "Avançado" (advanced) por padrão e relaxa
 *    para intermediate/beginner só como fallback — vídeos C1/C2 são os
 *    mais valiosos para adicionar aqui.
 * 6. status inicial: 'active' se você já confirmou os itens do passo 2,
 *    ou 'needs_validation' se quiser cadastrar mas ainda não confirmou.
 *    Vídeos 'needs_validation' NÃO entram na seleção da aula diária até
 *    alguém revisar e trocar para 'active' (ver englishVideoSelector).
 * 7. Rode `npm run build` depois de editar — erros de tipo aqui pegam
 *    campos esquecidos.
 *
 * Meta de longo prazo: pelo menos 30 vídeos ativos cobrindo os 6 níveis e
 * vários temas, para a aula nunca repetir o mesmo vídeo por semanas. Esta
 * estrutura já suporta qualquer quantidade — adicione quantas entradas
 * quiser ao array abaixo, sem precisar mudar nenhum outro arquivo.
 *
 * ------------------------------------------------------------
 * COMO DESCOBRIR CANDIDATOS COM A API (quando VITE_YOUTUBE_API_KEY existir):
 * ------------------------------------------------------------
 * Use `discoverYouTubeCandidates()` de src/services/englishVideoLibrary.ts
 * (chamada manual via DevTools/console ou de uma futura tela de admin) —
 * ela busca na API, valida duração/embeddable/status e devolve objetos
 * `CuratedEnglishVideo` prontos com status 'needs_validation'. Revise o
 * resultado e cole as entradas aprovadas aqui, trocando o status para
 * 'active'.
 */

const SEED_VALIDATED_AT = '2026-06-30T00:00:00.000Z';

function levelGroupFor(cefrLevel: EnglishCefrLevel): CuratedVideoLevelGroup {
  if (cefrLevel === 'A1' || cefrLevel === 'A2') return 'beginner';
  if (cefrLevel === 'B1' || cefrLevel === 'B2') return 'intermediate';
  return 'advanced';
}

export const CURATED_ENGLISH_VIDEOS: CuratedEnglishVideo[] = [
  {
    id: 'curated-n3kNlFMXslo',
    youtubeVideoId: 'n3kNlFMXslo',
    title: 'How to Introduce Yourself in English',
    channelTitle: 'English with Emma',
    durationSeconds: 360,
    cefrLevel: 'A2',
    levelGroup: levelGroupFor('A2'),
    themes: ['Apresentação pessoal'],
    skills: ['listening', 'shadowing'],
    source: 'curated',
    status: 'active',
    embeddable: true,
    validatedAt: SEED_VALIDATED_AT,
    useCount: 0,
    failureCount: 0,
    summary: [
      'The video teaches learners how to introduce themselves in simple English.',
      'It covers common personal information such as name, country, job, studies, hobbies, and simple polite phrases.',
      'Learners practice natural sentences like saying where they are from and what they do.',
    ].join(' '),
    shadowingSentences: [
      { text: 'Hi, my name is Anna and I am from Brazil.', difficulty: 'easy' },
      { text: 'I work as a designer and I really enjoy my job.', difficulty: 'easy' },
      { text: 'In my free time, I like reading and traveling.', difficulty: 'medium' },
    ],
    suggestedVocabularyCards: [
      { word: 'to introduce yourself', phrase: 'Let me introduce myself.', translation: 'se apresentar', difficulty: 'easy' },
      { word: 'in my free time', phrase: 'In my free time, I like to read.', translation: 'no meu tempo livre', difficulty: 'easy' },
    ],
    notes: 'Vídeo básico para A2 — bom primeiro vídeo para iniciantes.',
  },
  {
    id: 'curated-qZhl1UDf63s',
    youtubeVideoId: 'qZhl1UDf63s',
    title: 'Learn English Conversation: Daily Routine',
    channelTitle: 'English Singsing',
    durationSeconds: 300,
    cefrLevel: 'A1',
    levelGroup: levelGroupFor('A1'),
    themes: ['Rotina diária'],
    skills: ['listening', 'shadowing'],
    source: 'curated',
    status: 'active',
    embeddable: true,
    validatedAt: SEED_VALIDATED_AT,
    useCount: 0,
    failureCount: 0,
    summary: [
      'The video presents basic daily routine vocabulary and short conversations.',
      'It focuses on actions such as waking up, eating breakfast, going to work or school, studying, and going to bed.',
      'The language is simple and useful for describing a normal day.',
    ].join(' '),
    shadowingSentences: [
      { text: 'I wake up at seven o’clock every morning.', difficulty: 'easy' },
      { text: 'After breakfast, I go to work.', difficulty: 'easy' },
      { text: 'I usually go to bed around eleven at night.', difficulty: 'easy' },
    ],
    suggestedVocabularyCards: [
      { word: 'to wake up', phrase: 'I wake up at seven.', translation: 'acordar', difficulty: 'easy' },
      { word: 'daily routine', translation: 'rotina diária', difficulty: 'easy' },
    ],
    notes: 'Vídeo A1 — vocabulário essencial de rotina diária.',
  },
  {
    id: 'curated-HAnw168huqA',
    youtubeVideoId: 'HAnw168huqA',
    title: 'English Conversation Practice: At the Restaurant',
    channelTitle: 'Learn English with EnglishClass101.com',
    durationSeconds: 420,
    cefrLevel: 'B1',
    levelGroup: levelGroupFor('B1'),
    themes: ['Restaurante'],
    skills: ['listening', 'shadowing'],
    source: 'curated',
    status: 'active',
    embeddable: true,
    validatedAt: SEED_VALIDATED_AT,
    useCount: 0,
    failureCount: 0,
    summary: [
      'The video practices a restaurant conversation in English.',
      'It includes useful phrases for asking for a menu, ordering food, asking questions about dishes, and paying the bill.',
      'The learner hears polite requests and common service interactions.',
    ].join(' '),
    shadowingSentences: [
      { text: 'Could I see the menu, please?', difficulty: 'medium' },
      { text: 'I would like to order the grilled chicken.', difficulty: 'medium' },
      { text: 'Could we have the bill, please?', difficulty: 'medium' },
    ],
    suggestedVocabularyCards: [
      { word: 'to order', phrase: 'I would like to order the chicken.', translation: 'pedir (no restaurante)', difficulty: 'medium' },
      { word: 'the bill', phrase: 'Could we have the bill, please?', translation: 'a conta', difficulty: 'medium' },
    ],
    notes: 'Vídeo B1 — útil para viagens e situações de atendimento.',
  },
  {
    id: 'curated-F4Zu5ZZAG7I',
    youtubeVideoId: 'F4Zu5ZZAG7I',
    title: 'Business English Conversation: Meetings',
    channelTitle: 'Learn English with Rebecca',
    durationSeconds: 480,
    cefrLevel: 'B1',
    levelGroup: levelGroupFor('B1'),
    themes: ['Reuniões de trabalho'],
    skills: ['listening', 'shadowing'],
    source: 'curated',
    status: 'active',
    embeddable: true,
    validatedAt: SEED_VALIDATED_AT,
    useCount: 0,
    failureCount: 0,
    summary: [
      'The video introduces practical English for work meetings.',
      'It covers phrases for starting a meeting, sharing opinions, asking for clarification, agreeing, disagreeing politely, and closing a discussion.',
      'The focus is professional communication with clear and useful expressions.',
    ].join(' '),
    shadowingSentences: [
      { text: 'Let’s get started with today’s meeting.', difficulty: 'medium' },
      { text: 'Could you clarify that point, please?', difficulty: 'medium' },
      { text: 'I completely agree with that idea.', difficulty: 'easy' },
    ],
    suggestedVocabularyCards: [
      { word: 'to clarify', phrase: 'Could you clarify that point?', translation: 'esclarecer', difficulty: 'medium' },
      { word: 'to get started', phrase: 'Let’s get started.', translation: 'começar', difficulty: 'easy' },
    ],
    notes: 'Vídeo B1 — inglês corporativo, bom para quem usa inglês no trabalho.',
  },
];

export function getCuratedVideoById(youtubeVideoId: string): CuratedEnglishVideo | undefined {
  return CURATED_ENGLISH_VIDEOS.find(video => video.youtubeVideoId === youtubeVideoId);
}
