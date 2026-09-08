import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { StudioService } from './studio.service.js';

function prismaMock() {
  return {
    llmProvider: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    aiAgent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    businessRule: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn({ businessRule: { deleteMany: vi.fn(), createMany: vi.fn() } })),
  };
}

describe('StudioService', () => {
  it('getForUser masks the api key and flattens rules', async () => {
    const prisma = prismaMock();
    prisma.llmProvider.findFirst.mockResolvedValue({ id: 'p', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-abcdefghijkl1234', model: 'openai/gpt-4o-mini', isActive: true });
    prisma.aiAgent.findUnique.mockResolvedValue({ userId: 'u', name: 'Robot', avatar: '🤖', systemPrompt: 'hi' });
    prisma.businessRule.findMany.mockResolvedValue([{ content: 'Moeda: BRL' }, { content: 'Max 13' }]);
    const result = await new StudioService(prisma as any, {} as any).getForUser('u');
    expect(result.provider).toMatchObject({ name: 'OpenRouter', hasApiKey: true, apiKeyMasked: 'sk-…1234' });
    expect(result.provider?.apiKey).toBeUndefined();
    expect(result.rules).toEqual(['Moeda: BRL', 'Max 13']);
  });

  it('saveProvider keeps the current key when a new one is omitted', async () => {
    const prisma = prismaMock();
    prisma.llmProvider.findFirst.mockResolvedValue({ id: 'p', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-old-1234', model: 'm1', isActive: true });
    prisma.llmProvider.update.mockResolvedValue({});
    prisma.aiAgent.findUnique.mockResolvedValue(null);
    prisma.businessRule.findMany.mockResolvedValue([]);
    const svc = new StudioService(prisma as any, {} as any);
    await svc.saveProvider('u', { name: 'OpenRouter', baseUrl: 'openrouter.ai/api/v1/', model: 'm2' });
    expect(prisma.llmProvider.update).toHaveBeenCalledWith({ where: { id: 'p' }, data: expect.objectContaining({ apiKey: 'sk-old-1234', baseUrl: 'https://openrouter.ai/api/v1', model: 'm2' }) });
  });

  it('saveProvider rejects when there is no key to keep', async () => {
    const prisma = prismaMock();
    prisma.llmProvider.findFirst.mockResolvedValue(null);
    await expect(new StudioService(prisma as any, {} as any).saveProvider('u', { name: 'X', baseUrl: 'https://x.test', model: 'm' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('saveAgent creates the persona and normalizes host', async () => {
    const prisma = prismaMock();
    const created = { id: 'a', userId: 'u', name: 'Robot', avatar: '🦄', systemPrompt: 'Be strict' };
    prisma.aiAgent.findUnique.mockResolvedValueOnce(null).mockResolvedValue(created);
    prisma.aiAgent.create.mockResolvedValue(created);
    prisma.llmProvider.findFirst.mockResolvedValue(null);
    prisma.businessRule.findMany.mockResolvedValue([]);
    const svc = new StudioService(prisma as any, {} as any);
    const summary = await svc.saveAgent('u', { name: 'Robot', avatar: '🦄', systemPrompt: 'Be strict' });
    expect(prisma.aiAgent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'u', avatar: '🦄', systemPrompt: 'Be strict' }) });
    expect(summary).toMatchObject({ name: 'Robot', avatar: '🦄' });
  });

  it('saveRules replaces all rules via transaction in order', async () => {
    const prisma = prismaMock();
    const tx = { businessRule: { deleteMany: vi.fn(), createMany: vi.fn() } };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    const result = await new StudioService(prisma as any, {} as any).saveRules('u', ['  A  ', '', 'B']);
    expect(result).toEqual(['A', 'B']);
    expect(tx.businessRule.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u' } });
    expect(tx.businessRule.createMany).toHaveBeenCalledWith({ data: [{ userId: 'u', content: 'A', order: 0 }, { userId: 'u', content: 'B', order: 1 }] });
  });

  it('saveRules with empty list clears all rules', async () => {
    const prisma = prismaMock();
    const result = await new StudioService(prisma as any, {} as any).saveRules('u', ['', '   ']);
    expect(result).toEqual([]);
    expect(prisma.businessRule.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u' } });
  });

  it('testProvider returns latency on success', async () => {
    const prisma = prismaMock();
    prisma.llmProvider.findFirst.mockResolvedValue(null);
    const llm = { vote: vi.fn().mockResolvedValue({ vote: 1, justification: 'ok' }) } as any;
    const result = await new StudioService(prisma as any, llm).testProvider('u', { baseUrl: 'https://x.test/v1', apiKey: 'sk-t', model: 'm' });
    expect(result).toEqual({ ok: true, latencyMs: expect.any(Number) });
  });
});