import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service.js';
import { SessionService } from './session.service.js';
import type { AuthResponse, SafeAuthUser } from './auth.dto.js';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService) {}

  async register(input: { email: string; password: string; name: string; avatar?: string; claimGuestSessionToken?: string }): Promise<AuthResponse> {
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

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
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

  logout(token: string) {
    this.sessions.revokeAccount(token);
  }

  private async withSession(user: { id: string; email: string | null; name: string; avatarUrl: string | null }): Promise<AuthResponse> {
    const session = this.sessions.issueAccount(user.id);
    return { user: this.safeUser(user), token: session.token, expiresAt: session.expiresAt };
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
