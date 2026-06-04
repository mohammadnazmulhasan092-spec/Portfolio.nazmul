/* ============================================
   SUPABASE MODULE — PORTFOLIO
   Vanilla JS, ESM via CDN
   ============================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ============================================
// CONFIG (publishable key — safe to commit)
// ============================================
const SUPABASE_URL = 'https://pbchnkflyrjyvzbunhfb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_eviN5Hr9KEv6cd7ToA5iLQ__xdZHiMb';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'portfolio.auth'
  }
});

export const STORAGE_BUCKET = 'portfolio-images';

// ============================================
// AUTH
// ============================================
export async function loginAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logoutAdmin() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(cb) {
  // Fire once with current state
  supabase.auth.getSession().then(({ data }) => cb(data.session?.user ?? null));
  const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
    cb(session?.user ?? null);
  });
  return () => sub.subscription.unsubscribe();
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ============================================
// SETTINGS (key/value JSONB) — used for hero, about, contact
// ============================================
export async function getSetting(key) {
  const { data, error } = await supabase
    .from('settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function setSetting(key, value) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

/** Subscribe to a single settings row; calls cb(value) on each change. */
export function subscribeSetting(key, cb) {
  // Initial load
  getSetting(key).then(v => cb(v)).catch(() => cb(null));
  const channel = supabase
    .channel(`settings:${key}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'settings', filter: `key=eq.${key}` },
      payload => {
        const row = payload.new || payload.old;
        cb(row?.value ?? null);
      })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ============================================
// GENERIC TABLE HELPERS
// ============================================
export async function listRows(table, { order = 'created_at', ascending = true, filter } = {}) {
  let q = supabase.from(table).select('*').order(order, { ascending });
  if (filter) {
    for (const [col, val] of Object.entries(filter)) q = q.eq(col, val);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function insertRow(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table, id, patch) {
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

/** Realtime subscription to a whole table. cb(rows[]) on every change. */
export function subscribeTable(table, cb, opts = {}) {
  const fetchAndEmit = () => listRows(table, opts).then(cb).catch(() => cb([]));
  fetchAndEmit();
  const channel = supabase
    .channel(`tbl:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchAndEmit())
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ============================================
// STORAGE (image uploads)
// ============================================
export async function uploadImage(file, onProgress) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const path = `gallery/${filename}`;

  // supabase-js v2 doesn't expose upload progress yet; emit synthetic ticks
  if (onProgress) onProgress(10);
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg'
  });
  if (onProgress) onProgress(90);
  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  if (onProgress) onProgress(100);
  return { url: data.publicUrl, path };
}

export async function deleteImage(path) {
  if (!path) return;
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

// ============================================
// VISITOR ANALYTICS
// ============================================
export async function recordVisit() {
  const sessionKey = 'portfolio_visited_' + new Date().toDateString();
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, '1');
  try {
    await supabase.rpc('increment_visitor_count');
  } catch (_) { /* silent */ }
}

export async function getVisitorStats() {
  try {
    const { data, error } = await supabase
      .from('analytics').select('*').eq('id', 'visitors').maybeSingle();
    if (error) throw error;
    return data || { total_visits: 0 };
  } catch {
    return { total_visits: 0 };
  }
}
