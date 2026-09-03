/**
 * Build-time data aggregation.
 *
 * Every page imports from here. Adapters run once per build, in parallel, and
 * are individually fault-isolated: `Promise.allSettled` plus adapters that
 * return rather than throw means one dead source degrades one section, never
 * the build. The result is memoized so a single build fetches each source once
 * no matter how many pages consume it.
 *
 * Each build-time source is additionally wrapped in `withFallback`, which
 * persists a validated artifact on success and replays the last good one when a
 * publisher is briefly unavailable. A section therefore has three honest states
 * — current, showing older data with its real age, or unavailable — and never a
 * fourth one where invented content stands in for a failed fetch.
 */

import { SOURCE_IDS, SOURCES, type SourceId } from '@/lib/config/sources';
import { FEED } from '@/lib/config/site';
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

import { withFallback } from './artifacts';
import { DiningDaySchema, LectureCollectionSchema, MediaItemsSchema } from './schemas';
import { buildIntegrationReport, type IntegrationReport } from './status';

export interface MediaSnapshot {
  /** Deduplicated, newest-first, across every source. */
  items: MediaItem[];
  /** One entry per configured source, including failures. */
  results: Record<SourceId, SourceResult>;
  /** Dining needs richer structure than `MediaItem` can carry. */
  dining: DiningDay | null;
  /** True when the dining data shown came from a previous build's artifact. */
  diningFromFallback: boolean;
  /** When the dining data shown was actually retrieved. */
  diningRetrievedAt: string | null;
  /** Public UCLA lectures, which carry speaker and series metadata of their own. */
  lectures: LectureCollection;
  /** When this build ran. Distinct from any source's retrieval time. */
  generatedAt: string;
  /** Per-source health, generated from these very results. */
  report: IntegrationReport;
}

