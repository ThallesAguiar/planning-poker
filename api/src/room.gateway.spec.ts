import { beforeEach, describe, expect, it, vi } from 'vitest';

delete process.env.REDIS_URL;

import { RoomGateway } from './room.gateway.js';
import { RoomStateService } from './realtime/room-state.service.js';
import { RoundService } from './realtime/round.service.js';
import { PresenceService } from './realtime/presence.service.js';
import { TimerService } from './realtime/timer.service.js';
import { RoomService } from './room.service.js';
import { AuthorizationService } from './auth/authorization.service.js';
import { SessionService } from './auth/session.service.js';
import type { Server, Socket } from 'socket.io';

type Harness = ReturnType<typeof buildHarness>;

function buildHarness() {
const roleRequests = new Map<string, any>();
  const participantsByUser = new Map<string, any>();
  const participantsById = new Map<string, any>();
  const stories: any[] = [];
  let pidCounter = 1;
  const room = {
    id: 'room-1',
    inviteCode: 'CODE',
    name: 'Sala',
    status: 'aberta',
    ownerId: 'pending',
    visibility: 'PUBLIC',
    passwordHash: null,
    config: {
      deckType: 'fibonacci',
      deckValues: [1, 2, 3, 5, 8, 13, 20, 40, 100, 'café', '?'],
      tempoReflexaoSegundos: 120,
      tempoDiscussaoSegundos: 300,
      permiteParticipantesIA: false,
      maxParticipantes: 12,
      votoAnonimo: false,
      revelacaoAutomatica: false,
      criterioConsenso: 'decisao_po',
      papeisPermitidos: ['PO', 'Dev', 'QA', 'ScrumMaster', 'Observador', 'IA_Agente'],
    },
    stories: [],
    participants: [],
    messages: [],
  };
  const prisma = {
    user: {
      upsert: vi.fn(async ({ create, where }: any) => ({ id: where?.id ?? create.id, name: create.name, avatarUrl: create.avatarUrl, isGuest: true })),
    },
    room: {
      findFirst: vi.fn(async () => room),
      findUnique: vi.fn(async () => room),
      update: vi.fn(async (args: any) => Object.assign(room, args.data)),
    },
    roomConfig: { update: vi.fn(async () => ({})) },
    roomParticipant: {
      findUnique: vi.fn(async (args: any) => (args.where?.roomId_userId ? participantsByUser.get(args.where.roomId_userId.userId) : participantsById.get(args.where?.id)) ?? null),
      findMany: vi.fn(async () => []),
create: vi.fn(async (args: any) => {
        const row = { id: `p${pidCounter++}`, ...args.data, status: 'ativo', joinedAt: new Date(), lastSeenAt: new Date() };
        participantsByUser.set(args.data.userId, row);
        participantsById.set(row.id, row);
        return row;
      }),
      update: vi.fn(async (args: any) => Object.assign(participantsById.get(args.where.id), args.data)),
      delete: vi.fn(async (args: any) => {
        const row = participantsById.get(args.where.id);
        participantsByUser.delete(row?.userId);
        participantsById.delete(args.where.id);
        return {};
      }),
    },
    story: {
      create: vi.fn(async (args: any) => { const story = { id: `s${stories.length + 1}`, rounds: 0, ...args.data }; stories.push(story); return story; }),
      update: vi.fn(async (args: any) => { const story = stories.find((s) => s.id === args.where.id); if (story) Object.assign(story, args.data); return story; }),
    },
    voteRound: {
      create: vi.fn(async (args: any) => ({ id: `round-${args.data.number}`, ...args.data })),
      update: vi.fn(async () => ({})),
      findFirst: vi.fn(async () => null),
    },
    vote: { upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
    chatMessage: { create: vi.fn(async (args: any) => ({ id: 'm1', createdAt: new Date(), ...args.data })) },
    sprintReport: { create: vi.fn(async (args: any) => ({ id: 'rep1', ...args.data })) },
    roomRoleChangeRequest: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (args: any) => ({ id: `rr${pidCounter++}`, status: 'pending', createdAt: new Date(), decidedAt: null, ...args.data })),
      update: vi.fn(async (args: any) => Object.assign({ id: args.where.id }, args.data)),
    },
  };

  const serverEvents: { roomId: string; event: string; payload: any }[] = [];
  const clientsBySocket = new Map<string, ClientContext>();

  const server = {
    serverEvents,
    sockets: { sockets: new Map<string, any>() },
    socketsById: clientsBySocket as any,
    to: (roomId: string) => ({
      emit: (event: string, payload: any) => serverEvents.push({ roomId, event, payload }),
    }),
  };

  const sessions = new SessionService();
  const roomStates = new RoomStateService();
  const round = new RoundService(prisma as any, new TimerService());
  const presence = new PresenceService(prisma as any);
  const rooms = new RoomService(prisma as any, sessions);
  const gateway = new RoomGateway(
    prisma as any,
    new AuthorizationService(sessions),
    sessions,
    { castVote: vi.fn() } as any,
    roomStates,
    round,
    presence,
    rooms,
  );
  gateway.server = server as unknown as Server;
  round.setEmitter({
    to: (roomId, event, payload) => server.to(roomId).emit(event, payload),
    broadcast: (state) => (gateway as any).broadcastRoom(state),
  });

  return { prisma, gateway, server, sessions, storyId: () => stories[0]?.id, newClient };
}

