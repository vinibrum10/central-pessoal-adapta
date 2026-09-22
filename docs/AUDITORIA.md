# 📋 Auditoria automática do SGP

> Gerado em 2026-09-22 00:17 por `npm run agent:audit` (análise determinística, sem IA).

## 1. Dependências instaladas e não usadas
Nenhuma importação encontrada em `src/` ou `api/` (fora de testes):

- `@dnd-kit/sortable` → **candidata a remoção**
- `@dnd-kit/utilities` → **candidata a remoção**

**Por quê:** peso morto no `package.json` e no `npm install`. Remover é seguro se nada as importa.

## 2. Code-splitting (carregamento sob demanda)
⚠️ **Não há code-splitting** (`React.lazy`/`import()` dinâmico não encontrado).

**Por quê:** todas as páginas entram no mesmo bundle e são baixadas juntas na primeira visita, deixando o carregamento inicial mais lento (especialmente no celular). Transformar as rotas em `React.lazy(() => import("./pages/X"))` com `<Suspense>` faz o Vite gerar um arquivo por página, carregado só quando acessada.

## 3. Bibliotecas pesadas carregadas estaticamente
Estas libs são grandes e entram no bundle mesmo quando o recurso não é usado:

- `xlsx` — usada em 2 arquivo(s)
- `recharts` — usada em 1 arquivo(s)
- `@azure/msal-browser` — usada em 1 arquivo(s)

**Por quê:** carregá-las sob demanda (com `import()` dinâmico no momento do uso — ex.: no clique de "exportar Excel") tira centenas de KB da primeira carga.

## 4. Arquivos muito grandes
Os maiores arquivos de código (linhas):

- `src/pages/Orcamento.tsx` — 2442 linhas ⚠️
- `src/pages/AgendaTempo.tsx` — 1502 linhas ⚠️
- `src/pages/Metas.tsx` — 1030 linhas ⚠️
- `src/pages/PlanoAcao.tsx` — 1007 linhas ⚠️
- `src/pages/LeituraDiaria.tsx` — 948 linhas ⚠️
- `src/pages/Inicio.tsx` — 839 linhas ⚠️
- `src/hooks/useApp.tsx` — 730 linhas
- `src/layouts/Layout.tsx` — 649 linhas

**Por quê:** arquivos acima de ~800 linhas costumam concentrar muito estado e re-renderizar blocos grandes a cada mudança (custo de performance) e são difíceis de manter. Vale quebrar em subcomponentes aos poucos — tarefa maior, feita com revisão.

## 5. Tamanho do bundle de produção
- `dist/assets/index-C5OnZdsw.js` — 1.98 MB ⚠️ (>500 kB)
- `dist/assets/icsParser-BOfjGN40.js` — 1 kB

---
## Como agir (do mais seguro ao mais delicado)

| Ação | Risco | Cabe ao agente? |
|---|---|---|
| Remover dependências não usadas | Baixíssimo | ✅ tarefa pequena e específica |
| Lazy-load das rotas | Baixo | ✅ um PR focado |
| Lazy-load de libs pesadas | Baixo-médio | ✅ uma por vez |
| Quebrar arquivos gigantes | Médio-alto | ⚠️ só com revisão |