import { describe, expect, it } from 'vitest';

import { SOURCE_IDS, SOURCES, SOURCE_LIST, getSourceBySlug } from '@/lib/config/sources';

describe('SOURCES registry', () => {
  it('has an entry for every id in SOURCE_IDS whose id matches its key', () => {
    for (const id of SOURCE_IDS) {
      expect(SOURCES[id]).toBeDefined();
      expect(SOURCES[id].id).toBe(id);
    }
  });

  it('has unique slugs', () => {
    const slugs = SOURCE_LIST.map((source) => source.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('round-trips getSourceBySlug for every source', () => {
    for (const source of SOURCE_LIST) {
      expect(getSourceBySlug(source.slug)).toBe(source);
    }
  });

  it('returns undefined for an unknown slug', () => {
    expect(getSourceBySlug('not-a-real-slug')).toBeUndefined();
  });

  it('has non-empty core text fields for every source', () => {
    for (const source of SOURCE_LIST) {
      expect(source.name.trim()).not.toBe('');
      expect(source.blurb.trim()).not.toBe('');
      expect(source.homepage.trim()).not.toBe('');
      expect(source.attribution.trim()).not.toBe('');
      expect(source.integrationNote.trim()).not.toBe('');
    }
  });

  it('lectures uses the placeholder retrieval and data mode', () => {
    expect(SOURCES.lectures.retrieval).toBe('placeholder');
    expect(SOURCES.lectures.defaultDataMode).toBe('placeholder');
  });

  it('science-journal is blocked', () => {
    expect(SOURCES['science-journal'].retrieval).toBe('blocked');
  });
});
