import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LlmClient } from './llm.client.js';
import { PrismaService } from '../prisma.service.js';
import { maskApiKey, normalizeBaseUrl } from './studio-utils.js';
import type { AgentSummary, ProviderSummary, StudioSnapshot } from './studio.service.js';

const snapshotProvider = (provider: { id: string; name: string; baseUrl: string; model: string; isActive: boolean; apiKey: string }) => ({
  name: provider.name,
  baseUrl: provider.baseUrl,
  model: provider.model,
  isActive: provider.isActive,
  hasApiKey: Boolean(provider.apiKey),
  apiKeyMasked: maskApiKey(provider.apiKey),
});

@Injectable()
export class RoomStudioService {
  constructor(private readonly prisma: PrismaService, private readonly llm: LlmClient) {}

  async getForRoom(roomId: string): Promise<StudioSnapshot> {
    const prisma = this.prisma as any;
    const [provider, agent, rules] = await Promise.all([
      prisma.roomLlmProvider?.findFirst?.({ where: { roomId } }) ?? Promise.resolve(null),
      prisma.roomAiAgent?.findUnique?.({ where: { roomId } }) ?? Promise.resolve(null),
      prisma.roomBusinessRule?.findMany?.({ where: { roomId }, orderBy: { order: 'asc' }, select: { content: true } }) ?? Promise.resolve([]),
    ]);
    return {
      provider: provider ? snapshotProvider(provider) : null,
      agent: agent ? { name: agent.name, avatar: agent.avatar, systemPrompt: agent.systemPrompt } : null,
      rules: rules.map((rule: { content: string }) => rule.content),
    };
  }

  /** Upsert manual: guarda a chave atual se o novo apiKey vier vazio. */
  async saveProvider(roomId: string, input: { name: string; baseUrl: string; apiKey?: string; model: string; isActive?: boolean }): Promise<ProviderSummary | null> {
    const prisma = this.prisma as any;
    const existing = await prisma.roomLlmProvider?.findFirst?.({ where: { roomId } });
    const apiKey = input.apiKey || existing?.apiKey;
    if (!apiKey) throw new BadRequestException('INVALID_INPUT');
    const data = { name: input.name, baseUrl: normalizeBaseUrl(input.baseUrl), apiKey, model: input.model, isActive: input.isActive ?? true };
    const saved = existing
      ? await prisma.roomLlmProvider.update({ where: { id: existing.id }, data })
      : await prisma.roomLlmProvider.create({ data: { roomId, ...data } });
    return snapshotProvider(saved);
  }

  async saveAgent(roomId: string, input: { name: string; avatar?: string; systemPrompt?: string }): Promise<AgentSummary | null> {
    const existing = await this.prisma.roomAiAgent.findUnique({ where: { roomId } });
    const data = {
      name: input.name,
      avatar: input.avatar ?? '🤖',
      systemPrompt: input.systemPrompt ?? existing?.systemPrompt ?? '',
    };
    let saved: { name: string; avatar: string; systemPrompt: string };
    if (existing) {
      saved = await this.prisma.roomAiAgent.update({ where: { roomId }, data });
    } else {
      saved = await this.prisma.roomAiAgent.create({ data: { roomId, ...data } });
    }
    return { name: saved.name, avatar: saved.avatar, systemPrompt: saved.systemPrompt };
  }

  async saveRules(roomId: string, contents: string[]): Promise<string[]> {
    const cleaned = contents.map((content) => content.trim()).filter(Boolean);
    if (cleaned.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.roomBusinessRule.deleteMany({ where: { roomId } });
        await tx.roomBusinessRule.createMany({ data: cleaned.map((content, order) => ({ roomId, content, order })) });
      });
    } else {
      await this.prisma.roomBusinessRule.deleteMany({ where: { roomId } });
    }
    return cleaned;
  }

  /** Dispara uma chamada mínima de votação para validar credencial/host/modelo. Senha válida => ok + latência. */
  async testProvider(roomId: string, input: { baseUrl?: string; apiKey?: string; model?: string }): Promise<{ ok: true; latencyMs: number }> {
    const prisma = this.prisma as any;
    const existing = await prisma.roomLlmProvider?.findFirst?.({ where: { roomId } });
    const options = {
      baseUrl: input.baseUrl || existing?.baseUrl || undefined,
      apiKey: input.apiKey || existing?.apiKey || undefined,
      model: input.model || existing?.model || undefined,
    };
    const started = Date.now();
    try {
      await this.llm.vote({ story: 'Teste de conexão', role: 'Dev', deck: [1, 3, 5] }, { options });
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI_PROVIDER_ERROR';
      throw new ServiceUnavailableException(message);
    }
  }
}