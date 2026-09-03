import { createHash } from 'node:crypto';

import { slugify } from './text';

/**
 * Build a stable item id. Ids must not change between builds for unchanged
 * upstream content, otherwise React keys and dedupe results churn.
 */
export function makeId(
  sourceId: string,
  ...parts: Array<string | number | null | undefined>
): string {
  const joined = parts
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join('|');
  const slug = slugify(joined);
  if (slug.length >= 8) return `${sourceId}:${slug}`;
  return `${sourceId}:${createHash('sha1').update(joined).digest('hex').slice(0, 16)}`;
}
