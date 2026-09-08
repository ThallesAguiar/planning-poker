import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LlmClient } from './llm.client.js';
import { PrismaService } from '../prisma.service.js';

export type ProviderSummary = { name: string; baseUrl: string; model: string; isActive: boolean; hasApiKey: boolean; apiKeyMasked: string };
export type AgentSummary = { name: string; avatar: string; systemPrompt: string };
export type StudioSnapshot = { provider: ProviderSummary | null; agent: AgentSummary | null; rules: string[] };

const maskApiKey = (key: string) => (key.length <= 6 ? '••••' : `${key.slice(0, 3)}…${key.slice(-4)}`);

/** Garante protocolo + remove barra final: "openrouter.ai/api/v1/" -> "https://openrouter.ai/api/v1". */
const normalizeBaseUrl = (url: string) => {
  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/$/, '');
};

@Injectable()
export class StudioService {
  constructor(private readonly prisma: PrismaService, private readonly llm: LlmClient) {}

  async getForUser(userId: string): Promise<StudioSnapshot> {
    const [provider, agent, rules] = await Promise.all([
      this.prisma.llmProvider.findFirst({ where: { userId } }),
      this.prisma.aiAgent.findUnique({ where: { userId } }),
      this.prisma.businessRule.findMany({ where: { userId }, orderBy: { order: 'asc' }, select: { content: true } }),
    ]);
    return {
      provider: provider ? { name: provider.name, baseUrl: provider.baseUrl, model: provider.model, isActive: provider.isActive, hasApiKey: Boolean(provider.apiKey), apiKeyMasked: maskApiKey(provider.apiKey) } : null,
      agent: agent ? { name: agent.name, avatar: agent.avatar, systemPrompt: agent.systemPrompt } : null,
      rules: rules.map((rule) => rule.content),
    };
  }

  /** Upsert manual: guarda a chave atual se o novo apiKey vier vazio. */
  async saveProvider(userId: string, input: { name: string; baseUrl: string; apiKey?: string; model: string; isActive?: boolean }): Promise<ProviderSummary | null> {
    const existing = await this.prisma.llmProvider.findFirst({ where: { userId } });
    const apiKey = input.apiKey || existing?.apiKey;
    if (!apiKey) throw new BadRequestException('INVALID_INPUT');
    const data = { name: input.name, baseUrl: normalizeBaseUrl(input.baseUrl), apiKey, model: input.model, isActive: input.isActive ?? true };
    if (existing) {
      await this.prisma.llmProvider.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.llmProvider.create({ data: { userId, ...data } });
    }
    const snapshot = await this.getForUser(userId);
    return snapshot.provider;
  }

  async saveAgent(userId: string, input: { name: string; avatar?: string; systemPrompt?: string }): Promise<AgentSummary | null> {
    const existing = await this.prisma.aiAgent.findUnique({ where: { userId } });
    const data = {
      name: input.name,
      avatar: input.avatar ?? '🤖',
      systemPrompt: input.systemPrompt ?? existing?.systemPrompt ?? '',
    };
    if (existing) {
      await this.prisma.aiAgent.update({ where: { userId }, data });
    } else {
      await this.prisma.aiAgent.create({ data: { userId, ...data } });
    }
    const snapshot = await this.getForUser(userId);
    return snapshot.agent;
  }

  async saveRules(userId: string, contents: string[]): Promise<string[]> {
    const cleaned = contents.map((content) => content.trim()).filter(Boolean);
    if (cleaned.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.businessRule.deleteMany({ where: { userId } });
        await tx.businessRule.createMany({ data: cleaned.map((content, order) => ({ userId, content, order })) });
      });
    } else {
      await this.prisma.businessRule.deleteMany({ where: { userId } });
    }
    return cleaned;
  }

  /** Dispara uma chamada mínima de votação para validar credencial/host/modelo. Senha válida => ok + latência. */
  async testProvider(userId: string, input: { baseUrl?: string; apiKey?: string; model?: string }): Promise<{ ok: true; latencyMs: number }> {
    const existing = await this.prisma.llmProvider.findFirst({ where: { userId } });
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