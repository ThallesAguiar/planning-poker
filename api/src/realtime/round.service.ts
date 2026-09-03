import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { TimerService } from './timer.service.js';
import type {
  InternalRoomState,
  InternalParticipant,
  InternalVote,
  RoundEmitter,
  ActionResult,
} from './room.types.js';
import type {
  RoomState,
  RoomPhase,
  TimerType,
  VoteValue,
} from '@planning-poker/shared-types';

@Injectable()
export class RoundService {
  private emitter: RoundEmitter = { to: () => undefined, broadcast: () => undefined };

  constructor(private readonly prisma: PrismaService, private readonly timers: TimerService) {}

  setEmitter(emitter: RoundEmitter) {
    if (emitter) this.emitter = emitter;
  }

  toPublicState(state: InternalRoomState): RoomState {
    const masked = state.phase === 'votacao' || state.phase === 'lobby';
    const votes: InternalVote[] = masked
      ? state.votes.map((vote) => ({ ...vote, value: '?' as VoteValue }))
      : state.votes.map((vote) =>
          state.config.votoAnonimo ? { ...vote, participantName: 'Participante' } : vote,
        );
    return {
      roomId: state.roomId,
      name: state.name,
      code: state.code,
      status: state.status,
      visibility: state.visibility,
      ownerId: state.ownerId,
      config: state.config,
      participants: state.participants,
      stories: state.stories,
      currentStoryId: state.currentStoryId,
      roundId: state.roundId,
      phase: state.phase,
      votes,
      remainingSeconds: state.remainingSeconds,
      timerType: state.timerType,
      messages: state.messages,
    };
  }

  votingCounts(state: InternalRoomState): { total: number; voted: number } {
    const eligible = state.participants.filter(
      (participant) => participant.role !== 'Observador' && participant.status === 'ativo' && (participant.connected || participant.hasVoted),
    );
    return { total: eligible.length, voted: eligible.filter((participant) => participant.hasVoted).length };
  }

  canVote(state: InternalRoomState, participant?: InternalParticipant | null) {
    return Boolean(participant) && participant!.role !== 'Observador' && state.phase === 'votacao' && Boolean(state.roundId);
  }

  canReveal(state: InternalRoomState) {
    if (state.phase !== 'votacao') return false;
    return state.votes.length > 0;
  }

  async createStory(state: InternalRoomState, title: string, description = ''): Promise<ActionResult> {
    const clean = title.trim();
    if (!clean) return { error: 'INVALID_VOTE' };
    const order = state.stories.length + 1;
    const story = await this.prisma.story.create({ data: { roomId: state.dbRoomId, title: clean, description: description.trim(), order } });
    state.stories.push(story as any);
    return {};
  }

  async present(state: InternalRoomState, storyId: string): Promise<ActionResult> {
    const story = state.stories.find((item) => item.id === storyId);
    if (!story) return { error: 'INVALID_VOTE' };
    if (state.phase === 'votacao') return { error: 'INVALID_PHASE' };
    await this.clearRound(state);
    const number = story.rounds + 1;
    const round = await this.prisma.voteRound.create({ data: { storyId: story.id, number } });
    await this.prisma.story.update({ where: { id: story.id }, data: { status: 'em_votacao', rounds: { increment: 1 } } });
    story.status = 'em_votacao';
    story.rounds = number;
    state.currentStoryId = story.id;
    state.roundId = round.id;
    state.phase = 'votacao';
    state.status = 'em_andamento';
    state.votes = [];
    state.participants.forEach((participant) => { participant.hasVoted = false; });
    await this.prisma.room.update({ where: { id: state.dbRoomId }, data: { status: 'em_andamento' } });
    this.startTimer(state, 'reflexao', state.config.tempoReflexaoSegundos);
    this.emitter.broadcast(state);
    return {};
  }

