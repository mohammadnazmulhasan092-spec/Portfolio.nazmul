/* ============================================================
   ADMIN V2 — "MISSION CONTROL"
   Presentation + interaction only. Every data/auth/storage/version
   operation goes through shared/supabase.js or shared/api.js —
   nothing here duplicates business logic, per project rules.
   ============================================================ */
import {
  onAuthChange, loginAdmin, logoutAdmin, changePassword,
  getSetting, setSetting, subscribeSetting,
  listRows, insertRow, updateRow, deleteRow, subscribeTable,
  uploadImage, deleteImage, getVisitorStats,
} from '../../shared/supabase.js';
import {
  PORTFOLIO_VERSIONS, ADMIN_VERSIONS,
  getActiveVersion, publishVersion, rollbackVersion,
  subscribeActiveVersion, watchVersionSwitch,
} from '../../shared/api.js';

watchVersionSwitch('admin', 'v2');

if (new URLSearchParams(location.search).get('preview') === '1') {
  document.getElementById('preview-banner').classList.add('show');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
}
function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('err', isErr);
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ============================================================
   AUTH GATE
   ============================================================ */
const loginScreen = document.getElementById('login-screen');
const shell = document.getElementById('shell');
onAuthChange((user) => {
  if (user) {
    loginScreen.style.display = 'none';
    shell.classList.add('show');
    bootDashboardOnce();
  } else {
    loginScreen.style.display = 'flex';
    shell.classList.remove('show');
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try { await loginAdmin(email, password); }
  catch (err) { errEl.textContent = err.message || 'Login failed.'; }
});

document.getElementById('logout-btn').addEventListener('click', () => logoutAdmin());

/* ============================================================
   RAIL NAVIGATION
   ============================================================ */
document.querySelectorAll('.rail-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rail-btn[data-view]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.view[data-view="${btn.dataset.view}"]`).classList.add('active');
  });
});

/* ============================================================
   BOOT (runs once per authenticated session)
   ============================================================ */
let booted = false;
function bootDashboardOnce() {
  if (booted) return;
  booted = true;
  wireIdentity();
  wireSkills();
  wireContentTable('projects', {
    table: 'gallery',
    listEl: 'projects-list',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'caption', label: 'Description', type: 'textarea' },
      { key: 'tech_tags', label: 'Technologies (comma-separated)', type: 'tags' },
      { key: 'demo_url', label: 'Live demo URL', type: 'text' },
      { key: 'repo_url', label: 'Source (GitHub) URL', type: 'text' },
      { key: 'published', label: 'Published', type: 'checkbox', default: true },
    ],
    imageField: 'image_url', imagePathField: 'storage_path', imageFolder: 'gallery', imageRequired: true,
    titleOf: (r) => r.title || r.caption || 'Untitled project',
    descOf: (r) => (r.tech_tags || []).join(', ') || r.caption || '',
  });
  wireContentTable('achievements', {
    table: 'achievements',
    listEl: 'achievements-list',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'date', label: 'Date', type: 'text' },
      { key: 'published', label: 'Published', type: 'checkbox', default: true },
    ],
    imageField: 'image_url', imagePathField: 'storage_path', imageFolder: 'achievements', imageRequired: false,
    titleOf: (r) => r.title, descOf: (r) => r.date || r.description || '',
  });
  wireContentTable('education', {
    table: 'educational',
    listEl: 'education-list',
    fields: [
      { key: 'cat', label: 'Category', type: 'text' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'year', label: 'Year', type: 'text' },
      { key: 'published', label: 'Published', type: 'checkbox', default: true },
    ],
    imageField: null,
    titleOf: (r) => r.title, descOf: (r) => [r.cat, r.year].filter(Boolean).join(' · ') || r.description || '',
  });
  wireContact();
  wireBranding();
  wirePassword();
  wireVersion();
  wireOverview();
}

/* ============================================================
   IDENTITY (hero + about) — Headquarters
   ============================================================ */
