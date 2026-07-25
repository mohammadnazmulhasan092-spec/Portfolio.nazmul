# NEXT_STEPS.md

Prioritized roadmap as of this release. Nothing here is required to
consider the project production-ready — see `PROJECT_HANDOVER.md` §7
for current status. This is what's still genuinely open, in rough
priority order within each section, written after an independent,
file-by-file re-verification of the whole codebase (not carried over
unchecked from earlier notes).

---

## Priority 1 — Security

1. **Move off a single shared admin account.** Both Admin V1 and Admin
   V2 authenticate against the same Supabase Auth user(s) with no role
   distinction — anyone who can log in has full write access to
   everything. Fine for a single-owner portfolio; if this ever needs
   multiple editors, add role-checking (e.g. a `profiles` table with a
   `role` column, checked in RLS policies) before opening up access.
   This is an architecture change, not something a hardening pass can
   address on its own.
2. **Login throttling is a partial mitigation, not full rate
   limiting.** Both admins lock out after 3 failed attempts with
   exponential backoff, but it's client-side (`sessionStorage`) —
   clearing storage or using a different browser resets it. Real
   protection still depends on Supabase Auth's own server-side
   defaults. A CAPTCHA would need a third-party service and hasn't
   been added.
3. **No Content-Security-Policy header exists.** The app uses inline
   event handler attributes (`onerror=`, `onclick=`) in a few places
   and dynamic esm.sh imports, so a CSP needs to be built and tested
   against a real browser to avoid silently breaking something —
   deliberately not attempted without that.
4. **Review the `SECURITY DEFINER` RPC** (`increment_visitor_count`)
   periodically — currently sound (tightly scoped, no dynamic SQL, no
   parameters). Re-check if anything new is ever added to it.

## Priority 2 — Accessibility

1. **Run a full automated audit** (axe DevTools or Lighthouse) and a
   real screen-reader pass against all 4 apps in an actual browser.
   Everything fixed so far (focus trapping, keyboard operability,
   contrast ratios, `prefers-reduced-motion` coverage) was verified by
   reading the code carefully — tracing focus handlers, computing
   contrast from hex values by hand — not by running an automated tool
   or assistive technology. That's a meaningfully different kind of
   check and should still happen before calling this fully done.
2. **Color contrast** — checked with real luminance/contrast math
   across both admins and both portfolios. Everything currently in the
   codebase passes AA (4.5:1) for normal text at the values checked.
   If new colors are ever introduced, re-verify with a real contrast
   checker rather than by eye.
3. **Keyboard navigation** — Admin V1's `<div>`-based sidebar nav,
   Admin V2's modal, and both portfolios' gallery lightboxes are all
   keyboard-operable with proper focus management. Not yet verified:
   Admin V1's font picker `<select>` preview area and Admin V2's Style
   Studio swatch buttons under an actual screen reader.
4. **`prefers-reduced-motion`** — Portfolio V2's `.reveal` animations,
   `.marquee-track`, and the cursor-follow blob (a
   `requestAnimationFrame` loop, which needed its own explicit
   `matchMedia` check since no CSS media query can stop a JS loop) all
   now respect the OS-level setting independently of the admin's
   Style Studio toggle.

## Priority 3 — Performance

1. **Google Fonts** — Portfolio V1 previously loaded all ~41 font
   families the Font Edit picker can choose from, on every page load.
   It now loads only the 3 families the design always needs, plus the
   one specific family a site's `appearance.font_family` actually
   selects, fetched on demand. Admin V1 lazy-loads the full picker
   list only when the Font Edit section is opened.
2. **Image loading** — `loading="lazy"` was already correctly in place
   on gallery/achievement images; `fetchPriority="high"` has been
   added to the above-the-fold logo image in both portfolios.
3. **Bundle/minify for production** — still zero build step, which
   keeps things simple but means no minification, no tree-shaking, no
   cache-busting hashes on `script.js`/`style.css`. A light build step
   (esbuild, no framework needed) purely for production asset
   optimization — keeping the source structure as-is — is still worth
   considering if load time becomes a real concern.
4. **Audit realtime subscription count** — Portfolio V2 alone opens
   roughly 8 realtime channels. Not re-measured this release; confirm
   Supabase's realtime connection limits comfortably cover expected
   concurrent visitor counts before high-traffic launch.
5. **`initShootingStars()`-class effects in V1** — noted in earlier
   audits as having some redundant re-entrancy risk on rapid
   navigation. Not re-verified this release.

## Priority 4 — SEO

1. **No sitemap.xml or robots.txt exist at the repo root.** A
   domain-agnostic `robots.txt` (disallowing `/admin/`) could be added
   without knowing the final domain; a `sitemap.xml` needs one, so
   that part still waits on a hosting/domain decision.
