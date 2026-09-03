import { describe, expect, it, vi, afterEach } from 'vitest';
import { RoundService } from './round.service.js';
import { TimerService } from './timer.service.js';
import { defaultConfig } from './room.types.js';
import type { InternalRoomState, InternalParticipant, RoundEmitter } from './room.types.js';

function makeState(over: Partial<InternalRoomState> = {}): InternalRoomState {
  const participants: InternalParticipant[] = [
    { id: 'p1', userId: 'u1', name: 'Ana', avatar: '♠', role: 'PO', isAI: false, connected: true, hasVoted: false, status: 'ativo' },
    { id: 'p2', userId: 'u2', name: 'Bia', avatar: '♥', role: 'Dev', isAI: false, connected: true, hasVoted: false, status: 'ativo' },
    { id: 'p3', userId: 'u3', name: 'Obs', avatar: '♦', role: 'Observador', isAI: false, connected: true, hasVoted: false, status: 'ativo' },
  ];
  return {
    roomId: 'CODE',
    dbRoomId: 'room-1',
    name: 'Sala',
    code: 'CODE',
    status: 'aberta',
    visibility: 'PUBLIC',
    ownerId: 'p1',
    config: { ...defaultConfig, tempoReflexaoSegundos: 120, tempoDiscussaoSegundos: 300 },
    participants,
    stories: [{ id: 's1', title: 'Story A', description: 'desc A', order: 1, status: 'pendente', rounds: 0 }],
    phase: 'lobby',
    votes: [],
    remainingSeconds: null,
    timerType: null,
    messages: [],
    ...over,
  };
}

