import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export type RoomSession = { sessionId: string; participantId?: string; roomId?: string; isGuest: boolean };

@Injectable()
export class SessionService {
  private readonly secret = process.env.JWT_SECRET ?? 'change-me';

  issueGuest(roomId: string, participantId?: string, sessionId: string = randomUUID()) {
    const session: RoomSession = { sessionId, participantId, roomId, isGuest: true };
    return { ...session, token: jwt.sign(session, this.secret, { expiresIn: '12h' }) };
  }

  verify(token: string): RoomSession {
    const payload = jwt.verify(token, this.secret);
    if (!payload || typeof payload !== 'object' || typeof payload.sessionId !== 'string') {
      throw new Error('Invalid room session');
    }
    return payload as RoomSession;
  }
}
