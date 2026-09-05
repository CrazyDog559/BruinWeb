/**
 * How each section gets fresh content without a code change.
 *
 * BruinWeb is a static site, so "fresh" has to come from somewhere other than a
 * server rendering on request. Three mechanisms, in order of preference:
 *
 *   1. `browser`  — the reader's own browser refetches the publisher's public
 *                   API directly, automatically, when the page is opened. Only
 *                   for endpoints that send CORS headers, need no credential,
 *                   and permit the usage. This is the only mechanism that is
 *                   fresh *between* builds, and it is what makes Daily Bruin
 *                   work at all on the hosted build: the publisher refuses
 *                   datacenter IPs, but a reader's browser is not one.
 *   2. `build`    — retrieved during `next build`. A scheduled GitHub Actions
 *                   workflow pings a Vercel Deploy Hook so this happens on a
 *                   timetable, not only when someone pushes code.
 *   3. `none`     — never fetched. Reserved for the Panopto placeholder, which
 *                   has no public data to fetch.
 *
 * Intervals are the *expected* cadence, used to decide when a section should be
 * labelled stale. They are aspirations about the source, not a promise about
 * the scheduler — the actual rebuild timetable is in
 * `.github/workflows/refresh.yml` and documented in the README.
 */

export const REFRESH_STRATEGIES = ['browser', 'build', 'none'] as const;

export type RefreshStrategy = (typeof REFRESH_STRATEGIES)[number];

export const REFRESH_STRATEGY_LABELS: Record<RefreshStrategy, string> = {
  browser: 'Refreshes when you open the page',
  build: 'Scheduled rebuild',
  none: 'Not fetched',
};

export interface BrowserRefresh {
  /**
   * The public endpoint the browser calls. Must be the same origin family as
   * the build-time endpoint, must send CORS headers, and must never require a
   * credential — anything in here is visible to every reader.
   */
  endpoint: string;
  /**
   * Date this endpoint's CORS behaviour was last checked by hand, plus what was
   * observed. Recorded so a future maintainer knows the claim was tested rather
   * than assumed.
   */
  corsVerified: string;
}

export interface RefreshPolicy {
  strategy: RefreshStrategy;
  /**
   * How often this source is expected to gain new content, in minutes. Drives
   * the "expected every N" line on the status page.
   */
  intervalMinutes: number;
  /**
   * How old the data may get before the UI calls it stale, in minutes.
   * Deliberately more generous than `intervalMinutes`: a publisher that simply
   * had nothing to say should not make the section look broken.
   */
  staleAfterMinutes: number;
  /** Present only when `strategy` is `browser`. */
  browser?: BrowserRefresh;
  /** Why this strategy, in one line. Rendered on the status page. */
  rationale: string;
}

/** Minutes, for readability in the registry. */
export const MINUTE = 1;
export const HOUR = 60;
export const DAY = 24 * HOUR;

/**
 * Freshness verdict for a section, given when it was last successfully
 * retrieved. Pure so it can be unit-tested against fixed clocks.
 */
export type Freshness = 'fresh' | 'stale' | 'unknown';

export function freshnessOf(
  lastUpdatedIso: string | null | undefined,
  policy: Pick<RefreshPolicy, 'staleAfterMinutes'>,
  now: number = Date.now(),
): Freshness {
  if (!lastUpdatedIso) return 'unknown';
  const at = Date.parse(lastUpdatedIso);
  if (Number.isNaN(at)) return 'unknown';
  // A timestamp in the future is a clock problem, not freshness. Treat the
  // data as current rather than inventing a negative age.
  const ageMinutes = Math.max(0, (now - at) / 60_000);
  return ageMinutes > policy.staleAfterMinutes ? 'stale' : 'fresh';
}

/** Whole minutes since a timestamp, or null when it cannot be read. */
export function ageInMinutes(
  iso: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.round((now - at) / 60_000));
}

/** "just now", "14 min", "3 hr", "2 days" — a bare age, for tables and labels. */
export function formatAge(minutes: number | null): string {
  if (minutes === null) return 'unknown';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * The same age as a sentence fragment: "just now", "14 min ago", "3 days ago".
 * Separate from `formatAge` because "just now ago" is not English.
 */
export function formatAgePhrase(minutes: number | null): string {
  const age = formatAge(minutes);
  return age === 'just now' || age === 'unknown' ? age : `${age} ago`;
}