function prismaMock() {
  return {
    story: {
      create: vi.fn(async (args: any) => ({ id: 's90', rounds: 0, ...args.data })),
      update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
    },
    voteRound: {
      create: vi.fn(async (args: any) => ({ id: `round-${args.data.number}`, ...args.data })),
      update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
    },
    vote: {
      upsert: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    room: { update: vi.fn(async () => ({})) },
  };
}

function capture(): { emitter: RoundEmitter; events: any[]; broadcasts: InternalRoomState[] } {
  const events: any[] = [];
  const broadcasts: InternalRoomState[] = [];
  return {
    emitter: {
      to: (roomId: string, event: string, payload: unknown) => { events.push({ roomId, event, payload }); },
      broadcast: (state: InternalRoomState) => { broadcasts.push(state); },
    },
    events,
    broadcasts,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('RoundService', () => {
  it('present advances to votacao and starts a reflexao timer', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    const cap = capture();
    round.setEmitter(cap.emitter);
    const state = makeState();
    const result = await round.present(state, 's1');
    expect(result.error).toBeUndefined();
    expect(state.phase).toBe('votacao');
    expect(state.roundId).toBe('round-1');
    expect(state.currentStoryId).toBe('s1');
    expect(state.stories[0].status).toBe('em_votacao');
    expect(state.remainingSeconds).toBe(120);
    const start = cap.events.find((e) => e.event === 'timer:start');
    expect(start.payload.type).toBe('reflexao');
    expect(cap.broadcasts.length).toBeGreaterThan(0);
    expect(prisma.room.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'em_andamento' } }));
  });

  it('castVote persists, marks voted and emits vote:progress with masked public state', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    const cap = capture();
    round.setEmitter(cap.emitter);
    const state = makeState();
    await round.present(state, 's1');
    const result = await round.castVote(state, state.participants[1], 's1', 5);
    expect(result.error).toBeUndefined();
    expect(state.participants[1].hasVoted).toBe(true);
    expect(state.votes).toEqual([{ participantId: 'p2', participantName: 'Bia', value: 5 }]);
    const progress = cap.events.find((e) => e.event === 'vote:progress');
    expect(progress.payload).toEqual({ voted: 1, total: 2 });
    expect(round.toPublicState(state).votes[0].value).toBe('?');
    expect(prisma.vote.upsert).toHaveBeenCalled();
  });

  it('rejects voting for observers, wrong phase, unknown story and invalid value', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    const cap = capture();
    round.setEmitter(cap.emitter);
    const state = makeState();

    expect((await round.castVote(state, state.participants[2], 's1', 5)).error).toBe('FORBIDDEN');
    expect((await round.castVote(state, state.participants[1], 's1', 999)).error).toBe('INVALID_PHASE');

    await round.present(state, 's1');
    expect((await round.castVote(state, state.participants[1], 'unknown', 5)).error).toBe('INVALID_VOTE');
    expect((await round.castVote(state, null, 's1', 5)).error).toBe('NOT_PARTICIPANT');
  });

  it('forceReveal is blocked on lobby and empty votes but works after votes', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    const cap = capture();
    round.setEmitter(cap.emitter);
    const state = makeState();
    expect((await round.forceReveal(state)).error).toBe('INVALID_PHASE');
    await round.present(state, 's1');
    expect((await round.forceReveal(state)).error).toBe('INVALID_VOTE');
    await round.castVote(state, state.participants[0], 's1', 5);
    await round.castVote(state, state.participants[1], 's1', 5);
    expect((await round.forceReveal(state)).error).toBeUndefined();
    expect(state.phase).toBe('revelada');
    const reveal = cap.events.find((e) => e.event === 'vote:reveal');
    expect(reveal.payload.unanimous).toBe(true);
    expect(reveal.payload.average).toBe(5);
    const lastState = cap.broadcasts.at(-1)!;
    expect(lastState.votes[0].value).toBe(5);
  });

  it('divergent votes open discussion phase with its own timer', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    const cap = capture();
    round.setEmitter(cap.emitter);
    const state = makeState();
    await round.present(state, 's1');
    await round.castVote(state, state.participants[0], 's1', 3);
    await round.castVote(state, state.participants[1], 's1', 8);
    expect((await round.forceReveal(state)).error).toBeUndefined();
    expect(state.phase).toBe('discussao');
    const discussion = cap.events.find((e) => e.event === 'discussion:start');
    expect(discussion).toBeDefined();
    expect(discussion.payload.remainingSeconds).toBe(300);
    expect(prisma.story.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'em_discussao' } }));
  });

  it('revote after discussion ends discussion and stacks a new round', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    const cap = capture();
    round.setEmitter(cap.emitter);
    const state = makeState();
    await round.present(state, 's1');
    await round.castVote(state, state.participants[0], 's1', 3);
    await round.castVote(state, state.participants[1], 's1', 8);
    await round.forceReveal(state);
    expect((await round.revote(state)).error).toBeUndefined();
    expect(state.phase).toBe('votacao');
    expect(state.roundId).toBe('round-2');
    expect(state.stories[0].rounds).toBe(2);
    expect(cap.events.some((e) => e.event === 'discussion:end' && e.payload.reason === 'revote')).toBe(true);
  });

  it('finalize locks value and advances to next story, then finalizes the room when none left', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    const cap = capture();
    round.setEmitter(cap.emitter);
    const state = makeState({
      stories: [
        { id: 's1', title: 'A', description: '', order: 1, status: 'pendente', rounds: 0 },
        { id: 's2', title: 'B', description: '', order: 2, status: 'pendente', rounds: 0 },
      ],
    });
    await round.present(state, 's1');
    await round.castVote(state, state.participants[0], 's1', 5);
    await round.castVote(state, state.participants[1], 's1', 5);
    await round.forceReveal(state);
    const result = await round.finalize(state, 5, 'decisao_po');
    expect(result.error).toBeUndefined();
    expect(state.stories[0].status).toBe('estimada');
    expect(state.stories[0].finalValue).toBe(5);
    expect(state.phase).toBe('lobby');
    expect(state.currentStoryId).toBe('s2');
    expect(prisma.room.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'em_andamento' } }));

    await round.present(state, 's2');
    await round.castVote(state, state.participants[0], 's2', 3);
    await round.castVote(state, state.participants[1], 's2', 3);
    await round.forceReveal(state);
    await round.finalize(state, 3, 'decisao_po');
    expect(state.phase).toBe('finalizada');
    expect(state.status).toBe('encerrada');
    expect(prisma.room.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'encerrada' } }));
  });

  it('skip marks story pulada and returns to lobby', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    round.setEmitter(capture().emitter);
    const state = makeState();
    await round.present(state, 's1');
    expect((await round.skip(state)).error).toBe('INVALID_PHASE');
    await round.castVote(state, state.participants[0], 's1', 5);
    await round.castVote(state, state.participants[1], 's1', 8);
    await round.forceReveal(state);
    expect((await round.skip(state)).error).toBeUndefined();
    expect(state.stories[0].status).toBe('pulada');
    expect(state.phase).toBe('lobby');
  });

  it('resumeFromStorage restarts a live timer when deadline is in the future', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    const cap = capture();
    round.setEmitter(cap.emitter);
    const state = makeState();
    await round.present(state, 's1');
    await round.castVote(state, state.participants[0], 's1', 5);
    const deadline = new Date(Date.now() + 42_000);
    state.phase = 'votacao';
    state.timerType = null;
    state.remainingSeconds = null;
    await round.resumeFromStorage(state, { timerType: 'reflexao', timerDeadline: deadline });
    expect(state.remainingSeconds).toBe(42);
    const starts = cap.events.filter((e) => e.event === 'timer:start');
    const start = starts.at(-1)!;
    expect(start.payload.type).toBe('reflexao');
    expect(start.payload.duracaoSegundos).toBe(42);
  });

  it('resumeFromStorage reveals an expired reflexao and opens discussion on divergence', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    round.setEmitter(capture().emitter);
    const state = makeState();
    state.phase = 'votacao';
    state.roundId = 'round-1';
    state.currentStoryId = 's1';
    state.votes = [
      { participantId: 'p1', participantName: 'Ana', value: 3 },
      { participantId: 'p2', participantName: 'Bia', value: 8 },
    ];
    state.participants[0].hasVoted = true;
    state.participants[1].hasVoted = true;
    await round.resumeFromStorage(state, { timerType: 'reflexao', timerDeadline: new Date(Date.now() - 5_000) });
    expect(state.phase).toBe('discussao');
    expect(prisma.vote.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { revealed: true } }));
  });

  it('reflexao timer expiry reveals automatically', async () => {
    vi.useFakeTimers();
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    round.setEmitter(capture().emitter);
    const state = makeState();
    state.config = { ...state.config, tempoReflexaoSegundos: 1 };
    await round.present(state, 's1');
    await round.castVote(state, state.participants[0], 's1', 5);
    await round.castVote(state, state.participants[1], 's1', 8);
    expect(state.phase).toBe('votacao');
    await vi.advanceTimersByTimeAsync(1_500);
    expect(state.phase).toBe('discussao');
  });

  it('excludes inactive and offline participants from the voting denominator', async () => {
    const prisma = prismaMock();
    const round = new RoundService(prisma as any, new TimerService());
    const cap = capture();
    round.setEmitter(cap.emitter);
    const state = makeState();
    await round.present(state, 's1');
    state.participants[1].connected = false;
    expect(round.votingCounts(state)).toEqual({ total: 1, voted: 0 });
  });
});