type ClientContext = {
  client: Socket;
  emits: { event: string; payload: any }[];
  connected: boolean;
};

function newClient(id: string): ClientContext {
  const ctx: ClientContext = { emits: [], connected: true } as any;
  const client: any = {
    id,
    data: {},
    emit: (event: string, payload: any) => { ctx.emits.push({ event, payload }); return client; },
    join: () => undefined,
    disconnect: () => { ctx.connected = false; },
  };
  ctx.client = client;
  return ctx;
}

async function joinRoom(h: Harness, ctx: ClientContext, over: Record<string, unknown> = {}) {
  h.server.sockets.sockets.set(ctx.client.id, ctx.client);
  const sessionId = (over.sessionId as string) ?? `session-${ctx.client.id}`;
  const token = h.sessions.issueGuest('room-1', undefined, sessionId).token;
  await h.gateway.join(ctx.client as any, {
    roomId: 'CODE',
    name: `Jogador ${ctx.client.id}`,
    avatar: '♠',
    role: 'Dev',
    sessionId,
    token,
    ...over,
  });
  return { sessionId, token };
}

function latestRoomState(h: Harness) {
  const states = h.server.serverEvents.filter((e) => e.event === 'room:state');
  return states.at(-1)?.payload;
}

function errorCodes(ctx: ClientContext) {
  return ctx.emits.filter((e) => e.event === 'room:error').map((e) => e.payload.code);
}

