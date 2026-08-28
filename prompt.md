# Prompt: Aplicação de Planning Poker Colaborativo em Tempo Real

Você vai construir uma aplicação web full-stack de **Planning Poker** para times ágeis. A aplicação deve funcionar como uma "sala de jogo online" (estilo mesa de cartas multiplayer): pessoas entram em uma sala, o **PO (Product Owner)** configura e conduz a sessão, e o time estima histórias colaborativamente, com tudo registrado para gerar um relatório da sprint ao final.

Capriche no front-end: a experiência precisa ser **divertida e visualmente viva** — isso é tão importante quanto a funcionalidade, porque o público-alvo (devs em reunião de planning) precisa se distrair um pouco enquanto trabalha.

---

## 1. Stack Tecnológica

- **Frontend:** React (Vite), TypeScript, Socket.IO client, Zustand ou Redux Toolkit para estado global, Framer Motion para animações, TailwindCSS para estilo.
- **Backend:** NestJS (TypeScript), com um **Gateway Socket.IO** dedicado para eventos em tempo real e módulos REST para operações CRUD auxiliares (autenticação, histórico, relatórios).
- **Banco de dados:** PostgreSQL + Prisma (ou TypeORM) como ORM.
- **Realtime:** Socket.IO (namespaces por sala, rooms internas do Socket.IO por `roomId`).
- **Cache/estado efêmero (opcional, recomendado):** Redis, para guardar estado da rodada em andamento (quem já votou, timers ativos) e permitir múltiplas instâncias do backend (pub/sub do Socket.IO via `@socket.io/redis-adapter`).
- **Autenticação:** JWT leve. Fluxo tipo "jogo online": criador da sala gera um **código/link de convite**; quem entra escolhe nome, avatar e papel (ou papel é atribuído pelo PO). Login completo (e-mail/senha ou SSO) é opcional para usuários "donos de conta" que têm histórico de salas anteriores.
- **IA (participantes-bot):** integração com a API da Anthropic (Claude) para simular um "Agente IA Dev/QA" que participa da estimativa e do chat com justificativas plausíveis, com base no contexto da história.
- **Containerização:** toda a API (backend NestJS) deve rodar em **Docker**. Forneça:
  - `Dockerfile` multi-stage para o backend (build → runtime enxuto, ex: `node:alpine`).
  - `docker-compose.yml` orquestrando: serviço da API, PostgreSQL, Redis (para o adapter do Socket.IO) e, opcionalmente, o frontend também containerizado para ambiente de dev.
  - Variáveis de ambiente via `.env` (`DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `JWT_SECRET`, etc.), nunca hardcoded na imagem.
  - Healthcheck do container da API e `depends_on` com condição de saúde para o Postgres/Redis, garantindo que a API só suba depois que o banco estiver pronto.
  - Migrations do Prisma rodando automaticamente (ou via script/entrypoint) na subida do container em dev.

---

## 2. Conceito Central do Produto

- Uma **Sala (Room)** representa uma sessão de Planning Poker (ex: "Sprint 23").
- Dentro da sala, o PO cadastra uma lista de **Histórias/Itens de Backlog (Stories)** a serem estimados, uma por vez.
- Para cada história, ocorre uma **Rodada de Votação**:
  1. PO apresenta a história (título + descrição + "Ponto da História: Definir Complexidade").
  2. Timer de **Tempo de Reflexão** começa a contar (parametrizável).
  3. Cada participante escolhe uma carta da sua mão e a "joga" (carta vai para a mesa, virada para baixo — os outros veem só que a pessoa já votou).
  4. Um indicador mostra o progresso: **"3 de 4 jogadores jogaram"**.
  5. Quando todos votam, ou o **tempo de reflexão esgota**, ou o **PO força o encerramento**, o botão **"Revelar Cartas"** fica habilitado.
  6. PO clica em revelar → todas as cartas viram simultaneamente (com animação).
  7. Se houver **divergência** (não é o mesmo valor para todos), abre-se automaticamente uma **fase de Discussão** (com seu próprio timer parametrizável), onde o chat fica em destaque para as pessoas justificarem seus votos.
  8. PO decide: nova rodada de votação (revote) para essa história, ou aceitar o consenso/média e travar o valor, avançando para a próxima história.
- Ao final de todas as histórias, o sistema gera automaticamente um **Relatório da Sprint**.

---

## 3. Modelo de Dados (entidades principais)

```
User
- id, nome, avatarUrl, email (opcional), isGuest, createdAt

Room
- id, codigoConvite, nome (ex: "Sprint 23"), status (aberta | em_andamento | encerrada)
- donoId (PO principal), createdAt
- config: RoomConfig (1:1)

RoomConfig
- deckType (fibonacci | fibonacci_modificado | t_shirt | custom)
- deckValues (jsonb, ex: [1,2,3,5,8,13,20,40,100,"café","?"])
- tempoReflexaoSegundos
- tempoDiscussaoSegundos
- permiteParticipantesIA (bool)
- maxParticipantes
- papeisPermitidos (jsonb: ["PO","Dev","QA","Scrum Master","Observador"])
- votoAnonimo (bool) -- se true, esconde quem votou o quê, mesmo após revelar
- revelacaoAutomatica (bool) -- revela sozinho quando todos votam, sem depender do PO
- criterioConsenso (unanime | media | mediana | decisao_po)
- permiteRevotoIlimitado (bool)

RoomParticipant
- id, roomId, userId, papel (PO | Dev | QA | ScrumMaster | Observador | IA_Agente)
- isIA (bool), status (ativo | desconectado), joinedAt

Story
- id, roomId, titulo, descricao, ordem, status (pendente | em_votacao | em_discussao | estimada | pulada)
- valorFinal, criterioUsado, tempoTotalSegundos, numeroDeRodadas

VoteRound
- id, storyId, numero (1ª, 2ª rodada de votação etc.), iniciadaEm, encerradaEm

Vote
- id, voteRoundId, participantId, valor, jogadaEm, revelado (bool)

ChatMessage
- id, roomId, storyId (nullable), participantId, texto, tipo (comentario | justificativa | sistema), criadoEm

SprintReport
- id, roomId, geradoEm, resumoJson (ver seção 8), urlExportPdf (opcional)
```

---

## 4. Papéis (Roles)

| Papel | Permissões |
|---|---|
| **PO (Product Owner)** | Cria/configura a sala, cadastra histórias, inicia/encerra rodadas, força revelação, decide consenso, gera relatório. Pode votar ou não (parametrizável). |
| **Scrum Master** | Pode controlar timers e mediar, mas não decide valor final (configurável). |
| **Dev / QA / Outros** | Votam e participam do chat/discussão. |
| **Observador** | Só assiste (vê mesa e chat), não vota. |
| **Agente IA** | Participante bot — vota e escreve justificativas no chat, como se fosse mais um membro do time. |

Papéis disponíveis por sala são definidos em `RoomConfig.papeisPermitidos`.

---

## 5. Eventos Socket.IO (contrato realtime)

Organize por namespace `/room` com `roomId` como sala interna do Socket.IO. Eventos sugeridos (cliente ⇄ servidor):

**Ciclo de vida da sala / participantes**
- `room:join` `{ roomId, nome, avatarUrl, papel }` → `room:state` (snapshot completo: participantes, config, história atual, mesa)
- `room:leave`
- `room:participantUpdate` (broadcast quando alguém entra/sai/desconecta)
- `room:configure` (PO altera parâmetros em tempo real, se sala ainda não iniciada)

**Fluxo da rodada**
- `story:present` `{ storyId }` — PO inicia a apresentação de uma história
- `timer:start` `{ tipo: 'reflexao'|'discussao', duracaoSegundos }`
- `timer:tick` (broadcast periódico do servidor, fonte única de verdade do relógio)
- `vote:cast` `{ storyId, valor }` — jogador joga a carta (servidor só informa aos demais que a pessoa votou, não o valor)
- `vote:progress` (broadcast: "3 de 4 jogadores jogaram")
- `vote:forceReveal` (PO força revelação antes do fim do timer)
- `vote:reveal` (broadcast: valores de todos os votos + estatísticas: min, max, média, moda, houve consenso?)
- `discussion:start` / `discussion:end`
- `vote:revote` `{ storyId }` — nova rodada de votação para a mesma história
- `story:finalize` `{ storyId, valorFinal, criterio }` — trava o valor e avança
- `story:skip`

**Chat / registro**
- `chat:message` `{ texto, tipo }`
- `chat:history` (ao entrar, recebe o histórico da sala)

**IA**
- `ai:requestVote` (servidor pede ao serviço de IA que gere voto + justificativa com base no contexto da história e do que já foi discutido)
- `ai:voteCast`, `ai:chatMessage` (broadcast como se fosse um participante normal)

**Relatório**
- `report:generate` (PO encerra a sala)
- `report:ready` `{ reportId, url }`

> Importante: o **servidor é a fonte de verdade** para timers e revelação — nunca confie no client para decidir "quando" revelar ou "quanto tempo falta". O client só renderiza o que recebe via `timer:tick` e `vote:reveal`.

---

## 6. UI/UX — Tela Principal (mesa de jogo)

Use como referência visual o layout do mockup enviado. Estrutura de três colunas + centro:

**Topo (barra de sessão):**
- Nome da sessão/sprint (ex: "Sessão: Sprint 23 - Adicionar Login OAuth")
- Countdown do "Tempo de Reflexão" bem visível
- "Ponto da História: [nome da fase atual]"
- Ícones de atalho: timer, participantes, agente IA, configurações

**Coluna esquerda — Painel de Estatísticas da Sprint:**
- Status da sala (aberta/em andamento)
- Lista de participantes com avatar, nome e papel (ex: "João (Você, Dev)", "Maria (PO)")
- Contadores: jogadores ativos, IAs ativas
- Botão "Gerar Relatório da Sprint"
- Bloco "Regras da Sala" (resumo da config: deck, tempos, etc.)

**Centro — Mesa:**
- Avatares dos participantes distribuídos ao redor de uma mesa oval (estilo jogo de cartas), com destaque visual para quem é o PO
- Cartas dos outros jogadores aparecem viradas para baixo assim que eles votam (sobem/deslizam para a mesa com animação)
- Indicador de progresso "X de Y jogadores jogaram" com barra de progresso
- Botão "PO Ok" (força avançar) e "Revelar Cartas" (habilita quando todos votaram ou o PO força)
- Ao revelar: todas as cartas viram com animação de flip simultânea, valores aparecem, sistema realça consenso (ex: confete se todo mundo votou igual) ou divergência (destaca outliers)
- Área central inferior: "Jogue a Carta Aqui" — zona de drop/clique para a própria carta do usuário

**Rodapé — Mão de cartas do jogador:**
- Cartas do baralho configurado (ex: 1, 2, 3, 5, 8, 13, 20, 40, 100, ☕ "Café/Pausa", ❓ "Não sei")
- Carta selecionada se destaca (eleva, brilha) antes de confirmar a jogada
- Estado "já joguei" — mão recolhe/esmaece até a revelação

**Coluna direita — Registro / Chat:**
- Feed cronológico de mensagens, com nome + papel do autor
- Mensagens do tipo "justificativa" (ligadas a um voto) podem ter estilo visualmente diferente do chat livre
- Mensagens de sistema (ex: "Pedro jogou uma carta", "Rodada revelada: consenso em 5") aparecem com estilo neutro
- Campo de input para enviar mensagem

---

## 7. Requisitos de "Diversão" no Front-end

Esta aplicação não pode parecer um formulário corporativo. Implemente:

- Avatares customizáveis (emoji ou ilustração simples) escolhidos ao entrar na sala.
- Animações de carta sendo jogada (deslizar até a mesa) e de flip na revelação.
- Micro-celebrações: confete/partículas quando há consenso total ou quando a estimativa é rápida.
- Reações rápidas estilo emoji flutuante (👍 🤔 😅 🔥) que qualquer participante pode disparar sobre a mesa, sem poluir o chat oficial.
- Pequenos "achievements"/badges de sessão (ex: "Consenso na 1ª rodada", "Discussão mais longa da sprint", "Voto mais divergente") mostrados no relatório final, de forma leve e bem-humorada.
- Sons discretos (opcional, com mute) para: carta jogada, revelação, timer acabando.
- Tema visual "mesa de jogo" (verde/madeira, como no mockup) com possibilidade de trocar de skin no futuro (não obrigatório na v1, mas deixe a estrutura de temas pronta).

---

## 8. Relatório da Sprint

Ao final (quando o PO clica em "Gerar Relatório da Sprint"), o sistema deve compilar, por história e no agregado:

- Lista de histórias com valor final estimado e critério usado (consenso, média, decisão do PO).
- Número de rodadas de votação por história (quantas vezes precisou revotar).
- Tempo total gasto por história (reflexão + discussão).
- Divergência inicial vs. final (ex: votos variaram de 3 a 13, fechou em 8).
- Trechos relevantes do chat/justificativas associados a cada história (principais preocupações levantadas — ex: segurança do endpoint, complexidade de biblioteca).
- Participação: quem votou em quais rodadas, quem fez mais comentários.
- Exportável em PDF/CSV, além de ficar disponível como página web permanente da sessão.

---

## 9. Participante IA

- Configurável por sala (`permiteParticipantesIA`).
- Quando ativo, o "Agente IA" entra como participante normal (aparece na mesa, tem avatar, papel definido, ex: "IA Agente, Dev").
- Ao ser sua vez de votar, o backend monta um prompt com: título/descrição da história, mensagens de chat já trocadas na rodada, papel atribuído à IA — e pede à API da Anthropic um voto (valor do deck) + uma justificativa curta em texto.
- O voto e a justificativa da IA entram no fluxo normal (`vote:cast`, `chat:message`), como se fosse mais um humano — inclusive contam para o cálculo de consenso/divergência.

---

## 10. Requisitos Não-Funcionais

- **Assíncrono/tempo real por padrão**: toda mudança de estado relevante é emitida via evento Socket.IO; o front nunca faz polling.
- **Reconexão**: se um participante cair, ao reconectar (mesmo `roomId` + token de sessão) ele recebe o snapshot atual (`room:state`) e volta a acompanhar a rodada em andamento sem perder o histórico.
- **Timers no servidor**: nenhum timer crítico deve rodar só no client.
- **Persistência**: mesmo com Socket.IO, tudo (votos, mensagens, histórias, relatório) é persistido no Postgres — a sala pode ser retomada ou consultada depois.
- **Escalabilidade horizontal**: prever adaptador Redis para múltiplas instâncias do backend compartilharem estado de salas/timers.
- **Segurança básica**: validar que só o PO (ou papéis autorizados) pode disparar eventos administrativos (`story:present`, `vote:forceReveal`, `room:configure`, `report:generate`).

---

## 11. Entregáveis Esperados

1. Estrutura de monorepo (ex: `apps/frontend`, `apps/backend`, `packages/shared-types` com os DTOs e tipos de eventos Socket.IO compartilhados entre front e back).
2. Schema Prisma completo baseado no modelo de dados da seção 3.
3. Gateway NestJS com todos os eventos da seção 5 implementados.
4. Módulo REST para: criar sala, autenticação leve/convite, buscar relatório de sessões passadas.
5. Frontend React com as telas: Home/criar-ou-entrar em sala, Configuração da sala (PO), Mesa de jogo (seção 6), Tela de relatório da sprint.
6. Serviço de integração com IA (participante bot) isolado em um módulo próprio, fácil de religar/desligar.
7. Seed/mock de dados para testar rapidamente uma sala com 4 participantes + 1 IA.
8. `Dockerfile` da API + `docker-compose.yml` (API + Postgres + Redis) prontos para subir o ambiente com um único `docker-compose up`, incluindo execução das migrations do Prisma.

---

**Comece pela modelagem de dados (Prisma schema) e pelo contrato de eventos Socket.IO (shared-types), depois construa o gateway do backend e só então o frontend — assim front e back compartilham os mesmos tipos desde o início.**