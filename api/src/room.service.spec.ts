import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
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
      update: vi.fn(),
    },
    roomParticipant: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
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