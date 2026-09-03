import { describe, expect, it } from 'vitest';

import {
  parseQuery,
  filterItems,
  hasActiveFilters,
  collectCategories,
  EMPTY_FILTERS,
  type FilterState,
} from '@/lib/search';
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

function filters(overrides: Partial<FilterState> = {}): FilterState {
  return { ...EMPTY_FILTERS, ...overrides };
}

describe('parseQuery', () => {
  it('handles quoted phrases', () => {
    expect(parseQuery('"student government" election')).toEqual(['student government', 'election']);
  });

  it('handles bare terms', () => {
    expect(parseQuery('bruins basketball')).toEqual(['bruins', 'basketball']);
  });

  it('lowercases terms', () => {
    expect(parseQuery('BRUINS')).toEqual(['bruins']);
  });

  it('returns an empty array for an empty query', () => {
    expect(parseQuery('')).toEqual([]);
    expect(parseQuery('   ')).toEqual([]);
  });
});

describe('filterItems', () => {
  const now = new Date('2026-09-02T20:00:00.000Z').getTime();
  const isToday = (iso: string | null) => iso?.startsWith('2026-09-02') ?? false;

  it('filters by source', () => {
    const items = [
      makeItem({ id: 'a', sourceId: 'daily-bruin' }),
      makeItem({ id: 'b', sourceId: 'ucla-radio' }),
    ];
    const result = filterItems(items, filters({ sources: ['ucla-radio'] }));
    expect(result.map((i) => i.id)).toEqual(['b']);
  });

  it('filters by kind', () => {
    const items = [makeItem({ id: 'a', kind: 'article' }), makeItem({ id: 'b', kind: 'video' })];
    const result = filterItems(items, filters({ kinds: ['video'] }));
    expect(result.map((i) => i.id)).toEqual(['b']);
  });

  it('filters by category, case-insensitively', () => {
    const items = [
      makeItem({ id: 'a', categories: ['Sports'] }),
      makeItem({ id: 'b', categories: ['Arts'] }),
    ];
    const result = filterItems(items, filters({ categories: ['sports'] }));
    expect(result.map((i) => i.id)).toEqual(['a']);
  });

  describe('dateRange', () => {
    const items = [
      makeItem({ id: 'today', publishedAt: '2026-09-02T18:00:00.000Z' }),
      makeItem({ id: 'this-week', publishedAt: '2026-08-29T18:00:00.000Z' }),
      makeItem({ id: 'this-month', publishedAt: '2026-08-10T18:00:00.000Z' }),
      makeItem({ id: 'old', publishedAt: '2026-01-01T18:00:00.000Z' }),
      makeItem({ id: 'undated', publishedAt: null }),
    ];

    it('any returns everything', () => {
      const result = filterItems(items, filters({ dateRange: 'any' }), { now, isToday });
      expect(result).toHaveLength(items.length);
    });

    it('today keeps only items matching isToday', () => {
      const result = filterItems(items, filters({ dateRange: 'today' }), { now, isToday });
      expect(result.map((i) => i.id)).toEqual(['today']);
    });

    it('week keeps items within 7 days', () => {
      const result = filterItems(items, filters({ dateRange: 'week' }), { now, isToday });
      expect(result.map((i) => i.id).sort()).toEqual(['this-week', 'today'].sort());
    });

    it('month keeps items within 31 days', () => {
      const result = filterItems(items, filters({ dateRange: 'month' }), { now, isToday });
      expect(result.map((i) => i.id).sort()).toEqual(['this-month', 'this-week', 'today'].sort());
    });

    it('excludes undated items from any range but "any"', () => {
      const result = filterItems(items, filters({ dateRange: 'today' }), { now, isToday });
      expect(result.some((i) => i.id === 'undated')).toBe(false);
    });
  });

  it('applies free-text query with AND semantics across multiple terms', () => {
    const items = [
      makeItem({ id: 'a', title: 'Bruins win basketball championship' }),
      makeItem({ id: 'b', title: 'Bruins win football opener' }),
      makeItem({ id: 'c', title: 'Completely unrelated headline' }),
    ];
    const result = filterItems(items, filters({ query: 'bruins basketball' }), { now, isToday });
    expect(result.map((i) => i.id)).toEqual(['a']);
  });

  it('matches on title, excerpt, categories and authors', () => {
    const items = [
      makeItem({ id: 'title-hit', title: 'A story about pandas' }),
      makeItem({ id: 'excerpt-hit', title: 'Unrelated', excerpt: 'This story mentions pandas.' }),
      makeItem({ id: 'category-hit', title: 'Unrelated', categories: ['Pandas'] }),
      makeItem({ id: 'author-hit', title: 'Unrelated', authors: ['Pandas Reporter'] }),
      makeItem({ id: 'no-hit', title: 'Nothing to see here' }),
    ];
    const result = filterItems(items, filters({ query: 'pandas' }), { now, isToday });
    expect(result.map((i) => i.id).sort()).toEqual(
      ['title-hit', 'excerpt-hit', 'category-hit', 'author-hit'].sort(),
    );
  });

  it('ranks a title match above a body-only match', () => {
    const titleMatch = makeItem({
      id: 'title',
      title: 'Bruins claim victory',
      publishedAt: '2026-09-01T00:00:00.000Z',
    });
    const bodyMatch = makeItem({
      id: 'body',
      title: 'Season recap',
      excerpt: 'The bruins had a great year.',
      publishedAt: '2026-09-01T00:00:00.000Z',
    });
    const result = filterItems([bodyMatch, titleMatch], filters({ query: 'bruins' }), {
      now,
      isToday,
    });
    expect(result.map((i) => i.id)).toEqual(['title', 'body']);
  });

  it('sorts by newest first when there is no query', () => {
    const items = [
      makeItem({ id: 'older', publishedAt: '2026-01-01T00:00:00.000Z' }),
      makeItem({ id: 'newer', publishedAt: '2026-08-01T00:00:00.000Z' }),
    ];
    const result = filterItems(items, filters(), { now, isToday });
    expect(result.map((i) => i.id)).toEqual(['newer', 'older']);
  });

  it('returns an empty array for an empty item list', () => {
    expect(filterItems([], filters(), { now, isToday })).toEqual([]);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the default empty filter state', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('is true when a query is present', () => {
    expect(hasActiveFilters(filters({ query: 'bruins' }))).toBe(true);
  });

  it('is true when any facet is set', () => {
    expect(hasActiveFilters(filters({ sources: ['dining'] }))).toBe(true);
    expect(hasActiveFilters(filters({ kinds: ['article'] }))).toBe(true);
    expect(hasActiveFilters(filters({ categories: ['Sports'] }))).toBe(true);
    expect(hasActiveFilters(filters({ dateRange: 'today' }))).toBe(true);
  });
});

describe('collectCategories', () => {
  it('orders categories by frequency, most common first', () => {
    const items = [
      makeItem({ id: 'a', categories: ['Sports', 'News'] }),
      makeItem({ id: 'b', categories: ['Sports'] }),
      makeItem({ id: 'c', categories: ['Arts'] }),
    ];
    expect(collectCategories(items)).toEqual(['Sports', 'Arts', 'News']);
  });

  it('returns an empty array for an empty item list', () => {
    expect(collectCategories([])).toEqual([]);
  });
});
