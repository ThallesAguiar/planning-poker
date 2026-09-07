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

  it('castVote is limited to once per round via the per-action key', async () => {
    const prisma = discussPrisma();
    const llm = { vote: vi.fn().mockResolvedValue({ vote: 5, justification: 'ok' }) } as any;
    const svc = new AiParticipantService(prisma as any, llm);
    await svc.castVote('room-1', 'story-1', 'round-1');
    await expect(svc.castVote('room-1', 'story-1', 'round-1')).rejects.toThrow('AI_COST_LIMIT');
  });

  it('pullDiscussion returns a message and is limited to once per round', async () => {
    const prisma = discussPrisma();
    const llm = { discuss: vi.fn().mockResolvedValue({ message: 'Voce votou 8?' }) } as any;
    const svc = new AiParticipantService(prisma as any, llm);
    const first = await svc.pullDiscussion('room-1', 'story-1', 'round-1', [{ participantName: 'Ana', value: '8' }]);
    expect(first).toMatchObject({ participantId: 'ai-participant', message: 'Voce votou 8?' });
    const second = await svc.pullDiscussion('room-1', 'story-1', 'round-1', [{ participantName: 'Ana', value: '8' }]);
    expect(second).toBeNull();
    expect(llm.discuss).toHaveBeenCalledOnce();
  });

  it('pullDiscussion returns null when discussion is disabled or limited', async () => {
    const prisma = discussPrisma();
    prisma.roomConfig.findUnique.mockResolvedValue({ permiteParticipantesIA: true, iaDiscute: false, deckValues: [1, 3, 5] });
    const llm = { discuss: vi.fn() } as any;
    const svc = new AiParticipantService(prisma as any, llm);
    expect(await svc.pullDiscussion('room-1', 'story-1', 'round-1', [])).toBeNull();
    expect(llm.discuss).not.toHaveBeenCalled();
  });

  it('summarize returns a message and suggested next step, limited to once per round', async () => {
    const prisma = discussPrisma();
    const llm = { discuss: vi.fn().mockResolvedValue({ message: 'resumo', suggestedNextStep: 'revotar' }) } as any;
    const svc = new AiParticipantService(prisma as any, llm);
    const result = await svc.summarize('room-1', 'story-1', 'round-1', [{ participantName: 'Ana', value: '3' }]);
    expect(result).toMatchObject({ participantId: 'ai-participant', message: 'resumo', suggestedNextStep: 'revotar' });
    await expect(svc.summarize('room-1', 'story-1', 'round-1', [{ participantName: 'Ana', value: '3' }])).rejects.toThrow('AI_COST_LIMIT');
  });

  it('summarize throws AI_COST_LIMIT when the action was already used', async () => {
    const prisma = discussPrisma();
    const llm = { discuss: vi.fn().mockResolvedValue({ message: 'r', suggestedNextStep: 'revotar' }) } as any;
    const svc = new AiParticipantService(prisma as any, llm);
    await svc.summarize('room-1', 'story-1', 'round-1', []);
    await expect(svc.summarize('room-1', 'story-1', 'round-1', [])).rejects.toThrow('AI_COST_LIMIT');
  });
});

function discussPrisma() {
  return {
    room: { findUnique: vi.fn().mockResolvedValue({ config: { permiteParticipantesIA: true }, participants: [] }) },
    user: { create: vi.fn().mockResolvedValue({ id: 'ai-user' }) },
    roomParticipant: { create: vi.fn().mockResolvedValue({ id: 'ai-participant', userId: 'ai-user' }) },
    story: { findUnique: vi.fn().mockResolvedValue({ roomId: 'room-1', title: 'Login', description: '' }) },
    roomConfig: { findUnique: vi.fn().mockResolvedValue({ permiteParticipantesIA: true, iaDiscute: true, deckValues: [1, 3, 5, 8] }) },
    chatMessage: { findMany: vi.fn().mockResolvedValue([]) },
    vote: { upsert: vi.fn() },
  };
}
