/**
 * Shared WordPress REST adapter.
 *
 * Daily Bruin, UCLA Radio and BruinLife all run WordPress and expose the same
 * core `/wp-json/wp/v2/posts` shape, so they share one fetch + normalize path.
 * Per-site differences (a separate headless API host, extra plugin fields) are
 * expressed as options rather than by branching inside the normalizer.
 *
 * Verified 2026-09-02:
 *   https://wp.dailybruin.com/wp-json/wp/v2/posts?per_page=5&_embed  -> 200
 *   https://uclaradio.com/wp-json/wp/v2/posts?per_page=5&_embed      -> 200
 *   https://bruinlife.com/wp-json/wp/v2/posts?per_page=5&_embed      -> 200
 */

import { fetchJson, fetchText } from '@/lib/net/fetch-json';
import { fetchFeed } from '@/lib/net/rss';
import type { MediaItem } from '@/lib/types';

import {
  extractEmbeddedWpPosts,
  normalizeMany,
  normalizeWpFeedItem,
  type WordPressAdapterOptions,
} from './wordpress-normalize';

/**
 * The normalization surface lives in `./wordpress-normalize`, which carries no
 * Node dependency so the browser-side live refresh can share it. Re-exported
 * here so every existing importer keeps working.
 */
export * from './wordpress-normalize';

/** Fetch and normalize recent posts via the REST API. */
async function fetchViaRestApi(options: WordPressAdapterOptions): Promise<MediaItem[]> {
  const url = `${options.apiBase}/wp-json/wp/v2/posts?per_page=${options.perPage}&_embed=1`;
  const raw = await fetchJson<unknown>(url);

  if (!Array.isArray(raw)) {
    throw new Error('Expected an array of posts');
  }

  return normalizeMany(raw, options);
}

/** Fetch via the publisher's RSS feed. */
async function fetchViaFeed(options: WordPressAdapterOptions): Promise<MediaItem[]> {
  if (!options.feedUrl) throw new Error('No feed configured');
  const entries = await fetchFeed(options.feedUrl);
  return entries
    .map((entry) => normalizeWpFeedItem(entry, options))
    .filter((item): item is MediaItem => item !== null);
}

/** Fetch via structured data embedded in a public page. */
async function fetchViaEmbeddedPage(options: WordPressAdapterOptions): Promise<MediaItem[]> {
  if (!options.embeddedPageUrl) throw new Error('No embedded page configured');
  const html = await fetchText(options.embeddedPageUrl);
  return normalizeMany(extractEmbeddedWpPosts(html), options);
}

/**
 * Fetch recent posts from whichever public surface answers.
 *
 * Order of preference: the REST API (richest — includes sized image variants),
 * then the publisher's RSS feed, then structured data embedded in a public
 * page. Every one of these is a surface the publisher serves openly; the
 * fallbacks exist because some hosts refuse cloud datacenter ranges, which is
 * where the production build runs. Throws only when all configured surfaces
 * fail, and the caller turns that into a `SourceResult`.
 */
export async function fetchWordPressPosts(options: WordPressAdapterOptions): Promise<MediaItem[]> {
  const attempts: Array<{ label: string; run: () => Promise<MediaItem[]> }> = [
    { label: 'REST API', run: () => fetchViaRestApi(options) },
    ...(options.feedUrl ? [{ label: 'RSS feed', run: () => fetchViaFeed(options) }] : []),
    ...(options.embeddedPageUrl
      ? [{ label: 'embedded page data', run: () => fetchViaEmbeddedPage(options) }]
      : []),
  ];

  let lastError: unknown = new Error('No retrieval method configured');

  for (const [index, attempt] of attempts.entries()) {
    try {
      const items = await attempt.run();
      if (items.length > 0) return items;
      lastError = new Error(`${attempt.label} returned no items`);
    } catch (error) {
      lastError = error;
    }

    const next = attempts[index + 1];
    if (next) {
      console.warn(
        `[bruinweb] ${options.sourceId}: ${attempt.label} unavailable (${
          lastError instanceof Error ? lastError.message : 'unknown'
        }); trying ${next.label}.`,
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All retrieval methods failed');
}
