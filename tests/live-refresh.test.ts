import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SOURCES, SOURCE_LIST } from '@/lib/config/sources';
import {
  LIVE_SOURCE_IDS,
  LIVE_THROTTLE_MS,
  isLiveSource,
  markRefreshed,
  refreshMany,
  refreshSource,
  shouldRefresh,
} from '@/lib/live';

/**
 * The browser refresh is what keeps the site current between deployments, so
 * these tests cover the two things that would quietly break it: fetching a
 * source that was never cleared for browser access, and a throttle that either
 * never lets a refresh through or lets every navigation hammer a publisher.
 */

const ARTICLE = {
  id: 1,
  link: 'https://dailybruin.com/2026/09/05/a-story/',
  slug: 'a-story',
  date_gmt: '2026-09-05T10:00:00',
  title: { rendered: 'A story from the API' },
  excerpt: { rendered: '<p>An excerpt.</p>' },
};

function mockStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  });
  return data;
}

beforeEach(() => {
  mockStorage();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('throttle', () => {
  it('allows the first refresh in a tab', () => {
    expect(shouldRefresh('daily-bruin')).toBe(true);
  });

  it('blocks a repeat within the window and allows one after it', () => {
    const now = Date.parse('2026-09-05T12:00:00.000Z');
    markRefreshed('daily-bruin', now);

    expect(shouldRefresh('daily-bruin', now + 1000)).toBe(false);
    expect(shouldRefresh('daily-bruin', now + LIVE_THROTTLE_MS)).toBe(false);
    expect(shouldRefresh('daily-bruin', now + LIVE_THROTTLE_MS + 1)).toBe(true);
  });

  it('throttles each source independently', () => {
    const now = Date.parse('2026-09-05T12:00:00.000Z');
    markRefreshed('daily-bruin', now);

    expect(shouldRefresh('daily-bruin', now + 1000)).toBe(false);
    expect(shouldRefresh('athletics', now + 1000)).toBe(true);
  });

  it('refreshes rather than blocks when storage is unusable or corrupt', () => {
    // Private-mode browsers can throw on any storage access.
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(shouldRefresh('daily-bruin')).toBe(true);
    expect(() => markRefreshed('daily-bruin')).not.toThrow();

    const data = mockStorage();
    data.set('bruinweb:live:daily-bruin', 'not-a-number');
    expect(shouldRefresh('daily-bruin')).toBe(true);
  });
});

describe('refreshSource', () => {
  it('normalizes a live response exactly as the build would', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([ARTICLE]), { status: 200 })),
    );

    const result = await refreshSource('daily-bruin');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].sourceId).toBe('daily-bruin');
    expect(result.items[0].title).toBe('A story from the API');
    expect(result.items[0].excerpt).toBe('An excerpt.');
    expect(result.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('never sends cookies to a publisher', async () => {
    const spy = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
    spy.mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', spy);

    await refreshSource('daily-bruin');

    const init = spy.mock.calls[0][1];
    expect(init?.credentials).toBe('omit');
    expect(init?.cache).toBe('no-store');
  });

  it('throws on an HTTP error so the caller can keep the built content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 503 })),
    );
    await expect(refreshSource('daily-bruin')).rejects.toThrow('HTTP 503');
  });

  it('refuses a source that is not configured for browser refresh', async () => {
    // @ts-expect-error deliberately passing a source the registry excludes
    await expect(refreshSource('dining')).rejects.toThrow('not configured for browser refresh');
  });
});

describe('refreshMany', () => {
  it('keeps what succeeded when one publisher is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('uclaradio')
          ? new Response('down', { status: 500 })
          : new Response(JSON.stringify([ARTICLE]), { status: 200 }),
      ),
    );

    const result = await refreshMany(['daily-bruin', 'ucla-radio']);

    expect(result.refreshed).toEqual(['daily-bruin']);
    expect(result.failed).toEqual(['ucla-radio']);
    expect(result.items).toHaveLength(1);
  });

  it('reports a source that answered with nothing as failed rather than refreshed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200 })),
    );

    const result = await refreshMany(['daily-bruin']);

    expect(result.refreshed).toEqual([]);
    expect(result.failed).toEqual(['daily-bruin']);
  });

  it('copes with an empty request list', async () => {
    const result = await refreshMany([]);
    expect(result).toEqual({ items: [], refreshed: [], failed: [] });
  });
});

describe('the browser only ever touches sources the registry cleared', () => {
  it('matches the registry exactly', () => {
    const configured = SOURCE_LIST.filter((s) => s.refresh.strategy === 'browser').map((s) => s.id);
    expect([...LIVE_SOURCE_IDS].sort()).toEqual([...configured].sort());
  });

  it('excludes every source that cannot be fetched cross-origin', () => {
    // Verified by hand: none of these send CORS headers, so a browser cannot
    // read them and they depend on the scheduled rebuild.
    for (const id of ['dining', 'esports', 'events', 'public-lectures', 'science-journal']) {
      expect(isLiveSource(id), id).toBe(false);
      expect(SOURCES[id as keyof typeof SOURCES].refresh.strategy, id).not.toBe('browser');
    }
  });

  it('never touches the Panopto placeholder', () => {
    expect(isLiveSource('lectures')).toBe(false);
  });
});
