import { describe, expect, it, vi } from 'vitest';
import { RoomService } from './room.service.js';
import { SessionService } from './auth/session.service.js';

function prismaMock() {
  return {
    room: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    roomConfig: { create: vi.fn() },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    roomParticipant: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    roomJoinRequest: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    roomRemovedIdentity: { findUnique: vi.fn(), deleteMany: vi.fn() },
    story: { count: vi.fn(), create: vi.fn() },
    roomRoleChangeRequest: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    sprintReport: { create: vi.fn() },
  };
}

describe('RoomService.joinSession', () => {
  it('do not overwrite the logged in account profile when joining a room', async () => {
    const prisma = prismaMock();
    prisma.room.findFirst.mockResolvedValue({
      id: 'room-1',
      inviteCode: 'AB12',
      visibility: 'PUBLIC',
      passwordHash: null,
      ownerId: 'owner-1',
      config: { papeisPermitidos: ['PO', 'Dev', 'QA', 'ScrumMaster', 'Observador', 'IA_Agente'], maxParticipantes: 12 },
    });
    prisma.roomParticipant.findUnique.mockResolvedValue(null);
    prisma.roomParticipant.count.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Nome da Conta', avatarUrl: '♠', isGuest: false });
    prisma.roomParticipant.create.mockResolvedValue({ id: 'participant-1', role: 'Dev' });

    const service = new RoomService(prisma as any, new SessionService());
    await service.joinSession('AB12', 'Nome da Mesa', '🃏', 'Dev', undefined, 'user-1');

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    const participantData = prisma.roomParticipant.create.mock.calls[0][0].data;
    expect(participantData.roomDisplayName).toBe('Nome da Conta');
    expect(participantData.roomAvatarUrl).toBe('♠');
  });
});

describe('RoomService.create (config de padroes)', () => {
  it('aplica apenas chaves conhecidas/validas do config como padrao da sala', async () => {
    const prisma = prismaMock();
    prisma.room.create.mockResolvedValue({ id: 'room-1', inviteCode: 'ABC1', name: 'Sala', visibility: 'PUBLIC' });
    const service = new RoomService(prisma as any, new SessionService());

    await service.create('Sala', 'PUBLIC', undefined, {
      tempoReflexaoSegundos: 45,
      iaDiscute: true,
      permiteParticipantesIA: true,
      maxParticipantes: 500, // invalido (fora de 1..50) -> ignorado
      chaveEstranha: true, // desconhecida -> ignorada
    });

    const createCall = prisma.roomConfig.create.mock.calls[0][0];
    expect(createCall.data.tempoReflexaoSegundos).toBe(45);
    expect(createCall.data.iaDiscute).toBe(true);
    expect(createCall.data.permiteParticipantesIA).toBe(true);
    // valor invalido (500) foi ignorado; o @default(12) e aplicado pelo schema
    expect(createCall.data.maxParticipantes).toBeUndefined();
    expect(createCall.data.chaveEstranha).toBeUndefined();
    expect(createCall.data.deckType).toBe('fibonacci');
    expect(Array.isArray(createCall.data.deckValues)).toBe(true);
  });

  it('sem config mantem os defaults existentes', async () => {
    const prisma = prismaMock();
    prisma.room.create.mockResolvedValue({ id: 'room-1', inviteCode: 'ABC2', name: 'Sala', visibility: 'PUBLIC' });
    const service = new RoomService(prisma as any, new SessionService());

    await service.create('Sala', 'PUBLIC');

    const createCall = prisma.roomConfig.create.mock.calls[0][0];
    // sem config, a chave fica ausente e o Prisma aplica o @default(false) do schema
    expect(createCall.data.iaDiscute).toBeUndefined();
    expect(createCall.data.deckType).toBe('fibonacci');
  });
});

