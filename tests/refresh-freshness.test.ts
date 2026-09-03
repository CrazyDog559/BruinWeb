import { describe, expect, it } from 'vitest';

import {
  ageInMinutes,
  formatAge,
  formatAgePhrase,
  freshnessOf,
  REFRESH_STRATEGIES,
  REFRESH_STRATEGY_LABELS,
} from '@/lib/config/refresh';

/**
 * Freshness is what the UI uses to decide whether to tell a reader the content
 * may be out of date, so its edge cases matter more than its happy path.
 */
describe('freshnessOf', () => {
  const policy = { staleAfterMinutes: 60 };
  const now = Date.parse('2026-09-03T12:00:00.000Z');

  it('calls recent data fresh and old data stale', () => {
    expect(freshnessOf('2026-09-03T11:30:00.000Z', policy, now)).toBe('fresh');
    expect(freshnessOf('2026-09-03T10:00:00.000Z', policy, now)).toBe('stale');
  });

  it('treats the boundary itself as still fresh', () => {
    expect(freshnessOf('2026-09-03T11:00:00.000Z', policy, now)).toBe('fresh');
    expect(freshnessOf('2026-09-03T10:59:00.000Z', policy, now)).toBe('stale');
  });

  it('reports unknown rather than guessing when there is no usable timestamp', () => {
    for (const value of [null, undefined, '', 'not a date']) {
      expect(freshnessOf(value, policy, now)).toBe('unknown');
    }
  });

  it('treats a future timestamp as fresh rather than inventing a negative age', () => {
    expect(freshnessOf('2026-09-03T13:00:00.000Z', policy, now)).toBe('fresh');
    expect(ageInMinutes('2026-09-03T13:00:00.000Z', now)).toBe(0);
  });

  it('never calls anything stale when the window is infinite', () => {
    expect(
      freshnessOf('2020-01-01T00:00:00.000Z', { staleAfterMinutes: Number.POSITIVE_INFINITY }, now),
    ).toBe('fresh');
  });
});

describe('ageInMinutes and formatAge', () => {
  const now = Date.parse('2026-09-03T12:00:00.000Z');

  it('measures age in whole minutes', () => {
    expect(ageInMinutes('2026-09-03T11:45:00.000Z', now)).toBe(15);
    expect(ageInMinutes('2026-09-02T12:00:00.000Z', now)).toBe(1440);
    expect(ageInMinutes(null, now)).toBeNull();
    expect(ageInMinutes('nonsense', now)).toBeNull();
  });

  it('reads naturally at every scale', () => {
    expect(formatAge(0)).toBe('just now');
    expect(formatAge(1)).toBe('1 min');
    expect(formatAge(59)).toBe('59 min');
    expect(formatAge(60)).toBe('1 hr');
    expect(formatAge(90)).toBe('2 hr');
    expect(formatAge(60 * 72)).toBe('3 days');
    expect(formatAge(null)).toBe('unknown');
  });

  it('reads as a sentence fragment without saying "just now ago"', () => {
    expect(formatAgePhrase(0)).toBe('just now');
    expect(formatAgePhrase(null)).toBe('unknown');
    expect(formatAgePhrase(15)).toBe('15 min ago');
    expect(formatAgePhrase(180)).toBe('3 hr ago');
    expect(formatAgePhrase(60 * 96)).toBe('4 days ago');
  });
});

describe('refresh strategy labels', () => {
  it('labels every strategy', () => {
    for (const strategy of REFRESH_STRATEGIES) {
      expect(REFRESH_STRATEGY_LABELS[strategy]).toBeTruthy();
    }
  });
});
