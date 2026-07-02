# Sistema de Gestão Pessoal

> Organize metas, tarefas, tempo e finanças — com banco de dados, login, PWA e leitura diária.

Stack: React 18 + TypeScript + Vite + Tailwind · Supabase · Google Calendar + Drive · Vercel

URL em produção: **https://central-pessoal-adapta.vercel.app**

---

## Requisitos para funcionar em produção

O app **exige Supabase configurado** para abrir em produção. Sem as variáveis de ambiente, é exibida tela de configuração.

---

## 1 · Criar projeto Supabase

1. Acesse [app.supabase.com](https://app.supabase.com) e crie um novo projeto.
2. Vá em **Settings → API** e copie:
   - `Project URL` → será `VITE_SUPABASE_URL`
   - `anon / public key` → será `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## 2 · Rodar migrations (criar tabelas)

1. No painel do Supabase, vá em **SQL Editor → New Query**.
2. Cole o conteúdo de `supabase/migrations/001_initial_schema.sql`.
3. Clique em **Run**. Isso cria 13 tabelas com Row Level Security ativo.
4. Cole o conteúdo de `supabase/migrations/002_trigger_profile.sql`.
5. Clique em **Run**. Isso cria o trigger automático de profile e a policy RLS para admin.

---

## 2b · Como reparar usuários sem profile (usuários existentes)

Se você já tem usuários cadastrados que não têm profile (cadastrados antes da migration 002), execute:

1. No painel do Supabase, vá em **SQL Editor → New Query**.
2. Cole o conteúdo de `supabase/repair_profiles.sql`.
3. Clique em **Run**.

Isso cria profiles para todos os usuários sem profile e promove `vinibrum10@gmail.com` para admin.

---

## 2c · Como configurar login com Google

1. No Supabase Dashboard → **Authentication → Providers → Google**
2. Ativar e inserir **Client ID** e **Client Secret** do Google Cloud Console
3. No Google Cloud Console, adicione `https://[seu-projeto].supabase.co/auth/v1/callback` como **Authorized redirect URI**
4. Em Supabase Dashboard → **Authentication → URL Configuration → Redirect URLs**, cadastre:
   - Production: `https://central-pessoal-adapta.vercel.app/`
   - Preview da Vercel: `https://central-pessoal-adapta-*-vinicius-brum.vercel.app/` ou a URL exata do preview ativo
   - Local Vercel Dev: `http://localhost:3000/`
   - Local Vite: `http://localhost:5173/`
5. O app usa `window.location.origin` no `redirectTo` do Supabase OAuth, então não cadastre URLs hardcoded de outro ambiente.
6. Adicione `VITE_GOOGLE_CLIENT_ID` nas variáveis de ambiente do app (para habilitar o botão na tela de login)
7. No OAuth consent screen do Google Cloud, autorize os escopos `https://www.googleapis.com/auth/drive.readonly` e `https://www.googleapis.com/auth/calendar.readonly`; o login principal já solicita esses escopos para permitir sincronização automática da Leitura Diária e Agenda.

---

## 2d · Como configurar login com Microsoft

1. No Microsoft Entra → **Registros de aplicativo**, crie um app SPA
2. Tipos de conta: contas pessoais Microsoft e contas de qualquer diretório organizacional
3. Redirect URI SPA: `https://central-pessoal-adapta.vercel.app`, `http://localhost:5173` e `http://127.0.0.1:5173`
4. Permissões delegadas Microsoft Graph: `User.Read`, `Calendars.Read` e `offline_access`
5. Copie o **Application (client) ID** para `VITE_MICROSOFT_CLIENT_ID`
6. Não cadastre nem exponha Client Secret no front-end

---

## 2e · Como aprovar um usuário como admin

1. Logar no app com a conta admin
2. Menu lateral → **Usuários**
3. Usuários pendentes aparecem em destaque — clique em **Aprovar**

---

## 3 · Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Preencha `.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...

# Opcional — apenas para desenvolvimento local sem Supabase
# VITE_ENABLE_LOCAL_MODE=true
```

---

## 4 · Configurar variáveis na Vercel

1. No painel da Vercel, vá no projeto → **Settings → Environment Variables**.
2. Adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Redeploy para aplicar.

> **Sem essas variáveis em produção, o app exibe "Supabase não configurado" e bloqueia o acesso.**

---

## 5 · Criar o primeiro admin

O **primeiro usuário** a criar conta no app vira **admin automaticamente**.

1. Abra o app na Vercel.
2. Clique em "Criar conta".
3. Informe nome, e-mail e senha.
4. O sistema detecta que é o primeiro usuário e define `role = admin` e `status = aprovado`.

Usuários seguintes entram como `pendente` e precisam ser aprovados pelo admin em:
**Configurações → Usuários e Permissões**

---

## 6 · Perfis de acesso

| Role | Pode fazer |
|------|-----------|
| `admin` | Tudo — aprovar, bloquear, editar dados |
| `editor` | Criar, editar, excluir dados |
| `visualizador` | Apenas visualizar, sem editar |

**Status da conta:**
- `pendente` → aguardando aprovação do admin
- `aprovado` → acesso liberado
- `bloqueado` → não consegue entrar

---

## 7 · Testar login

1. Abra a URL em uma aba anônima.
2. Sem login → tela de login aparece.
3. Acesse `/metas` diretamente → redireciona para login.
4. Após login → acessa normalmente.
5. F5 em qualquer página → sessão persiste.

---

## 8 · Instalar no celular (PWA)

- **Android (Chrome):** Menu → "Adicionar à tela inicial"
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início"
- O app abre sem barra do navegador, como um app nativo.

---

## 9 · Google Calendar

1. [console.cloud.google.com](https://console.cloud.google.com) → novo projeto
2. Habilite **Google Calendar API** e **Google Drive API**
3. Credenciais → OAuth 2.0 → Aplicativo Web
4. Origens autorizadas: `http://localhost:5173` e `https://seu-app.vercel.app`
5. Configure `VITE_GOOGLE_CLIENT_ID` e `VITE_GOOGLE_API_KEY`
6. No app: **Agenda e Tempo → Conexões → Google Calendar → Conectar**

> Apenas leitura. O app nunca escreve ou apaga eventos.
> O login Google principal também solicita `https://www.googleapis.com/auth/calendar.readonly`, então a Agenda tenta reaproveitar a sessão antes de abrir um fluxo de conexão separado.

---

## 10 · Google Drive (Leitura Diária)

1. Use a pasta raiz `SGP - Sistema de Gestão Pessoal` e configure apenas IDs de pasta.
2. A sincronização da Leitura Diária lê as subpastas configuradas:
   - `01_LEITURA_DIARIA/Tecnologia`
   - `01_LEITURA_DIARIA/Inteligência Artificial`
   - `01_LEITURA_DIARIA/Engenharia de Dados`
   - `01_LEITURA_DIARIA/Segurança do Trabalho`
   - `01_LEITURA_DIARIA/Arquivados`
3. Configure `VITE_GOOGLE_DRIVE_FOLDER_ID` e as variáveis `VITE_SGP_DRIVE_*` conforme `.env.example`.
4. Depois do login Google com permissão Drive, o app sincroniza automaticamente ao abrir **Leitura Diária**. O botão **Sincronizar Drive** fica como fallback para reconectar ou resolver erro de permissão/token.

### Padrão SGP Drive

Pasta raiz: `SGP - Sistema de Gestão Pessoal` (`146Xbn1G3icqxjie2gBVbm_kdYoWSN1nO`).

Pastas principais:

| Módulo | Pasta | ID |
| --- | --- | --- |
| Leitura Diária | `01_LEITURA_DIARIA` | `1HIoT04CrKP_UzwbhivUpkEb6w7245Gvl` |
| Procurar Emprego | `02_PROCURAR_EMPREGO` | `1V1Xf2T0LveVlWjj2Z8UJzTB-XfBZIiN0` |
| Relatórios Automáticos | `03_RELATORIOS_AUTOMATICOS` | `1LUGLjPEx9Fo9nap6DquAT6d9QmgRhZLf` |
| Config | `00_CONFIG` | `1ftSfXxwhi2Lvs8eVfB9ATH53OAlJRVMh` |

Rotinas diárias devem salvar assim:

- Daily Tech News:
  - relatório completo em `03_RELATORIOS_AUTOMATICOS/Daily Tech News` (`1PGE7KY7trmuhsovS3Sx2rOfhcU-dMPhF`);
  - leituras selecionadas em `01_LEITURA_DIARIA/Tecnologia`, `01_LEITURA_DIARIA/Inteligência Artificial`, `01_LEITURA_DIARIA/Engenharia de Dados` ou `01_LEITURA_DIARIA/Segurança do Trabalho`.
- Procurar Emprego:
  - relatório completo em `03_RELATORIOS_AUTOMATICOS/Procurar Emprego` (`1kVFcgUUK1ZxaErq7EuQ3CTcAPNwKnGHa`);
  - vagas em `02_PROCURAR_EMPREGO/Vagas Encontradas` (`1XrZ8zl10Z6j_-zLmK2D-68bx3_qqaG6I`);
  - empresas em `02_PROCURAR_EMPREGO/Empresas Alvo` (`1muvbWCeyGAFvw7ukuoNmWDkYNkrh_3wJ`);
  - candidaturas em `02_PROCURAR_EMPREGO/Candidaturas Realizadas` (`1Nab4BBz4n0-3Op-lQvq_I8WZXlE-lUhd`).

Nomes de arquivos:

- `AAAA-MM-DD - LEITURA - Categoria - Título`
- `AAAA-MM-DD - VAGA - Cargo - Empresa`
- `AAAA-MM-DD - EMPRESA - Nome da Empresa`
- `AAAA-MM-DD - CANDIDATURA - Cargo - Empresa`
- `AAAA-MM-DD - RESUMO EMPREGO - Busca diária`
- `AAAA-MM-DD - RELATORIO - Daily Tech News`
- `AAAA-MM-DD - RELATORIO - Procurar Emprego`
- `AAAA-MM-DD - LOG - Nome da tarefa`

Todo documento criado para o SGP deve começar com:

```text
Módulo:
Categoria:
Data:
Status:
Prioridade:
Fonte:
URL original:
Tags:
Próxima revisão:

Resumo:
Principais pontos:
Ação recomendada:
Por que isso importa:
Como isso entra no SGP:
```

Em produção, se existir `VITE_GOOGLE_DRIVE_FOLDER_ID` antigo na Vercel, atualize para `1HIoT04CrKP_UzwbhivUpkEb6w7245Gvl` ou remova a variável. A Leitura Diária usa a árvore oficial do SGP no código, mas manter env antiga pode confundir diagnóstico e outras integrações.

O escopo OAuth usado para Google Drive é `https://www.googleapis.com/auth/drive.readonly`, necessário para listar documentos em pastas existentes do usuário.

O app remove automaticamente itens legados de Drive que apontem para pastas antigas, preservando itens manuais. Para forçar uma nova carga, use **Leitura Diária → Sincronizar Drive** ou **Reconectar** quando houver erro de permissão/token.

---

## 11 · Inglês — Modo Entrevista

1. Habilite **YouTube Data API v3** no Google Cloud Console.
2. Crie uma API key, restrinja por domínio/origem e restrinja a chave somente para **YouTube Data API v3**.
3. Configure `VITE_YOUTUBE_API_KEY` na Vercel e faça redeploy.
4. Crie uma pasta no Google Drive para materiais de inglês e copie o ID da URL.
5. Configure `VITE_ENGLISH_DRIVE_FOLDER_ID`. Se não houver uma pasta separada, o app usa `VITE_GOOGLE_DRIVE_FOLDER_ID` como fallback.
6. Rode a migration `supabase/migrations/20260702_english_interview_mode_phase1.sql`.
7. Rode a migration incremental `supabase/migrations/20260702_english_interview_storage.sql` para criar o bucket privado `interview-answers` e suas policies por dono.
8. Popule os conteúdos compartilhados com service role local:

```bash
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
npm run seed:english-interview
```

No macOS/Linux:

```bash
SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="eyJ..." npm run seed:english-interview
```

9. `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser commitada nem exposta no cliente. Ela é necessária porque `glossary_terms`, `interview_questions` e `listening_sources` são somente leitura para usuários autenticados via RLS.
10. Para recursos de IA do módulo, use apenas Gemini: configure `GEMINI_API_KEY` como variável server-side. Nunca use `VITE_` para essa chave.
11. Configure `GEMINI_MODEL=gemini-2.5-flash`.
12. No app: **Estudo → Inglês — Entrevista**.

O Modo Entrevista usa tabelas normalizadas: `glossary_terms`, `interview_questions`, `listening_sources`, `listening_episodes`, `glossary_reviews`, `daily_sessions`, `interview_answers` e `mock_sessions`.
A migration antiga `english_study_data` permanece para compatibilidade, mas a nova página não grava mais nela. Na primeira carga, cards antigos do `localStorage` (`sgp_english_v2`) são importados por RPC para `glossary_terms`/`glossary_reviews` com `source = 'legacy'`, deduplicando termos existentes.

As respostas gravadas usam `MediaRecorder` no cliente com bitrate baixo para voz. O arquivo vai para o bucket privado `interview-answers` em `{user_id}/{answer_id}.{ext}`, com extensão derivada do `mimeType` suportado pelo navegador. O feedback de IA é manual pelo botão **Avaliar com IA** e chama `/api/english/evaluate-answer`, que envia o áudio ao Gemini com JSON mode e salva o retorno em `interview_answers.gemini_feedback`.

### Fase 3A/3B · Empregabilidade EUA

1. Rode a migration incremental `supabase/migrations/20260702_english_employability_phase3.sql`.
2. Popule o vocabulário de vagas dos EUA com service role local:

```bash
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
npm run seed:english-employability
```

No macOS/Linux:

```bash
SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" npm run seed:english-employability
```

O seed usa `source = 'job_posting'` e faz upsert em `glossary_terms` para evitar duplicatas. As respostas STAR ficam em `star_answers` com RLS por dono.

### Fase 4D · Controle de candidaturas EUA

Rode a migration incremental `supabase/migrations/20260702_english_job_application_tracking_phase4d.sql`.
Ela adiciona campos manuais de acompanhamento em `job_targets`, incluindo datas de aplicação, entrevista, follow-up, próxima ação, recrutador, salário, modelo de trabalho, sponsorship/visto e prioridade.

### Fase 5 · Plano semanal automático

Rode a migration incremental `supabase/migrations/20260702_english_weekly_preparation_phase5.sql`.
Ela cria `weekly_preparation_plans` e `weekly_preparation_tasks`, ambas com RLS por dono. A geração do plano é determinística no cliente/serviços do app e usa dados já existentes do módulo, sem IA automática em background.

---

## 12 · Microsoft Outlook Calendar

1. [portal.azure.com](https://portal.azure.com) → Azure Active Directory → Registros de aplicativo
2. Configure o app como SPA com permissões delegadas `User.Read` e `Calendars.Read`
3. Configure `VITE_MICROSOFT_CLIENT_ID`
4. No app: **Agenda e Tempo → Conexões → Microsoft Outlook → Conectar**
5. Para a Uniasselvi, faça login diretamente com `vinicius.brum@regente.uniasselvi.com.br`

---

## 13 · Exportar dados em Excel

No app: **Configurações → Seus Dados → Exportar Excel**

O arquivo `.xlsx` contém 11 abas:
Metas, Tarefas, Receitas, Despesas, Cartões, Dívidas, Reservas, Bens, Agenda, Leituras Diárias, Configurações.

---

## 14 · Rodando localmente (dev)

```bash
npm install
npm run dev   # http://localhost:5173
```

Para rodar sem Supabase em dev, adicione ao `.env`:
```env
VITE_ENABLE_LOCAL_MODE=true
```

---

## 15 · Deploy na Vercel

1. Importe o repositório em [vercel.com](https://vercel.com)
2. Configure as variáveis de ambiente
3. Push na branch `main` → deploy automático

O `vercel.json` garante que rotas como `/metas`, `/plano`, `/agenda` funcionem ao recarregar a página.

---

## 16 · Tabelas no Supabase

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil, role e status do usuário |
| `metas` | Metas pessoais |
| `tarefas` | Ações eventuais e rotineiras |
| `receitas` | Entradas financeiras |
| `despesas` | Saídas financeiras |
| `cartoes` | Cartões de crédito |
| `dividas` | Dívidas parceladas |
| `reservas` | Metas de poupança |
| `bens` | Patrimônio |
| `eventos_agenda` | Eventos de calendários externos |
| `configuracoes_agenda` | Configurações de fontes |
| `leituras_diarias` | Itens de leitura diária |
| `fontes_leitura` | Fontes configuradas |
| `english_study_data` | Dados da central de estudos de inglês |

Todas com **Row Level Security** ativo — cada usuário vê apenas seus próprios dados.
