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

### Pendente

- [ ] Containerizar frontend para ambiente de desenvolvimento, se necessario.
- [ ] Adicionar `ANTHROPIC_API_KEY` ao compose e ao fluxo da API.
- [ ] Trocar `prisma db push` por migrations versionadas em producao.
- [ ] Configurar segredos reais fora de valores default de desenvolvimento.

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
- [ ] Persistir estado atual da rodada e seus timers.
- [x] Gerar migration Prisma versionada `0001_realtime_baseline`.
- [ ] Criar seed com 4 participantes e 1 IA.
- [ ] Implementar consultas de historico e relatorios anteriores.

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
- [ ] Autenticacao leve com JWT.
- [~] Guardas e autorizacao por papel, principalmente PO.
- [ ] Endpoint para login, reconexao e sessao de convidado.
- [ ] Endpoint para listar relatorios e sessoes passadas.
- [ ] Exportacao de relatorio em CSV e PDF.

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
- [x] Persistir e restaurar participantes, historias, votos e chat via PostgreSQL.
- [x] Integrar Redis adapter para multiplas instancias.
- [~] Implementar `room:participantUpdate` dedicado; snapshot ja atualiza participantes.
- [x] Implementar `room:configure`.
- [x] Implementar `story:present`.
- [x] Implementar timers de reflexao e discussao no servidor.
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

### Pendente

- [x] Home completa para criar ou entrar em sala.
- [x] Home separada por rota com criacao de sala publica ou privada.
- [ ] Tela de configuracao da sala para PO.
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

## 7. Participante IA

### Feito

- [ ] Nenhuma integracao IA implementada.

### Pendente

- [ ] Criar modulo/servico isolado para Anthropic.
- [ ] Configurar chave, modelo, timeout e limites via ambiente.
- [ ] Criar participante IA por sala.
- [ ] Montar prompt com historia, papel e chat da rodada.
- [ ] Validar voto contra deck permitido.
- [ ] Emitir voto e justificativa como participante normal.
- [ ] Tratar timeout, erro, custo e indisponibilidade do provedor.
- [ ] Adicionar toggle na configuracao da sala.

## 8. Relatorio da sprint

### Feito

- [x] Modelo `SprintReport` criado.
- [x] Endpoint basico de geracao de relatorio.
- [x] Registro basico de relatorio testado via REST.

### Pendente

- [ ] Compilar historias, valor final, criterio e rodadas.
- [ ] Calcular tempo de reflexao e discussao por historia.
- [ ] Registrar divergencia inicial e final.
- [ ] Associar chat e justificativas por historia.
- [ ] Consolidar participacao e comentarios.
- [ ] Calcular badges/achievements.
- [ ] Gerar pagina web permanente.
- [ ] Exportar PDF e CSV.
- [ ] Emitir `report:ready` para todos na sala.

## 9. Qualidade e verificacao

### Feito

- [x] Frontend: `npm run build`.
- [x] Frontend: `npm run lint`.
- [x] API: `npx prisma validate`.
- [x] API: `npm run build`.
- [x] API: `npm test`.
- [x] Docker: `docker compose config --quiet`.
- [x] Docker: healthcheck da API.
- [x] Smoke test REST.
- [x] Smoke test Socket.IO com dois clientes.
- [x] Smoke test completo: dois clientes, chat, apresentacao, votos, revelacao e discussao.
- [x] Smoke test de sala privada: hash oculto, senha invalida rejeitada e senha correta aceita.

### Pendente

- [ ] Testes de integracao do ciclo completo da rodada.
- [ ] Testes de autorizacao por papel.
- [ ] Testes de reconexao e restauracao de estado.
- [ ] Testes com Redis adapter e multiplas instancias.
- [ ] Testes E2E frontend em dois navegadores.
- [ ] Testes de exportacao PDF/CSV.
- [ ] Testes de timeout e falha da IA.

## Ordem recomendada

1. Persistencia e modelo de rodada.
2. Gateway completo com autorizacao e timers no servidor.
3. Redis adapter e reconexao persistente.
4. Fluxos REST de autenticacao, convite e historico.
5. Frontend completo alinhado aos eventos reais.
6. Integracao IA.
7. Relatorios, exportacoes e testes E2E.
