# ARCHITECTURE.md

Technical explanation of how the system works, as verified against the
actual code in this repository. For project history and what changed
recently, see `PROJECT_HANDOVER.md`. For what to build next, see
`NEXT_STEPS.md`.

---

## Folder structure

```
/index.html            root portfolio router
/admin/index.html      root admin router
/shared/                supabase.js (data layer) + api.js (version switching)
/apps/portfolio-v1/     original public site (5 pages)
/apps/admin-v1/         original admin dashboard
/apps/portfolio-v2/     new public site (1 page)
/apps/admin-v2/         new admin dashboard
/SETUP.sql              database schema
/_headers, /_redirects  static-host deployment config
```

No build step. Every file is served as-is (ES modules loaded natively
via `<script type="module">` / `import`). The only cross-folder
dependency permitted anywhere in `apps/` is on `shared/` — nothing
under `apps/<name>/` imports from another `apps/<other>/` folder. This
is why `apps/admin-v1/admin-ui.js` exists: it's a small, deliberately
self-contained copy of three presentation helpers (cursor effect,
mobile menu, glitch effect) that also exist in
`apps/portfolio-v1/script.js`. Admin V1 keeps its own copy rather than
importing across the folder boundary — see `admin-ui.js`'s own header
comment. The same reasoning is why `apps/admin-v1/style.css` is a full
duplicate of `apps/portfolio-v1/style.css` rather than an import.
Both are intentional, accepted trade-offs of the "no cross-app
imports" rule, not oversights — see `NEXT_STEPS.md` if either one is
ever worth revisiting.

## Data flow

```
Supabase (Postgres + Auth + Storage + Realtime)
        │
        ▼
shared/supabase.js  ──►  shared/api.js (version switching, built on top)
        │                        │
        ▼                        ▼
 (imported directly by all 4 apps, and by both root routers)
        │
   ┌────┴────┬─────────┬──────────┐
   ▼         ▼         ▼          ▼
portfolio-v1 admin-v1 portfolio-v2 admin-v2
```

Every read is either a one-shot fetch (`getSetting`, `listRows`) or a
realtime subscription (`subscribeSetting`, `subscribeTable`) that opens
a Postgres-changes channel and re-fires the callback on any change —
this is what makes edits in either admin appear on both portfolios (and
the other admin) without a page reload. Every write
(`setSetting`/`insertRow`/`updateRow`/`deleteRow`/`uploadImage`/
`deleteImage`) goes straight to Supabase; there is no client-side cache
layer beyond a few `localStorage` FOUC-prevention snapshots inside
Portfolio V1 (`appearance.cache`, `logo.cache`,
`per_text_styles.cache`) — V2 does not use this pattern (its settings
apply fast enough via the initial realtime fetch that no snapshot has
been needed).

Portfolio V1's script.js also fetches several `cms_*` settings
(theme, visual effects, section visibility, footer/nav copy, and more —
see "Settings key inventory" below) through a small in-file loader
(`loadCmsAll()`) and a live-subscription counterpart (`subscribeCms()`),
both defined in `apps/portfolio-v1/script.js` itself rather than in
`shared/`, because they're specific to V1's own CMS content model (V2
has its own separate, differently-shaped `cms_v2_*` settings instead —
see "Theme / Version system" below).

## The shared layer

Two files, two responsibilities, deliberately kept separate so the
folder doesn't become a dumping ground as it grows:

- **`shared/supabase.js`** (219 lines) — the only file that talks to
  Supabase directly. Client init, auth (`loginAdmin`, `logoutAdmin`,
  `changePassword`, `onAuthChange`), generic key/value settings CRUD
  (`getSetting`/`setSetting`/`subscribeSetting`), generic table CRUD
  (`listRows`/`insertRow`/`updateRow`/`deleteRow`/`subscribeTable`),
  storage upload/delete (`uploadImage`/`deleteImage`, with client-side
  file-type/size validation as a first line of defense — the storage
  bucket's own `allowed_mime_types`/`file_size_limit` in `SETUP.sql`
  is the real, server-side gate), and visitor analytics
  (`recordVisit`/`getVisitorStats`). Every function is generic
  (`table` and `key` are parameters) — nothing in this file knows
  about "hero" or "gallery" specifically.
