/**
 * Podcast RSS adapter for UCLA lecture feeds.
 *
 * Handles the two duration spellings real UCLA feeds use — `itunes:duration` as
 * whole seconds (Buzzsprout, Resonate) and as `HH:MM:SS` (the International
 * Institute's ASP.NET feeds) — and takes an episode image only when one is
 * actually published, falling back to the channel artwork rather than inventing
 * a thumbnail.
 *
 * Only metadata and links are stored. The enclosure URL is recorded for
 * reference; media is never downloaded, rehosted or re-encoded, and for hosts
 * whose media path is robots-disallowed we link the publisher's episode page.
 */

import { XMLParser } from 'fast-xml-parser';

import type { LectureSourceConfig } from '@/lib/config/lecture-sources';
import { fetchText } from '@/lib/net/fetch-json';
import { makeId, stripHtml, toExcerpt, toIso } from '@/lib/normalize';
import type { Lecture } from '@/lib/types/lecture';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  processEntities: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['#text'] === 'string') return record['#text'].trim() || null;
  }
  return null;
}

function attr(value: unknown, name: string): string | null {
  for (const entry of asArray(value)) {
    if (entry && typeof entry === 'object') {
      const found = (entry as Record<string, unknown>)[name];
      if (typeof found === 'string' && found.trim()) return found.trim();
    }
  }
  return null;
}

/** Accept `3632`, `01:18:04` and `18:04`; anything else yields null. */
export function parseDuration(raw: unknown): number | null {
  const value = text(raw);
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  const parts = value.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;

  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/**
 * Pull a speaker name out of an episode title when the feed publishes one
 * there. Deliberately conservative: only the explicit "with <Name>" and
 * "Episode N: Dr./Prof. <Name>" shapes these feeds actually use. If the pattern
 * does not match we return null rather than guessing at a person's name.
 */
export function speakerFromTitle(title: string): string | null {
  const withMatch =
    /\bwith\s+((?:Dr\.|Prof\.|Professor\s)?[A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){0,3})\s*$/.exec(title);
  if (withMatch) return withMatch[1].trim();

  const episodeMatch =
    /^Episode\s+\d+:\s*((?:Dr\.|Prof\.|Professor)\s+[A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){0,3})\s*$/.exec(
      title,
    );
  if (episodeMatch) return episodeMatch[1].trim();

  return null;
}

/**
 * Some feeds publish no per-episode `<link>` — Buzzsprout is one — but their
 * enclosure URL is the episode's own page with a media extension appended:
 *   .../952522/episodes/19385626-why-history-matters-immigration.mp3
 * Dropping that extension yields the public episode page, verified to load
 * without a login. This is a deterministic transformation of a URL the feed
 * actually publishes, not a guess at a URL that might exist, and it only fires
 * for enclosures that already look like an episode permalink.
 */
export function episodePageFromEnclosure(enclosureUrl: string | null): string | null {
  if (!enclosureUrl) return null;
  const match = /^(https?:\/\/[^\s]+\/episodes\/[^\s?#]+)\.(mp3|m4a|aac|ogg|wav|mp4|m4v)$/i.exec(
    enclosureUrl,
  );
  return match ? match[1] : null;
}

interface RawEpisode {
  [key: string]: unknown;
}

export function normalizeEpisode(
  entry: RawEpisode,
  source: LectureSourceConfig,
  channelImage: string | null,
  retrievedAt: string,
): Lecture | null {
  const title = stripHtml(text(entry.title) ?? '');
  const enclosureUrl = attr(entry.enclosure, '@_url');

  // Prefer the publisher's own episode link; fall back to the episode page
  // implied by the enclosure; finally accept a guid that is itself a URL. A
  // record with no public page at all is dropped rather than pointed somewhere
  // approximate.
  const candidate = text(entry.link) ?? episodePageFromEnclosure(enclosureUrl) ?? text(entry.guid);
  if (!title || !candidate || !/^https?:\/\//.test(candidate)) return null;
  const link = candidate;

  const description =
    text(entry['itunes:summary']) ?? text(entry.description) ?? text(entry['content:encoded']);

  const publishedAt = toIso(text(entry.pubDate));

  // An explicit itunes:author is a real byline; several feeds instead repeat the
  // show title there, which is not a speaker, so it is ignored when it matches.
  const author = text(entry['itunes:author']);
  const byline = author && author !== source.name && author !== title ? stripHtml(author) : null;

  return {
    id: makeId(`lecture-${source.id}`, text(entry.guid) ?? link),
    sourceId: source.id,
    title,
    speaker: byline ?? speakerFromTitle(title),
    speakerAffiliation: null,
    department: source.department,
    // Sanitized to plain text — no source HTML ever reaches the DOM.
    description: toExcerpt(description, 600),
    series: source.series,
    topics: asArray(entry.category)
      .map((category) => stripHtml(text(category) ?? ''))
      .filter(Boolean)
      .slice(0, 4),
    // These feeds publish only a publication date, so recordedAt stays null
    // rather than pretending the two are the same thing.
    recordedAt: null,
    publishedAt,
    durationSeconds: parseDuration(entry['itunes:duration']),
    thumbnailUrl: attr(entry['itunes:image'], '@_href') ?? channelImage,
    mediaType: source.mediaType,
    format: source.format,
    watchUrl: link,
    embedUrl: null,
    transcriptUrl: text(entry['podcast:transcript']) ?? attr(entry['podcast:transcript'], '@_url'),
    mediaUrl: enclosureUrl,
    sourceName: source.name,
    sourceUrl: source.homepage,
    retrievedAt,
  };
}

export async function fetchPodcastLectures(
  source: LectureSourceConfig,
  retrievedAt: string,
): Promise<Lecture[]> {
  const xml = await fetchText(source.endpoint, {
    headers: { accept: 'application/rss+xml, application/xml, text/xml, */*' },
  });

  const document = parser.parse(xml) as Record<string, unknown>;
  const channel = (document.rss as Record<string, unknown> | undefined)?.channel as
    Record<string, unknown> | undefined;
  if (!channel) throw new Error('Feed had no RSS channel');

  const channelImage =
    attr(channel['itunes:image'], '@_href') ??
    text((channel.image as Record<string, unknown> | undefined)?.url);

  return asArray(channel.item as RawEpisode[])
    .slice(0, source.limit)
    .map((entry) => normalizeEpisode(entry, source, channelImage, retrievedAt))
    .filter((lecture): lecture is Lecture => lecture !== null);
}
