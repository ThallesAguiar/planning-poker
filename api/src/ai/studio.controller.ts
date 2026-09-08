import { Body, Controller, Get, Headers, Post, Put, UnauthorizedException } from '@nestjs/common';
import { SessionService } from '../auth/session.service.js';
import { SaveAgentDto, SaveProviderDto, SaveRulesDto, TestProviderDto } from './ai-studio.dto.js';
import { StudioService } from './studio.service.js';

function bearer(value?: string) {
  const [scheme, token] = value?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('UNAUTHENTICATED');
  return token;
}

@Controller('ai-studio')
export class StudioController {
  constructor(private readonly studio: StudioService, private readonly sessions: SessionService) {}

  private accountUserId(authorization?: string) {
    try {
      return this.sessions.verifyAccount(bearer(authorization)).userId;
    } catch {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }
  }

  @Get()
  get(@Headers('authorization') authorization?: string) {
    return this.studio.getForUser(this.accountUserId(authorization));
  }

  @Put('provider')
  saveProvider(@Body() body: SaveProviderDto, @Headers('authorization') authorization?: string) {
    return this.studio.saveProvider(this.accountUserId(authorization), body);
  }

  @Post('provider/test')
  testProvider(@Body() body: TestProviderDto, @Headers('authorization') authorization?: string) {
    return this.studio.testProvider(this.accountUserId(authorization), body);
  }

  @Put('agent')
  saveAgent(@Body() body: SaveAgentDto, @Headers('authorization') authorization?: string) {
    return this.studio.saveAgent(this.accountUserId(authorization), body);
  }

  @Put('rules')
  saveRules(@Body() body: SaveRulesDto, @Headers('authorization') authorization?: string) {
    return this.studio.saveRules(this.accountUserId(authorization), body.contents);
  }
}