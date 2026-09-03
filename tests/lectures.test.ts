import { describe, expect, it } from 'vitest';

import {
  dedupeLectures,
  lectureSlug,
  lectureToMediaItem,
  sortLectures,
} from '@/lib/adapters/lectures';
import {
  episodePageFromEnclosure,
  normalizeEpisode,
  parseDuration,
  speakerFromTitle,
} from '@/lib/adapters/lectures/podcast';
import {
  ACTIVE_LECTURE_SOURCES,
  EXCLUDED_LECTURE_SOURCES,
  LECTURE_SOURCES,
  getLectureSource,
} from '@/lib/config/lecture-sources';
import {
  EMPTY_LECTURE_FILTERS,
  collectDepartments,
  collectTopics,
  filterLectures,
  hasActiveLectureFilters,
  relatedLectures,
  sortLecturesBy,
} from '@/lib/lectures/search';
import type { Lecture } from '@/lib/types/lecture';

const SOURCE = getLectureSource('pourdavoud')!;

function lecture(overrides: Partial<Lecture> = {}): Lecture {
  return {
    id: 'lecture-x:1',
    sourceId: 'pourdavoud',
    title: 'A talk about something',
    speaker: 'Dr. Example Person',
    speakerAffiliation: null,
    department: 'UCLA Example Institute',
    description: 'A description.',
    series: 'Example Series',
    topics: ['History'],
    recordedAt: null,
    publishedAt: '2026-06-01T00:00:00.000Z',
    durationSeconds: 3600,
    thumbnailUrl: null,
    mediaType: 'audio',
    format: 'lecture',
    watchUrl: 'https://example.ucla.edu/talks/1',
    embedUrl: null,
    transcriptUrl: null,
    mediaUrl: null,
    sourceName: 'Example',
    sourceUrl: 'https://example.ucla.edu/',
    retrievedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('podcast duration parsing', () => {
  it('accepts whole seconds and HH:MM:SS and MM:SS', () => {
    expect(parseDuration('3632')).toBe(3632);
    expect(parseDuration('01:18:04')).toBe(4684);
    expect(parseDuration('18:04')).toBe(1084);
  });

  it('returns null for anything it cannot read, rather than guessing', () => {
    for (const value of [undefined, null, '', 'unknown', '0', 'ab:cd']) {
      expect(parseDuration(value), String(value)).toBeNull();
    }
  });
});

describe('episodePageFromEnclosure', () => {
  it('derives the public episode page from an episode media URL', () => {
    expect(
      episodePageFromEnclosure(
        'https://www.buzzsprout.com/952522/episodes/19385626-why-history-matters-immigration.mp3',
      ),
    ).toBe('https://www.buzzsprout.com/952522/episodes/19385626-why-history-matters-immigration');
  });

  it('refuses to derive anything from a URL that is not an episode permalink', () => {
    expect(episodePageFromEnclosure(null)).toBeNull();
    expect(episodePageFromEnclosure('https://cdn.example.com/audio/file.mp3')).toBeNull();
    expect(episodePageFromEnclosure('https://example.com/episodes/thing')).toBeNull();
  });
});

describe('speakerFromTitle', () => {
  it('reads the explicit shapes the feeds actually use', () => {
    expect(speakerFromTitle('Episode 40: Dr. James Howard-Johnston')).toBe(
      'Dr. James Howard-Johnston',
    );
    expect(speakerFromTitle('Housing and policy with Seva Rodnyansky')).toBe('Seva Rodnyansky');
  });

  it('returns null rather than guessing at a name', () => {
    for (const title of [
      'Autocrats vs. Democrats: China, Russia, America',
      'Why History Matters: Immigration',
      '',
    ]) {
      expect(speakerFromTitle(title), title).toBeNull();
    }
  });
});

describe('normalizeEpisode', () => {
  const entry = {
    title: 'Episode 40: Dr. James Howard-Johnston',
    link: 'https://pourdavoud.ucla.edu/legacies-of-ancient-persia/#episode-a75e45',
    guid: 'a75e45dd',
    pubDate: 'Thu, 18 Jun 2026 17:07:38 +0000',
    'itunes:duration': '3632',
    'itunes:summary': '<p>An <em>excerpt</em> with markup.</p>',
    enclosure: { '@_url': 'https://cdn.example.com/audio/40.mp3' },
    category: ['History', 'Iranian Studies'],
  };

  it('maps a real episode onto the lecture shape', () => {
    const result = normalizeEpisode(
      entry,
      SOURCE,
      'https://img.example.com/show.jpg',
      '2026-09-02T00:00:00.000Z',
    )!;

    expect(result.title).toBe('Episode 40: Dr. James Howard-Johnston');
    expect(result.speaker).toBe('Dr. James Howard-Johnston');
    expect(result.durationSeconds).toBe(3632);
    expect(result.publishedAt).toBe('2026-06-18T17:07:38.000Z');
    expect(result.department).toBe(SOURCE.department);
    expect(result.series).toBe(SOURCE.series);
    expect(result.format).toBe(SOURCE.format);
    expect(result.topics).toEqual(['History', 'Iranian Studies']);
    // Source HTML is sanitized to plain text before it ever reaches the page.
    expect(result.description).toBe('An excerpt with markup.');
    expect(result.description).not.toContain('<');
  });

  it('falls back to the channel image and leaves unknown fields null', () => {
    const result = normalizeEpisode(entry, SOURCE, 'https://img.example.com/show.jpg', 'now')!;
    expect(result.thumbnailUrl).toBe('https://img.example.com/show.jpg');
    expect(result.recordedAt).toBeNull();
    expect(result.speakerAffiliation).toBeNull();
    expect(result.embedUrl).toBeNull();
  });

  it('drops an entry with no title or no usable public URL', () => {
    expect(normalizeEpisode({ ...entry, title: '' }, SOURCE, null, 'now')).toBeNull();
    expect(
      normalizeEpisode(
        { ...entry, link: undefined, guid: 'Buzzsprout-1', enclosure: undefined },
        SOURCE,
        null,
        'now',
      ),
    ).toBeNull();
  });

  it('survives a completely malformed entry', () => {
    expect(normalizeEpisode({}, SOURCE, null, 'now')).toBeNull();
    expect(normalizeEpisode({ title: 123, link: [] }, SOURCE, null, 'now')).toBeNull();
  });
});

describe('dedupeLectures', () => {
  it('removes the same talk arriving from two centre feeds', () => {
    const a = lecture({ id: 'a', sourceId: 'burkle-center' });
    const b = lecture({ id: 'b', sourceId: 'ucla-euro' });
    expect(dedupeLectures([a, b])).toHaveLength(1);
    expect(dedupeLectures([a, b])[0].id).toBe('a');
  });

  it('treats a shared title, speaker and date as the same recording', () => {
    const a = lecture({ id: 'a', watchUrl: 'https://one.ucla.edu/x' });
    const b = lecture({ id: 'b', watchUrl: 'https://two.ucla.edu/y' });
    expect(dedupeLectures([a, b])).toHaveLength(1);
  });

  it('keeps genuinely different talks', () => {
    const a = lecture({
      id: 'a',
      title: 'The first distinctive talk',
      watchUrl: 'https://a.ucla.edu/1',
    });
    const b = lecture({
      id: 'b',
      title: 'A wholly different subject',
      watchUrl: 'https://b.ucla.edu/2',
    });
    expect(dedupeLectures([a, b])).toHaveLength(2);
  });

  it('ignores tracking parameters when comparing URLs', () => {
    const a = lecture({ id: 'a', title: 'One', watchUrl: 'https://x.ucla.edu/t' });
    const b = lecture({ id: 'b', title: 'Two', watchUrl: 'https://x.ucla.edu/t?utm_source=feed' });
    expect(dedupeLectures([a, b])).toHaveLength(1);
  });

  it('handles an empty list', () => {
    expect(dedupeLectures([])).toEqual([]);
  });
});

describe('lecture search and filtering', () => {
  const set = [
    lecture({
      id: '1',
      title: 'Ancient Persia and its legacies',
      speaker: 'Dr. A',
      department: 'UCLA Pourdavoud Institute',
      topics: ['History'],
      durationSeconds: 3600,
      publishedAt: '2026-08-01T00:00:00.000Z',
      format: 'lecture',
      mediaType: 'audio',
      watchUrl: 'https://a.ucla.edu/1',
    }),
    lecture({
      id: '2',
      title: 'Housing policy conversation',
      speaker: 'Dr. B',
      department: 'UCLA Lewis Center',
      topics: ['Policy'],
      durationSeconds: 900,
      publishedAt: '2026-01-01T00:00:00.000Z',
      format: 'podcast',
      mediaType: 'audio',
      watchUrl: 'https://a.ucla.edu/2',
    }),
    lecture({
      id: '3',
      title: 'International relations panel',
      speaker: null,
      department: 'UCLA Burkle Center',
      topics: [],
      durationSeconds: null,
      publishedAt: null,
      format: 'panel',
      mediaType: 'video',
      watchUrl: 'https://a.ucla.edu/3',
    }),
  ];

  const now = Date.parse('2026-09-02T00:00:00.000Z');

  it('searches title, speaker, department and topic', () => {
    for (const [query, id] of [
      ['persia', '1'],
      ['Dr. B', '2'],
      ['Burkle', '3'],
      ['policy', '2'],
    ] as const) {
      const found = filterLectures(set, { ...EMPTY_LECTURE_FILTERS, query }, now);
      expect(
        found.map((entry) => entry.id),
        query,
      ).toContain(id);
    }
  });

  it('requires every term to match', () => {
    expect(
      filterLectures(set, { ...EMPTY_LECTURE_FILTERS, query: 'persia housing' }, now),
    ).toHaveLength(0);
  });

  it('filters by department, format and media type', () => {
    expect(
      filterLectures(
        set,
        { ...EMPTY_LECTURE_FILTERS, departments: ['UCLA Lewis Center'] },
        now,
      ).map((l) => l.id),
    ).toEqual(['2']);
    expect(
      filterLectures(set, { ...EMPTY_LECTURE_FILTERS, formats: ['panel'] }, now).map((l) => l.id),
    ).toEqual(['3']);
    expect(
      filterLectures(set, { ...EMPTY_LECTURE_FILTERS, mediaTypes: ['video'] }, now).map(
        (l) => l.id,
      ),
    ).toEqual(['3']);
  });

  it('filters by duration bucket and excludes talks with no published duration', () => {
    expect(
      filterLectures(set, { ...EMPTY_LECTURE_FILTERS, duration: 'short' }, now).map((l) => l.id),
    ).toEqual(['2']);
    expect(
      filterLectures(set, { ...EMPTY_LECTURE_FILTERS, duration: 'long' }, now).map((l) => l.id),
    ).toEqual(['1']);
    // id 3 has no duration, so it can never be claimed to fit a bucket.
    for (const bucket of ['short', 'medium', 'long'] as const) {
      expect(
        filterLectures(set, { ...EMPTY_LECTURE_FILTERS, duration: bucket }, now).map((l) => l.id),
      ).not.toContain('3');
    }
  });

  it('filters by publication window and excludes undated talks', () => {
    const recent = filterLectures(set, { ...EMPTY_LECTURE_FILTERS, withinDays: 90 }, now);
    expect(recent.map((l) => l.id)).toEqual(['1']);
  });

  it('sorts newest, oldest and by title, with undated talks last', () => {
    expect(sortLecturesBy(set, 'newest').map((l) => l.id)).toEqual(['1', '2', '3']);
    expect(sortLecturesBy(set, 'oldest').map((l) => l.id)).toEqual(['2', '1', '3']);
    expect(sortLecturesBy(set, 'title').map((l) => l.title)[0]).toBe(
      'Ancient Persia and its legacies',
    );
  });

  it('reports active filters and collects facets', () => {
    expect(hasActiveLectureFilters(EMPTY_LECTURE_FILTERS)).toBe(false);
    expect(hasActiveLectureFilters({ ...EMPTY_LECTURE_FILTERS, query: 'x' })).toBe(true);
    expect(collectDepartments(set)).toHaveLength(3);
    expect(collectTopics(set)).toEqual(['History', 'Policy']);
  });

  it('returns everything with no filters, and copes with an empty list', () => {
    expect(filterLectures(set, EMPTY_LECTURE_FILTERS, now)).toHaveLength(3);
    expect(filterLectures([], EMPTY_LECTURE_FILTERS, now)).toEqual([]);
  });
});

describe('missing metadata is tolerated, never invented', () => {
  const bare = lecture({
    speaker: null,
    speakerAffiliation: null,
    description: null,
    series: null,
    topics: [],
    durationSeconds: null,
    thumbnailUrl: null,
    publishedAt: null,
    transcriptUrl: null,
  });

  it('search, sort and projection all cope with null fields', () => {
    expect(filterLectures([bare], { ...EMPTY_LECTURE_FILTERS, query: 'talk' })).toHaveLength(1);
    expect(sortLectures([bare])).toHaveLength(1);
    expect(() => lectureSlug(bare)).not.toThrow();

    const item = lectureToMediaItem(bare);
    expect(item.authors).toEqual([]);
    expect(item.excerpt).toBeNull();
    expect(item.image).toBeNull();
    expect(item.durationSeconds).toBeNull();
  });
});

describe('relatedLectures', () => {
  const base = lecture({
    id: '1',
    series: 'S',
    department: 'D',
    topics: ['T'],
    watchUrl: 'https://a/1',
  });

  it('ranks the same series above a mere topic overlap', () => {
    const sameSeries = lecture({
      id: '2',
      title: 'Another in the series',
      series: 'S',
      department: 'Z',
      topics: [],
      watchUrl: 'https://a/2',
    });
    const sharedTopic = lecture({
      id: '3',
      title: 'Something else entirely',
      series: null,
      department: 'Z',
      topics: ['T'],
      watchUrl: 'https://a/3',
    });

    expect(relatedLectures(base, [base, sharedTopic, sameSeries])[0].id).toBe('2');
  });

  it('never returns the lecture itself, and returns nothing when nothing is shared', () => {
    const unrelated = lecture({
      id: '9',
      title: 'Totally unrelated subject',
      series: null,
      department: 'Z',
      topics: [],
      format: 'panel',
      watchUrl: 'https://a/9',
    });
    expect(relatedLectures(base, [base]).length).toBe(0);
    expect(relatedLectures(base, [base, unrelated]).map((l) => l.id)).not.toContain('1');
  });
});

describe('lecture source registry', () => {
  it('every active source is verified, public and documented', () => {
    for (const source of ACTIVE_LECTURE_SOURCES) {
      expect(source.endpoint, source.id).toMatch(/^https:\/\//);
      expect(source.homepage, source.id).toMatch(/^https:\/\//);
      expect(source.affiliation.length, source.id).toBeGreaterThan(20);
      expect(source.restrictions.length, source.id).toBeGreaterThan(10);
      expect(source.discoveredBy.length, source.id).toBeGreaterThan(10);
    }
  });

  it('ties every source to a ucla.edu domain in its affiliation evidence', () => {
    for (const source of LECTURE_SOURCES) {
      expect(source.affiliation.toLowerCase(), source.id).toContain('ucla.edu');
    }
  });

  it('has unique ids and records why excluded sources were left out', () => {
    const ids = LECTURE_SOURCES.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(EXCLUDED_LECTURE_SOURCES.length).toBeGreaterThan(0);
    for (const excluded of EXCLUDED_LECTURE_SOURCES) {
      expect(excluded.reason.length, excluded.name).toBeGreaterThan(30);
    }
  });

  it('only embeds where the publisher officially allows it', () => {
    for (const source of LECTURE_SOURCES) {
      if (!source.embedAllowed) continue;
      expect(source.restrictions.toLowerCase(), source.id).toContain('embed');
    }
  });
});
