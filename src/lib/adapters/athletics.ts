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
import { makeId, toExcerpt, toIso } from '@/lib/normalize';
import type { MediaItem, SourceResult } from '@/lib/types';

const SOURCE_ID = 'athletics';

const API_BASE = 'https://api.uclabruins.com/website-api';

/** How far around "now" the schedule window reaches. */
const PAST_WINDOW_DAYS = 14;
const FUTURE_WINDOW_DAYS = 45;
const SCHEDULE_PAGES = 2;
const SCHEDULE_PAGE_SIZE = 100;

const ImageSchema = z.object({
  url: z.string().nullish(),
  alt: z.string().nullish(),
  title: z.string().nullish(),
  photo_credit: z.string().nullish(),
});

const NamedSchema = z.object({ name: z.string().nullish(), slug: z.string().nullish() });

const ArticleSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    permalink: z.string().url(),
    slug: z.string().nullish(),
    published_at: z.string().nullish(),
    short_description: z.string().nullish(),
    author_byline: z.string().nullish(),
    image: ImageSchema.nullish(),
    categories: z.array(NamedSchema).nullish(),
    sports: z.array(NamedSchema).nullish(),
  })
  .passthrough();

const ScheduleEventSchema = z
  .object({
    id: z.number(),
    datetime: z.string().nullish(),
    datetime_end: z.string().nullish(),
    opponent_name: z.string().nullish(),
    opponent_school_name: z.string().nullish(),
    location: z.string().nullish(),
    venue: z.string().nullish(),
    venue_type: z.string().nullish(),
    neutral_event: z.boolean().nullish(),
    status: z.string().nullish(),
    status_text: z.string().nullish(),
    box_score_url: z.string().nullish(),
    has_box_score: z.boolean().nullish(),
    is_conference: z.boolean().nullish(),
    schedule_id: z.number().nullish(),
    tba: z.boolean().nullish(),
  })
  .passthrough();

const PaginatedSchema = z.object({ data: z.array(z.unknown()) }).passthrough();

type Article = z.infer<typeof ArticleSchema>;
type ScheduleEvent = z.infer<typeof ScheduleEventSchema>;

/** Categories like "Headlines" are site chrome; sport names are the useful facet. */
const NOISE_CATEGORIES = new Set(['headlines', 'featured-articles', 'general']);

export function normalizeArticle(article: Article, attribution: string): MediaItem | null {
  if (!article.title) return null;

  const sports = (article.sports ?? [])
    .map((sport) => sport.name)
    .filter((name): name is string => Boolean(name));

  const categories = (article.categories ?? [])
    .filter((category) => !NOISE_CATEGORIES.has((category.slug ?? '').toLowerCase()))
    .map((category) => category.name)
    .filter((name): name is string => Boolean(name));

  return {
    id: makeId(SOURCE_ID, article.slug ?? String(article.id)),
    sourceId: SOURCE_ID,
    kind: 'article',
    title: article.title,
    url: article.permalink,
    publishedAt: toIso(article.published_at),
    startsAt: null,
    endsAt: null,
    excerpt: toExcerpt(article.short_description),
    image: article.image?.url
      ? { src: article.image.url, alt: article.image.alt ?? article.image.title ?? article.title }
      : null,
    categories: [...new Set([...sports, ...categories])].slice(0, 3),
    authors: article.author_byline ? [article.author_byline] : [],
    durationSeconds: null,
    location: null,
    badges: [],
    attribution,
    dataMode: 'build',
  };
}

/** Map a sport's `schedule_id` to its display name so events can be filtered by team. */
function buildScheduleIndex(sports: Array<{ name?: string | null; schedule_id?: number | null }>) {
  const index = new Map<number, string>();
  for (const sport of sports) {
    if (typeof sport.schedule_id === 'number' && sport.name)
      index.set(sport.schedule_id, sport.name);
  }
  return index;
}

export function normalizeScheduleEvent(
  event: ScheduleEvent,
  attribution: string,
  sportName: string | undefined,
  homepage: string,
): MediaItem | null {
  if (!event.datetime) return null;

  const startsAt = toIso(event.datetime);
  if (!startsAt) return null;

  const opponent = event.opponent_name ?? event.opponent_school_name ?? 'TBA';
  const isHome = event.venue_type === 'home';
  const connector = event.neutral_event ? 'vs.' : isHome ? 'vs.' : 'at';
  const completed = event.status === 'completed';

  const badges: string[] = [];
  if (completed) badges.push('Final');
  else if (event.tba) badges.push('Time TBA');
  if (event.is_conference) badges.push('Conference');
  if (isHome && !event.neutral_event) badges.push('Home');

  return {
    id: makeId(SOURCE_ID, 'event', String(event.id)),
    sourceId: SOURCE_ID,
    kind: 'event',
    title: `${sportName ?? 'UCLA'} ${connector} ${opponent}`,
    // Box scores are the most useful destination for a finished game.
    url: (completed && event.has_box_score && event.box_score_url) || homepage,
    publishedAt: startsAt,
    startsAt,
    endsAt: toIso(event.datetime_end),
    excerpt: event.status_text ?? null,
    image: null,
    categories: sportName ? [sportName] : [],
    authors: [],
    durationSeconds: null,
    location: event.venue ?? event.location ?? null,
    badges,
    attribution,
    dataMode: 'build',
  };
}

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
