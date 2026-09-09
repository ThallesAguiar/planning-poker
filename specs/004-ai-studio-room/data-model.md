# Data Model: Studio de IA por Mesa

**Branch**: `004-ai-studio-room` | **Date**: 2026-09-08

Entidades novas no Prisma (schema `api/prisma/schema.prisma`), espelhando as de escopo conta (`LlmProvider`, `AiAgent`, `BusinessRule`) porém chaveadas por `roomId`. Sempre `onDelete: Cascade` — removidas junto com a sala.

## RoomAiAgent

Persona do agente da mesa (uma por sala, `roomId @unique`).

```prisma
model RoomAiAgent {
  id           String   @id @default(cuid())
  roomId       String   @unique
  name         String   @default("Agente IA")
  avatar       String   @default("🤖")
  systemPrompt String   @default("You are an expert planning-poker contributor analyzing user stories, voting realistically against the deck, and explaining estimates.")
  updatedAt    DateTime @updatedAt
  room         Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
}
```

Validação (DTO): `name` 1..60, `avatar` ≤10, `systemPrompt` ≤4000.

## RoomLlmProvider

Credenciais do provedor LLM da mesa (no máx. 1 ativa por sala; upsert). **Nunca exposto em claro** — somente mascarado, e fora do `room:state`.

```prisma
model RoomLlmProvider {
  id        String   @id @default(cuid())
  roomId    String
  name      String
  baseUrl   String
  apiKey    String
  model     String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@index([roomId])
}
```

Validação (DTO): `name` 1..80, `baseUrl` 1..500 (normalizada com protocolo), `apiKey` ≤500 (opcional no update = mantém atual), `model` 1..200, `isActive` opcional.

## RoomBusinessRule

Regras de negócio da mesa (N por sala, ordenadas).

```prisma
model RoomBusinessRule {
  id      String @id @default(cuid())
  roomId  String
  content String
  order   Int    @default(0)
  createdAt DateTime @default(now())
  room    Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@index([roomId, order])
}
```

Validação (DTO): array até 50 itens, cada `content` ≤2000, vazios filtrados; lista vazia limpa.

## Relações

```
Room 1 ──── 0..1 RoomAiAgent
Room 1 ──── 0..1 RoomLlmProvider
Room 1 ──── 0..N RoomBusinessRule
```

- `Room` ganha os campos de relação (back-relations) `roomAiAgent`, `roomLlmProviders`, `roomBusinessRules` no model.
- Nenhuma mudança em `User`/`RoomConfig`/`RoomParticipant`.

## Migration SQL (gerada por `migrate diff`, aplicada com `migrate deploy`)

```sql
CREATE TABLE "RoomAiAgent" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Agente IA',
    "avatar" TEXT NOT NULL DEFAULT '🤖',
    "systemPrompt" TEXT NOT NULL DEFAULT 'You are an expert planning-poker contributor analyzing user stories, voting realistically against the deck, and explaining estimates.',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoomAiAgent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoomAiAgent_roomId_key" ON "RoomAiAgent"("roomId");
CREATE TABLE "RoomLlmProvider" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoomLlmProvider_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RoomLlmProvider_roomId_idx" ON "RoomLlmProvider"("roomId");
CREATE TABLE "RoomBusinessRule" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomBusinessRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RoomBusinessRule_roomId_order_idx" ON "RoomBusinessRule"("roomId", "order");
ALTER TABLE "RoomAiAgent" ADD CONSTRAINT "RoomAiAgent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomLlmProvider" ADD CONSTRAINT "RoomLlmProvider_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomBusinessRule" ADD CONSTRAINT "RoomBusinessRule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## Precedência de resolução (campo a campo)

Aplicada em `RoomAiAgent`, `RoomLlmProvider`, `RoomBusinessRule` separadamente, por "campos presentes":

| Recurso | Mesa | Conta | Default |
|---|---|---|---|
| Persona (`name`/`avatar`/`systemPrompt`) | `RoomAiAgent`.eq? usa : próxima | `AiAgent` | `DEFAULT_AGENT` |
| Provider (`options`) | `RoomLlmProvider`? usa : próxima | `LlmProvider` | `undefined` (usa env `LLM_*`) |
| Rules | se mesa tem ≥1 regra, usa mesa : **não herda conta** | 〰️(só usadas se mesa não tem nenhuma) | `[]` |
| Sem studio de mesa (nenhum registro nas 3) | — | fluxo atual (conta → env) | comportamento atual |

Decisões-chave documentadas em `research.md` (R2, R6). Se a mesa tem proteção própria, as rules da conta **não** vazam para dentro dela (a mesa é uma unidade); se a mesa não tem nenhum registro, tudo cai para a conta (não-regressão).