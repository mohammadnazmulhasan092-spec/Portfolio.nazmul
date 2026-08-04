/* ============================================================
   SHARED / api.js
   Higher-level business logic built on top of shared/supabase.js.
   This is where cross-app operations live (currently: version
   switching). Per architecture rule: shared/ is a folder of
   purpose-built modules, not one growing file — supabase.js stays
   the low-level data/auth/storage/realtime layer; this file is for
   logic built ON TOP of it. Add new shared business logic as new
   files here (e.g. auth.js, utils.js) rather than expanding either
   file indefinitely.

   Used by: root routers (/index.html, /admin/index.html), every
   V1/V2 portfolio + admin app, and the Version Management panels
   inside Admin V1 and Admin V2.
   ============================================================ */

import { getSetting, setSetting, subscribeSetting } from './supabase.js';

// ============================================================
// KNOWN VERSIONS
// Single place that maps a version id -> its real deployed path.
// Adding a future V3 means adding one entry here — nothing else
// in this file changes.
// ============================================================
export const PORTFOLIO_VERSIONS = [
  { id: 'v1', label: 'Portfolio V1', description: 'Cyberpunk terminal design — original release.', path: '/apps/portfolio-v1/index.html' },
  { id: 'v2', label: 'Portfolio V2', description: 'Cinematic Future City — scroll-driven 3D flight through a living metropolis.', path: '/apps/portfolio-v2/index.html' }
];

export const ADMIN_VERSIONS = [
  { id: 'v1', label: 'Admin V1', description: 'Original admin dashboard.',       path: '/apps/admin-v1/admin.html' },
  { id: 'v2', label: 'Admin V2', description: 'Mission-control dashboard for the Cinematic Future City.', path: '/apps/admin-v2/admin.html' }
];

function listFor(kind) {
  return kind === 'admin' ? ADMIN_VERSIONS : PORTFOLIO_VERSIONS;
}

export function pathForVersion(kind, versionId) {
  const list = listFor(kind);
  const entry = list.find(v => v.id === versionId) || list[0];
  return entry.path;
}

// ============================================================
// ACTIVE VERSION (single switch — controls BOTH portfolio + admin)
// Stored as one row in the existing `settings` key/value table,
// so no schema/migration is required. Shape:
//   { version: 'v1' | 'v2', previous: 'v1' | 'v2', updated_at: ISOString }
// `previous` is what makes rollback possible.
// ============================================================
const ACTIVE_VERSION_KEY = 'active_version';
const DEFAULT_ACTIVE = Object.freeze({ version: 'v1', previous: 'v1', updated_at: null });

function normalize(v) {
  if (!v || !v.version) return { ...DEFAULT_ACTIVE };
  return { version: v.version, previous: v.previous || v.version, updated_at: v.updated_at || null };
}

/** Current active version (defaults to v1 if never set). */
export async function getActiveVersion() {
  const v = await getSetting(ACTIVE_VERSION_KEY);
  return normalize(v);
}

/** Live updates whenever the active version changes — cb(activeVersionObj). */
export function subscribeActiveVersion(cb) {
  return subscribeSetting(ACTIVE_VERSION_KEY, (v) => cb(normalize(v)));
}

/**
 * Publish a version as active. Remembers the version being replaced
 * so rollbackVersion() can undo this exact change.
 * Note: one switch drives BOTH portfolio and admin together, by
 * design — there is deliberately no separate admin-only switch, so
 * the two products can never drift out of sync.
 */
export async function publishVersion(versionId) {
  const current = await getActiveVersion();
  if (current.version === versionId) return current; // already active — no-op
  const next = { version: versionId, previous: current.version, updated_at: new Date().toISOString() };
  await setSetting(ACTIVE_VERSION_KEY, next);
  return next;
}

/** Revert to whatever version was active immediately before the last publish. */
export async function rollbackVersion() {
  const current = await getActiveVersion();
  if (current.previous === current.version) return current; // nothing to roll back to
  const next = { version: current.previous, previous: current.version, updated_at: new Date().toISOString() };
  await setSetting(ACTIVE_VERSION_KEY, next);
  return next;
}

/**
 * Call once on every V1/V2 portfolio + admin page (kind: 'portfolio'|'admin',
 * myVersion: 'v1'|'v2'). If the DB's active version for `kind` ever stops
 * matching the version currently loaded in this tab, redirect immediately.
 * This is what makes switching "instant" even for tabs left open — the
 * redirect fires the moment the realtime update arrives, no reload needed.
 * Returns an unsubscribe function.
 */
export function watchVersionSwitch(kind, myVersion) {
  return subscribeActiveVersion((active) => {
    if (active.version !== myVersion) {
      window.location.replace(pathForVersion(kind, active.version));
    }
  });
}
