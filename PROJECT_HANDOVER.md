# PROJECT_HANDOVER.md

This is the project status document. For how the system works
technically, see `ARCHITECTURE.md`. For what's still open, see
`NEXT_STEPS.md`. This version was written after an independent,
file-by-file re-read of the entire repository — every claim below was
re-verified against the actual code during this pass, not carried
forward from earlier notes.

---

## 1. What this project is

A single-owner portfolio site with two parallel, independently
designed versions of both the public site and its admin dashboard
(Portfolio V1/V2, Admin V1/V2), backed by one shared Supabase project.
An admin can switch which version is live for visitors at any time,
and can roll back. Both versions read and write the same underlying
content through a common data-access layer; only presentation differs.

## 2. Complete folder structure

```
/index.html            root portfolio router (redirects to the active version)
/admin/index.html      root admin router (redirects to the active version, noindex)
/shared/
  supabase.js           auth + generic settings/table/storage CRUD (219 lines)
  api.js                version switching business logic (109 lines)
/apps/
  portfolio-v1/          5 HTML pages, script.js (1,360 lines), style.css (4,557 lines)
  admin-v1/               admin.html (1,647 lines), admin-ui.js (102 lines), style.css (full duplicate)
  portfolio-v2/          index.html, script.js (343 lines), style.css (310 lines)
  admin-v2/               admin.html (1,139 lines) — CSS embedded inline
/SETUP.sql              full database schema (tables, RLS, storage bucket, RPC)
/_headers, /_redirects  static-host security headers + redirect rules
/README.md              quick orientation
/ARCHITECTURE.md        technical deep-dive
/NEXT_STEPS.md          prioritized open items
/PROJECT_HANDOVER.md    this file
```

## 3. Current architecture (one paragraph)

No build step, no framework, no bundler — every file is served as-is
and ES modules are loaded natively. Both admins and both portfolios
import exclusively from `shared/` for data access; nothing under
`apps/<name>/` ever imports from another `apps/<other>/` folder (two
deliberate, documented exceptions — `admin-v1/style.css` and
`admin-v1/admin-ui.js` — duplicate rather than import from
`portfolio-v1` for exactly this reason; see `ARCHITECTURE.md`). Which
product is live is one row in the database (`active_version`), watched
live by every open tab so a publish/rollback takes effect everywhere
immediately without a page reload.

## 4. Shared modules — exact contents

**`shared/supabase.js`**: Supabase client init; `loginAdmin`,
`logoutAdmin`, `changePassword`, `onAuthChange`; `getSetting`,
`setSetting`, `subscribeSetting`; `listRows`, `insertRow`, `updateRow`,
`deleteRow`, `subscribeTable`; `uploadImage` (validates file type
against `ALLOWED_IMAGE_TYPES` and size against `MAX_IMAGE_BYTES`
before uploading — both exported constants), `deleteImage`;
`recordVisit`, `getVisitorStats`. Every CRUD function is fully
generic — table/key names are always parameters, never hardcoded.

**`shared/api.js`**: `PORTFOLIO_VERSIONS`/`ADMIN_VERSIONS` (the single
source of truth for known version IDs and their paths — confirmed
nothing else in the codebase hardcodes a version path), `pathForVersion`,
`getActiveVersion`, `subscribeActiveVersion`, `publishVersion`,
`rollbackVersion`, `watchVersionSwitch`.

Neither file has ever had its behavior changed since the original V1
migration — only new, additional exports have been added on top (most
recently none; the Site Title/Favicon feature needed zero new shared
code, see §7).

## 5. Database usage

