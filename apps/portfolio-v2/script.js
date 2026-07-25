/* ============================================================
   PORTFOLIO V2 — script
   Presentation + interaction only. All data comes from the SAME
   shared modules Portfolio V1 uses (shared/supabase.js, shared/
   api.js) — no business logic is duplicated here. Everything below
   (cursor blob, scroll-snap progress, reveal-on-scroll, rail/tabbar
   sync) is a completely separate animation/interaction system from
   V1's script.js (cursor trail, glitch FX, matrix rain, etc.).
   ============================================================ */

import { subscribeSetting, subscribeTable } from '../../shared/supabase.js';
import { watchVersionSwitch } from '../../shared/api.js';

watchVersionSwitch('portfolio', 'v2');

if (new URLSearchParams(location.search).get('preview') === '1') {
  const b = document.getElementById('preview-banner');
  b.classList.add('show');
  b.textContent = 'PREVIEW MODE — Portfolio V2 is not the published version. Visitors are not seeing this.';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

/* ============================================================
   V2-NATIVE STYLE STUDIO / SECTION VISIBILITY / COPY EDITOR
   These are NOT V1's settings reused — V1's cms_theme/appearance/
   per_text_styles/cms_sections/cms_content are V1-specific (V1's own
   4 neon color names, and DOM element IDs that don't exist in V2's
   markup). Reusing them here would misapply V1 presentation config
   to a different design system, not "share data" correctly. These
   are new, V2-owned config keys — same shared getSetting/setSetting/
   subscribeSetting functions, zero new business logic, and zero
   overlap with the actual PORTFOLIO CONTENT keys (hero/about/contact/
   cms_skills/gallery/achievements/educational), which stay fully
   shared with V1 as-is.
   ============================================================ */

const ACCENT_PRESETS = {
  sunset: { a: '#ff8a5c', b: '#8b6bff' },
  ocean:  { a: '#2dd4bf', b: '#3b82f6' },
  forest: { a: '#84cc16', b: '#059669' },
  rose:   { a: '#fb7185', b: '#d946ef' },
};

subscribeSetting('cms_v2_style', (v) => {
  const s = v || {};
  const preset = ACCENT_PRESETS[s.preset] || ACCENT_PRESETS.sunset;
  document.documentElement.style.setProperty('--amber', preset.a);
  document.documentElement.style.setProperty('--violet', preset.b);

  document.body.classList.remove('scale-compact', 'scale-spacious');
  if (s.scale === 'compact' || s.scale === 'spacious') document.body.classList.add('scale-' + s.scale);

  document.body.classList.toggle('motion-reduced', s.motion === 'reduced');
});

const SECTION_IDS = ['skills', 'work', 'achievements', 'education', 'about', 'contact'];
subscribeSetting('cms_v2_sections', (v) => {
  const hidden = v || {};
  SECTION_IDS.forEach(id => {
    const isHidden = hidden[id] === false; // stored as visible:true/false per section
    const section = document.getElementById(id);
    if (section) section.hidden = isHidden;
    document.querySelectorAll(`[data-target="${id}"]`).forEach(nav => {
      nav.style.display = isHidden ? 'none' : '';
    });
  });
});

subscribeSetting('cms_v2_copy', (v) => {
  const copy = v || {};
  SECTION_IDS.forEach(id => {
    const entry = copy[id];
    if (!entry) return;
    const k = document.getElementById('kicker-' + id);
    const h = document.getElementById('heading-' + id);
    if (entry.kicker && k) k.textContent = entry.kicker;
    if (entry.heading && h) h.textContent = entry.heading;
  });
});

/* ============================================================
   Cursor-follow gradient blob (desktop only)
   ============================================================ */
(function initBlob() {
  const blob = document.getElementById('blob');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // This is a rAF loop, not a CSS animation — no media query can stop it by
  // itself, so the OS-level setting has to be checked here directly (the
  // Style Studio's own "Reduced motion" toggle is separate and additive;
  // either one should be enough to disable this).
  if (!blob || window.matchMedia('(hover: none)').matches || reduceMotion.matches) return;
  let x = window.innerWidth / 2, y = window.innerHeight / 2, tx = x, ty = y;
  window.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
  (function loop() {
    x += (tx - x) * 0.08; y += (ty - y) * 0.08;
    blob.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  })();
})();

/* ============================================================
   Scroll-snap progress bar + active-section sync for both the
   desktop rail and the mobile tab bar
   ============================================================ */
(function initScrollSystem() {
  const scroller = document.getElementById('scroller');
  const bar = document.getElementById('progress-bar');
  const panels = Array.from(document.querySelectorAll('.panel'));
  const railDots = Array.from(document.querySelectorAll('.rail-dot'));
  const tabs = Array.from(document.querySelectorAll('.tab'));

  function setActive(id) {
    [...railDots, ...tabs].forEach(nav => {
      const isActive = nav.dataset.target === id;
      nav.classList.toggle('active', isActive);
      if (isActive) nav.setAttribute('aria-current', 'location');
      else nav.removeAttribute('aria-current');
    });
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        setActive(entry.target.id);
      }
      const reveals = entry.target.querySelectorAll('.reveal');
      if (entry.isIntersecting) {
        reveals.forEach((el, i) => setTimeout(() => el.classList.add('in'), i * 90));
      }
    });
  }, { threshold: [0.5] });
  panels.forEach(p => io.observe(p));

  // Reveal hero immediately (it's visible on load, before any scroll)
  document.querySelectorAll('#home .reveal').forEach((el, i) => setTimeout(() => el.classList.add('in'), i * 90));

  function updateProgress() {
    const max = scroller.scrollHeight - scroller.clientHeight;
    const pct = max > 0 ? scroller.scrollTop / max : 0;
    bar.style.transform = `scaleX(${pct})`;
  }
  scroller.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('scroll', updateProgress, { passive: true }); // mobile: body scrolls, not #scroller
  updateProgress();
})();

