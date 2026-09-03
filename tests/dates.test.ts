import { describe, expect, it } from 'vitest';

import {
  toIso,
  campusDate,
  isCampusToday,
  formatDuration,
  formatRelative,
  campusWallClockToIso,
} from '@/lib/normalize/dates';

describe('toIso', () => {
  it('returns null for null, undefined and empty string', () => {
    expect(toIso(null)).toBeNull();
    expect(toIso(undefined)).toBeNull();
    expect(toIso('')).toBeNull();
  });

  it('accepts a Date object', () => {
    const date = new Date('2026-03-04T10:00:00.000Z');
    expect(toIso(date)).toBe('2026-03-04T10:00:00.000Z');
  });

  it('returns null for an invalid Date object', () => {
    expect(toIso(new Date('not a date'))).toBeNull();
  });

  it('treats numbers below 1e12 as second-precision timestamps', () => {
    expect(toIso(1700000000)).toBe('2023-11-14T22:13:20.000Z');
  });

  it('treats numbers at or above 1e12 as millisecond-precision timestamps', () => {
    // Same instant as the seconds case above, expressed in milliseconds.
    expect(toIso(1700000000000)).toBe('2023-11-14T22:13:20.000Z');
  });

  it('anchors a bare YYYY-MM-DD to noon UTC so Los Angeles rendering never rolls it back a day', () => {
    const iso = toIso('2026-09-02');
    expect(iso).toBe('2026-09-02T12:00:00.000Z');
    // At noon UTC it is still Sept 2 in Los Angeles (UTC-7 in September).
    expect(campusDate(new Date(iso!))).toBe('2026-09-02');
  });

  it('treats an offset-less wall-clock timestamp as UCLA local time', () => {
    // 2026-09-02 is during PDT (UTC-7): 13:20:46 local -> 20:20:46 UTC.
    expect(toIso('2026-09-02T13:20:46')).toBe('2026-09-02T20:20:46.000Z');
  });

  it('returns null for a garbage string', () => {
    expect(toIso('not a real date')).toBeNull();
  });
});

describe('campusDate', () => {
  it('returns YYYY-MM-DD at UCLA for a known instant', () => {
    // 20:20:46 UTC on Sept 2 is 13:20:46 PDT, still Sept 2 locally.
    expect(campusDate(new Date('2026-09-02T20:20:46.000Z'))).toBe('2026-09-02');
  });

  it('rolls over correctly near local midnight', () => {
    // 06:00 UTC on Sept 3 is 23:00 PDT on Sept 2.
    expect(campusDate(new Date('2026-09-03T06:00:00.000Z'))).toBe('2026-09-02');
  });
});

describe('isCampusToday', () => {
  const now = new Date('2026-09-02T20:20:46.000Z'); // campus date 2026-09-02

  it('is true for an iso timestamp on the same campus day', () => {
    expect(isCampusToday('2026-09-02T15:00:00.000Z', now)).toBe(true);
  });

  it('is false for an iso timestamp on a different campus day', () => {
    expect(isCampusToday('2026-09-01T15:00:00.000Z', now)).toBe(false);
  });

  it('is false for null', () => {
    expect(isCampusToday(null, now)).toBe(false);
  });

  it('is false for an unparsable iso string', () => {
    expect(isCampusToday('garbage', now)).toBe(false);
  });
});

describe('formatDuration', () => {
  it('returns empty string for null', () => {
    expect(formatDuration(null)).toBe('');
  });

  it('returns empty string for zero', () => {
    expect(formatDuration(0)).toBe('');
  });

  it('formats sub-hour durations as M:SS', () => {
    expect(formatDuration(90)).toBe('1:30');
  });

  it('formats hour-plus durations as H:MM:SS', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-09-02T20:00:00.000Z');

  it('returns "just now" for sub-minute differences', () => {
    const iso = new Date(now.getTime() - 10_000).toISOString();
    expect(formatRelative(iso, now)).toBe('just now');
  });

  it('formats minutes in the past', () => {
    const iso = new Date(now.getTime() - 30 * 60_000).toISOString();
    expect(formatRelative(iso, now)).toBe('30m ago');
  });

  it('formats hours in the past', () => {
    const iso = new Date(now.getTime() - 5 * 3_600_000).toISOString();
    expect(formatRelative(iso, now)).toBe('5h ago');
  });

  it('formats days in the past', () => {
    const iso = new Date(now.getTime() - 3 * 86_400_000).toISOString();
    expect(formatRelative(iso, now)).toBe('3d ago');
  });

  it('formats future timestamps as "in Xh"', () => {
    const iso = new Date(now.getTime() + 3 * 3_600_000).toISOString();
    expect(formatRelative(iso, now)).toBe('in 3h');
  });

  it('returns empty string for null', () => {
    expect(formatRelative(null, now)).toBe('');
  });
});

describe('campusWallClockToIso', () => {
  it('converts a valid campus date/time to UTC ISO', () => {
    expect(campusWallClockToIso('2026-09-02', '08:00')).toBe('2026-09-02T15:00:00.000Z');
  });

  it('accounts for standard time (PST) in winter', () => {
    expect(campusWallClockToIso('2026-01-15', '08:00')).toBe('2026-01-15T16:00:00.000Z');
  });

  it('returns null for a malformed date', () => {
    expect(campusWallClockToIso('09-02-2026', '08:00')).toBeNull();
  });

  it('returns null for a malformed time', () => {
    expect(campusWallClockToIso('2026-09-02', '8am')).toBeNull();
  });
});
