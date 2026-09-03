/**
 * Minimal RSS/Atom reader.
 *
 * Used for sources that publish a feed but no JSON API. Kept deliberately
 * small: it extracts only the fields the shared `MediaItem` needs, and it
 * tolerates the namespace variations real feeds use.
 */

import { XMLParser } from 'fast-xml-parser';

import { fetchText } from './fetch-json';

export interface RssItem {
  title: string;
  link: string;
  guid: string | null;
  pubDate: string | null;
  description: string | null;
  categories: string[];
  author: string | null;
  /** Best available image URL from `media:*` or `enclosure`. */
  imageUrl: string | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  // Feed text is HTML-escaped; keep it raw and let the normalizer strip tags.
  processEntities: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Feed values are sometimes `"text"` and sometimes `{ '#text': 'text' }`. */
function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['#text'] === 'string') return record['#text'].trim() || null;
    if (typeof record['@_href'] === 'string') return record['@_href'].trim() || null;
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

/** Some feeds only carry an image inside the description's first `<img>`. */
function imageFromHtml(html: string | null): string | null {
  if (!html) return null;
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return match ? match[1] : null;
}

function normalizeEntry(raw: Record<string, unknown>): RssItem | null {
  const title = text(raw.title);
  const link =
    text(raw.link) ??
    attr(raw.link, '@_href') ??
    text(raw.guid) ??
    attr(raw['atom:link'], '@_href');

  if (!title || !link) return null;

  const description = text(raw.description) ?? text(raw.summary) ?? text(raw['content:encoded']);

  return {
    title,
    link,
    guid: text(raw.guid) ?? text(raw.id),
    pubDate: text(raw.pubDate) ?? text(raw.published) ?? text(raw.updated) ?? text(raw['dc:date']),
    description,
    categories: asArray(raw.category)
      .map((entry) => text(entry) ?? attr(entry, '@_term'))
      .filter((value): value is string => Boolean(value)),
    author: text(raw['dc:creator']) ?? text(raw.author),
    imageUrl:
      attr(raw['media:content'], '@_url') ??
      attr(raw['media:thumbnail'], '@_url') ??
      attr(raw.enclosure, '@_url') ??
      imageFromHtml(description),
  };
}

/** Parse a feed document into normalized entries. Malformed entries are dropped. */
export function parseFeed(xml: string): RssItem[] {
  const document = parser.parse(xml) as Record<string, unknown>;

  const rssChannel = (document.rss as Record<string, unknown> | undefined)?.channel as
    Record<string, unknown> | undefined;
  const atomFeed = document.feed as Record<string, unknown> | undefined;

  const entries = rssChannel
    ? asArray(rssChannel.item as Record<string, unknown>[])
    : atomFeed
      ? asArray(atomFeed.entry as Record<string, unknown>[])
      : [];

  return entries
    .map((entry) => normalizeEntry(entry as Record<string, unknown>))
    .filter((entry): entry is RssItem => entry !== null);
}

/** Fetch and parse a feed URL. */
export async function fetchFeed(url: string): Promise<RssItem[]> {
  const xml = await fetchText(url, {
    headers: { accept: 'application/rss+xml, application/xml, text/xml, */*' },
  });
  return parseFeed(xml);
}
