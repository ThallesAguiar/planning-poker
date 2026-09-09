# Technical Context & Research: Studio de IA por Mesa

**Branch**: `004-ai-studio-room` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (API NestJS 11, frontend React 18 + Vite, shared-types package)
**Primary Dependencies**: NestJS, Socket.IO, Prisma (PostgreSQL), Zod/type system manual (shared-types), bcrypt
**Storage**: PostgreSQL (schema `planning_poker`, Prisma migrations versionado)
**Testing**: Vitest (unit), manual multi-client para realtime, Docker validation
**Target Platform**: Web (browser) + API REST/Socket.IO
**Project Type**: Monorepo web application (frontend + api + shared-types)
**Performance Goals**: Latência adicionada por chamada IA = 0 (mesmas chamadas; apenas leitura de config extra, chamada ocasional ao LLM)
**Constraints**: Server-authoritative; secrets nunca em claro; dono da sala único dono da config da mesa; precedência mesa > conta > ambiente
**Scale/Scope**: ~10k users; 1 feature nova (studio por mesa)

## Research

### R1. Onde vive hoje a resolução de contexto de IA (integrado)

O ponto de integração natural é `api/src/ai/ai-participant.service.ts` → `resolveRoomAiContext(roomId)` (linhas 21-44). Hoje ela:
1. Busca room → `ownerId` (id de `RoomParticipant`, não de User)
2. Busca owner com `user` incluído
3. Se guest/sem conta → `DEFAULT_AGENT` + `run: {}`
4. Busca `llmProvider`/`aiAgent`/`businessRule` do owner via `owner.user.id`
5. Retorna `{ agent, run }` onde `run.options` usa provider da conta

Todos os call-sites (`castVote`, `pullDiscussion`, `summarize`, `ensureParticipant`) chamam `resolveRoomAiContext`. **Basta modificar esta função para a precedência mesa > conta > ambiente.**

Adicionalmente, `StudioService` (`saveProvider`, `saveAgent`, `saveRules`) e `StudioController` (rotas `ai-studio/*`) dão o template completo do CRUD por-usuário a paralelizar por-sala.

### R2. Modelo de dados: paralelo por `roomId`

O padrão existente (por `userId`) paraleliza de forma idêntica por `roomId`:

| Escopo conta (existe) | Escopo mesa (novo) |
|---|---|
| `LlmProvider.userId` | `RoomLlmProvider.roomId` |
| `AiAgent.userId @unique` | `RoomAiAgent.roomId @unique` |
| `BusinessRule.userId` + `order` | `RoomBusinessRule.roomId` + `order` |

Decisão: **três tabelas novas** (`RoomLlmProvider`, `RoomAiAgent`, `RoomBusinessRule`), cada uma com chave estrangeira `roomId` → `Room.id` `onDelete: Cascade`. Reaproveita a forma das tabelas de conta (mesmos campos, validações e fluxo de token mascarado) sem acoplar o model `Room` a um único provedor.

Alternativa rejeitada: 1 registro JSON no `RoomConfig` (`aiStudio: { provider, agent, rules }`) — mais simples de migrar porém:
- Mistura dados de secret (apiKey) com config de sala que já trafega no `room:state` para todos os participantes → vazamento de token.
- Sem FK/tipo próprio, perde validação e cascade semântico.
- Pior para auditoria e testes (uma coluna enorme de JSON no snapshot).

**Decisão por-camada**: provedor guardado em tabela própria (nunca no `room:state`), persona/regras também em tabelas próprias. O `room:state` NÃO ganha os campos de studio.

### R3. Guardrails preservados

Nenhuma mudança de guardrail. O `LlmClient` sanitiza/valida todo texto livre (`context`, `story`, `votes[].participantName`) com o nível padrão `'moderate'`, e o sistema sempre se autoprotege (sem opção "none"). A config da mesa entra pela mesma porta: `resolveRoomAiContext` devolve o mesmo `{ agent, run }`, e os guardrails internos do `LlmClient` continuam cobrindo a mesa (persona/regras/provedor são inputs confiáveis do dono; o `context` de chat continua sendo o vetor de injection, já tratado). Nenhuma alteração em `guardrails.ts`/`llm.client.ts`.

### R4. Autorização: dono da sala

Padrão consolidado no código: `room.ownerId === participant.id` (id do `RoomParticipant`) para ações do PO (`room.service.ts:152`, `:205`, `:249`; gateway `authorized(client, 'PO')`). Para o studio por mesa manteremos a mesma checagem: `RoomAiStudioController` (REST, bearer de conta) resolve a account → participante na sala → compara com `room.ownerId`. Só o dono lê/escreve. Participante comum: 403 `FORBIDDEN`, sem campo de token.

