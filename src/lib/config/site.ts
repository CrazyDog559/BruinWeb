/** Global, non-source-specific configuration. */

export const SITE = {
  name: 'BruinWeb',
  tagline: 'A unified media hub for UCLA',
  description:
    'BruinWeb brings UCLA news, audio, publications, events, dining, esports and athletics into one place. An independent student-built aggregator — not affiliated with or endorsed by UCLA.',
  /** Shown wherever the project must not be mistaken for an official product. */
  affiliationNotice:
    'BruinWeb is an independent, student-built project. It is not affiliated with, endorsed by, or an official product of the University of California, Los Angeles. All content belongs to its original publishers.',
  /** UCLA campus time zone. "Today" always means today on campus. */
  timeZone: 'America/Los_Angeles',
  locale: 'en-US',
} as const;

/**
 * Identifies our crawler to upstream servers so operators can contact us or
 * rate-limit us deliberately rather than guessing.
 */
export const USER_AGENT =
  'BruinWebBot/1.0 (+https://github.com/; static site generator; contact via repository issues)';

export const BUILD = {
  /** Per-request abort threshold during the build. */
  requestTimeoutMs: 15_000,
  /** Extra attempts after the first failure (5xx and network errors only). */
  retries: 2,
  retryBackoffMs: 750,
  /** On-disk response cache, so repeated builds do not hammer upstream sources. */
  cacheEnabled: process.env.BRUINWEB_DISABLE_CACHE !== '1',
  cacheDir: '.cache/bruinweb',
  cacheTtlMs: 30 * 60 * 1000,
  /**
   * Revalidate window handed to Next.js's own fetch cache. Short enough that a
   * deploy always refetches, long enough to deduplicate within a single build.
   */
  nextRevalidateSeconds: 60,
  /** Upper bound on items pulled per source, to keep the payload small. */
  itemsPerSource: 24,
} as const;

export const FEED = {
  /** Items rendered on the homepage's "Latest" river. */
  homepageLatest: 18,
  /** Featured stories at the top of the homepage. */
  homepageFeatured: 5,
  /** Items rendered on a single source page. */
  sourcePageItems: 60,
} as const;
