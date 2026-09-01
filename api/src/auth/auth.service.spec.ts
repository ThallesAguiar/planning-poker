import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

function prismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    roomParticipant: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
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
});
