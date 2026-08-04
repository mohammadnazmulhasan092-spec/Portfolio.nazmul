# Portfolio — Dual-Application Architecture

> **For a full handover, start with `PROJECT_HANDOVER.md`.** It has
> complete current status, known limitations, and rules for future
> work. `ARCHITECTURE.md` explains how each system works in depth.
> `NEXT_STEPS.md` is the prioritized roadmap. This README is a quick
> orientation only.

Two independent products — **V1** and **V2** — each with its own Portfolio
and Admin app, sharing only the database and a small business-logic layer.
Switching versions flips the public site and the admin dashboard together,
for every visitor, instantly.

## Structure

```
/                       repo root
├── index.html          → root PORTFOLIO router (reads active version, redirects)
├── admin/index.html    → root ADMIN router (reads the SAME active version, redirects)
│
├── shared/              ← the ONLY code shared between V1 and V2
│   ├── supabase.js      low-level client: auth, generic CRUD, realtime, storage
│   └── api.js           higher-level ops built on supabase.js (currently: version switching)
│   (add auth.js / utils.js / etc. here as new shared logic is needed —
│    never grow supabase.js or api.js into a catch-all file)
│
├── apps/
│   ├── portfolio-v1/    original public site — unchanged behavior, unchanged design
│   ├── admin-v1/        original admin dashboard — unchanged behavior, unchanged design
│   ├── portfolio-v2/    new public site — different design system entirely
│   └── admin-v2/        new admin dashboard — different design system entirely
│
├── SETUP.sql             one database schema, shared by every app/version
├── _headers / _redirects deploy config (security headers, root redirect)
└── README.md             this file
```

**The rule that keeps this scalable:** nothing under `apps/` ever imports
from another folder under `apps/`. Every app imports only from `shared/`.
That's what makes V1 and V2 (and any future V3) genuinely independent —
you can delete or rewrite `apps/portfolio-v2/` entirely and nothing in
`apps/portfolio-v1/` even notices.

## How version switching works

- One row in the existing `settings` table, key `active_version`:
  `{ "version": "v1"|"v2", "previous": "v1"|"v2", "updated_at": "..." }`.
  No schema change — it reuses the same key/value table everything else uses.
- `shared/api.js` exports `getActiveVersion()`, `publishVersion(id)`,
  `rollbackVersion()`, and `watchVersionSwitch(kind, myVersion)`.
- **One switch controls both.** There is intentionally no separate
  "admin version" setting — publishing a version changes what visitors see
  *and* what the admin dashboard looks like, together, so they can never
  drift out of sync.
- **Instant, even for open tabs.** Every app (all 4) calls
  `watchVersionSwitch('portfolio'|'admin', 'v1'|'v2')` once on load. If the
  active version changes while someone is already on a page, that page
  redirects itself immediately via the realtime subscription — no manual
  refresh needed.
- **Root routers** (`/index.html`, `/admin/index.html`) are the only entry
  points meant to be linked/bookmarked externally — they always send
  visitors to whichever version is currently published.

## Version Management (in both Admin V1 and Admin V2)

Each admin has its own "Version Management" panel (different UI, same
underlying calls into `shared/api.js`):

- **Show available versions** — lists every known Portfolio and Admin
  version with a "● LIVE" tag on the active one.
- **Preview another version** — opens it directly (`?preview=1`) in a new
  tab without changing what's published; the app shows a small "preview
  mode" banner so it's never confused with the live site.
- **Publish another version** — calls `publishVersion(id)`; takes effect
  everywhere immediately.
- **Roll back** — calls `rollbackVersion()`, reverting to whatever was
  active immediately before the last publish.

## What's complete vs. scaffolded right now

- **Portfolio V1 / Admin V1** — fully migrated, byte-identical behavior to
  the original single-folder project. Only import paths and a handful of
  navigation links changed (they now point through `shared/` and the root
  routers instead of same-folder files).
- **Portfolio V2 — "The Cinematic Future City"** — a full rebuild
  implementing `CINEMATIC-FUTURE-CITY-ARCHITECTURE.md`: a full-bleed
  Three.js scene (no page scroll-snap sections at all) where scrolling
  drives one continuous camera flight — via a `CatmullRomCurve3` with
  smootherstep easing at every zone boundary — down through a procedural
  night-time metropolis: Cloudbank → Descent → Street Level →
  Headquarters → Project Boulevard → Technology Campus → Learning
  Campus → Museum → Communication Tower. Buildings, avenue length, and
  campus size are generated from the real content counts (project count
  drives Boulevard length, education-entry count drives Learning Campus
  length). Content is shown through a "holographic" layer of real HTML
  panels projected from 3D world anchors onto the screen every frame —
  not baked into the 3D scene — so it stays fully readable/accessible
  while still visually "existing" at a location in the world. Ambient
  life (traffic, pedestrian silhouettes, drones, streetlights, fountains,
  swaying trees, cycling billboards, and periodically re-lit building
  windows) runs on its own real-time clock, independent of scroll
  position, per the architecture's "world memory" requirement. A
  reduced-motion mode swaps the sweeping flight for discrete zone-to-zone
  jumps. Reads the exact same `hero` / `about` / `contact` / `cms_skills`
  / `gallery` / `achievements` / `educational` / `logo` data V1 reads —
  the only schema change is 4 new, additive, optional columns on
  `gallery` (`title`, `tech_tags`, `demo_url`, `repo_url`) so each row
  can render as a full project card; V1 never references them and is
  unaffected. Shares no visual or structural code with the previous V2.
- **Admin V2 — "Mission Control"** — a complete, independently-designed
  dashboard built to manage the Cinematic Future City: a left icon-rail
  (not V1's sidebar, not the previous V2's top tab bar) on a dark
  blueprint/schematic backdrop with cyan/amber monospace readouts —
  visually and structurally unrelated to both V1 and the previous V2.
  Sections are named after what they control in the world (Headquarters
  = hero/about, Boulevard = projects, Tech Campus = skills, Learning
  Campus = education, Museum = achievements, Tower = contact), plus
  Overview stats, Branding, Account, and the required Version Management
  panel — all calling the exact same `shared/supabase.js` / `shared/api.js`
  functions Admin V1 uses. Fully functional end to end: every panel reads
  and writes real data, no placeholders.

Both V2 apps import only from `shared/` — neither references anything
inside `apps/portfolio-v1/` or `apps/admin-v1/` (verified).

## Adding a future V3

1. Add `{ id: 'v3', label, description, path }` to `PORTFOLIO_VERSIONS`
   and/or `ADMIN_VERSIONS` in `shared/api.js`.
2. Build `apps/portfolio-v3/` and/or `apps/admin-v3/` from scratch —
   own HTML/CSS/JS, importing only from `shared/`.
3. Call `watchVersionSwitch('portfolio'|'admin', 'v3')` once, same as
   every other version does.
That's the entire integration surface — nothing in `shared/` or in V1/V2
needs to change.
