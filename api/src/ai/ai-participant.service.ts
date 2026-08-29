import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LlmClient } from './llm.client.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class AiParticipantService {
  private readonly requestsByRound = new Set<string>();
  private readonly maxRequestsPerRound = Number(process.env.LLM_MAX_REQUESTS_PER_ROUND ?? 1);

  constructor(private readonly prisma: PrismaService, private readonly llm: LlmClient) {}

  async ensureParticipant(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: { config: true, participants: true } });
    if (!room?.config?.permiteParticipantesIA) throw new BadRequestException('AI_UNAVAILABLE');
    const existing = room.participants.find((participant) => participant.isAI);
    if (existing) return existing;
    const user = await this.prisma.user.create({ data: { id: randomUUID(), name: 'Agente IA', avatarUrl: '🤖', isGuest: false } });
    return this.prisma.roomParticipant.create({ data: { roomId, userId: user.id, role: 'IA_Agente', isAI: true } });
  }

  async castVote(roomId: string, storyId: string, roundId: string) {
    if (this.requestsByRound.has(roundId) || this.maxRequestsPerRound < 1) throw new ServiceUnavailableException('AI_COST_LIMIT');
    const participant = await this.ensureParticipant(roomId);
    const [story, config, messages] = await Promise.all([
      this.prisma.story.findUnique({ where: { id: storyId } }),
      this.prisma.roomConfig.findUnique({ where: { roomId } }),
      this.prisma.chatMessage?.findMany?.({ where: { roomId, storyId }, orderBy: { createdAt: 'asc' }, take: 20 }) ?? [],
    ]);
    if (!story || story.roomId !== roomId || !config) throw new BadRequestException('INVALID_PHASE');
    const deck = config.deckValues as Array<number | string>;
    const context = (await messages).map((message: { text: string }) => message.text).join('\n').slice(-4_000);
    const result = await this.llm.vote({ story: `${story.title}\n${story.description}`, role: 'IA_Agente', context, deck });
    if (!deck.some((value) => String(value) === String(result.vote))) throw new ServiceUnavailableException('AI_INVALID_OUTPUT');
    await this.prisma.vote.upsert({ where: { voteRoundId_participantId: { voteRoundId: roundId, participantId: participant.id } }, update: { value: String(result.vote), castAt: new Date() }, create: { voteRoundId: roundId, participantId: participant.id, value: String(result.vote) } });
    this.requestsByRound.add(roundId);
    return { participantId: participant.id, participantName: 'Agente IA', value: result.vote, justification: result.justification };
  }
}
