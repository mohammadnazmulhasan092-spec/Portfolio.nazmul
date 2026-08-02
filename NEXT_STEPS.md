# NEXT_STEPS.md

Prioritized roadmap. Nothing here is required to consider the current
handover "done" — see `PROJECT_HANDOVER.md` §7 for what's already
complete. This is what to pick up next, in rough priority order within
each section.

---

## Priority 1 — Security

1. **Move off a single shared admin account.** Both Admin V1 and Admin
   V2 currently authenticate against the same Supabase Auth user(s)
   with no role distinction — anyone who can log in has full write
   access to everything. Fine for a single-owner portfolio; if this
   ever needs multiple editors, add role-checking (e.g. a `profiles`
   table with a `role` column, checked in RLS policies) before opening
   up access. **Still open** — this is an architecture change, not
   something addressed by the hardening pass below.
2. ~~Add rate limiting / CAPTCHA to the login form~~ — **done.** Both
   admins now have client-side exponential-backoff lockout after 3
   failed attempts (persisted via `sessionStorage`). This is a
   mitigation, not a full fix — it stops one browser tab from hammering
   the form, but real rate limiting still depends on Supabase Auth's
   own server-side defaults. A CAPTCHA would need a third-party
   service and hasn't been added.
3. ~~Audit Storage upload validation~~ — **done.** `uploadImage()` now
   validates file type and size before uploading, and the storage
   bucket itself (`SETUP.sql`) enforces matching `allowed_mime_types`/
   `file_size_limit` server-side — that's the real, unbypassable gate.
4. **Review the `SECURITY DEFINER` RPC** (`increment_visitor_count`)
   periodically — reviewed this pass, still sound (tightly scoped,
   no dynamic SQL). Re-check if anything new is ever added to it.
5. **No Content-Security-Policy header exists.** Considered adding one
   during the hardening pass but held off — the app uses inline event
   handler attributes (`onerror=`, `onclick=`) in a few places and
   dynamic esm.sh imports, so a CSP needs to be built and tested
   against a real browser to avoid silently breaking something. Worth
   doing, but as its own dedicated, browser-tested pass.

## Priority 2 — Accessibility

1. **Run a full automated audit** (axe DevTools or Lighthouse) against
   all 4 apps in a real browser — everything below was found and fixed
   via careful static code reading (tracing every focus handler,
   computing contrast ratios by hand from the actual hex values, etc.),
   not by running an automated tool or a real screen reader. That's a
   meaningfully different kind of check and should still happen before
   calling this done.
2. ~~Color contrast check~~ — **checked with real luminance/contrast
   math, not by eye.** Portfolio V2's `--ink-dim` on `--bg`/`--bg-soft`
   actually passes AA comfortably (~7:1, ~6.9:1) — no fix needed there.
   Admin V2 had two real failures, now fixed: the "Published/Live"
   status tag colors (`--ok`/`--danger`, were ~3.3–4.0:1 against their
   soft backgrounds) and `--ink-soft` (4.46:1 on the page background,
   just under the 4.5:1 line). New values are ~5.3–6.5:1.
3. ~~Keyboard navigation pass~~ — **done, and found real gaps beyond
   what this note originally called out:** Admin V2's modal now traps
   focus and closes on Escape (it had neither). Admin V1's entire
   sidebar nav (all 15 sections) was built from click-only `<div>`s —
   completely unreachable by keyboard; now keyboard-operable. Portfolio
   V1 and V2's gallery lightboxes were mouse-only; both are now
   keyboard-operable with focus trapping and focus restored to the
   trigger on close. Portfolio V2 also had zero custom focus-visible
   styling anywhere — added, plus a skip-to-content link.
4. ~~`prefers-reduced-motion` coverage check~~ — **done, and found a
   real bug:** Portfolio V2's cursor-follow "blob" is a
   `requestAnimationFrame` loop, which no CSS media query can stop by
   itself — it was only respecting the admin's manual Style Studio
   toggle, not the OS-level setting at all. Fixed to check
   `matchMedia('(prefers-reduced-motion: reduce)')` directly.
5. **Screen-reader pass** on Portfolio V2's scroll-snap section
   transitions — partially addressed (`tabindex="-1"` added to every
   panel so anchor navigation moves focus correctly instead of
   disorienting jumps, `aria-current` added to the active nav item) but
   not verified with an actual screen reader. Still worth a real pass.

## Priority 3 — Performance

1. ~~Portfolio V1 loads ~41 Google Font families on every page~~ —
   **done, but not the way this note originally suggested.** The full
   list can't just be dropped — any of those ~38 optional families can
   be selected as a site-wide override via the Font Edit picker and
   must render correctly for visitors, not just preview inside admin.
   So: every portfolio-v1 page now loads only the 3 families the design
   always needs; `script.js`'s new `ensureGoogleFont()` fetches the one
   specific family a visitor's site actually has selected, on demand.
   Admin V1 still needs the full list for the picker's live preview,
   so it lazy-loads that full set the first time the Font Edit section
   is opened, not on every admin page load.
