import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  filterFingerprint,
  makeCursor,
  parseTimestampCursor,
  readCursor,
  readDirectionalCursor,
} from './cursor.js';

describe('pagination cursor', () => {
  const fingerprint = filterFingerprint({ scope: 'test', status: ['failed'] });

  it('round-trips a key and id', () => {
    const cursor = makeCursor(fingerprint, '2026-11-21T10:00:00.000Z', 'abc');
    expect(readCursor(cursor, fingerprint)).toEqual({
      key: '2026-11-21T10:00:00.000Z',
      id: 'abc',
    });
  });

  it('rejects a cursor from another filter set', () => {
    const cursor = makeCursor(fingerprint, '2026-11-21T10:00:00.000Z', 'abc');
    const other = filterFingerprint({ scope: 'test', status: ['running'] });
    expect(() => readCursor(cursor, other)).toThrow(BadRequestException);
  });

  it('rejects malformed and oversized cursors', () => {
    expect(() => readCursor('not-a-cursor', fingerprint)).toThrow(BadRequestException);
    expect(() => readCursor('a'.repeat(2000), fingerprint)).toThrow(BadRequestException);
  });

  it('rejects using after and before together', () => {
    const cursor = makeCursor(fingerprint, '2026-11-21T10:00:00.000Z', 'abc');
    expect(() =>
      readDirectionalCursor({ after: cursor, before: cursor }, fingerprint),
    ).toThrow(BadRequestException);
  });

  it('rejects a non-timestamp key', () => {
    expect(() => parseTimestampCursor({ key: 'not-a-date', id: 'abc' })).toThrow(
      BadRequestException,
    );
  });
});
