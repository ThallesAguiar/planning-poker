# Contratos de Interface: Studio de IA por Mesa

**Branch**: `004-ai-studio-room` | **Date**: 2026-09-08

## Escopo

A feature expõe uma **API REST** nova para configurar o studio de IA da mesa. Não há mudança nos contratos Socket.IO (`shared-types/src/index.ts` inalterado): o `RoomConfig`, `RoomState`, `ClientToServerEvents` e `ServerToClientEvents` permanecem como estão. A config de IA da mesa nunca vai para o `room:state`.

## REST — `/rooms/:id/ai-studio`

Mesmo formato do `/ai-studio` por conta, mas **acesso somente ao dono da mesa** (autorização por bearer de conta + checagem `room.ownerId === participant.id` no servidor). Participante comum → `403 { code: 'FORBIDDEN' }`.

### Aliases de tipos

- `RoomStudioSnapshot` = `{ provider: Provider | null; agent: Agent | null; rules: string[] }`
- `Provider` = `{ name; baseUrl; model; isActive; hasApiKey; apiKeyMasked }` — token sempre mascarado (padrão `maskApiKey` do `StudioService`)
- `Agent` = `{ name; avatar; systemPrompt }`

### Endpoints

#### `GET /rooms/:id/ai-studio` → `RoomStudioSnapshot`

Retorna o snapshot completo da mesa (token mascarado). Se nada configurado, `{ provider: null, agent: null, rules: [] }`.

#### `PUT /rooms/:id/ai-studio/provider`

Body `{ name?; baseUrl?; apiKey?; model?; isActive? }` — request todos exceto `apiKey`/`isActive` (opcionais). `apiKey` vazio = mantém o atual; `baseUrl` normalizada (protocolo + sem `/` final). Erro sem chave para manter: `400 INVALID_INPUT`. Retorna `Provider`.

#### `POST /rooms/:id/ai-studio/provider/test`

Body `{ baseUrl?; apiKey?; model? }` (opcionais, usa o salvo como fallback). Retorna `{ ok: true; latencyMs: number }` ou `503 AI_PROVIDER_ERROR`.

#### `PUT /rooms/:id/ai-studio/agent`

Body `{ name; avatar?; systemPrompt? }`. Upsert da persona da mesa. Retorna `Agent`.

#### `PUT /rooms/:id/ai-studio/rules`

Body `{ contents: string[] }` (≤50, cada ≤2000). Substitui as regras da mesa; lista vazia limpa. Retorna `string[]` limpo.

## Erros

- `401 UNAUTHENTICATED` — sem bearer de conta válido
- `403 FORBIDDEN` — autenticado mas não é dono da mesa
- `400 INVALID_INPUT` — payload inválido; `400 INVALID_PHASE` se config de mesa tentada fora do lobby é **inexistente** (a config de IA da mesa é editável em qualquer fase — independe do início da rodada, diferente de `room:configure`)

## Frontend

Client em `frontend/src/lib/room-studio.ts`, espelhando `studio.ts`:
`getRoomStudio(token, roomId)`, `saveRoomStudioProvider`, `testRoomStudioProvider`, `saveRoomStudioAgent`, `saveRoomStudioRules`. Token e `roomId` vem da store da mesa. Usado no painel "Studio de IA da sala" de `RoomConfiguration.tsx`.

## Exemplo

```http
GET /rooms/abc/ai-studio
Authorization: Bearer <account-token>

→ 200 { "provider": { "name": "OpenRouter", "baseUrl": "https://openrouter.ai/api/v1",
      "model": "openai/gpt-4o-mini", "isActive": true, "hasApiKey": true, "apiKeyMasked": "sk-…1234" },
    "agent": { "name": "Robô da Mesa", "avatar": "🃏", "systemPrompt": "Você é um contribuidor sênior desta mesa..." },
    "rules": ["Moeda: BRL", "Não estimar acima de 13 sem dividir"] }
```