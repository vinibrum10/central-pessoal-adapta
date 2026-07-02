import { GoogleGenAI } from '@google/genai';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

declare const process: {
  env: Record<string, string | undefined>;
};

type AnalyzeJobTargetRequest = {
  title?: string;
  company?: string;
  location?: string;
  jobDescription?: string;
};

type ServerRequest = {
  method?: string;
  body?: unknown;
};

type ServerResponse = {
  status: (code: number) => ServerResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type JobTargetAnalysis = {
  summary_pt: string;
  role_type: string;
  required_skills: string[];
  preferred_skills: string[];
  technical_keywords: string[];
  missing_vocabulary: string[];
  likely_interview_questions: string[];
  star_story_suggestions: string[];
  match_score: number;
  strengths_pt: string[];
  gaps_pt: string[];
  study_plan_7_days_pt: string[];
  recommended_mock_focus: string;
};

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_BODY_CHARS = 120_000;
const MAX_DESCRIPTION_LENGTH = 15_000;
const MAX_FIELD_LENGTH = 300;
const LOCAL_ENV_FILES = ['.env.local', '.env'];

const stringArray = (maxItems: number) => ({
  type: 'array',
  maxItems,
  items: { type: 'string' },
});

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary_pt',
    'role_type',
    'required_skills',
    'preferred_skills',
    'technical_keywords',
    'missing_vocabulary',
    'likely_interview_questions',
    'star_story_suggestions',
    'match_score',
    'strengths_pt',
    'gaps_pt',
    'study_plan_7_days_pt',
    'recommended_mock_focus',
  ],
  properties: {
    summary_pt: { type: 'string' },
    role_type: { type: 'string' },
    required_skills: stringArray(12),
    preferred_skills: stringArray(12),
    technical_keywords: stringArray(15),
    missing_vocabulary: stringArray(15),
    likely_interview_questions: stringArray(10),
    star_story_suggestions: stringArray(6),
    match_score: { type: 'integer', minimum: 0, maximum: 10 },
    strengths_pt: stringArray(6),
    gaps_pt: stringArray(6),
    study_plan_7_days_pt: { type: 'array', minItems: 7, maxItems: 7, items: { type: 'string' } },
    recommended_mock_focus: { type: 'string' },
  },
};

const STRING_ARRAY_FIELDS: Array<keyof JobTargetAnalysis> = [
  'required_skills',
  'preferred_skills',
  'technical_keywords',
  'missing_vocabulary',
  'likely_interview_questions',
  'star_story_suggestions',
  'strengths_pt',
  'gaps_pt',
  'study_plan_7_days_pt',
];

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): AnalyzeJobTargetRequest {
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_CHARS) {
      throw new Error('A descrição da vaga está grande demais para análise. Cole apenas o conteúdo principal da vaga.');
    }
    return JSON.parse(body) as AnalyzeJobTargetRequest;
  }
  return (body ?? {}) as AnalyzeJobTargetRequest;
}

function trimString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validateAnalysis(value: unknown): JobTargetAnalysis | null {
  const analysis = value as Partial<JobTargetAnalysis> | null;
  if (!analysis) return null;

  if (
    typeof analysis.summary_pt !== 'string'
    || typeof analysis.role_type !== 'string'
    || typeof analysis.recommended_mock_focus !== 'string'
    || typeof analysis.match_score !== 'number'
    || !Number.isFinite(analysis.match_score)
    || analysis.match_score < 0
    || analysis.match_score > 10
  ) {
    return null;
  }

  for (const field of STRING_ARRAY_FIELDS) {
    const items = analysis[field];
    if (!Array.isArray(items) || !items.every(item => typeof item === 'string')) return null;
  }

  return {
    summary_pt: analysis.summary_pt,
    role_type: analysis.role_type,
    required_skills: (analysis.required_skills as string[]).slice(0, 12),
    preferred_skills: (analysis.preferred_skills as string[]).slice(0, 12),
    technical_keywords: (analysis.technical_keywords as string[]).slice(0, 15),
    missing_vocabulary: (analysis.missing_vocabulary as string[]).slice(0, 15),
    likely_interview_questions: (analysis.likely_interview_questions as string[]).slice(0, 10),
    star_story_suggestions: (analysis.star_story_suggestions as string[]).slice(0, 6),
    match_score: Math.round(analysis.match_score * 10) / 10,
    strengths_pt: (analysis.strengths_pt as string[]).slice(0, 6),
    gaps_pt: (analysis.gaps_pt as string[]).slice(0, 6),
    study_plan_7_days_pt: (analysis.study_plan_7_days_pt as string[]).slice(0, 7),
    recommended_mock_focus: analysis.recommended_mock_focus,
  };
}

