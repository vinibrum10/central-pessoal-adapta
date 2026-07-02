# PROMPT PARA O CODEX — Reestruturar o módulo "Inglês Diário" do SGP para "Inglês — Modo Entrevista"

> Cole este prompt inteiro no Codex, dentro do repositório do SGP. Antes de colar, revise a seção "0. Contexto do projeto" e ajuste o que estiver diferente do seu código real (nomes de pastas, tabelas existentes, etc.).

---

## 0. Contexto do projeto

Você está trabalhando no **SGP (Sistema de Gestão Pessoal)**, um app pessoal construído com **React** (frontend) e **Supabase** (Postgres + Auth + Storage + Edge Functions). O app tem um módulo de estudos com a página **"Inglês Diário"**, que hoje funciona assim:

- 4 etapas independentes: **Listening** (vídeo do YouTube colado ou buscado, com filtro por nível Básico/Intermediário/Avançado/Fluente), **Questionário**, **Shadowing** (fluxo de 5 etapas) e **Cards de vocabulário** (botão "Revisar palavras").
- O usuário escolhe qualquer vídeo em inglês; não há conexão entre as etapas nem com um objetivo.

**Antes de escrever qualquer código, explore o repositório** e mapeie: onde vive a página Inglês Diário, como o player de YouTube funciona, como os cards de vocabulário são armazenados, e como o fluxo de shadowing de 5 etapas está implementado. **Reaproveite o máximo possível** — o objetivo é redirecionar o módulo, não reescrevê-lo do zero.

## 1. Objetivo da mudança

Transformar "Inglês Diário" em **"Inglês — Modo Entrevista"**: um sistema de preparação para o usuário (engenheiro eletricista brasileiro) sustentar uma **entrevista técnica de 30 minutos em inglês para vaga de Power Systems Engineer nos EUA**, com prazo em **dezembro/2026**.

Princípio central: trocar o eixo "nível de inglês" pelo eixo "prontidão para entrevista". Todo conteúdo passa a girar em torno do setor elétrico americano (transmissão, distribuição, subestações, proteção, segurança, dados) e do formato de entrevista americano (STAR).

## 2. Restrição obrigatória de IA

**Toda integração de IA deste módulo usa exclusivamente a API do Google Gemini** (motivo: permissões e limites de uso do usuário). Não usar OpenAI, Anthropic ou outros provedores.

- SDK: `@google/genai` (ou chamadas REST à Generative Language API).
- Modelo padrão: `gemini-2.5-flash` (ou o modelo *flash* mais recente disponível na conta — deixe o nome do modelo em variável de configuração, ex.: `GEMINI_MODEL`).
- **A chave da API NUNCA vai para o cliente.** Todas as chamadas ao Gemini acontecem em **Supabase Edge Functions**, com a chave em `GEMINI_API_KEY` (secret do projeto Supabase).
- Sempre que a resposta precisar ser estruturada, use o modo JSON do Gemini: `generationConfig: { responseMimeType: "application/json", responseSchema: {...} }` — não parseie texto livre.
- O Gemini aceita **áudio nativamente** (inline base64 ou via Files API): use isso para o feedback de respostas gravadas, sem serviço de transcrição separado.
- Economia de cota (limites de uso são a razão da escolha): cachear resultados no banco (uma extração de vocabulário por episódio, nunca repetida), processar em lote quando possível, e nunca chamar o Gemini em loop por item.

## 3. Modelo de dados (Supabase / Postgres)

Crie as migrações abaixo (ajuste nomes se colidirem com tabelas existentes; todas com RLS habilitado, política de acesso `user_id = auth.uid()` exceto tabelas de conteúdo compartilhado, que são somente leitura para usuários autenticados):

