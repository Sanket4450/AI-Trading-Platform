import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth/public.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

function clientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  return request.ip || request.socket.remoteAddress || '127.0.0.1';
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      body.email,
      body.password,
      clientIp(request),
      request.headers['user-agent'] ?? 'unknown',
    );

    response.cookie(
      this.authService.cookieName(),
      result.token,
      this.authService.cookieOptions(),
    );

    return result;
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[this.authService.cookieName()] as
      string | undefined;
    const bearer = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice('Bearer '.length).trim()
      : undefined;
    const active = token ?? bearer;
    if (active) {
      await this.authService.logout(active);
    }
    response.clearCookie(this.authService.cookieName(), { path: '/' });
  }

  @ApiBearerAuth()
  @Get('session')
  session(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
