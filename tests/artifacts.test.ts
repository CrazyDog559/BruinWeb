import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';

/**
 * The artifact layer is what stops a publisher's bad afternoon from blanking a
 * section, so these tests exercise the failure paths far more than the happy
 * one. Each test runs in its own temp directory acting as the project root, so
 * nothing touches the real build cache.
 */

let root: string;
let artifacts: typeof import('@/lib/data/artifacts');

const Schema = z.array(z.object({ id: z.string(), title: z.string() }));
type Payload = z.infer<typeof Schema>;

const ITEMS: Payload = [
  { id: 'a', title: 'First' },
  { id: 'b', title: 'Second' },
];

function artifactDir() {
  return path.join(root, '.next', 'cache', 'bruinweb-artifacts');
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'bruinweb-artifacts-'));
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.resetModules();
  artifacts = await import('@/lib/data/artifacts');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe('writeArtifact and readArtifact', () => {
  it('round-trips a validated payload with its retrieval time', async () => {
    const ok = await artifacts.writeArtifact('demo', Schema, ITEMS, '2026-09-03T10:00:00.000Z', 2);
    expect(ok).toBe(true);

    const back = await artifacts.readArtifact('demo', Schema);
    expect(back?.payload).toEqual(ITEMS);
    expect(back?.retrievedAt).toBe('2026-09-03T10:00:00.000Z');
    expect(back?.count).toBe(2);
  });

  it('refuses to persist a payload that fails validation', async () => {
    const bad = [{ id: 'a' }] as unknown as Payload;
    expect(await artifacts.writeArtifact('demo', Schema, bad, 'now', 1)).toBe(false);
    expect(await artifacts.readArtifact('demo', Schema)).toBeNull();
  });

  it('returns null for a source that has never been written', async () => {
    expect(await artifacts.readArtifact('never-seen', Schema)).toBeNull();
  });

  it('discards an artifact that is corrupt, wrong-versioned or misattributed', async () => {
    await mkdir(artifactDir(), { recursive: true });

    await writeFile(path.join(artifactDir(), 'corrupt.json'), '{ not json', 'utf8');
    expect(await artifacts.readArtifact('corrupt', Schema)).toBeNull();

    await writeFile(
      path.join(artifactDir(), 'oldversion.json'),
      JSON.stringify({
        version: 0,
        sourceId: 'oldversion',
        retrievedAt: 'x',
        count: 1,
        payload: ITEMS,
      }),
      'utf8',
    );
    expect(await artifacts.readArtifact('oldversion', Schema)).toBeNull();

    await writeFile(
      path.join(artifactDir(), 'mislabelled.json'),
      JSON.stringify({
        version: 1,
        sourceId: 'someone-else',
        retrievedAt: 'x',
        count: 1,
        payload: ITEMS,
      }),
      'utf8',
    );
    expect(await artifacts.readArtifact('mislabelled', Schema)).toBeNull();
  });

  it('discards an artifact whose payload no longer matches the schema', async () => {
    await mkdir(artifactDir(), { recursive: true });
    await writeFile(
      path.join(artifactDir(), 'drifted.json'),
      JSON.stringify({
        version: 1,
        sourceId: 'drifted',
        retrievedAt: 'x',
        count: 1,
        payload: [{ id: 'a', headline: 'renamed field' }],
      }),
      'utf8',
    );
    expect(await artifacts.readArtifact('drifted', Schema)).toBeNull();
  });

  it('leaves no temporary files behind, so a build cannot read a partial write', async () => {
    await artifacts.writeArtifact('demo', Schema, ITEMS, 'now', 2);
    const files = await readdir(artifactDir());
    expect(files).toEqual(['demo.json']);
    expect(files.some((file) => file.endsWith('.tmp'))).toBe(false);
  });

  it('sanitizes a source id rather than letting it escape the directory', async () => {
    await artifacts.writeArtifact('../../escape', Schema, ITEMS, 'now', 2);
    const files = await readdir(artifactDir());
    expect(files).toHaveLength(1);
    expect(files[0]).not.toContain('/');
  });

  it('writes valid JSON on disk', async () => {
    await artifacts.writeArtifact('demo', Schema, ITEMS, 'now', 2);
    const raw = await readFile(path.join(artifactDir(), 'demo.json'), 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('withFallback', () => {
  it('persists a successful run and reports it as live', async () => {
    const result = await artifacts.withFallback(
      'demo',
      Schema,
      '2026-09-03T10:00:00.000Z',
      async () => ({
        payload: ITEMS,
        count: 2,
      }),
    );

    expect(result?.payload).toEqual(ITEMS);
    expect(result?.fromFallback).toBe(false);
    expect(result?.retrievedAt).toBe('2026-09-03T10:00:00.000Z');
  });

  it('replays the previous dataset when a source fails, keeping its real age', async () => {
    await artifacts.withFallback('demo', Schema, '2026-09-03T10:00:00.000Z', async () => ({
      payload: ITEMS,
      count: 2,
    }));

    const result = await artifacts.withFallback(
      'demo',
      Schema,
      '2026-09-03T12:00:00.000Z',
      async () => {
        throw new Error('HTTP 503 Service Unavailable');
      },
    );

    expect(result?.payload).toEqual(ITEMS);
    expect(result?.fromFallback).toBe(true);
    // The older, truthful time — not the time of the failed attempt.
    expect(result?.retrievedAt).toBe('2026-09-03T10:00:00.000Z');
  });

  it('returns null when a source fails and nothing was ever cached', async () => {
    const result = await artifacts.withFallback('cold', Schema, 'now', async () => {
      throw new Error('HTTP 500');
    });
    expect(result).toBeNull();
  });

  it('does not overwrite a good dataset with a failed run', async () => {
    await artifacts.withFallback('demo', Schema, '2026-09-03T10:00:00.000Z', async () => ({
      payload: ITEMS,
      count: 2,
    }));
    await artifacts.withFallback('demo', Schema, '2026-09-03T12:00:00.000Z', async () => {
      throw new Error('down');
    });

    const stored = await artifacts.readArtifact('demo', Schema);
    expect(stored?.payload).toEqual(ITEMS);
    expect(stored?.retrievedAt).toBe('2026-09-03T10:00:00.000Z');
  });

  it('does not persist a successful run whose payload fails validation', async () => {
    const result = await artifacts.withFallback('demo', Schema, 'now', async () => ({
      payload: [{ id: 'a' }] as unknown as Payload,
      count: 1,
    }));

    // The caller still gets the data it fetched; it simply is not cached.
    expect(result?.fromFallback).toBe(false);
    expect(await artifacts.readArtifact('demo', Schema)).toBeNull();
  });

  it('replaces the cached dataset when a later run succeeds', async () => {
    await artifacts.withFallback('demo', Schema, '2026-09-03T10:00:00.000Z', async () => ({
      payload: ITEMS,
      count: 2,
    }));

    const newer: Payload = [{ id: 'c', title: 'Third' }];
    await artifacts.withFallback('demo', Schema, '2026-09-03T11:00:00.000Z', async () => ({
      payload: newer,
      count: 1,
    }));

    const stored = await artifacts.readArtifact('demo', Schema);
    expect(stored?.payload).toEqual(newer);
    expect(stored?.retrievedAt).toBe('2026-09-03T11:00:00.000Z');
  });

  it('isolates sources from one another', async () => {
    await artifacts.withFallback('alpha', Schema, 't1', async () => ({ payload: ITEMS, count: 2 }));
    const beta = await artifacts.withFallback('beta', Schema, 't2', async () => {
      throw new Error('down');
    });

    expect(beta).toBeNull();
    expect((await artifacts.readArtifact('alpha', Schema))?.payload).toEqual(ITEMS);
  });
});
