# Planning Poker - Tasks por camada

Fonte de requisitos: [prompt.md](./prompt.md).

Legenda: `[x]` feito, `[~]` parcial, `[ ]` pendente.

## 1. Raiz, monorepo e infraestrutura

### Feito

- [x] Estrutura separada em `frontend`, `api` e `packages/shared-types`.
- [x] `.gitignore` configurado para dependencias, builds, ambientes e arquivos locais.
- [x] `docker-compose.yml` com API, PostgreSQL e Redis.
- [x] Container da API nomeado `planning-pocker`.
- [x] Healthchecks para API, PostgreSQL e Redis.
- [x] `depends_on` da API condicionado a servicos saudaveis.
- [x] `api/Dockerfile` multi-stage com Node Alpine.
- [x] Variaveis basicas via ambiente: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` e `PORT`.
- [x] README com comandos de execucao, portas e estrutura.
- [x] Constituicao do projeto definida em `.specify/memory/constitution.md` e templates Spec Kit sincronizados.
- [x] Especificacao inicial do produto criada em `specs/001-collaborative-planning-poker/spec.md`.


### Pendente

- [x] Containerizar frontend para ambiente de desenvolvimento via `frontend/Dockerfile`, nginx SPA fallback e serviço Compose na porta 5173.
- [x] Adicionar configuracao LLM provider-neutral ao compose e ao fluxo da API (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_TIMEOUT_MS`).
- [x] Trocar `prisma db push` por migrations versionadas em producao; entrypoint usa `npm run db:migrate:deploy`.
- [~] Correlation ID HTTP e logger com redacao de segredos adicionados; correlação completa de eventos realtime ainda pendente.
- [ ] Configurar segredos reais fora de valores default de desenvolvimento.
- [~] Feature Spec Kit `002-user-auth-rooms` em implementacao; env examples receberam `ACCOUNT_SESSION_TTL`, mas segredos reais seguem externos.

## 2. Shared types e contrato Socket.IO

### Feito

- [x] Tipos de sala, configuracao, participante, historia, voto, chat e relatorio.
- [x] Tipos de eventos cliente-servidor e servidor-cliente.
- [x] Namespace `/room` definido no contrato.
- [x] Cliente frontend corrigido para conectar em `/room`.
- [x] Tipos de visibilidade publica/privada e senha opcional no ingresso.

### Pendente

- [~] Usar shared types diretamente no gateway, sem tipos duplicados locais.
- [~] Alinhar nomes de campos com prompt: `nome`, `avatarUrl`, `papel`, `valor`.
- [~] Completar contratos de timer, configuracao, apresentacao, discussao, revote, IA e relatorio.
- [ ] Adicionar DTOs compartilhados para validacao de payloads.
- [~] Tipos compartilhados de auth, salas vinculadas, perfil de sala e solicitacao de papel adicionados para `002-user-auth-rooms`; gateway ainda mantem tipos locais.

## 3. Banco de dados e persistencia

### Feito

- [x] Schema Prisma criado para `User`, `Room`, `RoomConfig`, `RoomParticipant`, `Story`, `VoteRound`, `Vote`, `ChatMessage` e `SprintReport`.
- [x] PostgreSQL executando no Docker.
- [x] Prisma Client gerado durante build/subida da API.
- [x] Tabelas sincronizadas no startup de desenvolvimento.
- [x] Criacao basica de sala, historia e relatorio via service REST.
- [x] Hash bcrypt para senha de salas privadas.
- [x] Salas existentes preservadas como publicas por default via migration.

### Pendente

- [x] Persistir entrada e saida de participantes.
- [x] Persistir cada rodada e cada voto.
- [x] Persistir mensagens realtime de chat.
- [~] Persistir estado atual da rodada e seus timers; deadlines agora sao salvos em `VoteRound`, mas a recuperacao distribuida/atomicidade ainda esta pendente.
- [x] Gerar migration Prisma versionada `0001_realtime_baseline`.
- [ ] Criar seed com 4 participantes e 1 IA.
- [ ] Implementar consultas de historico e relatorios anteriores.
- [~] Schema/migration de autenticacao de usuario, perfil por sala, `lastSeenAt` e solicitacao de papel adicionados; migration ainda precisa ser aplicada em banco real.

