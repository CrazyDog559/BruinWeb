# BruinWeb

A unified media hub for UCLA — news, audio, publications, events, dining, esports and athletics
gathered from their official public sources into one fast, static site.

> **BruinWeb is an independent, student-built project.** It is not affiliated with, endorsed by, or
> an official product of the University of California, Los Angeles. All content belongs to its
> original publishers and every item links back to them.

**Live site:** https://bruinweb.vercel.app
**Repository:** https://github.com/CrazyDog559/BruinWeb

---

## What it is

A **fully static** Next.js site. Every source is fetched once during `next build` by a server-side
adapter, normalized into one shared shape, and baked into HTML. There is no database, no API server,
no serverless function and no authentication. Search and filtering run in the browser against the
content already on the page.

- 11 channels, 9 of them fetching live data at build time
- Content refreshes automatically — a scheduled rebuild plus in-browser live refresh, no code push required
- A public [source-status page](https://bruinweb.vercel.app/status/) showing what is live, stale or unavailable
- A dining view that leads with each hall's **main courses** for the current meal
- A **public lectures** browser: 171 talks from six verified UCLA centres and institutes
- One normalized `MediaItem` type shared across every integration
- Cross-source search, filters (source / media type / category / date), and a "Today at UCLA" view
- Light and dark themes, keyboard navigation, reduced-motion support
- A failing source degrades its own section and nothing else

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first page load fetches every source, so it takes a few seconds;
responses are then cached on disk under `.cache/` for 30 minutes.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build — fetches all sources, emits static HTML to `out/` |
| `npm start` | Serve the built `out/` directory locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run format` | Prettier write |
| `npm run verify` | Format check → lint → typecheck → test → build |

Run `npm run verify` before pushing.

## Deploying to Vercel

The project is a standard Next.js app using `output: 'export'`, so Vercel needs no special
configuration.

1. Push the repository to GitHub.
2. In Vercel, **Add New → Project** and import the repository.
3. Framework preset: **Next.js**. Build command `npm run build`, output directory `out`
   (Vercel detects both automatically from `next.config.ts`).
4. Environment variables: **none are required.** See below.
5. Deploy.

Every push to `main` triggers a production deployment automatically; pull requests get preview
deployments.

### Keeping content fresh

Content is a snapshot taken at build time, so the site is exactly as fresh as its last deploy. To
refresh it without pushing code, use a **Deploy Hook**:

1. Vercel → Project → **Settings → Git → Deploy Hooks**.
2. Create a hook for the `main` branch, e.g. named `scheduled-refresh`. Copy the URL.
3. Trigger it on a schedule with any cron service — GitHub Actions works and costs nothing:

   ```yaml
   # .github/workflows/refresh.yml
   name: Refresh BruinWeb
   on:
     schedule:
       - cron: '0 13,1 * * *' # 6am and 6pm Pacific
     workflow_dispatch:
   jobs:
     refresh:
       runs-on: ubuntu-latest
       steps:
         - run: curl -fsSL -X POST "${{ secrets.VERCEL_DEPLOY_HOOK }}"
   ```

   Store the hook URL as the repository secret `VERCEL_DEPLOY_HOOK` — it is a credential; do not
   commit it.

Dining menus change daily, so twice-daily rebuilds are a reasonable baseline.

## Environment variables

**None are required.** The site builds, deploys and works with no variables set; an integration
missing its credentials reports itself as unavailable rather than substituting invented data.

See [`.env.example`](.env.example) for the full list with descriptions.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PANOPTO_SITE_HOST` | No | Panopto host for the (unbuilt) Lectures integration |
| `PANOPTO_CLIENT_ID` | No | Panopto OAuth2 client id |
| `PANOPTO_CLIENT_SECRET` | No | Panopto OAuth2 client secret |
| `BRUINWEB_DISABLE_CACHE` | No | Set to `1` to bypass the local build cache |

**Security rules this project follows:**

- No secret is ever prefixed `NEXT_PUBLIC_`. All three Panopto variables are read only by build-time
  adapter code running on the server, so nothing reaches the browser bundle.
- `.env`, `.env.local` and `.env.*.local` are gitignored. Only `.env.example` — which contains names
  and descriptions, never values — is committed.
- An integration whose credentials are absent is disabled gracefully and labelled in the UI.

To configure them in Vercel: **Settings → Environment Variables**, add each name and value, select
Production and Preview, then redeploy.

## Data-source matrix

| # | Source | Method | Endpoint | Status | Key limitation |
| --- | --- | --- | --- | --- | --- |
| 1 | UCLA Dining | Public-page adapter | `dining.ucla.edu/hours/`, `/menus-at-a-glance/?date=` | **Live (build)** | No API exists — `/wp-json/` returns 401 site-wide. HTML parsing is markup-dependent. |
| 2 | Daily Bruin | JSON API → RSS → embedded page data | `wp.dailybruin.com/wp-json/wp/v2/posts`, then `/feed/`, then `dailybruin.com` | **Live (build)** | Headlines and excerpts only; full text is copyrighted. The `wp.` API host refuses cloud datacenter IPs entirely, so production builds read the `__NEXT_DATA__` payload embedded in the public site. |
| 3 | UCLA Radio | JSON API | `uclaradio.com/wp-json/wp/v2/posts` | **Live (build)** | Editorial posts only. No machine-readable show schedule or live-stream URL exists. |
| 4 | UCLA Communications Board | JSON API | `uclastudentmedia.com/wp-json/wp/v2/pages` | **Live (build)** | Governance pages only — the board publishes no news feed. Storefront pages are filtered out. |
| 5 | BruinLife | JSON API | `bruinlife.com/wp-json/wp/v2/posts` | **Live (build)** | Headlines and excerpts only. |
| 6 | UCLA Undergraduate Science Journal | — | — | **Blocked** | Client-rendered Wix site: no API, feed, JSON-LD or per-article index. Not on eScholarship. |
| 7 | UCLA Esports | RSS | `uclaclubsports.com/rss.aspx?path=es` | **Live (build)** | News only. As a club sport it has no schedule, roster or stream feed. |
| 8 | UCLA Athletics | JSON API | `api.uclabruins.com/website-api/*` | **Live (build)** | Unofficial, undocumented API — no stability guarantee. Carries no article body and no in-line scores. |
| 9 | UCLA Events | Embedded structured data | `www.ucla.edu/events` | **Live (build)** | Curated highlights, not the full campus calendar. `calendar.ucla.edu` is unreachable/retired. |
| 10 | UCLA Public Lectures | RSS (six verified feeds) | see `src/lib/config/lecture-sources.ts` | **Live (build)** | Metadata and links only; media stays on the publisher's host. YouTube is excluded — its feed path is robots-disallowed. |
| 11 | UCLA Lectures via Panopto | Placeholder template | — | **Placeholder** | Deliberately not built. Requires institution-issued OAuth credentials. |

Full research notes, including everything that was tried and rejected, are in
[`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).

### Known limitations

- **Freshness.** Content is a build-time snapshot. Configure a deploy hook (above) for regular
  refreshes.
- **CORS.** None of these sources send `Access-Control-Allow-Origin`, so none can be fetched from the
  browser. This is precisely why all retrieval happens server-side at build time.
- **Copyright.** Only headlines, short excerpts and metadata are shown; full articles are never
  republished. Images are hot-linked from the publisher rather than copied, and every item preserves
  its original link.
- **Image optimization.** A static export has no image optimizer. Where a publisher offers size
  variants (the WordPress sources) a proper `srcset` is emitted; UCLA Athletics serves signed
  `imgproxy` URLs whose dimensions cannot be rewritten, so those load at their published size.
- **Markup dependence.** UCLA Dining and UCLA Events are parsed from HTML. An upstream redesign will
  break them — by design they then show an "unavailable" state instead of stale or invented content.
- **YouTube is excluded.** Official UCLA channels (IPAM, the Burkle Center, UCLA Library, the School
  of Law, DGSOM, the International Institute) carry real lecture recordings, and YouTube's per-channel
  Atom feed would be the natural way to read them. It is off limits: `youtube.com/robots.txt`
  contains `Disallow: /feeds/videos.xml` for every crawler but Google's own, and the endpoint returned
  404 to every request regardless. Adding those channels means the YouTube Data API and an API key —
  a build-time secret and a new adapter — which is documented in the integration report but not built.
- **Lecture freshness and media.** Lectures are collected at build time like everything else. Only
  metadata and links are stored: audio and video stay on each publisher's own host and are never
  copied, rehosted or re-encoded. Playback is embedded only where a publisher officially supports it;
  today no source does, so every talk links out.
- **Datacenter blocking (Daily Bruin).** The Daily Bruin refuses requests from cloud datacenter
  networks — `403` on its REST API, its RSS feed *and* its public site — so a Vercel build cannot
  retrieve it. This is now solved from the other direction: the section refreshes in the reader's
  own browser, which is not a datacenter and which the publisher's API answers with CORS headers.
  The built page may therefore be empty on a cold cache until a reader presses "Check for new";
  once any build succeeds, the persisted artifact keeps the section populated. The adapter tries all three public surfaces in turn; BruinWeb identifies itself honestly
  in its `User-Agent` at every step and does not disguise requests as a browser to get around the
  block. Two legitimate ways to include the section in a hosted build:

  1. Ask the Daily Bruin to allow the build's User-Agent or network.
  2. Build where the block does not apply and deploy the output — `npm run build`, then
     `npx vercel deploy --prebuilt --prod`.

  Every other source is unaffected, and no other part of the site depends on this one.

## Architecture

```
src/
  lib/
    types/          Shared MediaItem contract + dining-specific types
    config/
      site.ts       Site copy, timezone, build/caching behaviour
      sources.ts    THE source registry — names, URLs, colors, icons, nav, flags
    net/            Build-time fetch (timeout, retry, disk cache) and RSS parsing
    normalize/      Text, dates, ids, dedupe — pure and fully unit-tested
    adapters/       One typed adapter per source
    mock/           Isolated placeholder fixtures
    data/load.ts    Runs every adapter, fault-isolated and memoized per build
    search.ts       Pure filter/search logic
  components/       Accessible, reusable UI
  app/              Routes (all statically generated)
```

Two rules keep this maintainable:

1. **No source content is hard-coded in a component.** Components read `src/lib/config/sources.ts`
   and the normalized data; they never contain a headline, URL, menu item or date.
2. **A source schema change touches only its adapter.** Everything downstream depends on `MediaItem`,
   not on any upstream shape.

### Dining: how main courses are chosen

Each dining hall leads with a **Main Courses** group for the meal period, with the full menu
underneath grouped by the stations UCLA publishes. The classification is deterministic and driven by
configuration — no dish is hard-coded, and no model is consulted at build time or at page load.

- `src/lib/config/dining-menu.ts` holds the rule tables: station-name patterns mapped onto a small
  taxonomy (`main`, `side`, `salad`, `soup`, `dessert`, `bakery`, `fruit`, `beverage`, `condiment`),
  strong and weak dish-name demotion rules, and entrée signals.
- `classifyMenuItem` in `src/lib/adapters/dining.ts` owns precedence only:
  1. A recognised station sets the base category.
  2. Strong rules pull desserts, drinks, fruit, soups, salads and porridge out of `main`
     unconditionally.
  3. Weak rules demote sauces, breads and starches, but yield to a composed dish — so
     "Spaghetti w/ Marinara" stays a main course while "Roasted Tomato Salsa" does not.
  4. An unrecognised station falls back to dish-name signals alone.

To adjust it, edit the tables — not the components, and not the adapter. `tests/dining-main-courses.test.ts`
asserts that sides, drinks, desserts, condiments, fruit, soups, salads and bakery items are never
promoted, at any station.

Dietary and allergen labels are shown exactly as UCLA publishes them; allergens are phrased as
"contains", never as a claim of BruinWeb's own.

### Adding a public lecture source

`src/lib/config/lecture-sources.ts` is the registry. Every entry records the endpoint, the UCLA unit,
the evidence of affiliation, how it was discovered, its update frequency and any usage restriction.
Sources investigated and rejected are kept in `EXCLUDED_LECTURE_SOURCES` with the reason, so nobody
re-adds them without re-checking.

To add one:

1. Verify it is genuinely UCLA-affiliated — a `ucla.edu` link inside the feed, or a `ucla.edu` page
   linking to it. "UCLA" in the title is not evidence.
2. Check the host's robots.txt and terms. If automated access is discouraged, **do not work around
   it** — add the source to `EXCLUDED_LECTURE_SOURCES` with the reason instead.
3. Confirm the content is genuinely lectures or academic talks, and set `format` to what the
   publisher actually calls it. A research conversation is a `podcast`, not a `lecture`.
4. Add the entry, choosing an existing `adapter` or writing a new one under
   `src/lib/adapters/lectures/`. Adapters return `Lecture[]` and may throw; the collector isolates
   failures so one dead feed cannot break the build.
5. Set `embedAllowed` only where the publisher officially supports embedding. Everything else is
   linked, never reframed.
6. Confirm every resulting URL loads publicly without signing in.

### How content stays current

BruinWeb has no backend, so "current" comes from three mechanisms rather than a
server rendering on request. Which one a section uses is declared in the source
registry (`src/lib/config/sources.ts`, field `refresh`), not decided in a component.

**1. Live in the reader's browser — automatic, on every visit.** Where a publisher's
public API sends CORS headers and needs no credential, the page refetches it directly when
it opens. No button, no deployment, no waiting: open the site and those sections are
current. A "Check for new" button is there to look again on demand.

This is the only mechanism that is fresh *between* builds, and for the Daily Bruin it is
the only one that works at all — that publisher refuses cloud datacenter networks, but a
reader's browser is not one. Verified CORS-enabled on 2026-09-03:

| Source | Browser endpoint |
| --- | --- |
| Daily Bruin | `wp.dailybruin.com/wp-json/wp/v2/posts` |
| UCLA Radio | `uclaradio.com/wp-json/wp/v2/posts` |
| BruinLife | `bruinlife.com/wp-json/wp/v2/posts` |
| UCLA Communications Board | `uclastudentmedia.com/wp-json/wp/v2/pages` |
| UCLA Athletics | `api.uclabruins.com/website-api/articles` |

Requests go out with `credentials: 'omit'`, so a reader's cookies for a publisher are
never attached. The browser and the build share one normalizer
(`*-normalize.ts` modules, which carry no Node dependency), so a refreshed item cannot be
shaped differently from a built one.

The built content renders first, so the page is useful before any request finishes and
with JavaScript off; the refresh replaces it silently only once it succeeds, and a failure
leaves the built content exactly where it was. A three-minute per-tab throttle
(`sessionStorage`) keeps clicking around the site from re-hitting publishers on every
page — a freshly opened tab always refreshes.

**What this cannot cover.** Dining, Esports, Events and the lecture feeds send no CORS
headers, and UCLA Dining has no JSON API at all — its menus are rendered server-side by a
WordPress plugin, so there is nothing for a browser to call. Those four depend on the
scheduled rebuild below.

**2. Scheduled rebuild.** Everything else is retrieved during `next build`, and
`.github/workflows/refresh.yml` pings a Vercel Deploy Hook on a timetable so that happens
without anyone pushing code. No commit is created to trigger a deploy. Since the busiest
sources now refresh themselves in the browser, this is a top-up rather than the only way
content changes — if the deploy hook is never configured, the site still updates on every
visit for those five sources, and only dining, esports, events and lectures go stale.

**3. Fallback.** Each build-time source persists a validated artifact under
`.next/cache/`, which Vercel restores between deployments. When a publisher is briefly
unavailable the section shows the last dataset that retrieved successfully, labelled as
older data and stamped with its true age. With nothing cached, the section says it is
unavailable — content is never invented to fill a gap.

Every section's live state is visible at [`/status`](https://bruinweb.vercel.app/status/),
and machine-readably at `/status.json`.

### Scheduled refresh

The refresh cadence is driven by UCLA Dining, the source that changes most often.
GitHub's cron is UTC-only and has no notion of daylight saving, so the workflow fires
every 30 minutes year-round and a guard step decides — in `America/Los_Angeles` — whether
that tick should rebuild:

| Campus time | Cadence | Covers |
| --- | --- | --- |
| 06:00–21:59 PT | every 30 min | Dining (30 min), Daily Bruin and Athletics (hourly) |
| 22:00–05:59 PT | hourly | Daily Bruin and Athletics (hourly) |

That is roughly 40 rebuilds a day from one schedule. **Deviations from the per-source
targets, and why:**

- Esports (3 h), Comm Board and BruinLife (6 h), Science Journal and Public Lectures
  (daily) are all refreshed far more often than their targets. Splitting them onto their
  own schedules would mean more deploys, not fewer — Vercel bills build minutes, and one
  rebuild refreshes every source at once.
- UCLA Radio's hourly target is met, but there is no now-playing data to show: UCLA Radio
  publishes no such API. The hourly figure applies to editorial posts.
- Panopto is never fetched, by design.

**One-time setup.** The deploy hook is a credential — anyone holding the URL can trigger
deployments — so it is never committed:

1. In Vercel: **Project → Settings → Git → Deploy Hooks**. Create one named
   `scheduled-refresh` on branch `main`, and copy the URL.
2. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
   Name it exactly `VERCEL_DEPLOY_HOOK_URL` and paste the URL as the value.
3. Optionally run **Actions → Refresh content → Run workflow** to confirm it works.

Until that secret exists a scheduled run logs a warning and skips — failing dozens of times
a day would be noise, given the browser refresh already covers the busiest sources — while
a run you start by hand fails outright, because you asked it to work.

Two caveats worth knowing about GitHub's scheduler: it disables scheduled workflows on
repositories with no activity for 60 days (a commit or a manual run re-enables them), and
`schedule` is best-effort rather than guaranteed. On this repository the 30-minute cron has
been delivering roughly every 3–4 hours in practice, which is another reason the
browser-side refresh carries the freshness that matters.

### Adding another source adapter

1. Add an id to `SOURCE_IDS` and a config entry to `SOURCES` in `src/lib/config/sources.ts`
   (name, blurb, slug, homepage, endpoint, retrieval method, attribution, integration note, icon,
   accent colors).
2. Create `src/lib/adapters/<source>.ts` exporting `load<Source>(): Promise<SourceResult>`. It must:
   - fetch through `src/lib/net/fetch-json.ts` (never raw `fetch`), so timeouts, retries, the
     identifying User-Agent and caching are consistent;
   - validate the response with a **permissive** Zod schema — unknown extra fields must not
     invalidate an item, and validation should run per item so one bad row cannot drop the feed;
   - map into `MediaItem` via the `src/lib/normalize` helpers;
   - **never throw** — catch and return `{ status: 'error', items: [], error }`.
3. Register it in the `Promise.allSettled` list in `src/lib/data/load.ts`, and add it to
   `DEDUPE_PRIORITY`.
4. Add tests under `tests/` for its normalizer, using inline fixtures — no network calls.
5. Run `npm run verify`.

That is the whole contract. The homepage, browse page, filters, search and the generated
`/source/<slug>` page all pick the new source up with no further changes.

### Replacing the Panopto placeholder

`src/lib/adapters/lectures.ts` already defines the full contract; only the provider is missing.

1. Set `PANOPTO_SITE_HOST`, `PANOPTO_CLIENT_ID` and `PANOPTO_CLIENT_SECRET` in Vercel (build-time,
   not `NEXT_PUBLIC_`).
2. Implement a `LectureProvider` whose `fetchLectureRecords()` performs the OAuth2 client-credentials
   token request and then calls Panopto's sessions endpoint, mapping each session onto
   `LectureRecord`. Use `isPanoptoConfigured()` for its `isConfigured()`.
3. Pass that provider into `loadLectures()` in `src/lib/data/load.ts`.
4. Delete `src/lib/mock/lectures.ts`.
5. In `src/lib/config/sources.ts`, change the `lectures` entry's `retrieval` to `'json-api'`,
   `defaultDataMode` to `'build'`, and update its `blurb` and `integrationNote`.

Nothing in `src/components/` changes: `LectureTemplate` renders `MediaItem`s, and the "Placeholder"
badge disappears on its own once `dataMode` stops being `'placeholder'`.

## Testing

```bash
npm test
```

134 tests covering data normalization, invalid and missing source data, filtering and search, date
and timezone handling, deduplication, missing environment variables, the Panopto placeholder adapter,
the HTML/RSS parsers, and the source-registry invariants. No test makes a network request.

## Attribution & branding

BruinWeb uses a **text-only identity**. No UCLA logo, wordmark or other protected asset is reproduced
anywhere; the blue-and-gold palette is inspired by the university's public colors. Every section
names its source, links to it, and shows when the data was retrieved.

If you publish one of these sources and would like your content presented differently — or removed —
please open an issue.
