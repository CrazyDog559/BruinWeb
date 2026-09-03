import type { MediaItem } from '@/lib/types';

import { slugify } from './text';

/** Strip tracking parameters and trailing slashes so equal links compare equal. */
export function canonicalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_cid|mc_eid|ref$|source$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch {
    return input.trim();
  }
}

/** Normalized title used as a secondary dedupe key across syndicated feeds. */
function titleKey(item: MediaItem): string {
  return `${item.kind}:${slugify(item.title)}`;
}

/**
 * Remove items that appear in more than one feed.
 *
 * Two items are the same story when they share a canonical URL, or when they
 * share a normalized title of meaningful length. The first occurrence wins, so
 * callers control precedence by ordering their input.
 */
export function dedupeItems(items: MediaItem[]): MediaItem[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: MediaItem[] = [];

  for (const item of items) {
    if (seenIds.has(item.id)) continue;

    const url = item.url ? canonicalizeUrl(item.url) : '';
    if (url && seenUrls.has(url)) continue;

    // Very short titles ("Menu", "Live") collide by coincidence, not syndication.
    const title = titleKey(item);
    const titleIsDistinctive = slugify(item.title).length >= 12;
    if (titleIsDistinctive && seenTitles.has(title)) continue;

    seenIds.add(item.id);
    if (url) seenUrls.add(url);
    if (titleIsDistinctive) seenTitles.add(title);
    result.push(item);
  }

  return result;
}

/** Newest first; items without a date sort last but keep their relative order. */
export function sortByDateDesc(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : NaN;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : NaN;
    const aValid = !Number.isNaN(aTime);
    const bValid = !Number.isNaN(bTime);
    if (aValid && bValid) return bTime - aTime;
    if (aValid) return -1;
    if (bValid) return 1;
    return 0;
  });
}
