import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Put, UnauthorizedException } from '@nestjs/common';
import { SessionService } from '../auth/session.service.js';
import { PrismaService } from '../prisma.service.js';
import { RoomStudioService } from './room-studio.service.js';
import { SaveRoomAgentDto, SaveRoomProviderDto, SaveRoomRulesDto, TestRoomProviderDto } from './room-ai-studio.dto.js';

function bearer(value?: string) {
  const [scheme, token] = value?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('UNAUTHENTICATED');
  return token;
}

@Controller('rooms/:id/ai-studio')
export class RoomStudioController {
  constructor(
    private readonly studio: RoomStudioService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  private accountUserId(authorization?: string) {
    try {
      return this.sessions.verifyAccount(bearer(authorization)).userId;
    } catch {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }
  }

  /** Só o dono da mesa (autenticado em conta) lê/escreve o studio da sala. Retorna o roomId canônico. */
  private async assertRoomOwner(roomIdOrCode: string, userId: string): Promise<string> {
    const room = await this.prisma.room.findFirst({ where: { OR: [{ id: roomIdOrCode }, { inviteCode: roomIdOrCode.toUpperCase() }] } });
    if (!room) throw new ForbiddenException('FORBIDDEN');
    if (!room.ownerId || room.ownerId === 'pending') throw new ForbiddenException('FORBIDDEN');
    const participant = await this.prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: room.id, userId } } });
    if (!participant || room.ownerId !== participant.id) throw new ForbiddenException('FORBIDDEN');
    return room.id;
  }

  @Get()
  async get(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    const roomId = await this.assertRoomOwner(id, this.accountUserId(authorization));
    return this.studio.getForRoom(roomId);
  }

  @Put('provider')
  async saveProvider(@Param('id') id: string, @Body() body: SaveRoomProviderDto, @Headers('authorization') authorization?: string) {
    const roomId = await this.assertRoomOwner(id, this.accountUserId(authorization));
    return this.studio.saveProvider(roomId, body);
  }

  @Post('provider/test')
  async testProvider(@Param('id') id: string, @Body() body: TestRoomProviderDto, @Headers('authorization') authorization?: string) {
    const roomId = await this.assertRoomOwner(id, this.accountUserId(authorization));
    return this.studio.testProvider(roomId, body);
  }

  @Put('agent')
  async saveAgent(@Param('id') id: string, @Body() body: SaveRoomAgentDto, @Headers('authorization') authorization?: string) {
    const roomId = await this.assertRoomOwner(id, this.accountUserId(authorization));
    return this.studio.saveAgent(roomId, body);
  }

  @Put('rules')
  async saveRules(@Param('id') id: string, @Body() body: SaveRoomRulesDto, @Headers('authorization') authorization?: string) {
    const roomId = await this.assertRoomOwner(id, this.accountUserId(authorization));
    return this.studio.saveRules(roomId, body.contents);
  }
}