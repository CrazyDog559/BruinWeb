#!/usr/bin/env node
/**
 * Post-build step.
 *
 * Moves the integration status report generated during static export into the
 * published output, and prints it as a build-log summary so a scheduled rebuild
 * is legible in GitHub Actions and Vercel logs without opening the site.
 *
 * Exits 0 even when a source is unavailable. A scheduled rebuild must fail only
 * for genuine application or deployment faults — one publisher having a bad day
 * is a warning, not a broken deploy.
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, '.bruinweb-status.json');
const OUT_DIR = path.join(ROOT, 'out');
const TARGET = path.join(OUT_DIR, 'status.json');

const ICONS = {
  live: '✓',
  stale: '~',
  fallback: '↺',
  unavailable: '✗',
  blocked: '⊘',
  placeholder: '□',
  disabled: '–',
};

async function main() {
  try {
    await access(SOURCE);
  } catch {
    console.warn('[postbuild] no status report was generated; skipping');
    return;
  }

  const report = JSON.parse(await readFile(SOURCE, 'utf8'));

  try {
    await access(OUT_DIR);
    await writeFile(TARGET, JSON.stringify(report), 'utf8');
  } catch {
    console.warn('[postbuild] out/ is not present; status.json was not published');
  }

  const { summary, sources, generatedAt } = report;

  console.log('');
  console.log('  Integration status');
  console.log(`  generated ${generatedAt}`);
  console.log('  ' + '-'.repeat(78));

  for (const source of sources) {
    const icon = ICONS[source.health] ?? '?';
    const age = source.dataAgeMinutes === null ? '—' : `${source.dataAgeMinutes}m old`;
    const took = source.retrievalDurationMs === null ? '—' : `${source.retrievalDurationMs}ms`;
    console.log(
      `  ${icon} ${source.id.padEnd(17)} ${source.health.padEnd(12)} ` +
        `${String(source.itemCount).padStart(4)} items  ${age.padEnd(12)} ${took.padStart(8)}`,
    );
    if (source.error) console.log(`      ${source.error}`);
  }

  console.log('  ' + '-'.repeat(78));
  console.log(
    `  ${summary.live} live · ${summary.fallback} on fallback · ${summary.stale} stale · ` +
      `${summary.unavailable} unavailable · ${summary.blocked} blocked · ` +
      `${summary.placeholder} placeholder · ${summary.totalItems} items total`,
  );
  console.log('');

  // Deliberately always 0. See the header comment.
  process.exit(0);
}

main().catch((error) => {
  console.warn(`[postbuild] ${error.message}`);
  process.exit(0);
});
