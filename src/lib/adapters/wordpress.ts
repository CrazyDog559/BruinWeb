/**
 * Shared WordPress REST adapter.
 *
 * Daily Bruin, UCLA Radio and BruinLife all run WordPress and expose the same
 * core `/wp-json/wp/v2/posts` shape, so they share one fetch + normalize path.
 * Per-site differences (a separate headless API host, extra plugin fields) are
 * expressed as options rather than by branching inside the normalizer.
 *
 * Verified 2026-09-02:
 *   https://wp.dailybruin.com/wp-json/wp/v2/posts?per_page=5&_embed  -> 200
 *   https://uclaradio.com/wp-json/wp/v2/posts?per_page=5&_embed      -> 200
 *   https://bruinlife.com/wp-json/wp/v2/posts?per_page=5&_embed      -> 200
 */

import { z } from 'zod';

import { fetchJson, fetchText } from '@/lib/net/fetch-json';
import { fetchFeed, type RssItem } from '@/lib/net/rss';
import { makeId, toExcerpt, toIso, stripHtml } from '@/lib/normalize';
import type { MediaItem, MediaKind } from '@/lib/types';

const RenderedSchema = z.object({ rendered: z.string() }).partial({ rendered: true });

const TermSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  taxonomy: z.string().optional(),
});

const MediaSizeSchema = z.object({
  source_url: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const FeaturedMediaSchema = z.object({
  source_url: z.string().optional(),
  alt_text: z.string().optional(),
  media_details: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      sizes: z.record(z.string(), MediaSizeSchema).optional(),
    })
    .optional(),
});

/**
 * Deliberately permissive: WordPress installs add plugin fields freely, and an
 * unexpected extra key must never invalidate a post. Only `id` and `link` are
 * genuinely required — without them we cannot build a stable id or a back-link.
 */
export const WpPostSchema = z
  .object({
    id: z.number(),
    link: z.string().url(),
    date: z.string().nullish(),
    date_gmt: z.string().nullish(),
    slug: z.string().nullish(),
    title: RenderedSchema.nullish(),
    excerpt: RenderedSchema.nullish(),
    content: RenderedSchema.nullish(),
    featured_image_src: z.string().nullish(),
    /**
     * Co-author plugins disagree on this field: Daily Bruin returns objects
     * with `display_name`, BruinLife returns bare numeric user ids. Accept
     * anything and pick out names defensively, so one site's plugin choice
     * cannot invalidate every post in the feed.
     */
    coauthors: z.array(z.unknown()).nullish(),
    author_info: z.object({ display_name: z.string().nullish() }).nullish(),
    _embedded: z
      .object({
        author: z.array(z.object({ name: z.string().nullish() })).nullish(),
        'wp:featuredmedia': z.array(FeaturedMediaSchema).nullish(),
        'wp:term': z.array(z.array(TermSchema)).nullish(),
      })
      .nullish(),
  })
  .passthrough();

export type WpPost = z.infer<typeof WpPostSchema>;

export interface WordPressAdapterOptions {
  sourceId: string;
  /** Origin serving `/wp-json`, e.g. `https://wp.dailybruin.com`. */
  apiBase: string;
  kind: MediaKind;
  attribution: string;
  perPage: number;
  /**
   * Optional second public endpoint to try when the REST API is refused.
   *
   * Daily Bruin's API host answers normally from a residential connection but
   * returns 403 to requests from cloud datacenter ranges, which is where the
   * production build runs. The site's own RSS feed is a different, equally
   * public surface, so we fall back to it rather than disguising the request —
   * we keep identifying ourselves honestly in the User-Agent either way.
   */
  feedUrl?: string;
  /**
   * Optional last resort: a public page that embeds the same WordPress post
   * objects as structured data. Daily Bruin's reader-facing site is a headless
   * Next.js frontend whose `__NEXT_DATA__` payload carries the very objects the
   * REST API would have returned, served from a host that is not refusing us.
   */
  embeddedPageUrl?: string;
}

/** Widest variant we will ever need: cards are at most ~640 CSS px at 2x DPR. */
const MAX_VARIANT_WIDTH = 1400;
const MIN_VARIANT_WIDTH = 280;
/** Preferred width for the plain `src` fallback. */
const TARGET_WIDTH = 768;

/**
 * Build a `srcset` from WordPress's registered image sizes.
 *
 * Only variants whose aspect ratio is close to the original are used — themes
 * also register square avatar and banner crops, and mixing those into a srcset
 * would let the browser pick a differently-framed image at some viewport width.
 */
