/**
 * Client-side search and filtering over the build-time snapshot.
 *
 * All matching runs against the already-loaded item list, so there is no
 * network call and no backend. Keep this module pure and dependency-free — it
 * is exercised directly by the test suite.
 */

import type { MediaItem, MediaKind } from '@/lib/types';

export type DateRange = 'any' | 'today' | 'week' | 'month';

export interface FilterState {
  query: string;
  sources: string[];
  kinds: MediaKind[];
  categories: string[];
  dateRange: DateRange;
}

export const EMPTY_FILTERS: FilterState = {
  query: '',
  sources: [],
  kinds: [],
  categories: [],
  dateRange: 'any',
};

const RANGE_MS: Record<Exclude<DateRange, 'any' | 'today'>, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 31 * 24 * 60 * 60 * 1000,
};

/** Split a query into lowercase terms, honouring "quoted phrases". */
export function parseQuery(query: string): string[] {
  const terms: string[] = [];
  const pattern = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(query)) !== null) {
    const term = (match[1] ?? match[2] ?? '').trim().toLowerCase();
    if (term) terms.push(term);
  }
  return terms;
}

/** Concatenated lowercase haystack for one item. */
function haystack(item: MediaItem): string {
  return [
    item.title,
    item.excerpt ?? '',
    item.sourceId,
    item.location ?? '',
    ...item.categories,
    ...item.authors,
    ...item.badges,
  ]
    .join(' ')
    .toLowerCase();
}

/** An item matches when every term appears somewhere in its text (AND semantics). */
export function matchesQuery(item: MediaItem, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const text = haystack(item);
  return terms.every((term) => text.includes(term));
}

/** Relevance score: title hits outrank body hits, recency breaks ties. */
export function scoreItem(item: MediaItem, terms: string[], now: number = Date.now()): number {
  let score = 0;
  const title = item.title.toLowerCase();
  const body = haystack(item);

  for (const term of terms) {
    if (title.includes(term)) score += title.startsWith(term) ? 12 : 8;
    if (item.categories.some((category) => category.toLowerCase().includes(term))) score += 4;
    if (body.includes(term)) score += 1;
  }

  const published = item.publishedAt ? Date.parse(item.publishedAt) : NaN;
  if (!Number.isNaN(published)) {
    const ageDays = Math.max(0, (now - published) / 86_400_000);
    score += Math.max(0, 6 - ageDays / 5);
  }

  return score;
}

function withinRange(
  item: MediaItem,
  range: DateRange,
  now: number,
  isToday: (iso: string | null) => boolean,
): boolean {
  if (range === 'any') return true;

  const stamp = item.startsAt ?? item.publishedAt;
  if (!stamp) return false;

  if (range === 'today') return isToday(stamp);

  const parsed = Date.parse(stamp);
  if (Number.isNaN(parsed)) return false;
  // Upcoming events stay visible in every window; they are ahead of "now".
  if (parsed > now) return true;
  return now - parsed <= RANGE_MS[range];
}

export interface FilterOptions {
  now?: number;
  /** Injected so date logic stays in one place and is testable. */
  isToday?: (iso: string | null) => boolean;
}

/** Apply every active filter, then order by relevance (or by date when no query). */
export function filterItems(
  items: MediaItem[],
  filters: FilterState,
  options: FilterOptions = {},
): MediaItem[] {
  const now = options.now ?? Date.now();
  const isToday =
    options.isToday ??
    ((iso: string | null) => {
      if (!iso) return false;
      const date = new Date(iso);
      const today = new Date(now);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getUTCFullYear() === today.getUTCFullYear() &&
        date.getUTCMonth() === today.getUTCMonth() &&
        date.getUTCDate() === today.getUTCDate()
      );
    });

  const terms = parseQuery(filters.query);
  const sources = new Set(filters.sources);
  const kinds = new Set<MediaKind>(filters.kinds);
  const categories = new Set(filters.categories.map((category) => category.toLowerCase()));

  const matched = items.filter((item) => {
    if (sources.size > 0 && !sources.has(item.sourceId)) return false;
    if (kinds.size > 0 && !kinds.has(item.kind)) return false;
    if (
      categories.size > 0 &&
      !item.categories.some((category) => categories.has(category.toLowerCase()))
    ) {
      return false;
    }
    if (!withinRange(item, filters.dateRange, now, isToday)) return false;
    return matchesQuery(item, terms);
  });

  if (terms.length === 0) {
    return matched.sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : NaN;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : NaN;
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
  }

  return matched
    .map((item) => ({ item, score: scoreItem(item, terms, now) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/** True when the user has narrowed the feed in any way. */
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.sources.length > 0 ||
    filters.kinds.length > 0 ||
    filters.categories.length > 0 ||
    filters.dateRange !== 'any'
  );
}

/** Distinct categories present in a set of items, most common first. */
export function collectCategories(items: MediaItem[], limit = 40): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const category of item.categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([category]) => category);
}
