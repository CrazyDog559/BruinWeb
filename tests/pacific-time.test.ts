import { describe, expect, it } from 'vitest';

import {
  campusDate,
  campusWallClockToIso,
  formatDate,
  formatTime,
  isCampusToday,
  zoneOffsetMinutes,
} from '@/lib/normalize';
import { SITE } from '@/lib/config/site';

/**
 * Everything date-shaped on this site means "at UCLA". A fixed UTC offset would
 * be wrong for roughly half the year, and wrong in the most confusing possible
 * way — menus and game times off by an hour — so these tests pin the behaviour
 * across both US daylight-saving transitions.
 *
 * 2026 transitions: DST begins Sun 8 March, ends Sun 1 November.
 */

const PDT = '2026-07-04T12:00:00.000Z'; // summer, UTC-7
const PST = '2026-12-25T12:00:00.000Z'; // winter, UTC-8

describe('zoneOffsetMinutes tracks daylight saving', () => {
  it('is UTC-7 in summer and UTC-8 in winter', () => {
    expect(zoneOffsetMinutes(new Date(PDT), SITE.timeZone)).toBe(-420);
    expect(zoneOffsetMinutes(new Date(PST), SITE.timeZone)).toBe(-480);
  });

  it('flips at the 2026 spring-forward boundary', () => {
    // 09:59 UTC on 8 March 2026 is 01:59 PST; 10:00 UTC is 03:00 PDT.
    expect(zoneOffsetMinutes(new Date('2026-03-08T09:59:00.000Z'), SITE.timeZone)).toBe(-480);
    expect(zoneOffsetMinutes(new Date('2026-03-08T10:00:00.000Z'), SITE.timeZone)).toBe(-420);
  });

  it('flips at the 2026 fall-back boundary', () => {
    // 08:59 UTC on 1 November 2026 is 01:59 PDT; 09:00 UTC is 01:00 PST.
    expect(zoneOffsetMinutes(new Date('2026-11-01T08:59:00.000Z'), SITE.timeZone)).toBe(-420);
    expect(zoneOffsetMinutes(new Date('2026-11-01T09:00:00.000Z'), SITE.timeZone)).toBe(-480);
  });
});

describe('campusDate is the date on campus, not in UTC', () => {
  it('is still yesterday on campus when UTC has already rolled over', () => {
    // 03:00 UTC on 5 July is 20:00 PDT on 4 July.
    expect(campusDate(new Date('2026-07-05T03:00:00.000Z'))).toBe('2026-07-04');
    // 03:00 UTC on 25 December is 19:00 PST on 24 December.
    expect(campusDate(new Date('2026-12-25T03:00:00.000Z'))).toBe('2026-12-24');
  });

  it('rolls over at local midnight in both offsets', () => {
    expect(campusDate(new Date('2026-07-05T06:59:00.000Z'))).toBe('2026-07-04');
    expect(campusDate(new Date('2026-07-05T07:00:00.000Z'))).toBe('2026-07-05');

    expect(campusDate(new Date('2026-12-25T07:59:00.000Z'))).toBe('2026-12-24');
    expect(campusDate(new Date('2026-12-25T08:00:00.000Z'))).toBe('2026-12-25');
  });

  it('handles the day daylight saving starts, which is only 23 hours long', () => {
    expect(campusDate(new Date('2026-03-08T09:00:00.000Z'))).toBe('2026-03-08');
    expect(campusDate(new Date('2026-03-08T18:00:00.000Z'))).toBe('2026-03-08');
    // 9 March is already PDT, so campus midnight is 07:00 UTC, not 08:00.
    expect(campusDate(new Date('2026-03-09T06:59:00.000Z'))).toBe('2026-03-08');
    expect(campusDate(new Date('2026-03-09T07:00:00.000Z'))).toBe('2026-03-09');
  });

  it('handles the day daylight saving ends, which is 25 hours long', () => {
    expect(campusDate(new Date('2026-11-01T08:30:00.000Z'))).toBe('2026-11-01');
    expect(campusDate(new Date('2026-11-02T07:59:00.000Z'))).toBe('2026-11-01');
    expect(campusDate(new Date('2026-11-02T08:00:00.000Z'))).toBe('2026-11-02');
  });
});

describe('isCampusToday', () => {
  it('compares against the campus day, not the viewer’s', () => {
    const now = new Date('2026-07-05T03:00:00.000Z'); // 4 July, 20:00 PDT
    expect(isCampusToday('2026-07-04T22:00:00.000Z', now)).toBe(true);
    expect(isCampusToday('2026-07-05T18:00:00.000Z', now)).toBe(false);
    expect(isCampusToday(null, now)).toBe(false);
  });
});

describe('campusWallClockToIso', () => {
  it('interprets a dining hall’s posted time in campus time', () => {
    // 07:00 on 4 July is PDT, so 14:00 UTC.
    expect(campusWallClockToIso('2026-07-04', '07:00')).toBe('2026-07-04T14:00:00.000Z');
    // 07:00 on 25 December is PST, so 15:00 UTC.
    expect(campusWallClockToIso('2026-12-25', '07:00')).toBe('2026-12-25T15:00:00.000Z');
  });

  it('returns null rather than a wrong time for unusable input', () => {
    expect(campusWallClockToIso('not-a-date', '07:00')).toBeNull();
    expect(campusWallClockToIso('2026-07-04', 'nonsense')).toBeNull();
  });
});

describe('display formatting is in Pacific time', () => {
  it('renders the campus date and time, not UTC', () => {
    // 03:00 UTC on 5 July is 8 PM on 4 July at UCLA.
    expect(formatDate('2026-07-05T03:00:00.000Z')).toContain('Jul 4');
    expect(formatTime('2026-07-05T03:00:00.000Z')).toMatch(/8:00\s*PM/i);

    // And in winter, 03:00 UTC on 25 December is 7 PM on 24 December.
    expect(formatDate('2026-12-25T03:00:00.000Z')).toContain('Dec 24');
    expect(formatTime('2026-12-25T03:00:00.000Z')).toMatch(/7:00\s*PM/i);
  });

  it('degrades gracefully on unusable input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatTime(null)).toBe('');
  });
});
