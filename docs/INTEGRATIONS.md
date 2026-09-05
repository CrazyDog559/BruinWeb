# Integration report

Research conducted 2026-09-02. Every endpoint listed as working was hit with a real HTTP request and
returned the field names recorded here. Nothing in this document is inferred, and no endpoint, field
or capability has been invented — where something does not exist, that is stated plainly.

Retrieval preference, applied in order to every source: official JSON API → official RSS/Atom feed →
official structured data embedded in the page → a carefully isolated public-page adapter.

All retrieval happens **server-side during `next build`**. None of these sources return
`Access-Control-Allow-Origin`, so none could be fetched from the browser even if we wanted to.

---

## 1. UCLA Dining

| | |
| --- | --- |
| **Investigated** | `https://dining.ucla.edu/`, `https://menu.dining.ucla.edu/` |
| **Chosen method** | Public-page adapter (option d) |
| **Endpoints** | `https://dining.ucla.edu/hours/`<br>`https://dining.ucla.edu/menus-at-a-glance/?date=YYYY-MM-DD` |
| **Update frequency** | Menus daily; hours by academic term |
| **Attribution** | UCLA Dining |
| **Status** | Live at build |

**Why not an API.** `dining.ucla.edu` runs WordPress and advertises `/wp-json/`, but **every** route
returns `401 {"code":"rest_not_logged_in"}` — including `/wp-json/`, `/wp/v2/posts` and `/wp/v2/types`,
which are normally public. This is a blanket WAF/security-plugin rule, not per-route auth, and there
is no workaround. There is no RSS feed and no JSON-LD or embedded JSON payload.
`menu.dining.ucla.edu` is a 301 alias of `dining.ucla.edu`, not a separate application.

**robots.txt.** `User-agent: * / Disallow: /wp-admin/ / Allow: /wp-admin/admin-ajax.php`. Neither
`/hours/` nor `/menus-at-a-glance/` is disallowed.

**What is parsed.** The hours page contains a real `<table class="dining-hours-table">` with columns
Location / Breakfast / Lunch / Dinner / Extended Dinner. The menu page (rendered by UCLA's Jamix
plugin) uses `div.at-a-glance-menu[id=breakfastmenu|lunchmenu|dinnermenu]` →
`div.at-a-glance-menu__dining-location` (`h3` = venue) → `div.at-a-glance-menu__meal-station`
(`h4` = station) → `ul > li > a` (dish) with `img.meal-station__allergen-icon[title]` for diet and
allergen labels.

**Main-course classification.** The source's structured category is the menu station — the `<h4>`
inside `at-a-glance-menu__meal-station`. These are brand names, not a taxonomy: across five days of
live menus the real values were `Capri`, `The Grill/Psistaris`, `Alimenti`, `Capri Pizza`, `Dolce`,
`Mezze`, `Fruit`, `Yogurt Bar`, `CONDIMENTS` and a literal `.` placeholder. They are normalized in
`src/lib/config/dining-menu.ts` onto a small taxonomy, with the adapter owning precedence only:

1. A recognised station sets the base category.
2. Strong dish rules unconditionally pull desserts, drinks, fruit, soups, salads and porridge out of
   `main` — a station that serves entrées also serves cake.
3. Weak dish rules demote sauces, breads and starches but yield to a composed dish, so
   "Spaghetti w/ Marinara" stays a main course while "Roasted Tomato Salsa" does not.
4. An unrecognised station falls back to dish-name signals alone, so a new station still yields
   something useful.

Deterministic and offline: the same inputs always give the same answer, and no model is consulted at
build time or at page load. Measured against five days of live menus, 32 of 114 dishes are promoted
and every one is a genuine entrée. The direction of error is deliberate — a composed entrée salad is
demoted to `salad` rather than a side being promoted.

Dietary and allergen labels come from the `title` attribute of `img.meal-station__allergen-icon` and
are displayed exactly as UCLA publishes them. Allergens are phrased as "contains"; BruinWeb makes no
medical or allergen claim of its own.