- **`shared/api.js`** (109 lines) — one piece of actual cross-app
  business logic built on top of the file above: version switching.
  Knows about the concept of "portfolio version" and "admin version,"
  the `active_version` settings row, and how to publish/roll
  back/watch for changes. Nothing else lives here.

Any future shared business logic gets its own new file in `shared/`
(`auth.js`, `utils.js`, etc.) rather than expanding either file above.
Both files are treated as a stable contract: existing exports keep
their exact behavior and signature so V1 can depend on them without
checking which version of `shared/` it's talking to; new capability is
added as a new, additional export.

## Settings key inventory (as actually used in the code)

The `settings` table is a generic `key text primary key, value jsonb`
store — adding a new setting never requires a schema change, only a
new key. As of this release, the keys actually read or written
somewhere in the codebase are:

**Shared between V1 and V2** (both portfolios display it, both admins
edit it, identical shape on both sides):
`hero`, `about`, `contact`, `cms_skills`, `logo`, `site_meta`

- `logo` — `{ url, path }`. `path` is the Storage object path, kept
  alongside `url` so the old file can be deleted on replace/remove.
- `site_meta` — `{ title, favicon_url, favicon_path }`. The newest
  addition. An absent/empty row is a valid, expected state — every
  portfolio page falls back to its own existing hardcoded `<title>`
  until an admin sets one explicitly (see "Site Title & Favicon"
  below for the full mechanism).

**V1-only** (read/written only by Portfolio V1 and Admin V1; V2 never
touches these — this is intentional, see "Theme / Version system"):
`appearance`, `per_text_styles`, `cms_theme`, `cms_visual`,
`cms_sections`, `cms_footer`, `cms_nav_menu`, `cms_hero_extra`,
`cms_islamic`, `cms_live_feed`, `cms_loader_lines`,
`cms_typing_phrases`, `cms_visitor_labels`

**V2-only** (read/written only by Portfolio V2 and Admin V2):
`cms_v2_style`, `cms_v2_sections`, `cms_v2_copy`

**Version switching** (owned by `shared/api.js`, not either app
directly): `active_version`

## Theme / Version system

"Theme" and "Version" are two unrelated concepts that are easy to
conflate, so to be precise:

- **Version** (V1 vs. V2) — which of the two *products* is currently
  published. Global, shared, database-backed (`active_version` in
  `settings`), controlled by `shared/api.js`. Switching it changes
  which app's `index.html`/`admin.html` a visitor is redirected to.
- **Theme** — a presentation detail *within* one product. V1 has its
  own theme system (`cms_theme`: green/blue/red/purple neon variants —
  green is the default with no override class; the other three are
  `body.theme-blue/red/purple` CSS-variable overrides — plus
  `cms_visual`/`appearance`/`per_text_styles` for finer control),
  entirely local to V1; V2 never reads it. V2 has its own, separate
  "Style Studio" (`cms_v2_style`: accent preset + type scale +
  motion), local to V2; V1 never reads it. Neither theme system is
  shared, by design.

## Admin architecture

Both admins follow the same skeleton — login gate via
`onAuthChange()`, then a single dashboard shell that shows/hides named
sections — but implement that skeleton completely differently:

**Admin V1** (`apps/admin-v1/admin.html`, 1,647 lines): a left sidebar
lists every section (`data-section="x"`, made keyboard-operable via
`role="button"`/`tabindex`/Enter+Space handling — it's a `<div>`-based
nav, not native `<button>`s); clicking one shows `#section-x` and
hides the rest. Every section's form is inline and always rendered;
editing a field and clicking that section's Save button writes
immediately. Styling comes from `apps/admin-v1/style.css` (a full
duplicate of V1's design system — `admin.html` itself has no embedded
`<style>`; see "Folder structure" above for why it's a duplicate
rather than an import). Content lists (gallery/achievements/education)
render as a vertical stack with an inline add-form, a
publish/hide toggle per row, and delete — not full inline field
editing of existing rows. Login has client-side exponential-backoff
throttling after 3 failed attempts.

