import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service.js';
import { SessionService } from './auth/session.service.js';

const deck = [1, 2, 3, 5, 8, 13, 20, 40, 100, 'café', '?'];

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService) {}
  async create(name: string, visibility: 'PUBLIC' | 'PRIVATE' = 'PUBLIC', password?: string) {
    if (visibility !== 'PUBLIC' && visibility !== 'PRIVATE') throw new BadRequestException('Invalid room visibility');
    if (visibility === 'PRIVATE' && (!password || password.length < 4)) throw new BadRequestException('Private rooms require a password of at least 4 characters');
    const room = await this.prisma.room.create({ data: { name, inviteCode: randomBytes(3).toString('hex').toUpperCase(), ownerId: 'pending', visibility, passwordHash: visibility === 'PRIVATE' ? await bcrypt.hash(password!, 12) : null } });
    await this.prisma.roomConfig.create({ data: { roomId: room.id, deckType: 'fibonacci', deckValues: deck, papeisPermitidos: ['PO', 'Dev', 'QA', 'ScrumMaster', 'Observador', 'IA_Agente'] } });
    return { id: room.id, code: room.inviteCode, name: room.name, visibility: room.visibility };
  }
  async get(idOrCode: string) {
    const room = await this.prisma.room.findFirst({ where: { OR: [{ id: idOrCode }, { inviteCode: idOrCode.toUpperCase() }] }, include: { config: true, stories: { orderBy: { order: 'asc' } } } });
    if (!room) throw new NotFoundException('Room not found');
    const { passwordHash: _passwordHash, ...safeRoom } = room;
    return safeRoom;
  }
  async addStory(roomId: string, title: string, description = '') { const count = await this.prisma.story.count({ where: { roomId } }); return this.prisma.story.create({ data: { roomId, title, description, order: count + 1 } }); }
  async mine(userId: string) {
    const memberships = await this.prisma.roomParticipant.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { lastSeenAt: 'desc' },
    });
    return memberships.map((membership) => ({
      id: membership.room.id,
      code: membership.room.inviteCode,
      name: membership.room.name,
      status: membership.room.status,
      visibility: membership.room.visibility,
      role: membership.role,
      joinedAt: membership.joinedAt.toISOString(),
      lastSeenAt: membership.lastSeenAt.toISOString(),
      participantId: membership.id,
      isOwner: membership.room.ownerId === membership.id,
    }));
  }

  async joinSession(idOrCode: string, name: string, avatar = '', role = 'Dev', password?: string, accountUserId?: string) {
    const room = await this.prisma.room.findFirst({ where: { OR: [{ id: idOrCode }, { inviteCode: idOrCode.toUpperCase() }] }, include: { config: true } });
    if (!room) throw new NotFoundException('Room not found');
    const existingMembership = accountUserId ? await this.prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: room.id, userId: accountUserId } } }) : null;
    if (!existingMembership && room.visibility === 'PRIVATE' && (!password || !room.passwordHash || !(await bcrypt.compare(password, room.passwordHash)))) throw new BadRequestException('Invalid room access');
    const config = room.config;
    const allowedRoles = (config?.papeisPermitidos as string[] | undefined) ?? ['PO', 'Dev', 'QA', 'ScrumMaster', 'Observador', 'IA_Agente'];
    if (!allowedRoles.includes(role)) throw new BadRequestException('Invalid participant role');
    if (existingMembership) {
      const participant = await this.prisma.roomParticipant.update({
        where: { id: existingMembership.id },
        data: { status: 'ativo', lastSeenAt: new Date() },
      });
      const issued = this.sessions.issueGuest(room.id, participant.id, accountUserId);
      return { token: issued.token, sessionId: issued.sessionId, participantId: participant.id, roomId: room.id, role: participant.role, reusedMembership: true };
    }
    const count = await this.prisma.roomParticipant.count({ where: { roomId: room.id, status: 'ativo' } });
    if (count >= (config?.maxParticipantes ?? 12)) throw new BadRequestException('Room is full');
    if (count === 0) role = 'PO';
    const session = accountUserId ? { sessionId: accountUserId } : this.sessions.issueGuest(room.id);
    const user = accountUserId
      ? await this.prisma.user.findUnique({ where: { id: accountUserId } })
      : await this.prisma.user.create({ data: { id: session.sessionId, name, avatarUrl: avatar, isGuest: true } });
    if (!user) throw new ForbiddenException('UNAUTHENTICATED');
    const identityName = accountUserId ? user.name : name;
    const identityAvatar = accountUserId ? (user.avatarUrl ?? '') : avatar;
    const participant = await this.prisma.roomParticipant.create({
      data: { roomId: room.id, userId: user.id, role: role as any, roomDisplayName: identityName, roomAvatarUrl: identityAvatar },
    });
    if (room.ownerId === 'pending') await this.prisma.room.update({ where: { id: room.id }, data: { ownerId: participant.id } });
    const issued = this.sessions.issueGuest(room.id, participant.id, session.sessionId);
    return { token: issued.token, sessionId: issued.sessionId, participantId: participant.id, roomId: room.id, role: participant.role, reusedMembership: false };
  }

  async rejoinSession(idOrCode: string, userId: string) {
    const room = await this.prisma.room.findFirst({ where: { OR: [{ id: idOrCode }, { inviteCode: idOrCode.toUpperCase() }] } });
    if (!room) throw new NotFoundException('Room not found');
    const participant = await this.prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: room.id, userId } } });
    if (!participant) throw new ForbiddenException('NOT_ROOM_MEMBER');
    await this.prisma.roomParticipant.update({ where: { id: participant.id }, data: { status: 'ativo', lastSeenAt: new Date() } });
    const issued = this.sessions.issueGuest(room.id, participant.id, userId);
    return { token: issued.token, sessionId: issued.sessionId, participantId: participant.id, roomId: room.id, role: participant.role };
  }

  async updateRoomProfile(idOrCode: string, userId: string, input: { name?: string; avatar?: string }) {
    const room = await this.prisma.room.findFirst({ where: { OR: [{ id: idOrCode }, { inviteCode: idOrCode.toUpperCase() }] } });
    if (!room) throw new NotFoundException('Room not found');
    if (!input.name && input.avatar === undefined) throw new BadRequestException('INVALID_INPUT');
    const participant = await this.prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: room.id, userId } } });
    if (!participant) throw new ForbiddenException('FORBIDDEN');
    const updated = await this.prisma.roomParticipant.update({
      where: { id: participant.id },
      data: {
        roomDisplayName: input.name?.trim() || participant.roomDisplayName,
        roomAvatarUrl: input.avatar ?? participant.roomAvatarUrl,
        lastSeenAt: new Date(),
      },
    });
    return { participantId: updated.id, name: updated.roomDisplayName, avatar: updated.roomAvatarUrl, updatedAt: updated.lastSeenAt.toISOString() };
  }

  async listRoleRequests(idOrCode: string, userId: string) {
    const { room, participant } = await this.memberInRoom(idOrCode, userId);
    if (room.ownerId !== participant.id) throw new ForbiddenException('FORBIDDEN');
    const requests = await this.prisma.roomRoleChangeRequest.findMany({
      where: { roomId: room.id, status: 'pending' },
      include: { requester: { include: { user: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return requests.map((request) => ({
      id: request.id,
      requesterParticipantId: request.requesterParticipantId,
      requesterName: request.requester.roomDisplayName ?? request.requester.user.name,
      currentRole: request.currentRole,
      requestedRole: request.requestedRole,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() ?? null,
    }));
  }

  async requestRoleChange(roomId: string, participantId: string, requestedRole: string) {
    const participant = await this.prisma.roomParticipant.findUnique({ where: { id: participantId }, include: { user: true } });
    if (!participant || participant.roomId !== roomId) throw new ForbiddenException('FORBIDDEN');
    if (participant.role === requestedRole) throw new BadRequestException('INVALID_ROLE_REQUEST');
    const request = await this.prisma.roomRoleChangeRequest.create({
      data: {
        roomId,
        requesterParticipantId: participant.id,
        currentRole: participant.role,
        requestedRole: requestedRole as any,
      },
    });
    return {
      id: request.id,
      requesterParticipantId: participant.id,
      requesterName: participant.roomDisplayName ?? participant.user.name,
      currentRole: request.currentRole,
      requestedRole: request.requestedRole,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      decidedAt: null,
    };
  }

  async decideRoleChange(roomId: string, hostParticipantId: string, requestId: string, decision: 'approved' | 'rejected') {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.ownerId !== hostParticipantId) throw new ForbiddenException('FORBIDDEN');
    const request = await this.prisma.roomRoleChangeRequest.findUnique({ where: { id: requestId } });
    if (!request || request.roomId !== roomId || request.status !== 'pending') throw new NotFoundException('PROFILE_REQUEST_NOT_FOUND');
    const decidedAt = new Date();
    const updated = await this.prisma.roomRoleChangeRequest.update({
      where: { id: request.id },
      data: { status: decision, decidedByParticipantId: hostParticipantId, decidedAt },
    });
    if (decision === 'approved') {
      await this.prisma.roomParticipant.update({
        where: { id: request.requesterParticipantId },
        data: { role: request.requestedRole, lastSeenAt: decidedAt },
      });
    }
    return {
      requestId: updated.id,
      requesterParticipantId: updated.requesterParticipantId,
      decision,
      decidedAt: decidedAt.toISOString(),
      requestedRole: updated.requestedRole,
    };
  }

  private async memberInRoom(idOrCode: string, userId: string) {
    const room = await this.prisma.room.findFirst({ where: { OR: [{ id: idOrCode }, { inviteCode: idOrCode.toUpperCase() }] } });
    if (!room) throw new NotFoundException('Room not found');
    const participant = await this.prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: room.id, userId } } });
    if (!participant) throw new ForbiddenException('FORBIDDEN');
    return { room, participant };
  }
  async report(roomId: string) { const room = await this.get(roomId); const summary = room.stories.map((story) => ({ title: story.title, value: story.finalValue, rounds: story.rounds, seconds: story.totalSeconds, criterion: story.criterion })); return this.prisma.sprintReport.create({ data: { roomId: room.id, summary } }); }
}
