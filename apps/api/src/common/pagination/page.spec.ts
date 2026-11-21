import { describe, expect, it } from 'vitest';
import { backwardPage, forwardPage, offsetPage, olderPage } from './page.js';

interface Row {
  key: string;
  id: string;
}

const keyOf = (row: Row) => row.key;
const idOf = (row: Row) => row.id;

describe('pagination pages', () => {
  it('builds an offset page with exact total and hasMore', () => {
    const page = offsetPage([{ id: 'a' }, { id: 'b' }], 5, 2, 2);
    expect(page.page).toMatchObject({
      mode: 'offset',
      limit: 2,
      total: 5,
      hasMore: true,
      offset: 2,
      nextCursor: null,
      prevCursor: null,
    });
  });

  it('builds a forward cursor page with both directions', () => {
    const page = forwardPage({
      items: [
        { key: 'k3', id: '3' },
        { key: 'k2', id: '2' },
      ],
      total: 10,
      limit: 2,
      hasExtra: true,
      fingerprint: 'f',
      keyOf,
      idOf,
      hadAfter: true,
    });

    expect(page.page.hasMore).toBe(true);
    expect(page.page.nextCursor).toBeTruthy();
    expect(page.page.prevCursor).toBeTruthy();
    expect(page.page.offset).toBeNull();
  });

  it('does not offer a newer page on the first page', () => {
    const page = forwardPage({
      items: [{ key: 'k1', id: '1' }],
      total: 1,
      limit: 2,
      hasExtra: false,
      fingerprint: 'f',
      keyOf,
      idOf,
      hadAfter: false,
    });

    expect(page.page.nextCursor).toBeNull();
    expect(page.page.prevCursor).toBeNull();
    expect(page.page.hasMore).toBe(false);
  });

  it('keeps the older cursor when moving backwards', () => {
    const page = backwardPage({
      items: [
        { key: 'k4', id: '4' },
        { key: 'k3', id: '3' },
      ],
      total: 10,
      limit: 2,
      hasExtra: true,
      fingerprint: 'f',
      keyOf,
      idOf,
    });

    expect(page.page.nextCursor).toBeTruthy();
    expect(page.page.prevCursor).toBeTruthy();
  });

  it('paginates only toward older events', () => {
    const page = olderPage({
      items: [
        { key: '1', id: '1' },
        { key: '2', id: '2' },
      ],
      total: 5,
      limit: 2,
      hasExtra: true,
      fingerprint: 'f',
      keyOf,
      idOf,
    });

    expect(page.page.nextCursor).toBeTruthy();
    expect(page.page.prevCursor).toBeNull();
  });
});