**Unresolved limitation.** This is markup parsing, not an API. An upstream redesign will break it;
the section then reports "unavailable" rather than showing stale menus. Only the residential
restaurants listed on the hours table are covered — quick-service venues are not. No terms of use
governing this content were found either permitting or forbidding automated access. Menus are a
build-time snapshot, so the UI shows a stale-menu banner once the reader's campus day moves past the
date the snapshot covers.

---

## 2. Daily Bruin

| | |
| --- | --- |
| **Investigated** | `https://dailybruin.com/` |
| **Chosen method** | Official JSON API (a), falling back to the official RSS feed (b), then to structured data embedded in the public page (c) |
| **Endpoints** | `https://wp.dailybruin.com/wp-json/wp/v2/posts?per_page=24&_embed=1`<br>then `https://wp.dailybruin.com/feed/`<br>then `https://dailybruin.com/` (`__NEXT_DATA__`) |
| **Update frequency** | Several times daily during the term |
| **Attribution** | Daily Bruin |
| **Status** | Live at build |

**Important discovery.** The REST API is **not** on `dailybruin.com`. That domain runs a headless
Next.js frontend which swallows `/wp-json/*` and returns its own 404 page with a `200` status —
a trap for anyone assuming the usual WordPress layout. The real backend is `wp.dailybruin.com`,
found via a `<link rel="preconnect">` on the homepage. `dailybruin.com/feed/` also 404s;
`wp.dailybruin.com/feed/` works.

**Verified fields.** `id`, `date`, `date_gmt`, `slug`, `link`, `title.rendered`, `excerpt.rendered`,
`content.rendered`, `coauthors[].display_name`, `_embedded['wp:featuredmedia'][0].source_url` and
`.media_details.sizes.*`, `_embedded['wp:term'][0]` (categories), `_embedded.author[0].name`.
Pagination via `X-WP-Total` / `X-WP-TotalPages`.

**robots.txt.** `wp.dailybruin.com`: only `/wp-admin/` disallowed; `/wp-json/` is permitted.

**Datacenter blocking, found during deployment.** The REST API returns `200` from a residential
connection but `403 Forbidden` from Vercel's build region (iad1) — an edge rule keyed on the
requesting network, since the identical request succeeds elsewhere. The first fallback, the RSS feed
at `/feed/`, returns `403` from that region too: the whole `wp.dailybruin.com` host refuses it.

The adapter therefore has a third step. `dailybruin.com` — the reader-facing headless Next.js site,
a different host — embeds a `__NEXT_DATA__` payload containing the *same* WordPress post objects the
REST API would have returned (`id`, `link`, `slug`, `date`, `title`, `excerpt`, `categories`,
`coauthors`, `_embedded`), 34 of them across the page's editorial slots. Those objects go through
the very same `WpPostSchema` and `normalizeWpPost` used for the API, so the fallback adds no parallel
normalization path. Posts are deduplicated by id, keeping the richest copy, since a trimmed version
of the same story appears in several slots.

BruinWeb keeps identifying itself truthfully as a bot in its `User-Agent` at every step; no attempt
is made to disguise requests as a browser in order to get around an edge rule. If every public
surface refuses, the section shows an "unavailable" state rather than stale or invented content.

**Unresolved limitation.** No published API terms and no machine-readable license were found, so
content is treated as fully copyrighted: headlines, short excerpts and metadata only, always linked
back to the canonical `link`. Article bodies are never fetched or displayed. Neither fallback
carries `media_details.sizes`, so when one is in use the cards hot-link the publisher's full-size
image instead of a right-sized variant, and the embedded payload has no `date_gmt` — its `date` is
site-local wall clock, which `toIso` resolves in UCLA's time zone.

---

## 3. UCLA Radio

| | |
| --- | --- |
| **Investigated** | `https://uclaradio.com/` |
| **Chosen method** | Official JSON API (option a) |
| **Endpoint** | `https://uclaradio.com/wp-json/wp/v2/posts?per_page=24&_embed=1` |
| **Update frequency** | Roughly weekly |
| **Attribution** | UCLA Radio |
| **Status** | Live at build (partial — see below) |

