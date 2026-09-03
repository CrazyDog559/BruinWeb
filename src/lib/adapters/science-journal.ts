/**
 * UCLA Undergraduate Science Journal — integration BLOCKED.
 *
 * Verified 2026-09-02:
 *  - Official site is https://usjucla.wixsite.com/usj-ucla (a Wix site).
 *    `usj.ucla.edu` and `uclausj.org` do not resolve.
 *  - The site is client-rendered: no API, no RSS, no JSON-LD, and only a single
 *    issue PDF link survives in the server-rendered HTML.
 *  - It is not published on eScholarship, and eScholarship's OAI-PMH exposes a
 *    single `everything` set with no per-journal filtering, so that route would
 *    not help even if it were.
 *  - Issues are distributed as whole-issue PDFs with no per-article index.
 *
 * Rather than invent issues, authors and abstracts, this adapter reports the
 * blocker honestly and the UI renders an "unavailable" state that links to the
 * journal. The contract below is complete: supply a `JournalIssueProvider` that
 * returns real issues and the section starts working with no UI changes.
 *
 * To finish the integration, one of these must become true:
 *   1. The journal publishes a structured index (JSON/CSV/RSS) of its articles.
 *   2. The journal moves to eScholarship or an OJS install with an OAI endpoint.
 *   3. A build step extracts per-article metadata from the issue PDFs — which
 *      needs the journal's permission and a PDF text-extraction dependency.
 */

import { SOURCES } from '@/lib/config/sources';
import { makeId, toIso } from '@/lib/normalize';
import type { MediaItem, SourceResult } from '@/lib/types';

const SOURCE_ID = 'science-journal';

/** One published item — an issue or an individual article. */
export interface JournalIssue {
  id: string;
  title: string;
  url: string;
  /** ISO date or year string; null when the source omits it. */
  publishedAt: string | null;
  abstract: string | null;
  authors: string[];
  /** Issue label or topic, e.g. "Volume 12" or "Neuroscience". */
  topics: string[];
}

export interface JournalIssueProvider {
  id: string;
  isConfigured(): boolean;
  fetchIssues(): Promise<JournalIssue[]>;
}

const BLOCKER_NOTE =
  'No machine-readable source exists. The journal publishes on a client-rendered Wix site with no API, feed or per-article index, and it is not on eScholarship. Browse issues on the official site.';

/** The provider that ships today: none available, and it says so. */
export const blockedJournalProvider: JournalIssueProvider = {
  id: 'blocked',
  isConfigured: () => false,
  fetchIssues: async () => [],
};

export function normalizeIssue(issue: JournalIssue, attribution: string): MediaItem {
  return {
    id: makeId(SOURCE_ID, issue.id),
    sourceId: SOURCE_ID,
    kind: 'publication',
    title: issue.title,
    url: issue.url,
    publishedAt: toIso(issue.publishedAt),
    startsAt: null,
    endsAt: null,
    excerpt: issue.abstract,
    image: null,
    categories: issue.topics,
    authors: issue.authors,
    durationSeconds: null,
    location: null,
    badges: [],
    attribution,
    dataMode: 'build',
  };
}

export async function loadScienceJournal(
  provider: JournalIssueProvider = blockedJournalProvider,
  now: Date = new Date(),
): Promise<SourceResult> {
  const config = SOURCES[SOURCE_ID];
  const fetchedAt = now.toISOString();

  if (!config.enabled || !provider.isConfigured()) {
    return {
      sourceId: SOURCE_ID,
      status: 'unavailable',
      items: [],
      fetchedAt,
      note: BLOCKER_NOTE,
    };
  }

  try {
    const issues = await provider.fetchIssues();
    return {
      sourceId: SOURCE_ID,
      status: issues.length > 0 ? 'ok' : 'empty',
      items: issues.map((issue) => normalizeIssue(issue, config.attribution)),
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
