import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { RoomStudioService } from './room-studio.service.js';

function prismaMock() {
  return {
    roomLlmProvider: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    roomAiAgent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    roomBusinessRule: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    llmProvider: { findFirst: vi.fn() },
    aiAgent: { findUnique: vi.fn() },
    businessRule: { findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn({ roomBusinessRule: { deleteMany: vi.fn(), createMany: vi.fn() } })),
  };
}

describe('RoomStudioService', () => {
  it('getForRoom masks the api key and flattens rules', async () => {
    const prisma = prismaMock();
    prisma.roomLlmProvider.findFirst.mockResolvedValue({ id: 'p', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-abcdefghijkl1234', model: 'openai/gpt-4o-mini', isActive: true });
    prisma.roomAiAgent.findUnique.mockResolvedValue({ roomId: 'r', name: 'Robot', avatar: '🤖', systemPrompt: 'hi' });
    prisma.roomBusinessRule.findMany.mockResolvedValue([{ content: 'Moeda: BRL' }, { content: 'Max 13' }]);
    const result = await new RoomStudioService(prisma as any, {} as any).getForRoom('r');
    expect(result.provider).toMatchObject({ name: 'OpenRouter', hasApiKey: true, apiKeyMasked: 'sk-…1234' });
    expect(result.provider?.apiKey).toBeUndefined();
    expect(result.agent).toMatchObject({ name: 'Robot', avatar: '🤖', systemPrompt: 'hi' });
    expect(result.rules).toEqual(['Moeda: BRL', 'Max 13']);
  });

  it('getForRoom returns empty snapshot when nothing configured', async () => {
    const prisma = prismaMock();
    prisma.roomLlmProvider.findFirst.mockResolvedValue(null);
    prisma.roomAiAgent.findUnique.mockResolvedValue(null);
    prisma.roomBusinessRule.findMany.mockResolvedValue([]);
    const result = await new RoomStudioService(prisma as any, {} as any).getForRoom('r');
    expect(result).toMatchObject({ provider: null, agent: null, rules: [], sources: { provider: 'system', agent: 'system', rules: 'system' } });
  });

  it('saveProvider keeps the current key when a new one is omitted', async () => {
    const prisma = prismaMock();
    prisma.roomLlmProvider.findFirst.mockResolvedValue({ id: 'p', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-old-1234', model: 'm1', isActive: true });
    prisma.roomLlmProvider.update.mockResolvedValue({ id: 'p', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-old-1234', model: 'm2', isActive: true });
    const svc = new RoomStudioService(prisma as any, {} as any);
    await svc.saveProvider('r', { name: 'OpenRouter', baseUrl: 'openrouter.ai/api/v1/', model: 'm2' });
    expect(prisma.roomLlmProvider.update).toHaveBeenCalledWith({ where: { id: 'p' }, data: expect.objectContaining({ apiKey: 'sk-old-1234', baseUrl: 'https://openrouter.ai/api/v1', model: 'm2' }) });
  });

  it('saveProvider creates when none exists', async () => {
    const prisma = prismaMock();
    prisma.roomLlmProvider.findFirst.mockResolvedValue(null);
    prisma.roomLlmProvider.create.mockResolvedValue({ id: 'p', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-new', model: 'm', isActive: true });
    const svc = new RoomStudioService(prisma as any, {} as any);
    await svc.saveProvider('r', { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-new', model: 'm' });
    expect(prisma.roomLlmProvider.create).toHaveBeenCalledWith({ data: expect.objectContaining({ roomId: 'r', apiKey: 'sk-new' }) });
  });

  it('saveProvider rejects when there is no key to keep', async () => {
    const prisma = prismaMock();
    prisma.roomLlmProvider.findFirst.mockResolvedValue(null);
    await expect(new RoomStudioService(prisma as any, {} as any).saveProvider('r', { name: 'X', baseUrl: 'https://x.test', model: 'm' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('saveAgent creates the persona', async () => {
    const prisma = prismaMock();
    const created = { id: 'a', roomId: 'r', name: 'Robot', avatar: '🃏', systemPrompt: 'Be strict' };
    prisma.roomAiAgent.findUnique.mockResolvedValue(null);
    prisma.roomAiAgent.create.mockResolvedValue(created);
    const summary = await new RoomStudioService(prisma as any, {} as any).saveAgent('r', { name: 'Robot', avatar: '🃏', systemPrompt: 'Be strict' });
    expect(prisma.roomAiAgent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ roomId: 'r', avatar: '🃏' }) });
    expect(summary).toMatchObject({ name: 'Robot', avatar: '🃏' });
  });

  it('defaults room agent language to Brazilian Portuguese', async () => {
    const prisma = prismaMock();
    prisma.roomAiAgent.findUnique.mockResolvedValue(null);
    prisma.roomAiAgent.create.mockResolvedValue({ roomId: 'r', name: 'Agente', avatar: 'A', systemPrompt: '', responseLanguage: 'pt-BR' });
    await new RoomStudioService(prisma as any, {} as any).saveAgent('r', { name: 'Agente' });
    expect(prisma.roomAiAgent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ responseLanguage: 'pt-BR' }) });
  });

  it('saveRules replaces all rules via transaction in order', async () => {
    const prisma = prismaMock();
    const tx = { roomBusinessRule: { deleteMany: vi.fn(), createMany: vi.fn() } };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    const result = await new RoomStudioService(prisma as any, {} as any).saveRules('r', ['  A  ', '', 'B']);
    expect(result).toEqual(['A', 'B']);
    expect(tx.roomBusinessRule.deleteMany).toHaveBeenCalledWith({ where: { roomId: 'r' } });
    expect(tx.roomBusinessRule.createMany).toHaveBeenCalledWith({ data: [{ roomId: 'r', content: 'A', order: 0 }, { roomId: 'r', content: 'B', order: 1 }] });
  });

  it('saveRules with empty list clears all rules', async () => {
    const prisma = prismaMock();
    const result = await new RoomStudioService(prisma as any, {} as any).saveRules('r', ['', '   ']);
    expect(result).toEqual([]);
    expect(prisma.roomBusinessRule.deleteMany).toHaveBeenCalledWith({ where: { roomId: 'r' } });
  });

  it('testProvider returns latency on success', async () => {
    const prisma = prismaMock();
    prisma.roomLlmProvider.findFirst.mockResolvedValue(null);
    const llm = { vote: vi.fn().mockResolvedValue({ vote: 1, justification: 'ok' }) } as any;
    const result = await new RoomStudioService(prisma as any, llm).testProvider('r', { baseUrl: 'https://x.test/v1', apiKey: 'sk-t', model: 'm' });
    expect(result).toEqual({ ok: true, latencyMs: expect.any(Number) });
  });
});
