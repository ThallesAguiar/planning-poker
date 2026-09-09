---

description: "Task list for Studio de IA por Mesa (004-ai-studio-room)"
---

# Tasks: Studio de IA por Mesa

**Input**: Design documents from `/specs/004-ai-studio-room/`

**Prerequisites**: plan.md, spec.md (US1 P1, US2 P2, US3 P3), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluídos — exigidos pela Constituição (Princípio V: verificação por camada e gates de qualidade) mesmo quando não pedidos na spec.

**Organization**: Tarefas agrupadas por user story da spec.md, implementável e testável independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3 conforme spec.md
- Caminhos de arquivo exatos

## Path Conventions

- `api/src/...`, `frontend/src/...`, `api/prisma/...`, `packages/shared-types/src/...`

---

## Phase 1: Setup (Infraestrutura compartilhada)

**Propósito**: modelos de dados + migration — base que todas as stories dependem.

- [x] T001 Adicionar modelos `RoomAiAgent`, `RoomLlmProvider`, `RoomBusinessRule` + back-relations em `api/prisma/schema.prisma` (espelhando conta: `AiAgent`, `LlmProvider`, `BusinessRule`; FK `roomId` → `Room.id`, `onDelete: Cascade`; índices de `data-model.md`)

- [x] T002 [P] Gerar e aplicar migration `api/prisma/migrations/20260908_room_ai_studio/migration.sql` via `./node_modules/.bin/prisma migrate diff --from-migrations --to-schema-datamodel --shadow-database-url --script` (host-side com `DATABASE_URL` inline de `api/.env`) + `migrate deploy`; conferir tabelas `RoomAiAgent`/`RoomLlmProvider`/`RoomBusinessRule` no Postgres

---

## Phase 2: Foundational (Prerequisitos bloqueantes)

**⚠️ CRITICAL**: nenhuma user story começa sem esta fase.

- [x] T003 Criar DTOs `api/src/ai/room-ai-studio.dto.ts`: `SaveRoomProviderDto`, `TestRoomProviderDto`, `SaveRoomAgentDto`, `SaveRoomRulesDto` (espelham `ai-studio.dto.ts` com as mesmas validações de `data-model.md`)

- [x] T004 [P] Exportar `maskApiKey` e `normalizeBaseUrl` de `api/src/ai/studio.service.ts` (mover p/ módulo próprio `api/src/ai/studio-utils.ts` se necessário) para reuso no `RoomStudioService`

- [x] T005 Criar `RoomStudioService` em `api/src/ai/room-studio.service.ts`: `getForRoom(roomId)`, `saveProvider(roomId, input)`, `testProvider(roomId, input)`, `saveAgent(roomId, input)`, `saveRules(roomId, contents)` — espelhando `StudioService` (token mascarado, "campo vazio mantém atual", rules transacional)

- [x] T006 Registrar `RoomStudioService` como provider em `api/src/app.module.ts`

**Checkpoint**: foundation pronta — stories podem começar.

---

## Phase 3: User Story 1 - Configurar a IA direto na mesa (Priority: P1) 🎯 MVP

**Goal**: O dono com conta configura persona/regras/provedor no Studio da mesa; a IA da mesa usa essa config mesmo sem Studio de conta.

**Independent Test**: Criar mesa → configurar Studio da mesa (provedor, persona) → habilitar IA → votar: IA usa persona/provedor da mesa, com conta do dono sem Studio.

### Tests for User Story 1 (unit — Constituição V) ⚠️

> NOTE: escrever primeiro, garantir FALHA antes da implementação.

- [x] T007 [US1] Unit tests `api/src/ai/room-studio.service.spec.ts`: `getForRoom` mascara chave/flat rules; `saveProvider` mantém chave atual quando apiKey omitido e rejeita sem chave para manter; `saveAgent` cria persona; `saveRules` substitui via transação (espelho de `studio.service.spec.ts`)

### Implementation for User Story 1

