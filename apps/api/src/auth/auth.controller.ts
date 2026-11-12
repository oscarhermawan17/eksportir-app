import { Body, Controller, Get, HttpCode, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from '@balitrade/shared';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env.js';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const ONE_MINUTE_MS = 60_000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ daily: true })
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE_MS } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response): Promise<AuthUser> {
    const { user, token } = await this.auth.register(dto);
    res.cookie(SESSION_COOKIE, token, this.cookieOptions());
    return user;
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ daily: true })
  @Throttle({ default: { limit: 5, ttl: ONE_MINUTE_MS } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<AuthUser> {
    const { user, token } = await this.auth.login(dto);
    res.cookie(SESSION_COOKIE, token, this.cookieOptions());
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    res.clearCookie(SESSION_COOKIE, options);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  /** Saves the user's chosen UI language (only `locale` can be changed here). */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto): Promise<AuthUser> {
    return this.auth.updateMe(user.id, dto);
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/',
      maxAge: this.config.get('JWT_EXPIRES_IN_SECONDS', { infer: true }) * 1000,
    };
  }
}
