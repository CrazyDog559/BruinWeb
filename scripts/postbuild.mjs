#!/usr/bin/env node
/**
 * Post-build step.
 *
 * Prints the integration status report as a build-log summary, so a scheduled
 * rebuild is legible in GitHub Actions and Vercel logs without opening the site.
 *
 * The published `status.json` is NOT written here — it is emitted by the
 * `app/status.json` route during the build itself. Vercel's Next.js builder
 * captures the exported output at the end of `next build`, so a file written
 * afterwards would never reach the deployment. This step only writes a local
 * copy when one is missing, which is a convenience for `npm run build` on a
 * laptop.
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
    await access(TARGET);
  } catch {
    // The route handler should have produced it; write it only as a fallback.
    try {
      await access(OUT_DIR);
      await writeFile(TARGET, JSON.stringify(report, null, 2), 'utf8');
      console.warn('[postbuild] status.json was missing from out/; wrote a local copy');
    } catch {
      console.warn('[postbuild] out/ is not present; skipped the local status.json copy');
    }
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
