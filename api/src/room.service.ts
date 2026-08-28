import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service.js';

const deck = [1, 2, 3, 5, 8, 13, 20, 40, 100, 'café', '?'];

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}
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
  async report(roomId: string) { const room = await this.get(roomId); const summary = room.stories.map((story) => ({ title: story.title, value: story.finalValue, rounds: story.rounds, seconds: story.totalSeconds, criterion: story.criterion })); return this.prisma.sprintReport.create({ data: { roomId: room.id, summary } }); }
}
