import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto } from './auth.dto.js';

function bearer(value?: string) {
  const [scheme, token] = value?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('UNAUTHENTICATED');
  return token;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Post('logout')
  logout(@Headers('authorization') authorization?: string) {
    this.auth.logout(bearer(authorization));
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.auth.me(bearer(authorization));
  }
}
