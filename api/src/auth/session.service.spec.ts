import { describe, expect, it } from 'vitest';
import { SessionService } from './session.service.js';

describe('SessionService', () => {
  it('issues and verifies guest session token', () => {
    const service = new SessionService();
    const issued = service.issueGuest('room-1', 'participant-1', 'session-1');
    expect(service.verify(issued.token)).toMatchObject({ sessionId: 'session-1', roomId: 'room-1', participantId: 'participant-1', isGuest: true });
  });

  it('rejects malformed token', () => {
    expect(() => new SessionService().verify('invalid-token')).toThrow();
  });
});
