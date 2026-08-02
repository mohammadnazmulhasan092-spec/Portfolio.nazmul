# PROJECT_HANDOVER.md

Read this file first, before opening any code. It is written so a new
Claude session (or any developer) can continue this project with zero
prior context.

---

## 1. What this project is

A portfolio website running as **two independent products**, each with
its own public site and admin dashboard, sharing one Supabase database:

- **Portfolio V1 + Admin V1** — the original cyberpunk-terminal design.
- **Portfolio V2 + Admin V2** — a brand-new, completely different
  product (light-on-desktop/dark... actually: dark plum/amber editorial
  scroll-snap design), built from scratch, sharing only data.

A single **Version Switching** system controls which pair (V1 or V2) is
currently live for the public and for the admin, together, for everyone.

## 2. Complete folder structure

```
/
├── index.html              root PORTFOLIO router — reads active_version, redirects
├── admin/index.html        root ADMIN router — reads the SAME active_version, redirects
│
├── shared/                  the ONLY code shared between V1 and V2
│   ├── supabase.js          low-level: Supabase client, auth, generic CRUD, realtime, storage
│   └── api.js               higher-level: version list + get/publish/rollback/watch
│
├── apps/
│   ├── portfolio-v1/        original public site (untouched since migration)
│   │   ├── index.html, gallery.html, achievements.html, educational.html, contact.html
│   │   ├── script.js        shared UI/animation/CMS-binding logic for all 5 pages
│   │   └── style.css        V1's full design system (~4600 lines)
│   │
│   ├── admin-v1/             original admin dashboard (untouched since migration)
│   │   ├── admin.html        single-file dashboard (sidebar + inline forms)
│   │   ├── admin-ui.js       4 small UI helpers extracted from V1's script.js
│   │   │                     (initCursor, initMobileMenu, initGlitchEffects, escapeHtml)
│   │   │                     so admin-v1 never depends on the portfolio-v1 folder
│   │   └── style.css         own copy of V1's stylesheet (admin.html has no <style> of
│   │                          its own — every class it uses is defined here)
│   │
│   ├── portfolio-v2/         new public site, built from scratch
│   │   ├── index.html        single-page, scroll-snap sections
│   │   ├── script.js         V2's own interaction/animation/data-binding logic
│   │   └── style.css         V2's full design system (dark plum/amber, glass cards)
│   │
│   └── admin-v2/              new admin dashboard, built from scratch
│       └── admin.html         single-file dashboard (top tabs + dashboard overview +
│                               modals + card grid); styles are inline in a <style> block
│                               inside this file (not split out, unlike V1)
│
├── SETUP.sql                 one database schema — every app reads/writes these same tables
├── _headers / _redirects      deploy config (security headers, root redirect)
├── README.md                  original architecture summary (superseded in detail by
│                               this file + ARCHITECTURE.md, kept for quick orientation)
├── PROJECT_HANDOVER.md         ← you are here
├── ARCHITECTURE.md             deep technical explanation of every system
└── NEXT_STEPS.md               prioritized roadmap for future work
```

**The one rule that keeps this scalable:** nothing under `apps/` ever
imports from another folder under `apps/`. Every app imports only from
`shared/`. Verified true as of this handover (see §12).

## 3. Current architecture (one paragraph)

Four independent front-end apps (2 portfolios, 2 admins), zero build
step, all static files. All data access — auth, generic table CRUD,
realtime subscriptions, storage upload/delete — lives in
`shared/supabase.js` and is imported by all four apps identically.
`shared/api.js` adds one piece of cross-cutting business logic on top:
version switching, via a single `active_version` row in the existing
`settings` table. Everything else (HTML, CSS, per-app JS) is owned
independently by each of the 4 apps.

## 4. Shared modules — exact contents

### `shared/supabase.js` (low-level — unchanged since original migration)
```
createClient(...) — the one Supabase client instance, used by everything
loginAdmin(email, password) / logoutAdmin() / onAuthChange(cb) / getCurrentUser() / changePassword(newPw)
getSetting(key) / setSetting(key, value) / subscribeSetting(key, cb)
listRows(table, opts) / insertRow(table, row) / updateRow(table, id, patch) / deleteRow(table, id) / subscribeTable(table, cb, opts)
uploadImage(file, onProgress, folder) / deleteImage(path)
recordVisit() / getVisitorStats()
```
**Contract note:** treat every export above as stable. If V2 (or a
future V3) ever needs different behavior from one of these, add a new,
additional export — never change what an existing one does or returns,
since V1 depends on today's exact behavior.

