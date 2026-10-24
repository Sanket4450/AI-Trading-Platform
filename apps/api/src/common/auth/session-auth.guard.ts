import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../modules/auth/auth.service.js';
import { IS_PUBLIC_KEY, SESSION_COOKIE } from './auth.constants.js';

interface RequestWithSession {
  cookies?: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
  user?: unknown;
  session?: unknown;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const session = await this.authService.resolveSession(token);
    if (!session) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    request.user = { ...session.user, sessionId: session.session.id };
    request.session = session.session;
    return true;
  }

  private extractToken(request: RequestWithSession): string | null {
    const cookie = request.cookies?.[SESSION_COOKIE];
    if (cookie) return cookie;

    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (value?.startsWith('Bearer ')) {
      return value.slice('Bearer '.length).trim();
    }
    return null;
  }
}