function buildSrcSet(media: z.infer<typeof FeaturedMediaSchema> | undefined): {
  srcSet?: string;
  src?: string;
} {
  const details = media?.media_details;
  const sizes = details?.sizes;
  if (!sizes || !details?.width || !details?.height) return {};

  const fullRatio = details.width / details.height;

  const variants = Object.values(sizes)
    .filter((size): size is { source_url: string; width: number; height: number } =>
      Boolean(size.source_url && size.width && size.height),
    )
    .filter((size) => size.width >= MIN_VARIANT_WIDTH && size.width <= MAX_VARIANT_WIDTH)
    .filter((size) => Math.abs(size.width / size.height - fullRatio) / fullRatio < 0.15)
    .sort((a, b) => a.width - b.width);

  // Deduplicate by width; several registered sizes often resolve to one file.
  const byWidth = new Map<number, string>();
  for (const variant of variants) byWidth.set(variant.width, variant.source_url);
  if (byWidth.size === 0) return {};

  const widths = [...byWidth.keys()].sort((a, b) => a - b);
  const srcSet = widths.map((width) => `${byWidth.get(width)} ${width}w`).join(', ');

  // Default `src` for browsers that ignore srcset: the closest to our target.
  const best = widths.reduce((chosen, width) =>
    Math.abs(width - TARGET_WIDTH) < Math.abs(chosen - TARGET_WIDTH) ? width : chosen,
  );

  return { srcSet, src: byWidth.get(best) };
}

/** Pull the best available image, preferring pre-resolved plugin fields. */
function pickImage(post: WpPost, title: string) {
  const embedded = post._embedded?.['wp:featuredmedia']?.[0];
  const original = post.featured_image_src ?? embedded?.source_url;
  const { srcSet, src: sized } = buildSrcSet(embedded);
  const src = sized ?? original;
  if (!src) return null;

  return {
    src,
    alt: stripHtml(embedded?.alt_text) || title,
    width: embedded?.media_details?.width,
    height: embedded?.media_details?.height,
    srcSet,
  };
}

/** `wp:term[0]` is the category taxonomy; later groups are tags. */
function pickCategories(post: WpPost): string[] {
  const groups = post._embedded?.['wp:term'] ?? [];
  const categories = (groups[0] ?? [])
    .filter((term) => !term.taxonomy || term.taxonomy === 'category')
    .map((term) => stripHtml(term.name))
    .filter((name): name is string => Boolean(name) && name !== 'Uncategorized');
  return [...new Set(categories)].slice(0, 4);
}

/** Read a display name from a co-author entry, ignoring bare ids. */
function coauthorName(entry: unknown): string {
  if (typeof entry === 'string') return stripHtml(entry);
  if (entry && typeof entry === 'object') {
    const name = (entry as { display_name?: unknown }).display_name;
    if (typeof name === 'string') return stripHtml(name);
  }
  return '';
}

function pickAuthors(post: WpPost): string[] {
  const coauthors = (post.coauthors ?? []).map(coauthorName).filter(Boolean);
  if (coauthors.length > 0) return [...new Set(coauthors)].slice(0, 3);

  const embedded = (post._embedded?.author ?? [])
    .map((author) => stripHtml(author.name))
    .filter(Boolean);
  if (embedded.length > 0) return [...new Set(embedded)].slice(0, 3);

  const single = stripHtml(post.author_info?.display_name);
  return single ? [single] : [];
}

/** Convert one validated WordPress post into the shared media shape. */
export function normalizeWpPost(post: WpPost, options: WordPressAdapterOptions): MediaItem | null {
  const title = stripHtml(post.title?.rendered);
  if (!title) return null;

  // `date_gmt` is already UTC; `date` is site-local wall clock. Prefer the former.
  const publishedAt = post.date_gmt
    ? toIso(`${post.date_gmt.replace(/Z$/, '')}Z`)
    : toIso(post.date);

  return {
    id: makeId(options.sourceId, post.slug ?? String(post.id)),
    sourceId: options.sourceId,
    kind: options.kind,
    title,
    url: post.link,
    publishedAt,
    startsAt: null,
    endsAt: null,
    excerpt: toExcerpt(post.excerpt?.rendered ?? post.content?.rendered),
    image: pickImage(post, title),
    categories: pickCategories(post),
    authors: pickAuthors(post),
    durationSeconds: null,
    location: null,
    badges: [],
    attribution: options.attribution,
    dataMode: 'build',
  };
}

/** Normalize an RSS entry from the same publisher into the shared shape. */
export function normalizeWpFeedItem(
  entry: RssItem,
  options: WordPressAdapterOptions,
): MediaItem | null {
  const title = stripHtml(entry.title);
  if (!title || !entry.link) return null;

  return {
    id: makeId(options.sourceId, entry.guid ?? entry.link),
    sourceId: options.sourceId,
    kind: options.kind,
    title,
    url: entry.link,
    publishedAt: toIso(entry.pubDate),
    startsAt: null,
    endsAt: null,
    excerpt: toExcerpt(entry.description),
    image: entry.imageUrl ? { src: entry.imageUrl, alt: title } : null,
    categories: [...new Set(entry.categories.map((c) => stripHtml(c)).filter(Boolean))].slice(0, 4),
    authors: entry.author ? [stripHtml(entry.author)] : [],
    durationSeconds: null,
    location: null,
    badges: [],
    attribution: options.attribution,
    dataMode: 'build',
  };
}

