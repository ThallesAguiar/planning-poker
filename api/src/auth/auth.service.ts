import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { SessionService } from './session.service.js';
import { RoomGateway } from '../room.gateway.js';
import type { AuthResponse, SafeAuthUser } from './auth.dto.js';

const normalizeEmail = (email: string) => email.trim().toLowerCase();
type AuthSessionWithRefresh = AuthResponse & { refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly roomGateway: RoomGateway,
  ) {}

  async register(input: { email: string; password: string; name: string; avatar?: string; claimGuestSessionToken?: string }): Promise<AuthSessionWithRefresh> {
    const email = normalizeEmail(input.email);
    if (input.password.length < 8) throw new BadRequestException('INVALID_INPUT');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('EMAIL_ALREADY_EXISTS');

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: input.name.trim(),
        avatarUrl: input.avatar ?? '',
        isGuest: false,
      },
    });

    if (input.claimGuestSessionToken) {
      await this.claimGuestMembership(input.claimGuestSessionToken, user.id);
    }

    return this.withSession(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthSessionWithRefresh> {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(input.email) } });
    if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }
    return this.withSession(user);
  }

  async me(token: string): Promise<SafeAuthUser> {
    const account = this.sessions.verifyAccount(token);
    const user = await this.prisma.user.findUnique({ where: { id: account.userId } });
    if (!user || user.isGuest || !user.email) throw new UnauthorizedException('UNAUTHENTICATED');
    return this.safeUser(user);
  }

  async updateProfile(token: string, input: { name?: string; avatar?: string }): Promise<SafeAuthUser> {
    const account = this.sessions.verifyAccount(token);
    const name = input.name?.trim();
    if (input.name !== undefined && !name) throw new BadRequestException('INVALID_INPUT');
    const user = await this.prisma.user.update({
      where: { id: account.userId },
      data: { ...(name !== undefined ? { name } : {}), ...(input.avatar !== undefined ? { avatarUrl: input.avatar } : {}) },
    });
    if (!user || user.isGuest || !user.email) throw new UnauthorizedException('UNAUTHENTICATED');
    if (name !== undefined || input.avatar !== undefined) {
      await this.syncActiveRooms(user.id, { name, avatar: input.avatar });
    }
    return this.safeUser(user);
  }

  async refresh(refreshToken: string): Promise<AuthSessionWithRefresh> {
    const stored = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.refreshTokenHash(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || stored.user.isGuest || !stored.user.email) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }
    await this.prisma.refreshSession.update({ where: { id: stored.id }, data: { revokedAt: new Date(), rotatedAt: new Date() } });
    return this.withSession(stored.user);
  }

  /** Propaga nome/avatar da conta para os participantes ativos do usuario e notifica as salas em tempo real. */
  private async syncActiveRooms(userId: string, patch: { name?: string; avatar?: string }) {
    const memberships = await this.prisma.roomParticipant.findMany({
      where: { userId, status: 'ativo' },
      include: { room: { select: { inviteCode: true } } },
    });
    if (memberships.length === 0) return;
    await this.prisma.roomParticipant.updateMany({
      where: { userId, status: 'ativo' },
      data: { ...(patch.name !== undefined ? { roomDisplayName: patch.name } : {}), ...(patch.avatar !== undefined ? { roomAvatarUrl: patch.avatar } : {}) },
    });
    for (const membership of memberships) {
      this.roomGateway.publishParticipantProfile(membership.room.inviteCode, membership.id, patch);
    }
  }

  async logout(token?: string, refreshToken?: string) {
    if (token) {
      try {
        this.sessions.revokeAccount(token);
      } catch {
        // Expired access tokens cannot block refresh-session revocation.
      }
    }
    if (refreshToken) {
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash: this.refreshTokenHash(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async withSession(user: { id: string; email: string | null; name: string; avatarUrl: string | null }): Promise<AuthSessionWithRefresh> {
    const session = this.sessions.issueAccount(user.id);
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshDays = Number(process.env.REFRESH_SESSION_TTL_DAYS ?? 30);
    const expiresAt = new Date(Date.now() + Math.max(1, refreshDays) * 24 * 60 * 60 * 1000);
    await this.prisma.refreshSession.create({ data: { userId: user.id, tokenHash: this.refreshTokenHash(refreshToken), expiresAt } });
    return { user: this.safeUser(user), token: session.token, expiresAt: session.expiresAt, refreshToken };
  }

  private refreshTokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private safeUser(user: { id: string; email: string | null; name: string; avatarUrl: string | null }): SafeAuthUser {
    if (!user.email) throw new UnauthorizedException('UNAUTHENTICATED');
    return { id: user.id, email: user.email, name: user.name, avatar: user.avatarUrl ?? '' };
  }

  private async claimGuestMembership(token: string, accountUserId: string) {
    const session = this.sessions.verify(token);
    if (!session.participantId || !session.roomId || !session.isGuest) return;
    const participant = await this.prisma.roomParticipant.findUnique({ where: { id: session.participantId } });
    if (!participant || participant.roomId !== session.roomId) return;
    const existing = await this.prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: participant.roomId, userId: accountUserId } },
    });
    if (existing) {
      await this.prisma.roomParticipant.delete({ where: { id: participant.id } });
      return;
    }
    await this.prisma.roomParticipant.update({ where: { id: participant.id }, data: { userId: accountUserId, lastSeenAt: new Date() } });
  }
}
