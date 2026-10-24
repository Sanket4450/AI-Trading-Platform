import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

export interface RequestMeta {
  requestId: string;
  ipAddress: string;
  userAgent: string;
}

export function requestMeta(request: Request): RequestMeta {
  const forwarded = request.headers['x-forwarded-for'];
  const forwardedIp =
    typeof forwarded === 'string' && forwarded.length > 0
      ? forwarded.split(',')[0]!.trim()
      : null;
  const requestIdHeader = request.headers['x-request-id'];
  const requestId =
    typeof requestIdHeader === 'string' && requestIdHeader.length > 0
      ? requestIdHeader
      : randomUUID();

  return {
    requestId,
    ipAddress:
      forwardedIp ?? request.ip ?? request.socket.remoteAddress ?? '127.0.0.1',
    userAgent: request.headers['user-agent'] ?? 'unknown',
  };
}