## 4. Backend NestJS e REST

### Feito

- [x] Aplicacao NestJS compilando e iniciando.
- [x] `GET /health`.
- [x] `POST /rooms` para criacao basica.
- [x] `POST /rooms` aceita `visibility` e `password` com validacao minima.
- [x] `GET /rooms/:id`.
- [x] `GET /rooms/:id` nao expõe hash de senha.
- [x] `POST /rooms/:id/stories`.
- [x] `POST /rooms/:id/report` para gerar registro basico.
- [x] CORS habilitado.
- [x] `ValidationPipe` global configurado.

### Pendente

- [~] CRUD completo de salas, historias e configuracoes.
- [ ] Fluxo de convite por codigo/link.
- [~] Autenticacao leve com JWT de conta implementada para registro, login, me e logout em `api/src/auth`; cobertura REST completa ainda pendente.
- [~] Guardas e autorizacao por papel, principalmente PO.
- [~] Endpoints de login, cadastro, logout, `GET /auth/me`, `GET /rooms/mine`, join com conta e rejoin de membro adicionados; E2E completo ainda pendente.
- [~] Endpoint para listar relatorios e sessoes passadas com sessao JWT; rota de visualizacao implementada, validacao E2E ainda pendente.
- [~] Exportacao de relatorio em CSV e PDF; rotas e botoes frontend implementados, testes de download/compatibilidade ainda pendentes.

## 5. Gateway e realtime

### Feito

- [x] Gateway Socket.IO no namespace `/room`.
- [x] Rooms internas usando `roomId`.
- [x] `room:join` e `room:leave`.
- [x] `room:join` valida senha de salas privadas.
- [x] Broadcast de snapshot por `room:state`.
- [x] Atualizacao de participantes ao entrar ou desconectar.
- [x] `vote:cast` com valor oculto antes da revelacao.
- [x] `vote:progress`.
- [x] `vote:forceReveal` e `vote:reveal` com media, minimo, maximo e consenso.
- [x] `chat:message`.
- [x] Reconexao basica recebe estado enquanto processo da API permanece ativo.
- [x] Smoke test validando dois clientes na mesma sala e propagacao de chat.

### Pendente

- [~] Remover estado operacional da memoria e usar Redis/PostgreSQL como fonte de restauracao.
- [~] Servico `RoomStateService` salva snapshots ativos em Redis com fallback de memoria e gateway restaura snapshot; merge completo com PostgreSQL ainda pendente.
- [x] Persistir e restaurar participantes, historias, votos e chat via PostgreSQL.
- [x] Integrar Redis adapter para multiplas instancias.
- [~] Implementar `room:participantUpdate` dedicado; snapshot ja atualiza participantes.
- [x] Implementar `room:configure`.
- [x] Implementar `story:present`.
- [~] Implementar timers de reflexao e discussao no servidor com deadline persistido e servico dedicado; recuperacao distribuida/atomicidade ainda pendente.
- [x] Emitir `timer:start`, `timer:tick` e `discussion:start`.
- [x] Emitir `discussion:end` ao fim do timer.
- [x] Habilitar revelacao por todos os votos, timeout ou comando autorizado.
- [x] Implementar `vote:revote`.
- [x] Implementar `story:finalize` e `story:skip`.
- [~] Restaurar historico via `room:state`; evento `chat:history` separado ainda pendente.
- [x] Implementar reacoes.
- [~] Validar payloads, sala, historia, participante e deck no servidor.
- [~] Validar autorizacao PO/Scrum Master em eventos administrativos.
- [x] Emitir `report:ready` apos gerar relatorio.
- [~] `room:join` passou a restaurar participante existente e usar nome/avatar especificos da sala; eventos dedicados de perfil/papel ainda pendentes.
- [~] Eventos `room:profileUpdate`, `room:roleChangeRequest` e `room:profileDecision` adicionados no gateway; UI e E2E multiusuario ainda pendentes.