function emptyResult(sourceId: string, fetchedAt: string): SourceResult {
  return {
    sourceId,
    status: 'error',
    items: [],
    fetchedAt,
    attemptedAt: fetchedAt,
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

/**
 * Run one source's `SourceResult`s through the artifact layer.
 *
 * An adapter reports failure by returning `status: 'error'` rather than
 * throwing, so failure is converted into a rejection here — that is the signal
 * `withFallback` needs in order to reach for the previous dataset.
 */
async function resolveResults(
  sourceId: SourceId,
  attemptedAt: string,
  run: () => Promise<SourceResult[]>,
): Promise<SourceResult[]> {
  const started = Date.now();

  const resolved = await withFallback(sourceId, MediaItemsSchema, attemptedAt, async () => {
    const results = await run();
    const own = results.find((result) => result.sourceId === sourceId);
    if (!own) throw new Error(`Adapter returned no result for "${sourceId}"`);
    if (own.status === 'error') throw new Error(own.error ?? 'Source reported an error');
    return { payload: own.items, count: own.items.length };
  });

  const durationMs = Date.now() - started;

  if (!resolved) {
    return [
      {
        ...emptyResult(sourceId, attemptedAt),
        durationMs,
        error: 'Source unavailable and no previous dataset is cached',
      },
    ];
  }

  return [
    {
      sourceId,
      status: resolved.payload.length > 0 ? 'ok' : 'empty',
      items: resolved.payload,
      fetchedAt: resolved.retrievedAt,
      attemptedAt,
      fromFallback: resolved.fromFallback,
      durationMs,
      note: resolved.fromFallback
        ? 'Showing the most recent dataset that retrieved successfully; the source did not respond during this build.'
        : undefined,
    },
  ];
}

/**
 * Sources whose adapter emits several `SourceResult`s at once (the shared
 * WordPress loader) are unwrapped first, then each is persisted on its own so
 * one publisher's outage cannot discard its siblings' data.
 */
async function resolveMulti(
  ids: SourceId[],
  attemptedAt: string,
  run: () => Promise<SourceResult[]>,
): Promise<SourceResult[]> {
  let shared: Promise<SourceResult[]> | null = null;
  const once = () => (shared ??= run());

  const settled = await Promise.all(
    ids.map((id) => resolveResults(id, attemptedAt, async () => once())),
  );
  return settled.flat();
}

async function loadAll(now: Date): Promise<MediaSnapshot> {
  const generatedAt = now.toISOString();

  const diningStarted = Date.now();
  const diningResolved = await withFallback('dining', DiningDaySchema, generatedAt, async () => {
    const outcome = await loadDining(now);
    if (outcome.status === 'error' || !outcome.day) {
      throw new Error(outcome.error ?? 'Dining reported an error');
    }
    return { payload: outcome.day, count: outcome.day.venues.length };
  });
  const diningDurationMs = Date.now() - diningStarted;

  const lectureStarted = Date.now();
  const lecturesResolved = await withFallback(
    'public-lectures',
    LectureCollectionSchema,
    generatedAt,
    async () => {
      const collection = await collectLectures(now);
      if (collection.lectures.length === 0) {
        throw new Error('No lecture feed returned any talks');
      }
      return { payload: collection, count: collection.lectures.length };
    },
  );
  const lectureDurationMs = Date.now() - lectureStarted;

  const lectureCollection: LectureCollection = lecturesResolved?.payload ?? {
    lectures: [],
    sources: [],
    generatedAt,
  };

  const settled = await Promise.allSettled([
    resolveMulti(['daily-bruin', 'ucla-radio', 'bruinlife'], generatedAt, loadStudentMediaSources),
    resolveResults('comm-board', generatedAt, async () => [await loadCommBoard()]),
    resolveResults('esports', generatedAt, async () => [await loadEsports()]),
    resolveResults('athletics', generatedAt, async () => [await loadAthletics(now)]),
    resolveResults('events', generatedAt, async () => [await loadEvents(now)]),
  ]);

  const collected: SourceResult[] = [];

  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') {
      // An adapter that threw despite its own guard: log and carry on.
      console.warn('[bruinweb] adapter rejected:', outcome.reason);
      continue;
    }
    collected.push(...outcome.value);
  }

  // Sources that are intentionally not fetched, or that report a documented
  // blocker rather than data, bypass the artifact layer entirely — there is
  // nothing to persist and nothing to fall back to.
  collected.push(await loadScienceJournal(undefined, now));
  collected.push(await loadLectures('lectures', undefined, now));

  collected.push({
    ...lecturesAsSourceResult(lectureCollection),
    fetchedAt: lecturesResolved?.retrievedAt ?? generatedAt,
    attemptedAt: generatedAt,
    fromFallback: lecturesResolved?.fromFallback ?? false,
    durationMs: lectureDurationMs,
  });

  const diningDay: DiningDay | null = diningResolved ? diningResolved.payload : null;

  if (diningDay) {
    const dishes = diningDay.venues.reduce(
      (total, venue) => total + venue.menus.reduce((sum, section) => sum + section.items.length, 0),
      0,
    );
    collected.push({
      sourceId: 'dining',
      status: dishes > 0 ? 'ok' : 'empty',
      items: [],
      fetchedAt: diningResolved!.retrievedAt,
      attemptedAt: generatedAt,
      fromFallback: diningResolved!.fromFallback,
      durationMs: diningDurationMs,
      note: diningResolved!.fromFallback
        ? 'Showing the most recent menu that retrieved successfully; UCLA Dining did not respond during this build.'
        : undefined,
    });
  } else {
    collected.push({
      ...emptyResult('dining', generatedAt),
      durationMs: diningDurationMs,
      error: 'UCLA Dining did not respond and no previous menu is cached',
    });
  }

  const results = Object.fromEntries(
    SOURCE_IDS.map((id) => [
      id,
      collected.find((result) => result.sourceId === id) ?? emptyResult(id, generatedAt),
    ]),
  ) as Record<SourceId, SourceResult>;

  const ordered = DEDUPE_PRIORITY.flatMap((id) => sortByDateDesc(results[id]?.items ?? []));
  const items = sortByDateDesc(dedupeItems(ordered));

  for (const id of SOURCE_IDS) {
    const result = results[id];
    if (result.status === 'error' && SOURCES[id].refresh.strategy !== 'none') {
      console.warn(`[bruinweb] source "${id}" failed: ${result.error ?? 'unknown error'}`);
    }
  }

  const report = buildIntegrationReport(results, generatedAt, {
    // Dining carries no `MediaItem`s, and lectures are counted from the richer
    // collection, so both report the number a reader would actually recognise.
    dining: diningDay
      ? diningDay.venues.reduce(
          (total, venue) =>
            total + venue.menus.reduce((sum, section) => sum + section.items.length, 0),
          0,
        )
      : 0,
    'public-lectures': lectureCollection.lectures.length,
  });

  await writeStatusReport(report);

  return {
    items,
    results,
    dining: diningDay,
    diningFromFallback: diningResolved?.fromFallback ?? false,
    diningRetrievedAt: diningResolved?.retrievedAt ?? null,
    lectures: lectureCollection,
    generatedAt,
    report,
  };
}

/**
 * Emit the report where the post-build step can find it.
 *
 * Written to the project root rather than `public/`, because Next.js copies
 * `public/` at the start of a build — long before any of this data exists. The
 * post-build step moves it into `out/`. A failure here is logged and ignored:
 * losing the report is not a reason to fail a deployment.
 */
async function writeStatusReport(report: IntegrationReport): Promise<void> {
  try {
    const { writeFile } = await import('node:fs/promises');
    const path = await import('node:path');
    await writeFile(
      path.join(process.cwd(), '.bruinweb-status.json'),
      JSON.stringify(report, null, 2),
      'utf8',
    );
  } catch (error) {
    console.warn(
      `[bruinweb] could not write the integration status report: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
  }
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
