import { describe, expect, it } from 'vitest';
import { backLinkFor, detailHref, originHref, safeReturnPath } from './navigation';

describe('originHref', () => {
  it('keeps repeated filter values and drops the navigation marker', () => {
    expect(
      originHref('/jobs', {
        status: ['queued', 'failed'],
        search: 'sync',
        from: '/instruments',
        empty: '',
      }),
    ).toBe('/jobs?status=queued&status=failed&search=sync');
  });

  it('returns the bare path when no filter is active', () => {
    expect(originHref('/instruments', {})).toBe('/instruments');
  });
});

describe('detailHref', () => {
  it('encodes the origin so its filters survive the round trip', () => {
    expect(detailHref('/instruments/abc', '/instruments?search=infy')).toBe(
      '/instruments/abc?from=%2Finstruments%3Fsearch%3Dinfy',
    );
  });
});

describe('safeReturnPath', () => {
  it.each(['/instruments?search=infy', '/issues', '/issues?scope=instrument', '/settings', '/'])(
    'accepts %s',
    (value) => {
      expect(safeReturnPath(value)).toBe(value);
    },
  );

  it.each([
    'https://evil.example.com',
    '//evil.example.com',
    '/login',
    '/instruments/abc',
    '/instruments?search=infy#frag',
    '/instruments\\..\\secret',
    '',
  ])('rejects %s', (value) => {
    expect(safeReturnPath(value)).toBeNull();
  });

  it('rejects repeated markers and missing values', () => {
    expect(safeReturnPath(['/jobs', '/instruments'])).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
  });
});

describe('backLinkFor', () => {
  it('returns to the origin page with its filters and names it', () => {
    expect(backLinkFor('/instruments?search=infy', '/instruments')).toEqual({
      href: '/instruments?search=infy',
      label: 'Back to instruments',
    });
  });

  it('falls back when the marker is missing', () => {
    expect(backLinkFor(undefined, '/instruments')).toEqual({
      href: '/instruments',
      label: 'Back to instruments',
    });
  });

  it('falls back when the marker is not a list page', () => {
    expect(backLinkFor('/instruments/abc', '/jobs')).toEqual({
      href: '/jobs',
      label: 'Back to jobs',
    });
  });
});