**Admin V2** (`apps/admin-v2/admin.html`, 1,139 lines): a top tab bar
lists every view (`data-view="x"`, real `<button>` elements — natively
keyboard-operable); clicking one shows `#view-x`. Styling is embedded
directly in the file's own `<style>` block (self-contained, no
external stylesheet). Content lists render as a card grid (thumbnail +
tags + actions); adding a new gallery/achievement/education item opens
a shared modal dialog (with focus trapping, Escape-to-close, and focus
restored to the triggering button) rather than an inline form. Some
panels (Style Studio, Sections) save instantly on interaction instead
of requiring an explicit Save button — a deliberately different
workflow, not just a different skin. Login has the same throttling
mitigation as V1.

Both call the exact same `shared/supabase.js` functions for every
operation; only the markup, CSS, and interaction pattern differ.

## Portfolio architecture

**Portfolio V1** (`apps/portfolio-v1/`, `script.js` is 1,360 lines): 5
separate HTML pages (`index.html`, `gallery.html`, `achievements.html`,
`educational.html`, `contact.html`), all importing the same
`script.js` (which registers its own `DOMContentLoaded` listeners and
exports reusable init functions), all styled by the same `style.css`
(4,557 lines). Navigation is plain `<a href="page.html">` between real
pages. Each page's `<title>` carries a `data-page-label` attribute
(e.g. `"GALLERY"`, empty on the home page) so a custom site title from
`site_meta` can be prefixed onto it without collapsing all 5 pages'
distinct, page-specific titles into one flat string.

**Portfolio V2** (`apps/portfolio-v2/`, `script.js` is 343 lines): one
HTML page (`index.html`) with 7 `scroll-snap` sections (Home, Skills,
Work, Achievements, Education, About, Contact), one dedicated
`script.js`, one dedicated `style.css` (310 lines). Navigation is
same-page anchor scrolling, presented through two different nav
*components* depending on viewport: a fixed vertical dot-rail
(desktop) or a fixed bottom tab bar (mobile) — an `IntersectionObserver`
keeps whichever one is visible in sync with scroll position, and marks
the active one with `aria-current="location"` for screen readers. Each
of the 7 sections has `tabindex="-1"` so anchor navigation moves
keyboard/AT focus there directly instead of leaving it stranded. A
skip-to-content link is the first focusable element in the page.

Both read the same underlying shared content settings (`hero`, `about`,
`contact`, `cms_skills`, `logo`, `site_meta`) — the difference is
entirely in how each renders and navigates it, not what data each has
access to.

## Site Title & Favicon

Both portfolios subscribe to the shared `site_meta` setting
(`{ title, favicon_url, favicon_path }`):

- Portfolio V1: `initSiteMeta()` in `script.js`, auto-run on every page
  load (guarded to skip admin pages, same pattern as the other
  site-wide init helpers). Reads the current page's `data-page-label`
  and, only if `site_meta.title` is actually set, composes
  `"{LABEL} — {title}"` (or just `{title}` on the home page, which has
  no label). If `site_meta.title` is unset, the page's existing
  hardcoded `<title>` is left completely untouched — this is what
  makes the feature backward compatible with databases that predate
  it.
- Portfolio V2: a plain `subscribeSetting('site_meta', ...)` call near
  the top of `script.js` — no page-label logic needed since there's
  only one page. Same "leave the default alone if unset" rule.
- Favicon: every page (both portfolios, all 5 V1 pages) has
  `<link rel="icon" id="favicon-link" href="data:," />` in its
  `<head>`. `data:,` is an explicit "no icon" value that stops the
  browser from making a wasted `/favicon.ico` request; both apply
  functions set `href` to `favicon_url` when present and reset it to
  `data:,` on removal.
- Both admins have a "Site title & favicon" control (inside the
  existing Branding section/tab) that calls the exact same
  `getSetting`/`setSetting`/`uploadImage`/`deleteImage` functions the
  Logo control above it already uses — same Storage folder
  (`branding`), same old-file-cleanup-on-replace behavior. No new
  `shared/` code was needed for this feature at all.

## Authentication flow

1. `shared/supabase.js` wraps Supabase Auth (`signInWithPassword`,
   `signOut`, `onAuthStateChange`) — no custom auth logic exists
   anywhere in the project.
