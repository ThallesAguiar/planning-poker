import { describe, expect, it, vi } from 'vitest';
import { AiParticipantService } from './ai-participant.service.js';

describe('AiParticipantService', () => {
  it('creates AI participant and persists validated vote', async () => {
    const prisma: any = {
      room: { findUnique: vi.fn().mockResolvedValue({ config: { permiteParticipantesIA: true }, participants: [] }) },
      user: { create: vi.fn().mockResolvedValue({ id: 'ai-user' }) },
      roomParticipant: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'ai-participant', userId: 'ai-user' }) },
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

  it('uses owner persona + provider + business rules from the Studio', async () => {
    const prisma: any = {
      room: { findUnique: vi.fn().mockResolvedValue({ ownerId: 'owner-participant', config: { permiteParticipantesIA: true }, participants: [] }) },
      roomParticipant: { findUnique: vi.fn().mockResolvedValue({ id: 'owner-participant', user: { id: 'owner', isGuest: false } }), create: vi.fn().mockResolvedValue({ id: 'ai-participant', userId: 'ai-user' }) },
      user: { create: vi.fn().mockResolvedValue({ id: 'ai-user' }) },
      story: { findUnique: vi.fn().mockResolvedValue({ roomId: 'room-1', title: 'Login', description: '' }) },
      roomConfig: { findUnique: vi.fn().mockResolvedValue({ deckValues: [1, 3, 5] }) },
      chatMessage: { findMany: vi.fn().mockResolvedValue([]) },
      vote: { upsert: vi.fn() },
      llmProvider: { findFirst: vi.fn().mockResolvedValue({ id: 'p', baseUrl: 'https://custom.test/v1', apiKey: 'sk-zzz', model: 'model-x' }) },
      aiAgent: { findUnique: vi.fn().mockResolvedValue({ userId: 'owner', name: 'Robot PO', avatar: '🦄', systemPrompt: 'Be strict' }) },
      businessRule: { findMany: vi.fn().mockResolvedValue([{ content: 'Moeda: BRL' }, { content: 'Max 13' }]) },
    };
    const llm = { vote: vi.fn().mockResolvedValue({ vote: 5, justification: 'ok' }) } as any;
    const result = await new AiParticipantService(prisma, llm).castVote('room-1', 'story-1', 'round-1');
    expect(result).toMatchObject({ participantName: 'Robot PO', avatar: '🦄', value: 5 });
    const run = llm.vote.mock.calls[0][1] as { options?: any; systemPrompt?: string; businessRules?: string[] };
    expect(run.options).toMatchObject({ baseUrl: 'https://custom.test/v1', apiKey: 'sk-zzz', model: 'model-x' });
    expect(run.systemPrompt).toBe('Be strict');
    expect(run.businessRules).toEqual(['Moeda: BRL', 'Max 13']);
  });

  it('falls back to env + default persona when the owner is a guest', async () => {
    const prisma = discussPrisma();
    const llm = { vote: vi.fn().mockResolvedValue({ vote: 5, justification: 'ok' }) } as any;
    const result = await new AiParticipantService(prisma as any, llm).castVote('room-1', 'story-1', 'round-1');
    expect(result).toMatchObject({ participantName: 'Agente IA', avatar: '🤖' });
    const run = llm.vote.mock.calls[0][1] as { options?: any };
    expect(run.options).toBeUndefined();
  });
});

function roomStudioPrisma(roomMesa: { agent?: any; provider?: any; rules?: any[] }, owner: { isGuest: boolean }) {
  return {
    room: { findUnique: vi.fn().mockResolvedValue({ ownerId: 'owner-participant', config: { permiteParticipantesIA: true }, participants: [] }) },
    roomAiAgent: { findUnique: vi.fn().mockResolvedValue(roomMesa.agent ?? null) },
    roomLlmProvider: { findFirst: vi.fn().mockResolvedValue(roomMesa.provider ?? null) },
    roomBusinessRule: { findMany: vi.fn().mockResolvedValue(roomMesa.rules ?? []) },
    roomParticipant: { findUnique: vi.fn().mockResolvedValue({ id: 'owner-participant', user: { id: 'owner', isGuest: owner.isGuest } }), create: vi.fn().mockResolvedValue({ id: 'ai-participant', userId: 'ai-user' }) },
    user: { create: vi.fn().mockResolvedValue({ id: 'ai-user' }) },
    story: { findUnique: vi.fn().mockResolvedValue({ roomId: 'room-1', title: 'Login', description: '' }) },
    roomConfig: { findUnique: vi.fn().mockResolvedValue({ deckValues: [1, 3, 5] }) },
    chatMessage: { findMany: vi.fn().mockResolvedValue([]) },
    vote: { upsert: vi.fn() },
    llmProvider: { findFirst: vi.fn().mockResolvedValue({ id: 'ap', baseUrl: 'https://account.test/v1', apiKey: 'sk-account', model: 'model-a' }) },
    aiAgent: { findUnique: vi.fn().mockResolvedValue({ userId: 'owner', name: 'Robot PO', avatar: '🦄', systemPrompt: 'Be strict' }) },
    businessRule: { findMany: vi.fn().mockResolvedValue([{ content: 'Moeda: BRL' }]) },
  };
}

