import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RoomService } from './room.service.js';
import { CreateRoomDto, CreateStoryDto, JoinRoomDto } from './room.dto.js';

@Controller('rooms')
export class RoomController {
  constructor(private readonly rooms: RoomService) {}
  @Post() create(@Body() body: CreateRoomDto) { return this.rooms.create(body.name ?? 'Planning Poker', body.visibility ?? 'PUBLIC', body.password); }
  @Get(':id') get(@Param('id') id: string) { return this.rooms.get(id); }
  @Post(':id/join') join(@Param('id') id: string, @Body() body: JoinRoomDto) { return this.rooms.joinSession(id, body.name, body.avatar, body.role, body.password); }
  @Post(':id/stories') addStory(@Param('id') id: string, @Body() body: CreateStoryDto) { return this.rooms.addStory(id, body.title, body.description); }
}
