# Planning Poker

Aplicação de Planning Poker colaborativo em tempo real.

## Stack

- Frontend: React, Vite, TypeScript, TailwindCSS, Zustand, Framer Motion e Socket.IO client.
- API: NestJS, Socket.IO e Prisma.
- Infraestrutura: PostgreSQL, Redis e Docker Compose.

## Requisitos

- Docker Desktop
- Node.js 22+

## Configurar ambiente

Para clone novo:

```powershell
Copy-Item .env.example .env
Copy-Item api/.env.example api/.env
Copy-Item frontend/.env.example frontend/.env
```

Uso recomendado:

- `.env` na raiz: variaveis usadas pelo `docker compose` (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `PORT`, LLM e `VITE_API_URL`). Hosts apontam para a rede interna do Docker (`postgres:5432`, `redis:6379`).
- `api/.env`: rodar a API fora do Docker. Hosts apontam para as portas expostas dos containers no host (`localhost:5432`, `redis://localhost:6380`).
- `frontend/.env`: rodar frontend fora do Docker (`VITE_API_URL`).

Os dois exemplos da API existem de proposito: compartilham as mesmas variaveis (`JWT_SECRET`, `PORT`, `LLM_*`), mas diferem no endereco de `DATABASE_URL` e `REDIS_URL` conforme o cenario. Mantenha os dois sincronizados ao adicionar variaveis novas.

Arquivos `.env` nao entram na imagem Docker porque `.dockerignore` ignora `.env*`.

## Executar com Docker

Na raiz do projeto:

```powershell
docker compose up --build
```

Serviços:

- API: `http://localhost:3333`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6380`
- Frontend containerizado: `http://localhost:5173`
- Container da API: `planning-pocker`

Prisma aplica migrations versionadas automaticamente durante a subida da API.

## Executar frontend em desenvolvimento

Com a API em execução, abra outro terminal:

```powershell
cd frontend
npm install
npm run dev
```

Abra a URL exibida pelo Vite, normalmente `http://localhost:5173`.

## Verificações

```powershell
cd frontend
npm run build
npm run lint

cd ..\api
$env:DATABASE_URL='postgresql://planning:planning@localhost:5432/planning_poker?schema=public'
npx prisma validate
npm run build
npm test
```

## Estrutura

```text
api/                    NestJS API, gateway, Prisma e Dockerfile
frontend/               React/Vite application
packages/shared-types/  Contratos compartilhados de realtime
docker-compose.yml      API, PostgreSQL e Redis
TASKS.md                Tasks concluídas e pendentes
```

## Rotas frontend

- `http://localhost:5173/`: criar ou entrar em sala.
- `http://localhost:5173/room/CODIGO`: abrir sala pelo codigo de convite.
- Salas privadas solicitam senha antes de conectar ao realtime.
- Salas publicas entram apenas com codigo.

## Parar serviços

```powershell
docker compose down
```

Volumes não são removidos por esse comando.
