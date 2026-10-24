import { describe, expect, it } from 'vitest';
import { mapUpstoxOrderStatus } from './order-status.js';
import { parseUpstoxTimestamp } from './timestamp.js';

describe('Upstox payload conventions', () => {
  it('maps every documented order status', () => {
    expect(mapUpstoxOrderStatus('put order req received')).toBe('submitted');
    expect(mapUpstoxOrderStatus('validation pending')).toBe('submitted');
    expect(mapUpstoxOrderStatus('open')).toBe('open');
    expect(mapUpstoxOrderStatus('trigger pending')).toBe('open');
    expect(mapUpstoxOrderStatus('partially filled')).toBe('partially_filled');
    expect(mapUpstoxOrderStatus('complete')).toBe('filled');
    expect(mapUpstoxOrderStatus('cancelled')).toBe('cancelled');
    expect(mapUpstoxOrderStatus('rejected')).toBe('rejected');
    expect(mapUpstoxOrderStatus('modify pending')).toBe('submitted');
    expect(mapUpstoxOrderStatus('not modified')).toBe('open');
    expect(mapUpstoxOrderStatus('something new')).toBe('unknown');
  });

  it('parses a timezone-less order timestamp as Asia/Kolkata', () => {
    const parsed = parseUpstoxTimestamp('2023-10-19 09:23:23');
    expect(parsed.toISOString()).toBe('2023-10-19T03:53:23.000Z');
  });

  it('respects an explicit offset', () => {
    expect(parseUpstoxTimestamp('2023-10-19T09:23:23+05:30').toISOString()).toBe(
      '2023-10-19T03:53:23.000Z',
    );
  });

  it('rejects an invalid timestamp', () => {
    expect(() => parseUpstoxTimestamp('not-a-date')).toThrow(/Invalid Upstox timestamp/);
  });
});