2. Both admin apps call `onAuthChange(cb)` once on load; `cb` fires
   immediately with the current session (or `null`) and again on every
   future change.
3. Based on that, each admin shows either its login form or its
   dashboard shell — the exact markup/CSS differs per admin, but the
   underlying check is identical.
4. There is one shared login for both admins (same Supabase Auth
   user(s)) — logging into Admin V1 and Admin V2 uses the same
   credentials, because both are just front-ends over the same
   Supabase Auth. There is no role/permission distinction between
   users yet — anyone who can authenticate has full write access
   everywhere (acceptable for a single-owner portfolio; see
   `NEXT_STEPS.md` if this ever needs multiple editors).
5. Both admin login forms have client-side exponential-backoff
   throttling after 3 failed attempts (persisted via
   `sessionStorage`) — a mitigation on top of, not a replacement for,
   Supabase Auth's own server-side rate limiting.
6. Session persistence uses a custom storage adapter
   (`getSafeStorage()` inside `supabase.js`) that falls back to an
   in-memory store if `localStorage` throws — protects every app that
   imports the file from a Safari-private-mode edge case.

## Routing

There is no client-side router/framework anywhere in this project —
routing is either real multi-page navigation (V1) or same-page anchors
(V2), plus exactly two purpose-built redirect pages:

- `/index.html` — reads `getActiveVersion()` once, redirects to
  `apps/portfolio-v1/index.html` or `apps/portfolio-v2/index.html`.
- `/admin/index.html` — same idea, redirects to
  `apps/admin-v1/admin.html` or `apps/admin-v2/admin.html`, and is
  marked `noindex` (it has a `<meta name="robots" content="noindex">`
  tag) since it's a login-gated dashboard with nothing for a search
  engine to index.

These two files are the only "stable" URLs meant to be bookmarked or
linked externally; everything under `apps/` is an implementation detail
that can be swapped by publishing a different version. Both redirects
are JavaScript-driven (`location.replace`); a crawler that doesn't
execute JS won't follow them — see `NEXT_STEPS.md`'s SEO section.

## Database interaction

All 4 apps talk to the same Supabase project through the same
`shared/supabase.js` client — there is exactly one database connection
pattern in the whole codebase. Reads either go through `getSetting`/
`listRows` (one-shot) or `subscribeSetting`/`subscribeTable` (realtime,
used by everything that needs to stay live). Writes go through
`setSetting`/`insertRow`/`updateRow`/`deleteRow`, each a thin wrapper
over the Supabase JS client with no extra business logic — validation,
if any, happens in the calling app's own code (e.g. Admin V2's modal
checks a required field is filled before calling `insertRow`; both
admins' upload flows rely on `uploadImage`'s own file-type/size
validation).

Every dynamic `import()` call in the codebase (as opposed to a
top-level static `import`) was audited this release — three existed,
all inside `apps/portfolio-v1/script.js`, all now correctly pointing
at `../../shared/supabase.js`. See `PROJECT_HANDOVER.md` for what was
wrong with them before this release and what it affected.

## Version switching flow

```
Admin (V1 or V2) clicks "Publish"
        │
        ▼
publishVersion(id)  [shared/api.js]
        │  reads current active_version, writes
        │  { version:id, previous:<old version>, updated_at:now }
        ▼
settings.active_version row updated in Supabase
        │
        ▼  (Postgres realtime → all open subscriptions fire)
        │
┌───────┴────────────────────────────────────────┐
▼                                                  ▼
Any open Portfolio tab (V1 or V2)          Any open Admin tab (V1 or V2)
watchVersionSwitch('portfolio', myVer)     watchVersionSwitch('admin', myVer)
        │                                                  │
        ▼ if myVer ≠ new active version                    ▼ same check
location.replace(pathForVersion(...))       location.replace(pathForVersion(...))
```

A fresh visit (no tab already open) goes through the root router
instead — same end state, reached by a one-shot `getActiveVersion()`
fetch instead of a live subscription. Rollback (`rollbackVersion()`) is
the same flow in reverse: it reads `previous` off the current row and
swaps it back in, which is why the row keeps both `version` and
`previous` rather than just the current value.
