import { describe, expect, it } from 'vitest';

import { SOURCES, SOURCE_LIST } from '@/lib/config/sources';
import { REFRESH_STRATEGIES } from '@/lib/config/refresh';
import {
  HEALTH_DESCRIPTIONS,
  HEALTH_LABELS,
  buildIntegrationReport,
  healthOf,
  redactSecrets,
} from '@/lib/data/status';
import type { SourceId } from '@/lib/config/sources';
import type { SourceResult } from '@/lib/types';

const NOW = Date.parse('2026-09-03T12:00:00.000Z');

function result(overrides: Partial<SourceResult> & { sourceId: string }): SourceResult {
  return {
    status: 'ok',
    items: [],
    fetchedAt: '2026-09-03T11:55:00.000Z',
    attemptedAt: '2026-09-03T12:00:00.000Z',
    ...overrides,
  };
}

function resultsFor(overrides: Partial<Record<SourceId, SourceResult>> = {}) {
  return Object.fromEntries(
    SOURCE_LIST.map((source) => [
      source.id,
      overrides[source.id] ?? result({ sourceId: source.id }),
    ]),
  ) as Record<SourceId, SourceResult>;
}

describe('redactSecrets', () => {
  it('strips credential query parameters while keeping the rest readable', () => {
    expect(redactSecrets('GET https://x.test/a?api_key=abc123&page=2 failed')).toBe(
      'GET https://x.test/a?api_key=[redacted]&page=2 failed',
    );
    expect(redactSecrets('https://x.test?token=zzz')).toContain('token=[redacted]');
    expect(redactSecrets('https://x.test?client_secret=zzz')).toContain('client_secret=[redacted]');
    expect(redactSecrets('https://x.test?access_token=zzz')).toContain('access_token=[redacted]');
  });

  it('strips bearer tokens and provider-shaped credentials', () => {
    expect(redactSecrets('Authorization: Bearer abcdef1234567890')).not.toContain(
      'abcdef1234567890',
    );
    expect(redactSecrets('token ghp_0123456789abcdefghij')).not.toContain('ghp_0123456789');
    expect(redactSecrets('github_pat_11ABCDEFG0123456789abcdefg')).toContain('[redacted]');
    expect(redactSecrets('xoxb-123456789012-abcdefghij')).toContain('[redacted]');
  });

  it('leaves ordinary error text alone', () => {
    const message = 'HTTP 503 Service Unavailable from https://dining.ucla.edu/menus-at-a-glance/';
    expect(redactSecrets(message)).toBe(message);
  });

  it('is safe on empty input', () => {
    expect(redactSecrets('')).toBe('');
  });
});

describe('healthOf', () => {
  it('describes deliberate non-fetching as itself, not as a failure', () => {
    expect(healthOf('lectures', result({ sourceId: 'lectures', status: 'ok' }), 'unknown')).toBe(
      'placeholder',
    );
    expect(
      healthOf(
        'science-journal',
        result({ sourceId: 'science-journal', status: 'error' }),
        'unknown',
      ),
    ).toBe('blocked');
  });

  it('separates a live source from one on fallback and one that is stale', () => {
    expect(healthOf('athletics', result({ sourceId: 'athletics', items: [] }), 'fresh')).toBe(
      'live',
    );
    expect(
      healthOf('athletics', result({ sourceId: 'athletics', fromFallback: true }), 'fresh'),
    ).toBe('fallback');
    expect(healthOf('athletics', result({ sourceId: 'athletics' }), 'stale')).toBe('stale');
  });

  it('reports an errored or missing source as unavailable', () => {
    expect(
      healthOf(
        'athletics',
        result({ sourceId: 'athletics', status: 'error', error: 'boom' }),
        'fresh',
      ),
    ).toBe('unavailable');
    expect(healthOf('athletics', undefined, 'unknown')).toBe('unavailable');
  });

  it('prefers fallback over stale, because the cause matters more than the age', () => {
    expect(
      healthOf('athletics', result({ sourceId: 'athletics', fromFallback: true }), 'stale'),
    ).toBe('fallback');
  });
});