- [x] T008 [P] [US1] Criar `RoomStudioController` em `api/src/ai/room-studio.controller.ts`: `GET /rooms/:id/ai-studio`, `PUT provider`, `POST provider/test`, `PUT agent`, `PUT rules` — auth bearer de conta (reusa `SessionService.verifyAccount`); gate de dono fica completo em US3 (nesta tarefa: exige conta)

- [x] T009 [US1] Registrar `RoomStudioController` nos controllers de `api/src/app.module.ts`

- [x] T010 [P] [US1] Criar client `frontend/src/lib/room-studio.ts`: `getRoomStudio`, `saveRoomStudioProvider`, `testRoomStudioProvider`, `saveRoomStudioAgent`, `saveRoomStudioRules` (espelho de `frontend/src/lib/studio.ts`, adiciona `roomId` e token de conta)

- [x] T011 [US1] Painel "Studio de IA da sala" em `frontend/src/features/room/RoomConfiguration.tsx` (seção três sub-panels reusando classes `.studio-*`; carrega/persiste via `room-studio.ts`; usa `account`/`accountToken` do `useAppStore`)

**Checkpoint**: mesa com só o studio de mesa configurado roda IA (SC-001).

---

## Phase 4: User Story 2 - Precedência mesa > conta > padrão (Priority: P2)

**Goal**: resolução granular por recurso (mesa → conta → env/default), sem regressão do fluxo atual.

**Independent Test**: Mesa sem studio → IA usa conta do dono; mesa com persona → usa persona da mesa; mesa sem regras → herda regras da conta; guest/owner inválido → env/default (cenários C2/C3 do quickstart).

### Tests for User Story 2 ⚠️

- [x] T012 [US2] Unit tests de precedência em `api/src/ai/ai-participant.service.spec.ts`: mesa sem registros usa conta; mesa com `RoomAiAgent` usa persona da mesa; mesa sem `RoomBusinessRule` herda regras da conta; mesa com regras usa as da mesa; guest/owner removido → `DEFAULT_AGENT` + `run: {}`; provider mesa → conta → env

### Implementation for User Story 2

- [x] T013 [US2] Alterar `resolveRoomAiContext` em `api/src/ai/ai-participant.service.ts` para precedência granular por recurso (mesa → conta → default), preservando retorno `{ agent, run }` — comportamento atual intacto quando a mesa não tem studio

**Checkpoint**: precedência determinística e testada (SC-002/SC-005).

---

## Phase 5: User Story 3 - Só o dono com conta edita (Priority: P3)

**Goal**: leitura/escrita do Studio da mesa restritas ao dono autenticado em conta; participante comum e dono guest → rejeição no servidor.

**Independent Test**: REST `PUT /rooms/:id/ai-studio/agent` com token de não-dono → `403 FORBIDDEN`, nada persistido; com dono → 200; UI oculta/desabilita painel fora do dono (C5 do quickstart).

### Tests for User Story 3 ⚠️

- [x] T014 [US3] Unit tests de autorização `api/src/ai/room-studio.controller.spec.ts`: sem bearer → `401`; participante comum → `403`; dono guest → `403`; dono com conta → 200 (mock de session + prisma)

### Implementation for User Story 3

- [x] T015 [P] [US3] Gate de dono no `RoomStudioController`: resolver `participant` do usuário na sala e comparar com `room.ownerId` (padrão `room.service.ts`); `403 FORBIDDEN` para não-dono/guest

- [x] T016 [US3] Frontend `RoomConfiguration.tsx`: painel visível só p/ PO com conta; PO guest vê aviso "crie/cadastre-se em conta para configurar a IA da sala"; não-PO não vê nada

**Checkpoint**: 100% das edições por não-dono rejeitada (SC-004).

---

## Phase N: Polish & Cross-Cutting Concerns

**Propósito**: melhorias transversais e fecho.

