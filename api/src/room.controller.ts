import { Body, Controller, Get, Headers, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { RoomService } from './room.service.js';
import { CreateRoomDto, CreateStoryDto, JoinRoomDto, UpdateRoomProfileDto } from './room.dto.js';
import { AuthorizationService } from './auth/authorization.service.js';

@Controller('rooms')
export class RoomController {
  constructor(private readonly rooms: RoomService, private readonly authorization: AuthorizationService) {}
  @Post() create(@Body() body: CreateRoomDto) { return this.rooms.create(body.name ?? 'Planning Poker', body.visibility ?? 'PUBLIC', body.password); }
  @Get('mine') mine(@Headers('authorization') authorization?: string) {
    const account = this.authorization.accountFromAuthorization(authorization);
    if (!account) throw new UnauthorizedException('UNAUTHENTICATED');
    return this.rooms.mine(account.userId);
  }
  @Get(':id') get(@Param('id') id: string) { return this.rooms.get(id); }
  @Post(':id/join') join(@Param('id') id: string, @Body() body: JoinRoomDto, @Headers('authorization') authorization?: string) {
    const account = this.authorization.accountFromAuthorization(authorization);
    return this.rooms.joinSession(id, body.name, body.avatar, body.role, body.password, account?.userId);
  }
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
