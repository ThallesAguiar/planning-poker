import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

function prismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    roomParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  };
}

function gatewayMock() {
  return { publishParticipantProfile: vi.fn() };
}

describe('AuthService', () => {
  it('rejects duplicate email on registration', async () => {
    const prisma = prismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    const service = new AuthService(prisma as any, new SessionService());

    await expect(service.register({ email: 'ana@example.com', password: 'password123', name: 'Ana' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('hashes password and omits hash from register response', async () => {
    const prisma = prismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'ana@example.com', name: 'Ana', avatarUrl: '', passwordHash: 'hash' });
    const service = new AuthService(prisma as any, new SessionService());

    const result = await service.register({ email: 'ana@example.com', password: 'password123', name: 'Ana' });

    expect(prisma.user.create.mock.calls[0][0].data.passwordHash).not.toBe('password123');
    expect(result).toMatchObject({ user: { id: 'user-1', email: 'ana@example.com', name: 'Ana' } });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('rejects invalid login credentials', async () => {
    const prisma = prismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new AuthService(prisma as any, new SessionService());

    await expect(service.login({ email: 'ana@example.com', password: 'wrong' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('updateProfile trims and persists name, returns safe user', async () => {
    const prisma = prismaMock();
    prisma.user.update.mockResolvedValue({ id: 'user-1', email: 'ana@example.com', name: 'Ana Silva', avatarUrl: '♦', passwordHash: 'hash' });
    prisma.roomParticipant.findMany.mockResolvedValue([]);
    const service = new AuthService(prisma as any, new SessionService(), gatewayMock() as any);
    const token = new SessionService().issueAccount('user-1').token;

    const result = await service.updateProfile(token, { name: '  Ana Silva  ', avatar: '♦' });

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { name: 'Ana Silva', avatarUrl: '♦' } });
    expect(result).toEqual({ id: 'user-1', email: 'ana@example.com', name: 'Ana Silva', avatar: '♦' });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('updateProfile syncs active room participants and publishes to live rooms', async () => {
    const prisma = prismaMock();
    prisma.user.update.mockResolvedValue({ id: 'user-1', email: 'ana@example.com', name: 'Ana Silva', avatarUrl: '♦', passwordHash: 'hash' });
    prisma.roomParticipant.findMany.mockResolvedValue([
      { id: 'p-1', room: { inviteCode: 'ABC123' } },
      { id: 'p-2', room: { inviteCode: 'XYZ789' } },
    ]);
    const gateway = gatewayMock();
    const service = new AuthService(prisma as any, new SessionService(), gateway as any);
    const token = new SessionService().issueAccount('user-1').token;

    const result = await service.updateProfile(token, { name: 'Ana Silva', avatar: '♦' });

    expect(prisma.roomParticipant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'ativo' },
      data: { roomDisplayName: 'Ana Silva', roomAvatarUrl: '♦' },
    });
    expect(gateway.publishParticipantProfile).toHaveBeenCalledTimes(2);
    expect(gateway.publishParticipantProfile).toHaveBeenCalledWith('ABC123', 'p-1', { name: 'Ana Silva', avatar: '♦' });
    expect(gateway.publishParticipantProfile).toHaveBeenCalledWith('XYZ789', 'p-2', { name: 'Ana Silva', avatar: '♦' });
    expect(result.name).toBe('Ana Silva');
  });

  it('updateProfile with only avatar syncs only avatar to active rooms', async () => {
    const prisma = prismaMock();
    prisma.user.update.mockResolvedValue({ id: 'user-1', email: 'ana@example.com', name: 'Ana', avatarUrl: '♥', passwordHash: 'hash' });
    prisma.roomParticipant.findMany.mockResolvedValue([{ id: 'p-1', room: { inviteCode: 'ABC123' } }]);
    const gateway = gatewayMock();
    const service = new AuthService(prisma as any, new SessionService(), gateway as any);
    const token = new SessionService().issueAccount('user-1').token;

    await service.updateProfile(token, { avatar: '♥' });

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { avatarUrl: '♥' } });
    expect(prisma.roomParticipant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'ativo' },
      data: { roomAvatarUrl: '♥' },
    });
    expect(gateway.publishParticipantProfile).toHaveBeenCalledWith('ABC123', 'p-1', { name: undefined, avatar: '♥' });
  });

  it('updateProfile rejects empty name', async () => {
    const prisma = prismaMock();
    const service = new AuthService(prisma as any, new SessionService());
    const token = new SessionService().issueAccount('user-1').token;

    await expect(service.updateProfile(token, { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updateProfile rejects invalid account token', async () => {
    const prisma = prismaMock();
    const service = new AuthService(prisma as any, new SessionService());

    // verifyAccount propaga o erro de JWT invalido (nao e um UnauthorizedException)
    await expect(service.updateProfile('not-a-valid-token', { name: 'Ana' })).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
