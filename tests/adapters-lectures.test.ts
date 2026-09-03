import { describe, expect, it } from 'vitest';

import {
  isPanoptoConfigured,
  missingPanoptoEnvVars,
  loadLectures,
  toMediaItem,
  placeholderLectureProvider,
  PANOPTO_ENV_VARS,
  type LectureProvider,
  type LectureRecord,
} from '@/lib/adapters/lectures';

/** Build a fake process.env fixture without mutating the real global. */
function fakeEnv(vars: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return vars as unknown as NodeJS.ProcessEnv;
}

describe('isPanoptoConfigured', () => {
  it('is false when env vars are absent', () => {
    expect(isPanoptoConfigured(fakeEnv({}))).toBe(false);
  });

  it('is false when env vars are blank', () => {
    expect(
      isPanoptoConfigured(
        fakeEnv({
          PANOPTO_SITE_HOST: '',
          PANOPTO_CLIENT_ID: '   ',
          PANOPTO_CLIENT_SECRET: 'secret',
        }),
      ),
    ).toBe(false);
  });

  it('is true when all three are set', () => {
    expect(
      isPanoptoConfigured(
        fakeEnv({
          PANOPTO_SITE_HOST: 'ucla.hosted.panopto.com',
          PANOPTO_CLIENT_ID: 'client-id',
          PANOPTO_CLIENT_SECRET: 'client-secret',
        }),
      ),
    ).toBe(true);
  });
});

describe('missingPanoptoEnvVars', () => {
  it('lists exactly the missing names', () => {
    const result = missingPanoptoEnvVars(fakeEnv({ PANOPTO_SITE_HOST: 'host' }));
    expect(result).toEqual(['PANOPTO_CLIENT_ID', 'PANOPTO_CLIENT_SECRET']);
  });

  it('returns all names when the environment is empty', () => {
    expect(missingPanoptoEnvVars(fakeEnv({}))).toEqual([...PANOPTO_ENV_VARS]);
  });

  it('returns an empty array when fully configured', () => {
    expect(
      missingPanoptoEnvVars(
        fakeEnv({
          PANOPTO_SITE_HOST: 'a',
          PANOPTO_CLIENT_ID: 'b',
          PANOPTO_CLIENT_SECRET: 'c',
        }),
      ),
    ).toEqual([]);
  });
});

describe('loadLectures', () => {
  it('returns placeholder status with labelled items using the default provider', async () => {
    const result = await loadLectures('lectures');
    expect(result.status).toBe('placeholder');
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.dataMode).toBe('placeholder');
      expect(item.badges).toContain('Coming Soon');
    }
  });

  it('returns unavailable with no items when the provider is not configured', async () => {
    const unconfigured: LectureProvider = {
      id: 'panopto',
      isConfigured: () => false,
      fetchLectureRecords: async () => {
        throw new Error('should not be called');
      },
    };
    const result = await loadLectures('lectures', unconfigured);
    expect(result.status).toBe('unavailable');
    expect(result.items).toEqual([]);
  });

  it('returns error and does not throw when fetchLectureRecords rejects', async () => {
    const failing: LectureProvider = {
      id: 'panopto',
      isConfigured: () => true,
      fetchLectureRecords: async () => {
        throw new Error('Panopto API is down');
      },
    };
    const result = await loadLectures('lectures', failing);
    expect(result.status).toBe('error');
    expect(result.items).toEqual([]);
    expect(result.error).toBe('Panopto API is down');
  });
});

describe('toMediaItem', () => {
  it('maps duration, instructor, department/courseCode, and daysAgo relative to now', () => {
    const now = new Date('2026-09-02T20:00:00.000Z');
    const record: LectureRecord = {
      id: 'lecture-1',
      title: 'Intro to Testing',
      instructor: 'Dr. Example',
      department: 'Computer Science',
      courseCode: 'CS 100',
      daysAgo: 2,
      durationSeconds: 3600,
      accessStatus: 'public',
      thumbnailUrl: null,
    };
    const item = toMediaItem(record, 'lectures', now);

    expect(item.durationSeconds).toBe(3600);
    expect(item.authors).toEqual(['Dr. Example']);
    expect(item.categories).toEqual(['Computer Science', 'CS 100']);
    expect(item.publishedAt).toBe(new Date(now.getTime() - 2 * 86_400_000).toISOString());
  });

  it('uses recordedAt directly when provided instead of daysAgo', () => {
    const record: LectureRecord = {
      id: 'lecture-2',
      title: 'Recorded Directly',
      instructor: null,
      department: null,
      courseCode: null,
      recordedAt: '2026-01-01T00:00:00.000Z',
      durationSeconds: null,
      accessStatus: 'restricted',
      thumbnailUrl: null,
    };
    const item = toMediaItem(record, 'lectures');
    expect(item.publishedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(item.authors).toEqual([]);
    expect(item.categories).toEqual([]);
  });
});

describe('placeholderLectureProvider', () => {
  it('is always configured', () => {
    expect(placeholderLectureProvider.isConfigured()).toBe(true);
  });
});
