/**
 * UCLA campus events.
 *
 * Source: the structured event payload embedded in https://www.ucla.edu/events
 * as a `const eventsData = [...]` array. robots.txt allows this path.
 *
 * `calendar.ucla.edu` — the obvious candidate — refused connections from two
 * independent networks during research and appears retired; ucla.edu links its
 * "Event Calendar" to community.ucla.edu instead, which offers no feed or API.
 * So this is UCLA's curated highlights list, and the UI says so.
 *
 * Parsing note: the payload's string values are HTML-entity encoded. A blanket
 * unescape corrupts JSON string boundaries when a title contains `&quot;`, so
 * entities are decoded only after `JSON.parse`, never before.
 */

import { z } from 'zod';

import { SOURCES } from '@/lib/config/sources';
import { fetchText } from '@/lib/net/fetch-json';
import { decodeEntities, makeId, stripHtml, toExcerpt, toIso } from '@/lib/normalize';
import type { MediaItem, SourceResult } from '@/lib/types';

const SOURCE_ID = 'events';

const PAGE_URL = 'https://www.ucla.edu/events';

const EventSchema = z
  .object({
    title: z.string(),
    field_start_date: z.string().nullish(),
    field_end_date: z.string().nullish(),
    field_location: z.string().nullish(),
    field_image: z.string().nullish(),
    field_event_description: z.string().nullish(),
    field_link: z.string().nullish(),
    field_tags: z.string().nullish(),
  })
  .passthrough();

type RawEvent = z.infer<typeof EventSchema>;

/** Pull the inline `eventsData` array out of the page's script block. */
export function extractEventsPayload(html: string): unknown[] {
  const match = /const\s+eventsData\s*=\s*(\[[\s\S]*?\])\s*;/.exec(html);
  if (!match) throw new Error('eventsData payload not found on ucla.edu/events');

  const parsed: unknown = JSON.parse(match[1]);
  if (!Array.isArray(parsed)) throw new Error('eventsData was not an array');
  return parsed;
}

/** Relative image paths are served from the same origin as the events page. */
function absoluteUrl(path: string): string {
  try {
    return new URL(path, 'https://www.ucla.edu/').toString();
  } catch {
    return path;
  }
}

export function normalizeEvent(
  raw: RawEvent,
  attribution: string,
  homepage: string,
): MediaItem | null {
  const title = decodeEntities(stripHtml(raw.title));
  if (!title) return null;

  // These are campus-local wall-clock times with no offset; `toIso` reads them
  // in UCLA's zone rather than assuming UTC.
  const startsAt = toIso(raw.field_start_date);
  const endsAt = toIso(raw.field_end_date);

  const link = raw.field_link?.trim();

  return {
    id: makeId(SOURCE_ID, title, raw.field_start_date ?? ''),
    sourceId: SOURCE_ID,
    kind: 'event',
    title,
    url: link && /^https?:\/\//.test(link) ? link : homepage,
    publishedAt: startsAt,
    startsAt,
    endsAt,
    excerpt: toExcerpt(decodeEntities(raw.field_event_description ?? '')),
    image: raw.field_image ? { src: absoluteUrl(raw.field_image), alt: title } : null,
    categories: (raw.field_tags ?? '')
      .split(',')
      .map((tag) => decodeEntities(tag.trim()))
      .filter(Boolean)
      .slice(0, 3),
    authors: [],
    durationSeconds: null,
    location: raw.field_location ? decodeEntities(raw.field_location.trim()) : null,
    badges: [],
    attribution,
    dataMode: 'build',
  };
}

export async function loadEvents(now: Date = new Date()): Promise<SourceResult> {
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

  try {
    const html = await fetchText(PAGE_URL);
    const payload = extractEventsPayload(html);

    const items = payload
      .map((entry) => EventSchema.safeParse(entry))
      .filter((result) => result.success)
      .map((result) => normalizeEvent(result.data, config.attribution, config.homepage))
      .filter((item): item is MediaItem => item !== null)
      // Drop events that finished before today; keep undated ones.
      .filter((item) => {
        const end = item.endsAt ?? item.startsAt;
        if (!end) return true;
        return Date.parse(end) >= now.getTime() - 86_400_000;
      })
      .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));

    return {
      sourceId: SOURCE_ID,
      status: items.length > 0 ? 'ok' : 'empty',
      items,
      fetchedAt,
      note: 'Curated highlights from ucla.edu — not the complete campus calendar.',
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