function wireIdentity() {
  getSetting('hero').then(d => {
    d = d || {};
    document.getElementById('hero-name').value = d.name || '';
    document.getElementById('hero-arabic').value = d.arabic || '';
    document.getElementById('hero-btn1-text').value = d.btn1_text || '';
    document.getElementById('hero-btn1-link').value = d.btn1_link || '';
    document.getElementById('hero-btn2-text').value = d.btn2_text || '';
    document.getElementById('hero-btn2-link').value = d.btn2_link || '';
  });
  document.getElementById('form-hero').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await setSetting('hero', {
        name: document.getElementById('hero-name').value.trim(),
        arabic: document.getElementById('hero-arabic').value.trim(),
        btn1_text: document.getElementById('hero-btn1-text').value.trim(),
        btn1_link: document.getElementById('hero-btn1-link').value.trim(),
        btn2_text: document.getElementById('hero-btn2-text').value.trim(),
        btn2_link: document.getElementById('hero-btn2-link').value.trim(),
      });
      toast('Hero saved.');
    } catch (err) { toast(err.message, true); }
  });

  let aboutItems = [];
  function renderAboutItems() {
    const wrap = document.getElementById('about-items-list');
    wrap.innerHTML = aboutItems.map((it, i) => `
      <div class="row2" style="align-items:end;margin-bottom:10px;" data-i="${i}">
        <div class="field"><label>Label</label><input class="ai-label" value="${escapeHtml(it.label || '')}" /></div>
        <div class="field"><label>Text</label><input class="ai-text" value="${escapeHtml(it.text || '')}" /></div>
      </div>`).join('');
  }
  getSetting('about').then(d => {
    d = d || {};
    document.getElementById('about-intro').value = d.intro || '';
    aboutItems = Array.isArray(d.items) ? d.items : [];
    renderAboutItems();
  });
  document.getElementById('add-about-item').addEventListener('click', () => {
    aboutItems.push({ icon: '•', label: '', text: '' });
    renderAboutItems();
  });
  document.getElementById('form-about').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rows = [...document.querySelectorAll('#about-items-list [data-i]')];
    const items = rows.map(r => ({ icon: '•', label: r.querySelector('.ai-label').value.trim(), text: r.querySelector('.ai-text').value.trim() }))
      .filter(it => it.label || it.text);
    try {
      await setSetting('about', { intro: document.getElementById('about-intro').value.trim(), items });
      toast('About saved.');
    } catch (err) { toast(err.message, true); }
  });
}

/* ============================================================
   SKILLS — Technology Campus
   ============================================================ */
function wireSkills() {
  let skills = [];
  subscribeSetting('cms_skills', (v) => {
    skills = Array.isArray(v) ? v : [];
    renderSkills();
  });
  function renderSkills() {
    const wrap = document.getElementById('skills-list');
    if (!skills.length) { wrap.innerHTML = '<p class="empty-note">No skills yet.</p>'; return; }
    wrap.innerHTML = skills.map((s, i) => `
      <div class="list-row">
        <div class="info"><div class="t">${escapeHtml(s.name)}</div><div class="d mono">${s.level != null ? s.level + '%' : ''}</div></div>
        <div class="actions"><button class="btn danger" data-i="${i}">Delete</button></div>
      </div>`).join('');
    wrap.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', async () => {
      const next = skills.filter((_, idx) => idx !== Number(b.dataset.i));
      try { await setSetting('cms_skills', next); toast('Skill removed.'); } catch (err) { toast(err.message, true); }
    }));
  }
  document.getElementById('add-skill-btn').addEventListener('click', async () => {
    const name = document.getElementById('skill-name').value.trim();
    const levelRaw = document.getElementById('skill-level').value;
    if (!name) { toast('Skill name is required.', true); return; }
    const level = levelRaw === '' ? null : clampNum(Number(levelRaw), 0, 100);
    try {
      await setSetting('cms_skills', [...skills, { name, level }]);
      document.getElementById('skill-name').value = '';
      document.getElementById('skill-level').value = '';
      toast('Skill added.');
    } catch (err) { toast(err.message, true); }
  });
}
function clampNum(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ============================================================
   GENERIC CONTENT TABLE (Projects / Achievements / Education)
   Config-driven so the 3 content types share one implementation
   instead of 3 near-duplicate blocks.
   ============================================================ */
function wireContentTable(kind, cfg) {
  let rows = [];
  subscribeTable(cfg.table, (r) => { rows = r; renderList(); }, { order: 'created_at', ascending: true });

  function renderList() {
    const wrap = document.getElementById(cfg.listEl);
    if (!rows.length) { wrap.innerHTML = '<p class="empty-note">Nothing here yet.</p>'; return; }
    wrap.innerHTML = rows.map(r => `
      <div class="list-row ${r.published === false ? 'unpublished' : ''}">
        ${cfg.imageField && r[cfg.imageField] ? `<img src="${escapeHtml(r[cfg.imageField])}" alt="" />` : (cfg.imageField ? '<div class="thumb-fallback">▦</div>' : '')}
        <div class="info">
          <div class="t">${escapeHtml(cfg.titleOf(r))}</div>
          <div class="d">${escapeHtml(cfg.descOf(r))}</div>
        </div>
        <div class="actions">
          <button class="btn ghost" data-edit="${r.id}">Edit</button>
          <button class="btn danger" data-del="${r.id}">Delete</button>
        </div>
      </div>`).join('');
    wrap.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openModal(kind, cfg, rows.find(r => r.id === b.dataset.edit))));
    wrap.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this entry? This cannot be undone.')) return;
      try {
        const row = rows.find(r => r.id === b.dataset.del);
        if (cfg.imageField && row?.[cfg.imagePathField]) await deleteImage(row[cfg.imagePathField]).catch(() => {});
        await deleteRow(cfg.table, b.dataset.del);
        toast('Deleted.');
      } catch (err) { toast(err.message, true); }
    }));
  }

  const btnId = { projects: 'open-project-modal', achievements: 'open-achievement-modal', education: 'open-education-modal' }[kind];
  document.getElementById(btnId)?.addEventListener('click', () => openModal(kind, cfg, null));
}

