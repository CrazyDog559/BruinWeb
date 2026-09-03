/**
 * UCLA Esports.
 *
 * Verified official home: https://uclaclubsports.com/sports/esports — UCLA
 * Esports operates under UCLA Recreation Club Sports, not UCLA Athletics.
 * (`esports.ucla.edu` and `uclaesports.com` do not resolve.)
 *
 * The club sports site publishes a sport-filtered RSS feed. The filter value is
 * the sport shortname `es`, not the slug `esports` — `path=esports` silently
 * returns the unfiltered site-wide feed.
 *
 * robots.txt allows /rss and sets `Crawl-delay: 30`; we make exactly one
 * request per build, and responses are cached, so that is comfortably honoured.
 */

import { SOURCES } from '@/lib/config/sources';
import { fetchFeed, type RssItem } from '@/lib/net/rss';
import { makeId, toExcerpt, toIso } from '@/lib/normalize';
import type { MediaItem, SourceResult } from '@/lib/types';

const SOURCE_ID = 'esports';

const FEED_URL = 'https://uclaclubsports.com/rss.aspx?path=es';

export function normalizeEsportsItem(entry: RssItem, attribution: string): MediaItem | null {
  if (!entry.title || !entry.link) return null;

  return {
    id: makeId(SOURCE_ID, entry.guid ?? entry.link),
    sourceId: SOURCE_ID,
    kind: 'article',
    title: entry.title,
    url: entry.link,
    publishedAt: toIso(entry.pubDate),
    startsAt: null,
    endsAt: null,
    excerpt: toExcerpt(entry.description),
    image: entry.imageUrl ? { src: entry.imageUrl, alt: entry.title } : null,
    categories: entry.categories.length > 0 ? entry.categories.slice(0, 3) : ['Esports'],
    authors: entry.author ? [entry.author] : [],
    durationSeconds: null,
    location: null,
    badges: [],
    attribution,
    dataMode: 'build',
  };
}

export async function loadEsports(): Promise<SourceResult> {
  const config = SOURCES[SOURCE_ID];
  const fetchedAt = new Date().toISOString();

  if (!config.enabled) {
    return {
      sourceId: SOURCE_ID,
      status: 'unavailable',
      items: [],
      fetchedAt,
      note: 'Disabled by configuration',
    };
  }

  try {
    const entries = await fetchFeed(FEED_URL);
    const items = entries
      .map((entry) => normalizeEsportsItem(entry, config.attribution))
      .filter((item): item is MediaItem => item !== null);

    return {
      sourceId: SOURCE_ID,
      status: items.length > 0 ? 'ok' : 'empty',
      items,
      fetchedAt,
      note:
        items.length > 0
          ? 'News only — UCLA Esports has no official schedule, roster or stream feed.'
          : undefined,
    };
  } catch (error) {
    return {
      sourceId: SOURCE_ID,
      status: 'error',
      items: [],
      fetchedAt,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