## 6. Frontend React

### Feito

- [x] Vite + React + TypeScript.
- [x] Zustand para estado global.
- [x] Framer Motion para animacoes basicas.
- [x] TailwindCSS configurado no projeto.
- [x] Tela de entrada com nome, sala e avatar.
- [x] Mesa com participantes, status, progresso, baralho e chat.
- [x] Selecao e envio de carta.
- [x] Exibicao de carta virada antes da revelacao.
- [x] Acao de revelar cartas.
- [x] Atualizacao realtime de participantes, votos, revelacao e chat.
- [x] Rotas `/` e `/room/:code` com captura de codigo.
- [x] Formulario de senha para salas privadas antes do Socket.IO.
- [x] Build e lint passando.
- [x] Estilos da entrada e mesa reorganizados: botoes com estados, checkbox acessivel, campos alinhados e responsividade base.
- [x] Campos de senha com toggle visual para mostrar ou ocultar o valor.
- [x] Tela inicial ajustada para layout visual com apresentacao, cartas em leque, painel compacto e dica inferior.
- [x] Tela inicial refinada para o mock escuro com headline em destaque, painel creme e selecao de avatar no ingresso.
- [x] Tela inicial raiz voltou a exibir o leque de cartas e foi reduzida para caber sem scroll vertical em viewport desktop comum.
- [x] Tela inicial recebeu regras responsivas por altura (`max-height`) para evitar scroll em desktops com viewport mais baixa.
- [x] Entrada em sala privada nao faz fallback local quando `POST /rooms/:id/join` falha com `404`; usuario fica fora da mesa com erro visivel.
- [x] `docker-compose.yml` agora usa `JWT_SECRET` de desenvolvimento valido por default, evitando queda da API containerizada ao subir em 29/08/2026 sem segredo externo definido.
- [x] Fluxo de ambiente para clone alinhado com `.env.example` na raiz para Docker Compose e `.env.example` por camada para execucao local fora do Docker.
- [x] Tela da sala redesenhada no padrao mesa oval escura do mockup, com topo compacto, fase/timer e chat lateral.
- [x] Telas frontend de minhas salas, perfil e configuracoes adicionadas com navegacao lateral.
- [x] Navegacao de entrada normaliza codigo, rota ou URL de sala antes de abrir `/room/:code`.
- [x] Entrada pela home autentica e abre direto mesa de poker, inclusive em sala privada com senha.
- [x] Tela raiz organizada em dois cartoes empilhados na coluna direita: `Sua conta` (login/cadastro, `account-card`) acima e `Mesa` (`join-panel` dentro de `home-stack`) abaixo, com estilos proprios para o painel de conta e erro de autenticacao separado (`account-error`); rotulos de senha desambiguados ("Senha da conta" e "Senha da sala").
- [x] Tela raiz agora mostra um unico card por vez via `card-switch` (abas `Sua conta` e `Mesa`) em vez de empilhar os dois; `homeCard` controla qual card renderiza na home e a rota `/room/:code` continua exibindo apenas a mesa.
- [x] Card de login (`Sua conta`) passou a ser o padrao na home (`homeCard` inicia em `account`); testes e2e atualizados para abrir a aba `Mesa` quando interagem com a sala.
- [x] Campo "Senha da conta" ganhou icone de mostrar/ocultar senha (mesmo padrao dos campos de sala).
- [x] Cadastro agora tem campos visiveis de `Nome` e seletor de avatar no card `Sua conta` (modo Cadastro); avatares substituidos por opcoes serias de poker (`♠ ♥ ♦ ♣ 🃏 🎩`) em vez de emojis animais.
- [x] `POST /auth/register` e `POST /auth/login` voltaram a responder: o container Docker da API rodava build de 29/08 sem o modulo de auth; rebuild `docker compose build api && docker compose up -d api` expoe as rotas e registro retorna `201`.
- [x] Nome e avatar na tela da mesa ficam fixos quando logado (vindos do perfil da conta, com `account-avatar-fixed`); backend `RoomService.joinSession` nao sobrescreve mais o perfil global da conta ao entrar na sala (usa `findUnique` e identidade da conta no `RoomParticipant`); teste unitario em `room.service.spec.ts` valida a nao-sobrescricao.
- [x] Rota direta `/room/:code` reaproveita a mesma tela inicial de entrada, sem segunda tela duplicada.
- [x] Recarregar `/room/:code` com sessao salva reconecta direto para mesa sem piscar tela de entrada.
- [x] Cliente Socket.IO da mesa passou a usar `websocket` direto, evitando enxurrada de requests `transport=polling` observada em 29/08/2026.
- [x] Restauração de sessão inválida não entra em loop: token/sessão antigos são removidos após `room:error`, e cada rota recebe no máximo uma tentativa automática.
- [x] Socket.IO limita tentativas automáticas de reconexão para evitar flood quando backend ou sessão está indisponível.
- [x] Reconexão de sala privada com token válido não exige senha novamente; senha fica apenas na `sessionStorage` enquanto necessária ao fluxo de entrada.
- [x] Loading de reconexao deixou de usar o visual da tela de entrada: novo `restoring-shell`/`restoring-card`/spinner em tema escuro da mesa; `restoringRoom` so renderiza loading enquanto nao entrou na mesa (`joined`), evitando travamento ao levar sessao da home para `/room/:code`.

