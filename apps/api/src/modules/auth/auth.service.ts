import { randomBytes, randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from '@node-rs/argon2';
import {
  createSession,
  findSessionByTokenHash,
  findUserByEmail,
  markLoginFailure,
  markLoginSuccess,
  revokeSession,
  touchSession,
} from '@ai-trading/database';
import { sha256Hex } from '@ai-trading/domain';
import { SESSION_COOKIE } from '../../common/auth/auth.constants.js';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  private get sessionTtlHours(): number {
    return this.config.get<number>('SESSION_TTL_HOURS', 12);
  }

  cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get<boolean>('COOKIE_SECURE', false),
      path: '/',
      maxAge: this.sessionTtlHours * 60 * 60 * 1000,
    };
  }

  cookieName(): string {
    return SESSION_COOKIE;
  }

  hashToken(token: string): string {
    return sha256Hex(token);
  }

  async login(
    email: string,
    password: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResult> {
    const user = await findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== 'active') {
      throw new ForbiddenException('This operator account is not active');
    }

    const valid = await verify(user.passwordHash, password);
    if (!valid) {
      await markLoginFailure(user.id);
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.sessionTtlHours * 60 * 60 * 1000,
    );
    await createSession({
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.hashToken(token),
      ipAddress,
      userAgent,
      expiresAt,
    });
    await markLoginSuccess(user.id);

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }

  async resolveSession(token: string) {
    const row = await findSessionByTokenHash(this.hashToken(token));
    if (!row) return null;
    if (row.session.revokedAt) return null;
    if (!row.session.expiresAt || row.session.expiresAt.getTime() <= Date.now())
      return null;
    if (row.user.status !== 'active') return null;

    await touchSession(row.session.id);

    return {
      session: {
        id: row.session.id,
        expiresAt: row.session.expiresAt,
        issuedAt: row.session.issuedAt,
      },
      user: {
        id: row.user.id,
        email: row.user.email,
        displayName: row.user.displayName,
        role: row.user.role,
      },
    };
  }

  async logout(token: string): Promise<void> {
    await revokeSession(this.hashToken(token));
  }
}