/* ============================================================
   Lightbox for the Work (gallery) grid
   ============================================================ */
let lbTriggerEl = null;
function closeLightbox() {
  const lb = document.querySelector('.lb');
  if (!lb) return;
  lb.classList.remove('open');
  if (lbTriggerEl && document.contains(lbTriggerEl)) lbTriggerEl.focus();
  lbTriggerEl = null;
}
function ensureLightbox() {
  let lb = document.querySelector('.lb');
  if (lb) return lb;
  lb = document.createElement('div');
  lb.className = 'lb';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Image preview');
  lb.innerHTML = `<button class="lb-close" aria-label="Close">×</button><img alt="" />`;
  document.body.appendChild(lb);
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb-close')) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') { closeLightbox(); return; }
    // Only two focusable elements ever exist here (close button, image
    // isn't focusable) — a full trap just keeps Tab cycling on the close button.
    if (e.key === 'Tab') { e.preventDefault(); lb.querySelector('.lb-close').focus(); }
  });
  return lb;
}
function openLightbox(src, caption, triggerEl) {
  const lb = ensureLightbox();
  lb.querySelector('img').src = src;
  lb.querySelector('img').alt = caption || '';
  lb.classList.add('open');
  lbTriggerEl = triggerEl || document.activeElement;
  requestAnimationFrame(() => lb.querySelector('.lb-close').focus());
}

/* ============================================================
   DATA — hero / about / skills / contact (shared with V1)
   ============================================================ */
const HERO_DEFAULTS = { name: 'Your Name', arabic: '', btn1_text: 'Resume', btn1_link: '#', btn2_text: 'GitHub', btn2_link: 'https://github.com' };
subscribeSetting('hero', (d) => {
  d = { ...HERO_DEFAULTS, ...(d || {}) };
  document.getElementById('hero-name').textContent = d.name;
  document.getElementById('rail-brand-fallback').textContent = (d.name || 'P').charAt(0);
  document.getElementById('mobile-brand-fallback').textContent = (d.name || 'P').charAt(0);
  document.getElementById('hero-arabic').textContent = d.arabic || '';
  document.getElementById('hero-actions').innerHTML = `
    <a class="btn btn-primary" href="${escapeHtml(d.btn1_link)}">${escapeHtml(d.btn1_text)}</a>
    <a class="btn btn-ghost" href="${escapeHtml(d.btn2_link)}" target="_blank" rel="noopener">${escapeHtml(d.btn2_text)}</a>
  `;
});

// Same `logo` setting Admin V1 and Admin V2's Branding tab both write to —
// shows the uploaded logo image in place of the initial, on both the
// desktop rail and the mobile brand mark. Falls back to the hero-name
// initial (set above) whenever no logo has been uploaded.
subscribeSetting('logo', (d) => {
  const url = d && d.url;
  for (const prefix of ['rail-brand', 'mobile-brand']) {
    const img = document.getElementById(prefix + '-img');
    const fallback = document.getElementById(prefix + '-fallback');
    if (!img || !fallback) continue;
    if (url) {
      img.fetchPriority = 'high';
      img.src = url;
      img.style.display = 'block';
      fallback.style.display = 'none';
    } else {
      img.style.display = 'none';
      fallback.style.display = 'block';
    }
  }
});

// Same `site_meta` setting Admin V1 and Admin V2 both write to — updates
// the browser tab title and icon. No stored title yet → leaves this page's
// existing default <title> untouched (backward compatible for databases
// that predate this setting).
subscribeSetting('site_meta', (d) => {
  d = d || {};
  if (d.title) document.title = d.title;
  const favicon = document.getElementById('favicon-link');
  if (favicon) favicon.setAttribute('href', d.favicon_url || 'data:,');
});

