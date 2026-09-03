import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

import { SOURCE_LIST, SOURCES, sourceHref } from '@/lib/config/sources';
import { LIVE_SOURCE_IDS, isLiveSource } from '@/lib/live';

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const SOURCE_FILES = walk(path.join(ROOT, 'src'));

/**
 * The brief is explicit that no production section may quietly render mock
 * data. These tests make that structural rather than a matter of vigilance.
 */
describe('mock data never reaches production', () => {
  const MOCK_MODULE = '@/lib/mock/lectures';

  it('is imported by exactly one adapter — the Panopto placeholder', () => {
    const importers = SOURCE_FILES.filter((file) =>
      readFileSync(file, 'utf8').includes(MOCK_MODULE),
    ).map((file) => path.relative(ROOT, file));

    expect(importers).toEqual(['src/lib/adapters/panopto.ts']);
  });

  it('is never imported by a page or a component', () => {
    const ui = SOURCE_FILES.filter(
      (file) =>
        file.includes(`${path.sep}app${path.sep}`) ||
        file.includes(`${path.sep}components${path.sep}`),
    );

    for (const file of ui) {
      expect(readFileSync(file, 'utf8'), path.relative(ROOT, file)).not.toContain('/lib/mock/');
    }
  });

  it('only ever surfaces through a section marked as a placeholder', () => {
    expect(SOURCES.lectures.retrieval).toBe('placeholder');
    expect(SOURCES.lectures.defaultDataMode).toBe('placeholder');
    expect(SOURCES.lectures.refresh.strategy).toBe('none');
    expect(SOURCES.lectures.attribution.toLowerCase()).toContain('not real');
  });

  it('leaves every other source on a real adapter', () => {
    for (const source of SOURCE_LIST) {
      if (source.id === 'lectures') continue;
      expect(source.defaultDataMode, source.id).not.toBe('placeholder');
      expect(source.retrieval, source.id).not.toBe('placeholder');
    }
  });
});

describe('every visible section resolves to a real page', () => {
  it('routes each navigable source somewhere that exists', () => {
    for (const source of SOURCE_LIST.filter((entry) => entry.inNav && entry.enabled)) {
      const href = sourceHref(source);
      expect(href, source.id).toMatch(/^\//);

      if (href.startsWith('/source/')) {
        expect(existsSync(path.join(ROOT, 'src', 'app', 'source', '[slug]', 'page.tsx'))).toBe(
          true,
        );
      } else {
        const page = path.join(ROOT, 'src', 'app', href.replace(/^\/|\/$/g, ''), 'page.tsx');
        expect(existsSync(page), `${source.id} → ${href}`).toBe(true);
      }
    }
  });

  it('gives every source a distinct slug and a distinct route', () => {
    const slugs = SOURCE_LIST.map((source) => source.slug);
    const routes = SOURCE_LIST.map(sourceHref);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

describe('browser refresh is limited to what the registry allows', () => {
  it('claims exactly the sources configured for it', () => {
    const configured = SOURCE_LIST.filter((source) => source.refresh.strategy === 'browser').map(
      (source) => source.id,
    );
    expect([...LIVE_SOURCE_IDS].sort()).toEqual([...configured].sort());
  });

  it('rejects anything not configured for browser refresh', () => {
    expect(isLiveSource('dining')).toBe(false);
    expect(isLiveSource('lectures')).toBe(false);
    expect(isLiveSource('public-lectures')).toBe(false);
    expect(isLiveSource('not-a-source')).toBe(false);
  });

  it('only ever points at https endpoints', () => {
    for (const id of LIVE_SOURCE_IDS) {
      expect(SOURCES[id].refresh.browser!.endpoint, id).toMatch(/^https:\/\//);
    }
  });
});

describe('no scraping logic or credential can reach the browser', () => {
  const CLIENT_FILES = SOURCE_FILES.filter((file) =>
    readFileSync(file, 'utf8').startsWith("'use client'"),
  );

  it('finds the client components it expects to check', () => {
    expect(CLIENT_FILES.length).toBeGreaterThan(3);
  });

  it('keeps Node-only modules out of client components', () => {
    for (const file of CLIENT_FILES) {
      const text = readFileSync(file, 'utf8');
      for (const forbidden of ['node:fs', 'node:crypto', 'node:path', 'cheerio']) {
        expect(text, `${path.relative(ROOT, file)} imports ${forbidden}`).not.toMatch(
          new RegExp(`(?:from|require\\()\\s*['"]${forbidden}`),
        );
      }
    }
  });

  it('keeps process.env out of client components', () => {
    for (const file of CLIENT_FILES) {
      expect(readFileSync(file, 'utf8'), path.relative(ROOT, file)).not.toContain('process.env');
    }
  });

  it('shares one normalizer between the build and the browser rather than two', () => {
    // If these modules ever grow a Node import, the split has been undone and
    // the browser would be running a second, divergent implementation.
    for (const shared of [
      'src/lib/adapters/wordpress-normalize.ts',
      'src/lib/adapters/athletics-normalize.ts',
    ]) {
      const text = readFileSync(path.join(ROOT, shared), 'utf8');
      // Prose may mention Node; an actual import would break the browser build.
      expect(text, shared).not.toMatch(/(?:from|require\()\s*['"]node:/);
      expect(text, shared).not.toMatch(/(?:from|require\()\s*['"][^'"]*fetch-json/);
      expect(text, shared).not.toMatch(/(?:from|require\()\s*['"]cheerio/);
    }
  });
});
