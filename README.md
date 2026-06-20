# Central Pessoal ADAPTA 🚀

> Sua central de comando pessoal: **Meta → Plano → Tarefa → Tempo → Finanças**

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
