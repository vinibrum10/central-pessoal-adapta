import { GoogleGenAI } from '@google/genai';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

declare const process: {
  env: Record<string, string | undefined>;
};

type GenerateMaterialsRequest = {
  title?: string;
  company?: string;
  location?: string;
  jobDescription?: string;
  analysisSummary?: string;
  requiredSkills?: string[];
  technicalKeywords?: string[];
  strengths?: string[];
  gaps?: string[];
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

type ApplicationMaterials = {
  professional_summary_en: string;
  resume_bullets_en: string[];
  linkedin_about_en: string;
  recruiter_message_en: string;
  cover_letter_en: string;
  key_terms_to_include: string[];
  warnings_pt: string[];
  tailoring_notes_pt: string[];
};

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_BODY_CHARS = 120_000;
const MAX_DESCRIPTION_LENGTH = 15_000;
const MAX_FIELD_LENGTH = 300;
const MAX_LIST_ITEMS = 15;

const LOCAL_ENV_FILES = ['.env.local', '.env'];

const stringArray = (maxItems: number) => ({
  type: 'array',
  maxItems,
  items: { type: 'string' },
});

const materialsSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'professional_summary_en',
    'resume_bullets_en',
    'linkedin_about_en',
    'recruiter_message_en',
    'cover_letter_en',
    'key_terms_to_include',
    'warnings_pt',
    'tailoring_notes_pt',
  ],
  properties: {
    professional_summary_en: { type: 'string' },
    resume_bullets_en: { type: 'array', minItems: 4, maxItems: 8, items: { type: 'string' } },
    linkedin_about_en: { type: 'string' },
    recruiter_message_en: { type: 'string' },
    cover_letter_en: { type: 'string' },
    key_terms_to_include: stringArray(12),
    warnings_pt: stringArray(5),
    tailoring_notes_pt: stringArray(6),
  },
};

const STRING_FIELDS: Array<keyof ApplicationMaterials> = [
  'professional_summary_en',
  'linkedin_about_en',
  'recruiter_message_en',
  'cover_letter_en',
];

const ARRAY_FIELDS: Array<keyof ApplicationMaterials> = [
  'resume_bullets_en',
  'key_terms_to_include',
  'warnings_pt',
  'tailoring_notes_pt',
];

function json(res: ServerResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function parseBody(body: unknown): GenerateMaterialsRequest {
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_CHARS) {
      throw new Error('Os dados da vaga estão grandes demais. Reduza a descrição da vaga.');
    }
    return JSON.parse(body) as GenerateMaterialsRequest;
  }
  return (body ?? {}) as GenerateMaterialsRequest;
}

function trimString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sanitizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().slice(0, MAX_FIELD_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
}

function validateMaterials(value: unknown): ApplicationMaterials | null {
  const materials = value as Partial<ApplicationMaterials> | null;
  if (!materials) return null;

  for (const field of STRING_FIELDS) {
    if (typeof materials[field] !== 'string' || !(materials[field] as string).trim()) return null;
  }
  for (const field of ARRAY_FIELDS) {
    const items = materials[field];
    if (!Array.isArray(items) || !items.every(item => typeof item === 'string')) return null;
  }
  if ((materials.resume_bullets_en as string[]).length === 0) return null;

  return {
    professional_summary_en: materials.professional_summary_en as string,
    resume_bullets_en: (materials.resume_bullets_en as string[]).slice(0, 8),
    linkedin_about_en: materials.linkedin_about_en as string,
    recruiter_message_en: materials.recruiter_message_en as string,
    cover_letter_en: materials.cover_letter_en as string,
    key_terms_to_include: (materials.key_terms_to_include as string[]).slice(0, 12),
    warnings_pt: (materials.warnings_pt as string[]).slice(0, 5),
    tailoring_notes_pt: (materials.tailoring_notes_pt as string[]).slice(0, 6),
  };
}

