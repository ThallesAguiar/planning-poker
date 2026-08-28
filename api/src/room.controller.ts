import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RoomService } from './room.service.js';

@Controller('rooms')
export class RoomController {
  constructor(private readonly rooms: RoomService) {}
  @Post() create(@Body() body: { name?: string; visibility?: 'PUBLIC' | 'PRIVATE'; password?: string }) { return this.rooms.create(body.name ?? 'Planning Poker', body.visibility ?? 'PUBLIC', body.password); }
  @Get(':id') get(@Param('id') id: string) { return this.rooms.get(id); }
  @Post(':id/stories') addStory(@Param('id') id: string, @Body() body: { title: string; description?: string }) { return this.rooms.addStory(id, body.title, body.description); }
  @Post(':id/report') report(@Param('id') id: string) { return this.rooms.report(id); }
}
