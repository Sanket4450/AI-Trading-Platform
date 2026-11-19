import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type OnGatewayConnection,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Redis } from 'ioredis';
import { JOB_EVENTS_CHANNEL, type JobBroadcast } from '@ai-trading/domain';
import { AuthService } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../../common/auth/auth.constants.js';

const webOrigins = (process.env.WEB_URL ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function cookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Realtime job fan-out. The worker publishes ledger facts to Redis; this gateway forwards them
 * to authenticated dashboards. The HTTP response remains the source of truth on first render.
 */
@WebSocketGateway({
  namespace: '/jobs',
  cors: { origin: webOrigins, credentials: true },
})
export class JobsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(JobsGateway.name);
  private readonly redis: Redis;

  @WebSocketServer()
  server!: Server;

  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      { maxRetriesPerRequest: 1 },
    );
    this.redis.on('error', (error) => {
      this.logger.warn(
        `Job gateway Redis error: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  afterInit(): void {
    void this.redis
      .subscribe(JOB_EVENTS_CHANNEL)
      .then(() => this.logger.log('Subscribed to the job event channel'))
      .catch((error) => {
        this.logger.warn(
          `Job gateway subscription failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

    this.redis.on('message', (_channel, payload) => {
      try {
        const message = JSON.parse(payload) as JobBroadcast;
        this.server.emit('job', message);
      } catch {
        // A malformed broadcast is dropped; the next HTTP read reconciles the view.
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const header = client.handshake.headers.cookie;
    const token =
      cookieToken(header) ??
      (typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null) ??
      (typeof client.handshake.query?.token === 'string'
        ? client.handshake.query.token
        : null);

    if (!token) {
      client.disconnect(true);
      return;
    }

    const session = await this.authService.resolveSession(token);
    if (!session) {
      client.disconnect(true);
      return;
    }
  }
}
