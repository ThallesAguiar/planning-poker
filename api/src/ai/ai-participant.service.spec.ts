import { describe, expect, it, vi } from 'vitest';
import { AiParticipantService } from './ai-participant.service.js';

describe('AiParticipantService', () => {
  it('creates AI participant and persists validated vote', async () => {
    const prisma: any = {
      room: { findUnique: vi.fn().mockResolvedValue({ config: { permiteParticipantesIA: true }, participants: [] }) },
      user: { create: vi.fn().mockResolvedValue({ id: 'ai-user' }) },
      roomParticipant: { create: vi.fn().mockResolvedValue({ id: 'ai-participant', userId: 'ai-user' }) },
      story: { findUnique: vi.fn().mockResolvedValue({ roomId: 'room-1', title: 'Login', description: '' }) },
      roomConfig: { findUnique: vi.fn().mockResolvedValue({ deckValues: [1, 3, 5] }) },
      vote: { upsert: vi.fn() },
    };
    const anthropic = { vote: vi.fn().mockResolvedValue({ vote: 5, justification: 'moderate' }) } as any;
    const result = await new AiParticipantService(prisma, anthropic).castVote('room-1', 'story-1', 'round-1');
    expect(result).toMatchObject({ participantId: 'ai-participant', value: 5 });
    expect(prisma.vote.upsert).toHaveBeenCalledOnce();
  });
});