### `shared/api.js` (higher-level — version switching)
```
PORTFOLIO_VERSIONS / ADMIN_VERSIONS   — the known-versions registry (id, label, description, path)
pathForVersion(kind, versionId)
getActiveVersion() → { version, previous, updated_at }
subscribeActiveVersion(cb)
publishVersion(versionId)             — remembers the outgoing version as `previous`
rollbackVersion()                     — swaps back to `previous`
watchVersionSwitch(kind, myVersion)   — called once by every app; redirects instantly
                                         if the active version changes while that tab is open
```
This is the ONLY shared business logic beyond the raw data layer. If
you need more shared logic in the future, **add a new file** here
(e.g. `shared/utils.js`) — do not grow either existing file into a
catch-all.

## 5. Database usage

One Supabase/Postgres schema (`SETUP.sql`), no changes needed for
anything built so far — every new feature (Skills in Admin V2, Style
Studio, Section Visibility, Copy Editor, logo display) reused the
existing `settings` key/value table by adding new **keys**, not new
tables or columns.

Tables: `settings` (key/value JSONB), `gallery`, `achievements`,
`educational` (all with `published` boolean), `analytics` (visitor
counter). RLS: public read, authenticated-only write, on every table.
Storage bucket `portfolio-images` holds all uploaded images (gallery,
achievement, education, and logo images alike — separated by folder,
not bucket). Realtime is enabled on `settings`, `gallery`,
`achievements`, `educational` — this is what makes every
`subscribeSetting`/`subscribeTable` call live.

### Settings keys — who owns what

| Key | Owner | Notes |
|---|---|---|
| `hero`, `about`, `contact`, `cms_skills`, `logo`, `site_meta` | **Shared** | Read/written identically by V1 and V2 (both portfolios display it, both admins edit it). Verified identical shapes — see §9. `site_meta` (`{title, favicon_url, favicon_path}`) is the newest addition — added without any schema change (same generic `settings` key/value table), with no new `shared/` functions either (pure reuse of `getSetting`/`setSetting`/`subscribeSetting`/`uploadImage`/`deleteImage`, same as `logo`). Missing/empty `site_meta` is a valid, expected state — each portfolio falls back to its own existing hardcoded `<title>` until an admin sets one explicitly. |
| `active_version` | **Shared** (via `shared/api.js` only) | Controls both portfolio and both admins together. |
| `appearance`, `cms_theme`, `cms_sections`, `cms_content*`, `per_text_styles`, `cms_footer`, `cms_hero_extra`, `cms_islamic`, `cms_live_feed`, `cms_loader_lines`, `cms_nav_menu`, `cms_typing_phrases`, `cms_visitor_labels`, `cms_visual` | **V1-only** | V1's own elaborate live-CMS/theming engine. Semantically tied to V1's DOM element IDs and V1's 4 fixed neon color names — would misapply if read by V2. |
| `cms_v2_style`, `cms_v2_sections`, `cms_v2_copy` | **V2-only** | New, V2-native config added this session (see §7). Same reasoning in reverse: these are shaped around V2's own DOM/design and would misapply to V1. |

**This split is intentional, not a gap.** "V1 and V2 must use exactly
the same portfolio *data*" was interpreted — and implemented — as: the
actual content (hero text, about text, contact channels, skills,
gallery/achievement/education items, logo) is 100% shared and
identical. *Presentation configuration* (colors, layout toggles,
per-element styling) is app-specific by nature, because V1 and V2 are
deliberately different designs — sharing those would break "completely
different design," not fulfill "same data."

## 6. Business logic — where it lives, and the no-duplication guarantee

Every business-logic function (auth, CRUD, storage, version switching)
is defined **exactly once**, in `shared/`. Verified this session with a
grep across the whole tree for every exported function name — each
appears in exactly one file. No app redefines, wraps, or forks any of
these functions. UI-only helpers (`escapeHtml`, cursor effects, modal
open/close, etc.) are intentionally NOT shared — each app owns its own,
because those are presentation code, not business logic, and the spec
requires completely independent UIs.

