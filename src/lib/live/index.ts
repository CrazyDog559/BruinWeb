/**
 * Browser-side live refresh.
 *
 * The static build is a snapshot. For sources whose public API sends CORS
 * headers and needs no credential, the reader's own browser can go and get
 * something newer — which is genuinely fresher than any rebuild schedule, and
 * in the Daily Bruin's case is the only way the section carries content at all,
 * because that publisher refuses cloud datacenter networks but not people.
 *
 * Rules this module holds to:
 *   - Only endpoints declared `strategy: 'browser'` in the source registry, so
 *     the allowed set is configuration, not something a component decides.
 *   - No credentials, ever. Anything reachable from here is public, and every
 *     request goes out anonymous — `credentials: 'omit'` — so a reader's
 *     cookies for a publisher are never attached to our request.
 *   - The same normalizers the build uses, imported from the shared pure
 *     module, so a refreshed item cannot be shaped differently from a built one.
 *   - Failure is silent-but-visible: the built content stays on screen and the
 *     UI says the refresh did not work. It never blanks a section.
 *
 * Refresh happens automatically when a page is opened, so a reader sees current
 * content without pressing anything and without waiting for a rebuild. A short
 * per-tab throttle keeps navigating around the site from re-hitting publishers
 * on every click.
 */

import {
  ArticleSchema,
  PaginatedSchema,
  normalizeArticle,
} from '@/lib/adapters/athletics-normalize';
import { normalizeMany, type WordPressAdapterOptions } from '@/lib/adapters/wordpress-normalize';
import { SOURCES, type SourceId } from '@/lib/config/sources';
import { BUILD } from '@/lib/config/site';
import { sortByDateDesc } from '@/lib/normalize';
import type { MediaItem } from '@/lib/types';

/** Sources this module knows how to refresh in a browser. */
export type LiveSourceId = Extract<
  SourceId,
  'daily-bruin' | 'ucla-radio' | 'bruinlife' | 'comm-board' | 'athletics'
>;

export const LIVE_SOURCE_IDS: LiveSourceId[] = [
  'daily-bruin',
  'ucla-radio',
  'bruinlife',
  'comm-board',
  'athletics',
];

export function isLiveSource(id: string): id is LiveSourceId {
  return (LIVE_SOURCE_IDS as string[]).includes(id);
}

export interface LiveResult {
  items: MediaItem[];
  retrievedAt: string;
}

/** Abort rather than leave a reader waiting on a hung publisher. */
async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // No cookies, no auth — this is a public read on a reader's behalf.
      credentials: 'omit',
      // Bypass the browser's HTTP cache: a refresh the reader asked for should
      // actually hit the publisher.
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function wordPressOptions(id: LiveSourceId): WordPressAdapterOptions {
  const config = SOURCES[id];
  return {
    sourceId: id,
    apiBase: new URL(config.refresh.browser!.endpoint).origin,
    kind: id === 'ucla-radio' ? 'audio' : id === 'comm-board' ? 'publication' : 'article',
    attribution: config.attribution,
    perPage: BUILD.itemsPerSource,
  };
}

/**
 * Athletics answers with a paginated envelope rather than a bare array, so the
 * rows are unwrapped and then handed to the very same normalizer the build
 * uses. Per-row validation means one malformed article is skipped rather than
 * discarding the response.
 */
function normalizeAthleticsPayload(payload: unknown, attribution: string): MediaItem[] {
  const envelope = PaginatedSchema.safeParse(payload);
  const rows = envelope.success ? envelope.data.data : Array.isArray(payload) ? payload : [];

  return rows
    .map((row) => ArticleSchema.safeParse(row))
    .filter((parsed) => parsed.success)
    .map((parsed) => normalizeArticle(parsed.data, attribution))
    .filter((item): item is MediaItem => item !== null);
}

/**
 * Refresh one source from the reader's browser.
 *
 * Throws on failure so the caller can show a "could not refresh" state while
 * keeping the built content on screen.
 */
export async function refreshSource(id: LiveSourceId): Promise<LiveResult> {
  const config = SOURCES[id];
  const browser = config.refresh.browser;

  if (config.refresh.strategy !== 'browser' || !browser) {
    throw new Error(`"${id}" is not configured for browser refresh`);
  }
  if (config.requiresCredentials) {
    // Belt and braces: a credentialed source must never be fetched from a page.
    throw new Error(`"${id}" requires credentials and cannot be refreshed in a browser`);
  }

  const payload = await getJson(browser.endpoint, config.network.timeoutMs);

  const items =
    id === 'athletics'
      ? normalizeAthleticsPayload(payload, config.attribution)
      : normalizeMany(Array.isArray(payload) ? payload : [], wordPressOptions(id));

  return { items: sortByDateDesc(items), retrievedAt: new Date().toISOString() };
}

/**
 * How long a browser refresh counts as current within one tab, in milliseconds.
 *
 * Long enough that moving between pages does not re-hit a publisher on every
 * click; short enough that opening the site again shortly afterwards still gets
 * something new. A page opened in a fresh tab always refreshes, because
 * sessionStorage starts empty there.
 */
export const LIVE_THROTTLE_MS = 3 * 60 * 1000;

const THROTTLE_PREFIX = 'bruinweb:live:';

/**
 * Whether this tab already refreshed a source recently.
 *
 * Storage can throw outright — Safari in private mode, or a browser configured
 * to block site data — so every access is guarded and a failure means "not
 * throttled", which errs toward fetching rather than showing stale content.
 */
export function shouldRefresh(id: LiveSourceId, now: number = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(`${THROTTLE_PREFIX}${id}`);
    if (!raw) return true;
    const at = Number(raw);
    if (!Number.isFinite(at)) return true;
    return now - at > LIVE_THROTTLE_MS;
  } catch {
    return true;
  }
}

export function markRefreshed(id: LiveSourceId, now: number = Date.now()): void {
  try {
    sessionStorage.setItem(`${THROTTLE_PREFIX}${id}`, String(now));
  } catch {
    // Not being able to remember is harmless; it just means we may refetch.
  }
}

/**
 * Refresh several sources at once, tolerating individual failures.
 *
 * Used by the homepage river, which mixes every browser-refreshable source.
 * Returns whatever succeeded plus the ids that did not, so the caller can merge
 * live items over built ones without discarding a section whose publisher was
 * briefly unreachable.
 */
export async function refreshMany(
  ids: LiveSourceId[],
): Promise<{ items: MediaItem[]; refreshed: LiveSourceId[]; failed: LiveSourceId[] }> {
  const settled = await Promise.allSettled(ids.map((id) => refreshSource(id)));

  const items: MediaItem[] = [];
  const refreshed: LiveSourceId[] = [];
  const failed: LiveSourceId[] = [];

  settled.forEach((outcome, index) => {
    const id = ids[index];
    if (outcome.status === 'fulfilled' && outcome.value.items.length > 0) {
      items.push(...outcome.value.items);
      refreshed.push(id);
    } else {
      failed.push(id);
    }
  });

  return { items, refreshed, failed };
}
