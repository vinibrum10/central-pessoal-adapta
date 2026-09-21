# 🤖 Agente de melhoria do SGP

Um agente de IA **autônomo** que roda **na sua máquina**, sem custo de licença, e
que: **entrevista você → planeja → programa → roda os testes → abre um Pull
Request** no seu GitHub. Você aprova cada etapa importante (ou liga o autopilot).

> **Custo zero?** Sim. O "framework" é o [Vercel AI SDK](https://sdk.vercel.ai)
> (open-source, MIT). O motor de IA é **híbrido**:
> - **Ollama** (modelo local, roda offline na sua máquina, sem chave, sem cota) →
>   usado para **entender seu pedido e planejar** (etapas leves e privadas).
> - **Gemini** (free tier, você já tem `GEMINI_API_KEY` no projeto) → usado para
>   **escrever código** (onde é preciso raciocínio forte). O free tier é grátis
>   até a cota diária.

---

## Por que essa divisão de motores (e não tudo local)?

Escrever React + TypeScript correto num projeto grande como o SGP exige um
modelo de raciocínio forte. Modelos locais pequenos (7–8B) erram muito e
**quebram o build**. Por isso, por padrão:

| Etapa | Motor padrão | Por quê |
|-------|--------------|---------|
| Entrevista + Plano | **Ollama (local)** | É leve, e mantém seu pedido/dados na sua máquina. |
| Escrever/editar código | **Gemini** | Precisa de raciocínio forte para não quebrar o build. |

Você pode forçar qualquer combinação com variáveis de ambiente (abaixo). Se o
Ollama estiver desligado, o agente cai automaticamente para o Gemini.

---

## Pré-requisitos

### 1. Ollama (para as etapas locais) — opcional, mas recomendado
```bash
# instale de https://ollama.com/download  e depois baixe um modelo:
ollama pull qwen2.5-coder:7b     # bom p/ tarefas técnicas; ~5 GB, precisa ~8 GB RAM
ollama serve                     # deixa o servidor local no ar (porta 11434)
```
Se você **não** instalar o Ollama, tudo funciona mesmo assim — o agente usa o
Gemini para todas as etapas.

### 2. Chave do Gemini (grátis)
Pegue em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) e
coloque no seu `.env`:
```
GEMINI_API_KEY=xxxxxxxx
```
(Já existe essa variável no projeto — o agente reaproveita a mesma.)

### 3. Token do GitHub (para abrir o PR sozinho)
Crie um token em
[github.com/settings/tokens](https://github.com/settings/tokens) com o escopo
**`repo`** (ou um fine-grained token com *Contents* e *Pull requests* =
Read/Write) e exporte:
```
export GITHUB_TOKEN=ghp_xxxxxxxx
```
Sem o token, o agente ainda **commita e faz push** da branch — só não abre o PR
automaticamente (ele te dá o link para abrir com 1 clique).

---

## Como usar

```bash
# instale as dependências uma vez
npm install

# modo interativo (recomendado): ele te entrevista e pede confirmação em cada etapa
npm run agent

# passar o pedido direto na linha de comando
npm run agent -- "melhorar o dashboard de finanças e remover gráficos que não uso"

# autopilot: sem confirmações (ele decide e vai até o PR sozinho)
npm run agent -- --yes "otimizar o carregamento da página de vagas"

# dry-run: entrevista + plano + edições nos arquivos, mas SEM commit/push/PR
npm run agent -- --dry-run
```

### O fluxo, passo a passo
1. **Entrevista** — o agente faz perguntas curtas até entender exatamente o que
   você quer (usa o Ollama local).
2. **Plano** — mostra os arquivos que pretende mexer, os passos e os riscos.
   **Você aprova.**
3. **Branch** — cria uma branch dedicada `agent/...`. **Nunca escreve na `master`.**
4. **Implementação** — lê arquivos, edita, apaga código morto, e **roda
   `build` + `test` sozinho**; se falhar, lê o erro e corrige, repetindo até
   passar.
5. **Commit → Push → Pull Request** — cada um com sua confirmação (ou automático
   no `--yes`).

---

## Variáveis de ambiente

| Variável | Padrão | O que faz |
|----------|--------|-----------|
| `GEMINI_API_KEY` | — | Chave do Gemini (free tier). Sem ela, tudo vai pro Ollama. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo Gemini. |
| `OLLAMA_BASE_URL` | `http://localhost:11434/api` | Endereço do Ollama local. |
| `AGENT_OLLAMA_MODEL` | `qwen2.5-coder:7b` | Modelo local a usar. |
| `AGENT_CODER` | auto (`gemini` se houver chave) | Motor para **escrever código**: `gemini` ou `ollama`. |
| `AGENT_PLANNER` | auto (`ollama` se houver chave Gemini) | Motor para **entrevista/plano**. |
| `GITHUB_TOKEN` | — | Token para abrir o PR. |
| `AGENT_AUTOPILOT` | `false` | `true` = sem confirmações. |
| `AGENT_DRY_RUN` | `false` | `true` = não commita/push/PR. |
| `AGENT_MAX_STEPS` | `40` | Teto de ações do agente por tarefa (rede de segurança). |

Exemplo para rodar **100% local** (privacidade total, sem enviar nada pra fora):
```bash
AGENT_CODER=ollama AGENT_PLANNER=ollama npm run agent
```
> ⚠️ Nesse modo o código pode sair com mais erros; revise bem o PR antes do merge.

---

## Segurança (o que o agente NÃO pode fazer)

- **Não escreve na branch principal** — só em branches `agent/...`. O merge é
  sempre seu, via PR.
- **Não sai do repositório** — leitura/escrita são confinadas à raiz do projeto
  (tentativas de `../..` são bloqueadas).
- **Não roda shell arbitrário** — a única execução permitida é `npm run
  test/build/lint/typecheck` (lista fixa). Ele não consegue rodar comandos
  perigosos.
- **Não toca no próprio código** (`agent/`) nem em segredos (`.env`).
- **Pede confirmação** antes de commit, push e PR (a menos que você use `--yes`).

---

## Estrutura

```
agent/
├── README.md            ← este arquivo
├── tsconfig.json        ← config TS isolada (não entra no build do app)
└── src/
    ├── index.ts         ← orquestra tudo (entrevista → PR)
    ├── config.ts        ← lê env e decide os motores (roteamento híbrido)
    ├── llm.ts           ← providers Ollama/Gemini via AI SDK + checagem de saúde
    ├── prompts.ts       ← os prompts de sistema (ajuste o comportamento aqui)
    ├── repoContext.ts   ← "retrato" leve do repo para dar contexto ao modelo
    ├── interview.ts     ← a entrevista
    ├── planner.ts       ← geração do plano
    ├── coder.ts         ← o loop autônomo que programa (tool calling)
    ├── tools.ts         ← ferramentas (ler/escrever/apagar/buscar/testar) + segurança
    ├── git.ts           ← branch/commit/push
    └── github.ts        ← abertura do PR via API REST
```
