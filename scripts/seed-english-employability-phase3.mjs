import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
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
  const term = String(row.term_en ?? '').trim();
  if (!term) throw new Error('Invalid seed row: missing term_en.');

  return {
    term,
    theme: String(row.category ?? 'job_posting').trim(),
    category: String(row.category ?? 'job_posting').trim(),
    translation_pt: String(row.translation_pt ?? '').trim(),
    definition_en: String(row.definition_en ?? `A term commonly found in U.S. electrical engineering job postings: ${term}.`).trim(),
    example_en: String(row.example_en ?? '').trim(),
    importance_level: Math.min(5, Math.max(1, Number(row.importance_level) || 3)),
    source: 'job_posting',
  };
}

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

  const payload = await readJson('seeds/us_job_vocabulary_terms.json');
  const termsByLowerTerm = new Map();
  for (const term of payload.terms.map(normalizeTerm)) {
    termsByLowerTerm.set(term.term.toLowerCase(), term);
  }
  const terms = Array.from(termsByLowerTerm.values());

  const { data: existingTerms, error: existingError } = await supabase
    .from('glossary_terms')
    .select('id, term');
  if (existingError) throw new Error(`glossary_terms select: ${existingError.message}`);

  const idByLowerTerm = new Map((existingTerms ?? []).map(row => [String(row.term).toLowerCase(), row.id]));
  const existingRows = [];
  const newRows = [];

  for (const term of terms) {
    const existingId = idByLowerTerm.get(term.term.toLowerCase());
    if (existingId) {
      existingRows.push({
        id: existingId,
        category: term.category,
        importance_level: term.importance_level,
        translation_pt: term.translation_pt,
        example_en: term.example_en,
        source: term.source,
      });
    } else {
      newRows.push({
        id: randomUUID(),
        ...term,
      });
    }
  }

  for (const row of existingRows) {
    const { id, ...updates } = row;
    const { error } = await supabase
      .from('glossary_terms')
      .update(updates)
      .eq('id', id);
    if (error) throw new Error(`glossary_terms update ${id}: ${error.message}`);
  }

  if (newRows.length > 0) {
    const { error } = await supabase
      .from('glossary_terms')
      .insert(newRows);
    if (error) throw new Error(`glossary_terms insert: ${error.message}`);
  }

  console.log(JSON.stringify({
    glossary_terms_job_posting: terms.length,
    updated: existingRows.length,
    inserted: newRows.length,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
