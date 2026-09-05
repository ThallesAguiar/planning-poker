import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { PrismaService } from './prisma.service.js';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import bcrypt from 'bcrypt';
import { AuthorizationService } from './auth/authorization.service.js';
import { SessionService } from './auth/session.service.js';
import { AiParticipantService } from './ai/ai-participant.service.js';
import { RoomStateService } from './realtime/room-state.service.js';
import { RoundService } from './realtime/round.service.js';
import { PresenceService } from './realtime/presence.service.js';
import { RoomService } from './room.service.js';
import { ReportService } from './reports/report.service.js';
import { defaultConfig } from './realtime/room.types.js';
import type { InternalRoomState } from './realtime/room.types.js';
import type { PresenceChange } from './realtime/presence.service.js';
import type { RoomConfig, ParticipantRole, ChatMessage, VoteValue, RoomErrorCode, RoomRoleChangeRequest, ReportOptions } from '@planning-poker/shared-types';

type Client = Socket;

const ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  ROOM_NOT_FOUND: 'Sala nao encontrada.',
  PASSWORD_REQUIRED: 'Esta sala exige senha.',
  INVALID_PASSWORD: 'Senha invalida ou sala indisponivel.',
  FORBIDDEN: 'Acao nao permitida para o seu papel.',
  INVALID_PHASE: 'Acao indisponivel na fase atual.',
  INVALID_VOTE: 'Voto ou historia invalida para esta rodada.',
  ROOM_FULL: 'Sala cheia.',
  AI_UNAVAILABLE: 'Participante IA indisponivel.',
  INVALID_PROFILE_UPDATE: 'Atualizacao de perfil invalida.',
  INVALID_ROLE_REQUEST: 'Solicitacao de papel invalida.',
  PROFILE_REQUEST_NOT_FOUND: 'Solicitacao de papel nao encontrada.',
  REMOVED: 'Voce foi removido desta sala.',
  NOT_PARTICIPANT: 'Voce nao e mais participante desta sala.',
  INVALID_CONFIG: 'Configuracao invalida.',
};

const ALLOWED_CONFIG_ROLES: ParticipantRole[] = ['PO', 'Dev', 'QA', 'ScrumMaster', 'Observador', 'IA_Agente'];
const ALLOWED_CONSENSUS = ['decisao_po', 'unanime', 'media', 'mediana'];

