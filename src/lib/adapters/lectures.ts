/**
 * UCLA Lectures (Panopto) — TEMPLATE ONLY.
 *
 * The real integration is intentionally not built. Panopto's REST API requires
 * an OAuth2 client credential issued by the institution's Panopto admin, and
 * the useful endpoints return content scoped to an authenticated viewer — so
 * there is nothing a public static site can fetch anonymously.
 *
 * What exists here instead is the full adapter contract plus a clearly labelled
 * placeholder implementation. To complete the integration later:
 *
 *   1. Set PANOPTO_SITE_HOST, PANOPTO_CLIENT_ID and PANOPTO_CLIENT_SECRET as
 *      build-time (not NEXT_PUBLIC_) environment variables in Vercel.
 *   2. Replace `fetchLectureRecords` with a real client-credentials token call
 *      plus a `/Panopto/api/v1/folders/{id}/sessions` request.
 *   3. Delete `src/lib/mock/lectures.ts`.
 *
 * `toMediaItem` and every consumer of this module stay unchanged, because the
 * boundary between "where records come from" and "how records are normalized"
 * runs through the `LectureRecord` type below.
 */

import { MOCK_LECTURES } from '@/lib/mock/lectures';
import { makeId } from '@/lib/normalize';
import type { MediaItem, SourceResult } from '@/lib/types';

/** Whether a viewer can open a recording without institutional sign-in. */
export type LectureAccess = 'public' | 'restricted';

/**
 * The source-agnostic record a lecture provider must produce. A real Panopto
 * client maps its `Session` objects onto this; nothing downstream knows or
 * cares which provider filled it in.
 */
export interface LectureRecord {
  id: string;
  title: string;
  instructor: string | null;
  department: string | null;
  courseCode: string | null;
  /** Relative age in days. A live adapter should set `recordedAt` instead. */
  daysAgo?: number;
  recordedAt?: string;
  durationSeconds: number | null;
  accessStatus: LectureAccess;
  thumbnailUrl: string | null;
  /** Deep link into the provider. Absent for placeholder rows. */
  url?: string;
}

export interface LectureProvider {
  /** Stable identifier of the backing system, e.g. `panopto`. */
  id: string;
  /** False when required credentials are missing; the UI then shows "unavailable". */
  isConfigured(): boolean;
  fetchLectureRecords(): Promise<LectureRecord[]>;
}

const PLACEHOLDER_ATTRIBUTION = 'Placeholder template — not real UCLA lecture content';

/** Env vars a real Panopto integration will need. Names only; never values. */
export const PANOPTO_ENV_VARS = [
  'PANOPTO_SITE_HOST',
  'PANOPTO_CLIENT_ID',
  'PANOPTO_CLIENT_SECRET',
] as const;

/** True only when every Panopto credential is present in the build environment. */
export function isPanoptoConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return PANOPTO_ENV_VARS.every((name) => {
    const value = env[name];
    return typeof value === 'string' && value.trim() !== '';
  });
}

/** Names of the Panopto variables that are still missing. Safe to log or display. */
export function missingPanoptoEnvVars(env: NodeJS.ProcessEnv = process.env): string[] {
  return PANOPTO_ENV_VARS.filter((name) => {
    const value = env[name];
    return typeof value !== 'string' || value.trim() === '';
  });
}

/** The placeholder provider. Returns invented rows and says so. */
export const placeholderLectureProvider: LectureProvider = {
  id: 'placeholder',
  isConfigured: () => true,
  fetchLectureRecords: async () => MOCK_LECTURES,
};

/** Normalize a provider record into the shared media shape. */
export function toMediaItem(
  record: LectureRecord,
  sourceId: string,
  now: Date = new Date(),
): MediaItem {
  const recordedAt =
    record.recordedAt ??
    (typeof record.daysAgo === 'number'
      ? new Date(now.getTime() - record.daysAgo * 86_400_000).toISOString()
      : null);

  const badges = [
    'Coming Soon',
    record.accessStatus === 'public' ? 'Open access' : 'UCLA sign-in required',
  ];

  return {
    id: makeId(sourceId, record.id),
    sourceId,
    kind: 'lecture',
    title: record.title,
    // Placeholder rows must not fabricate a deep link; the section landing page
    // is the honest destination until a real provider supplies one.
    url: record.url ?? 'https://www.panopto.com/',
    publishedAt: recordedAt,
    startsAt: null,
    endsAt: null,
    excerpt: null,
    image: record.thumbnailUrl ? { src: record.thumbnailUrl, alt: record.title } : null,
    categories: [record.department, record.courseCode].filter((v): v is string => Boolean(v)),
    authors: record.instructor ? [record.instructor] : [],
    durationSeconds: record.durationSeconds,
    location: null,
    badges,
    attribution: PLACEHOLDER_ATTRIBUTION,
    dataMode: 'placeholder',
  };
}

/**
 * Run the lectures adapter. With no Panopto credentials configured this always
 * returns placeholder rows flagged as such — it never silently substitutes
 * invented data for production content.
 */
export async function loadLectures(
  sourceId: string,
  provider: LectureProvider = placeholderLectureProvider,
  now: Date = new Date(),
): Promise<SourceResult> {
  const fetchedAt = now.toISOString();

  if (!provider.isConfigured()) {
    return {
      sourceId,
      status: 'unavailable',
      items: [],
      fetchedAt,
      note: `Integration disabled — missing: ${missingPanoptoEnvVars().join(', ')}`,
    };
  }

  try {
    const records = await provider.fetchLectureRecords();
    const isPlaceholder = provider.id === 'placeholder';
    return {
      sourceId,
      status: isPlaceholder ? 'placeholder' : records.length > 0 ? 'ok' : 'empty',
      items: records.map((record) => toMediaItem(record, sourceId, now)),
      fetchedAt,
      note: isPlaceholder
        ? 'Template only. Displaying placeholder data until a Panopto provider is configured.'
        : undefined,
    };
  } catch (error) {
    return {
      sourceId,
      status: 'error',
      items: [],
      fetchedAt,
      error: error instanceof Error ? error.message : 'Unknown lecture provider error',
    };
  }
}