WordPress 6.8 with Elementor; the REST API is on the main domain. Standard post fields confirmed,
plus PublishPress multi-byline fields (`authors`, `ppma_author`).

**Unresolved limitation — programming and listening links.** The brief asked for current programming,
shows, episodes and listening links. **These are not available from any public endpoint.** The
`/wp-json/wp/v2/types` list exposes no `show`, `schedule` or `episode` custom post type. The schedule
page (id 6072) returns `content.rendered` as an **empty string**, because it is built from Elementor
widget metadata that the default REST fields do not expose. The rendered `/schedule/` HTML and the
homepage were searched for a stream URL (`.mp3`, `.m3u8`, `.pls`, `.aac`, "listen live", radio.co,
Shoutcast/Icecast/Live365/Triton) and **none was found**. UCLA Radio currently presents primarily as
a music and culture webzine.

**To complete it,** UCLA Radio would need to expose a JSON schedule endpoint or a documented stream
URL. Scraping Elementor-rendered HTML was rejected as too fragile to be honest about. The UI states
this limitation and links to the official site for listening.

---

## 4. UCLA Communications Board

| | |
| --- | --- |
| **Official name verified** | UCLA Communications Board — the student-majority board overseeing UCLA Student Media |
| **Official URL verified** | `https://uclastudentmedia.com/` (board section at `/communications-board/`) |
| **Chosen method** | Official JSON API (option a) |
| **Endpoint** | `https://uclastudentmedia.com/wp-json/wp/v2/pages?per_page=100` |
| **Update frequency** | Occasional — governance documents change by term or year |
| **Attribution** | UCLA Communications Board / UCLA Student Media |
| **Status** | Live at build |

**Name and URL verification.** The brief asked that the official name and public source be verified
before implementing. `studentmedia.ucla.edu` and `commboard.ucla.edu` **do not resolve** (DNS
failure). `uclastudentmedia.com` returns 200 and its `/communications-board/` page self-describes:
the board "was created to support UCLA's student-run media" and "oversees ten media titles". The
board has no separate domain.