describe('RoomGateway (multi-client integration)', () => {
  let h: Harness;

  beforeEach(() => {
    h = buildHarness();
  });

  it('runs a full round: present -> vote -> reveal -> discussion -> revote -> finalize', async () => {
    const po = newClient('sock-po');
    const dev = newClient('sock-dev');
    await joinRoom(h, po);
    await joinRoom(h, dev);

    await h.gateway.createStory(po.client as any, { title: 'Historia 1', description: 'descricao' });
    const storyId = h.storyId();
    expect(storyId).toBeDefined();

    await h.gateway.present(po.client as any, { storyId });
    expect(latestRoomState(h)?.phase).toBe('votacao');

    await h.gateway.vote(dev.client as any, { storyId, value: 3 });
    await h.gateway.vote(po.client as any, { storyId, value: 8 });
    expect(latestRoomState(h)?.votes.every((v: any) => v.value === '?')).toBe(true);

    await h.gateway.reveal(po.client as any);
    expect(latestRoomState(h)?.phase).toBe('discussao');
    const discussion = h.server.serverEvents.find((e) => e.event === 'discussion:start');
    expect(discussion).toBeDefined();

    await h.gateway.revote(po.client as any);
    expect(latestRoomState(h)?.phase).toBe('votacao');

    await h.gateway.vote(dev.client as any, { storyId, value: 5 });
    await h.gateway.vote(po.client as any, { storyId, value: 5 });
    await h.gateway.reveal(po.client as any);
    expect(latestRoomState(h)?.phase).toBe('revelada');

    await h.gateway.finalize(po.client as any, { value: 5, criterion: 'decisao_po' });
    const finalState = latestRoomState(h);
    expect(finalState?.stories[0].status).toBe('estimada');
    expect(finalState?.stories[0].finalValue).toBe(5);
    expect(errorCodes(po)).toEqual([]);
  });

  it('unmasks revealed votes and anonymizes when votoAnonimo is set', async () => {
    const po = newClient('sock-po');
    const dev = newClient('sock-dev');
    await joinRoom(h, po);
    await joinRoom(h, dev);
    await h.gateway.configure(po.client as any, { config: { votoAnonimo: true } });
    await h.gateway.createStory(po.client as any, { title: 'H', description: '' });
    const storyId = h.storyId();
    await h.gateway.present(po.client as any, { storyId });
    await h.gateway.vote(dev.client as any, { storyId, value: 3 });
    await h.gateway.vote(po.client as any, { storyId, value: 3 });
    await h.gateway.reveal(po.client as any);
    const state = latestRoomState(h);
    expect(state?.votes.every((v: any) => v.participantName === 'Participante')).toBe(true);
  });

  it('blocks non-PO actors from reveal, configure, remove and story controls', async () => {
    const po = newClient('sock-po');
    const dev = newClient('sock-dev');
    await joinRoom(h, po);
    await joinRoom(h, dev);

    await h.gateway.reveal(dev.client as any);
    expect(errorCodes(dev)).toContain('FORBIDDEN');
    await h.gateway.configure(dev.client as any, { config: { tempoReflexaoSegundos: 10 } });
    expect(errorCodes(dev)).toContain('FORBIDDEN');
    await h.gateway.removeParticipant(dev.client as any, { participantId: 'whoever' });
    expect(errorCodes(dev)).toContain('FORBIDDEN');
    await h.gateway.createStory(dev.client as any, { title: 'x' });
    expect(errorCodes(dev)).toContain('FORBIDDEN');
    expect(errorCodes(po)).toEqual([]);
  });

  it('observer cannot vote', async () => {
    const po = newClient('sock-po');
    const obs = newClient('sock-obs');
    await joinRoom(h, po);
    await joinRoom(h, obs, { role: 'Observador' });
    await h.gateway.createStory(po.client as any, { title: 'H' });
    const storyId = h.storyId();
    await h.gateway.present(po.client as any, { storyId });
    await h.gateway.vote(obs.client as any, { storyId, value: 5 });
    expect(errorCodes(obs)).toContain('FORBIDDEN');
  });

  it('removed participant loses session and stops affecting the room', async () => {
    const po = newClient('sock-po');
    const dev = newClient('sock-dev');
    await joinRoom(h, po);
    await joinRoom(h, dev);
    const removedId = dev.client.data.participantId;

await h.gateway.removeParticipant(po.client as any, { participantId: removedId });
    const kicked = dev.emits.find((e) => e.event === 'room:kicked');
    expect(kicked?.payload.code).toBe('REMOVED');
    expect(dev.connected).toBe(false);
    expect(latestRoomState(h)?.participants.some((p: any) => p.id === removedId)).toBe(false);

    await h.gateway.createStory(po.client as any, { title: 'H' });
    const storyId = h.storyId();
    await h.gateway.present(po.client as any, { storyId });
    await h.gateway.vote(dev.client as any, { storyId, value: 5 });
    expect(errorCodes(dev)).toContain('NOT_PARTICIPANT');
  });

it('same session reconnection reuses the participant and disconnects the stale socket', async () => {
    const first = newClient('sock-a');
    await joinRoom(h, first, { sessionId: 'same-session' });
    const firstPid = first.client.data.participantId;
    expect(firstPid).toBeDefined();

    const replay = newClient('sock-b');
    const issued = await joinRoom(h, replay, { sessionId: 'same-session' });

    expect(replay.client.data.participantId).toBe(firstPid);
    expect(latestRoomState(h)?.participants.length).toBe(1);
    expect(first.connected).toBe(false);
    expect(issued.token).toBeDefined();
  });

  it('configure validates partial config and persists it', async () => {
    const po = newClient('sock-po');
    await joinRoom(h, po);
    await h.gateway.configure(po.client as any, { config: { tempoReflexaoSegundos: 60, revelacaoAutomatica: true } });
    expect(errorCodes(po)).toEqual([]);
    const state = latestRoomState(h);
    expect(state?.config.tempoReflexaoSegundos).toBe(60);
    expect(state?.config.revelacaoAutomatica).toBe(true);
    expect(h.prisma.roomConfig.update).toHaveBeenCalled();

    await h.gateway.configure(po.client as any, { config: { maxParticipantes: 500 } });
    expect(errorCodes(po)).toContain('INVALID_CONFIG');
  });
});