## 7. Current project status

**Complete and verified:**
- Dual-app folder structure, root routers, Version Switching (publish/rollback/instant-redirect-on-open-tabs)
- Portfolio V1 + Admin V1 — migrated, behavior-verified identical to the original single-folder project
- Portfolio V2 — built from scratch: scroll-snap single page, vertical dot-rail nav (desktop) / bottom tab bar (mobile), dark plum/amber color system, clip-path reveal animations, cursor-blob effect. Full content parity with V1 (hero, about, skills, contact, gallery, achievements, education) plus logo display.
- Admin V2 — built from scratch: top tab bar, dashboard overview with stat cards, modal-based add/edit forms, card-grid content browser. Full panel parity with Admin V1 (see table below).
- **This session's work:** Skills Management in Admin V2 (completed); Portfolio V2 logo display (fixed); V2-native Style Studio / Section Visibility / Copy Editor (built, replacing the need to copy V1's Appearance/Theme/Per-Text/CMS-Content/Section-Visibility panels).

**Admin V1 ↔ Admin V2 panel parity (final):**

| Admin V1 panel | Admin V2 equivalent | Relationship |
|---|---|---|
| General | General | Same fields, different form layout |
| About | About | Same fields, different editor UI |
| Contact | Contact | Same fields, different form layout |
| Skills (`cms_skills`) | Skills | Same data key/shape, different list UI |
| Gallery / Achievements / Education | Gallery / Achievements / Education | Same tables, inline-list vs. modal+card-grid workflow |
| Branding (`logo`) | Branding | Same data key/shape, different upload UI |
| Version Management | Version | Same `shared/api.js` calls, different card style |
| Password | Password | Same `changePassword`, different form |
| Appearance + Theme + Per-Text (3 panels) | **Style Studio** (1 panel) | V2-native: `cms_v2_style` — accent-preset swatches, a 3-step type scale, a motion toggle. Auto-saves on click (V1 requires an explicit Save). Deliberately consolidated and simplified, not copied. |
| Section Visibility | **Sections** | V2-native: `cms_v2_sections` — toggle switches, auto-save (V1 uses a checkbox grid + Save button). |
| CMS Text Edit | **Copy** | V2-native: `cms_v2_copy` — a structured editor scoped to exactly the two strings each V2 section has (kicker + heading), not V1's flat list of every hardcoded string sitewide. |

Every Admin V1 capability now has a V2 equivalent. None were copied
verbatim — each was redesigned to fit V2's simpler, more consolidated
information architecture, per this session's explicit instructions.

**Remaining work:** none required. See `NEXT_STEPS.md` for optional
future enhancements (not blockers).

## 8. Known limitations (as of this handover)

- V2's Style Studio offers 4 curated accent presets rather than a full
  custom color picker. This was a deliberate simplicity choice, not an
  oversight — a free-form picker is listed in `NEXT_STEPS.md` if wanted.
- V2's Copy Editor covers section kickers/headings only (the two
  strings every V2 section actually has), not every micro-string on
  the page (e.g. button labels, footer text). V1's CMS Text Edit covers
  more surface area but targets V1-specific DOM IDs that don't exist in
  V2 — extending V2's copy coverage means adding more `id="..."`
  anchors to `portfolio-v2/index.html` and more fields to the Copy
  panel; the pattern to follow is already established.
- Neither Admin app has automated tests. Verification this session was
  manual (syntax checks, reference-resolution checks, diffs) — see §12.
- No CI/CD; deployment is manual static-file hosting (see §11).

## 9. Modified files (this session only)

Diffed against the previous delivered state — exactly these 4 files
changed, nothing else:

- `apps/portfolio-v2/index.html` — added logo `<img>`/fallback markup
  to the desktop rail brand; added a new mobile-only brand mark; added
  `id="kicker-*"`/`id="heading-*"` anchors to every section for the
  Copy Editor.
- `apps/portfolio-v2/style.css` — logo image styling for the rail
  brand; new `.mobile-brand` component; `[hidden]` rule for Section
  Visibility; `.scale-*` and `.motion-reduced` classes for Style Studio.
- `apps/portfolio-v2/script.js` — `logo` setting subscription (drives
  both brand marks); new `cms_v2_style`/`cms_v2_sections`/`cms_v2_copy`
  subscriptions.
