import { describe, expect, it } from 'vitest';

import { canonicalizeUrl, dedupeItems, sortByDateDesc } from '@/lib/normalize/dedupe';
import type { MediaItem } from '@/lib/types';

function makeItem(overrides: Partial<MediaItem> & { id: string }): MediaItem {
  return {
    sourceId: 'daily-bruin',
    kind: 'article',
    title: 'Untitled',
    url: 'https://dailybruin.com/article',
    publishedAt: null,
    startsAt: null,
    endsAt: null,
    excerpt: null,
    image: null,
    categories: [],
    authors: [],
    durationSeconds: null,
    location: null,
    badges: [],
    attribution: 'Daily Bruin',
    dataMode: 'build',
    ...overrides,
  };
}

describe('canonicalizeUrl', () => {
  it('strips utm_* and fbclid tracking params', () => {
    expect(canonicalizeUrl('https://example.com/foo?utm_source=x&utm_medium=y&fbclid=z')).toBe(
      'https://example.com/foo',
    );
  });

  it('strips the hash fragment', () => {
    expect(canonicalizeUrl('https://example.com/foo#section')).toBe('https://example.com/foo');
  });

  it('drops a leading www.', () => {
    expect(canonicalizeUrl('https://www.example.com/foo')).toBe('https://example.com/foo');
  });

  it('removes a trailing slash', () => {
    expect(canonicalizeUrl('https://example.com/foo/')).toBe('https://example.com/foo');
  });

  it('returns the input unchanged for a non-URL string', () => {
    expect(canonicalizeUrl('not a url')).toBe('not a url');
  });
});

describe('dedupeItems', () => {
  it('removes items sharing a canonical URL', () => {
    const a = makeItem({
      id: 'a',
      title: 'Bruins Win Big Game Tonight',
      url: 'https://dailybruin.com/story?utm_source=rss',
    });
    const b = makeItem({
      id: 'b',
      title: 'A Completely Different Headline',
      url: 'https://dailybruin.com/story',
    });
    const result = dedupeItems([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('removes items sharing a distinctive normalized title', () => {
    const a = makeItem({
      id: 'a',
      title: 'UCLA Wins Championship Game',
      url: 'https://dailybruin.com/one',
    });
    const b = makeItem({
      id: 'b',
      title: 'UCLA Wins Championship Game',
      url: 'https://uclaradio.com/two',
    });
    const result = dedupeItems([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('keeps items whose titles are short/non-distinctive', () => {
    const a = makeItem({ id: 'a', title: 'Menu', url: 'https://dining.ucla.edu/one' });
    const b = makeItem({ id: 'b', title: 'Menu', url: 'https://dining.ucla.edu/two' });
    const result = dedupeItems([a, b]);
    expect(result).toHaveLength(2);
  });

  it('preserves first-occurrence precedence', () => {
    const a = makeItem({
      id: 'a',
      title: 'First Occurrence Wins Here',
      url: 'https://dailybruin.com/story',
    });
    const b = makeItem({
      id: 'b',
      title: 'First Occurrence Wins Here',
      url: 'https://dailybruin.com/story',
    });
    const result = dedupeItems([a, b]);
    expect(result).toEqual([a]);

    const result2 = dedupeItems([b, a]);
    expect(result2).toEqual([b]);
  });
});

describe('sortByDateDesc', () => {
  it('puts newest first', () => {
    const older = makeItem({ id: 'older', publishedAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeItem({ id: 'newer', publishedAt: '2026-06-01T00:00:00.000Z' });
    const result = sortByDateDesc([older, newer]);
    expect(result.map((i) => i.id)).toEqual(['newer', 'older']);
  });

  it('sorts null-dated items last', () => {
    const dated = makeItem({ id: 'dated', publishedAt: '2026-01-01T00:00:00.000Z' });
    const undated = makeItem({ id: 'undated', publishedAt: null });
    const result = sortByDateDesc([undated, dated]);
    expect(result.map((i) => i.id)).toEqual(['dated', 'undated']);
  });
});