describe('buildIntegrationReport', () => {
  it('describes every configured source exactly once', () => {
    const report = buildIntegrationReport(resultsFor(), '2026-09-03T12:00:00.000Z', {}, NOW);

    expect(report.sources).toHaveLength(SOURCE_LIST.length);
    expect(new Set(report.sources.map((entry) => entry.id)).size).toBe(SOURCE_LIST.length);
  });

  it('records last-successful-update and data age separately from the build time', () => {
    const report = buildIntegrationReport(
      resultsFor({
        athletics: result({
          sourceId: 'athletics',
          fetchedAt: '2026-09-03T10:00:00.000Z',
          fromFallback: true,
        }),
      }),
      '2026-09-03T12:00:00.000Z',
      {},
      NOW,
    );

    const athletics = report.sources.find((entry) => entry.id === 'athletics')!;
    expect(athletics.lastSuccessfulUpdate).toBe('2026-09-03T10:00:00.000Z');
    expect(athletics.dataAgeMinutes).toBe(120);
    expect(report.generatedAt).toBe('2026-09-03T12:00:00.000Z');
  });

  it('has no last-successful-update for a source that failed', () => {
    const report = buildIntegrationReport(
      resultsFor({
        events: result({ sourceId: 'events', status: 'error', error: 'HTTP 500' }),
      }),
      '2026-09-03T12:00:00.000Z',
      {},
      NOW,
    );

    const events = report.sources.find((entry) => entry.id === 'events')!;
    expect(events.lastSuccessfulUpdate).toBeNull();
    expect(events.dataAgeMinutes).toBeNull();
    expect(events.health).toBe('unavailable');
  });

  it('redacts credentials in error and note text', () => {
    const report = buildIntegrationReport(
      resultsFor({
        events: result({
          sourceId: 'events',
          status: 'error',
          error: 'failed https://x.test/a?api_key=supersecret',
          note: 'retry with token=alsosecret',
        }),
      }),
      'now',
      {},
      NOW,
    );

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('supersecret');
    expect(serialized).not.toContain('alsosecret');
    expect(serialized).toContain('[redacted]');
  });

  it('never publishes a credential value, only variable names', () => {
    const report = buildIntegrationReport(resultsFor(), 'now', {}, NOW);
    const panopto = report.sources.find((entry) => entry.id === 'lectures')!;

    expect(panopto.requiresCredentials).toBe(true);
    expect(panopto.credentialEnvVars).toContain('PANOPTO_CLIENT_SECRET');
    // The name is published; a value never is.
    expect(JSON.stringify(report)).not.toMatch(/PANOPTO_CLIENT_SECRET["']?\s*[:=]\s*["'][^"']+/);
  });

  it('lets a caller override the item count for sections that carry no MediaItems', () => {
    const report = buildIntegrationReport(resultsFor(), 'now', { dining: 136 }, NOW);
    expect(report.sources.find((entry) => entry.id === 'dining')!.itemCount).toBe(136);
  });

  it('summary counts add up to the number of sources', () => {
    const report = buildIntegrationReport(resultsFor(), 'now', {}, NOW);
    const { summary } = report;
    const counted =
      summary.live +
      summary.stale +
      summary.fallback +
      summary.unavailable +
      summary.blocked +
      summary.placeholder +
      summary.disabled;

    expect(counted).toBe(summary.total);
    expect(summary.total).toBe(SOURCE_LIST.length);
  });

  it('labels and describes every health state', () => {
    for (const health of Object.keys(HEALTH_LABELS) as Array<keyof typeof HEALTH_LABELS>) {
      expect(HEALTH_LABELS[health]).toBeTruthy();
      expect(HEALTH_DESCRIPTIONS[health].length).toBeGreaterThan(20);
    }
  });
});

describe('source registry invariants', () => {
  it('gives every source a complete refresh policy', () => {
    for (const source of SOURCE_LIST) {
      expect(REFRESH_STRATEGIES, source.id).toContain(source.refresh.strategy);
      expect(source.refresh.rationale.length, source.id).toBeGreaterThan(20);
      expect(source.refresh.staleAfterMinutes, source.id).toBeGreaterThan(0);
      expect(source.network.timeoutMs, source.id).toBeGreaterThan(0);
      expect(source.network.retries, source.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every browser-refreshable source a verified CORS endpoint and no credentials', () => {
    for (const source of SOURCE_LIST.filter((entry) => entry.refresh.strategy === 'browser')) {
      expect(source.refresh.browser, source.id).toBeDefined();
      expect(source.refresh.browser!.endpoint, source.id).toMatch(/^https:\/\//);
      expect(source.refresh.browser!.corsVerified.length, source.id).toBeGreaterThan(30);
      // A browser fetch is visible to every reader, so it can never carry a secret.
      expect(source.requiresCredentials, source.id).toBe(false);
      expect(source.credentialEnvVars, source.id).toHaveLength(0);
    }
  });

  it('never marks a credentialed source as browser-refreshable', () => {
    for (const source of SOURCE_LIST.filter((entry) => entry.requiresCredentials)) {
      expect(source.refresh.strategy, source.id).not.toBe('browser');
    }
  });

  it('never fetches the Panopto placeholder', () => {
    expect(SOURCES.lectures.refresh.strategy).toBe('none');
    expect(SOURCES.lectures.retrieval).toBe('placeholder');
  });

  it('allows more staleness than the refresh interval, so a quiet publisher is not called broken', () => {
    for (const source of SOURCE_LIST.filter((entry) => entry.refresh.strategy !== 'none')) {
      expect(source.refresh.staleAfterMinutes, source.id).toBeGreaterThanOrEqual(
        source.refresh.intervalMinutes,
      );
    }
  });
});
