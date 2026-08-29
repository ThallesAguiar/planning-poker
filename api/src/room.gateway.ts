import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { PrismaService } from './prisma.service.js';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import bcrypt from 'bcrypt';
import { AuthorizationService } from './auth/authorization.service.js';
import { SessionService } from './auth/session.service.js';
import { TimerService } from './realtime/timer.service.js';
import { AiParticipantService } from './ai/ai-participant.service.js';
import { RoomStateService } from './realtime/room-state.service.js';

type VoteValue = number | 'cafe' | '?';
type Role = 'PO' | 'Dev' | 'QA' | 'ScrumMaster' | 'Observador' | 'IA_Agente';
type Config = { deckType: string; deckValues: VoteValue[]; tempoReflexaoSegundos: number; tempoDiscussaoSegundos: number; permiteParticipantesIA: boolean; maxParticipantes: number; votoAnonimo: boolean; revelacaoAutomatica: boolean; criterioConsenso: string; papeisPermitidos: Role[] };
type Participant = { id: string; userId: string; name: string; avatar: string; role: Role; isAI: boolean; connected: boolean; hasVoted: boolean };
type Message = { id: string; author: string; role: Role; text: string; type: 'commentario' | 'justificativa' | 'sistema'; createdAt: string };
type Vote = { participantId: string; participantName: string; value: VoteValue };
type State = { roomId: string; dbRoomId: string; name: string; code: string; status: 'aberta' | 'em_andamento' | 'encerrada'; visibility: 'PUBLIC' | 'PRIVATE'; passwordHash?: string | null; ownerId: string; config: Config; participants: Participant[]; stories: any[]; currentStoryId?: string; phase: 'lobby' | 'votacao' | 'discussao' | 'revelada' | 'finalizada'; votes: Vote[]; remainingSeconds: number | null; timerType: 'reflexao' | 'discussao' | null; messages: Message[]; roundId?: string; timer?: NodeJS.Timeout };
type Client = Socket;

const defaultConfig: Config = { deckType: 'fibonacci', deckValues: [1, 2, 3, 5, 8, 13, 20, 40, 100, 'cafe', '?'], tempoReflexaoSegundos: 120, tempoDiscussaoSegundos: 300, permiteParticipantesIA: false, maxParticipantes: 12, votoAnonimo: false, revelacaoAutomatica: false, criterioConsenso: 'decisao_po', papeisPermitidos: ['PO', 'Dev', 'QA', 'ScrumMaster', 'Observador', 'IA_Agente'] };

