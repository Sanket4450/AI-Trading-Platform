import { describe, expect, it } from 'vitest';
import { upstreamUrl } from './api-proxy-target';

describe('upstreamUrl', () => {
  it('maps API segments onto the configured base', () => {
    expect(upstreamUrl(['instruments', 'abc', 'status'], '?limit=200')).toMatch(
      /\/instruments\/abc\/status\?limit=200$/,
    );
  });

  it('rejects paths that could escape the API base', () => {
    expect(upstreamUrl([])).toBeNull();
    expect(upstreamUrl(['..'])).toBeNull();
    expect(upstreamUrl(['instruments', '..', 'settings'])).toBeNull();
    expect(upstreamUrl(['instruments', '.'])).toBeNull();
    expect(upstreamUrl(['instruments', ''])).toBeNull();
    expect(upstreamUrl(['instruments', 'a/b'])).toBeNull();
    expect(upstreamUrl(['instruments', 'a\\b'])).toBeNull();
  });
});