subscribeSetting('about', (d) => {
  d = d || {};
  document.getElementById('about-intro').textContent = d.intro || 'A short introduction goes here.';
  document.getElementById('about-items').innerHTML = (d.items || []).map(it => `
    <div class="about-card">
      <div class="about-icon">${escapeHtml(it.icon || '•')}</div>
      <div class="about-label">${escapeHtml(it.label || '')}</div>
      <div class="about-text">${escapeHtml(it.text || '')}</div>
    </div>
  `).join('');
});

subscribeSetting('cms_skills', (v) => {
  const skills = Array.isArray(v) && v.length ? v : [];
  const grid = document.getElementById('skills-grid');
  grid.innerHTML = skills.map(s => `
    <div>
      <div class="skill-row-top"><span>${escapeHtml(s.name)}</span><span>${escapeHtml(String(s.level ?? ''))}%</span></div>
      <div class="skill-track"><div class="skill-fill" style="width:${Math.max(0, Math.min(100, Number(s.level) || 0))}%;"></div></div>
    </div>
  `).join('');
  // marquee ticker reuses the same skill names, doubled for seamless loop
  const names = skills.map(s => s.name).filter(Boolean);
  const track = document.getElementById('marquee-track');
  if (track && names.length) {
    const text = names.map(n => `✦ ${escapeHtml(n)}`).join('   ');
    track.innerHTML = text + '   ' + text;
  }
});

subscribeSetting('contact', (d) => {
  d = d || {};
  const whatsappLink = d.whatsapp ? 'https://wa.me/' + d.whatsapp.replace(/[^0-9]/g, '') : null;
  const rows = [
    ['Email', d.email, d.email ? 'mailto:' + d.email : null],
    ['GitHub', d.github, d.github],
    ['Telegram', d.telegram, d.telegram],
    ['WhatsApp', d.whatsapp, whatsappLink],
    ['Facebook', d.facebook, d.facebook],
  ].filter(r => r[1] && r[2]);
  document.getElementById('contact-orbit').innerHTML = rows.map(([label, value, link]) => `
    <a class="contact-pill" href="${escapeHtml(link)}" target="_blank" rel="noopener">
      <span class="label">${label}</span>
      <span class="value">${escapeHtml(value)}</span>
    </a>
  `).join('');
});

/* ============================================================
   DATA — gallery / achievements / educational (feature parity
   with V1's separate pages, rendered here as sections instead)
   ============================================================ */
subscribeTable('gallery', (items) => {
  const published = items.filter(i => i.published);
  const grid = document.getElementById('work-grid');
  if (!published.length) { grid.innerHTML = '<p class="empty-note">No work published yet.</p>'; return; }
  grid.innerHTML = published.map(img => `
    <div class="work-card" role="button" tabindex="0" aria-label="${escapeHtml(img.caption ? 'View image: ' + img.caption : 'View image')}" data-src="${escapeHtml(img.image_url)}" data-caption="${escapeHtml(img.caption || '')}">
      <img src="${escapeHtml(img.image_url)}" alt="${escapeHtml(img.caption || '')}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.parentElement.style.display='none'" />
      ${img.caption ? `<div class="work-caption">${escapeHtml(img.caption)}</div>` : ''}
    </div>
  `).join('');
  grid.querySelectorAll('.work-card').forEach(card => {
    card.addEventListener('click', () => openLightbox(card.dataset.src, card.dataset.caption, card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(card.dataset.src, card.dataset.caption, card); }
    });
  });
}, { order: 'created_at', ascending: false });

subscribeTable('achievements', (items) => {
  const published = items.filter(a => a.published !== false);
  const list = document.getElementById('ach-list');
  if (!published.length) { list.innerHTML = '<p class="empty-note">No achievements logged yet.</p>'; return; }
  list.innerHTML = published.map(a => `
    <div class="ach-row">
      ${a.image_url
        ? `<img class="ach-thumb" src="${escapeHtml(a.image_url)}" alt="" loading="lazy" />`
        : `<div class="ach-thumb-fallback">🏆</div>`}
      <div>
        <div class="ach-title">${escapeHtml(a.title)}</div>
        ${a.description ? `<div class="ach-desc">${escapeHtml(a.description)}</div>` : ''}
        ${a.date ? `<div class="ach-date">${escapeHtml(a.date)}</div>` : ''}
      </div>
    </div>
  `).join('');
}, { order: 'created_at', ascending: true });

subscribeTable('educational', (items) => {
  const published = items.filter(e => e.published !== false);
  const rows = document.getElementById('edu-rows');
  if (!published.length) { rows.innerHTML = '<p class="empty-note">No entries yet.</p>'; return; }
  rows.innerHTML = published.map(e => `
    <div class="edu-row">
      <div class="edu-year">${escapeHtml(e.year || '')}</div>
      <div>
        <div class="edu-cat">${escapeHtml(e.cat || '')}</div>
        <div class="edu-title">${escapeHtml(e.title || '')}</div>
        ${e.description ? `<div class="edu-desc">${escapeHtml(e.description)}</div>` : ''}
      </div>
    </div>
  `).join('');
}, { order: 'created_at', ascending: true });