- [x] Fluxo entrada/mesa separado: mesa so renderiza apos `room:state` confirmado da sala atual, sem flash ao errar senha, usar sala inexistente ou receber token invalido.

### Pendente

- [x] Home completa para criar ou entrar em sala.
- [x] Home separada por rota com criacao de sala publica ou privada.
- [~] Tela de configuracao visual disponivel em `/settings`; integracao completa com permissoes PO e persistencia ainda pendente.
- [ ] Selecao real de papel e avatar no ingresso.
- [ ] Controle visual de permissoes por papel.
- [~] Renderizar historia atual por `story:present`.
- [x] Renderizar countdown por `timer:tick` do servidor.
- [~] Bloquear revelar ate condicao valida.
- [ ] Animacao completa de carta deslizando e flip simultaneo.
- [~] Fase de discussao, revote, finalizacao e proxima historia.
- [ ] Confete/particulas em consenso.
- [ ] Reacoes flutuantes sobre a mesa.
- [ ] Badges/achievements no relatorio.
- [ ] Sons opcionais com mute.
- [ ] Estrutura de temas/skins.
- [ ] Tela dedicada de relatorio com exportacoes.
- [~] Estados de erro, reconexao, carregamento e sala encerrada.
- [ ] Teste visual e responsivo em desktop e mobile.
- [~] Login/cadastro basico, sessao de conta, `Minhas Salas` via API e rejoin por conta adicionados sem redesenho amplo; testes Playwright especificos ainda pendentes.

## 7. Participante IA

### Feito

- [x] Adapter LLM provider-neutral isolado com timeout, prompt limitado e resposta estruturada; suporta OpenRouter, OpenAI e endpoints OpenAI-compatible.
- [x] Participante IA cria identidade, vota, registra justificativa, expõe status realtime e possui controles frontend.

### Pendente

- [x] Criar modulo/servico LLM isolado em `api/src/ai/llm.client.ts`.
- [x] Configurar chave, base URL, modelo, timeout e limites via ambiente.
- [x] Criar participante IA por sala.
- [x] Montar prompt com historia, papel e contexto recente de chat.
- [x] Validar voto contra deck permitido.
- [x] Emitir voto e justificativa como participante normal.
- [~] Tratar timeout, erro e indisponibilidade do provedor; limite de custo por rodada implementado via `LLM_MAX_REQUESTS_PER_ROUND`, com status de erro e fallback manual visíveis.
- [x] Adicionar toggle na configuracao da sala e acao para solicitar voto IA.