```sql
-- Conteúdo compartilhado (seed)
create table glossary_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  theme text not null,             -- ex.: 'protecao-controle'
  translation_pt text not null,
  definition_en text not null,
  example_en text not null,
  source text default 'seed',      -- 'seed' | 'job_posting' | 'episode'
  created_at timestamptz default now()
);

create table interview_questions (
  id text primary key,             -- 'B01', 'T05', 'P03'...
  category text not null,          -- 'comportamental' | 'tecnica' | 'perfil'
  question_en text not null,
  o_que_avaliam text not null,
  como_responder text not null,
  temas_relacionados text[] default '{}',
  timer_sugerido_min int default 3
);

create table listening_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,              -- 'Grid Talk (DOE)', 'The Energy Gang'...
  kind text not null,              -- 'podcast' | 'youtube_channel'
  url text not null
);

create table listening_episodes (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references listening_sources(id),
  title text not null,
  url text not null,               -- link YouTube ou áudio
  duration_sec int,
  themes text[] default '{}',      -- tags: 'substations', 'outages'...
  transcript text,                 -- opcional, alimenta o Gemini
  vocab_extracted boolean default false,
  created_at timestamptz default now()
);

-- Dados por usuário
create table glossary_reviews (    -- repetição espaçada (SRS)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  term_id uuid not null references glossary_terms(id),
  box int default 1,               -- Leitner: 1..5; box 5 = dominado
  next_review date default current_date,
  last_result text,                -- 'acertou' | 'errou'
  reviewed_at timestamptz,
  unique (user_id, term_id)
);

create table interview_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  question_id text not null references interview_questions(id),
  audio_path text,                 -- Supabase Storage
  duration_sec int,
  self_rating int check (self_rating between 1 and 10),
  gemini_feedback jsonb,           -- resultado da avaliação (ver §5.3)
  created_at timestamptz default now()
);

create table mock_sessions (       -- aulas mensais de mock no Preply
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  session_date date not null,
  teacher text,
  rating numeric(3,1) check (rating between 0 and 10),
  notes text,
  recording_path text,
  created_at timestamptz default now()
);

create table daily_sessions (      -- a "Sessão de hoje"
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  session_date date not null default current_date,
  episode_id uuid references listening_episodes(id),
  step_listening_done boolean default false,
  step_shadowing_done boolean default false,
  step_cards_done boolean default false,
  step_question_done boolean default false,
  question_id text references interview_questions(id),
  unique (user_id, session_date)
);
```

## 4. Seeds

Dois arquivos JSON acompanham este prompt — importe-os via script de seed (Node ou SQL):

1. **`glossario_power_systems_200.json`** → tabela `glossary_terms` (200 termos, 8 temas). Campos mapeiam 1:1.
2. **`banco_perguntas_entrevista.json`** → tabela `interview_questions` (40 perguntas: 14 comportamentais, 18 técnicas, 8 de perfil).

Popular também `listening_sources` com: Grid Talk (DOE), The Energy Gang, Redefining Energy (podcasts) e os canais de YouTube que o usuário cadastrar depois (deixe CRUD simples em configurações).

## 5. Funcionalidades — implementar em 3 fases

### Fase 1 — Núcleo (fazer primeiro)

**1a. Nova página "Inglês — Modo Entrevista"** substituindo a atual, com três blocos (ver §6 para o layout):
- **Cabeçalho de missão**: contagem regressiva até 31/12/2026 + 3 métricas: termos dominados (`box = 5`) / 200; sessões de shadowing na semana / meta 3; nota do último mock.
- **Sessão de hoje**: fluxo guiado de 4 passos encadeados (listening setorial → shadowing do mesmo trecho → 5 cards do glossário → 1 pergunta de entrevista). Cada passo marca `step_*_done` em `daily_sessions`. O episódio do dia vem da biblioteca (aleatório ponderado por tema menos praticado); a pergunta do dia é sorteada priorizando perguntas nunca respondidas.
- **Filtro por tema técnico** no listening (substations, protection, outages, interconnection, safety, data/AMI), mantendo o filtro de nível como secundário.

**1b. Glossário Técnico 200 com SRS (Leitner)**:
- Card: frente = termo (EN) + áudio TTS (usar Web Speech API `speechSynthesis` no cliente — grátis, sem custo de API); verso = tradução PT, definição EN e frase de exemplo.
- Acertou → sobe uma caixa (revisão em 1, 3, 7, 14, 30 dias para caixas 1–5); errou → volta para a caixa 1.
- Barra de progresso "X / 200 dominados" (dominado = caixa 5).
- Reaproveitar o componente de cards existente se possível.

**1c. Reaproveitar** o player de YouTube, o fluxo de shadowing de 5 etapas e o questionário existentes — apenas apontando para o conteúdo setorial.

### Fase 2 — Banco de entrevista com gravador