const modalBackdrop = document.getElementById('modal-backdrop');
const modalBody = document.getElementById('modal-body');
function closeModal() { modalBackdrop.classList.remove('open'); modalBody.innerHTML = ''; }
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

function openModal(kind, cfg, existing) {
  const isEdit = !!existing;
  const fieldsHtml = cfg.fields.map(f => {
    const val = existing ? existing[f.key] : (f.default ?? '');
    if (f.type === 'textarea') return `<div class="field"><label>${f.label}</label><textarea data-k="${f.key}" rows="3">${escapeHtml(val || '')}</textarea></div>`;
    if (f.type === 'checkbox') return `<div class="field"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" data-k="${f.key}" style="width:auto;" ${val ? 'checked' : ''}/> ${f.label}</label></div>`;
    if (f.type === 'tags') return `<div class="field"><label>${f.label}</label><input data-k="${f.key}" value="${escapeHtml((val || []).join(', '))}" /></div>`;
    return `<div class="field"><label>${f.label}</label><input data-k="${f.key}" value="${escapeHtml(val || '')}" ${f.required ? 'required' : ''} /></div>`;
  }).join('');
  const imageHtml = cfg.imageField ? `
    <div class="field"><label>Image${cfg.imageRequired ? '' : ' (optional)'}</label>
      <input type="file" id="modal-image-file" accept="image/jpeg,image/png,image/webp,image/gif" />
      ${existing?.[cfg.imageField] ? `<img src="${escapeHtml(existing[cfg.imageField])}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:6px;margin-top:8px;" />` : ''}
    </div>` : '';

  modalBody.innerHTML = `
    <h3>${isEdit ? 'Edit' : 'Add'} entry</h3>
    ${imageHtml}
    ${fieldsHtml}
    <div class="modal-actions">
      <button class="btn ghost" id="modal-cancel" type="button">Cancel</button>
      <button class="btn" id="modal-save" type="button">${isEdit ? 'Save changes' : 'Add'}</button>
    </div>`;
  modalBackdrop.classList.add('open');
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', async () => {
    const patch = {};
    cfg.fields.forEach(f => {
      const el = modalBody.querySelector(`[data-k="${f.key}"]`);
      if (f.type === 'checkbox') patch[f.key] = el.checked;
      else if (f.type === 'tags') patch[f.key] = el.value.split(',').map(s => s.trim()).filter(Boolean);
      else patch[f.key] = el.value.trim();
    });
    const requiredMissing = cfg.fields.some(f => f.required && !patch[f.key]);
    if (requiredMissing) { toast('Please fill required fields.', true); return; }
    try {
      if (cfg.imageField) {
        const fileInput = document.getElementById('modal-image-file');
        const file = fileInput?.files?.[0];
        if (file) {
          const { url, path } = await uploadImage(file, null, cfg.imageFolder);
          patch[cfg.imageField] = url;
          patch[cfg.imagePathField] = path;
        } else if (!isEdit && cfg.imageRequired) {
          toast('An image is required.', true); return;
        }
      }
      if (isEdit) await updateRow(cfg.table, existing.id, patch);
      else await insertRow(cfg.table, patch);
      toast(isEdit ? 'Updated.' : 'Added.');
      closeModal();
    } catch (err) { toast(err.message, true); }
  });
}

/* ============================================================
   CONTACT — Communication Tower
   ============================================================ */
function wireContact() {
  getSetting('contact').then(d => {
    d = d || {};
    document.getElementById('contact-email').value = d.email || '';
    document.getElementById('contact-github').value = d.github || '';
    document.getElementById('contact-telegram').value = d.telegram || '';
    document.getElementById('contact-whatsapp').value = d.whatsapp || '';
    document.getElementById('contact-facebook').value = d.facebook || '';
  });
  document.getElementById('form-contact').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await setSetting('contact', {
        email: document.getElementById('contact-email').value.trim(),
        github: document.getElementById('contact-github').value.trim(),
        telegram: document.getElementById('contact-telegram').value.trim(),
        whatsapp: document.getElementById('contact-whatsapp').value.trim(),
        facebook: document.getElementById('contact-facebook').value.trim(),
      });
      toast('Contact saved.');
    } catch (err) { toast(err.message, true); }
  });
}

