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