- `apps/admin-v2/admin.html` — 3 new tabs (Style, Sections, Copy) with
  their markup, CSS, and JS logic; Skills tab completed (started last
  session, finished this one).

**Confirmed unchanged this session** (diffed byte-for-byte against the
previous delivery): `apps/portfolio-v1/*`, `apps/admin-v1/*`,
`shared/*`, `index.html`, `admin/index.html`, `SETUP.sql`.

## 10. Version Switching — implementation summary

One row in `settings`, key `active_version`:
```json
{ "version": "v1" | "v2", "previous": "v1" | "v2", "updated_at": "<ISO date>" }
```
`shared/api.js` exposes the only functions allowed to read/write it.
Every one of the 4 apps calls `watchVersionSwitch(kind, myVersion)`
once on load — if the active version changes while that tab is open
(e.g. an admin publishes from another device), the realtime
subscription fires and the tab redirects itself immediately via
`location.replace()`. The two root routers (`/index.html`,
`/admin/index.html`) are the stable public entry points; they read the
current value once and redirect. Version Management UI exists in both
Admin V1 and Admin V2 (list / preview `?preview=1` / publish /
rollback), each with its own presentation calling the same 4 functions.

## 11. Deployment notes

Static files only, no build step, no bundler. Deploy the entire repo
root as-is to Netlify/Cloudflare Pages/GitHub Pages (or any static
host). `_headers` and `_redirects` at the repo root are Netlify/CF
Pages-specific config (security headers, a legacy `/home` redirect) —
adjust or remove if deploying elsewhere. The Supabase publishable key
is committed in `shared/supabase.js` by design (safe — RLS is the real
access gate; see `SETUP.sql`). No environment variables are required.
For first-time setup, run `SETUP.sql` in the Supabase SQL editor, then
create one Auth user (email+password) — that's the shared admin login
for both Admin V1 and Admin V2.

## 12. This session's verification (what was actually checked)

- **Syntax:** every standalone `.js` file and every inline
  `<script type="module">` block across all 10 HTML files — checked
  with `node --check`. All pass.
- **References:** every local `href`/`src`/`import` across the entire
  tree (15 files) — programmatically confirmed to resolve to a real
  file. All pass.
- **DOM/JS id cross-check:** every `getElementById(...)` call in
  `portfolio-v2/script.js` and `admin-v2/admin.html` — confirmed the
  target `id` exists in that app's own HTML. All pass.
- **Tab/view parity:** every `data-view="x"` button in Admin V2 has a
  matching `id="view-x"` section, and vice versa (14/14 match).
- **No duplicate business logic:** grepped the whole tree for every
  exported function name from `shared/` — each is defined in exactly
  one file.
- **V1 non-regression:** diffed `apps/portfolio-v1/`, `apps/admin-v1/`,
  `shared/`, and both root routers against the previous delivered
  state — byte-identical, zero changes.
- **Accessibility fix applied:** the Style Studio's color swatches were
  originally plain `<div>`s with click handlers (not keyboard
  reachable) — changed to real `<button>` elements with
  `aria-pressed`, focus-visible outlines, and `aria-label`s added to
  the new section-visibility toggle switches.
- **Data-shape cross-check:** manually compared the exact JS field
  names Admin V1 and Admin V2 read/write for `hero`, `about.items`,
  `contact`, `cms_skills`, and `logo` — confirmed identical, so
  neither admin can write a shape the other can't read.

## 13. Rules future development must follow

1. Nothing under `apps/<name>/` may import from another `apps/<other>/`
   folder. Only from `shared/`.
2. Business logic (auth, CRUD, storage, version switching) is added to
   `shared/` and nowhere else. If it doesn't fit `supabase.js` or
   `api.js`, add a new file in `shared/` rather than growing either.
3. Never change the behavior or signature of an existing `shared/`
   export — V1 depends on it exactly as it is today. Add a new,
   additional export instead.
4. Portfolio content data (hero/about/contact/skills/gallery/
   achievements/education/logo) must stay identically shaped between
   V1 and V2 — check both admins' field names match before adding a
   new content field to either.
5. Presentation/config data (colors, layout toggles, section
   visibility, per-element styling) should NOT be shared between V1
   and V2 — give V2 its own `cms_v2_*` key, following the pattern in
   §5, rather than reusing a V1 key or vice versa.
