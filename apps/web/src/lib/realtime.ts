'use client';

import { io, type Socket } from 'socket.io-client';
import type { JobBroadcast } from '@ai-trading/domain';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:8000';

type Listener = (message: JobBroadcast) => void;

let socket: Socket | null = null;
const listeners = new Set<Listener>();

function ensureSocket(): Socket {
  if (socket) return socket;

  socket = io(`${SOCKET_URL}/jobs`, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
  socket.on('job', (message: JobBroadcast) => {
    for (const listener of listeners) listener(message);
  });
  return socket;
}

/**
 * One connection per dashboard, shared by every mounted subscriber. The server render stays
 * authoritative; socket messages only patch the rows, timeline and call table already visible.
 */
export function connectJobs(onMessage: Listener): () => void {
  const connection = ensureSocket();
  listeners.add(onMessage);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    listeners.delete(onMessage);
    if (listeners.size === 0) {
      connection.close();
      socket = null;
    }
  };
}
