# Implementation Plan: Studio de IA por Mesa

**Branch**: `004-ai-studio-room` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-ai-studio-room/spec.md`

## Summary

Hoje o Studio de IA é vinculado à conta do dono; se o PO não acessar a mesa, a mesa perde a IA. Esta feature cria um **Studio de IA com escopo de mesa** (persona, regras e provedor LLM gravados na própria sala), com precedência de resolução **mesa → conta → ambiente**, e edição restrita ao dono da sala. A IA da mesa passa a funcionar independentemente da conta do PO.

A abordagem paralela a estrutura existente do Studio por conta (`LlmProvider`/`AiAgent`/`BusinessRule` chaveados por `userId`): três tabelas novas chaveadas por `roomId`, um controller REST `/room/:id/ai-studio` com autorização de dono, e a função `resolveRoomAiContext` em `ai-participant.service.ts` expandida para a precedência granular. Guardrails permanecem inalterados e incondicionais.

## Technical Context

**Language/Version**: TypeScript 5.x; Node 22 (API NestJS 11; frontend React 18 + Vite)
**Primary Dependencies**: NestJS, Socket.IO, Prisma (PostgreSQL), bcrypt; `@planning-poker/shared-types` (file: monorepo)
**Storage**: PostgreSQL; Prisma migrations versionadas (não `db push`)
**Testing**: Vitest (API unit), manual multi-client p/ realtime, Docker validation
**Target Platform**: Web (frontend) + REST API + Socket.IO gateway
**Project Type**: Monorepo web application (api + frontend + shared-types)
**Performance Goals**: Zero latência adicional em chamadas de IA (apenas leitura de config a mais, já cacheada por chamada)
**Constraints**: server-authoritative; secrets nunca em claro; dono único editor; precedência mesa > conta > ambiente; guardrails sempre ativos
**Scale/Scope**: ~10k users; 1 feature (studio por mesa); 5–8 arquivos novas de backend/frontend

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Constituição | Status |
|---|---|
| Shared types e contratos precedem gateway e frontend | ✅ **PASS** — contratos REST documentados em `contracts/`; nenhuma mudança no `ClientToServerEvents`/`ServerToClientEvents` |
| Server-authoritative timers/votes/revelation/permissions preservadas | ✅ **PASS** — autorização de dono validada no servidor (REST), config fora do `room:state` |
| Persistência, recovery, migrations, Redis explicitados | ✅ **PASS** — 3 tabelas novas via migration versionada; Redis intocado |
| Autorização por papel, validação de payload, secrets, acesso privado cobertos | ✅ **PASS** — somente dono lê/escreve; token mascarado; API-key só em tabela própria, nunca no snapshot |
| Plano de verificação cobre camadas, multi-client realtime e Docker | ✅ **PASS** — unit API + manual multi-client + Docker (quickstart.md) |
| `TASKS.md` impacto e rastreabilidade identificados | ✅ **PASS** — impacto listado abaixo; `tasks.md` gerado por `/speckit-tasks` |

**GATE: PASS** — sem violações justificáveis; Complexity Tracking fica vazio.

## Project Structure

### Documentation (this feature)

```text
specs/004-ai-studio-room/
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/           # room-ai-studio.http + contract.md
├── checklists/requirements.md
└── tasks.md             # (fase 2, /speckit-tasks)
```

### Source Code (repository root)

```text
packages/shared-types/src/index.ts        # (inalterado — sem mudanças de types realtime)
api/prisma/schema.prisma                  # +RoomLlmProvider, RoomAiAgent, RoomBusinessRule
api/prisma/migrations/20260908XXXXXX_room_ai_studio/migration.sql
api/src/ai/room-ai-studio.dto.ts          # NOVO — DTOs de provider/agent/rules por-sala
api/src/ai/room-studio.service.ts         # NOVO — CRUD por-sala (espelha studio.service)
api/src/ai/room-studio.controller.ts      # NOVO — REST /rooms/:id/ai-studio (dono-only)
api/src/ai/room-studio.controller.spec.ts # NOVO
api/src/ai/room-studio.service.spec.ts    # NOVO
api/src/ai/ai-participant.service.ts      # resolveRoomAiContext: precedência mesa > conta > env
api/src/ai/ai-participant.service.spec.ts # + testes de precedência
api/src/app.module.ts                     # registro do RoomStudioController + service
frontend/src/lib/room-studio.ts           # NOVO — client REST do studio por-sala
frontend/src/features/room/RoomConfiguration.tsx  # painel "Studio de IA da sala" (PO-only)
frontend/src/index.css                    # (classes .studio-* já existem; ajustes menores)
```

**Structure Decision**: monorepo existente com três projetos (`api`, `frontend`, `shared-types`). A feature inserida no padrão já consolidado: backend NestJS em `api/src/ai/` (serviço + controller + dto + spec), frontend em `features/room` + lib em `frontend/src/lib/`, migrations em `api/prisma/migrations/`. Nenhum shared-type novo necessário.

## Complexity Tracking

> Vazio — sem violações da Constituição.