  async castVote(state: InternalRoomState, participant: InternalParticipant | null, storyId: string, value: VoteValue): Promise<ActionResult> {
    if (!participant) return { error: 'NOT_PARTICIPANT' };
    if (participant.role === 'Observador') return { error: 'FORBIDDEN' };
    if (state.phase !== 'votacao' || !state.roundId) return { error: 'INVALID_PHASE' };
    if (state.currentStoryId !== storyId) return { error: 'INVALID_VOTE' };
    if (!state.config.deckValues.includes(value)) return { error: 'INVALID_VOTE' };
    await this.prisma.vote.upsert({
      where: { voteRoundId_participantId: { voteRoundId: state.roundId, participantId: participant.id } },
      update: { value: String(value), castAt: new Date() },
      create: { voteRoundId: state.roundId, participantId: participant.id, value: String(value) },
    });
    state.votes = [...state.votes.filter((vote) => vote.participantId !== participant.id), { participantId: participant.id, participantName: participant.name, value }];
    participant.hasVoted = true;
    const counts = this.votingCounts(state);
    this.emitter.to(state.roomId, 'vote:progress', { voted: counts.voted, total: counts.total });
    if (state.config.revelacaoAutomatica && counts.total > 0 && counts.voted >= counts.total) {
      await this.revealState(state);
      return { error: undefined };
    }
    this.emitter.broadcast(state);
    return {};
  }

  async forceReveal(state: InternalRoomState): Promise<ActionResult> {
    if (state.phase !== 'votacao') return { error: 'INVALID_PHASE' };
    if (state.votes.length === 0) return { error: 'INVALID_VOTE' };
    await this.revealState(state);
    return {};
  }

  async revote(state: InternalRoomState): Promise<ActionResult> {
    if (!state.currentStoryId || (state.phase !== 'discussao' && state.phase !== 'revelada')) return { error: 'INVALID_PHASE' };
    this.emitter.to(state.roomId, 'discussion:end', { storyId: state.currentStoryId, reason: 'revote' });
    return this.present(state, state.currentStoryId);
  }

  async finalize(state: InternalRoomState, value: VoteValue, criterion: string): Promise<ActionResult> {
    const story = state.stories.find((item) => item.id === state.currentStoryId);
    if (!story || !state.currentStoryId) return { error: 'INVALID_PHASE' };
    if (state.phase !== 'discussao' && state.phase !== 'revelada') return { error: 'INVALID_PHASE' };
    await this.prisma.story.update({ where: { id: story.id }, data: { status: 'estimada', finalValue: String(value), criterion } });
    story.status = 'estimada';
    story.finalValue = value;
    story.criterion = criterion;
    await this.clearRound(state);
    const next = state.stories.find((item) => item.status === 'pendente');
    state.phase = next ? 'lobby' : 'finalizada';
    state.currentStoryId = next?.id;
    state.status = next ? 'em_andamento' : 'encerrada';
    await this.prisma.room.update({ where: { id: state.dbRoomId }, data: { status: state.status } });
    this.emitter.broadcast(state);
    return {};
  }

  async skip(state: InternalRoomState): Promise<ActionResult> {
    const story = state.stories.find((item) => item.id === state.currentStoryId);
    if (!story || !state.currentStoryId || state.phase === 'votacao') return { error: 'INVALID_PHASE' };
    await this.prisma.story.update({ where: { id: story.id }, data: { status: 'pulada' } });
    story.status = 'pulada';
    await this.clearRound(state);
    state.phase = 'lobby';
    this.emitter.broadcast(state);
    return {};
  }

  async resumeFromStorage(state: InternalRoomState, round: { timerType?: string | null; timerDeadline?: Date | null } | null | undefined) {
    const phaseOfRound = state.phase === 'discussao' ? 'discussao' : 'reflexao';
    let type: TimerType = (round?.timerType as TimerType) ?? phaseOfRound;
    const remaining = round?.timerDeadline ? Math.max(0, Math.ceil((round.timerDeadline.getTime() - Date.now()) / 1000)) : null;
    if (remaining !== null && remaining > 0) {
      this.startTimer(state, type, remaining);
      return;
    }
    if (state.phase === 'votacao') {
      state.phase = 'revelada';
      state.remainingSeconds = null;
      state.timerType = null;
      if (state.roundId) await this.prisma.vote.updateMany({ where: { voteRoundId: state.roundId }, data: { revealed: true } }).catch(() => undefined);
      const values = state.votes.map((vote) => vote.value);
      if (values.length > 1 && new Set(values).size > 1) {
        state.phase = 'discussao';
        this.startTimer(state, 'discussao', state.config.tempoDiscussaoSegundos);
        if (state.currentStoryId) await this.prisma.story.update({ where: { id: state.currentStoryId }, data: { status: 'em_discussao' } }).catch(() => undefined);
      }
      return;
    }
    if (state.phase === 'discussao') {
      state.phase = 'revelada';
      state.remainingSeconds = null;
      state.timerType = null;
    }
  }

