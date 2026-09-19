import { Body, Controller, Get, Headers, Patch, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto, UpdateProfileDto } from './auth.dto.js';

function bearer(value?: string) {
  const [scheme, token] = value?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('UNAUTHENTICATED');
  return token;
}

function cookieValue(request: Request, name: string) {
  const prefix = `${name}=`;
  return request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) {
    return this.sendSession(await this.auth.register(body), response);
  }

  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.sendSession(await this.auth.login(body), response);
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = cookieValue(request, 'planning_poker_refresh');
    if (!token) throw new UnauthorizedException('UNAUTHENTICATED');
    return this.sendSession(await this.auth.refresh(token), response);
  }

  @Post('logout')
  async logout(@Headers('authorization') authorization: string | undefined, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined, cookieValue(request, 'planning_poker_refresh'));
    response.clearCookie('planning_poker_refresh', { path: '/auth' });
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.auth.me(bearer(authorization));
  }

  @Patch('me')
  updateMe(@Body() body: UpdateProfileDto, @Headers('authorization') authorization?: string) {
    return this.auth.updateProfile(bearer(authorization), body);
  }

  private sendSession(session: Awaited<ReturnType<AuthService['login']>>, response: Response) {
    response.cookie('planning_poker_refresh', session.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.REFRESH_COOKIE_SECURE === 'true',
      path: '/auth',
      maxAge: Number(process.env.REFRESH_SESSION_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000,
    });
    const { refreshToken: _refreshToken, ...body } = session;
    return body;
  }
}
