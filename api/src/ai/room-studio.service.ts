import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LlmClient } from './llm.client.js';
import { PrismaService } from '../prisma.service.js';
import { maskApiKey, normalizeBaseUrl } from './studio-utils.js';
import type { AgentSummary, ProviderSummary, StudioSnapshot } from './studio.service.js';

type StudioSource = 'room' | 'account' | 'system';
export type RoomStudioSnapshot = StudioSnapshot & {
  account: StudioSnapshot;
  sources: { provider: StudioSource; agent: StudioSource; rules: StudioSource };
};

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

  async getForRoom(roomId: string, ownerUserId: string): Promise<RoomStudioSnapshot> {
    const prisma = this.prisma as any;
    const [provider, agent, rules, accountProvider, accountAgent, accountRules] = await Promise.all([
      prisma.roomLlmProvider?.findFirst?.({ where: { roomId } }) ?? Promise.resolve(null),
      prisma.roomAiAgent?.findUnique?.({ where: { roomId } }) ?? Promise.resolve(null),
      prisma.roomBusinessRule?.findMany?.({ where: { roomId }, orderBy: { order: 'asc' }, select: { content: true } }) ?? Promise.resolve([]),
      typeof ownerUserId === 'string' ? this.prisma.llmProvider.findFirst({ where: { userId: ownerUserId, isActive: true } }) : Promise.resolve(null),
      this.prisma.aiAgent.findUnique({ where: { userId: ownerUserId } }),
      this.prisma.businessRule.findMany({ where: { userId: ownerUserId }, orderBy: { order: 'asc' }, select: { content: true } }),
    ]);
    const roomRules = (rules ?? []).map((rule: { content: string }) => rule.content);
    const accountRulesText = (accountRules ?? []).map((rule: { content: string }) => rule.content);
    return {
      provider: provider ? snapshotProvider(provider) : null,
      agent: agent ? { name: agent.name, avatar: agent.avatar, systemPrompt: agent.systemPrompt } : null,
      rules: roomRules,
      account: {
        provider: accountProvider ? snapshotProvider(accountProvider) : null,
        agent: accountAgent ? { name: accountAgent.name, avatar: accountAgent.avatar, systemPrompt: accountAgent.systemPrompt } : null,
        rules: accountRulesText,
      },
      sources: {
        provider: provider ? 'room' : accountProvider ? 'account' : 'system',
        agent: agent ? 'room' : accountAgent ? 'account' : 'system',
        rules: roomRules.length > 0 ? 'room' : accountRulesText.length > 0 ? 'account' : 'system',
      },
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
  async inheritProvider(roomId: string): Promise<void> {
    const prisma = this.prisma as any;
    await prisma.roomLlmProvider?.deleteMany?.({ where: { roomId } });
  }

  async inheritAgent(roomId: string): Promise<void> {
    await this.prisma.roomAiAgent.deleteMany({ where: { roomId } });
  }

  async inheritRules(roomId: string): Promise<void> {
    await this.prisma.roomBusinessRule.deleteMany({ where: { roomId } });
  }

  async testProvider(roomId: string, ownerUserId: string | { baseUrl?: string; apiKey?: string; model?: string }, input?: { baseUrl?: string; apiKey?: string; model?: string }): Promise<{ ok: true; latencyMs: number }> {
    const prisma = this.prisma as any;
    const providerInput = input ?? (typeof ownerUserId === 'string' ? {} : ownerUserId);
    const [existing, accountProvider] = await Promise.all([
      prisma.roomLlmProvider?.findFirst?.({ where: { roomId } }) ?? Promise.resolve(null),
      typeof ownerUserId === 'string' ? this.prisma.llmProvider.findFirst({ where: { userId: ownerUserId, isActive: true } }) : Promise.resolve(null),
    ]);
    const options = {
      baseUrl: providerInput.baseUrl || existing?.baseUrl || accountProvider?.baseUrl || undefined,
      apiKey: providerInput.apiKey || existing?.apiKey || accountProvider?.apiKey || undefined,
      model: providerInput.model || existing?.model || accountProvider?.model || undefined,
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
