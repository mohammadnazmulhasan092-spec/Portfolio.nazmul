# ARCHITECTURE.md

Technical explanation of how the system works. For project status and
history, see `PROJECT_HANDOVER.md`. For what to build next, see
`NEXT_STEPS.md`.

---

## Folder structure

```
/index.html            root portfolio router
/admin/index.html      root admin router
/shared/                supabase.js (data layer) + api.js (version switching)
/apps/portfolio-v1/     original public site
/apps/admin-v1/         original admin dashboard
/apps/portfolio-v2/     new public site
/apps/admin-v2/         new admin dashboard
/SETUP.sql              database schema
```

No build step. Every file is served as-is (ES modules loaded natively
via `<script type="module">` / `import`). The only cross-folder
dependency permitted anywhere in `apps/` is on `shared/`.

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

## The shared layer

Two files, two responsibilities, deliberately kept separate so the
folder doesn't become a dumping ground as it grows:

- **`shared/supabase.js`** — the only file that talks to Supabase
  directly. Client init, auth, generic key/value settings CRUD, generic
  table CRUD, realtime subscriptions, storage upload/delete, visitor
  analytics. Every function is generic (`table` and `key` are
  parameters) — nothing in this file knows about "hero" or "gallery"
  specifically.
- **`shared/api.js`** — one piece of actual cross-app business logic
  built on top of the file above: version switching. Knows about the
  concept of "portfolio version" and "admin version," the
  `active_version` settings row, and how to publish/roll back/watch for
  changes. Nothing else lives here (see rule in `PROJECT_HANDOVER.md`
  §13.2 for what goes here vs. a new file).

Any future shared business logic gets its own new file in `shared/`
(`auth.js`, `utils.js`, etc.) rather than expanding either file above.

## Theme / Version system

"Theme" and "Version" are two unrelated concepts that are easy to
conflate, so to be precise:

- **Version** (V1 vs. V2) — which of the two *products* is currently
  published. Global, shared, database-backed (`active_version` in
  `settings`), controlled by `shared/api.js`. Switching it changes
  which app's `index.html`/`admin.html` a visitor is redirected to.
- **Theme** — a presentation detail *within* one product. V1 has its
  own theme system (`cms_theme`: green/blue/red/purple neon variants,
  plus `appearance`/`per_text_styles` for finer control) — entirely
  local to V1, V2 never reads it. V2 has its own, separate "Style
  Studio" (`cms_v2_style`: accent preset + type scale + motion) — local
  to V2, V1 never reads it. Neither theme system is shared, by design
  — see `PROJECT_HANDOVER.md` §5 for the reasoning.

## Admin architecture

Both admins follow the same skeleton — login gate via
`onAuthChange()`, then a single dashboard shell that shows/hides named
sections — but implement that skeleton completely differently:

**Admin V1** (`apps/admin-v1/admin.html`): a left sidebar lists every
section (`data-section="x"`); clicking one shows `#section-x` and hides
the rest. Every section's form is inline and always rendered; editing
a field and clicking that section's Save button writes immediately.
Styling comes from `apps/admin-v1/style.css` (a full copy of V1's
design system — `admin.html` itself has no embedded `<style>`).
Content lists (gallery/achievements/education) render as a vertical
stack of inline-editable rows.

**Admin V2** (`apps/admin-v2/admin.html`): a top tab bar lists every
view (`data-view="x"`); clicking one shows `#view-x`. Styling is
embedded directly in the file's own `<style>` block (self-contained,
no external stylesheet) — a dark glass/aurora theme (animated gradient
backdrop, blurred glass cards, glowing accent) matching Portfolio V2's
new look. Content lists render as a card grid (thumbnail + tags +
actions); adding a new gallery/achievement/education item opens a
shared modal dialog rather than an inline form. Some panels (Style
Studio, Sections) save instantly on interaction instead of requiring
an explicit Save button — a deliberately different workflow, not just
a different skin. Every data/auth/storage/version operation is still
the same `shared/supabase.js` / `shared/api.js` call Admin V1 uses —
only the presentation layer was rebuilt.

Both call the exact same `shared/supabase.js` functions for every
operation; only the markup, CSS, and interaction pattern differ.

## Portfolio architecture

**Portfolio V1** (`apps/portfolio-v1/`): 5 separate HTML pages
(`index.html`, `gallery.html`, `achievements.html`, `educational.html`,
`contact.html`), all importing the same `script.js` (which registers
its own `DOMContentLoaded` listeners and exports reusable init
functions), all styled by the same `style.css`. Navigation is
plain `<a href="page.html">` between real pages.

**Portfolio V2** (`apps/portfolio-v2/`): one HTML page
(`index.html`) with 7 continuously-scrolled sections (Home, Skills,
Work, Achievements, Education, About, Contact), one dedicated
`script.js`, one dedicated `style.css`. A fixed, full-viewport
Three.js canvas (`#bg-canvas`, loaded from CDN) renders a particle
field and a handful of slowly-rotating low-poly shapes behind
everything; the camera moves through one waypoint per section as the
page is scrolled (window scroll progress → lerped camera position +
look-at, plus a small mouse-parallax offset on desktop), which is
where the "3D animated, camera moving" design comes from. Content sits
in glass cards above the scene. Navigation is same-page anchor
scrolling, presented through two different nav *components* depending
on viewport: a fixed vertical dot-rail (desktop) or a fixed bottom tab
bar (mobile) — an `IntersectionObserver` keeps whichever one is
visible in sync with scroll position. `prefers-reduced-motion` and
touch/no-hover devices get a lighter scene (fewer particles/shapes, no
parallax, camera locked to the current waypoint).

Both read the same underlying content (see `PROJECT_HANDOVER.md` §5's
table) — the difference is entirely in how each renders and navigates
it, not what data each has access to.

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
   Supabase Auth.
5. Session persistence uses a custom storage adapter
   (`getSafeStorage()` inside `supabase.js`) that falls back to an
   in-memory store if `localStorage` throws — protects every app that
   imports the file from a Safari-private-mode edge case.

## Routing

There is no client-side router/framework anywhere in this project —
routing is either real multi-page navigation (V1) or same-page anchors
(V2), plus exactly two purpose-built redirect pages:

- `/index.html` — reads `getActiveVersion()` once, redirects to
  `apps/portfolio-v1/index.html` or `apps/portfolio-v2/index.html`.
- `/admin/index.html` — same idea, redirects to `apps/admin-v1/admin.html`
  or `apps/admin-v2/admin.html`.

These two files are the only "stable" URLs meant to be bookmarked or
linked externally; everything under `apps/` is an implementation detail
that can be swapped by publishing a different version.

## Database interaction

All 4 apps talk to the same Supabase project through the same
`shared/supabase.js` client — there is exactly one database connection
pattern in the whole codebase. Reads either go through `getSetting`/
`listRows` (one-shot) or `subscribeSetting`/`subscribeTable` (realtime,
used by everything that needs to stay live). Writes go through
`setSetting`/`insertRow`/`updateRow`/`deleteRow`, each a thin wrapper
over the Supabase JS client with no extra business logic — validation,
if any, happens in the calling app's own code (e.g. Admin V2's modal
checks a required field is filled before calling `insertRow`).

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
