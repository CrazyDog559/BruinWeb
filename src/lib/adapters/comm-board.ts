/**
 * UCLA Communications Board.
 *
 * Verified official source: the board publishes through UCLA Student Media at
 * https://uclastudentmedia.com/ — `studentmedia.ucla.edu` and
 * `commboard.ucla.edu` do not resolve. The site runs WordPress but has no posts
 * at all; its substance lives in `pages`, so that is what we read.
 *
 * The install also carries WooCommerce, so the pages list includes cart,
 * checkout and account pages. Those are filtered out by slug rather than by
 * guesswork, and the remaining governance pages are sorted by last modified.
 */

import { z } from 'zod';

import { SOURCES } from '@/lib/config/sources';
import { fetchJson } from '@/lib/net/fetch-json';
import { makeId, stripHtml, toExcerpt, toIso } from '@/lib/normalize';
import type { MediaItem, SourceResult } from '@/lib/types';

const SOURCE_ID = 'comm-board';

const ENDPOINT = 'https://uclastudentmedia.com/wp-json/wp/v2/pages?per_page=100';

/** Storefront, account and system pages — not board governance content. */
const EXCLUDED_SLUGS = new Set([
  'cart',
  'checkout',
  'my-account',
  'shop',
  'donate',
  'donation-confirmation-3',
  'donation-failed-2',
  'donation-history',
  'donor-dashboard',
  'donor-dashboard-2',
  'recurring-donations',
  'transaction-failed',
  'pricing',
  'campaigns',
  'check-pick-up',
  'image-gallery',
  'home',
]);

const PageSchema = z
  .object({
    id: z.number(),
    link: z.string().url(),
    slug: z.string(),
    modified_gmt: z.string().nullish(),
    date_gmt: z.string().nullish(),
    title: z.object({ rendered: z.string().optional() }).nullish(),
    excerpt: z.object({ rendered: z.string().optional() }).nullish(),
    content: z.object({ rendered: z.string().optional() }).nullish(),
    status: z.string().nullish(),
  })
  .passthrough();

type Page = z.infer<typeof PageSchema>;

/** Group a governance page into a browsable category. */
function categorize(page: Page): string {
  if (/meeting-schedule$/.test(page.slug)) return 'Meeting schedules';
  if (/bylaws|constitution/.test(page.slug)) return 'Governing documents';
  if (/financial/.test(page.slug)) return 'Finance';
  if (/operations/.test(page.slug)) return 'Operations';
  if (/publications/.test(page.slug)) return 'Publications';
  return 'About the board';
}

export function normalizePage(page: Page, attribution: string): MediaItem | null {
  if (page.status && page.status !== 'publish') return null;
  if (EXCLUDED_SLUGS.has(page.slug)) return null;

  const title = stripHtml(page.title?.rendered);
  if (!title) return null;

  return {
    id: makeId(SOURCE_ID, page.slug),
    sourceId: SOURCE_ID,
    kind: 'publication',
    title,
    url: page.link,
    publishedAt: toIso(
      page.modified_gmt ? `${page.modified_gmt}Z` : page.date_gmt ? `${page.date_gmt}Z` : null,
    ),
    startsAt: null,
    endsAt: null,
    excerpt: toExcerpt(page.excerpt?.rendered ?? page.content?.rendered, 180),
    image: null,
    categories: [categorize(page)],
    authors: [],
    durationSeconds: null,
    location: null,
    badges: [],
    attribution,
    dataMode: 'build',
  };
}

export async function loadCommBoard(): Promise<SourceResult> {
  const config = SOURCES[SOURCE_ID];
  const fetchedAt = new Date().toISOString();

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
    const raw = await fetchJson<unknown>(ENDPOINT);
    if (!Array.isArray(raw)) throw new Error('Expected an array of pages');

    const items = raw
      .map((entry) => PageSchema.safeParse(entry))
      .filter((result) => result.success)
      .map((result) => normalizePage(result.data, config.attribution))
      .filter((item): item is MediaItem => item !== null)
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

    return {
      sourceId: SOURCE_ID,
      status: items.length > 0 ? 'ok' : 'empty',
      items,
      fetchedAt,
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
