/**
 * Build-time data aggregation.
 *
 * Every page imports from here. Adapters run once per build, in parallel, and
 * are individually fault-isolated: `Promise.allSettled` plus adapters that
 * return rather than throw means one dead source degrades one section, never
 * the build. The result is memoized so a single build fetches each source once
 * no matter how many pages consume it.
 */

import { FEED } from '@/lib/config/site';
import { SOURCE_IDS, type SourceId } from '@/lib/config/sources';
import { dedupeItems, sortByDateDesc } from '@/lib/normalize';
import type { DiningDay, LectureCollection, MediaItem, SourceResult } from '@/lib/types';

import { loadAthletics } from '@/lib/adapters/athletics';
import { loadCommBoard } from '@/lib/adapters/comm-board';
import { loadDining } from '@/lib/adapters/dining';
import { loadEsports } from '@/lib/adapters/esports';
import { loadEvents } from '@/lib/adapters/events';
import { loadLectures } from '@/lib/adapters/panopto';
import { loadScienceJournal } from '@/lib/adapters/science-journal';
import { collectLectures, lecturesAsSourceResult } from '@/lib/adapters/lectures';
import { loadStudentMediaSources } from '@/lib/adapters/student-media';

export interface MediaSnapshot {
  /** Deduplicated, newest-first, across every source. */
  items: MediaItem[];
  /** One entry per configured source, including failures. */
  results: Record<SourceId, SourceResult>;
  /** Dining needs richer structure than `MediaItem` can carry. */
  dining: DiningDay | null;
  /** Public UCLA lectures, which carry speaker and series metadata of their own. */
  lectures: LectureCollection;
  /** When this build ran. Displayed as the site-wide freshness stamp. */
  generatedAt: string;
}

function emptyResult(sourceId: string, fetchedAt: string): SourceResult {
  return {
    sourceId,
    status: 'error',
    items: [],
    fetchedAt,
    error: 'Adapter did not complete',
  };
}

/**
 * Source precedence for deduplication. Earlier sources win when the same story
 * is syndicated: the originating newsroom keeps the byline.
 */
const DEDUPE_PRIORITY: SourceId[] = [
  'daily-bruin',
  'public-lectures',
  'athletics',
  'bruinlife',
  'ucla-radio',
  'esports',
  'events',
  'dining',
  'comm-board',
  'science-journal',
  'lectures',
];

async function loadAll(now: Date): Promise<MediaSnapshot> {
  const fetchedAt = now.toISOString();

  const lectureCollection = await collectLectures(now);

  const settled = await Promise.allSettled([
    loadDining(now),
    loadStudentMediaSources(),
    loadCommBoard(),
    loadScienceJournal(undefined, now),
    loadEsports(),
    loadAthletics(now),
    loadEvents(now),
    loadLectures('lectures', undefined, now),
  ]);

  const collected: SourceResult[] = [lecturesAsSourceResult(lectureCollection)];
  let dining: DiningDay | null = null;

  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') {
      // An adapter that threw despite its own guard: log and carry on.
      console.warn('[bruinweb] adapter rejected:', outcome.reason);
      continue;
    }
    if (Array.isArray(outcome.value)) {
      collected.push(...outcome.value);
    } else {
      if ('day' in outcome.value) dining = outcome.value.day;
      collected.push(outcome.value);
    }
  }

  const results = Object.fromEntries(
    SOURCE_IDS.map((id) => [
      id,
      collected.find((result) => result.sourceId === id) ?? emptyResult(id, fetchedAt),
    ]),
  ) as Record<SourceId, SourceResult>;

  const ordered = DEDUPE_PRIORITY.flatMap((id) => sortByDateDesc(results[id]?.items ?? []));
  const items = sortByDateDesc(dedupeItems(ordered));

  for (const id of SOURCE_IDS) {
    const result = results[id];
    if (result.status === 'error') {
      console.warn(`[bruinweb] source "${id}" failed: ${result.error ?? 'unknown error'}`);
    }
  }

  return { items, results, dining, lectures: lectureCollection, generatedAt: fetchedAt };
}

let snapshot: Promise<MediaSnapshot> | null = null;

/** Memoized per build. Pass a date only from tests. */
export function getSnapshot(now: Date = new Date()): Promise<MediaSnapshot> {
  snapshot ??= loadAll(now);
  return snapshot;
}

/** Items belonging to one source, newest first. */
export async function getSourceItems(sourceId: SourceId): Promise<MediaItem[]> {
  const data = await getSnapshot();
  return sortByDateDesc(data.results[sourceId]?.items ?? []);
}

/** The homepage's featured selection: image-led stories, newest first. */
export function pickFeatured(items: MediaItem[], count = FEED.homepageFeatured): MediaItem[] {
  const withImages = items.filter((item) => item.image !== null && item.kind !== 'menu');
  const featured = withImages.slice(0, count);
  if (featured.length >= count) return featured;

  const seen = new Set(featured.map((item) => item.id));
  return [...featured, ...items.filter((item) => !seen.has(item.id))].slice(0, count);
}
