import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Use SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run this seed.`);
  }
  return value;
}

async function readJson(relativePath) {
  const raw = await readFile(path.join(root, relativePath), 'utf8');
  return JSON.parse(raw);
}

function normalizeTerm(row) {
  return {
    term: String(row.term).trim(),
    theme: String(row.theme).trim(),
    translation_pt: String(row.translation_pt).trim(),
    definition_en: String(row.definition_en).trim(),
    example_en: String(row.example_en).trim(),
    source: 'seed',
  };
}

function normalizeQuestion(row) {
  return {
    id: String(row.id).trim(),
    category: String(row.category).trim(),
    question_en: String(row.question_en).trim(),
    o_que_avaliam: String(row.o_que_avaliam).trim(),
    como_responder: String(row.como_responder).trim(),
    temas_relacionados: Array.isArray(row.temas_relacionados) ? row.temas_relacionados.map(String) : [],
    timer_sugerido_min: Number(row.timer_sugerido_min) || 3,
  };
}

async function upsertOrThrow(supabase, table, rows, options) {
  const { error } = await supabase.from(table).upsert(rows, options);
  if (error) throw new Error(`${table}: ${error.message}`);
}

const listeningSources = [
  { name: 'Grid Talk (DOE)', kind: 'podcast', url: 'https://www.energy.gov/oe/grid-talk-podcast' },
  { name: 'The Energy Gang', kind: 'podcast', url: 'https://www.woodmac.com/podcasts/the-energy-gang/' },
  { name: 'Redefining Energy', kind: 'podcast', url: 'https://www.redefining-energy.com/' },
];

const starterEpisodes = [
  {
    source: 'Grid Talk (DOE)',
    title: 'Grid Talk — Reliability, resilience, and the modern grid',
    url: 'https://www.energy.gov/oe/grid-talk-podcast',
    duration_sec: 900,
    themes: ['outages', 'interconnection', 'safety'],
    level: 'advanced',
  },
  {
    source: 'The Energy Gang',
    title: 'The Energy Gang — Transmission and the energy transition',
    url: 'https://www.woodmac.com/podcasts/the-energy-gang/',
    duration_sec: 900,
    themes: ['transmission', 'interconnection', 'data-ami'],
    level: 'advanced',
  },
  {
    source: 'Redefining Energy',
    title: 'Redefining Energy — Utilities, grid modernization, and data',
    url: 'https://www.redefining-energy.com/',
    duration_sec: 900,
    themes: ['data-ami', 'protection', 'substations'],
    level: 'advanced',
  },
];

async function main() {
  const supabase = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const glossary = await readJson('seeds/glossario_power_systems_200.json');
  const questions = await readJson('seeds/banco_perguntas_entrevista.json');

  const terms = glossary.terms.map(normalizeTerm);
  const interviewQuestions = questions.questions.map(normalizeQuestion);

  await upsertOrThrow(supabase, 'glossary_terms', terms, { onConflict: 'term' });
  await upsertOrThrow(supabase, 'interview_questions', interviewQuestions, { onConflict: 'id' });
  await upsertOrThrow(supabase, 'listening_sources', listeningSources, { onConflict: 'name' });

  const { data: sources, error: sourcesError } = await supabase
    .from('listening_sources')
    .select('id, name')
    .in('name', listeningSources.map(source => source.name));
  if (sourcesError) throw new Error(`listening_sources select: ${sourcesError.message}`);

  const sourceIdByName = new Map((sources ?? []).map(source => [source.name, source.id]));
  const episodes = starterEpisodes.map(episode => ({
    source_id: sourceIdByName.get(episode.source),
    title: episode.title,
    url: episode.url,
    duration_sec: episode.duration_sec,
    themes: episode.themes,
    level: episode.level,
  }));

  await upsertOrThrow(supabase, 'listening_episodes', episodes, { onConflict: 'url' });

  console.log(JSON.stringify({
    glossary_terms: terms.length,
    interview_questions: interviewQuestions.length,
    listening_sources: listeningSources.length,
    listening_episodes: episodes.length,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
