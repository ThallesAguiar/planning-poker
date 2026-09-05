# Planning Poker

Aplicação de Planning Poker colaborativo em tempo real.

## Funcionalidades

- **Criar e entrar em salas** — o Product Owner cria uma sala de estimativa com codigo de convite;
  participantes entram como convidado escolhendo nome, avatar e papel. Salas podem ser publicas ou
  protegidas por senha.
- **Votacao em tempo real** — historias do backlog sao apresentadas e estimadas em rodadas numeradas.
  Cada participante joga uma carta do baralho configurado; os valores ficam ocultos ate a revelacao,
  e a mesa mostra apenas quem ja votou.
- **Justificativa por voto** — opcional, uma frase curta junto da carta. Fica oculta durante a votacao
  (igual ao valor) e aparece na carta revelada e no relatorio, em cada rodada, com o nome de quem votou.
- **Revelacao, consenso e revotagem** — ao revelar, a mesa mostra minimo, maximo, media, moda e status
  de consenso; se divergir, inicia a discussao e permite revotar ou finalizar com um criterio.
- **Papel de IA (opcional)** — um participante de IA que vota no baralho e justifica a nota; quando
  indisponivel, nao bloqueia nem inventa voto.
- **Chat e presenca** — chat da sala, justificativas vinculadas a historia, reacoes rapidas e presenca
  em tempo real com reconexao que restaura o estado.
- **Relatorio como documentacao** — ao encerrar a sala, o PO gera um relatorio permanente com:
  - votos por rodada (quem votou o que, com justificativa; nomes ocultos em voto anonimo);
  - sintese de cada historia e ideias de tasks sugeridas + resumo geral da sessao (LLM configurado ou
    heuristicas deterministicas como fallback);
  - "Anotacoes da mesa" (mensagens fora de rodada);
  - secao configurável na geracao (chat, votos, anotacoes da mesa, sintese);
  - exportacao em PDF e CSV (CSV leva justificativas e tasks agregadas);
  - regeneracao que substitui o relatorio anterior, sempre refletindo o estado atual.
- **Contas e salas salvas** — usuarios, salas, perfil/papeis e gestao de salas (ver
  `specs/002-user-auth-rooms/spec.md`).

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
