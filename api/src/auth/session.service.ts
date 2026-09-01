import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export type RoomSession = { sessionId: string; participantId?: string; roomId?: string; isGuest: boolean };
export type AccountSession = { type: 'account'; userId: string };

@Injectable()
export class SessionService {
  private readonly secret = process.env.JWT_SECRET ?? 'change-me';
  private readonly accountTtl = process.env.ACCOUNT_SESSION_TTL ?? '12h';
  private readonly revokedAccountTokens = new Set<string>();

  issueGuest(roomId: string, participantId?: string, sessionId: string = randomUUID()) {
    const session: RoomSession = { sessionId, participantId, roomId, isGuest: true };
    return { ...session, token: jwt.sign(session, this.secret, { expiresIn: '12h' }) };
  }

  issueAccount(userId: string) {
    const session: AccountSession = { type: 'account', userId };
    const token = jwt.sign(session, this.secret, { expiresIn: this.accountTtl as SignOptions['expiresIn'] });
    const decoded = jwt.decode(token);
    const expiresAt = decoded && typeof decoded === 'object' && typeof decoded.exp === 'number'
      ? new Date(decoded.exp * 1000).toISOString()
      : new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    return { ...session, token, expiresAt };
  }

  verifyAccount(token: string): AccountSession {
    if (this.revokedAccountTokens.has(token)) throw new Error('Revoked account session');
    const payload = jwt.verify(token, this.secret);
    if (!payload || typeof payload !== 'object' || payload.type !== 'account' || typeof payload.userId !== 'string') {
      throw new Error('Invalid account session');
    }
    return payload as AccountSession;
  }

  revokeAccount(token: string) {
    this.verifyAccount(token);
    this.revokedAccountTokens.add(token);
  }

  verify(token: string): RoomSession {
    const payload = jwt.verify(token, this.secret);
    if (!payload || typeof payload !== 'object' || typeof payload.sessionId !== 'string') {
      throw new Error('Invalid room session');
    }
    return payload as RoomSession;
  }
}
