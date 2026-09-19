import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LlmClient, type LlmRunConfig } from './llm.client.js';
import { PrismaService } from '../prisma.service.js';

const DEFAULT_AGENT = { name: 'Agente IA', avatar: '🤖', systemPrompt: 'Você é um participante especialista em planning poker. Analise histórias, vote de forma realista usando o deck e explique estimativas.' };
const DEFAULT_RESPONSE_LANGUAGE = 'pt-BR' as const;

type RoomAiContext = {
  agent: { name: string; avatar: string; systemPrompt: string; responseLanguage: 'pt-BR' | 'en' };
  run: LlmRunConfig;
};

@Injectable()
export class AiParticipantService {
  private readonly requestsByRound = new Set<string>();
  private readonly maxRequestsPerRound = Number(process.env.LLM_MAX_REQUESTS_PER_ROUND ?? 1);

  constructor(private readonly prisma: PrismaService, private readonly llm: LlmClient) {}

  /** Resolve persona + credentials da mesa (Studio por-sala) com precedência granular por recurso:
   * mesa -> conta do dono -> padrões de ambiente. A mesa com studio próprio funciona mesmo sem conta real. */
  private async resolveRoomAiContext(roomId: string): Promise<RoomAiContext> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { ownerId: true } });

    const [roomAgent, roomProvider, roomRules] = await Promise.all([
      (this.prisma as any).roomAiAgent?.findUnique?.({ where: { roomId } }) ?? Promise.resolve(undefined),
      (this.prisma as any).roomLlmProvider?.findFirst?.({ where: { roomId, isActive: true } }) ?? Promise.resolve(undefined),
      (this.prisma as any).roomBusinessRule?.findMany?.({ where: { roomId }, orderBy: { order: 'asc' } }) ?? Promise.resolve([] as { content: string }[]),
    ]);

    const owner = room ? await this.prisma.roomParticipant.findUnique({ where: { id: room.ownerId }, include: { user: true } }) : null;
    const ownerUser = owner?.user;
    const ownerReal = Boolean(ownerUser && !ownerUser.isGuest);

    let accountProvider: { baseUrl: string; apiKey: string; model: string } | null = null;
    let accountAgent: { name?: string; avatar?: string; systemPrompt?: string; responseLanguage?: string } | null = null;
    let accountRules: { content: string }[] = [];
    if (ownerReal && ownerUser) {
      [accountProvider, accountAgent, accountRules] = await Promise.all([
        this.prisma.llmProvider.findFirst({ where: { userId: ownerUser.id, isActive: true } }),
        this.prisma.aiAgent.findUnique({ where: { userId: ownerUser.id } }),
        this.prisma.businessRule.findMany({ where: { userId: ownerUser.id }, orderBy: { order: 'asc' } }),
      ]);
    }

    const responseLanguage: 'pt-BR' | 'en' = roomAgent?.responseLanguage === 'en' || accountAgent?.responseLanguage === 'en' ? 'en' : DEFAULT_RESPONSE_LANGUAGE;
    const agent = {
      name: roomAgent?.name || accountAgent?.name || DEFAULT_AGENT.name,
      avatar: roomAgent?.avatar || accountAgent?.avatar || DEFAULT_AGENT.avatar,
      systemPrompt: roomAgent?.systemPrompt || accountAgent?.systemPrompt || DEFAULT_AGENT.systemPrompt,
      responseLanguage,
    };
    const provider = roomProvider ?? accountProvider;
    const roomRuleItems: string[] = roomRules && roomRules.length > 0 ? roomRules.map((rule: { content: string }) => rule.content) : [];
    const rules = roomRuleItems.length > 0 ? roomRuleItems : accountRules.map((rule) => rule.content);

    return {
      agent,
      run: {
        options: provider ? { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: provider.model } : undefined,
        systemPrompt: agent.systemPrompt !== DEFAULT_AGENT.systemPrompt ? agent.systemPrompt : undefined,
        responseLanguage: agent.responseLanguage,
        businessRules: rules,
      },
    };
  }

  async ensureParticipant(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: { config: true, participants: true } });
    if (!room?.config?.permiteParticipantesIA) throw new BadRequestException('AI_UNAVAILABLE');
    const { agent } = await this.resolveRoomAiContext(roomId);
    const existing = room.participants.find((participant) => participant.isAI);
    if (existing) {
      if (existing.roomDisplayName !== agent.name || existing.roomAvatarUrl !== agent.avatar) {
        return this.prisma.roomParticipant.update({
          where: { id: existing.id },
          data: { roomDisplayName: agent.name, roomAvatarUrl: agent.avatar },
        });
      }
      return existing;
    }
    const user = await this.prisma.user.create({ data: { id: randomUUID(), name: agent.name, avatarUrl: agent.avatar, isGuest: false } });
    return this.prisma.roomParticipant.create({ data: { roomId, userId: user.id, role: 'IA_Agente', isAI: true, roomDisplayName: agent.name, roomAvatarUrl: agent.avatar } });
  }

  async castVote(roomId: string, storyId: string, roundId: string) {
    if (this.requestsByRound.has(`${roundId}:vote`) || this.maxRequestsPerRound < 1) throw new ServiceUnavailableException('AI_COST_LIMIT');
    const participant = await this.ensureParticipant(roomId);
    const [story, config, context] = await Promise.all([
      this.prisma.story.findUnique({ where: { id: storyId } }),
      this.prisma.roomConfig.findUnique({ where: { roomId } }),
      this.loadMessagesContext(roomId, storyId, 20),
    ]);
    if (!story || story.roomId !== roomId || !config) throw new BadRequestException('INVALID_PHASE');
    const deck = config.deckValues as Array<number | string>;
    const { agent, run } = await this.resolveRoomAiContext(roomId);
    const result = await this.llm.vote({ story: `${story.title}\n${story.description}`, role: 'IA_Agente', context, deck }, run);
    if (!deck.some((value) => String(value) === String(result.vote))) throw new ServiceUnavailableException('AI_INVALID_OUTPUT');
    await this.prisma.vote.upsert({ where: { voteRoundId_participantId: { voteRoundId: roundId, participantId: participant.id } }, update: { value: String(result.vote), castAt: new Date() }, create: { voteRoundId: roundId, participantId: participant.id, value: String(result.vote) } });
    this.requestsByRound.add(`${roundId}:vote`);
    return { participantId: participant.id, participantName: agent.name, avatar: agent.avatar, value: result.vote, justification: result.justification };
  }

  async pullDiscussion(roomId: string, storyId: string, roundId: string, votes: { participantName: string; value: string; justification?: string | null }[]): Promise<{ participantId: string; participantName: string; avatar: string; message: string } | null> {
    const config = await this.prisma.roomConfig.findUnique({ where: { roomId } });
    if (!config?.permiteParticipantesIA || !config.iaDiscute || this.requestsByRound.has(`${roundId}:pull`) || this.maxRequestsPerRound < 1) return null;
    const participant = await this.ensureParticipant(roomId).catch(() => null);
    if (!participant) return null;
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.roomId !== roomId) return null;
    const deck = config.deckValues as Array<number | string>;
    const { agent, run } = await this.resolveRoomAiContext(roomId);
    const result = await this.llm.discuss({ action: 'pull', story: `${story.title}\n${story.description}`, votes, deck }, run);
    this.requestsByRound.add(`${roundId}:pull`);
    return { participantId: participant.id, participantName: agent.name, avatar: agent.avatar, message: result.message };
  }

  async summarize(roomId: string, storyId: string, roundId: string, votes: { participantName: string; value: string; justification?: string | null }[]): Promise<{ participantId: string; participantName: string; avatar: string; message: string; suggestedNextStep: string }> {
    if (this.requestsByRound.has(`${roundId}:summarize`) || this.maxRequestsPerRound < 1) throw new ServiceUnavailableException('AI_COST_LIMIT');
    const participant = await this.ensureParticipant(roomId);
    const [story, config, context] = await Promise.all([
      this.prisma.story.findUnique({ where: { id: storyId } }),
      this.prisma.roomConfig.findUnique({ where: { roomId } }),
      this.loadMessagesContext(roomId, storyId, 40),
    ]);
    if (!story || story.roomId !== roomId || !config) throw new BadRequestException('INVALID_PHASE');
    const deck = config.deckValues as Array<number | string>;
    const { agent, run } = await this.resolveRoomAiContext(roomId);
    const result = await this.llm.discuss({ action: 'summarize', story: `${story.title}\n${story.description}`, votes, context, deck }, run);
    this.requestsByRound.add(`${roundId}:summarize`);
    return { participantId: participant.id, participantName: agent.name, avatar: agent.avatar, message: result.message, suggestedNextStep: result.suggestedNextStep ?? '' };
  }

  private async loadMessagesContext(roomId: string, storyId: string, take: number): Promise<string> {
    const messages = await this.prisma.chatMessage?.findMany?.({ where: { roomId, storyId }, orderBy: { createdAt: 'asc' }, take }) ?? [];
    return messages.map((message: { text: string }) => message.text).join('\n').slice(-4_000);
  }
}
