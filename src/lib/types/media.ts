/**
 * The shared, normalized shape every integration produces.
 *
 * This interface is the contract between adapters and the UI. A schema change
 * inside one upstream source must be absorbed by that source's adapter — never
 * by widening this type. Source-specific data that the shared UI cannot render
 * generically belongs in that adapter's own module, not here.
 */

/** Broad media taxonomy used for cross-source filtering. */
export const MEDIA_KINDS = [
  'article',
  'audio',
  'video',
  'publication',
  'event',
  'menu',
  'lecture',
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * Where an item's content actually came from. Surfaced in the UI so a reader is
 * never misled into thinking placeholder content is real reporting.
 *
 * - `live`        fetched in the browser at view time
 * - `build`       fetched from the upstream source during `next build`
 * - `placeholder` deliberate mock data standing in for an unbuilt integration
 * - `unavailable` the source could not be reached; nothing real is shown
 */
export const DATA_MODES = ['live', 'build', 'placeholder', 'unavailable'] as const;

export type DataMode = (typeof DATA_MODES)[number];

export interface MediaImage {
  src: string;
  alt: string;
  /** Intrinsic width/height when the source reports them; enables stable layout. */
  width?: number;
  height?: number;
  /**
   * A `srcset` value when the publisher offers pre-rendered size variants.
   * Static export has no image optimizer, so serving the right variant from the
   * publisher is the only way to avoid shipping a multi-megapixel original into
   * a 400px card.
   */
  srcSet?: string;
}

export interface MediaItem {
  /** Deterministic and stable across builds: `${sourceId}:${slug-or-hash}`. */
  id: string;
  sourceId: string;
  kind: MediaKind;
  title: string;
  /** Canonical link back to the publisher. Never empty, never rewritten. */
  url: string;
  /** ISO-8601 UTC, or null when the source does not report a date. */
  publishedAt: string | null;
  /** Event scheduling. Null for non-event kinds. */
  startsAt: string | null;
  endsAt: string | null;
  /** Short plain-text summary. Excerpt only — never a full republished article. */
  excerpt: string | null;
  image: MediaImage | null;
  categories: string[];
  authors: string[];
  durationSeconds: number | null;
  location: string | null;
  /** Short display labels, e.g. "Vegan", "Men's Basketball", "Coming Soon". */
  badges: string[];
  /** Credit line required by the upstream publisher. */
  attribution: string;
  dataMode: DataMode;
}

/** Outcome of running a single adapter. Adapters never throw; they return this. */
export type SourceStatus = 'ok' | 'empty' | 'error' | 'unavailable' | 'placeholder';

export interface SourceResult {
  sourceId: string;
  status: SourceStatus;
  items: MediaItem[];
  /** ISO-8601 UTC timestamp of the retrieval attempt. */
  fetchedAt: string;
  /** Human-readable failure reason. Never contains credentials. */
  error?: string;
  /** Operator-facing note, e.g. "awaiting PANOPTO_API_KEY". */
  note?: string;
}
