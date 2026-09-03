import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { SOURCE_LIST } from '@/lib/config/sources';

const ROOT = process.cwd();
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'refresh.yml');

/**
 * The scheduled refresh is the whole point of the automation work, and it is the
 * one part no unit test can exercise for real. These assertions guard the
 * properties that would silently break it — a missing cron, a leaked secret, a
 * hard-coded UTC offset — rather than trying to prove the workflow runs.
 */
describe('scheduled refresh workflow', () => {
  const yaml = existsSync(WORKFLOW) ? readFileSync(WORKFLOW, 'utf8') : '';

  it('exists', () => {
    expect(existsSync(WORKFLOW), 'refresh.yml should be committed').toBe(true);
  });

  it('runs on a schedule and can also be triggered by hand', () => {
    expect(yaml).toMatch(/^\s*schedule:/m);
    expect(yaml).toMatch(/cron:\s*'\*\/30 \* \* \* \*'/);
    expect(yaml).toMatch(/^\s*workflow_dispatch:/m);
  });

  it('protects against overlapping rebuilds', () => {
    expect(yaml).toMatch(/^concurrency:/m);
    expect(yaml).toMatch(/group:\s*bruinweb-refresh/);
    expect(yaml).toMatch(/cancel-in-progress:\s*false/);
  });

  it('reads the deploy hook from a secret of the agreed name', () => {
    expect(yaml).toContain('secrets.VERCEL_DEPLOY_HOOK_URL');
  });

  it('never echoes the hook, and never prints the hook response body', () => {
    // `echo "$HOOK"` or `echo $HOOK` in any form would put the credential in a
    // public build log.
    expect(yaml).not.toMatch(/echo\s+["']?\$\{?HOOK/);
    expect(yaml).not.toMatch(/echo\s+["']?\$\{\{\s*secrets\./);
    expect(yaml).not.toMatch(/cat\s+\/tmp\/hook-response/);
  });

  it('decides the dining window in UCLA time rather than a fixed UTC offset', () => {
    expect(yaml).toContain('TZ=America/Los_Angeles');
    // A hard-coded offset would drift by an hour twice a year.
    expect(yaml).not.toMatch(/UTC-?[78]\b/);
  });

  it('asks for no more permission than reading the repository', () => {
    expect(yaml).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });

  it('runs the production smoke test after a rebuild', () => {
    expect(yaml).toContain('scripts/smoke.mjs');
    expect(yaml).toMatch(/needs:\s*refresh/);
  });

  it('fails loudly when the secret is missing instead of pinging nothing', () => {
    expect(yaml).toContain('::error::VERCEL_DEPLOY_HOOK_URL is not set');
  });
});

describe('supporting scripts', () => {
  it('ships the smoke test and the post-build status emitter', () => {
    expect(existsSync(path.join(ROOT, 'scripts', 'smoke.mjs'))).toBe(true);
    expect(existsSync(path.join(ROOT, 'scripts', 'postbuild.mjs'))).toBe(true);
  });

  it('runs the post-build step as part of `npm run build`', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.build).toContain('scripts/postbuild.mjs');
    expect(pkg.scripts.smoke).toContain('scripts/smoke.mjs');
  });

  it('keeps a scheduled rebuild green when a single publisher is down', () => {
    // The post-build step summarises source health; it must not turn one
    // publisher's outage into a failed deployment.
    const postbuild = readFileSync(path.join(ROOT, 'scripts', 'postbuild.mjs'), 'utf8');
    expect(postbuild).toContain('process.exit(0)');
    expect(postbuild).not.toMatch(/process\.exit\([1-9]/);
  });
});

describe('no secrets are committed', () => {
  it('documents the deploy hook without containing one', () => {
    const files = ['README.md', '.env.example', '.github/workflows/refresh.yml'];
    for (const file of files) {
      const full = path.join(ROOT, file);
      if (!existsSync(full)) continue;
      const text = readFileSync(full, 'utf8');
      // A real Vercel deploy hook is api.vercel.com/v1/integrations/deploy/<id>/<key>.
      expect(text, file).not.toMatch(/api\.vercel\.com\/v1\/integrations\/deploy\/prj_[A-Za-z0-9]/);
      expect(text, file).not.toMatch(/gh[pousr]_[A-Za-z0-9]{16,}/);
    }
  });

  it('never exposes a source credential to the browser', () => {
    for (const source of SOURCE_LIST) {
      for (const name of source.credentialEnvVars) {
        // NEXT_PUBLIC_ variables are inlined into client bundles.
        expect(name, source.id).not.toMatch(/^NEXT_PUBLIC_/);
      }
    }
  });
});
