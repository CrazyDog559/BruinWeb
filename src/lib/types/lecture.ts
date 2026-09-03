/**
 * Public UCLA lectures and academic talks.
 *
 * Deliberately richer than the shared `MediaItem`: a lecture browser needs the
 * speaker, the department, the series and the duration to be first-class so it
 * can search and filter on them. Lectures are also projected into `MediaItem`
 * so they appear in the unified feed and in global search.
 *
 * Every optional field is genuinely optional. When a source does not publish a
 * value we store `null` — nothing here is inferred or invented.
 */

/**
 * What kind of recording this is. Set per source from what the publisher
 * actually says, so a podcast conversation is never labelled a course lecture.
 */
export const LECTURE_FORMATS = [
  'lecture',
  'seminar',
  'panel',
  'guest-talk',
  'podcast',
  'conference',
  'event',
] as const;

export type LectureFormat = (typeof LECTURE_FORMATS)[number];

export const LECTURE_FORMAT_LABELS: Record<LectureFormat, string> = {
  lecture: 'Lecture',
  seminar: 'Seminar',
  panel: 'Panel',
  'guest-talk': 'Guest talk',
  podcast: 'Podcast',
  conference: 'Conference talk',
  event: 'Recorded event',
};

export const LECTURE_MEDIA_TYPES = ['video', 'audio'] as const;

export type LectureMediaType = (typeof LECTURE_MEDIA_TYPES)[number];

export interface Lecture {
  /** Deterministic and stable across builds. */
  id: string;
  /** Which configured source produced this. */
  sourceId: string;
  title: string;
  /** Speaker or instructor as published. Null when the source does not say. */
  speaker: string | null;
  /** The speaker's own institution, when published. */
  speakerAffiliation: string | null;
  /** UCLA department, school, center or institute responsible. */
  department: string | null;
  /** Plain-text summary. Sanitized; never raw source HTML. */
  description: string | null;
  /** Named series this belongs to, e.g. the podcast or lecture series title. */
  series: string | null;
  /** Subjects/topics as published by the source. */
  topics: string[];
  /** When the talk was given, if the source distinguishes it from publication. */
  recordedAt: string | null;
  /** When the recording was published. ISO-8601 UTC. */
  publishedAt: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  mediaType: LectureMediaType;
  format: LectureFormat;
  /** Public page where a reader can watch or listen. Never behind a login. */
  watchUrl: string;
  /**
   * Player URL, set ONLY where the publisher officially supports embedding.
   * Null everywhere else — we link out rather than reframe someone's media.
   */
  embedUrl: string | null;
  /** Transcript or captions page, when the source publishes one. */
  transcriptUrl: string | null;
  /** Direct media URL, stored for reference only; never rehosted. */
  mediaUrl: string | null;
  sourceName: string;
  sourceUrl: string;
  /** ISO-8601 UTC timestamp of the build-time retrieval. */
  retrievedAt: string;
}

export interface LectureCollection {
  lectures: Lecture[];
  /** Per-source outcome, so the UI can be honest about partial data. */
  sources: Array<{
    sourceId: string;
    status: 'ok' | 'empty' | 'error';
    count: number;
    error?: string;
    retrievedAt: string;
  }>;
  generatedAt: string;
}
