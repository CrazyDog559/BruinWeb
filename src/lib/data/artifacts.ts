/**
 * Generated-data artifacts.
 *
 * Each build-time source writes its normalized output to a JSON artifact. Two
 * problems this solves:
 *
 *   1. **Fallback.** When a publisher is briefly unavailable, the section keeps
 *      the last dataset that validated instead of going blank. The artifact
 *      records when it was retrieved, so the UI can say plainly that it is
 *      showing older data rather than pretending it is current.
 *   2. **Atomicity.** A crashed or half-finished write must never leave a
 *      malformed artifact behind, because the next build would read it as
 *      fallback. Writes go to a temporary file and are renamed into place,
 *      which is atomic within a directory on every platform we run on.
 *
 * Artifacts live under Next.js's build cache directory, which Vercel restores
 * between deployments of the same project. That is what carries a dataset
 * across a scheduled rebuild without a database. If the cache is cold — a first
 * build, or a cleared cache — there is simply no fallback, and a failing source
 * reports itself unavailable. That is the correct outcome: an empty section is
 * honest, invented content is not.
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

/**
 * Inside `.next/cache` so Vercel's build cache carries it between deploys.
 * Nothing here is served to the browser; the frontend consumes the data through
 * the build, and the public status report is emitted separately.
 */
const ARTIFACT_DIR = path.join(process.cwd(), '.next', 'cache', 'bruinweb-artifacts');

/** Bumped when the artifact shape changes, so stale shapes are ignored. */
const ARTIFACT_VERSION = 1;

const EnvelopeSchema = z.object({
  version: z.number(),
  sourceId: z.string(),
  /** When the upstream request that produced this actually succeeded. */
  retrievedAt: z.string(),
  /** Item count at write time, used to spot a truncated artifact. */
  count: z.number(),
  payload: z.unknown(),
});

export type ArtifactEnvelope<T> = {
  version: number;
  sourceId: string;
  retrievedAt: string;
  count: number;
  payload: T;
};

function artifactPath(sourceId: string): string {
  // Source ids come from a closed union in the registry, but a path built from
  // a string still gets sanitized rather than trusted.
  const safe = sourceId.replace(/[^a-z0-9-]/gi, '_');
  return path.join(ARTIFACT_DIR, `${safe}.json`);
}

/**
 * Read the last artifact that validated for this source.
 *
 * Returns null for anything unusable — missing, unparseable, wrong version,
 * failing its schema — so a corrupt artifact degrades to "no fallback" rather
 * than poisoning a section.
 */
export async function readArtifact<T>(
  sourceId: string,
  schema: z.ZodType<T>,
): Promise<ArtifactEnvelope<T> | null> {
  try {
    const raw = await readFile(artifactPath(sourceId), 'utf8');
    const envelope = EnvelopeSchema.safeParse(JSON.parse(raw));
    if (!envelope.success) return null;
    if (envelope.data.version !== ARTIFACT_VERSION) return null;
    if (envelope.data.sourceId !== sourceId) return null;

    const payload = schema.safeParse(envelope.data.payload);
    if (!payload.success) return null;

    return { ...envelope.data, payload: payload.data };
  } catch {
    return null;
  }
}

/**
 * Validate and write an artifact atomically.
 *
 * Validation happens before anything touches the filesystem, so an artifact on
 * disk is always one that passed its schema. Returns whether the write
 * succeeded; a failure is logged and swallowed, because losing a cache entry is
 * never a reason to fail a build.
 */
export async function writeArtifact<T>(
  sourceId: string,
  schema: z.ZodType<T>,
  payload: T,
  retrievedAt: string,
  count: number,
): Promise<boolean> {
  const validated = schema.safeParse(payload);
  if (!validated.success) {
    console.warn(
      `[bruinweb] refusing to persist "${sourceId}": payload failed validation (${validated.error.issues.length} issues)`,
    );
    return false;
  }

  const envelope: ArtifactEnvelope<T> = {
    version: ARTIFACT_VERSION,
    sourceId,
    retrievedAt,
    count,
    payload: validated.data,
  };

  const target = artifactPath(sourceId);
  // A unique temp name keeps concurrent writers from clobbering each other's
  // partial file; the rename is what publishes it.
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;

  try {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    await writeFile(temp, JSON.stringify(envelope), 'utf8');
    await rename(temp, target);
    return true;
  } catch (error) {
    console.warn(
      `[bruinweb] could not persist artifact for "${sourceId}": ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
    await unlink(temp).catch(() => {});
    return false;
  }
}

export interface ResolvedArtifact<T> {
  payload: T;
  /** When the data now being used was actually retrieved. */
  retrievedAt: string;
  /** True when the live attempt failed and a previous artifact is standing in. */
  fromFallback: boolean;
}

/**
 * Run a source, persisting success and falling back to the last good artifact
 * on failure.
 *
 * The three outcomes are deliberately distinct:
 *   - live data      → persisted, `fromFallback: false`
 *   - failure + cache → previous payload, `fromFallback: true`, real retrieval
 *                       time preserved so the UI can age it honestly
 *   - failure, no cache → null, and the caller reports the section unavailable
 */
export async function withFallback<T>(
  sourceId: string,
  schema: z.ZodType<T>,
  retrievedAt: string,
  run: () => Promise<{ payload: T; count: number }>,
): Promise<ResolvedArtifact<T> | null> {
  try {
    const { payload, count } = await run();
    await writeArtifact(sourceId, schema, payload, retrievedAt, count);
    return { payload, retrievedAt, fromFallback: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const previous = await readArtifact(sourceId, schema);

    if (previous) {
      console.warn(
        `[bruinweb] "${sourceId}" unavailable (${message}); serving the dataset retrieved ${previous.retrievedAt}`,
      );
      return { payload: previous.payload, retrievedAt: previous.retrievedAt, fromFallback: true };
    }

    console.warn(
      `[bruinweb] "${sourceId}" unavailable (${message}); no previous dataset to fall back to`,
    );
    return null;
  }
}

/** Exposed for tests, which need a clean slate. */
export const ARTIFACT_INTERNALS = { ARTIFACT_DIR, ARTIFACT_VERSION, artifactPath } as const;