## 8. Relatorio da sprint

### Feito

- [x] Modelo `SprintReport` criado.
- [x] Endpoint basico de geracao de relatorio.
- [x] Registro basico de relatorio testado via REST.

### Pendente

- [~] Compilar historias, valor final, criterio e rodadas.
- [ ] Calcular tempo de reflexao e discussao por historia.
- [ ] Registrar divergencia inicial e final.
- [ ] Associar chat e justificativas por historia.
- [x] Consolidar participacao e comentarios.
- [x] Calcular badges/achievements basicos a partir de historias e participacao em `api/src/reports/achievements.service.ts`.
- [~] Gerar pagina web permanente via rota `/report/:id` com historias, participacao e achievements; refinamentos visuais ainda pendentes.
- [~] Exportar CSV e PDF; ambas rotas implementadas, testes de download/compatibilidade ainda pendentes.
- [ ] Emitir `report:ready` para todos na sala.

## 9. Qualidade e verificacao

### Feito

- [x] Frontend: `npm run build`.
- [x] Frontend: `npm run lint`.
- [x] Frontend: `npm run build` e `npm run lint` executados apos a revisao visual de `frontend/src/index.css`.
- [x] Frontend: `npm run build` e `npm run lint` executados apos correcao do seletor visual entre entrar e criar sala.
- [x] Frontend: `npm run build` e `npm run lint` executados apos adicionar toggle visual de senha.
- [x] Frontend: `npm run build` e `npm run lint` executados apos ajustar a tela inicial ao mockup enviado.
- [x] Frontend: `npm run build` e `npm run lint` executados apos redesenhar sala e adicionar telas de minhas salas, perfil e configuracoes.
- [x] Frontend: `npm run build` e `npm run lint` executados apos corrigir normalizacao do caminho de entrada em sala.
- [x] Frontend: `npm run test:e2e` validou em Chromium criacao de sala privada e entrada por codigo+senha direto na mesa.
- [x] Frontend: `npm run test:e2e -- tests/room-entry.spec.ts --browser=chromium` validou home e rota direta `/room/:code` sem tela legada duplicada.
- [x] Frontend: `npm run build`, `npm run lint` e `npm run test:e2e -- tests/room-entry.spec.ts --browser=chromium` executados apos refinamento visual final da tela inicial.
- [x] Frontend: `npm run build` e `npm run lint` executados apos restaurar o leque de cartas e reduzir a altura visual da home.
- [x] Frontend: `npm run build` e `npm run lint` executados apos compactar a home para viewports desktop de menor altura.
- [x] API: `npm run build` e `npm test`; Frontend: `npm run build`, `npm run lint` e `npm run test:e2e -- tests/room-entry.spec.ts --browser=chromium` executados apos bloquear fallback local em senha errada ou sala ausente.
- [x] Docker: `docker compose up --build -d api` voltou a subir API com `JWT_SECRET` default de desenvolvimento; Frontend: Playwright ganhou cobertura para sala inexistente.
- [x] Frontend: `npm run build`, `npm run lint` e `npm run test:e2e -- tests/room-entry.spec.ts --browser=chromium` executados apos bloquear flash da tela de entrada no reload da rota da sala.
- [x] Frontend: `npm run build`, `npm run lint` e `npm run test:e2e -- tests/room-entry.spec.ts --browser=chromium` executados apos travar Socket.IO em websocket e cobrir ausencia de polling no browser.
- [x] Frontend: correção do loop de restauração com sessão inválida e limite de reconexão; build, lint e testes E2E de entrada executados.
- [x] Backend: API rebuildada após permitir reconexão autenticada de sala privada; frontend: build, lint e 7 testes E2E em `http://localhost:5173` aprovados.
- [x] Frontend: `npm run build`, `npm run lint` e 6 testes e2e (room-entry.spec.ts, incluindo reload sem flash) aprovados apos redesenhar o loading de reconexao fora do visual de entrada e corrigir guard `restoringRoom && !joined`; e2e inicial revelou travamento na tela de reconexao ao levar sessao da home para a rota da sala, resolvido pelo novo guard.
- [x] Frontend: `npm run build`, `npm run lint` e 8 testes e2e (room-entry.spec.ts) aprovados apos separar a camada de conta da camada de sala na home; testes que usavam indice de input migrados para seletores por label e rotulos de senha desambiguados.
- [x] Frontend: `npm run build`, `npm run lint` e 9 testes e2e (room-entry.spec.ts) aprovados apos tornar os cards da home exclusivos com seletor `card-switch`; novo teste cobre alternancia entre `Sua conta` e `Mesa` mostrando um card por vez.
- [x] Frontend: `npm run build`, `npm run lint` e 9 testes e2e aprovados apos definir o card de login como padrao da home; testes de entrada em sala agora abrem a aba `Mesa` explicitamente.
- [x] API: `npm run build` e 24 testes aprovados; `docker compose build api` + `docker compose up -d api` revalidados com rotas `/auth/*` mapeadas no container. Frontend: `npm run build`, `npm run lint` e 10 testes e2e aprovados apos adicionar campos de nome/avatar no cadastro e avatares de poker; novo teste cobre cadastro completo (registro, nome, avatar e conta criada).
- [x] API: `npm run build` e 25 testes (14 arquivos) aprovados apos `joinSession` parar de sobrescrever perfil da conta; `docker compose build api` + `docker compose up -d api` revalidados. Frontend: `npm run build`, `npm run lint` e 10 e2e aprovados apos fixar nome/avatar do perfil na entrada da mesa quando logado.
- [x] Frontend: 11 testes e2e aprovados apos adicionar teste de login pela UI (cria conta via API, faz login no card `Sua conta` e permanece logado); fluxos de cadastro, login, criacao de sala e entrada em sala cobertos.
- [x] Frontend: `npm run build`, `npm run lint` e `FRONTEND_URL=http://localhost:5173 npm run test:e2e -- tests/room-entry.spec.ts --browser=chromium` com 8 testes aprovados apos separar estados de entrada/loading/mesa, exigir `room:state` antes de renderizar mesa e remover disconnect indevido na troca de rota.
- [x] Docker: `docker compose config --quiet` revalidado apos alinhar `.env.example` da raiz, compose e exemplos por camada.
- [x] `.env.example` da raiz e `api/.env.example` documentados com seus cenarios (Docker vs execucao local) e README atualizado orientando a manter os dois sincronizados; `docker compose config --quiet` revalidado.
- [x] API: `npx prisma validate`.
- [x] API: `npm run build`.
- [x] API: `npm test`.
- [x] Docker: `docker compose config --quiet`.
- [x] Docker: healthcheck da API.
- [x] Smoke test REST.
- [x] Smoke test Socket.IO com dois clientes.
- [x] Smoke test completo: dois clientes, chat, apresentacao, votos, revelacao e discussao.
- [x] Smoke test de sala privada: hash oculto, senha invalida rejeitada e senha correta aceita.
- [x] Validacao da constituicao: sem placeholders de template, versao 1.0.0 consistente e datas ISO.
- [x] Checklist de qualidade da especificacao concluido em `specs/001-collaborative-planning-poker/checklists/requirements.md`.
- [x] Plano e artefatos de design gerados em `specs/001-collaborative-planning-poker/`.
- [x] Plano regenerado com clarificacao de acesso a relatorios refletida em `specs/001-collaborative-planning-poker/plan.md`.
- [x] Tasks regeneradas com regra de acesso e exportacao de relatorios refletida em `specs/001-collaborative-planning-poker/tasks.md`.
- [x] Ignore de Docker e exemplo de ambiente da API adicionados em `.dockerignore` e `api/.env.example`.
- [x] Configuracao opcional de LLM adicionada ao `docker-compose.yml` sem hardcode de credencial.
- [~] Shared types agora incluem criterio de consenso e codigos de erro; contratos completos ainda pendentes.
- [x] Implementacao inicial validada: frontend build/lint, Prisma validate, API build/test e Docker Compose config.
- [~] DTOs class-validator adicionados para criacao de salas e historias; autenticacao e CRUD completo ainda pendentes.
- [x] API recompilada e testes unitarios executados apos adicao dos DTOs; Prisma e Docker validados novamente.
- [x] API recompilada, Prisma Client regenerado, testes, validacao Prisma e Docker executados apos persistencia/configuracao.
- [~] Gateway agora rejeita sala cheia, papel não permitido e configuração inválida; política centralizada ainda pendente.
- [x] API build/test, frontend build e Docker Compose config executados após validações do gateway.
- [~] Serviços de autorização e sessão JWT adicionados e conectados ao gateway; membership completo e testes ainda pendentes.
- [~] Gateway agora valida token JWT de sala no ingresso; emissão via endpoint e reconexão completa ainda pendentes.
- [~] Endpoint `POST /rooms/:id/join` emite sessão guest/JWT e cria participante com validação de acesso, papel e lotação.
- [x] Correção de consistência: token emitido no ingresso mantém mesmo `sessionId` usado no usuário participante.
- [x] Erro de inferência UUID corrigido no serviço de sessão.
- [x] API build/testes e frontend build/lint aprovados após integração JWT.
- [x] Testes unitários adicionados para autorização e sessão guest/JWT em `api/src/auth/*.spec.ts`.
- [~] Contratos shared ampliados para relatório, erros, timers e discussão; alinhamento total com gateway ainda pendente.
- [x] API e frontend build/lint, API tests (5) executados após atualização dos contratos shared.
- [x] Ingresso frontend integrado ao endpoint guest/JWT com sessão persistida por sala.
- [x] Primeiro participante via endpoint recebe papel PO automaticamente.
- [x] API build/testes e frontend build/lint aprovados após integração do ingresso frontend.
- [x] Falha de tipagem no payload JWT corrigida e build/testes de API aprovados.
- [x] API build/testes executados após criação do endpoint de ingresso guest/JWT.
- [~] Persistencia de deadline de rodada, export PDF e validacao de ambiente adicionadas; transicoes ainda nao usam todos campos.
- [x] Tasks executaveis geradas em `specs/001-collaborative-planning-poker/tasks.md`.
- [x] Validacao dos artefatos do plano: secoes obrigatorias, contratos, modelo, quickstart e referencia em `AGENTS.md`.
- [x] Validacao da lista de tasks: IDs sequenciais, fases, labels de historias, caminhos e dependencias.
- [x] Clarificacao de acesso a relatorios integrada na especificacao em `specs/001-collaborative-planning-poker/spec.md`.
- [x] API build/testes, Prisma validate, Docker Compose config e frontend build/lint executados apos integracao do timer por deadline.
- [x] Relatorio: testes unitarios de agregacao, autorizacao de sessao e CSV adicionados; API test/build/lint aprovados.
- [x] IA: adapter LLM provider-neutral com prompt limitado, resposta estruturada, timeout e mapeamento de erros; testes unitarios aprovados.
- [x] LLM configuravel validado: `LLM_BASE_URL` e `LLM_MODEL` permitem OpenRouter, OpenAI ou qualquer endpoint OpenAI-compatible; Docker Compose config, API build/lint e 12 testes aprovados.
- [x] Plano Spec Kit revalidado com arquitetura LLM provider-neutral, fases, limites e gates alinhados a `prompt.md`.
- [x] Constituicao atualizada para LLM configuravel/provider-neutral; versao 1.1.0 e plano sincronizados.
- [x] IA agora envia contexto recente de chat e limita solicitações por rodada via `LLM_MAX_REQUESTS_PER_ROUND`; testes de falha adicionados.
- [x] Gateway e frontend distinguem IA indisponivel de falha operacional e orientam continuidade manual sem voto fabricado.
- [x] API test (14), API build/lint e frontend build/lint executados apos ajuste de fallback IA.
- [x] Frontend IA: toggle de configuracao, acao de voto e status de indisponibilidade adicionados; frontend build/lint aprovados.
- [x] API: 6 arquivos de teste e 11 testes passando apos integracao do adapter IA.
- [x] API: 7 arquivos de teste e 12 testes passando apos integracao do participante IA e dispatch realtime.
- [x] Estado realtime: `RoomStateService` integrado ao gateway com snapshot Redis/memoria; 15 testes API, build/lint aprovados.
- [x] Estado realtime: Prisma validate e Docker Compose config aprovados apos integracao do snapshot service.
- [x] API: 10 arquivos de teste e 16 testes passando apos migration entrypoint e correlation logger.
- [x] Frontend container: Docker Compose config, frontend build e lint aprovados apos adicao do nginx SPA container.
- [x] Frontend relatorio: rota `/report/:id`, visualizacao de historias e download CSV autenticado; build/lint aprovados.
- [x] Relatorios: badges basicos adicionados e integrados na agregacao; 11 arquivos de teste, 17 testes API e build/lint aprovados.
- [x] Relatorios: renderer PDF e rota `/reports/:id/export.pdf` adicionados; API test/build/lint aprovados.
- [x] API: 12 arquivos de teste e 18 testes passando apos integracao de PDF e achievements.
- [x] Frontend: download autenticado de PDF e exibicao de achievements adicionados; build/lint aprovados.
- [~] Teste unitario de exportacao PDF adicionado; teste de download HTTP e compatibilidade de arquivo ainda pendentes.
- [~] Relatorio agora calcula divergencia numerica inicial/final quando ha votos; tempos detalhados e validacao E2E ainda pendentes.
- [x] Feature `002-user-auth-rooms`: `npx prisma validate`, `npx prisma generate`, `api npm run build`, testes unitarios de auth/session e `frontend npm run build` executados apos foundation de autenticacao e salas salvas.
- [x] Feature `002-user-auth-rooms`: `api npm test` completo aprovado com 13 arquivos e 24 testes; `frontend npm run lint` e `docker compose config --quiet` aprovados.
- [~] Feature `002-user-auth-rooms`: tasks T001-T018, T022-T030, T035-T042, T047-T052, T065-T069 e T071-T072 marcadas em `specs/002-user-auth-rooms/tasks.md`; testes REST/E2E de US1/US2, UI de US3 e visual/E2E de US4 ainda pendentes.