function buildPrompt(params: { title: string; company: string; location: string; jobDescription: string }) {
  return [
    'You are a career coach helping a Brazilian electrical engineer prepare for interviews for engineering jobs in the United States.',
    'Candidate default profile: electrical engineer with experience in power systems, substations, protection, electrical safety and field engineering in Brazil; advanced English learner preparing for US interviews.',
    'Analyze the job posting below and produce a personalized interview preparation analysis.',
    'Rules:',
    '- summary_pt, strengths_pt, gaps_pt and study_plan_7_days_pt must be written in Brazilian Portuguese.',
    '- role_type, required_skills, preferred_skills, technical_keywords, missing_vocabulary, likely_interview_questions and star_story_suggestions must be in English.',
    '- recommended_mock_focus must be in Brazilian Portuguese.',
    '- missing_vocabulary: technical/industry terms from this posting an advanced Brazilian English learner in this field likely needs to study.',
    '- likely_interview_questions: realistic interview questions in English for this specific role.',
    '- star_story_suggestions: themes of STAR stories the candidate should prepare for this role.',
    '- study_plan_7_days_pt: exactly 7 items, one per day (Dia 1 ... Dia 7), simple and actionable.',
    '- match_score: 0-10 adherence of the default candidate profile to this posting. Be honest, do not inflate.',
    '- Base everything only on the posting content and the default profile. Do not invent company facts.',
    'Return only JSON matching the schema.',
    '',
    `Job title: ${params.title}`,
    `Company: ${params.company || 'not informed'}`,
    `Location: ${params.location || 'not informed'}`,
    'Job description:',
    params.jobDescription,
  ].join('\n');
}

function readLocalEnvValue(name: string): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;

  for (const file of LOCAL_ENV_FILES) {
    const envPath = path.join(process.cwd(), file);
    if (!existsSync(envPath)) continue;

    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      if (key !== name) continue;
      return trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return undefined;
}

function getServerEnv(name: string): string | undefined {
  return process.env[name] || readLocalEnvValue(name);
}

export default async function handler(req: ServerRequest, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    json(res, 405, { success: false, error: 'Método não permitido.' });
    return;
  }

  const apiKey = getServerEnv('GEMINI_API_KEY');
  const modelEnv = getServerEnv('GEMINI_MODEL');
  const model = modelEnv || DEFAULT_MODEL;
  if (!apiKey) {
    json(res, 503, { success: false, error: 'IA não configurada. Defina GEMINI_API_KEY no servidor.' });
    return;
  }

  let body: AnalyzeJobTargetRequest;
  try {
    body = parseBody(req.body);
  } catch (error) {
    json(res, 400, {
      success: false,
      error: error instanceof Error ? error.message : 'JSON inválido.',
    });
    return;
  }

  const title = trimString(body.title, MAX_FIELD_LENGTH);
  const company = trimString(body.company, MAX_FIELD_LENGTH);
  const location = trimString(body.location, MAX_FIELD_LENGTH);
  const jobDescription = trimString(body.jobDescription, MAX_DESCRIPTION_LENGTH + 1);

  if (!title || !jobDescription) {
    json(res, 400, { success: false, error: 'Envie o título e a descrição completa da vaga.' });
    return;
  }

  if (jobDescription.length > MAX_DESCRIPTION_LENGTH) {
    json(res, 413, { success: false, error: 'A descrição da vaga está grande demais. Cole apenas o conteúdo principal da vaga.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt({ title, company, location, jobDescription }) }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: analysisSchema,
        temperature: 0.3,
        maxOutputTokens: 4000,
      },
    });

    const text = response.text ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      json(res, 502, { success: false, error: 'A IA não retornou uma análise válida. Tente novamente.' });
      return;
    }

    const analysis = validateAnalysis(parsed);
    if (!analysis) {
      json(res, 502, { success: false, error: 'A IA não retornou uma análise no formato esperado. Tente novamente.' });
      return;
    }

    json(res, 200, analysis);
  } catch (error) {
    console.error('English analyze-job-target endpoint error', { message: error instanceof Error ? error.message : 'unknown' });
    json(res, 502, { success: false, error: 'Não foi possível analisar a vaga agora. Tente novamente.' });
  }
}