describe('RoomService.mine (minhas salas)', () => {
  it('retorna reportId do relatorio mais recente por sala', async () => {
    const prisma = prismaMock();
    prisma.roomParticipant.findMany.mockResolvedValue([
      {
        id: 'participant-1',
        role: 'PO',
        joinedAt: new Date('2026-09-01T10:00:00Z'),
        lastSeenAt: new Date('2026-09-01T12:00:00Z'),
        room: {
          id: 'room-1',
          inviteCode: 'ABC1',
          name: 'Sprint 1',
          status: 'encerrada',
          visibility: 'PUBLIC',
          ownerId: 'participant-1',
          reports: [{ id: 'report-1', generatedAt: new Date('2026-09-01T11:00:00Z') }],
        },
      },
      {
        id: 'participant-2',
        role: 'Dev',
        joinedAt: new Date('2026-09-02T10:00:00Z'),
        lastSeenAt: new Date('2026-09-02T12:00:00Z'),
        room: {
          id: 'room-2',
          inviteCode: 'ABC2',
          name: 'Em andamento',
          status: 'em_andamento',
          visibility: 'PUBLIC',
          ownerId: 'outro',
          reports: [],
        },
      },
    ]);
    const service = new RoomService(prisma as any, new SessionService());

    const result = await service.mine('user-1');

    expect(result[0]).toMatchObject({ code: 'ABC1', status: 'encerrada', isOwner: true, reportId: 'report-1' });
    expect(result[0].reportGeneratedAt).toBe('2026-09-01T11:00:00.000Z');
    expect(result[1].reportId).toBeNull();
    expect(result[1].isOwner).toBe(false);
  });
});

describe('RoomService.joinSession approval', () => {
  it('creates a pending join request when room requires approval', async () => {
    const prisma = prismaMock();
    prisma.room.findFirst.mockResolvedValue({
      id: 'room-1',
      inviteCode: 'AB12',
      visibility: 'PUBLIC',
      passwordHash: null,
      ownerId: 'owner-1',
      config: { requireJoinApproval: true, papeisPermitidos: ['PO', 'Dev'], maxParticipantes: 12 },
    });
    prisma.user.upsert.mockResolvedValue({ id: 'guest-1', name: 'Ana', avatarUrl: '♠', isGuest: true });
    prisma.roomParticipant.findUnique.mockResolvedValue(null);
    prisma.roomParticipant.count.mockResolvedValue(1);
    prisma.roomRemovedIdentity.findUnique.mockResolvedValue(null);
    prisma.roomJoinRequest.findFirst.mockResolvedValue(null);
    prisma.roomJoinRequest.create.mockResolvedValue({ id: 'jr1', roomId: 'room-1', userId: 'guest-1', name: 'Ana', avatar: '♠', requestedRole: 'Dev', status: 'pending', createdAt: new Date(), decidedAt: null });

    const service = new RoomService(prisma as any, new SessionService());
    const result = await service.joinSession('AB12', 'Ana', '♠', 'Dev', undefined, undefined, 'guest-1');

    expect(result).toMatchObject({ status: 'pending', joinRequestId: 'jr1' });
    expect(prisma.roomParticipant.create).not.toHaveBeenCalled();
  });

  it('removed guest must request approval before rejoining', async () => {
    const prisma = prismaMock();
    prisma.room.findFirst.mockResolvedValue({
      id: 'room-1',
      inviteCode: 'AB12',
      visibility: 'PUBLIC',
      passwordHash: null,
      ownerId: 'owner-1',
      config: { requireJoinApproval: false, papeisPermitidos: ['PO', 'Dev'], maxParticipantes: 12 },
    });
    prisma.user.upsert.mockResolvedValue({ id: 'guest-1', name: 'Ana', avatarUrl: '♠', isGuest: true });
    prisma.roomParticipant.findUnique.mockResolvedValue(null);
    prisma.roomParticipant.count.mockResolvedValue(1);
    prisma.roomRemovedIdentity.findUnique.mockResolvedValue({ id: 'removed-1' });
    prisma.roomJoinRequest.findFirst.mockResolvedValue(null);
    prisma.roomJoinRequest.create.mockResolvedValue({ id: 'jr2', roomId: 'room-1', userId: 'guest-1', name: 'Ana', avatar: '♠', requestedRole: 'Dev', status: 'pending', createdAt: new Date(), decidedAt: null });

    const service = new RoomService(prisma as any, new SessionService());
    const result = await service.joinSession('AB12', 'Ana', '♠', 'Dev', undefined, undefined, 'guest-1');

    expect(result).toMatchObject({ status: 'pending', joinRequestId: 'jr2' });
  });
});
