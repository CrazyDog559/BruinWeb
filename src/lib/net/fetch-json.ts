/**
 * Build-time HTTP helpers.
 *
 * Every request made by an adapter goes through here so that timeouts, retries,
 * caching and User-Agent identification are consistent, and so that a single
 * failing source can never take down the whole build.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { BUILD, USER_AGENT } from '@/lib/config/site';

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

interface FetchOptions {
  /** Milliseconds before the request is aborted. */
  timeoutMs?: number;
  /** Number of additional attempts after the first failure. */
  retries?: number;
  headers?: Record<string, string>;
  /** Skip the on-disk build cache for this request. */
  noCache?: boolean;
}

const CACHE_DIR = path.join(process.cwd(), BUILD.cacheDir);

function cacheKey(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32);
}

async function readCache(url: string): Promise<string | null> {
  if (!BUILD.cacheEnabled) return null;
  try {
    const file = path.join(CACHE_DIR, `${cacheKey(url)}.json`);
    const raw = await readFile(file, 'utf8');
    const entry = JSON.parse(raw) as { at: number; body: string };
    if (Date.now() - entry.at > BUILD.cacheTtlMs) return null;
    return entry.body;
  } catch {
    return null;
  }
}

async function writeCache(url: string, body: string): Promise<void> {
  if (!BUILD.cacheEnabled) return;
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(
      path.join(CACHE_DIR, `${cacheKey(url)}.json`),
      JSON.stringify({ at: Date.now(), body }),
      'utf8',
    );
  } catch {
    // A cache write failure must never fail a build.
  }
}

/** Fetch a URL as text, with timeout, retry-with-backoff and a build cache. */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const { timeoutMs = BUILD.requestTimeoutMs, retries = BUILD.retries, headers = {} } = options;

  if (!options.noCache) {
    const cached = await readCache(url);
    if (cached !== null) return cached;
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'user-agent': USER_AGENT, accept: '*/*', ...headers },
        /**
         * Next.js patches `fetch` and, left alone, caches responses in a Data
         * Cache that Vercel restores across deploys — which would silently
         * serve stale content forever. `no-store` is not the fix: it marks the
         * route dynamic and breaks static generation outright. A short
         * revalidate window keeps the route static while guaranteeing that any
         * entry older than a minute is refetched, so every deploy sees live
         * upstream data.
         */
        next: { revalidate: BUILD.nextRevalidateSeconds },
      });
      if (!response.ok) {
        throw new FetchError(
          `HTTP ${response.status} ${response.statusText}`,
          response.status,
          url,
        );
      }
      const body = await response.text();
      await writeCache(url, body);
      return body;
    } catch (error) {
      lastError = error;
      // 4xx responses are deterministic; retrying only wastes build time.
      if (error instanceof FetchError && error.status && error.status < 500) break;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, BUILD.retryBackoffMs * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new FetchError(`Request to ${url} failed`, undefined, url);
}

/** Fetch and JSON-parse a URL. Parse failures surface as `FetchError`. */
export async function fetchJson<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const body = await fetchText(url, {
    ...options,
    headers: { accept: 'application/json', ...options.headers },
  });
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new FetchError('Response was not valid JSON', undefined, url);
  }
}
