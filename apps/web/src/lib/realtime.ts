'use client';

import { io, type Socket } from 'socket.io-client';
import type { JobBroadcast } from '@ai-trading/domain';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:8000';

/**
 * One connection per mounted dashboard. The server render stays authoritative; socket
 * messages only patch the rows and timeline that are already visible.
 */
export function connectJobs(onMessage: (message: JobBroadcast) => void): () => void {
  const socket: Socket = io(`${SOCKET_URL}/jobs`, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
  });

  socket.on('job', onMessage);
  return () => socket.close();
}
