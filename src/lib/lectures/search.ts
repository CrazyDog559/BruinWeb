/**
 * Lecture search, filtering and sorting.
 *
 * Pure and dependency-free so it can be unit-tested directly, and so the
 * browser does the work against the build-time snapshot with no network call.
 */

import { parseQuery } from '@/lib/search';
import type { Lecture, LectureFormat, LectureMediaType } from '@/lib/types/lecture';

export type LectureSort = 'newest' | 'oldest' | 'title';

/** Coarse duration buckets, in seconds. */
export type DurationBucket = 'any' | 'short' | 'medium' | 'long';

export const DURATION_BUCKETS: Record<Exclude<DurationBucket, 'any'>, [number, number]> = {
  short: [0, 20 * 60],
  medium: [20 * 60, 60 * 60],
  long: [60 * 60, Number.POSITIVE_INFINITY],
};

export interface LectureFilterState {
  query: string;
  departments: string[];
  topics: string[];
  formats: LectureFormat[];
  mediaTypes: LectureMediaType[];
  duration: DurationBucket;
  /** Published within the last N days. 0 means any time. */
  withinDays: number;
  sort: LectureSort;
}

export const EMPTY_LECTURE_FILTERS: LectureFilterState = {
  query: '',
  departments: [],
  topics: [],
  formats: [],
  mediaTypes: [],
  duration: 'any',
  withinDays: 0,
  sort: 'newest',
};

function haystack(lecture: Lecture): string {
  return [
    lecture.title,
    lecture.speaker ?? '',
    lecture.speakerAffiliation ?? '',
    lecture.department ?? '',
    lecture.series ?? '',
    lecture.description ?? '',
    lecture.sourceName,
    ...lecture.topics,
  ]
    .join(' ')
    .toLowerCase();
}

export function matchesLectureQuery(lecture: Lecture, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const text = haystack(lecture);
  return terms.every((term) => text.includes(term));
}

function withinDuration(lecture: Lecture, bucket: DurationBucket): boolean {
  if (bucket === 'any') return true;
  // A lecture with no published duration cannot be claimed to fit a bucket.
  if (lecture.durationSeconds === null) return false;
  const [min, max] = DURATION_BUCKETS[bucket];
  return lecture.durationSeconds >= min && lecture.durationSeconds < max;
}

export function sortLecturesBy(lectures: Lecture[], sort: LectureSort): Lecture[] {
  const time = (lecture: Lecture) =>
    lecture.publishedAt ? Date.parse(lecture.publishedAt) : Number.NaN;

  return [...lectures].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);

    const aTime = time(a);
    const bTime = time(b);
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return sort === 'oldest' ? aTime - bTime : bTime - aTime;
  });
}

export function filterLectures(
  lectures: Lecture[],
  filters: LectureFilterState,
  now: number = Date.now(),
): Lecture[] {
  const terms = parseQuery(filters.query);
  const departments = new Set(filters.departments);
  const topics = new Set(filters.topics.map((topic) => topic.toLowerCase()));
  const formats = new Set(filters.formats);
  const mediaTypes = new Set(filters.mediaTypes);

  const matched = lectures.filter((lecture) => {
    if (departments.size > 0 && !departments.has(lecture.department ?? '')) return false;
    if (formats.size > 0 && !formats.has(lecture.format)) return false;
    if (mediaTypes.size > 0 && !mediaTypes.has(lecture.mediaType)) return false;
    if (topics.size > 0 && !lecture.topics.some((topic) => topics.has(topic.toLowerCase()))) {
      return false;
    }
    if (!withinDuration(lecture, filters.duration)) return false;

    if (filters.withinDays > 0) {
      const published = lecture.publishedAt ? Date.parse(lecture.publishedAt) : NaN;
      if (Number.isNaN(published)) return false;
      if (now - published > filters.withinDays * 86_400_000) return false;
    }

    return matchesLectureQuery(lecture, terms);
  });

  return sortLecturesBy(matched, filters.sort);
}

export function hasActiveLectureFilters(filters: LectureFilterState): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.departments.length > 0 ||
    filters.topics.length > 0 ||
    filters.formats.length > 0 ||
    filters.mediaTypes.length > 0 ||
    filters.duration !== 'any' ||
    filters.withinDays > 0
  );
}

/** Distinct departments present, most common first. */
export function collectDepartments(lectures: Lecture[]): string[] {
  const counts = new Map<string, number>();
  for (const lecture of lectures) {
    if (!lecture.department) continue;
    counts.set(lecture.department, (counts.get(lecture.department) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

export function collectTopics(lectures: Lecture[], limit = 24): string[] {
  const counts = new Map<string, number>();
  for (const lecture of lectures) {
    for (const topic of lecture.topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

/**
 * Other lectures a reader is likely to want next, scored on shared metadata:
 * the same series counts for most, then speaker, then department, then
 * overlapping topics.
 */
export function relatedLectures(lecture: Lecture, all: Lecture[], limit = 4): Lecture[] {
  const topics = new Set(lecture.topics.map((topic) => topic.toLowerCase()));

  return all
    .filter((candidate) => candidate.id !== lecture.id)
    .map((candidate) => {
      let score = 0;
      if (lecture.series && candidate.series === lecture.series) score += 5;
      if (lecture.speaker && candidate.speaker === lecture.speaker) score += 4;
      if (lecture.department && candidate.department === lecture.department) score += 3;
      score += candidate.topics.filter((topic) => topics.has(topic.toLowerCase())).length * 2;
      if (candidate.format === lecture.format) score += 1;
      return { candidate, score };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(b.candidate.publishedAt ?? '0') - Date.parse(a.candidate.publishedAt ?? '0'),
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
