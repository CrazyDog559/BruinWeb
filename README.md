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

- 10 channels, 8 of them fetching live data at build time
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
| 10 | UCLA Lectures (Panopto) | Placeholder template | — | **Placeholder** | Deliberately not built. Requires institution-issued OAuth credentials. |

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
- **Datacenter blocking.** `wp.dailybruin.com` answers normally from a residential connection but
  returns `403` to cloud datacenter ranges — where Vercel builds run — on both its REST API and its
  RSS feed. The adapter falls back to the structured payload embedded in `dailybruin.com`, a
  different host, which carries the same post objects. BruinWeb identifies itself honestly in its
  `User-Agent` at every step and never disguises requests as a browser; if every public surface
  refuses, the section shows an "unavailable" state rather than stale or invented content.

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
