import { describe, expect, it, vi } from 'vitest';
import { PresenceService } from './presence.service.js';
import type { InternalRoomState, InternalParticipant } from './room.types.js';

function makeState(): InternalRoomState {
  const participants: InternalParticipant[] = [
    { id: 'p1', userId: 'u1', name: 'Ana', avatar: '♠', role: 'PO', isAI: false, connected: false, hasVoted: false, status: 'ativo' },
    { id: 'p2', userId: 'u2', name: 'Bia', avatar: '♥', role: 'Dev', isAI: false, connected: false, hasVoted: false, status: 'ativo' },
  ];
  return {
    roomId: 'CODE',
    dbRoomId: 'room-1',
    name: 'Sala',
    code: 'CODE',
    status: 'aberta',
    visibility: 'PUBLIC',
    ownerId: 'p1',
    config: {} as any,
    participants,
    stories: [],
    phase: 'lobby',
    votes: [{ participantId: 'p2', participantName: 'Bia', value: 5 }],
    remainingSeconds: null,
    timerType: null,
    messages: [],
  };
}

function prismaMock() {
  return {
    roomParticipant: { delete: vi.fn(async () => ({})), update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })) },
    room: { update: vi.fn(async () => ({})) },
  };
}

describe('PresenceService', () => {
  it('connectParticipant sets connected and tracks the socket', () => {
    const presence = new PresenceService(prismaMock() as any);
    const state = makeState();
    const participant = presence.connectParticipant(state, 'p1', 'socket-a');
    expect(participant?.connected).toBe(true);
    expect(presence.socketCount('p1')).toBe(1);
  });

  it('onDisconnect marks offline only when no socket remains for the participant', () => {
    const presence = new PresenceService(prismaMock() as any);
    const state = makeState();
    presence.connectParticipant(state, 'p2', 'socket-a');
    presence.connectParticipant(state, 'p2', 'socket-b');
    expect(presence.onDisconnect(state, 'p2', 'socket-a')).toBeNull();
    const change = presence.onDisconnect(state, 'p2', 'socket-b');
    expect(change?.reason).toBe('disconnected');
    expect(state.participants[1].connected).toBe(false);
  });

  it('dedupe returns stale sockets keeping the live one for the session', () => {
    const presence = new PresenceService(prismaMock() as any);
    const state = makeState();
    presence.connectParticipant(state, 'p1', 'old');
    presence.connectParticipant(state, 'p1', 'new');
    const stale = presence.dedupe(state, 'p1', 'new');
    expect(stale).toEqual(['old']);
    expect(presence.socketCount('p1')).toBe(1);
  });

  it('remove deletes membership, clears sockets and drops the participant from state', async () => {
    const prisma = prismaMock();
    const presence = new PresenceService(prisma as any);
    const state = makeState();
    presence.connectParticipant(state, 'p2', 'socket-a');
    const change = await presence.remove(state, 'p2');
    expect(change?.reason).toBe('removed');
    expect(change?.socketIds).toEqual(['socket-a']);
    expect(state.participants.find((p) => p.id === 'p2')).toBeUndefined();
    expect(state.votes.some((v) => v.participantId === 'p2')).toBe(false);
    expect(prisma.roomParticipant.delete).toHaveBeenCalledWith({ where: { id: 'p2' } });
  });

  it('setStatus persists inativo and deactivates the participant', async () => {
    const prisma = prismaMock();
    const presence = new PresenceService(prisma as any);
    const state = makeState();
    presence.connectParticipant(state, 'p2', 'socket-a');
    const change = await presence.setStatus(state, 'p2', 'inativo');
    expect(change?.reason).toBe('status');
    expect(state.participants[1].status).toBe('inativo');
    expect(state.participants[1].connected).toBe(false);
    expect(prisma.roomParticipant.update).toHaveBeenCalledWith({ where: { id: 'p2' }, data: { status: 'inativo' } });
  });

  it('transferOwner promotes the new host to PO and persists ownership', async () => {
    const prisma = prismaMock();
    const presence = new PresenceService(prisma as any);
    const state = makeState();
    const change = await presence.transferOwner(state, 'p1', 'p2');
    expect(change?.reason).toBe('owner');
    expect(state.ownerId).toBe('p2');
    expect(state.participants[1].role).toBe('PO');
    expect(prisma.room.update).toHaveBeenCalledWith({ where: { id: 'room-1' }, data: { ownerId: 'p2' } });
    expect(prisma.roomParticipant.update).toHaveBeenCalledWith({ where: { id: 'p2' }, data: { role: 'PO' } });
  });
});