2. ~~Lazy-load below-the-fold images~~ — **checked.** `loading="lazy"`
   was already correctly in place on gallery/achievement images.
   Added `fetchPriority="high"` to the above-the-fold logo image in
   both portfolios, which wasn't there before.
3. **Bundle/minify for production** — currently zero build step, which
   is great for simplicity but means no minification, no tree-shaking,
   no cache-busting hashes on `script.js`/`style.css`. Consider a light
   build step (esbuild, no framework needed) purely for production
   asset optimization, keeping the source structure as-is.
4. **Audit realtime subscription count** — Portfolio V2 alone now opens
   ~8 realtime channels (`hero`, `about`, `contact`, `cms_skills`,
   `cms_v2_style`, `cms_v2_sections`, `cms_v2_copy`, plus 3 tables).
   Confirm Supabase's realtime connection limits comfortably cover
   expected concurrent visitor counts; consolidate into fewer, wider
   subscriptions if this ever becomes a bottleneck.
5. **`initShootingStars()`-class effects in V1** (see the audit
   findings from earlier in this project's history) still have some
   redundant re-entrancy risk on rapid navigation — worth a dedicated
   pass if V1 continues receiving investment.

## Priority 4 — SEO

1. **Neither `/index.html` nor `/admin/index.html` router pages, nor
   Portfolio V2, have per-page meta tags beyond a static title/
   description** — Portfolio V1's multi-page structure naturally gives
   each page its own URL and title; Portfolio V2's single-page design
   means all content lives under one URL/title. Consider adding
   per-section `<meta>` updates or structured data (JSON-LD
   `Person`/`CreativeWork`) if V2's single-page approach needs to rank
   for specific section content.
2. **No sitemap.xml or robots.txt** currently exist at the repo root —
   add both once a final domain/hosting choice is made (§ deployment
   in `PROJECT_HANDOVER.md`).
3. **Root routers redirect via JavaScript** (`location.replace`) —
   search engines that don't execute JS may not follow the redirect to
   the active version. Consider a server-side redirect rule (via
   `_redirects`) as a fallback, or pre-render the active version's
   content at the root path.
4. **Open Graph / social preview tags** are absent from every page —
   add `og:title`/`og:description`/`og:image` once real content is
   finalized.

## Priority 5 — Refactoring opportunities

1. **Admin V1's `style.css` is duplicated** into `apps/admin-v1/style.css`
   as a full copy of the portfolio's stylesheet, because `admin.html`
   has no embedded styles of its own and originally lived in the same
   folder as `script.js`/`style.css`. This is presentation duplication
   (not business logic), accepted as pragmatic during the migration —
   but if V1's design system changes, both copies need updating.
   Consider extracting V1's *shared* base tokens (colors, fonts) into a
   small `apps/portfolio-v1/tokens.css` both files `@import`, while
   keeping component-specific rules separate.
2. **Admin V2's CSS is embedded inline** in `admin.html` rather than in
   a separate file — fine at its current size, but if Admin V2 grows
   much further, extract to `apps/admin-v2/style.css` for the same
   reason it was worth doing for Portfolio V2.
3. **`PORTFOLIO_VERSIONS`/`ADMIN_VERSIONS` in `shared/api.js` are the
   single source of truth for known versions** — confirmed this
   session that nothing hardcodes a version path elsewhere. Keep it
   that way: any future V3 should only ever require an edit in this
   one array plus a new `apps/*-v3/` folder.
4. **Consider extracting the Version Management UI into a genuinely
   shared component** — right now Admin V1 and Admin V2 each hand-roll
   their own rendering of the version list (calling the same
   `shared/api.js` functions, different markup). This is intentional
   per the "completely different UI" requirement, so leave it as-is
   unless that requirement changes.

## Remaining feature enhancements (nice-to-have, not required)

- **Style Studio custom color picker** — currently 4 curated presets;
  a free-form hex input for `--amber`/`--violet` would give full parity
  with V1's more granular per-element control, at the cost of V2's
  current "no way to pick a bad combination" guardrail. Discuss with
  the project owner before adding — the constraint may be intentional.
- **Copy Editor coverage expansion** — currently covers each section's
  kicker + heading only; extending to button labels/footer text follows
  the same pattern already established (add an `id`, add a field, add
  it to `SECTION_DEFS`/the read logic).
- **Admin V2 "Overview" stat cards** could add a visual sparkline/trend
  for visitor stats (currently a raw total only) if `getVisitorStats()`
  is extended to return time-series data — that would be a new
  `shared/supabase.js` export, following the additive-only rule.
- **A V3** would follow the exact steps documented in `README.md`'s
  "Adding a future V3" section — no architecture changes needed, the
  system was built to support it.
