#!/usr/bin/env node
/**
 * Production smoke test.
 *
 * Checks the deployed site the way a reader would reach it, using nothing
 * secret: a public URL and public routes. Safe to run from CI, from a laptop,
 * or against a preview deployment.
 *
 *   BRUINWEB_URL=https://bruinweb.vercel.app node scripts/smoke.mjs
 *
 * What it asserts, in order of how much it would hurt to get wrong:
 *   1. Every essential route serves HTML with a 200.
 *   2. The generated status artifact exists, parses, and describes every source.
 *   3. The build that produced it is recent — this is what proves a scheduled
 *      rebuild actually ran, as opposed to the site simply still being up.
 *   4. Freshness indicators are present on the page a reader would check.
 *   5. No credential-shaped string appears in the published status artifact.
 *
 * Exit code 1 on failure, so CI stops. Warnings — an individual publisher being
 * unavailable — do not fail the run, because that is the publisher's problem and
 * the site is designed to survive it.
 */

const BASE = (process.env.BRUINWEB_URL ?? 'https://bruinweb.vercel.app').replace(/\/$/, '');

/** How recent the deployed build must be for the refresh to count as working. */
const MAX_BUILD_AGE_MINUTES = Number(process.env.BRUINWEB_MAX_BUILD_AGE_MINUTES ?? 180);

const ROUTES = [
  '/',
  '/today/',
  '/browse/',
  '/lectures/',
  '/status/',
  '/about/',
  '/source/dining/',
  '/source/daily-bruin/',
  '/source/athletics/',
  '/source/panopto/',
];

const failures = [];
const warnings = [];
const notes = [];

function fail(message) {
  failures.push(message);
  console.error(`  ✗ ${message}`);
}

function pass(message) {
  console.log(`  ✓ ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.log(`  ! ${message}`);
}

async function get(path, accept = 'text/html') {
  const response = await fetch(`${BASE}${path}`, {
    headers: { accept, 'user-agent': 'BruinWebSmokeTest/1.0' },
    redirect: 'follow',
  });
  return { status: response.status, body: await response.text() };
}

async function checkRoutes() {
  console.log('\nRoutes');
  for (const route of ROUTES) {
    try {
      const { status, body } = await get(route);
      if (status !== 200) {
        fail(`${route} returned HTTP ${status}`);
      } else if (!body.includes('<html')) {
        fail(`${route} returned a 200 that is not an HTML document`);
      } else {
        pass(`${route}`);
      }
    } catch (error) {
      fail(`${route} could not be fetched: ${error.message}`);
    }
  }
}

async function checkStatusArtifact() {
  console.log('\nGenerated status artifact');

  let report;
  try {
    const { status, body } = await get('/status.json', 'application/json');
    if (status !== 200) {
      fail(`/status.json returned HTTP ${status}`);
      return null;
    }
    report = JSON.parse(body);
    pass('/status.json is published and parses');
  } catch (error) {
    fail(`/status.json is not usable: ${error.message}`);
    return null;
  }

  if (!Array.isArray(report.sources) || report.sources.length === 0) {
    fail('the status report lists no sources');
    return report;
  }
  pass(`report describes ${report.sources.length} sources`);

  for (const field of ['generatedAt', 'summary', 'sources']) {
    if (!(field in report)) fail(`the status report is missing "${field}"`);
  }

  for (const source of report.sources) {
    for (const field of ['id', 'health', 'itemCount', 'lastSuccessfulUpdate', 'refreshStrategy']) {
      if (!(field in source)) fail(`source "${source.id ?? '?'}" is missing "${field}"`);
    }
  }
  pass('every source entry carries its health, item count and last-updated time');

  return report;
}

function checkFreshness(report) {
  console.log('\nFreshness');

  const builtAt = Date.parse(report.generatedAt);
  if (Number.isNaN(builtAt)) {
    fail(`generatedAt is not a readable timestamp: ${report.generatedAt}`);
    return;
  }

  const ageMinutes = Math.round((Date.now() - builtAt) / 60_000);
  notes.push(`build age: ${ageMinutes} min`);

  if (ageMinutes > MAX_BUILD_AGE_MINUTES) {
    fail(
      `the deployed build is ${ageMinutes} minutes old, over the ${MAX_BUILD_AGE_MINUTES}-minute limit — the scheduled refresh does not appear to be running`,
    );
  } else {
    pass(`deployed build is ${ageMinutes} minutes old`);
  }

  const { summary } = report;
  notes.push(
    `${summary.live} live, ${summary.fallback} on fallback, ${summary.stale} stale, ` +
      `${summary.unavailable} unavailable, ${summary.blocked} blocked, ${summary.placeholder} placeholder`,
  );

  if (summary.totalItems === 0) {
    fail('the deployed site contains no items from any source');
  } else {
    pass(`${summary.totalItems} items across all sections`);
  }

  // A single unavailable publisher is expected and survivable; everything being
  // down at once means our side is broken, not theirs.
  const working = summary.live + summary.fallback + summary.stale;
  if (working === 0) {
    fail('no source is live, stale, or serving fallback data');
  } else if (summary.unavailable > 0) {
    const down = report.sources.filter((s) => s.health === 'unavailable').map((s) => s.id);
    warn(`unavailable: ${down.join(', ')} (expected for publishers that block datacenters)`);
  }

  for (const source of report.sources.filter((s) => s.health === 'fallback')) {
    warn(`${source.id} is serving data retrieved ${source.dataAgeMinutes} minutes ago`);
  }
}

async function checkStatusPage() {
  console.log('\nStatus page indicators');
  try {
    const { body } = await get('/status/');
    const expected = ['Live', 'Unavailable', 'Last updated', 'Refresh'];
    const missing = expected.filter((label) => !body.includes(label));
    if (missing.length > 0) {
      fail(`the status page is missing indicators: ${missing.join(', ')}`);
    } else {
      pass('status page shows health, last-updated and refresh indicators');
    }
  } catch (error) {
    fail(`the status page could not be checked: ${error.message}`);
  }
}

function checkNoSecrets(report) {
  console.log('\nSecret redaction');
  const serialized = JSON.stringify(report);

  const patterns = [
    [/gh[pousr]_[A-Za-z0-9]{16,}/, 'a GitHub token'],
    [/github_pat_[A-Za-z0-9_]{20,}/, 'a GitHub fine-grained token'],
    [/\bBearer\s+[A-Za-z0-9._-]{12,}/i, 'a bearer token'],
    [
      /[?&](?:api[_-]?key|token|client_secret|secret|password)=(?!\[redacted\])[^&"\s]+/i,
      'a credential query parameter',
    ],
    [/api\.vercel\.com\/v1\/integrations\/deploy\//, 'a Vercel deploy hook URL'],
  ];

  let clean = true;
  for (const [pattern, description] of patterns) {
    if (pattern.test(serialized)) {
      fail(`the published status report appears to contain ${description}`);
      clean = false;
    }
  }
  if (clean) pass('no credential-shaped strings in the published report');
}

async function main() {
  console.log(`BruinWeb smoke test → ${BASE}`);

  await checkRoutes();
  const report = await checkStatusArtifact();

  if (report) {
    checkFreshness(report);
    checkNoSecrets(report);
  }
  await checkStatusPage();

  console.log('\n' + '-'.repeat(60));
  for (const note of notes) console.log(`  ${note}`);
  if (warnings.length > 0) console.log(`  ${warnings.length} warning(s)`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log('\nAll smoke checks passed.');
}

main().catch((error) => {
  console.error(`\nSmoke test crashed: ${error.message}`);
  process.exit(1);
});