**What it actually publishes.** Governance material only — bylaws, constitution, meeting schedules,
financial statements, board operations, mission. `/wp/v2/posts` returns `[]` and `/feed/` has no
items: the site has no editorial content of its own. The ten titles it oversees (Daily Bruin, UCLA
Radio, BruinLife, Fem, Pacific Ties, Nommo, Al-Talib, Ha'Am, La Gente, OutWrite) are independently
hosted; three of them are separate channels in this project.

**Implementation note.** The install also runs WooCommerce, so `/wp/v2/pages` includes cart,
checkout, account and donation pages. These are excluded by an explicit slug denylist in the adapter
rather than by guesswork.

**Unresolved limitation.** Board membership is prose inside a single page's `content.rendered`, not
structured fields, so individual members are not extracted.

---

## 5. BruinLife

| | |
| --- | --- |
| **Official URL verified** | `https://bruinlife.com/` — "BruinLife – UCLA Online Magazine". `bruinlife.ucla.edu` does not resolve. |
| **Chosen method** | Official JSON API (option a) |
| **Endpoint** | `https://bruinlife.com/wp-json/wp/v2/posts?per_page=24&_embed=1` |
| **Update frequency** | A few times a month |
| **Attribution** | BruinLife / UCLA Student Media |
| **Status** | Live at build |

WordPress + WooCommerce + Soledad theme. Carries convenient pre-resolved image fields
(`featured_image_src`, `featured_image_src_square`) alongside the standard `_embedded` media.

**Implementation note worth recording.** BruinLife returns `coauthors` as an array of **numeric user
ids** (`[1928]`), whereas Daily Bruin returns an array of **objects** with `display_name`. A strict
schema rejected every BruinLife post on the first build and the section silently showed "no items".
The shared WordPress schema now accepts `coauthors: unknown[]` and extracts names defensively,
falling back to `_embedded.author` and then BruinLife's own `author_info.display_name`. This is the
concrete reason the project validates permissively and per item.

**Unresolved limitation.** The WooCommerce yearbook storefront is deliberately not surfaced.

---

## 6. UCLA Undergraduate Science Journal — **BLOCKED**

| | |
| --- | --- |
| **Official name verified** | UCLA Undergraduate Science Journal (USJ), a program of the UCLA Undergraduate Research Center–Sciences |
| **Official URL verified** | `https://usjucla.wixsite.com/usj-ucla` |
| **Chosen method** | None available |
| **Status** | Blocked — documented, not silently skipped |

**What was tried.**

- `usj.ucla.edu` — **does not resolve** (DNS failure).
- `uclausj.org` — **does not resolve**.
- The Wix site returns 200 but is a ~620 KB client-rendered app shell. No JSON-LD
  (`application/ld+json`: 0 occurrences), no API, no feed.
- `/read-the-journal` — 200, but only **one** issue PDF URL survives in the server-rendered HTML;
  the rest of the archive is populated by client-side JavaScript.
- Not an OJS install (no `/api/v1/`, no OAI endpoint).
- **eScholarship OAI-PMH tested directly.** `https://escholarship.org/oai?verb=Identify` → 200, valid.
  `?verb=ListSets` → 200 but returns a **single** set, `everything` — eScholarship exposes no
  per-journal set. `?verb=ListRecords&metadataPrefix=oai_dc&set=ucla_usj` → `noRecordsMatch`. USJ is
  not among eScholarship's UCLA journals in any case.
- Issues are distributed as **whole-issue PDFs** with no per-article title/author/abstract index.

**robots.txt.** `User-agent: * / Allow: /` (only `*?lightbox=` disallowed). Crawling is permitted —
the blocker is the absence of structured data, not permission.

**Decision.** The brief allowed clearly-labelled mock data for inaccessible sources. For a
peer-reviewed research journal, inventing issue numbers, article titles and author names would be the
most damaging possible fabrication, so this section instead renders a clear "Integration not
available" state that explains the blocker and links to the journal. The adapter contract
(`JournalIssueProvider`, `JournalIssue`, `normalizeIssue`) is complete; supplying a working provider
turns the section on with no UI changes.

**To complete it,** one of the following must become true: (1) the journal publishes a structured
index — JSON, CSV or RSS; (2) it moves to eScholarship or an OJS install with an OAI endpoint; or
(3) with the journal's permission, a build step extracts per-article metadata from the issue PDFs,
which would add a PDF text-extraction dependency.

---

## 7. UCLA Esports

| | |
| --- | --- |
| **Official URL verified** | `https://uclaclubsports.com/sports/esports` — UCLA Esports operates under UCLA Recreation Club Sports |
| **Chosen method** | Official RSS feed (option b) |
| **Endpoint** | `https://uclaclubsports.com/rss.aspx?path=es` |
| **Update frequency** | Every few months |
| **Attribution** | UCLA Esports / UCLA Recreation Club Sports |
| **Status** | Live at build (news only) |

`esports.ucla.edu` and `uclaesports.com` **do not resolve**. The club sports site runs the legacy
SIDEARM platform and publishes a sport-filtered RSS feed.

**Sharp edge worth recording.** The filter value is the sport *shortname* `es`, not the slug —
`?path=esports` silently returns the **unfiltered** site-wide feed. Verified item fields: `title`,
`link`, `guid`, `category`, `description` (CDATA with a leading `<img>`), `media:thumbnail`,
`media:content`, `enclosure`, `pubDate`.

Official accounts were read from the `window.associated_sport` object embedded in the page
(`twitter: UCLAEsports`, `instagram: uclaesports`) and are linked in the UI.

**robots.txt.** `/rss` is permitted (`/services/` is not, and is not used). The catch-all group sets
`Crawl-delay: 30`; this adapter makes exactly one cached request per build.

**Unresolved limitation — schedules, results, streams.** The brief asked for teams, competitions,
schedules, results and streams. **No official machine-readable source exists.** The sport record is
flagged `"non_sport": true`; `/sports/esports/schedule` redirects to a generic unavailable splash
page and `/sports/esports/roster` returns 404. UCLA Esports is a club-recognized organization and is
not tracked in the athletics scheduling or roster system. Obtaining match data would require direct
Twitch/X API integrations, each with its own authentication — out of scope for a credential-free
static site, and it would not be UCLA-official data. The UI states this and links the official
accounts instead.

---

## 8. UCLA Athletics

| | |
| --- | --- |
| **Investigated** | `https://uclabruins.com/` |
| **Chosen method** | Official JSON API (option a) |
| **Endpoints** | `https://api.uclabruins.com/website-api/articles?include=image,categories,sports&sort=-published_at`<br>`https://api.uclabruins.com/website-api/sports`<br>`https://api.uclabruins.com/website-api/schedule-events?sort=-datetime` |
| **Update frequency** | Multiple times daily in season |
| **Attribution** | UCLA Athletics |
| **Status** | Live at build |

`uclabruins.com` is a modern Nuxt rebuild backed by a public, unauthenticated Laravel API — **not**
the legacy SIDEARM platform. Every legacy endpoint (`/services/adaptive_components.ashx`,
`/services/schedule_xml_2.aspx`, `/api/v2/Rss/`, `/rss.aspx?path=general`) returns 404.

**robots.txt.** Explicit `Allow: /` for every bot, including `ClaudeBot` and `anthropic-ai`.
`api.uclabruins.com/robots.txt` disallows nothing.

**Parameter behaviour, established by testing rather than documentation:**

- `?include=image,categories,sports` hydrates relations. `?with=`, `?expand=` and `?relations=` are
  **silently ignored** — they return 200 with the relations absent.
- `?sort=-published_at` sorts newest-first. `order_by=`, `sort_by=` and `orderBy=` are ignored.
- Articles carry **no body field at all** (verified across several ids and with `?include=content`).
  This suits the project: headline plus `short_description` only.
- `schedule-events` **ignores every filter parameter tried**, including `schedule_id` and six
  date-range spellings — all return the same global feed of 19,153 events with an identical
  `meta.total`. The adapter therefore pages backwards from the far future with `sort=-datetime` and
  windows the results itself; two pages of 100 reach roughly nine months back, covering any current
  season. Sport names come from `/sports`, keyed by `schedule_id`.

Observed rate-limit headers: `x-ratelimit-limit: 160`.

**Unresolved limitations.** This API is undocumented and published for the site's own frontend, not
for third parties — field names may change without notice, so parsing is defensive and per item.
Final scores are not in the feed; completed events link to the official box score
(`box_score_url`). Article images are signed `imgproxy` URLs at a fixed 1980px width whose dimensions
cannot be rewritten without breaking the signature, so no `srcset` is emitted for them.

---

## 9. UCLA Events

| | |
| --- | --- |
| **Investigated** | `calendar.ucla.edu`, `happenings.ucla.edu`, `community.ucla.edu`, `www.ucla.edu/events` |
| **Chosen method** | Official structured data embedded in the page (option c) |
| **Endpoint** | `https://www.ucla.edu/events` |
| **Update frequency** | Weekly, editorially curated |
| **Attribution** | UCLA |
| **Status** | Live at build |

**What was tried.**

- `calendar.ucla.edu` — DNS resolves, but **the server refuses connections** on ports 80 and 443,
  confirmed from two independent network paths (timeout and `ECONNREFUSED`). It could not be
  determined whether it is a Localist install, because it never answered. It appears retired:
  `events.ucla.edu` links its own "Event Calendar" to `community.ucla.edu` instead.
- `happenings.ucla.edu` — redirects to `community.ucla.edu/calendars`, which is the **academic
  quarter calendar**, not an events listing. Wrong source.
- `community.ucla.edu` — works and carries a live campus feed, but has **no JSON API, no ICS feed and
  no JSON-LD**. Event data is only reachable by scraping list-card `data-event-start` attributes and
  then an inline `VEVENT` block embedded in each detail page's "Add to Calendar" `onclick` handler.
  Rejected as substantially more fragile than the chosen source.
- `www.ucla.edu/events` — **chosen.** Embeds a complete `const eventsData = [...]` array with real
  fields: `title`, `field_start_date`, `field_end_date`, `field_location`, `field_image`,
  `field_event_description`, `field_link`, `field_tags`.

**Parsing note.** The payload's string values are HTML-entity encoded. Unescaping before
`JSON.parse` corrupts string boundaries whenever a title contains `&quot;` — a real failure observed
during research. The adapter parses first and decodes entities afterwards.

**robots.txt.** `www.ucla.edu` disallows only `/admission/tuition-and-cost`; `/events` is permitted.

**Unresolved limitation.** This is UCLA's curated highlights list (around 16 items), **not** the
complete campus calendar. The UI says so. A complete calendar would need `calendar.ucla.edu` to
return, or a `community.ucla.edu` scraper accepted as a maintenance burden.

---

## 10. UCLA Public Lectures

| | |
| --- | --- |
| **Chosen method** | Official public RSS feeds (option b) |
| **Sources** | Six verified UCLA centres and institutes — see the table below |
| **Update frequency** | Weekly to monthly, depending on the centre |
| **Status** | Live at build — 171 talks collected |

Separate from the Panopto placeholder in section 11. Everything here is public, unauthenticated and
published by UCLA units themselves. BruinWeb stores metadata and links only: audio and video stay on
each publisher's own host and are never copied, rehosted or re-encoded, and no playback is embedded
because no current source officially supports third-party embedding.

### Sources integrated

| Source | UCLA unit | Endpoint | Format label | Affiliation evidence |
| --- | --- | --- | --- | --- |
| Legacies of Ancient Persia | Pourdavoud Institute for the Study of the Iranian World | `feeds.resonaterecordings.com/legacies-of-ancient-persia` | Lecture | Channel and episode links resolve to `pourdavoud.ucla.edu` |
| The History-Politics Podcast | Luskin Center for History and Policy | `rss.buzzsprout.com/952522.rss` | Podcast | Channel link is `luskincenter.history.ucla.edu` |
| UCLA Housing Voice | Lewis Center for Regional Policy Studies | `rss.buzzsprout.com/1745274.rss` | Podcast | Channel link is `lewis.ucla.edu`; listed in the UCLA College podcast directory |
| Burkle Center for International Relations | Burkle Center | `international.ucla.edu/sites/burkle/rss.aspx` | Panel | Feed served from `international.ucla.edu` |
| Center for European and Russian Studies | CERS | `international.ucla.edu/sites/euro/rss.aspx` | Guest talk | Feed served from `international.ucla.edu` |
| Latin American Institute | LAI | `international.ucla.edu/sites/lai/rss.aspx` | Panel | Feed served from `international.ucla.edu` |

Each entry in `src/lib/config/lecture-sources.ts` records the endpoint, the responsible UCLA unit,
the affiliation evidence, the discovery method, the update frequency and the usage restriction.

**Labelling.** `format` is set per source from what the publisher actually calls the content, so a
research-conversation podcast is never presented as a course lecture. The UI shows that label on
every card and detail page.

**Field notes, established by testing.**

- `itunes:duration` appears in two spellings: whole seconds (Buzzsprout, Resonate) and `HH:MM:SS`
  (the International Institute's ASP.NET feeds). Both are parsed; anything else yields `null` rather
  than a guess.
- Buzzsprout feeds publish **no per-episode `<link>`**. Their enclosure URL is the episode's own page
  with a media extension appended, so the public page is derived by dropping that extension — a
  deterministic transformation of a URL the feed itself publishes, verified to return 200 without a
  login. An item with no usable public page is dropped rather than pointed somewhere approximate.
- Speaker names are read only from an explicit `itunes:author` byline or from the two title shapes
  these feeds actually use ("… with <Name>", "Episode N: Dr. <Name>"). Otherwise `speaker` is `null`;
  BruinWeb does not guess at a person's name.
- Descriptions are stripped to plain text at build time, so no source HTML reaches the DOM.
- `recordedAt` stays `null`: these feeds publish a publication date only, and the two are not the
  same thing.

**Deduplication.** The International Institute cross-lists the same talk on several centre feeds, so
records are deduplicated by canonical URL and by a normalized title + speaker + date key.

**Validation.** All 171 collected URLs were fetched and returned HTTP 200 with no sign-in wall.

**Robots and restrictions.** `international.ucla.edu` disallows crawling `/media`, so the audio files
on that host are never fetched — readers are linked to the publisher's own episode page instead.
`buzzsprout.com/robots.txt` disallows only one unrelated feed.

### Investigated and deliberately excluded

- **Official UCLA YouTube channels** (IPAM, Burkle Center, UCLA Library, School of Law, DGSOM,
  International Institute). These are genuine UCLA channels with real lecture recordings, and the
  per-channel Atom feed at `youtube.com/feeds/videos.xml?channel_id=…` would have been the natural
  surface. **Excluded**: `youtube.com/robots.txt` contains `Disallow: /feeds/videos.xml` for every
  crawler except Google's own, and the endpoint returned 404 to every request made from two
  independent networks, including for a known-good non-UCLA control channel. We do not work around a
  robots.txt directive. The official alternative is the YouTube Data API, which requires an API key —
  that would be a build-time secret (`YOUTUBE_API_KEY`, never `NEXT_PUBLIC_`) plus a new adapter, and
  is the documented route to adding these channels later. The feed also carries no duration field, so
  the API would be needed for that regardless.
- **UCLA Anderson School of Management podcasts** — genuine faculty research talks, but
  `anderson.ucla.edu/robots.txt` disallows automated crawlers by name. Excluded on the publisher's
  stated preference rather than worked around.
- **UCLA BruinCast** — course capture requiring a UCLA login. Out of scope entirely: BruinWeb never
  touches authenticated or enrolment-gated material.
- **UCLA Internal Medicine Grand Rounds** — feed resolves but has published nothing since 2013, and
  its channel link points off the `ucla.edu` domain, so affiliation could not be confirmed.
- **Re:Work (UCLA Labor Center)** — verified UCLA affiliation, but narrative documentary journalism
  rather than lectures. Including it would mislabel the content.
- **Works In Progress (UCLA Arts)** — interview format, and no new episode in roughly two years.
- **Center for Chinese Studies, African Studies Center, Nazarian Center, Center for India and South
  Asia** — real UCLA feeds carrying genuine talks, but dormant (most recent items range from 2009 to
  2024). Each is a one-line addition if dormant content becomes desirable.
- **IPAM, CNSI, UCLA Law, CAP UCLA, UCLA Library** — no public RSS/JSON feed found outside YouTube.

**Freshness.** Lectures refresh on every deploy, like every other source. See the deploy-hook section
of the README for scheduled rebuilds.

---

## 11. UCLA Lectures via Panopto — **PLACEHOLDER TEMPLATE BY DESIGN**

| | |
| --- | --- |
| **Chosen method** | Placeholder template — the real integration was explicitly out of scope |
| **Status** | Placeholder, labelled "Coming Soon" throughout |

Per the brief, the real integration is not built, and it is kept separate from the public lectures in
section 10. The section ships as a reusable visual template with cards for course/lecture title,
instructor, department, date, duration, thumbnail and access status. BruinWeb does not, and will not,
provide access to private course recordings.

**Isolation.** Placeholder rows live in exactly one file, `src/lib/mock/lectures.ts`, and are marked
at the top as not-real. Every generated item carries `dataMode: 'placeholder'`, a "Placeholder" badge
and a section-level "Coming soon — interface template" banner, so nothing can be mistaken for real
UCLA content. Placeholder rows deliberately carry no fabricated deep links.

**Why a real integration cannot be anonymous.** Panopto's REST API requires an OAuth2 client
credential issued by the institution's Panopto administrator, and its useful endpoints return content
scoped to an authenticated viewer. There is nothing a public static site can fetch anonymously.

**To complete it,** see "Replacing the Panopto placeholder" in the README. The environment variables
are `PANOPTO_SITE_HOST`, `PANOPTO_CLIENT_ID`, `PANOPTO_CLIENT_SECRET` — build-time only, never
`NEXT_PUBLIC_`. Until they are set, `isPanoptoConfigured()` returns false and the section reports
itself as unavailable rather than substituting invented data.

---

## Automatic refresh

Retrieval strategy per source, as declared in `src/lib/config/sources.ts`. "Browser" means
the reader's own browser refetches the publisher directly, automatically, whenever the page
is opened — so those sections are current on every visit rather than once per deployment.
Every such endpoint was verified on 2026-09-03 to answer with `access-control-allow-origin`
reflecting the requesting origin, with no credential involved.

The four build-only sources were each checked and cannot be read from a browser:
`dining.ucla.edu`, `uclaclubsports.com`, `www.ucla.edu/events` and
`international.ucla.edu` send no `access-control-allow-origin` header. UCLA Dining has no
JSON API of any kind — its menus are rendered server-side by the Jamix WordPress plugin,
with no client-side call for a browser to imitate — so a scheduled rebuild is the only way
to refresh it without introducing a proxy, which would mean a backend.

| Source | Strategy | Expected | Stale after | Notes |
| --- | --- | --- | --- | --- |
| UCLA Dining | Scheduled rebuild | 30 min | 12 h | No CORS headers and no public API |
| Daily Bruin | Browser + rebuild | 1 h | 6 h | Build is refused by the publisher; browser is not |
| UCLA Radio | Browser + rebuild | 1 h | 3 d | No now-playing API exists |
| UCLA Comms Board | Browser + rebuild | 6 h | 14 d | Governance pages change by term |
| BruinLife | Browser + rebuild | 6 h | 14 d | Posts appear a few times a month |
| Science Journal | Scheduled rebuild | 1 d | 3 d | Checked daily in case an index ever appears |
| UCLA Esports | Scheduled rebuild | 3 h | 90 d | RSS host sends no CORS headers |
| UCLA Athletics | Browser + rebuild | 1 h | 12 h | Busiest source in season |
| UCLA Events | Scheduled rebuild | 6 h | 3 d | Payload is embedded in a page, no CORS |
| Public Lectures | Scheduled rebuild | 1 d | 14 d | Six feeds aggregated and deduplicated |
| Panopto | Never fetched | — | — | Placeholder by design |

**Scheduling.** One GitHub Actions workflow drives every build-time source. It fires every
30 minutes year-round and decides in `America/Los_Angeles` whether to act: every tick
during 06:00–21:59 PT, hourly overnight. That satisfies the tightest requirement (dining,
30 minutes) and comfortably exceeds the rest. The deviations are deliberate and listed in
the README — one shared rebuild costs far less than ten schedules, and Vercel bills build
minutes rather than sources.

**Fallback.** Every build-time source persists a schema-validated artifact under
`.next/cache/`, which Vercel restores between deployments. A failed retrieval replays the
last artifact, labelled as older data and stamped with its real retrieval time — never the
build time. With nothing cached, the section reports itself unavailable. Verified by
pointing three adapters at an unreachable host: the sections kept their content, were
marked `fallback`, and the build stayed green; clearing the artifacts then produced a
correct `unavailable`.

**Reporting.** Every build emits an integration status report to `out/status.json` and
prints it to the build log. Error strings are passed through a redactor before
publication, and the report contains variable *names* only, never values.

## Summary

| Source | Method | Status |
| --- | --- | --- |
| UCLA Dining | Public-page adapter | Live at build |
| Daily Bruin | JSON API → RSS → embedded page data | Live at build |
| UCLA Radio | JSON API | Live at build (no schedule/stream available) |
| UCLA Communications Board | JSON API | Live at build (governance pages only) |
| BruinLife | JSON API | Live at build |
| UCLA Undergraduate Science Journal | — | **Blocked** — no machine-readable source exists |
| UCLA Esports | RSS | Live at build (news only; no schedule/roster/stream exists) |
| UCLA Athletics | JSON API | Live at build (unofficial API; no article bodies or in-line scores) |
| UCLA Events | Embedded structured data | Live at build (curated subset, not the full calendar) |
| UCLA Public Lectures | RSS × 6 verified feeds | Live at build (171 talks) |
| UCLA Lectures via Panopto | Placeholder | **Template only** — by design |

Nine of eleven sources fetch live data at build time. One is blocked with the blocker documented and
the adapter contract in place. One is an intentional placeholder.