function buildPrompt(params: {
  title: string;
  company: string;
  location: string;
  jobDescription: string;
  analysisSummary: string;
  requiredSkills: string[];
  technicalKeywords: string[];
  strengths: string[];
  gaps: string[];
}) {
  return [
    'You are a career coach and professional resume writer helping a Brazilian engineer apply for engineering jobs in the United States.',
    'Candidate default profile: electrical engineer and occupational safety engineer, with experience in utilities, power systems, electrical safety, SCADA, substations, and transmission/distribution in Brazil; advanced English; strong interest in relocating to or working for US companies.',
    'Generate application materials tailored to the job posting below.',
    'Rules:',
    '- professional_summary_en: 3-4 sentence professional summary for the top of a US-style resume, tailored to this job.',
    '- resume_bullets_en: 4-8 achievement-oriented resume bullets. Use strong action verbs and, where the profile allows, quantifiable placeholders like "[X]%" or "[N] substations" the candidate must fill in. Never invent specific numbers or employers.',
    '- linkedin_about_en: first-person LinkedIn About section (2-3 short paragraphs) aligned with this role.',
    '- recruiter_message_en: short, polite LinkedIn message to a recruiter about this specific role (max ~80 words).',
    '- cover_letter_en: complete cover letter tailored to this job with placeholders like [Hiring Manager], [Company Address] where personal data is unknown. Professional US business style.',
    '- key_terms_to_include: keywords from the posting the candidate should naturally include in resume/LinkedIn (ATS-friendly).',
    '- warnings_pt: in Brazilian Portuguese, honest warnings (e.g., requirements the candidate may not meet, visa/PE license caveats if mentioned in the posting).',
    '- tailoring_notes_pt: in Brazilian Portuguese, practical notes on what the candidate should customize before using the materials.',
    '- Do not fabricate certifications, degrees, employers, dates, or immigration status. Use placeholders instead.',
    '- All *_en fields in English; warnings_pt and tailoring_notes_pt in Brazilian Portuguese.',
    'Return only JSON matching the schema.',
    '',
    `Job title: ${params.title}`,
    `Company: ${params.company || 'not informed'}`,
    `Location: ${params.location || 'not informed'}`,
    params.analysisSummary ? `Prior AI analysis summary (in Portuguese): ${params.analysisSummary}` : '',
    params.requiredSkills.length ? `Required skills from analysis: ${params.requiredSkills.join('; ')}` : '',
    params.technicalKeywords.length ? `Technical keywords from analysis: ${params.technicalKeywords.join('; ')}` : '',
    params.strengths.length ? `Candidate strengths for this job (Portuguese): ${params.strengths.join('; ')}` : '',
    params.gaps.length ? `Candidate gaps for this job (Portuguese): ${params.gaps.join('; ')}` : '',
    'Job description:',
    params.jobDescription,
  ].filter(Boolean).join('\n');
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

  let body: GenerateMaterialsRequest;
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
  const analysisSummary = trimString(body.analysisSummary, 3000);

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
          parts: [{
            text: buildPrompt({
              title,
              company,
              location,
              jobDescription,
              analysisSummary,
              requiredSkills: sanitizeList(body.requiredSkills),
              technicalKeywords: sanitizeList(body.technicalKeywords),
              strengths: sanitizeList(body.strengths),
              gaps: sanitizeList(body.gaps),
            }),
          }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: materialsSchema,
        temperature: 0.4,
        maxOutputTokens: 6000,
      },
    });

    const text = response.text ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      json(res, 502, { success: false, error: 'A IA não retornou materiais válidos. Tente novamente.' });
      return;
    }

    const materials = validateMaterials(parsed);
    if (!materials) {
      json(res, 502, { success: false, error: 'A IA não retornou os materiais no formato esperado. Tente novamente.' });
      return;
    }

    json(res, 200, materials);
  } catch (error) {
    console.error('English generate-job-application-materials endpoint error', { message: error instanceof Error ? error.message : 'unknown' });
    json(res, 502, { success: false, error: 'Não foi possível gerar os materiais agora. Tente novamente.' });
  }
}