### Pendente

- [ ] Testes de integracao do ciclo completo da rodada.
- [ ] Testes de autorizacao por papel.
- [ ] Testes de reconexao e restauracao de estado.
- [ ] Testes com Redis adapter e multiplas instancias.
- [ ] Testes E2E frontend em dois navegadores.
- [~] Teste Playwright Chromium cobre criacao de sala privada e entrada por codigo+senha direto para mesa em `frontend/tests/room-entry.spec.ts`; segundo navegador ainda pendente.
- [ ] Testes de exportacao PDF/CSV.
- [~] Testes unitarios de timeout, saida invalida, chave ausente e limite de custo adicionados; testes de integracao/fallback humano pendentes.
- [x] Testes unitarios de deadline, substituicao e cancelamento do timer em `api/src/realtime/timer.service.spec.ts`.

## Ordem recomendada

1. Completar Phase 2: `room-state.service.ts`, atomicidade de timer e testes fundacionais.
2. Gateway completo com contratos shared e transicoes isoladas em `round.service.ts`.
3. Redis adapter e reconexao persistente.
4. Completar testes REST/E2E de `002-user-auth-rooms` para US1/US2 antes de marcar historia como concluida.
5. Implementar US3 de `002-user-auth-rooms`: perfil direto por sala e troca de papel aprovada pelo host.
6. Frontend completo alinhado aos eventos reais.
7. Limites de custo, fallback humano e testes de falha IA.
8. Completar relatorios (metricas/DTO/permissoes), testes de exportacao e E2E.
