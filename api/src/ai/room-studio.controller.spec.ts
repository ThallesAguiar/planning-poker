import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RoomStudioController } from './room-studio.controller.js';
import { RoomStudioService } from './room-studio.service.js';

function makeController(overrides: {
  sessions?: any;
  prisma?: any;
  studio?: any;
} = {}) {
  const sessions = overrides.sessions ?? {
    verifyAccount: vi.fn((token: string) => ({ type: 'account' as const, userId: token === 'owner-token' ? 'user-owner' : 'user-other' })),
  };
  const prisma = overrides.prisma ?? {
    room: {
      findFirst: vi.fn().mockResolvedValue({ id: 'room-1', ownerId: 'owner-participant', inviteCode: 'ABC123' }),
    },
    roomParticipant: {
      findUnique: vi.fn().mockResolvedValue({ id: 'owner-participant', roomId: 'room-1', userId: 'user-owner' }),
    },
  };
  const studio = overrides.studio ?? {
    getForRoom: vi.fn().mockResolvedValue({ provider: null, agent: null, rules: [] }),
    saveProvider: vi.fn().mockResolvedValue({ id: 'rp' }),
    saveAgent: vi.fn().mockResolvedValue({ id: 'ra' }),
    saveRules: vi.fn().mockResolvedValue([]),
    testProvider: vi.fn().mockResolvedValue({ ok: true, latencyMs: 120 }),
  };
  return { controller: new RoomStudioController(studio as any, prisma as any, sessions as any), sessions, prisma, studio };
}

describe('RoomStudioController', () => {
  it('exige Bearer token válido (401 sem header)', async () => {
    const { controller } = makeController();
    await expect(controller.get('room-1', undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.get('room-1', '')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.get('room-1', 'Bearer')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token inválido lança 401 UNAUTHENTICATED', async () => {
    const { controller, sessions } = makeController();
    sessions.verifyAccount.mockImplementation(() => { throw new Error('bad'); });
    await expect(controller.get('room-1', 'Bearer bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('sala inexistente lança 403 FORBIDDEN', async () => {
    const { controller, prisma } = makeController();
    prisma.room.findFirst.mockResolvedValue(null);
    await expect(controller.get('room-1', 'Bearer owner-token')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sala sem dono definido lança 403', async () => {
    const { controller, prisma } = makeController();
    prisma.room.findFirst.mockResolvedValue({ id: 'room-1', ownerId: 'pending' });
    await expect(controller.get('room-1', 'Bearer owner-token')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('participante que não é dono lança 403', async () => {
    const { controller, prisma } = makeController();
    prisma.roomParticipant.findUnique.mockResolvedValue({ id: 'other-participant', roomId: 'room-1', userId: 'user-owner' });
    await expect(controller.get('room-1', 'Bearer owner-token')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('usuário que não participa da sala lança 403', async () => {
    const { controller, prisma } = makeController();
    prisma.roomParticipant.findUnique.mockResolvedValue(null);
    await expect(controller.get('room-1', 'Bearer owner-token')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('GET resolve por id e devolve o snapshot do studio', async () => {
    const { controller, studio } = makeController();
    const result = await controller.get('room-1', 'Bearer owner-token');
    expect(result).toEqual({ provider: null, agent: null, rules: [] });
    expect(studio.getForRoom).toHaveBeenCalledWith('room-1');
  });

  it('resolve por inviteCode e normaliza para o id canônico', async () => {
    const { controller, prisma, studio } = makeController();
    prisma.room.findFirst.mockResolvedValue({ id: 'room-9', ownerId: 'owner-participant', inviteCode: 'ABC123' });
    prisma.roomParticipant.findUnique.mockResolvedValue({ id: 'owner-participant', roomId: 'room-9', userId: 'user-owner' });
    await controller.get('abc123', 'Bearer owner-token');
    expect(prisma.room.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ id: 'abc123' }, { inviteCode: 'ABC123' }] } }));
    expect(studio.getForRoom).toHaveBeenCalledWith('room-9');
  });

  it('PUT provider delega para o serviço', async () => {
    const { controller, studio } = makeController();
    const body: any = { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'gpt-4o-mini' };
    await controller.saveProvider('room-1', body, 'Bearer owner-token');
    expect(studio.saveProvider).toHaveBeenCalledWith('room-1', body);
  });

  it('POST provider/test delega para o serviço', async () => {
    const { controller, studio } = makeController();
    await controller.testProvider('room-1', { baseUrl: 'https://x', model: 'm' }, 'Bearer owner-token');
    expect(studio.testProvider).toHaveBeenCalledWith('room-1', { baseUrl: 'https://x', model: 'm' });
  });

  it('PUT agent delega para o serviço', async () => {
    const { controller, studio } = makeController();
    const body: any = { name: 'Robô', avatar: '🃏', systemPrompt: 'x' };
    await controller.saveAgent('room-1', body, 'Bearer owner-token');
    expect(studio.saveAgent).toHaveBeenCalledWith('room-1', body);
  });

  it('PUT rules delega contents para o serviço', async () => {
    const { controller, studio } = makeController();
    await controller.saveRules('room-1', { contents: ['Moeda: BRL'] }, 'Bearer owner-token');
    expect(studio.saveRules).toHaveBeenCalledWith('room-1', ['Moeda: BRL']);
  });
});