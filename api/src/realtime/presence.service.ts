import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import type { InternalRoomState, InternalParticipant } from './room.types.js';

export type PresenceChange = {
  participant: InternalParticipant;
  reason: 'joined' | 'left' | 'disconnected' | 'reconnected' | 'removed' | 'status' | 'owner' | 'role';
  socketIds?: string[];
};

@Injectable()
export class PresenceService {
  private readonly participantSockets = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  materialize(state: InternalRoomState, participant: InternalParticipant) {
    const existing = state.participants.find((item) => item.id === participant.id);
    let next: InternalParticipant = {
      id: participant.id,
      userId: participant.userId,
      name: participant.name,
      avatar: participant.avatar,
      role: participant.role,
      isAI: participant.isAI,
      connected: existing?.connected ?? participant.connected ?? false,
      hasVoted: existing?.hasVoted ?? state.votes.some((vote) => vote.participantId === participant.id),
      status: participant.status,
    };
    state.participants = state.participants.filter((item) => item.id !== participant.id);
    state.participants.push(next);
    return next;
  }

  connectParticipant(state: InternalRoomState, participantId: string, socketId: string) {
    const sockets = this.participantSockets.get(participantId) ?? new Set<string>();
    sockets.add(socketId);
    this.participantSockets.set(participantId, sockets);
    const participant = state.participants.find((item) => item.id === participantId);
    if (participant) participant.connected = true;
    return participant;
  }

  dedupe(state: InternalRoomState, participantId: string, keepSocketId: string): string[] {
    const sockets = this.participantSockets.get(participantId);
    if (!sockets || sockets.size <= 1) return [];
    const stale: string[] = [];
    for (const socketId of sockets) {
      if (socketId !== keepSocketId) stale.push(socketId);
    }
    stale.forEach((socketId) => sockets.delete(socketId));
    return stale;
  }

  onDisconnect(state: InternalRoomState, participantId: string, socketId: string): PresenceChange | null {
    const sockets = this.participantSockets.get(participantId);
    sockets?.delete(socketId);
    if (sockets && sockets.size > 0) return null;
    this.participantSockets.delete(participantId);
    const participant = state.participants.find((item) => item.id === participantId);
    if (!participant) return null;
    participant.connected = false;
    return { participant: { ...participant }, reason: 'disconnected' };
  }

  markOffline(state: InternalRoomState, participantId: string): InternalParticipant | null {
    const participant = state.participants.find((item) => item.id === participantId);
    if (!participant) return null;
    participant.connected = false;
    return { ...participant };
  }

  async remove(state: InternalRoomState, participantId: string): Promise<PresenceChange | null> {
    const participant = state.participants.find((item) => item.id === participantId);
    if (!participant) return null;
    await this.prisma.roomParticipant.delete({ where: { id: participantId } });
    const sockets = this.participantSockets.get(participantId);
    const socketIds = sockets ? [...sockets] : [];
    this.participantSockets.delete(participantId);
    state.participants = state.participants.filter((item) => item.id !== participantId);
    state.votes = state.votes.filter((vote) => vote.participantId !== participantId);
    return { participant, reason: 'removed', socketIds };
  }

  async setStatus(state: InternalRoomState, participantId: string, status: 'ativo' | 'inativo'): Promise<PresenceChange | null> {
    const participant = state.participants.find((item) => item.id === participantId);
    if (!participant) return null;
    await this.prisma.roomParticipant.update({ where: { id: participantId }, data: { status } });
    participant.status = status;
    if (status === 'inativo') participant.connected = false;
    return { participant: { ...participant }, reason: 'status' };
  }

  async transferOwner(state: InternalRoomState, requesterId: string, nextParticipantId: string): Promise<PresenceChange | null> {
    const requester = state.participants.find((item) => item.id === requesterId);
    const next = state.participants.find((item) => item.id === nextParticipantId);
    if (!requester || !next || requesterId === nextParticipantId) return null;
    state.ownerId = nextParticipantId;
    if (next.role !== 'PO') {
      next.role = 'PO';
      await this.prisma.roomParticipant.update({ where: { id: next.id }, data: { role: 'PO' } });
    }
    await this.prisma.room.update({ where: { id: state.dbRoomId }, data: { ownerId: nextParticipantId } });
    return { participant: { ...next }, reason: 'owner' };
  }

  socketCount(participantId: string) {
    return this.participantSockets.get(participantId)?.size ?? 0;
  }
}