describe('AiParticipantService precedência mesa > conta > ambiente', () => {
  async function voteRun(prisma: any, llm: any) {
    await new AiParticipantService(prisma, llm).castVote('room-1', 'story-1', 'round-1');
    return llm.vote.mock.calls[0][1] as { options?: any; systemPrompt?: string; businessRules?: string[] };
  }

  it('mesa com persona própria usa a persona da mesa sobre a conta', async () => {
    const prisma = roomStudioPrisma({ agent: { name: 'Robô da Mesa', avatar: '🃏', systemPrompt: 'Sou da mesa', responseLanguage: 'en' } }, { isGuest: false });
    const llm = { vote: vi.fn().mockResolvedValue({ vote: 5, justification: 'ok' }) } as any;
    const result = await new AiParticipantService(prisma, llm).castVote('room-1', 'story-1', 'round-1');
    expect(result).toMatchObject({ participantName: 'Robô da Mesa', avatar: '🃏' });
    const run = llm.vote.mock.calls[0][1] as { systemPrompt?: string; options?: any; businessRules?: string[]; responseLanguage?: string };
    expect(run.systemPrompt).toBe('Sou da mesa');
    expect(run.options).toMatchObject({ baseUrl: 'https://account.test/v1' });
    expect(run.responseLanguage).toBe('en');
  });

  it('mesa sem regras próprias herda as regras da conta', async () => {
    const prisma = roomStudioPrisma({ agent: { name: 'Robô da Mesa', avatar: '🃏', systemPrompt: 'Sou da mesa' }, rules: [] }, { isGuest: false });
    const llm = { vote: vi.fn().mockResolvedValue({ vote: 5, justification: 'ok' }) } as any;
    const run = await voteRun(prisma, llm);
    expect(run.businessRules).toEqual(['Moeda: BRL']);
  });

  it('mesa com regras próprias usa as da mesa, sem vazar as da conta', async () => {
    const prisma = roomStudioPrisma({ agent: { name: 'Robô da Mesa', avatar: '🃏', systemPrompt: 'Sou da mesa' }, rules: [{ content: 'Moeda: USD' }] }, { isGuest: false });
    const llm = { vote: vi.fn().mockResolvedValue({ vote: 5, justification: 'ok' }) } as any;
    const run = await voteRun(prisma, llm);
    expect(run.businessRules).toEqual(['Moeda: USD']);
  });

  it('mesa com provedor próprio usa o provedor da mesa sobre a conta', async () => {
    const prisma = roomStudioPrisma({ provider: { id: 'rp', baseUrl: 'https://mesa.test/v1', apiKey: 'sk-mesa', model: 'model-mesa' } }, { isGuest: false });
    const llm = { vote: vi.fn().mockResolvedValue({ vote: 5, justification: 'ok' }) } as any;
    const run = await voteRun(prisma, llm);
    expect(run.options).toMatchObject({ baseUrl: 'https://mesa.test/v1', apiKey: 'sk-mesa', model: 'model-mesa' });
  });

  it('dono guest com studio próprio usa a configuração da mesa (independente da conta)', async () => {
    const prisma = roomStudioPrisma({ agent: { name: 'Robô da Mesa', avatar: '🃏', systemPrompt: 'Sou da mesa' }, provider: { id: 'rp', baseUrl: 'https://mesa.test/v1', apiKey: 'sk-mesa', model: 'model-mesa' } }, { isGuest: true });
    const llm = { vote: vi.fn().mockResolvedValue({ vote: 5, justification: 'ok' }) } as any;
    const result = await new AiParticipantService(prisma, llm).castVote('room-1', 'story-1', 'round-1');
    expect(result).toMatchObject({ participantName: 'Robô da Mesa' });
    const run = llm.vote.mock.calls[0][1] as { options?: any; systemPrompt?: string };
    expect(run.options).toMatchObject({ baseUrl: 'https://mesa.test/v1', apiKey: 'sk-mesa', model: 'model-mesa' });
    expect(run.systemPrompt).toBe('Sou da mesa');
  });
});

function discussPrisma() {
  return {
    room: { findUnique: vi.fn().mockResolvedValue({ config: { permiteParticipantesIA: true }, participants: [] }) },
    user: { create: vi.fn().mockResolvedValue({ id: 'ai-user' }) },
    roomParticipant: { findUnique: vi.fn().mockResolvedValue({ id: 'owner', user: { id: 'owner-user', isGuest: true } }), create: vi.fn().mockResolvedValue({ id: 'ai-participant', userId: 'ai-user' }) },
    story: { findUnique: vi.fn().mockResolvedValue({ roomId: 'room-1', title: 'Login', description: '' }) },
    roomConfig: { findUnique: vi.fn().mockResolvedValue({ permiteParticipantesIA: true, iaDiscute: true, deckValues: [1, 3, 5, 8] }) },
    chatMessage: { findMany: vi.fn().mockResolvedValue([]) },
    vote: { upsert: vi.fn() },
  };
}