  getPhaseLabel(state: InternalRoomState): RoomPhase {
    return state.phase;
  }

  private async revealState(state: InternalRoomState) {
    if (state.phase !== 'votacao') return;
    await this.stopTimer(state);
    state.phase = 'revelada';
    if (state.roundId) await this.prisma.vote.updateMany({ where: { voteRoundId: state.roundId }, data: { revealed: true } });
    const values = state.votes.map((item) => item.value);
    const numbers = values.filter((item): item is number => typeof item === 'number');
    const revealedVotes: InternalVote[] = state.config.votoAnonimo
      ? state.votes.map((vote) => ({ ...vote, participantName: 'Participante' }))
      : state.votes;
    this.emitter.to(state.roomId, 'vote:reveal', {
      votes: revealedVotes,
      unanimous: values.length > 0 && new Set(values).size === 1,
      average: numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null,
      min: numbers.length ? Math.min(...numbers) : null,
      max: numbers.length ? Math.max(...numbers) : null,
    });
    this.emitter.broadcast(state);
    if (values.length > 1 && new Set(values).size > 1) {
      state.phase = 'discussao';
      if (state.currentStoryId) await this.prisma.story.update({ where: { id: state.currentStoryId }, data: { status: 'em_discussao' } });
      this.startTimer(state, 'discussao', state.config.tempoDiscussaoSegundos);
      this.emitter.to(state.roomId, 'discussion:start', { remainingSeconds: state.config.tempoDiscussaoSegundos });
      this.emitter.broadcast(state);
    }
  }

  private startTimer(state: InternalRoomState, type: TimerType, seconds: number) {
    void this.stopTimer(state);
    state.timerType = type;
    const deadline = new Date(Date.now() + Math.max(0, seconds) * 1000);
    state.remainingSeconds = Math.max(0, seconds);
    if (state.roundId) void this.prisma.voteRound.update({ where: { id: state.roundId }, data: { timerType: type, timerDeadline: deadline } }).catch(() => undefined);
    this.timers.schedule(
      { key: state.roomId, type, deadline },
      (remainingSeconds) => {
        state.remainingSeconds = remainingSeconds;
        this.emitter.to(state.roomId, 'timer:tick', { type, remainingSeconds });
      },
      async () => {
        await this.stopTimer(state);
        if (type === 'reflexao') await this.revealState(state);
        else {
          state.phase = 'revelada';
          this.emitter.to(state.roomId, 'discussion:end', { storyId: state.currentStoryId, reason: 'timeout' });
          this.emitter.broadcast(state);
        }
      },
    );
    this.emitter.to(state.roomId, 'timer:start', { type, duracaoSegundos: seconds, deadline: deadline.toISOString() });
  }

  private async stopTimer(state: InternalRoomState) {
    this.timers.cancel(state.roomId);
    state.timer = undefined;
    state.timerType = null;
    state.remainingSeconds = null;
    if (state.roundId) await this.prisma.voteRound.update({ where: { id: state.roundId }, data: { timerType: null, timerDeadline: null } }).catch(() => undefined);
  }

  private async clearRound(state: InternalRoomState) {
    await this.stopTimer(state);
    if (state.roundId) await this.prisma.voteRound.update({ where: { id: state.roundId }, data: { endedAt: new Date() } }).catch(() => undefined);
    state.roundId = undefined;
  }
}