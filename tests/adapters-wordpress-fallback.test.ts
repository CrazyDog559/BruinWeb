import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import type { WordPressAdapterOptions } from '@/lib/adapters/wordpress';

/**
 * The REST-to-RSS fallback exists because Daily Bruin's API host answers a
 * residential request but returns 403 to cloud datacenter ranges, which is
 * where the production build runs. These tests mock the two transport helpers
 * so no network call is made and no production data is fabricated.
 */
vi.mock('@/lib/net/fetch-json', () => ({
  fetchJson: vi.fn(),
  fetchText: vi.fn(),
}));

vi.mock('@/lib/net/rss', () => ({
  fetchFeed: vi.fn(),
}));

const { fetchJson } = await import('@/lib/net/fetch-json');
const { fetchFeed } = await import('@/lib/net/rss');
const { fetchWordPressPosts, normalizeWpFeedItem } = await import('@/lib/adapters/wordpress');

const OPTIONS: WordPressAdapterOptions = {
  sourceId: 'daily-bruin',
  apiBase: 'https://example.test',
  kind: 'article',
  attribution: 'Example',
  perPage: 5,
  feedUrl: 'https://example.test/feed/',
};

const FEED_ENTRY = {
  title: 'A headline from the feed',
  link: 'https://example.test/a-headline-from-the-feed/',
  guid: 'https://example.test/?p=42',
  pubDate: 'Tue, 02 Sep 2026 13:20:46 +0000',
  description: '<p>An excerpt with <em>markup</em>.</p>',
  categories: ['News', 'Campus'],
  author: 'A Reporter',
  imageUrl: 'https://example.test/image.jpg',
};

beforeEach(() => {
  vi.mocked(fetchJson).mockReset();
  vi.mocked(fetchFeed).mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeWpFeedItem', () => {
  it('maps an RSS entry onto the shared media shape', () => {
    const item = normalizeWpFeedItem(FEED_ENTRY, OPTIONS);

    expect(item).not.toBeNull();
    expect(item?.sourceId).toBe('daily-bruin');
    expect(item?.title).toBe('A headline from the feed');
    expect(item?.url).toBe('https://example.test/a-headline-from-the-feed/');
    expect(item?.excerpt).toBe('An excerpt with markup.');
    expect(item?.image?.src).toBe('https://example.test/image.jpg');
    expect(item?.categories).toEqual(['News', 'Campus']);
    expect(item?.authors).toEqual(['A Reporter']);
    expect(item?.dataMode).toBe('build');
    expect(item?.publishedAt).toBe('2026-09-02T13:20:46.000Z');
  });

  it('drops an entry with no title or no link', () => {
    expect(normalizeWpFeedItem({ ...FEED_ENTRY, title: '' }, OPTIONS)).toBeNull();
    expect(normalizeWpFeedItem({ ...FEED_ENTRY, link: '' }, OPTIONS)).toBeNull();
  });
});

describe('fetchWordPressPosts fallback', () => {
  it('uses the REST API when it succeeds and never touches the feed', async () => {
    vi.mocked(fetchJson).mockResolvedValue([
      {
        id: 1,
        link: 'https://example.test/rest-post/',
        slug: 'rest-post',
        date_gmt: '2026-09-02T10:00:00',
        title: { rendered: 'A headline from the API' },
      },
    ]);

    const items = await fetchWordPressPosts(OPTIONS);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('A headline from the API');
    expect(fetchFeed).not.toHaveBeenCalled();
  });

  it('falls back to the RSS feed when the REST API is refused', async () => {
    vi.mocked(fetchJson).mockRejectedValue(new Error('HTTP 403 Forbidden'));
    vi.mocked(fetchFeed).mockResolvedValue([FEED_ENTRY]);

    const items = await fetchWordPressPosts(OPTIONS);

    expect(fetchFeed).toHaveBeenCalledWith('https://example.test/feed/');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('A headline from the feed');
  });

  it('falls back when the REST API returns an empty list', async () => {
    vi.mocked(fetchJson).mockResolvedValue([]);
    vi.mocked(fetchFeed).mockResolvedValue([FEED_ENTRY]);

    const items = await fetchWordPressPosts(OPTIONS);

    expect(items).toHaveLength(1);
    expect(fetchFeed).toHaveBeenCalled();
  });

  it('rethrows when the REST API fails and no feed is configured', async () => {
    vi.mocked(fetchJson).mockRejectedValue(new Error('HTTP 403 Forbidden'));

    await expect(fetchWordPressPosts({ ...OPTIONS, feedUrl: undefined })).rejects.toThrow(
      'HTTP 403 Forbidden',
    );
    expect(fetchFeed).not.toHaveBeenCalled();
  });

  it('propagates a feed failure when both surfaces are down', async () => {
    vi.mocked(fetchJson).mockRejectedValue(new Error('HTTP 403 Forbidden'));
    vi.mocked(fetchFeed).mockRejectedValue(new Error('HTTP 503 Service Unavailable'));

    await expect(fetchWordPressPosts(OPTIONS)).rejects.toThrow('HTTP 503');
  });
});