- [x] T017 [P] Regressão de guardrails: rodar `api/src/ai/guardrails.spec.ts` + `api/src/ai/llm.client.spec.ts` (sem mudança esperada — config da mesa entra como input confiável, `context` ainda protegido)

- [x] T018 Rodar suíte completa: `cd api && npx vitest run` + `cd api && npm run build` — tudo verde

- [x] T019 [P] Docker + validação fim a fim: `docker compose up -d --build api frontend` e executar `quickstart.md` C1–C6 (C3 inclui desvincular conta sem derrubar IA da mesa)

- [x] T020 Atualizar `TASKS.md` raiz com impacto por camada (dados, API, frontend) e ponto de rastreabilidade

- [x] T021 [P] Revisão final de segurança: token nunca em claro/mascarado, `apiKey` fora do `room:state`, cascade de deleção confirmado, sem segundo mecanismo de auth

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — schema + migration primeiro
- **Foundational (Phase 2)**: depende de T001/T002; BLOQUEIA todas as stories
- **US1 (P1)**: depende de Foundational; sem deps de outras stories
- **US2 (P2)**: depende de Foundational (T013 toca `resolveRoomAiContext`, usado pela US1 — pode rodar em paralelo pois arquivo separado)
- **US3 (P3)**: depende de US1 (gate de dono é esmagador no controller criado na T008) — o gate inicial exige conta (T008), o gate completo de dono é a T015
- **Polish**: depende das stories desejadas concluídas

### User Story Dependencies

- **US1 (P1)**: começa após Foundational — MVP
- **US2 (P2)**: começa após Foundational — independência de arquivo com US1
- **US3 (P3)**: usa o controller da US1 — executa após US1

### Within Each User Story

- Testes (T007, T012, T014) escritos e falhando ANTES da implementação
- DTOs/serviço → controller → frontend; núcleo antes da integração

### Parallel Opportunities

- T002 ∥ T003/T004 (Fases 1–2, arquivos distintos)
- T008 ∥ T010 (controller e lib frontend, arquivos independentes) dentro da US1
- Fases 1–2 restritas a `api/`; frontend (T010/T011) não depende de T008
- T017/T019/T021 [P] em paralelo na Polish

---

## Parallel Example: User Story 1

```bash
# DTOs + service (US1 usa da Foundational, independente do controller):
Task: "Criar DTOs room-ai-studio.dto.ts  ... (T003)"
Task: "Exportar maskApiKey/normalizeBaseUrl ... (T004)"

# Controller (T008) e client frontend (T010) juntos:
Task: "Criar RoomStudioController em api/src/ai/room-studio.controller.ts"
Task: "Criar client frontend/src/lib/room-studio.ts"

# Unit tests (T007) antes do service (T005 já da Foundational):
Task: "room-studio.service.spec.ts (T007)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (T001, T002) — schema + migration
2. Phase 2 (T003–T006) — DTOs, utils, RoomStudioService, module
3. Phase 3 (T007–T011) — testes, controller, client, painel
4. **STOP e VALIDAR** US1 isolada (C3 do quickstart)
5. Deploy/demo se pronto

### Incremental Delivery

1. Setup + Foundational → foundation pronta
2. US1 → testar → demo (MVP: mesa com studio próprio roda IA)
3. US2 → precedência granular (não-regressão de conta)
4. US3 → gate do dono + aviso para guest
5. Polish → guardrails, build, Docker, TASKS.md

### Parallel Team Strategy

- Dev A: US1 (controller + painel + tests)
- Dev B: US2 (precedência + tests)
- Dev C: US3 (gate dono + tests), entra após US1

---

## Notes

- [P] tasks = arquivos distintos, sem dependências pendentes
- [Story] label mapeia task → user story p/ rastreabilidade
- Verificar testes falham antes de implementar
- Commit após cada task ou grupo lógico
- Aplicar gates da Constituição: contratos antes de consumers; server-authoritative; persistência; autorização por papel; verificação por camada
- Guardrails ficam incondicionais — nenhuma task pode reintroduzir nível 'none'