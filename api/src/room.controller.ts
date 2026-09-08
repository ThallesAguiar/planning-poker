import { Body, Controller, Get, Headers, Param, Patch, Post, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { RoomService } from './room.service.js';
import { CreateRoomDto, CreateStoryDto, JoinRoomDto, UpdateRoomProfileDto } from './room.dto.js';
import { AuthorizationService } from './auth/authorization.service.js';

@Controller('rooms')
export class RoomController {
  constructor(private readonly rooms: RoomService, private readonly authorization: AuthorizationService) {}
  @Post() create(@Body() body: CreateRoomDto) { return this.rooms.create(body.name ?? 'Planning Poker', body.visibility ?? 'PUBLIC', body.password, body.config); }
  @Get('mine') mine(@Headers('authorization') authorization?: string) {
    const account = this.authorization.accountFromAuthorization(authorization);
    if (!account) throw new UnauthorizedException('UNAUTHENTICATED');
    return this.rooms.mine(account.userId);
  }
  @Get(':id') get(@Param('id') id: string) { return this.rooms.get(id); }
  @Post(':id/join') async join(@Param('id') id: string, @Body() body: JoinRoomDto, @Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) response: Response) {
    const account = this.authorization.accountFromAuthorization(authorization);
    const result = await this.rooms.joinSession(id, body.name, body.avatar, body.role, body.password, account?.userId, body.sessionId);
    if ('status' in result && result.status === 'pending') response.status(202);
    return result;
  }
  @Get(':id/join-requests/:requestId') joinRequest(@Param('id') id: string, @Param('requestId') requestId: string) { return this.rooms.getJoinRequestStatus(id, requestId); }
  @Post(':id/rejoin') rejoin(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    const account = this.authorization.accountFromAuthorization(authorization);
    if (!account) throw new UnauthorizedException('UNAUTHENTICATED');
    return this.rooms.rejoinSession(id, account.userId);
  }
  @Patch(':id/members/me') updateMe(@Param('id') id: string, @Body() body: UpdateRoomProfileDto, @Headers('authorization') authorization?: string) {
    const account = this.authorization.accountFromAuthorization(authorization);
    if (!account) throw new UnauthorizedException('UNAUTHENTICATED');
    return this.rooms.updateRoomProfile(id, account.userId, body);
  }
  @Get(':id/profile-requests') profileRequests(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    const account = this.authorization.accountFromAuthorization(authorization);
    if (!account) throw new UnauthorizedException('UNAUTHENTICATED');
    return this.rooms.listRoleRequests(id, account.userId);
  }
  @Post(':id/stories') addStory(@Param('id') id: string, @Body() body: CreateStoryDto) { return this.rooms.addStory(id, body.title, body.description); }
}