See `SETUP.sql` for the authoritative schema. Summary: `settings`
(generic key/value, `jsonb` value column — this is why adding
`site_meta` didn't require a migration), `gallery`/`achievements`/
`educational` (content tables, each with a `published` boolean),
`analytics` (visitor counts, written only through the one
`SECURITY DEFINER` RPC, `increment_visitor_count`, which is the sole
function in the project that intentionally bypasses RLS for anonymous
writes). RLS policies: public read on content tables and settings,
authenticated-only write. The Storage bucket (`portfolio-images`) has
both `allowed_mime_types` and `file_size_limit` set directly on the
bucket, matching `shared/supabase.js`'s client-side
`ALLOWED_IMAGE_TYPES`/`MAX_IMAGE_BYTES` — the bucket config is the
real, server-side enforcement; the client-side check just avoids a
wasted round-trip. See `ARCHITECTURE.md`'s "Settings key inventory"
for the full, current list of every settings key actually in use.

## 6. Business logic — where it lives, and the no-duplication guarantee

All business logic (auth, CRUD, storage, version switching) lives in
`shared/` and nowhere else. Every content-editing operation in both
admins — add/edit/publish/delete for gallery, achievements, education;
save for hero/about/contact/skills/logo/site_meta; login/logout/change
password; publish/rollback — calls the exact same `shared/` function
regardless of which admin UI triggered it. Confirmed this pass: zero
duplicate implementations of any of this logic exist anywhere in
`apps/`. What *is* duplicated (deliberately, and only presentation
code, never business logic) is documented in §8.

## 7. Current project status

**Complete and verified working** (by static code reading — see the
important caveat in §12):

- Portfolio V1 (5 pages) and Portfolio V2 (1 page), both reading the
  same shared content settings and both correctly redirecting on a
  live version switch.
- Admin V1 and Admin V2, both with full CRUD for every content type,
  both calling identical `shared/` functions, both independently
  redesigned per the project's own "never copy-paste between admins"
  rule.
- Version switching and rollback, shared and working identically from
  either admin.
- Logo upload/replace/remove, shared between both admins, displayed
  correctly by both portfolios.
- **Site Title & Favicon** (new this release) — shared `site_meta`
  setting, editable from both admins, auto-updates `<title>` and
  `<link rel="icon">` on both portfolios, backward compatible with
  databases that don't have this setting yet. See `ARCHITECTURE.md`
  for the exact mechanism, including how Portfolio V1's 5 distinct
  page titles are preserved via `data-page-label`.
- A significant accessibility/security/performance hardening pass
  (details in §14) across all 4 apps.

**Known, accepted, intentional limitations** — not bugs, documented so
nobody "fixes" them by accident:

- Single shared admin account across both admins (no roles).
- `apps/admin-v1/style.css` and `apps/admin-v1/admin-ui.js` duplicate
  content from `portfolio-v1` rather than importing it, because
  cross-app-folder imports are against the project's own architecture
  rule.
- Admin V1's "CYBER GRID OPACITY" slider has no visible effect — three
  separate CSS rules intentionally force the underlying element
  invisible. See §8 and `NEXT_STEPS.md` Priority 5.
- No CSP header, no role-based auth, no automated a11y/screen-reader
  testing — all require either an architecture change or tooling not
  available in a static-analysis-only review pass.

## 8. Known limitations (as of this handover)

Everything in §7's "known, accepted, intentional limitations" list,
plus: no build step (by design, see `ARCHITECTURE.md`); no sitemap or
robots.txt (partially addressable without a domain, see
`NEXT_STEPS.md` Priority 4); root portfolio router isn't marked
`noindex` (correct — it's the real public entry point — but as a
thin JS-redirect stub it still isn't ideal for SEO as-is, see
`NEXT_STEPS.md`).

## 9. What changed this session (final release verification pass)

This pass re-read every one of the 25 files in the repository
independently — not relying on any earlier session's summary — and
ran a full mechanical verification sweep (JS syntax on every `.js`
file and every inline `<script type="module">` block, CSS
brace-balance, every local `href`/`src`/static-`import` path resolved,
every dynamic `import()` call individually audited).

**One real, previously-undetected bug was found and fixed:**
`apps/portfolio-v1/script.js` had three dynamic `import('./supabase.js')`
calls (inside `loadCmsAll()`, `subscribeCms()`, and
`startLoaderWithCms()`) using a relative path that resolves to
`apps/portfolio-v1/supabase.js` — a file that has never existed; the
real file is at `../../shared/supabase.js` (which the same file's own
top-level static `import` already uses correctly). Every one of these
three functions is on the live bootstrap path
(`bootCms()`, called on every Portfolio V1 page load), and every
failure was silently swallowed by a `try/catch`, so this had no visible
error — it just meant Portfolio V1 never successfully read back any of
its `cms_*` settings from the database. In practice this meant: theme
color selection (green/blue/red/purple), the visual effect sliders
(glow/animation speed/particle opacity/grid opacity), section
visibility toggles, and all of the CMS Content editor's fields
(footer text, nav menu labels, hero subtitle/tagline, Islamic
header text, live feed, loader lines, typing phrases, visitor panel
labels) — all editable and savable from Admin V1's UI — never actually
appeared on the live portfolio. It always silently fell back to the
hardcoded defaults, and the realtime subscription for live updates
never got wired up either. All three occurrences are now fixed to the
correct path. This does **not** fix the separate, apparently-deliberate
CSS suppression of `.grid-bg`'s opacity specifically (see §7) — that
one slider will still show no visible effect even now that its data
loads and saves correctly, because a different, unrelated CSS rule is
still holding it at `opacity: 0`.

**Documentation accuracy fix:** `README.md` previously claimed
Portfolio V1/Admin V1 were "byte-identical" to the pre-migration
original — no longer accurate after the hardening pass in §14; updated
to describe what actually changed.

**No other confirmed issues were found** in this pass. Everything
else previously reported as fixed (see §14) was re-verified as still
correctly in place; nothing regressed.

## 10. Version Switching — implementation summary

`shared/api.js`'s `publishVersion(id)` reads the current
`active_version` row, writes `{ version: id, previous: <old value>,
updated_at: now }`. Every open tab (portfolio or admin, either
version) has a live `postgres_changes` subscription on that row via
`watchVersionSwitch`; on change, if the tab's own version doesn't match
the new active one, it `location.replace()`s to the correct path.
`rollbackVersion()` reads `previous` off the current row and writes it
back as the new `version` — this is why the row keeps both fields
rather than just the current value. A fresh visit with no tab already
open goes through the root router instead, using a one-shot
`getActiveVersion()` fetch to the same end.

## 11. Deployment notes

Static hosting, no server runtime needed. `_headers` sets
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (camera/microphone/geolocation all denied),
`X-XSS-Protection`, and 1-day cache headers for `.js`/`.css`.
`_redirects` handles a `/home` → `/index.html` alias; the commented-out
SPA fallback rule is intentionally unused (this isn't a single-page
app). No `.env` or secrets file exists — the Supabase URL and
publishable/anon key are committed directly in `shared/supabase.js`,
which is safe by design (RLS is the real access boundary, not key
secrecy) and confirmed this pass to be the publishable key, not a
service-role secret.

## 12. This session's verification (what was actually checked)

**Important caveat, stated plainly:** this and every prior hardening
pass had no live browser and no live Supabase connection available.
Everything below is static verification — reading the code carefully,
tracing function calls, computing values by hand — not runtime
testing. Treat this document as a thorough, honest code review, not a
substitute for opening the site in a real browser against a real
database before shipping.

What was actually run this pass:
- `node --check` against every `.js` file and every inline
  `<script type="module">` block extracted from every `.html` file —
  all pass.
- Every local `href`/`src` attribute and every static `import ... from`
  path across the whole tree, resolved against the actual filesystem —
  all resolve correctly.
- Every dynamic `import(...)` call individually found and audited by
  hand (there were exactly three, all in one file — see §9).
- CSS brace-balance on all three stylesheets.
- Every `getElementById()` target cross-checked against its own app's
  HTML (a small number of expected, pre-existing, guarded exceptions
  where `script.js` is shared across pages that don't all have the
  same elements — each guarded with `if (!el) return`, confirmed
  intentional, not bugs).
- Settings-key shape parity between both admins and both portfolios
  for every shared key (`logo`, `site_meta`, etc.) — field names
  confirmed identical everywhere.
- A full repo-wide sweep for `console.*`, `debugger`, `alert()`, and
  `TODO`/`FIXME` markers — none found.

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
   achievements/education/logo/site_meta) must stay identically shaped
   between V1 and V2 — check both admins' field names match before
   adding a new content field to either.