@WebSocketGateway({ namespace: '/room', cors: { origin: '*' } })
export class RoomGateway {
  @WebSocketServer() server!: Server;
  private readonly states = new Map<string, InternalRoomState>();
  private readonly clientRooms = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly sessions: SessionService,
    private readonly ai: AiParticipantService,
    private readonly roomStates: RoomStateService,
    private readonly round: RoundService,
    private readonly presence: PresenceService,
    private readonly rooms: RoomService,
    private readonly reports: ReportService,
  ) {}

  async afterInit(server: Server) {
    const url = process.env.REDIS_URL;
    if (url) {
      const pubClient = new Redis(url);
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.ping(), subClient.ping()]);
      const ioServer = (server as any).server ?? server;
      ioServer.adapter(createAdapter(pubClient, subClient));
    }
    this.round.setEmitter({
      to: (roomId, event, payload) => this.server.to(roomId).emit(event, payload),
      broadcast: (state) => this.broadcastRoom(state),
    });
  }

  @SubscribeMessage('room:join')
  async join(@ConnectedSocket() client: Client, @MessageBody() payload: { roomId: string; name: string; avatar: string; role?: string; sessionId?: string; password?: string; token?: string }) {
    const roomKey = payload.roomId.trim();
    let state: InternalRoomState;
    try {
      state = await this.loadState(roomKey);
    } catch {
      this.emitError(client, 'ROOM_NOT_FOUND');
      return;
    }
    let userId = payload.sessionId?.trim() || client.id;
    let hasValidSession = false;
    let sessionParticipantId: string | null = null;
    if (payload.token) {
      try {
        const session = this.sessions.verify(payload.token);
        if (session.roomId && session.roomId !== roomKey && session.roomId !== state.dbRoomId) {
          this.emitError(client, 'FORBIDDEN');
          return;
        }
        userId = session.sessionId;
        sessionParticipantId = session.participantId ?? null;
        hasValidSession = true;
      } catch {
        this.emitError(client, 'FORBIDDEN');
        return;
      }
    }
    if (state.visibility === 'PRIVATE' && !hasValidSession) {
      if (!payload.password) {
        this.emitError(client, 'PASSWORD_REQUIRED');
        return;
      }
      if (!state.passwordHash || !(await bcrypt.compare(payload.password, state.passwordHash))) {
        this.emitError(client, 'INVALID_PASSWORD');
        return;
      }
    }
    client.data.userId = userId;
    const user = await this.prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, name: payload.name, avatarUrl: payload.avatar, isGuest: true } });
    let participantRow = await this.prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: state.dbRoomId, userId: user.id } } });
    if (!participantRow && sessionParticipantId) {
      this.emitError(client, 'REMOVED');
      return;
    }
    if (!participantRow && state.participants.filter((item) => item.connected).length >= state.config.maxParticipantes) {
      this.emitError(client, 'ROOM_FULL');
      return;
    }
    const requestedRole = (payload.role as ParticipantRole) ?? 'Dev';
    const role: ParticipantRole = participantRow?.role ?? (state.participants.length === 0 ? 'PO' : requestedRole);
    if (!participantRow && role !== 'PO' && !(state.config.papeisPermitidos ?? ALLOWED_CONFIG_ROLES).includes(role)) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    let reason: 'joined' | 'reconnected' = 'joined';
    if (participantRow) {
      participantRow = await this.prisma.roomParticipant.update({
        where: { id: participantRow.id },
        data: { status: 'ativo', lastSeenAt: new Date() },
      });
      reason = state.participants.some((item) => item.id === participantRow!.id) ? 'reconnected' : 'joined';
    } else {
      participantRow = await this.prisma.roomParticipant.create({
        data: {
          roomId: state.dbRoomId,
          userId: user.id,
          role,
          isAI: false,
          roomDisplayName: payload.name,
          roomAvatarUrl: payload.avatar,
        },
      });
    }
    client.data.participantId = participantRow.id;
    const materialized = this.presence.materialize(state, {
      id: participantRow.id,
      userId: user.id,
      name: participantRow.roomDisplayName ?? user.name,
      avatar: participantRow.roomAvatarUrl ?? user.avatarUrl ?? '',
      role: participantRow.role as ParticipantRole,
      isAI: participantRow.isAI,
      connected: false,
      hasVoted: state.votes.some((vote) => vote.participantId === participantRow!.id),
      status: participantRow.status as 'ativo' | 'inativo',
    });
    this.presence.connectParticipant(state, materialized.id, client.id);
    if (state.ownerId === 'pending') {
      state.ownerId = materialized.id;
      await this.prisma.room.update({ where: { id: state.dbRoomId }, data: { ownerId: materialized.id } });
    }
    const stale = this.presence.dedupe(state, materialized.id, client.id);
    stale.forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('room:kicked', { code: 'FORBIDDEN', message: 'Sessao duplicada.' });
        socket.disconnect(true);
      }
    });
    this.states.set(roomKey, state);
    this.clientRooms.set(client.id, roomKey);
    client.join(roomKey);
    this.emitParticipantUpdate(state, { participant: { ...materialized, connected: true }, reason });
    this.broadcastRoom(state);
  }

  @SubscribeMessage('room:leave') leave(@ConnectedSocket() client: Client) { this.removeClient(client); }
  handleDisconnect(client: Client) { this.removeClient(client); }

  @SubscribeMessage('room:profileUpdate')
  async profileUpdate(@ConnectedSocket() client: Client, @MessageBody() payload: { name?: string; avatar?: string }) {
    const state = this.stateFor(client);
    const participant = state?.participants.find((item) => item.id === this.participantId(client));
    if (!state || !participant || (!payload.name && payload.avatar === undefined)) {
      this.emitError(client, 'INVALID_PROFILE_UPDATE');
      return;
    }
    await this.prisma.roomParticipant.update({
      where: { id: participant.id },
      data: {
        roomDisplayName: payload.name?.trim() || participant.name,
        roomAvatarUrl: payload.avatar ?? participant.avatar,
        lastSeenAt: new Date(),
      },
    });
    participant.name = payload.name?.trim() || participant.name;
    participant.avatar = payload.avatar ?? participant.avatar;
    this.emitParticipantUpdate(state, { participant: {...participant}, reason: 'reconnected' });
    this.broadcastRoom(state);
  }

  @SubscribeMessage('room:roleChangeRequest')
  async roleChangeRequest(@ConnectedSocket() client: Client, @MessageBody() payload: { role: string }) {
    const state = this.stateFor(client);
    const participant = state?.participants.find((item) => item.id === this.participantId(client));
    if (!state || !participant || !(state.config.papeisPermitidos ?? ALLOWED_CONFIG_ROLES).includes(payload.role as ParticipantRole) || payload.role === 'PO') {
      this.emitError(client, 'INVALID_ROLE_REQUEST');
      return;
    }
    try {
      const request = await this.rooms.requestRoleChange(state.dbRoomId, participant.id, payload.role);
      state.roleRequests = [...(state.roleRequests ?? []), { ...request, status: request.status as RoomRoleChangeRequest['status'] }].filter((item) => item.status === 'pending');
      this.server.to(state.roomId).emit('room:profileRequestPending', request);
    } catch {
      this.emitError(client, 'INVALID_ROLE_REQUEST');
    }
  }

  @SubscribeMessage('room:profileDecision')
  async profileDecision(@ConnectedSocket() client: Client, @MessageBody() payload: { requestId: string; decision: 'approved' | 'rejected' }) {
    const state = this.authorized(client, 'PO');
    if (!state || !['approved', 'rejected'].includes(payload.decision)) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    try {
      const decision = await this.rooms.decideRoleChange(state.dbRoomId, this.participantId(client), payload.requestId, payload.decision);
      if (payload.decision === 'approved') {
        const participant = state.participants.find((item) => item.id === decision.requesterParticipantId);
        if (participant) {
          participant.role = decision.requestedRole as ParticipantRole;
          this.emitParticipantUpdate(state, { participant: {...participant}, reason: 'role' });
        }
      }
      state.roleRequests = (state.roleRequests ?? []).filter((item) => item.id !== decision.requestId);
      this.server.to(state.roomId).emit('room:profileDecision', { requestId: decision.requestId, decision: decision.decision, decidedAt: decision.decidedAt });
      this.broadcastRoom(state);
    } catch {
      this.emitError(client, 'PROFILE_REQUEST_NOT_FOUND');
    }
  }

  @SubscribeMessage('room:configure')
  async configure(@ConnectedSocket() client: Client, @MessageBody() payload: { config: Partial<RoomConfig> }) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    if (state.phase !== 'lobby') {
      this.emitError(client, 'INVALID_PHASE');
      return;
    }
    const patch: Partial<RoomConfig> = {};
    const source = payload.config ?? {};
    if (source.maxParticipantes !== undefined) {
      if (!Number.isInteger(source.maxParticipantes) || source.maxParticipantes < 1 || source.maxParticipantes > 50) {
        this.emitError(client, 'INVALID_CONFIG');
        return;
      }
      patch.maxParticipantes = source.maxParticipantes;
    }
    if (source.tempoReflexaoSegundos !== undefined) {
      if (!Number.isInteger(source.tempoReflexaoSegundos) || source.tempoReflexaoSegundos < 1 || source.tempoReflexaoSegundos > 3600) {
        this.emitError(client, 'INVALID_CONFIG');
        return;
      }
      patch.tempoReflexaoSegundos = source.tempoReflexaoSegundos;
    }
    if (source.tempoDiscussaoSegundos !== undefined) {
      if (!Number.isInteger(source.tempoDiscussaoSegundos) || source.tempoDiscussaoSegundos < 1 || source.tempoDiscussaoSegundos > 3600) {
        this.emitError(client, 'INVALID_CONFIG');
        return;
      }
      patch.tempoDiscussaoSegundos = source.tempoDiscussaoSegundos;
    }
    if (source.deckValues !== undefined) {
      if (!Array.isArray(source.deckValues) || source.deckValues.length === 0 || !source.deckValues.every((value) => typeof value === 'number' || value === 'café' || value === '?')) {
        this.emitError(client, 'INVALID_CONFIG');
        return;
      }
      patch.deckValues = source.deckValues;
    }
    if (source.permiteParticipantesIA !== undefined) patch.permiteParticipantesIA = Boolean(source.permiteParticipantesIA);
    if (source.votoAnonimo !== undefined) patch.votoAnonimo = Boolean(source.votoAnonimo);
    if (source.revelacaoAutomatica !== undefined) patch.revelacaoAutomatica = Boolean(source.revelacaoAutomatica);
    if (source.criterioConsenso !== undefined) {
      if (!ALLOWED_CONSENSUS.includes(source.criterioConsenso)) {
        this.emitError(client, 'INVALID_CONFIG');
        return;
      }
      patch.criterioConsenso = source.criterioConsenso;
    }
    if (source.papeisPermitidos !== undefined) {
      if (!Array.isArray(source.papeisPermitidos) || source.papeisPermitidos.length === 0 || !source.papeisPermitidos.every((role) => ALLOWED_CONFIG_ROLES.includes(role))) {
        this.emitError(client, 'INVALID_CONFIG');
        return;
      }
      patch.papeisPermitidos = source.papeisPermitidos;
    }
    if (source.permiteRevotoIlimitado !== undefined) patch.permiteRevotoIlimitado = Boolean(source.permiteRevotoIlimitado);
    state.config = { ...state.config, ...patch };
    await this.prisma.roomConfig.update({ where: { roomId: state.dbRoomId }, data: { ...patch, deckValues: patch.deckValues as any, papeisPermitidos: patch.papeisPermitidos as any } as any });
    this.broadcastRoom(state);
  }

  @SubscribeMessage('room:transferOwner')
  async transferOwner(@ConnectedSocket() client: Client, @MessageBody() payload: { participantId: string }) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    const change = await this.presence.transferOwner(state, this.participantId(client), payload.participantId);
    if (!change) {
      this.emitError(client, 'INVALID_VOTE');
      return;
    }
    this.emitParticipantUpdate(state, change);
    this.broadcastRoom(state);
  }

  @SubscribeMessage('room:removeParticipant')
  async removeParticipant(@ConnectedSocket() client: Client, @MessageBody() payload: { participantId: string }) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    if (payload.participantId === this.participantId(client)) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    const change = await this.presence.remove(state, payload.participantId);
    if (!change) {
      this.emitError(client, 'INVALID_VOTE');
      return;
    }
    const message = 'Voce foi removido desta sala.';
    (change.socketIds ?? []).forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('room:kicked', { code: 'REMOVED', message });
        socket.disconnect(true);
      }
    });
    this.emitParticipantUpdate(state, change);
    this.broadcastRoom(state);
  }

  @SubscribeMessage('room:setParticipantStatus')
  async setParticipantStatus(@ConnectedSocket() client: Client, @MessageBody() payload: { participantId: string; status: 'ativo' | 'inativo' }) {
    const state = this.authorized(client, 'PO');
    if (!state || !['ativo', 'inativo'].includes(payload.status)) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    const change = await this.presence.setStatus(state, payload.participantId, payload.status);
    if (!change) {
      this.emitError(client, 'INVALID_VOTE');
      return;
    }
    this.emitParticipantUpdate(state, change);
    this.broadcastRoom(state);
  }

  @SubscribeMessage('story:create')
  async createStory(@ConnectedSocket() client: Client, @MessageBody() payload: { title: string; description?: string }) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    const result = await this.round.createStory(state, payload.title, payload.description ?? '');
    if (result.error) {
      this.emitError(client, result.error);
      return;
    }
    this.broadcastRoom(state);
  }

  @SubscribeMessage('story:present')
  async present(@ConnectedSocket() client: Client, @MessageBody() payload: { storyId: string }) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    const result = await this.round.present(state, payload.storyId);
    if (result.error) this.emitError(client, result.error);
  }

  @SubscribeMessage('vote:cast')
  async vote(@ConnectedSocket() client: Client, @MessageBody() payload: { storyId: string; value: VoteValue; justification?: string }) {
    const state = this.stateFor(client);
    const participant = state?.participants.find((item) => item.id === this.participantId(client)) ?? null;
    if (!state) {
      this.emitError(client, 'NOT_PARTICIPANT');
      return;
    }
    const result = await this.round.castVote(state, participant, payload.storyId, payload.value, payload.justification);
    if (result.error) this.emitError(client, result.error);
  }

  @SubscribeMessage('vote:forceReveal')
  async reveal(@ConnectedSocket() client: Client) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    const result = await this.round.forceReveal(state);
    if (result.error) this.emitError(client, result.error);
  }

  @SubscribeMessage('vote:revote')
  async revote(@ConnectedSocket() client: Client) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    const result = await this.round.revote(state);
    if (result.error) this.emitError(client, result.error);
  }

  @SubscribeMessage('story:finalize')
  async finalize(@ConnectedSocket() client: Client, @MessageBody() payload: { value: VoteValue; criterion: string }) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    const result = await this.round.finalize(state, payload.value, payload.criterion);
    if (result.error) this.emitError(client, result.error);
  }

  @SubscribeMessage('story:skip')
  async skip(@ConnectedSocket() client: Client) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    const result = await this.round.skip(state);
    if (result.error) this.emitError(client, result.error);
  }

  @SubscribeMessage('ai:requestVote')
  async requestAiVote(@ConnectedSocket() client: Client) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    if (state.phase !== 'votacao' || !state.currentStoryId || !state.roundId) {
      this.emitError(client, 'INVALID_PHASE');
      return;
    }
    try {
      const result = await this.ai.castVote(state.dbRoomId, state.currentStoryId, state.roundId);
      let participant = state.participants.find((item) => item.id === result.participantId);
      if (!participant) {
        participant = this.presence.materialize(state, { id: result.participantId, userId: result.participantId, name: result.participantName, avatar: '🤖', role: 'IA_Agente', isAI: true, connected: true, hasVoted: false, status: 'ativo' });
      }
      const chat = await this.prisma.chatMessage.create({ data: { roomId: state.dbRoomId, storyId: state.currentStoryId, participantId: result.participantId, text: result.justification, type: 'justificativa' } });
      state.messages.push({ id: chat.id, author: participant.name, role: participant.role, text: chat.text, type: 'justificativa', createdAt: chat.createdAt.toISOString() });
      this.server.to(state.roomId).emit('ai:status', { status: 'voted' });
      this.emitParticipantUpdate(state, { participant: {...participant}, reason: 'joined' });
      await this.round.castVote(state, participant, state.currentStoryId, result.value as VoteValue);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI_UNAVAILABLE';
      const status: 'unavailable' | 'error' = message === 'AI_UNAVAILABLE' ? 'unavailable' : 'error';
      this.server.to(state.roomId).emit('ai:status', { status, message });
    }
  }

  @SubscribeMessage('chat:message')
  async chat(@ConnectedSocket() client: Client, @MessageBody() payload: { text: string; type?: string }) {
    const state = this.stateFor(client);
    const participant = state?.participants.find((item) => item.id === this.participantId(client));
    if (!state || !participant) {
      this.emitError(client, 'NOT_PARTICIPANT');
      return;
    }
    if (!payload.text?.trim()) return;
    const message = await this.prisma.chatMessage.create({ data: { roomId: state.dbRoomId, storyId: state.currentStoryId, participantId: participant.id, text: payload.text.trim(), type: payload.type ?? 'commentario' } });
    state.messages.push({ id: message.id, author: participant.name, role: participant.role, text: message.text, type: message.type as ChatMessage['type'], createdAt: message.createdAt.toISOString() });
    this.broadcastRoom(state);
  }

  @SubscribeMessage('reaction:send') reaction(@ConnectedSocket() client: Client, @MessageBody() payload: { value: string }) {
    const state = this.stateFor(client);
    if (state && ['👍', '🤔', '😅', '🔥'].includes(payload.value)) this.server.to(state.roomId).emit('reaction:show', { value: payload.value, participantId: this.participantId(client) });
  }

  @SubscribeMessage('report:generate') async report(@ConnectedSocket() client: Client, @MessageBody() payload?: { sections?: ReportOptions }) {
    const state = this.authorized(client, 'PO');
    if (!state) {
      this.emitError(client, 'FORBIDDEN');
      return;
    }
    const report = await this.reports.generate(state.dbRoomId, payload?.sections);
    this.server.to(state.roomId).emit('report:ready', { reportId: report.id });
  }

  private emitParticipantUpdate(state: InternalRoomState, change: PresenceChange) {
    this.server.to(state.roomId).emit('room:participantUpdate', { participant: change.participant, reason: change.reason, ownerId: state.ownerId });
  }

  private broadcastRoom(state: InternalRoomState) {
    const publicState = this.round.toPublicState(state);
    void this.roomStates.save(state.roomId, { ...state, timer: undefined });
    this.server.to(state.roomId).emit('room:state', publicState);
  }

  private emitError(client: Client, code: RoomErrorCode) {
    client.emit('room:error', { code, message: ERROR_MESSAGES[code] ?? code });
  }

  private stateFor(client: Client) {
    const roomId = this.clientRooms.get(client.id);
    return roomId ? this.states.get(roomId) : undefined;
  }

  private participantId(client: Client): string {
    const state = this.stateFor(client);
    const target = (client as any).data?.participantId as string | undefined;
    if (!state) return '';
    if (target && state.participants.some((item) => item.id === target)) return target;
    const userId = (client as any).data?.userId as string | undefined;
    return state.participants.find((item) => item.userId === userId)?.id ?? '';
  }

  private authorized(client: Client, role: 'PO') {
    const state = this.stateFor(client);
    if (!state) return undefined;
    const participant = state.participants.find((item) => item.id === this.participantId(client));
    if (!participant) return undefined;
    return this.authorization.canControlRoom(participant.id, participant.role, state.ownerId, role) ? state : undefined;
  }

  private removeClient(client: Client) {
    const roomId = this.clientRooms.get(client.id);
    if (!roomId) return;
    const state = this.states.get(roomId);
    const participantId = (client as any).data?.participantId as string | undefined;
    if (state && participantId) {
      const change = this.presence.onDisconnect(state, participantId, client.id);
      if (change) {
        this.emitParticipantUpdate(state, change);
        this.broadcastRoom(state);
      }
    }
    this.clientRooms.delete(client.id);
  }

  private async loadState(roomKey: string): Promise<InternalRoomState> {
    const cached = this.states.get(roomKey);
    if (cached) return cached;
    const restored = await this.roomStates.restore(roomKey);
    if (restored?.dbRoomId && restored?.config && restored?.participants && restored?.stories) {
      const state = restored as unknown as InternalRoomState;
      this.states.set(roomKey, state);
      return state;
    }
    const include = { config: true, stories: { orderBy: { order: 'asc' as const } }, participants: { include: { user: true } }, messages: { orderBy: { createdAt: 'asc' as const } } };
    const existing = await this.prisma.room.findFirst({ where: { OR: [{ id: roomKey }, { inviteCode: roomKey.toUpperCase() }] }, include });
    if (!existing) throw new Error('ROOM_NOT_FOUND');
    const room = await this.prisma.room.findUnique({ where: { id: existing.id }, include });
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const rawConfig = room.config
      ? {
          deckType: room.config.deckType as RoomConfig['deckType'],
          deckValues: (room.config.deckValues as VoteValue[]) ?? defaultConfig.deckValues,
          tempoReflexaoSegundos: room.config.tempoReflexaoSegundos,
          tempoDiscussaoSegundos: room.config.tempoDiscussaoSegundos,
          permiteParticipantesIA: room.config.permiteParticipantesIA,
          maxParticipantes: room.config.maxParticipantes,
          votoAnonimo: room.config.votoAnonimo,
          revelacaoAutomatica: room.config.revelacaoAutomatica,
          criterioConsenso: room.config.criterioConsenso as RoomConfig['criterioConsenso'],
          papeisPermitidos: (room.config.papeisPermitidos as ParticipantRole[]) ?? defaultConfig.papeisPermitidos,
        }
      : {};
    const config: RoomConfig = { ...defaultConfig, ...rawConfig };
    const state: InternalRoomState = {
      roomId: roomKey,
      dbRoomId: room.id,
      name: room.name,
      code: room.inviteCode,
      status: room.status as InternalRoomState['status'],
      visibility: room.visibility as InternalRoomState['visibility'],
      passwordHash: room.passwordHash,
      ownerId: room.ownerId,
      config,
      participants: room.participants.map((item) => ({
        id: item.id,
        userId: item.userId,
        name: item.roomDisplayName ?? item.user.name,
        avatar: item.roomAvatarUrl ?? item.user.avatarUrl ?? '',
        role: item.role as ParticipantRole,
        isAI: item.isAI,
        connected: false,
        hasVoted: false,
        status: (item.status === 'inativo' ? 'inativo' : 'ativo') as 'ativo' | 'inativo',
      })),
      stories: room.stories.map((story) => ({ ...story, finalValue: story.finalValue !== null ? (Number.isNaN(Number(story.finalValue)) ? story.finalValue as VoteValue : Number(story.finalValue)) : null })),
      phase: 'lobby',
      votes: [],
      remainingSeconds: null,
      timerType: null,
      messages: room.messages.map((item) => {
        const author = room.participants.find((person) => person.id === item.participantId);
        return {
          id: item.id,
          author: author?.roomDisplayName ?? author?.user.name ?? 'Sistema',
          role: (author?.role as ChatMessage['role']) ?? 'Dev',
          text: item.text,
          type: item.type as ChatMessage['type'],
          createdAt: item.createdAt.toISOString(),
        };
      }),
      roleRequests: await this.getPendingRoleRequests(room.id),
    };
    const activeStory = room.stories.find((item) => item.status === 'em_votacao' || item.status === 'em_discussao');
    if (activeStory) {
      const round = await this.prisma.voteRound.findFirst({ where: { storyId: activeStory.id, endedAt: null }, orderBy: { number: 'desc' as const }, include: { votes: true } });
      state.currentStoryId = activeStory.id;
      state.roundId = round?.id;
      state.phase = activeStory.status === 'em_discussao' ? 'discussao' : 'votacao';
      state.votes = round?.votes.map((vote) => ({ participantId: vote.participantId, participantName: state.participants.find((item) => item.id === vote.participantId)?.name ?? 'Participante', value: Number.isNaN(Number(vote.value)) ? (vote.value as VoteValue) : Number(vote.value) })) ?? [];
      state.participants.forEach((item) => { item.hasVoted = state.votes.some((vote) => vote.participantId === item.id); });
      await this.round.resumeFromStorage(state, round);
    }
    this.states.set(roomKey, state);
    return state;
  }

  private async getPendingRoleRequests(roomId: string) {
    const requests = await this.prisma.roomRoleChangeRequest.findMany({
      where: { roomId, status: 'pending' },
      include: { requester: { include: { user: true } } },
      orderBy: { createdAt: 'asc' as const },
    });
    return requests.map((request) => ({
      id: request.id,
      requesterParticipantId: request.requesterParticipantId,
      requesterName: request.requester.roomDisplayName ?? request.requester.user?.name,
      currentRole: request.currentRole,
      requestedRole: request.requestedRole,
      status: request.status as RoomRoleChangeRequest['status'],
      createdAt: request.createdAt.toISOString(),
      decidedAt: null,
    }));
  }
}