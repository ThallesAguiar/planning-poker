/* Seed de demonstração — idempotente.
   Cria uma conta de host, uma sala pública "Sala de demonstração" (código DEMO01)
   com 4 participantes humanos + 1 participante de IA.
   Executar: npm run db:seed  (usa DATABASE_URL do api/.env)
*/
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const HOST_EMAIL = 'demo@planningpoker.app';
const HOST_NAME = 'Maria Andrade';
const HOST_PASSWORD = 'demo1234';
const INVITE_CODE = 'DEMO01';
const ROOM_NAME = 'Sala de demonstração';

const DECK = [1, 2, 3, 5, 8, 13, 20, 40, 100, 'café', '?'];
const PAPEIS = ['PO', 'Dev', 'QA', 'ScrumMaster', 'Observador', 'IA_Agente'];

const PEOPLE = [
  { key: 'joao', name: 'João Pedro', avatar: '🦊', role: 'Dev' },
  { key: 'ana', name: 'Ana Souza', avatar: '🐼', role: 'QA' },
  { key: 'carlos', name: 'Carlos Lima', avatar: '🦉', role: 'ScrumMaster' },
  { key: 'bia', name: 'Beatriz Nunes', avatar: '🦄', role: 'Observador' },
];

async function ensureUser(userId, name, avatar, isGuest = true) {
  return prisma.user.upsert({
    where: { id: userId },
    update: { name, avatarUrl: avatar },
    create: { id: userId, name, avatarUrl: avatar, isGuest },
  });
}

async function ensureParticipant(roomId, userId, role, isAI = false) {
  return prisma.roomParticipant.upsert({
    where: { roomId_userId: { roomId, userId } },
    update: { status: 'ativo' },
    create: { roomId, userId, role, isAI, roomDisplayName: null, roomAvatarUrl: null },
  });
}

async function main() {
  // Upsert por email é inviável aqui: o schema marca email como único mas a migration cria
  // índice PARCIAL (WHERE email IS NOT NULL), e o ON CONFLICT do Prisma não casa com índice
  // parcial (erro 42P10). Busca+create/update funciona com ou sem índice e é idempotente.
  let host = await prisma.user.findFirst({ where: { email: HOST_EMAIL } });
  if (!host) {
    host = await prisma.user.create({
      data: {
        name: HOST_NAME,
        email: HOST_EMAIL,
        passwordHash: await bcrypt.hash(HOST_PASSWORD, 12),
        isGuest: false,
      },
    });
  } else {
    if (host.name !== HOST_NAME) await prisma.user.update({ where: { id: host.id }, data: { name: HOST_NAME } });
    if (!host.passwordHash) await prisma.user.update({ where: { id: host.id }, data: { passwordHash: await bcrypt.hash(HOST_PASSWORD, 12) } });
  }

  const room = await prisma.room.upsert({
    where: { inviteCode: INVITE_CODE },
    update: { name: ROOM_NAME, status: 'aberta' },
    create: { inviteCode: INVITE_CODE, name: ROOM_NAME, ownerId: 'pending', visibility: 'PUBLIC' },
  });

  await prisma.roomConfig.upsert({
    where: { roomId: room.id },
    update: {},
    create: {
      roomId: room.id,
      deckType: 'fibonacci',
      deckValues: DECK,
      papeisPermitidos: PAPEIS,
      tempoReflexaoSegundos: 120,
      tempoDiscussaoSegundos: 300,
      permiteParticipantesIA: false,
      maxParticipantes: 12,
      votoAnonimo: false,
      revelacaoAutomatica: false,
      criterioConsenso: 'decisao_po',
    },
  });

  const hostParticipant = await ensureParticipant(room.id, host.id, 'PO');
  if (room.ownerId === 'pending' || room.ownerId !== hostParticipant.id) {
    await prisma.room.update({ where: { id: room.id }, data: { ownerId: hostParticipant.id } });
  }

  for (const person of PEOPLE) {
    await ensureUser(`seed-${person.key}`, person.name, person.avatar);
    await ensureParticipant(room.id, `seed-${person.key}`, person.role);
  }

  await ensureUser('seed-ia', 'IA Assistente', '🤖');
  await ensureParticipant(room.id, 'seed-ia', 'IA_Agente', true);

  console.log(`Seed concluído: sala "${ROOM_NAME}" (${INVITE_CODE}) com ${PEOPLE.length + 1} participantes + 1 IA.`);
  console.log(`Host: ${HOST_EMAIL} / ${HOST_PASSWORD} (papel PO)`);
}

main().catch((error) => { console.error(error); process.exit(1); });