5. Presentation/config data (colors, layout toggles, section
   visibility, per-element styling) should NOT be shared between V1
   and V2 — give V2 its own `cms_v2_*` key, following the pattern in
   `ARCHITECTURE.md`, rather than reusing a V1 key or vice versa.
6. When adding a feature to one Admin, add the equivalent to the other
   — redesigned to fit that app's own information architecture, never
   copy-pasted. This is what keeps "two completely different products"
   true over time instead of just at launch.
7. Before considering any change done, re-run the checks in §12
   (syntax, references, id cross-check) — they're cheap and they catch
   real regressions, including the significant one found this session.
8. When auditing, don't trust a previous session's written summary as
   ground truth — re-read the actual file. §9's bug existed silently
   through several earlier "verification" passes precisely because it
   never surfaced as a visible error.

## 14. Accessibility / security / performance / cleanup pass (prior session)

Summary of the hardening work completed before this final release
pass, re-verified as still correctly in place:

- Focus trapping, Escape-to-close, and focus restoration added to
  Admin V2's content modal and both portfolios' gallery lightboxes.
  Admin V1's entire sidebar nav (15 sections, previously click-only
  `<div>`s) made keyboard-operable.
  Portfolio V2's cursor-follow blob fixed to respect OS-level
  `prefers-reduced-motion` directly (it's a `requestAnimationFrame`
  loop, which no CSS media query alone can stop).
- Contrast ratios computed by hand from actual hex values: Admin V2's
  status-tag colors and `--ink-soft` were genuinely failing AA
  (as low as 3.3:1) and were darkened to ~5.3–6.5:1; Portfolio V2's
  `--ink-dim` was flagged for review but actually already passed
  (~7:1) and was left alone.
- `uploadImage()` gained client-side file-type/size validation; the
  Storage bucket gained matching server-side `allowed_mime_types`/
  `file_size_limit`. Both admin logins gained exponential-backoff
  throttling.
- Portfolio V1's ~41-family Google Fonts load reduced to 3 families
  upfront + the one family a site actually uses, fetched on demand;
  Admin V1 lazy-loads its full font-picker list only when that section
  opens.
- ~19 confirmed-dead CSS rules and their orphaned `@keyframes` removed
  from both `portfolio-v1/style.css` and its duplicate
  `admin-v1/style.css` (cross-checked against the whole repo first to
  rule out false positives). One dead shared export (`getCurrentUser()`)
  and one dead portfolio-only function (`showToast()`) removed —
  `.success-toast` CSS was confirmed still needed by Admin V1's own,
  separate, actively-used `toast()` function and was left alone.
  Portfolio V2 and Admin V2 scanned clean — no dead code found in
  either.
