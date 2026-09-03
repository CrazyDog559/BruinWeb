/**
 * UCLA Athletics normalization — pure, and free of any Node dependency.
 *
 * Separated from `athletics.ts` for the same reason as the WordPress split: the
 * build-time adapter and the browser-side live refresh must normalize an
 * article identically, and the only way to guarantee that is for both to call
 * this code rather than each keep a copy.
 *
 * The public website API publishes no schema and may rename fields without
 * notice, so parsing here stays defensive: anything without a title and a
 * permalink is dropped rather than half-rendered.
 */

import { z } from 'zod';

import { makeId, toExcerpt, toIso } from '@/lib/normalize';
import type { MediaItem } from '@/lib/types';

export const SOURCE_ID = 'athletics' as const;

export const API_BASE = 'https://api.uclabruins.com/website-api';

/** How far around "now" the schedule window reaches. */
export const PAST_WINDOW_DAYS = 14;
export const FUTURE_WINDOW_DAYS = 45;
export const SCHEDULE_PAGES = 2;
export const SCHEDULE_PAGE_SIZE = 100;

export const ImageSchema = z.object({
  url: z.string().nullish(),
  alt: z.string().nullish(),
  title: z.string().nullish(),
  photo_credit: z.string().nullish(),
});

export const NamedSchema = z.object({ name: z.string().nullish(), slug: z.string().nullish() });

export const ArticleSchema = z
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

export const ScheduleEventSchema = z
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

export const PaginatedSchema = z.object({ data: z.array(z.unknown()) }).passthrough();

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
export function buildScheduleIndex(
  sports: Array<{ name?: string | null; schedule_id?: number | null }>,
) {
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
