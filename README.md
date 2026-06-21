# Central Pessoal ADAPTA

> Sua central de comando pessoal: **Meta → Plano → Tarefa → Tempo → Finanças → Leitura**

Stack: React 18 + TypeScript + Vite + Tailwind · Supabase · Google Calendar + Drive · Deploy: Vercel

---

## Setup rápido

```bash
cp .env.example .env   # preencha as variáveis
npm install
npm run dev            # http://localhost:5173
```

---

## Supabase (banco de dados + auth)

1. Crie projeto em [app.supabase.com](https://app.supabase.com).
2. Copie **Project URL** e **anon key** para o `.env`.
3. No **SQL Editor**, execute `supabase/migrations/001_initial_schema.sql`.
4. Todas as tabelas têm Row Level Security ativado.

Tabelas criadas: `profiles`, `metas`, `tarefas`, `receitas`, `despesas`,
`cartoes`, `dividas`, `reservas`, `bens`, `eventos_agenda`,
`configuracoes_agenda`, `leituras_diarias`, `fontes_leitura`.

---

## Google Calendar

1. Crie projeto em [console.cloud.google.com](https://console.cloud.google.com).
2. Habilite **Google Calendar API** e **Google Drive API**.
3. Crie credencial OAuth 2.0 → tipo Aplicativo Web.
4. Adicione as origens: `http://localhost:5173` e `https://seu-app.vercel.app`.
5. Copie **Client ID** para `VITE_GOOGLE_CLIENT_ID`.
6. No app: **Agenda e Tempo** → conectar Google Calendar.

**Nunca** coloque o `client_secret` no frontend.

---

## Google Drive (Leitura Diária)

1. Crie uma pasta no Drive onde o Claude Code vai depositar arquivos.
2. Copie o ID da pasta da URL → `VITE_GOOGLE_DRIVE_FOLDER_ID`.
3. No app: **Leitura Diária** → Sincronizar Drive.

Classificação automática por palavra-chave no nome:
- `vaga / emprego / job` → Vagas de emprego
- `tecnologia / tech / IA / AI` → Atualização de tecnologia
- Demais → Geral

---

## Deploy na Vercel

1. Importe o repo em [vercel.com](https://vercel.com).
2. Configure as variáveis de ambiente (mesmas do `.env`).
3. O `vercel.json` já garante que rotas como `/metas` e `/plano` funcionem ao recarregar.

---

## Acesso pelo celular (PWA)

- **Android (Chrome):** Menu → "Adicionar à tela inicial".
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início".
- App abre em modo tela cheia, sem barra de navegador.

---

## Testes manuais

### Banco
- [ ] Criar meta → recarregar → meta persiste
- [ ] Acessar de outro dispositivo com a mesma conta

### Deploy
- [ ] Abrir `/metas` direto → não dá 404
- [ ] Recarregar qualquer rota → funciona

### Calendário
- [ ] Conectar Google Calendar em Agenda e Tempo
- [ ] Ver painel de disponibilidade no Plano de Ação
- [ ] Transformar evento de fim de semana em tarefa

### Leitura Diária
- [ ] Sincronizar Drive → itens aparecem
- [ ] Marcar como lido
- [ ] Transformar em tarefa

---

## Como rodar

### Passo 1 — Instale as dependências
```bash
cd "C:\Users\Vinicius\Documents\1.0-Desenvolvimentos_Projetos\2.GestaoVinicius"
npm install
```

### Passo 2 — Rode o servidor de desenvolvimento
```bash
npm run dev
```

### Passo 3 — Acesse no navegador
```
http://localhost:5173
```

---

## Estrutura do projeto

```
src/
├── components/       # Componentes reutilizáveis (Button, Card, Modal, FormFields, Badge)
├── pages/            # 7 telas principais
│   ├── Inicio.tsx    # Dashboard com tarefas do dia, resumo financeiro, metas em risco
│   ├── Metas.tsx     # CRUD completo de metas com progresso
│   ├── PlanoAcao.tsx # CRUD de tarefas com 6 visualizações
│   ├── AgendaTempo.tsx # Gestão de tempo + sugestão inteligente
│   ├── Orcamento.tsx # Receitas, despesas, cartões, dívidas, reservas, bens
│   ├── Diario.tsx    # Diário diário + revisão semanal
│   └── Configuracoes.tsx # Perfil, tema, export/import/reset
├── layouts/          # Layout com sidebar (desktop) e bottom nav (mobile)
├── hooks/            # useApp (contexto global + LocalStorage), useLocalStorage
├── types/            # Todos os tipos TypeScript
├── data/             # Dados de demonstração baseados nas suas metas reais
└── utils/            # Formatação, datas, lógica de negócio, cores
```

---

## O que testar primeiro

1. **Dashboard (Início)** — veja o resumo do dia com dados de demonstração
2. **Metas** — explore suas 7 metas pré-cadastradas, edite a prioridade e progresso
3. **Plano de Ação** — filtre por "Hoje", conclua uma tarefa clicando no círculo
4. **Agenda e Tempo** — cadastre seu tempo disponível e veja as sugestões automáticas
5. **Orçamento > Resumo** — veja saldo do mês, dívidas e reserva
6. **Diário** — registre como foi seu dia (energia, foco, humor)
7. **Configurações** — troque para modo claro, exporte os dados em JSON

---

## Funcionalidades implementadas

- [x] CRUD completo de metas (criar, editar, concluir, pausar, cancelar, excluir)
- [x] CRUD completo de tarefas com 6 visualizações
- [x] Vinculação obrigatória tarefa ↔ meta (alerta quando sem meta)
- [x] Detecção de "meta em risco" (sem tarefa concluída há +7 dias)
- [x] Conclusão de tarefa com 1 clique no dashboard
- [x] Reagendamento de tarefa com prazo personalizável
- [x] Divisão de tarefa semanal em 5 tarefas diárias
- [x] Sugestão inteligente de tarefas por prioridade + prazo + tempo disponível
- [x] Gestão financeira completa (receitas, despesas, cartões, dívidas, reservas, bens)
- [x] Diário diário com avaliação de energia, foco e humor (1-5 estrelas)
- [x] Revisão semanal estruturada
- [x] Tema claro/escuro com persistência
- [x] Export/Import de dados em JSON
- [x] Dados de demonstração baseados nas suas metas reais
- [x] Layout responsivo (sidebar no desktop, bottom nav + menu lateral no mobile)
- [x] Dados salvos automaticamente no LocalStorage

---

## Melhorias futuras recomendadas

### Próxima versão (v1.1)
- [ ] Notificações do navegador para tarefas com prazo hoje
- [ ] Gráfico de progresso semanal (energia, foco, humor)
- [ ] Contagem de streak de dias com registro no diário
- [ ] Filtro de despesas por mês com seletor de mês

### Versão v2.0
- [ ] Integração com Google Calendar
- [ ] Sincronização em nuvem (Supabase ou Firebase)
- [ ] Assistente de IA para sugestão de plano semanal
- [ ] Notificações por WhatsApp via n8n
- [ ] App mobile com React Native

### Versão v3.0
- [ ] Multi-dispositivo com login
- [ ] Compartilhamento de metas com accountability partner
- [ ] Integração com vagas de emprego EUA (LinkedIn, Indeed)