- Lista das 40 perguntas com filtros por categoria e tema; cada uma mostra `question_en`, e em acordeão "O que avaliam" e "Como responder".
- **Gravador de resposta**: `MediaRecorder` API, com timer regressivo (`timer_sugerido_min`), upload do áudio para Supabase Storage (bucket privado `interview-answers`), e autoavaliação 1–10.
- Histórico por pergunta: lista de tentativas com data, duração, nota própria e player de áudio.
- **Feedback do Gemini (Edge Function `evaluate-answer`)**: recebe o áudio (base64) + a pergunta + o guia "como_responder", e pede ao Gemini análise com `responseSchema`:
```json
{
  "type": "object",
  "properties": {
    "transcript": {"type": "string"},
    "star_structure": {"type": "object", "properties": {"situation": {"type": "boolean"}, "task": {"type": "boolean"}, "action": {"type": "boolean"}, "result": {"type": "boolean"}}},
    "strengths": {"type": "array", "items": {"type": "string"}},
    "improvements": {"type": "array", "items": {"type": "string"}, "maxItems": 3},
    "grammar_notes": {"type": "array", "items": {"type": "string"}, "maxItems": 3},
    "score": {"type": "integer", "minimum": 1, "maximum": 10}
  },
  "required": ["transcript", "strengths", "improvements", "score"]
}
```
  Prompt de sistema da função (em inglês): avaliar como um entrevistador de utility americana; ser específico; nunca inventar conteúdo que não esteja no áudio; responder os campos de feedback em **português**, mantendo `transcript` em inglês. Salvar em `interview_answers.gemini_feedback`. Botão "Avaliar com IA" é manual (não automático), para poupar cota.

### Fase 3 — Métricas, mocks e vocabulário das vagas

- **Log de mock interviews**: CRUD de `mock_sessions` + gráfico de linha da nota ao longo do tempo (reaproveitar lib de gráficos já usada no app).
- **Vocabulário das vagas (Edge Function `extract-terms`)**: textarea onde o usuário cola um job posting; o Gemini extrai termos técnicos recorrentes com `responseSchema` (array de `{term, translation_pt, definition_en, example_en, theme}`), deduplica contra `glossary_terms` (case-insensitive) e insere os novos com `source = 'job_posting'`, já entrando no ciclo de SRS.
- **Extração de vocabulário de episódio (Edge Function `extract-episode-vocab`)**: quando um episódio tem `transcript`, extrair 5–10 termos e vinculá-los como sugestão dos cards do dia. Rodar uma única vez por episódio (`vocab_extracted = true`).
- Cabeçalho de missão passa a calcular tudo em tempo real.

## 6. UI — especificação da página

Layout (de cima para baixo), mantendo o design system atual do SGP (tema escuro, acento laranja, sidebar existente):

1. **Cabeçalho**: título "Inglês — Modo Entrevista", subtítulo "Meta: entrevista técnica de 30 min sem travar", badge com contagem regressiva "Dez/2026 · N dias".
2. **Linha de 3 métricas** (cards compactos): Glossário X/200 · Shadowing semana X/3 · Último mock N/10.
3. **Sessão de hoje** (card principal): 4 linhas numeradas com ícone, título, subtítulo com o conteúdo do dia e checkbox/estado de conclusão. Botão "Começar sessão" que conduz passo a passo.
4. **Biblioteca de módulos** (grid de 5 cards): Listening setorial · Glossário técnico 200 · Banco de entrevista · Log de mock interviews · Vocabulário das vagas. Cada card navega para a respectiva subpágina.
5. Manter o campo "cole um link do YouTube" dentro de Listening setorial como opção manual, mas o padrão passa a ser o feed curado.

## 7. Critérios de aceitação

1. A página antiga é substituída sem quebrar rotas/menus existentes ("Leitura Diária" e o resto do app intocados).
2. Seeds importados: `select count(*) from glossary_terms` = 200; `interview_questions` = 40.
3. Fluxo diário completo funciona de ponta a ponta e persiste em `daily_sessions`.
4. SRS: errar um card o devolve à caixa 1; acertar avança e agenda `next_review` corretamente.
5. Gravar uma resposta salva áudio no Storage e aparece no histórico; "Avaliar com IA" retorna JSON válido do Gemini e renderiza o feedback.
6. Nenhuma chave de API presente no bundle do cliente (verificar build).
7. Colar um job posting gera termos novos sem duplicar existentes.
8. Tudo responsivo e consistente com o visual atual do SGP.

## 8. Fora de escopo (não fazer)

- Não tocar nos módulos Orçamento, Gestão, Leitura Diária e Hoje.
- Não implementar transcrição automática de episódios do YouTube (o campo `transcript` é preenchido manualmente por enquanto).
- Não criar sistema de notificações/push nesta etapa.
- Não usar nenhuma API de IA além do Gemini.

Comece explorando o código, apresente um plano curto de arquivos a criar/alterar e, após confirmação, implemente a Fase 1 completa antes de seguir para as Fases 2 e 3.
