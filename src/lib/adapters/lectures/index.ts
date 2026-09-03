/**
 * Lecture collection.
 *
 * Runs every configured lecture source at build time, fault-isolated, then
 * deduplicates and orders the result. One unreachable feed reduces the
 * collection; it never fails the build.
 *
 * All retrieval is server-side during `next build`. No scraping logic, no
 * credential and no API key reaches the browser — the browser receives only the
 * normalized, already-sanitized metadata below.
 */

import { ACTIVE_LECTURE_SOURCES, type LectureSourceConfig } from '@/lib/config/lecture-sources';
import { canonicalizeUrl, slugify } from '@/lib/normalize';
import { SOURCES } from '@/lib/config/sources';
import type { MediaItem, SourceResult } from '@/lib/types';
import { LECTURE_FORMAT_LABELS, type Lecture, type LectureCollection } from '@/lib/types/lecture';

import { fetchPodcastLectures } from './podcast';

function fetchFor(source: LectureSourceConfig, retrievedAt: string): Promise<Lecture[]> {
  switch (source.adapter) {
    case 'podcast-rss':
      return fetchPodcastLectures(source, retrievedAt);
    default:
      return Promise.reject(new Error(`No adapter for "${source.adapter}"`));
  }
}

/**
 * Remove the same talk arriving from two feeds.
 *
 * Two records are the same recording when they share a canonical watch URL, or
 * when title, speaker and publication date all normalize to the same key — the
 * International Institute cross-lists a talk on several centre feeds, so title
 * alone is not enough and URL alone is not either.
 */
export function dedupeLectures(lectures: Lecture[]): Lecture[] {
  const seenUrls = new Set<string>();
  const seenKeys = new Set<string>();
  const result: Lecture[] = [];

  for (const lecture of lectures) {
    const url = canonicalizeUrl(lecture.watchUrl);
    if (url && seenUrls.has(url)) continue;

    const titleKey = slugify(lecture.title);
    const key = [
      titleKey,
      slugify(lecture.speaker ?? ''),
      (lecture.publishedAt ?? '').slice(0, 10),
    ].join('|');
    // Very short titles collide by coincidence rather than by syndication.
    const distinctive = titleKey.length >= 12;
    if (distinctive && seenKeys.has(key)) continue;

    if (url) seenUrls.add(url);
    if (distinctive) seenKeys.add(key);
    result.push(lecture);
  }

  return result;
}

export function sortLectures(lectures: Lecture[]): Lecture[] {
  return [...lectures].sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : NaN;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : NaN;
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return a.title.localeCompare(b.title);
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });
}

export async function collectLectures(now: Date = new Date()): Promise<LectureCollection> {
  const retrievedAt = now.toISOString();

  const settled = await Promise.allSettled(
    ACTIVE_LECTURE_SOURCES.map(async (source) => ({
      source,
      lectures: await fetchFor(source, retrievedAt),
    })),
  );

  const sources: LectureCollection['sources'] = [];
  const all: Lecture[] = [];

  settled.forEach((outcome, index) => {
    const source = ACTIVE_LECTURE_SOURCES[index];
    if (outcome.status === 'fulfilled') {
      all.push(...outcome.value.lectures);
      sources.push({
        sourceId: source.id,
        status: outcome.value.lectures.length > 0 ? 'ok' : 'empty',
        count: outcome.value.lectures.length,
        retrievedAt,
      });
    } else {
      const error =
        outcome.reason instanceof Error ? outcome.reason.message : 'Unknown lecture source error';
      console.warn(`[bruinweb] lecture source "${source.id}" failed: ${error}`);
      sources.push({ sourceId: source.id, status: 'error', count: 0, error, retrievedAt });
    }
  });

  return {
    lectures: sortLectures(dedupeLectures(all)),
    sources,
    generatedAt: retrievedAt,
  };
}

/**
 * Short, stable, non-cryptographic hash (FNV-1a). Deliberately not `crypto`, so
 * this module stays usable outside Node without pulling in a polyfill.
 */
function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(6, '0').slice(0, 6);
}

/**
 * Stable, URL-safe slug for a lecture's detail page.
 *
 * The readable title carries the meaning; the hash suffix keeps two talks that
 * share a title — the international centres cross-list them — on distinct URLs.
 * Both parts are derived from data that does not change between builds, so a
 * link stays valid.
 */
export function lectureSlug(lecture: Lecture): string {
  const base = slugify(lecture.title).slice(0, 70).replace(/-+$/, '');
  const suffix = shortHash(lecture.id);
  return base ? `${base}-${suffix}` : suffix;
}

/**
 * Project a lecture into the shared `MediaItem` shape so it appears in the
 * homepage river and in global search alongside everything else. The richer
 * lecture record stays available to the lectures pages.
 */
export function lectureToMediaItem(lecture: Lecture): MediaItem {
  return {
    id: lecture.id,
    sourceId: 'public-lectures',
    // Audio talks are audio; video talks are lectures in the shared taxonomy.
    kind: lecture.mediaType === 'audio' ? 'audio' : 'lecture',
    title: lecture.title,
    url: lecture.watchUrl,
    publishedAt: lecture.publishedAt,
    startsAt: null,
    endsAt: null,
    excerpt: lecture.description,
    image: lecture.thumbnailUrl ? { src: lecture.thumbnailUrl, alt: lecture.title } : null,
    categories: [lecture.department, lecture.series, ...lecture.topics].filter(
      (value): value is string => Boolean(value),
    ),
    authors: lecture.speaker ? [lecture.speaker] : [],
    durationSeconds: lecture.durationSeconds,
    location: null,
    badges: [LECTURE_FORMAT_LABELS[lecture.format]],
    attribution: lecture.sourceName,
    dataMode: 'build',
  };
}

/** The lecture collection expressed as a `SourceResult` for the shared feed. */
export function lecturesAsSourceResult(collection: LectureCollection): SourceResult {
  const failed = collection.sources.filter((source) => source.status === 'error');
  const items = collection.lectures.map(lectureToMediaItem);

  return {
    sourceId: 'public-lectures',
    status: items.length > 0 ? 'ok' : failed.length > 0 ? 'error' : 'empty',
    items,
    fetchedAt: collection.generatedAt,
    error:
      items.length === 0 && failed.length > 0
        ? failed.map((source) => `${source.sourceId}: ${source.error}`).join('; ')
        : undefined,
    note:
      failed.length > 0 && items.length > 0
        ? `Partial — ${failed.length} of ${collection.sources.length} lecture feeds were unreachable.`
        : `${SOURCES['public-lectures'].name} collected from ${collection.sources.length} public feeds.`,
  };
}
