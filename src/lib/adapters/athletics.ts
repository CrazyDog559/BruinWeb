/**
 * UCLA Athletics.
 *
 * Source: uclabruins.com's own public website API at api.uclabruins.com. It is
 * unauthenticated and robots.txt explicitly allows crawling, but it publishes
 * no terms and no schema guarantee — so every field is parsed defensively and a
 * shape change degrades the section rather than breaking the build.
 *
 * Verified behaviours (2026-09-02):
 *  - `?include=image,categories,sports` hydrates relations; `with=`/`expand=` are ignored.
 *  - `?sort=-published_at` sorts newest first; other sort spellings are ignored.
 *  - Articles carry NO body field at all, which is exactly what we want: we show
 *    the headline and `short_description`, and link out for the story.
 *  - `schedule-events` ignores every filter parameter we tried, including
 *    `schedule_id` and every date-range spelling. It is one global feed of ~19k
 *    events, so we page backwards from the far future and window it ourselves.
 *    Two pages of 100 reach ~9 months back, which covers any current season.
 */

import { z } from 'zod';

import { BUILD } from '@/lib/config/site';
import { SOURCES } from '@/lib/config/sources';
import { fetchJson } from '@/lib/net/fetch-json';
import type { MediaItem, SourceResult } from '@/lib/types';

import {
  API_BASE,
  FUTURE_WINDOW_DAYS,
  SCHEDULE_PAGES,
  SCHEDULE_PAGE_SIZE,
  SOURCE_ID,
  ArticleSchema,
  PaginatedSchema,
  PAST_WINDOW_DAYS,
  ScheduleEventSchema,
  buildScheduleIndex,
  normalizeArticle,
  normalizeScheduleEvent,
} from './athletics-normalize';

/**
 * The normalization surface lives in `./athletics-normalize`, which carries no
 * Node dependency so the browser-side live refresh can share it. Re-exported
 * here so every existing importer keeps working.
 */
export * from './athletics-normalize';

/** Fetch recent articles, newest first. */
async function fetchArticles(attribution: string): Promise<MediaItem[]> {
  const url = `${API_BASE}/articles?page=1&per_page=${BUILD.itemsPerSource}&include=image,categories,sports&sort=-published_at`;
  const payload = PaginatedSchema.parse(await fetchJson<unknown>(url));

  return payload.data
    .map((entry) => ArticleSchema.safeParse(entry))
    .filter((result) => result.success)
    .map((result) => normalizeArticle(result.data, attribution))
    .filter((item): item is MediaItem => item !== null);
}

/** Fetch schedule events near today. Failure here must not lose the articles. */
async function fetchScheduleEvents(
  attribution: string,
  homepage: string,
  now: Date,
): Promise<MediaItem[]> {
  const sportsPayload = PaginatedSchema.parse(await fetchJson<unknown>(`${API_BASE}/sports`));
  const sports = sportsPayload.data
    .map((entry) =>
      z.object({ name: z.string().nullish(), schedule_id: z.number().nullish() }).safeParse(entry),
    )
    .filter((result) => result.success)
    .map((result) => result.data);
  const scheduleIndex = buildScheduleIndex(sports);

  const earliest = now.getTime() - PAST_WINDOW_DAYS * 86_400_000;
  const latest = now.getTime() + FUTURE_WINDOW_DAYS * 86_400_000;
  const items: MediaItem[] = [];

  for (let page = 1; page <= SCHEDULE_PAGES; page += 1) {
    const url = `${API_BASE}/schedule-events?sort=-datetime&per_page=${SCHEDULE_PAGE_SIZE}&page=${page}`;
    const payload = PaginatedSchema.parse(await fetchJson<unknown>(url));
    if (payload.data.length === 0) break;

    let oldestOnPage = Number.POSITIVE_INFINITY;

    for (const entry of payload.data) {
      const parsed = ScheduleEventSchema.safeParse(entry);
      if (!parsed.success) continue;

      const stamp = parsed.data.datetime ? Date.parse(parsed.data.datetime) : NaN;
      if (!Number.isNaN(stamp)) oldestOnPage = Math.min(oldestOnPage, stamp);
      if (Number.isNaN(stamp) || stamp < earliest || stamp > latest) continue;

      const item = normalizeScheduleEvent(
        parsed.data,
        attribution,
        parsed.data.schedule_id ? scheduleIndex.get(parsed.data.schedule_id) : undefined,
        homepage,
      );
      if (item) items.push(item);
    }

    // The feed is sorted newest-first; once a page ends before our window
    // starts, no later page can contain anything we want.
    if (oldestOnPage < earliest) break;
  }

  return items.sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
}

export async function loadAthletics(now: Date = new Date()): Promise<SourceResult> {
  const config = SOURCES[SOURCE_ID];
  const fetchedAt = now.toISOString();

  if (!config.enabled) {
    return {
      sourceId: SOURCE_ID,
      status: 'unavailable',
      items: [],
      fetchedAt,
      note: 'Disabled by configuration',
    };
  }

  // Settled independently: a broken schedule feed still leaves the news usable.
  const [articles, events] = await Promise.allSettled([
    fetchArticles(config.attribution),
    fetchScheduleEvents(config.attribution, config.homepage, now),
  ]);

  const items = [
    ...(articles.status === 'fulfilled' ? articles.value : []),
    ...(events.status === 'fulfilled' ? events.value : []),
  ];

  if (articles.status === 'rejected' && events.status === 'rejected') {
    return {
      sourceId: SOURCE_ID,
      status: 'error',
      items: [],
      fetchedAt,
      error:
        articles.reason instanceof Error
          ? articles.reason.message
          : 'UCLA Athletics API unavailable',
    };
  }

  const partial = articles.status === 'rejected' || events.status === 'rejected';

  return {
    sourceId: SOURCE_ID,
    status: items.length > 0 ? 'ok' : 'empty',
    items,
    fetchedAt,
    note: partial
      ? `Partial data — ${articles.status === 'rejected' ? 'news' : 'schedule'} could not be retrieved.`
      : undefined,
  };
}
