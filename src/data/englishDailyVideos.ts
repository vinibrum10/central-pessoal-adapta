import type { EnglishCefrLevel, EnglishLevel } from '../types/englishStudy';

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