Decisão sobre UI: painel separado "Studio de IA da sala" dentro de `RoomConfiguration.tsx` (modal de configuração), oculto para não-PO (o componente já retorna `null` para `!isPO`). Reusa as classes `.studio-*` já existentes no `index.css`.

### R5. Interface HTTP do studio por mesa

Padrão REST mirror do `/ai-studio` (por conta), agora sob `/rooms/:id/ai-studio` com validação de dono:

- `GET /rooms/:id/ai-studio` → snapshot `{ provider, agent, rules }` (token mascarado via `maskApiKey`)
- `PUT /rooms/:id/ai-studio/provider` → upsert do provedor da mesa
- `POST /rooms/:id/ai-studio/provider/test` → teste de conexão
- `PUT /rooms/:id/ai-studio/agent` → upsert da persona da mesa
- `PUT /rooms/:id/ai-studio/rules` → substituir regras da mesa

Estes endpoints são REST (ainda não há gateway necessário para a mesa — a config não entra no `room:state`; a IA lê direto do DB a cada chamada). Consumido pelo frontend `RoomConfiguration.tsx` via nova lib `frontend/src/lib/room-studio.ts`.

### R6. Precedência na resolução (mesa > conta > ambiente)

`resolveRoomAiContext` vira:

1. Buscar config de mesa (`RoomAiAgent`, `RoomLlmProvider`, `RoomBusinessRule` por `roomId`).
2. Se a mesa tem **qualquer** config própria (agente OU rules OU provider):
   - persona: `RoomAiAgent` se existir, senão fallback, senão `DEFAULT_AGENT`
   - rules: as da mesa se houver alguma; caso contrário... *decisão*: se o dono configurou persona mas não rules, herda rules da conta? **Não** — manutenção de precedência simples: a mesa que tem studio próprio é tratada como unidade; campos ausentes caem para default/env. Mas se a mesa não tem NENHUM registro (nenhum field), cai para a conta do dono (comportamento atual).
   - provider: `RoomLlmProvider` se existir; senão, para não regredir usuários atuais (só configuraram conta), usa provider da conta. *Precedência granular por campo*: pessoa pode ter persona de mesa + provider da conta.
3. Se a mesa não tem studio: comportamento atual idêntico (conta do dono → env → `DEFAULT_AGENT`).
4. Sem conta real/guest: se a mesa tem studio próprio, usa; senão `DEFAULT_AGENT` + `run: {}`.

**Decisão de precedência granular (campo a campo, por campos presentes)**, mais robusta que "all-or-nothing": cada recurso (provider / agent / rules) resolve independentemente mesa → conta → default. Isso evita fazer um usuário com só persona de mesa perder o provider da conta, e vice-versa. Documentado no Assumptions do spec e aqui como Rationale.

### R7. Realtime e integração com snapshot

Nenhuma mudança de contrato Socket.IO. O `room:state` não expõe credencial nem config de IA da mesa. Nada no `RoomState`/`RoomConfig`/`RoomVisibility` muda. A nova config é persistida e lida on-demand (a cada chamada da IA). Config de mesa editada numa sessão vale para a próxima chamada — sem re-broadcast necessário.

### R8. Testes e verificação

- Unit (Vitest): `RoomAiStudio` — `resolveRoomAiContext` com mesas sem/com studio, precedência granular; `RoomAiStudioService` get/save provider/agent/rules espelhando `StudioService.spec`; autorização (não-dono → 403).
- Build TS limpo (`npm run build`), Docker `docker compose up -d --build api frontend`.
- Verificação manual (quickstart.md): configurar mesa sem studio + fazer IA votar (usa conta/env); configurar studio de mesa + confirmar que IA usa mesa; tentar editar como participante comum → 403.

## DECISÕES CONSAGRADAS (consolidado)

| Item | Decisão |
|---|---|
| Tabelas novas | `RoomLlmProvider`, `RoomAiAgent`, `RoomBusinessRule` (FK `roomId`, `onDelete: Cascade`) |
| Precedência | granular por recurso: mesa → conta → env/default |
| Provider de mesa | opcional; agente/rules podem existir sem ele |
| Autorização | somente dono (REST com bearer de conta + checagem `room.ownerId === participant.id`); participante comum → `FORBIDDEN` |
| UI | painel "Studio de IA da sala" no modal de configuração (`RoomConfiguration.tsx`), visível só para PO; reusa `.studio-*` |
| Guardrails | inalterados — config de mesa entra como input confiável; `context` continua protegido |
| Contrato realtime | sem mudança; config nunca vai no `room:state` |
| Token | mascarado, campo vazio mantém atual (reuso do padrão conta) |
| Migração | 3 tabelas novas via `migrate diff` + migration.sql + `migrate deploy` |