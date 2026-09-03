/**
 * Daily Bruin, UCLA Radio and BruinLife.
 *
 * All three are WordPress installs, so they share `fetchWordPressPosts` and
 * differ only in configuration. Note that Daily Bruin's REST API is served from
 * a separate headless host (`wp.dailybruin.com`) — `dailybruin.com/wp-json` is
 * swallowed by its Next.js frontend and 404s.
 */

import { BUILD } from '@/lib/config/site';
import { SOURCES, type SourceId } from '@/lib/config/sources';
import type { MediaKind, SourceResult } from '@/lib/types';

import { fetchWordPressPosts } from './wordpress';

interface WpSourceSpec {
  sourceId: Extract<SourceId, 'daily-bruin' | 'ucla-radio' | 'bruinlife'>;
  apiBase: string;
  kind: MediaKind;
  /** Public RSS feed used when the REST API refuses the request. */
  feedUrl?: string;
  /** Public page embedding the same post objects, used as a last resort. */
  embeddedPageUrl?: string;
}

const WP_SOURCES: WpSourceSpec[] = [
  {
    sourceId: 'daily-bruin',
    apiBase: 'https://wp.dailybruin.com',
    kind: 'article',
    feedUrl: 'https://wp.dailybruin.com/feed/',
    // wp.dailybruin.com refuses cloud datacenter ranges outright, so production
    // builds land here: the reader-facing site embeds the same post objects.
    embeddedPageUrl: 'https://dailybruin.com/',
  },
  {
    sourceId: 'ucla-radio',
    apiBase: 'https://uclaradio.com',
    kind: 'audio',
    feedUrl: 'https://uclaradio.com/feed/',
  },
  {
    sourceId: 'bruinlife',
    apiBase: 'https://bruinlife.com',
    kind: 'article',
    feedUrl: 'https://bruinlife.com/feed/',
  },
];

/** Run one WordPress-backed source. Never throws — failures become a result. */
export async function loadWordPressSource(spec: WpSourceSpec): Promise<SourceResult> {
  const config = SOURCES[spec.sourceId];
  const fetchedAt = new Date().toISOString();

  if (!config.enabled) {
    return {
      sourceId: spec.sourceId,
      status: 'unavailable',
      items: [],
      fetchedAt,
      note: 'Disabled by configuration',
    };
  }

  try {
    const items = await fetchWordPressPosts({
      sourceId: spec.sourceId,
      apiBase: spec.apiBase,
      kind: spec.kind,
      attribution: config.attribution,
      perPage: BUILD.itemsPerSource,
      feedUrl: spec.feedUrl,
      embeddedPageUrl: spec.embeddedPageUrl,
    });

    return {
      sourceId: spec.sourceId,
      status: items.length > 0 ? 'ok' : 'empty',
      items,
      fetchedAt,
    };
  } catch (error) {
    return {
      sourceId: spec.sourceId,
      status: 'error',
      items: [],
      fetchedAt,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function loadStudentMediaSources(): Promise<SourceResult[]> {
  return Promise.all(WP_SOURCES.map(loadWordPressSource));
}