@WebSocketGateway({ namespace: '/room', cors: { origin: '*' } })
export class RoomGateway {
  @WebSocketServer() server!: Server;
  private readonly states = new Map<string, State>();
  private readonly clientRooms = new Map<string, string>();

  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly sessions: SessionService, private readonly timers: TimerService, private readonly ai: AiParticipantService, private readonly roomStates: RoomStateService) {}

  async afterInit(server: Server) {
    const url = process.env.REDIS_URL;
    if (!url) return;
    const pubClient = new Redis(url);
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.ping(), subClient.ping()]);
    const ioServer = (server as any).server ?? server;
    ioServer.adapter(createAdapter(pubClient, subClient));
  }

  @SubscribeMessage('room:join')
  async join(@ConnectedSocket() client: Client, @MessageBody() payload: { roomId: string; name: string; avatar: string; role?: Role; sessionId?: string; password?: string; token?: string }) {
    const roomKey = payload.roomId.trim();
    const state = await this.loadState(roomKey);
    if (state.visibility === 'PRIVATE') {
      if (!payload.password) { client.emit('room:error', { message: 'PASSWORD_REQUIRED' }); return; }
      if (!state.passwordHash || !(await bcrypt.compare(payload.password, state.passwordHash))) { client.emit('room:error', { message: 'INVALID_PASSWORD' }); return; }
    }
    let userId = payload.sessionId?.trim() || client.id;
    if (payload.token) {
      try {
        const session = this.sessions.verify(payload.token);
        if (session.roomId && session.roomId !== roomKey && session.roomId !== state.dbRoomId) {
          client.emit('room:error', { message: 'FORBIDDEN' });
          return;
        }
        userId = session.sessionId;
      } catch {
        client.emit('room:error', { message: 'FORBIDDEN' });
        return;
      }
    }
    client.data.userId = userId;
    const user = await this.prisma.user.upsert({ where: { id: userId }, update: { name: payload.name, avatarUrl: payload.avatar }, create: { id: userId, name: payload.name, avatarUrl: payload.avatar, isGuest: true } });
    let participant = await this.prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: state.dbRoomId, userId: user.id } } });
    if (!participant && state.participants.filter((item) => item.connected).length >= state.config.maxParticipantes) {
      client.emit('room:error', { message: 'ROOM_FULL' });
      return;
    }
    const requestedRole = payload.role ?? 'Dev';
    const role = participant?.role ?? (state.participants.length === 0 ? 'PO' : requestedRole);
    if (!participant && role !== 'PO' && !state.config.papeisPermitidos.includes(role)) {
      client.emit('room:error', { message: 'FORBIDDEN' });
      return;
    }
    if (!participant) participant = await this.prisma.roomParticipant.create({ data: { roomId: state.dbRoomId, userId: user.id, role, isAI: false } });
    client.data.participantId = participant.id;
    state.participants = state.participants.filter((item) => item.userId !== user.id);
    state.participants.push({ id: participant.id, userId: user.id, name: user.name, avatar: user.avatarUrl ?? '', role: participant.role as Role, isAI: participant.isAI, connected: true, hasVoted: state.votes.some((vote) => vote.participantId === participant!.id) });
    if (state.ownerId === 'pending') { state.ownerId = participant.id; await this.prisma.room.update({ where: { id: state.dbRoomId }, data: { ownerId: participant.id } }); }
    this.states.set(roomKey, state); this.clientRooms.set(client.id, roomKey); client.join(roomKey); this.broadcast(roomKey);
  }

  @SubscribeMessage('room:leave') leave(@ConnectedSocket() client: Client) { this.removeClient(client); }
  handleDisconnect(client: Client) { this.removeClient(client); }

  @SubscribeMessage('room:configure')
  async configure(@ConnectedSocket() client: Client, @MessageBody() payload: { config: Partial<Config> }) {
    const state = this.authorized(client, 'PO'); if (!state || state.phase !== 'lobby') return;
    if (payload.config.maxParticipantes !== undefined && (!Number.isInteger(payload.config.maxParticipantes) || payload.config.maxParticipantes < 1)) return;
    if (payload.config.tempoReflexaoSegundos !== undefined && (!Number.isInteger(payload.config.tempoReflexaoSegundos) || payload.config.tempoReflexaoSegundos < 1)) return;
    if (payload.config.tempoDiscussaoSegundos !== undefined && (!Number.isInteger(payload.config.tempoDiscussaoSegundos) || payload.config.tempoDiscussaoSegundos < 1)) return;
    if (payload.config.deckValues !== undefined && (!Array.isArray(payload.config.deckValues) || payload.config.deckValues.length === 0)) return;
    state.config = { ...state.config, ...payload.config };
    await this.prisma.roomConfig.update({ where: { roomId: state.dbRoomId }, data: { ...payload.config, deckValues: payload.config.deckValues as any, papeisPermitidos: payload.config.papeisPermitidos as any } as any });
    this.broadcast(state.roomId);
  }

  @SubscribeMessage('room:transferOwner')
  async transferOwner(@ConnectedSocket() client: Client, @MessageBody() payload: { participantId: string }) {
    const state = this.authorized(client, 'PO'); const next = state?.participants.find((item) => item.id === payload.participantId); if (!state || !next) return;
    state.ownerId = next.id; await this.prisma.room.update({ where: { id: state.dbRoomId }, data: { ownerId: next.id } }); this.broadcast(state.roomId);
  }

  @SubscribeMessage('story:present')
  async present(@ConnectedSocket() client: Client, @MessageBody() payload: { storyId: string }) {
    const state = this.authorized(client, 'PO'); const story = state?.stories.find((item) => item.id === payload.storyId); if (!state || !story) return;
    await this.clearRound(state); const round = await this.prisma.voteRound.create({ data: { storyId: story.id, number: (story.rounds ?? 0) + 1 } });
    await this.prisma.story.update({ where: { id: story.id }, data: { status: 'em_votacao', rounds: { increment: 1 } } });
    story.status = 'em_votacao'; story.rounds = (story.rounds ?? 0) + 1; state.currentStoryId = story.id; state.phase = 'votacao'; state.status = 'em_andamento'; state.roundId = round.id; state.votes = []; state.participants.forEach((item) => { item.hasVoted = false; }); await this.prisma.room.update({ where: { id: state.dbRoomId }, data: { status: 'em_andamento' } });
    this.startTimer(state, 'reflexao', state.config.tempoReflexaoSegundos); this.broadcast(state.roomId);
  }

  @SubscribeMessage('vote:cast')
  async vote(@ConnectedSocket() client: Client, @MessageBody() payload: { storyId: string; value: VoteValue }) {
    const state = this.stateFor(client); const participant = state?.participants.find((item) => item.id === this.participantId(client));
    if (!state || !participant || !this.authorization.canVote(participant.role, state.phase) || state.currentStoryId !== payload.storyId || !state.roundId || !state.config.deckValues.includes(payload.value)) return;
    await this.prisma.vote.upsert({ where: { voteRoundId_participantId: { voteRoundId: state.roundId, participantId: participant.id } }, update: { value: String(payload.value), castAt: new Date() }, create: { voteRoundId: state.roundId, participantId: participant.id, value: String(payload.value) } });
    state.votes = [...state.votes.filter((item) => item.participantId !== participant.id), { participantId: participant.id, participantName: participant.name, value: payload.value }]; participant.hasVoted = true;
    this.server.to(state.roomId).emit('vote:progress', { voted: state.votes.length, total: this.votingParticipants(state).length }); this.broadcast(state.roomId);
    if (state.config.revelacaoAutomatica && state.votes.length === this.votingParticipants(state).length) await this.revealState(state);
  }

  @SubscribeMessage('vote:forceReveal') async reveal(@ConnectedSocket() client: Client) { const state = this.authorized(client, 'PO'); if (state) await this.revealState(state); }

  @SubscribeMessage('ai:requestVote')
  async requestAiVote(@ConnectedSocket() client: Client) {
    const state = this.authorized(client, 'PO');
    if (!state || state.phase !== 'votacao' || !state.currentStoryId || !state.roundId) return;
    try {
      const result = await this.ai.castVote(state.dbRoomId, state.currentStoryId, state.roundId);
      let participant = state.participants.find((item) => item.id === result.participantId);
      if (!participant) { participant = { id: result.participantId, userId: result.participantId, name: result.participantName, avatar: '🤖', role: 'IA_Agente', isAI: true, connected: true, hasVoted: false }; state.participants.push(participant); }
      state.votes = [...state.votes.filter((vote) => vote.participantId !== result.participantId), { participantId: result.participantId, participantName: result.participantName, value: result.value as VoteValue }]; participant.hasVoted = true;
      await this.prisma.chatMessage.create({ data: { roomId: state.dbRoomId, storyId: state.currentStoryId, participantId: result.participantId, text: result.justification, type: 'justificativa' } });
      this.server.to(state.roomId).emit('ai:status', { status: 'voted' }); this.broadcast(state.roomId);
    } catch (error) { const message = error instanceof Error ? error.message : 'AI_UNAVAILABLE'; const status = message === 'AI_UNAVAILABLE' ? 'unavailable' : 'error'; this.server.to(state.roomId).emit('ai:status', { status, message }); }
  }

  @SubscribeMessage('vote:revote') async revote(@ConnectedSocket() client: Client) {
    const state = this.authorized(client, 'PO'); if (!state || !state.currentStoryId) return; await this.present(client, { storyId: state.currentStoryId });
  }

  @SubscribeMessage('story:finalize')
  async finalize(@ConnectedSocket() client: Client, @MessageBody() payload: { value: VoteValue; criterion: string }) {
    const state = this.authorized(client, 'PO'); const story = state?.stories.find((item) => item.id === state.currentStoryId); if (!state || !story || !state.currentStoryId) return;
    await this.prisma.story.update({ where: { id: story.id }, data: { status: 'estimada', finalValue: String(payload.value), criterion: payload.criterion } }); story.status = 'estimada'; story.finalValue = payload.value; story.criterion = payload.criterion; await this.clearRound(state);
    const next = state.stories.find((item) => item.status === 'pendente'); state.phase = next ? 'lobby' : 'finalizada'; state.currentStoryId = next?.id; state.status = next ? 'em_andamento' : 'encerrada'; await this.prisma.room.update({ where: { id: state.dbRoomId }, data: { status: state.status } }); this.broadcast(state.roomId);
  }

  @SubscribeMessage('story:skip') async skip(@ConnectedSocket() client: Client) { const state = this.authorized(client, 'PO'); const story = state?.stories.find((item) => item.id === state.currentStoryId); if (!state || !story) return; await this.prisma.story.update({ where: { id: story.id }, data: { status: 'pulada' } }); story.status = 'pulada'; await this.clearRound(state); state.phase = 'lobby'; this.broadcast(state.roomId); }

  @SubscribeMessage('chat:message')
  async chat(@ConnectedSocket() client: Client, @MessageBody() payload: { text: string; type?: Message['type'] }) {
    const state = this.stateFor(client); const participant = state?.participants.find((item) => item.id === this.participantId(client)); if (!state || !participant || !payload.text?.trim()) return;
    const message = await this.prisma.chatMessage.create({ data: { roomId: state.dbRoomId, storyId: state.currentStoryId, participantId: participant.id, text: payload.text.trim(), type: payload.type ?? 'commentario' } });
    state.messages.push({ id: message.id, author: participant.name, role: participant.role, text: message.text, type: message.type as Message['type'], createdAt: message.createdAt.toISOString() }); this.broadcast(state.roomId);
  }

  @SubscribeMessage('reaction:send') reaction(@ConnectedSocket() client: Client, @MessageBody() payload: { value: string }) { const state = this.stateFor(client); if (state && ['👍', '🤔', '😅', '🔥'].includes(payload.value)) this.server.to(state.roomId).emit('reaction:show', { value: payload.value, participantId: this.participantId(client) }); }

  @SubscribeMessage('report:generate') async report(@ConnectedSocket() client: Client) { const state = this.authorized(client, 'PO'); if (!state) return; const report = await this.prisma.sprintReport.create({ data: { roomId: state.dbRoomId, summary: state.stories } }); this.server.to(state.roomId).emit('report:ready', { reportId: report.id }); }

  private async revealState(state: State) {
    if (state.phase !== 'votacao') return; await this.stopTimer(state); state.phase = 'revelada'; const values = state.votes.map((item) => item.value); if (state.roundId) await this.prisma.vote.updateMany({ where: { voteRoundId: state.roundId }, data: { revealed: true } });
    const numbers = values.filter((item): item is number => typeof item === 'number'); this.server.to(state.roomId).emit('vote:reveal', { votes: state.config.votoAnonimo ? state.votes.map((item) => ({ ...item, participantName: 'Participante' })) : state.votes, unanimous: values.length > 0 && new Set(values).size === 1, average: numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null, min: numbers.length ? Math.min(...numbers) : null, max: numbers.length ? Math.max(...numbers) : null }); this.broadcast(state.roomId);
    if (values.length > 1 && new Set(values).size > 1) { state.phase = 'discussao'; if (state.currentStoryId) await this.prisma.story.update({ where: { id: state.currentStoryId }, data: { status: 'em_discussao' } }); this.startTimer(state, 'discussao', state.config.tempoDiscussaoSegundos); this.server.to(state.roomId).emit('discussion:start', { remainingSeconds: state.config.tempoDiscussaoSegundos }); this.broadcast(state.roomId); }
  }

  private startTimer(state: State, type: 'reflexao' | 'discussao', seconds: number) { void this.stopTimer(state); state.timerType = type; const deadline = new Date(Date.now() + Math.max(0, seconds) * 1000); state.remainingSeconds = Math.max(0, seconds); if (state.roundId) void this.prisma.voteRound.update({ where: { id: state.roundId }, data: { timerType: type, timerDeadline: deadline } }); this.timers.schedule({ key: state.roomId, type, deadline }, (remainingSeconds) => { state.remainingSeconds = remainingSeconds; this.server.to(state.roomId).emit('timer:tick', { type, remainingSeconds }); }, async () => { await this.stopTimer(state); if (type === 'reflexao') await this.revealState(state); else { state.phase = 'revelada'; this.server.to(state.roomId).emit('discussion:end', { storyId: state.currentStoryId, reason: 'timeout' }); this.broadcast(state.roomId); } }); this.server.to(state.roomId).emit('timer:start', { type, duracaoSegundos: seconds, deadline: deadline.toISOString() }); }
  private async stopTimer(state: State) { this.timers.cancel(state.roomId); state.timer = undefined; state.timerType = null; state.remainingSeconds = null; if (state.roundId) await this.prisma.voteRound.update({ where: { id: state.roundId }, data: { timerType: null, timerDeadline: null } }).catch(() => undefined); }
  private async clearRound(state: State) { await this.stopTimer(state); if (state.roundId) await this.prisma.voteRound.update({ where: { id: state.roundId }, data: { endedAt: new Date() } }).catch(() => undefined); state.roundId = undefined; }
  private votingParticipants(state: State) { return state.participants.filter((item) => item.role !== 'Observador'); }
  private participantId(client: Client) { return this.stateFor(client)?.participants.find((item) => item.userId === (client as any).data?.userId || item.id === (client as any).data?.participantId)?.id ?? ''; }
  private stateFor(client: Client) { const room = this.clientRooms.get(client.id); return room ? this.states.get(room) : undefined; }
  private authorized(client: Client, role: 'PO') { const state = this.stateFor(client); const participant = state?.participants.find((item) => item.id === this.participantId(client)); return state && participant && this.authorization.canControlRoom(participant.id, participant.role, state.ownerId, role) ? state : undefined; }
  private broadcast(roomId: string) { const state = this.states.get(roomId); if (!state) return; const { passwordHash: _passwordHash, ...publicState } = state; const safe = { ...publicState, timer: undefined, votes: state.phase === 'revelada' || state.phase === 'discussao' ? state.votes : state.votes.map((item) => ({ ...item, value: '?' as VoteValue })) }; void this.roomStates.save(roomId, { ...state, timer: undefined }); this.server.to(roomId).emit('room:state', safe); }
  private removeClient(client: Client) { const roomId = this.clientRooms.get(client.id); if (!roomId) return; const state = this.states.get(roomId); if (state) { const participant = state.participants.find((item) => item.id === this.participantId(client)); if (participant) participant.connected = false; this.broadcast(roomId); } this.clientRooms.delete(client.id); }

  private async loadState(roomKey: string): Promise<State> {
    const cached = this.states.get(roomKey); if (cached) return cached;
    const restored = await this.roomStates.restore(roomKey);
    if (restored?.dbRoomId && restored?.config && restored?.participants && restored?.stories) { this.states.set(roomKey, restored as unknown as State); return restored as unknown as State; }
    const include = { config: true, stories: { orderBy: { order: 'asc' as const } }, participants: { include: { user: true } }, messages: { orderBy: { createdAt: 'asc' as const } } };
    const existing = await this.prisma.room.findFirst({ where: { OR: [{ id: roomKey }, { inviteCode: roomKey.toUpperCase() }] }, include });
    let roomId = existing?.id;
    if (!roomId) {
      try {
        const created = await this.prisma.room.create({ data: { name: 'Planning Poker', inviteCode: roomKey.toUpperCase(), ownerId: 'pending', config: { create: { ...defaultConfig, deckValues: defaultConfig.deckValues, papeisPermitidos: defaultConfig.papeisPermitidos } } as any } });
        roomId = created.id;
      } catch (error: any) {
        if (error?.code !== 'P2002') throw error;
        roomId = (await this.prisma.room.findUnique({ where: { inviteCode: roomKey.toUpperCase() } }))?.id;
      }
    }
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include });
    if (!room) throw new Error('Room could not be loaded');
    const config = { ...defaultConfig, ...(room.config ? { ...room.config, papeisPermitidos: room.config.papeisPermitidos as Role[], deckValues: room.config.deckValues as VoteValue[] } : {}) } as Config;
    const state: State = { roomId: roomKey, dbRoomId: room.id, name: room.name, code: room.inviteCode, status: room.status as State['status'], visibility: room.visibility as State['visibility'], passwordHash: room.passwordHash, ownerId: room.ownerId, config, participants: room.participants.map((item) => ({ id: item.id, userId: item.userId, name: item.user.name, avatar: item.user.avatarUrl ?? '', role: item.role as Role, isAI: item.isAI, connected: false, hasVoted: false })), stories: room.stories, phase: 'lobby', votes: [], remainingSeconds: null, timerType: null, messages: room.messages.map((item) => ({ id: item.id, author: room!.participants.find((person) => person.id === item.participantId)?.user.name ?? 'Sistema', role: room!.participants.find((person) => person.id === item.participantId)?.role as Role ?? 'Dev', text: item.text, type: item.type as Message['type'], createdAt: item.createdAt.toISOString() })) };
    const activeStory = room.stories.find((item) => item.status === 'em_votacao' || item.status === 'em_discussao');
    if (activeStory) {
      const round = await this.prisma.voteRound.findFirst({ where: { storyId: activeStory.id, endedAt: null }, orderBy: { number: 'desc' }, include: { votes: true } });
      state.currentStoryId = activeStory.id; state.roundId = round?.id; state.phase = activeStory.status === 'em_discussao' ? 'discussao' : 'votacao';
      state.votes = round?.votes.map((vote) => ({ participantId: vote.participantId, participantName: state.participants.find((item) => item.id === vote.participantId)?.name ?? 'Participante', value: state.phase === 'votacao' ? '?' : (Number.isNaN(Number(vote.value)) ? vote.value as VoteValue : Number(vote.value)) })) ?? [];
      state.participants.forEach((item) => { item.hasVoted = state.votes.some((vote) => vote.participantId === item.id); });
    }
    this.states.set(roomKey, state); return state;
  }
}
