/**
 * Integration status report.
 *
 * Produced on every build from the same snapshot the pages render, so it cannot
 * drift from what a reader actually sees. Two consumers:
 *
 *   - the `/status` page, which shows every section's health to a reader;
 *   - `out/status.json`, which the post-deployment smoke test reads to confirm
 *     a scheduled rebuild really did retrieve new data.
 *
 * Everything here is public by construction. `redactSecrets` is applied to
 * every error string on the way out, because upstream error messages can quote
 * a request URL and a future source may put a token in one.
 */

import { SOURCES, SOURCE_LIST, type SourceId } from '@/lib/config/sources';
import {
  ageInMinutes,
  freshnessOf,
  type Freshness,
  type RefreshStrategy,
} from '@/lib/config/refresh';
import type { SourceResult } from '@/lib/types';

/**
 * Anything of the form `<secret-ish name> = <value>`, whether it appears as a
 * URL query parameter or loose in an error message — upstream libraries phrase
 * these both ways, so matching only the `?key=` form would leak the other.
 */
const SECRET_ASSIGNMENT =
  /\b(api[_-]?key|access[_-]?token|client[_-]?secret|refresh[_-]?token|token|secret|password|passwd|auth|signature|sig)(\s*[=:]\s*)(?!\[redacted\])[^\s&"'`,;)\]}]+/gi;

/** Anything shaped like a bearer token or a long opaque credential. */
const SECRET_LITERAL =
  /\b(?:bearer\s+[A-Za-z0-9._-]{8,}|gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|xox[abposr]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{16,})/gi;

/**
 * Strip credentials from a string bound for a public report or a build log.
 *
 * Deliberately blunt: it would rather redact something harmless than let a
 * token reach a public artifact.
 */
export function redactSecrets(input: string): string {
  return input.replace(SECRET_ASSIGNMENT, '$1$2[redacted]').replace(SECRET_LITERAL, '[redacted]');
}

export type SourceHealth =
  'live' | 'stale' | 'fallback' | 'unavailable' | 'blocked' | 'placeholder' | 'disabled';

export interface SourceStatusEntry {
  id: SourceId;
  name: string;
  /** Where a reader can see the original. */
  officialUrl: string;
  /** The machine-readable endpoint, when one exists. */
  endpoint: string | null;
  retrieval: string;
  refreshStrategy: RefreshStrategy;
  /** Expected refresh cadence in minutes. */
  expectedEveryMinutes: number;
  health: SourceHealth;
  freshness: Freshness;
  itemCount: number;
  /** When the data currently shown was retrieved. */
  lastSuccessfulUpdate: string | null;
  /** Age of that data in minutes. */
  dataAgeMinutes: number | null;
  /** How long this build's attempt took. */
  retrievalDurationMs: number | null;
  requiresCredentials: boolean;
  credentialEnvVars: readonly string[];
  attribution: string;
  enabled: boolean;
  /** Redacted. Present only when something went wrong. */
  error?: string;
  note?: string;
}

export interface IntegrationReport {
  generatedAt: string;
  /** Commit this build came from, when the platform exposes it. */
  commit: string | null;
  summary: {
    total: number;
    live: number;
    stale: number;
    fallback: number;
    unavailable: number;
    blocked: number;
    placeholder: number;
    disabled: number;
    totalItems: number;
  };
  sources: SourceStatusEntry[];
}

/**
 * Classify one section.
 *
 * The order matters: a deliberately unfetched or blocked source is described as
 * such rather than being called "unavailable", which would imply a fault.
 */
export function healthOf(
  sourceId: SourceId,
  result: SourceResult | undefined,
  freshness: Freshness,
): SourceHealth {
  const config = SOURCES[sourceId];

  if (!config.enabled) return 'disabled';
  if (config.retrieval === 'placeholder') return 'placeholder';
  if (config.retrieval === 'blocked') return 'blocked';

  if (!result || result.status === 'error') return 'unavailable';
  if (result.fromFallback) return 'fallback';
  if (result.status === 'empty' && sourceId !== 'dining') return 'unavailable';
  return freshness === 'stale' ? 'stale' : 'live';
}

export function buildIntegrationReport(
  results: Record<SourceId, SourceResult>,
  generatedAt: string,
  itemCounts: Partial<Record<SourceId, number>> = {},
  now: number = Date.now(),
): IntegrationReport {
  const sources: SourceStatusEntry[] = SOURCE_LIST.map((config) => {
    const result = results[config.id];
    const lastSuccessfulUpdate =
      result && result.status !== 'error' ? (result.fetchedAt ?? null) : null;

    const freshness =
      config.refresh.strategy === 'none'
        ? 'unknown'
        : freshnessOf(lastSuccessfulUpdate, config.refresh, now);

    const health = healthOf(config.id, result, freshness);

    return {
      id: config.id,
      name: config.name,
      officialUrl: config.homepage,
      endpoint: config.endpoint,
      retrieval: config.retrieval,
      refreshStrategy: config.refresh.strategy,
      expectedEveryMinutes: config.refresh.intervalMinutes,
      health,
      freshness,
      itemCount: itemCounts[config.id] ?? result?.items.length ?? 0,
      lastSuccessfulUpdate,
      dataAgeMinutes: ageInMinutes(lastSuccessfulUpdate, now),
      retrievalDurationMs: result?.durationMs ?? null,
      requiresCredentials: config.requiresCredentials,
      credentialEnvVars: config.credentialEnvVars,
      attribution: config.attribution,
      enabled: config.enabled,
      error: result?.error ? redactSecrets(result.error) : undefined,
      note: result?.note ? redactSecrets(result.note) : undefined,
    };
  });

  const count = (health: SourceHealth) => sources.filter((entry) => entry.health === health).length;

  return {
    generatedAt,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
    summary: {
      total: sources.length,
      live: count('live'),
      stale: count('stale'),
      fallback: count('fallback'),
      unavailable: count('unavailable'),
      blocked: count('blocked'),
      placeholder: count('placeholder'),
      disabled: count('disabled'),
      totalItems: sources.reduce((total, entry) => total + entry.itemCount, 0),
    },
    sources,
  };
}

export const HEALTH_LABELS: Record<SourceHealth, string> = {
  live: 'Live',
  stale: 'Stale',
  fallback: 'Showing older data',
  unavailable: 'Unavailable',
  blocked: 'Blocked',
  placeholder: 'Placeholder',
  disabled: 'Disabled',
};

export const HEALTH_DESCRIPTIONS: Record<SourceHealth, string> = {
  live: 'Retrieved successfully in the most recent build, within its expected refresh window.',
  stale: 'Retrieved successfully, but longer ago than this source’s expected refresh interval.',
  fallback:
    'The publisher did not respond during the most recent build, so the last dataset that retrieved successfully is being shown, with its real age.',
  unavailable: 'No usable data. Nothing is shown for this section rather than anything invented.',
  blocked:
    'No machine-readable source exists. The blocker is documented rather than worked around.',
  placeholder: 'Clearly-labelled template content. Not real UCLA data, and never fetched.',
  disabled: 'Turned off by a feature flag. The adapter is intact.',
};
