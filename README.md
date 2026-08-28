# Planning Poker

Aplicação de Planning Poker colaborativo em tempo real.

## Stack

- Frontend: React, Vite, TypeScript, TailwindCSS, Zustand, Framer Motion e Socket.IO client.
- API: NestJS, Socket.IO e Prisma.
- Infraestrutura: PostgreSQL, Redis e Docker Compose.

## Requisitos

- Docker Desktop
- Node.js 22+

## Executar com Docker

Na raiz do projeto:

```powershell
docker compose up --build
```

Serviços:

- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6380`
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