2. **Root routers redirect via JavaScript** (`location.replace`) and
   `/admin/index.html` is explicitly `noindex` — correct, since it's a
   login-gated dashboard with no content to index. `/index.html`
   (the portfolio root) is currently **not** marked `noindex`, which
   is the right default for the actual public entry point — but since
   it's a thin, content-free redirect stub, search engines that do
   execute JS will index whichever `apps/*/index.html` it redirects
   to (an uglier, non-canonical URL) rather than the clean root URL.
   The standard fix is a server-side redirect rule (via `_redirects`)
   or pre-rendering the active version's content at the root path —
   neither has been done; `_redirects` currently only handles a
   `/home` alias.
3. **Neither router page, nor Portfolio V2, has per-page meta tags**
   beyond a static title/description. Portfolio V1's multi-page
   structure naturally gives each page its own URL, title, and now
   (via `data-page-label` + `site_meta`) a custom title prefix.
   Portfolio V2's single-page design means all content lives under one
   URL/title. Consider per-section `<meta>` updates or structured data
   (JSON-LD `Person`/`CreativeWork`) if V2 ever needs to rank for
   specific section content.
4. **Open Graph / social preview tags are absent from every page** —
   add `og:title`/`og:description`/`og:image` once real content is
   finalized. `site_meta.title` is a natural source for `og:title`
   once this is picked up.

## Priority 5 — Refactoring opportunities

1. **`apps/admin-v1/style.css` is a full duplicate of
   `apps/portfolio-v1/style.css`**, and **`apps/admin-v1/admin-ui.js`**
   duplicates three presentation helpers from
   `apps/portfolio-v1/script.js` (cursor effect, mobile menu, glitch
   effect). Both are deliberate — the project's own rule is that
   nothing under `apps/<name>/` may import from another `apps/<other>/`
   folder, so Admin V1 keeps independent copies rather than reaching
   into Portfolio V1's folder. If V1's design system or these three
   effects ever change, both copies need updating by hand. Consider
   extracting shared *tokens* (not full files) into a small
   `apps/portfolio-v1/tokens.css`/`.js` both sides `@import`/import,
   if this becomes a recurring source of drift — but that would be a
   deliberate architecture change, not a bug fix.
2. **Admin V2's CSS is embedded inline** in `admin.html` rather than a
   separate file — fine at its current size; extract to
   `apps/admin-v2/style.css` if it grows much further.
3. **`PORTFOLIO_VERSIONS`/`ADMIN_VERSIONS` in `shared/api.js`** are
   confirmed still the single source of truth for known versions —
   nothing hardcodes a version path elsewhere. Keep it that way: a
   future V3 should only ever require an edit in this one array plus a
   new `apps/*-v3/` folder.
4. **Admin V1's "CYBER GRID OPACITY" slider (Theme & Visual panel) has
   no visible effect on the live site.** Its data now loads and saves
   correctly (see `PROJECT_HANDOVER.md` for the import-path bug that
   used to prevent even that), but three separate, explicitly-commented
   CSS rules elsewhere in `style.css` (`/* Kill grid bg — adds subtle
   texture */` and similar) force `.grid-bg` to `opacity: 0 !important`
   regardless of what the slider is set to. This reads as a deliberate
   design decision from the same pass that intentionally killed the
   noise/scanline effects, so it hasn't been reversed — but it means
   the slider currently does nothing, which whoever next touches Theme
   & Visual should resolve one way or the other (remove the slider, or
   remove the kill rule).

## Remaining feature enhancements (nice-to-have, not required)

- **Style Studio custom color picker** — currently 4 curated presets;
  a free-form hex input for `--amber`/`--violet` would give full
  parity with V1's more granular per-element control, at the cost of
  V2's current "no way to pick a bad combination" guardrail. Discuss
  with the project owner before adding — the constraint may be
  intentional.
- **Copy Editor coverage expansion** — currently covers each section's
  kicker + heading only; extending to button labels/footer text
  follows the same pattern already established.
- **Admin V2 "Overview" stat cards** could add a visual sparkline for
  visitor stats (currently a raw total only) if `getVisitorStats()` is
  extended to return time-series data.
- **Open Graph image / favicon-as-social-preview** — now that
  `site_meta.favicon_url` exists, a natural follow-up is reusing it (or
  a separate, larger image) as the `og:image` once Open Graph tags are
  added (see Priority 4).
- **A V3** would follow the exact steps documented in `README.md`'s
  "Adding a future V3" section — no architecture changes needed, the
  system was built to support it.