/* ============================================================
   BRANDING (logo + site meta)
   ============================================================ */
function wireBranding() {
  let currentLogo = null;
  subscribeSetting('logo', (d) => {
    currentLogo = d;
    const prev = document.getElementById('logo-preview');
    prev.innerHTML = d?.url ? `<img src="${escapeHtml(d.url)}" alt="Logo" style="height:48px;border-radius:6px;" />` : '<span class="empty-note">No logo set.</span>';
  });
  document.getElementById('upload-logo-btn').addEventListener('click', async () => {
    const file = document.getElementById('logo-file').files?.[0];
    if (!file) { toast('Choose a file first.', true); return; }
    try {
      const { url, path } = await uploadImage(file, null, 'logo');
      await setSetting('logo', { url, path });
      toast('Logo uploaded.');
    } catch (err) { toast(err.message, true); }
  });
  document.getElementById('remove-logo-btn').addEventListener('click', async () => {
    try {
      if (currentLogo?.path) await deleteImage(currentLogo.path).catch(() => {});
      await setSetting('logo', null);
      toast('Logo removed.');
    } catch (err) { toast(err.message, true); }
  });

  getSetting('site_meta').then(d => { document.getElementById('site-title').value = d?.title || ''; });
  document.getElementById('form-site-meta').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const existing = (await getSetting('site_meta')) || {};
      await setSetting('site_meta', { ...existing, title: document.getElementById('site-title').value.trim() });
      toast('Site meta saved.');
    } catch (err) { toast(err.message, true); }
  });
}

/* ============================================================
   PASSWORD
   ============================================================ */
function wirePassword() {
  document.getElementById('form-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('new-password').value;
    try { await changePassword(pw); document.getElementById('new-password').value = ''; toast('Password updated.'); }
    catch (err) { toast(err.message, true); }
  });
}

/* ============================================================
   VERSION MANAGEMENT
   ============================================================ */
function wireVersion() {
  let active = { version: 'v1', previous: 'v1' };
  function render() {
    document.getElementById('portfolio-versions').innerHTML = PORTFOLIO_VERSIONS.map(v => versionCard(v, active.version === v.id, 'portfolio')).join('');
    document.getElementById('admin-versions').innerHTML = ADMIN_VERSIONS.map(v => versionCard(v, active.version === v.id, 'admin')).join('');
    wireVersionButtons();
  }
  function versionCard(v, isLive, kind) {
    return `
      <div class="version-card ${isLive ? 'live' : ''}">
        <div>
          <div class="name">${escapeHtml(v.label)} ${isLive ? '<span class="live-tag">● LIVE</span>' : ''}</div>
          <div class="desc">${escapeHtml(v.description)}</div>
        </div>
        <div class="version-actions">
          <button class="btn ghost" data-preview="${v.path}">Preview</button>
          <button class="btn" data-publish="${v.id}" data-kind="${kind}" ${isLive ? 'disabled' : ''}>Publish</button>
        </div>
      </div>`;
  }
  function wireVersionButtons() {
    document.querySelectorAll('[data-preview]').forEach(b => b.addEventListener('click', () => {
      window.open(b.dataset.preview + '?preview=1', '_blank', 'noopener');
    }));
    document.querySelectorAll('[data-publish]').forEach(b => b.addEventListener('click', async () => {
      try { await publishVersion(b.dataset.publish); toast('Published ' + b.dataset.publish.toUpperCase() + '.'); }
      catch (err) { toast(err.message, true); }
    }));
  }
  getActiveVersion().then(v => { active = v; render(); document.getElementById('stat-version').textContent = v.version.toUpperCase(); });
  subscribeActiveVersion(v => { active = v; render(); document.getElementById('stat-version').textContent = v.version.toUpperCase(); });

  document.getElementById('rollback-btn').addEventListener('click', async () => {
    try { const v = await rollbackVersion(); toast('Rolled back to ' + v.version.toUpperCase() + '.'); }
    catch (err) { toast(err.message, true); }
  });
}

/* ============================================================
   OVERVIEW STATS
   ============================================================ */
function wireOverview() {
  subscribeTable('gallery', rows => { document.getElementById('stat-projects').textContent = rows.filter(r => r.published).length; }, { order: 'created_at' });
  subscribeSetting('cms_skills', v => { document.getElementById('stat-skills').textContent = Array.isArray(v) ? v.length : 0; });
  subscribeTable('educational', rows => { document.getElementById('stat-education').textContent = rows.filter(r => r.published !== false).length; }, { order: 'created_at' });
  subscribeTable('achievements', rows => { document.getElementById('stat-achievements').textContent = rows.filter(r => r.published !== false).length; }, { order: 'created_at' });
  getVisitorStats().then(s => { document.getElementById('stat-visits').textContent = s.total_visits ?? 0; });
}