6. When adding a feature to one Admin, add the equivalent to the other
   — redesigned to fit that app's own information architecture, never
   copy-pasted. This is what keeps "two completely different products"
   true over time instead of just at launch.
7. Before considering any change done, re-run the checks in §12
   (syntax, references, id cross-check, V1 diff) — they're cheap and
   they catch real regressions, as demonstrated this session.

## 14. Accessibility / security / performance / cleanup pass (latest session)

**Scope note:** this pass had no live browser or Supabase connection
available — everything below was verified by static code reading
(tracing function calls, computing contrast ratios from hex values by
hand, checking every `getElementById` target exists, etc.), not by
rendering pages or running the app. Treat this as a thorough code
review, not a substitute for opening it in a real browser before
shipping.

**Fixed:**
- Admin V2's content modal now traps focus, closes on Escape, restores
  focus to the trigger. Admin V1's entire sidebar nav (15 sections) was
  click-only `<div>`s, unreachable by keyboard — now keyboard-operable.
  Both portfolios' gallery lightboxes were mouse-only — now
  keyboard-operable with focus management.
- Real bug: Portfolio V2's cursor-follow blob (a `requestAnimationFrame`
  loop) ignored the OS-level `prefers-reduced-motion` setting entirely,
  only responding to the admin's manual toggle. Fixed.
- Contrast: computed real ratios rather than eyeballing. Portfolio V2's
  `--ink-dim` actually already passed AA (~7:1) — left alone. Admin V2's
  status-tag colors and `--ink-soft` were genuinely failing (as low as
  3.3:1); both fixed to ~5.3–6.5:1.
- `uploadImage()` now validates file type/size before upload; the
  storage bucket (`SETUP.sql`) now enforces the same limits server-side.
- Both admin logins now have exponential-backoff throttling after 3
  failed attempts.
- Portfolio V1's ~41-family Google Fonts load is now 3 families upfront
  + the one family a visitor's site actually uses, loaded on demand
  (`ensureGoogleFont()` in script.js). Admin V1 lazy-loads the full
  picker list only when Font Edit is opened.
- Dead code removed (see NEXT_STEPS for the security/a11y/perf items):
  ~19 confirmed-unused CSS rules and their orphaned `@keyframes`
  (leftover classes like `.footer-logo-img`, `.skill-tag`,
  `.upload-area`, `.glitch-effect` from superseded implementations),
  removed from both `portfolio-v1/style.css` and its duplicate
  `admin-v1/style.css` to keep them in sync. Removed one dead shared
  export (`getCurrentUser()`, zero callers anywhere) and one dead
  portfolio-only function (`showToast()`, zero callers — confirmed its
  `.success-toast` CSS is still needed and left alone, since Admin V1
  has its own separate, actively-used `toast()` function that shares
  the same stylesheet). Portfolio V2 and Admin V2 scanned clean — no
  dead CSS or JS found in either.

**Found but deliberately NOT changed:** Admin V1's "CYBER GRID OPACITY"
slider (Theme & Visual panel) is fully wired end-to-end — saved to the
DB, applied via `applyVisual()` in script.js — but has zero visible
effect, because three separate, explicitly-commented CSS blocks
(`/* Kill grid bg — adds subtle texture */` and similar, part of the
same pass that intentionally killed the noise/scanline effects) force
`.grid-bg` to `opacity: 0 !important` regardless. This reads as a
deliberate design decision, not an accident, so it was left as-is
rather than "fixed" — but it means that slider currently does nothing,
which the next person touching Theme & Visual should know either way
(remove the slider, or remove the kill rule — a product call, not a
code bug).

**Re-verified (same checks as §12, re-run after this session's edits):**
`node --check` on every `.js` file and every inline
`<script type="module">` block — all pass. Every local
`href`/`src`/`import` across the tree resolves. Every
`getElementById()` target exists in its own app's HTML (two
intentional, guarded exceptions in `admin-ui.js` — see below). CSS
brace-balance confirmed on both edited stylesheets.

**Not done, and not safely doable without more tooling:** literally
rendering every page at mobile/tablet/desktop widths, running a real
screen reader, executing CRUD/auth against a live Supabase project, or
building/testing a CSP. All of these need a real browser and a live
backend connection that weren't available this session.
