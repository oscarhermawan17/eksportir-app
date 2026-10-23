import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser, Locale } from '@balitrade/shared';
import { hashPassword, verifyPassword } from '../common/password.js';
import { Prisma } from '../generated/prisma/client.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { UpdateMeDto } from './dto/update-me.dto.js';

// Verified against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH_PROMISE = hashPassword('not-a-real-password');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: AuthUser; token: string }> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash: await hashPassword(dto.password),
          name: dto.name,
          phone: dto.phone,
          locale: dto.locale ?? 'en',
          roles: [dto.role ?? 'BUYER'],
          // A public SELLER signup is only an application: the profile starts PENDING until an admin approves it.
          ...(dto.role === 'SELLER'
            ? { sellerProfile: { create: { displayName: dto.name } } }
            : {}),
        },
      });
      return { user: toAuthUser(user), token: await this.sign(user) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<{ user: AuthUser; token: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = await verifyPassword(dto.password, user?.passwordHash ?? (await DUMMY_HASH_PROMISE));
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { user: toAuthUser(user), token: await this.sign(user) };
  }

  /** Verifies the session token and returns the current user from the database. */
  async authenticate(token: string): Promise<AuthUser> {
    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return toAuthUser(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<AuthUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { locale: dto.locale } });
    return toAuthUser(user);
  }

  private sign(user: User): Promise<string> {
    return this.jwt.signAsync({ sub: user.id });
  }
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    locale: user.locale as Locale,
    roles: user.roles,
  };
}
