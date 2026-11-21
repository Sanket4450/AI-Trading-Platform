import { BadRequestException } from '@nestjs/common';
import {
  canonicalJson,
  PAGINATION_CURSOR_VERSION,
  PAGINATION_MAX_CURSOR_LENGTH,
  sha256Hex,
} from '@ai-trading/domain';

/** Sort value and unique tie-break of the last row on a page. */
export interface CursorKey {
  key: string;
  id: string;
}

/**
 * Fingerprint of the filter set. A cursor only continues the exact query that produced it, so a
 * stale cursor cannot return rows from a different filter.
 */
export function filterFingerprint(filters: Record<string, unknown>): string {
  return sha256Hex(canonicalJson(filters)).slice(0, 16);
}

export function makeCursor(fingerprint: string, key: string, id: string): string {
  return Buffer.from(
    JSON.stringify({ v: PAGINATION_CURSOR_VERSION, k: key, i: id, f: fingerprint }),
    'utf8',
  ).toString('base64url');
}

export function readCursor(value: string | undefined, fingerprint: string): CursorKey | undefined {
  if (!value) return undefined;
  if (value.length > PAGINATION_MAX_CURSOR_LENGTH) {
    throw new BadRequestException('Pagination cursor is too long');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('Pagination cursor is malformed');
  }

  const payload = parsed as Record<string, unknown> | null;
  if (
    !payload ||
    payload.v !== PAGINATION_CURSOR_VERSION ||
    typeof payload.k !== 'string' ||
    typeof payload.i !== 'string' ||
    payload.f !== fingerprint
  ) {
    throw new BadRequestException('Pagination cursor does not match this query');
  }

  return { key: payload.k, id: payload.i };
}

export function readDirectionalCursor(
  query: { after?: string; before?: string },
  fingerprint: string,
): { after?: CursorKey; before?: CursorKey } {
  if (query.after && query.before) {
    throw new BadRequestException('Use either after or before, not both');
  }
  return {
    after: readCursor(query.after, fingerprint),
    before: readCursor(query.before, fingerprint),
  };
}

export function parseTimestampCursor(cursor: CursorKey): { createdAt: Date; id: string } {
  const createdAt = new Date(cursor.key);
  if (Number.isNaN(createdAt.getTime())) {
    throw new BadRequestException('Pagination cursor has an invalid timestamp');
  }
  return { createdAt, id: cursor.id };
}