/**
 * Pull WordPress post objects out of a Next.js `__NEXT_DATA__` payload.
 *
 * The payload nests posts under several editorial slots (`posts.aStory`,
 * `mappedITN`, `multimediaPosts`, …), so rather than hard-coding slot names —
 * which are layout decisions that change — we walk the tree for anything with
 * the shape of a post and deduplicate by id.
 */
export function extractEmbeddedWpPosts(html: string): unknown[] {
  const match = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
    html,
  );
  if (!match) throw new Error('__NEXT_DATA__ payload not found');

  const payload: unknown = JSON.parse(match[1]);
  const found = new Map<number, unknown>();

  const walk = (node: unknown, depth: number): void => {
    if (depth > 8 || node === null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const entry of node) walk(entry, depth + 1);
      return;
    }

    const record = node as Record<string, unknown>;
    if (
      typeof record.id === 'number' &&
      typeof record.link === 'string' &&
      typeof record.title === 'object'
    ) {
      // The same post appears in several slots, sometimes trimmed down. Keep
      // the richest copy so excerpts and images are not lost to a sparse one.
      const existing = found.get(record.id) as Record<string, unknown> | undefined;
      if (!existing || Object.keys(record).length > Object.keys(existing).length) {
        found.set(record.id, record);
      }
    }

    for (const value of Object.values(record)) walk(value, depth + 1);
  };

  walk(payload, 0);
  return [...found.values()];
}

/** Validate and normalize a batch of raw post objects. */
function normalizeMany(raw: unknown[], options: WordPressAdapterOptions): MediaItem[] {
  // Validate per item so one malformed post cannot discard the whole feed.
  return raw
    .map((entry) => WpPostSchema.safeParse(entry))
    .filter((result) => result.success)
    .map((result) => normalizeWpPost(result.data, options))
    .filter((item): item is MediaItem => item !== null);
}

/** Fetch and normalize recent posts via the REST API. */
async function fetchViaRestApi(options: WordPressAdapterOptions): Promise<MediaItem[]> {
  const url = `${options.apiBase}/wp-json/wp/v2/posts?per_page=${options.perPage}&_embed=1`;
  const raw = await fetchJson<unknown>(url);

  if (!Array.isArray(raw)) {
    throw new Error('Expected an array of posts');
  }

  return normalizeMany(raw, options);
}

/** Fetch via the publisher's RSS feed. */
async function fetchViaFeed(options: WordPressAdapterOptions): Promise<MediaItem[]> {
  if (!options.feedUrl) throw new Error('No feed configured');
  const entries = await fetchFeed(options.feedUrl);
  return entries
    .map((entry) => normalizeWpFeedItem(entry, options))
    .filter((item): item is MediaItem => item !== null);
}

/** Fetch via structured data embedded in a public page. */
async function fetchViaEmbeddedPage(options: WordPressAdapterOptions): Promise<MediaItem[]> {
  if (!options.embeddedPageUrl) throw new Error('No embedded page configured');
  const html = await fetchText(options.embeddedPageUrl);
  return normalizeMany(extractEmbeddedWpPosts(html), options);
}

/**
 * Fetch recent posts from whichever public surface answers.
 *
 * Order of preference: the REST API (richest — includes sized image variants),
 * then the publisher's RSS feed, then structured data embedded in a public
 * page. Every one of these is a surface the publisher serves openly; the
 * fallbacks exist because some hosts refuse cloud datacenter ranges, which is
 * where the production build runs. Throws only when all configured surfaces
 * fail, and the caller turns that into a `SourceResult`.
 */
export async function fetchWordPressPosts(options: WordPressAdapterOptions): Promise<MediaItem[]> {
  const attempts: Array<{ label: string; run: () => Promise<MediaItem[]> }> = [
    { label: 'REST API', run: () => fetchViaRestApi(options) },
    ...(options.feedUrl ? [{ label: 'RSS feed', run: () => fetchViaFeed(options) }] : []),
    ...(options.embeddedPageUrl
      ? [{ label: 'embedded page data', run: () => fetchViaEmbeddedPage(options) }]
      : []),
  ];

  let lastError: unknown = new Error('No retrieval method configured');

  for (const [index, attempt] of attempts.entries()) {
    try {
      const items = await attempt.run();
      if (items.length > 0) return items;
      lastError = new Error(`${attempt.label} returned no items`);
    } catch (error) {
      lastError = error;
    }

    const next = attempts[index + 1];
    if (next) {
      console.warn(
        `[bruinweb] ${options.sourceId}: ${attempt.label} unavailable (${
          lastError instanceof Error ? lastError.message : 'unknown'
        }); trying ${next.label}.`,
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All retrieval methods failed');
}
