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
  if (window.matchMedia('(hover: none)').matches || reduceMotion.matches) return;
  // Parallax targets the hero-mesh/aurora *containers*, not the individual
  // .mesh-blob/.aurora-layer children — those already have their own CSS
  // float animations on `transform`, and a JS-driven transform on the same
  // element would fight the running animation. Shifting the container by a
  // few px moves everything inside it together with zero conflict. Text and
  // buttons are never touched, per spec.
  const parallaxEls = document.querySelectorAll('.hero-mesh, .aurora');
  if (!blob && !parallaxEls.length) return;
  let x = window.innerWidth / 2, y = window.innerHeight / 2, tx = x, ty = y;
  window.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
  (function loop() {
    x += (tx - x) * 0.08; y += (ty - y) * 0.08;
    if (blob) blob.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    if (parallaxEls.length) {
      const px = (x - window.innerWidth / 2) * 0.012;
      const py = (y - window.innerHeight / 2) * 0.012;
      parallaxEls.forEach(el => { el.style.transform = `translate(${px}px, ${py}px)`; });
    }
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

  // Shared stagger helper — used by the IntersectionObserver below, by the
  // hero's own one-time intro sequence, and by revealIfVisible() (for
  // content that renders asynchronously after its panel was already
  // revealed, e.g. gallery/skills/about items arriving from Supabase).
  // Only ever adds .in, never removes it, so nothing replays on repeat
  // visits to an already-revealed panel.
  function staggerReveal(container, intervalMs = 90, startDelay = 0) {
    const items = container.querySelectorAll('.reveal:not(.in), .reveal-item:not(.in)');
    items.forEach((el, i) => setTimeout(() => el.classList.add('in'), startDelay + i * intervalMs));
  }
  window.__staggerReveal = staggerReveal; // exposed for the dynamic-content render functions further down this file

  function revealIfVisible(el) {
    const panel = el.closest('.panel');
    if (panel && panel.dataset.revealed) staggerReveal(panel, panel.id === 'work' || panel.id === 'skills' ? 55 : 90);
  }
  window.__revealIfVisible = revealIfVisible;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        setActive(entry.target.id);
      }
      if (entry.isIntersecting && !entry.target.dataset.revealed) {
        entry.target.dataset.revealed = '1';
        if (entry.target.id === 'home') return; // handled by playHeroIntro() instead
        // Grids with many small children (Work, Skills) read better with a
        // tighter stagger than text-heavy sections like About/Education.
        const interval = (entry.target.id === 'work' || entry.target.id === 'skills') ? 55 : 90;
        staggerReveal(entry.target, interval);
      }
    });
  }, { threshold: [0.5] });
  panels.forEach(p => io.observe(p));

  function updateProgress() {
    const max = scroller.scrollHeight - scroller.clientHeight;
    const pct = max > 0 ? scroller.scrollTop / max : 0;
    bar.style.transform = `scaleX(${pct})`;
    bar.classList.toggle('at-end', pct >= 0.995);
    // Drives the logo's shrink-on-scroll CSS (body.scrolled). Mobile scrolls
    // the window itself, not #scroller, hence checking both scrollTop values.
    const scrollY = scroller.scrollTop || window.scrollY || 0;
    document.body.classList.toggle('scrolled', scrollY > 40);
  }
  scroller.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('scroll', updateProgress, { passive: true }); // mobile: body scrolls, not #scroller
  updateProgress();
})();

/* ============================================================
   Magnetic buttons — desktop (fine pointer + hover-capable) only.
   Sets --mx/--my custom properties consumed by .btn in style.css, which
   composes them with the existing hover-lift transform rather than
   overriding it. Delegated listeners so this works for buttons rendered
   later (hero CTAs, Contact card) without re-binding anything.
   ============================================================ */
(function initMagneticButtons() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const MAX_PULL = 8; // px — deliberately small, per spec
  let current = null;
  document.addEventListener('mousemove', (e) => {
    const btn = e.target.closest('.btn');
    if (btn !== current) {
      if (current) { current.style.setProperty('--mx', '0px'); current.style.setProperty('--my', '0px'); }
      current = btn;
    }
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const relX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const relY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    btn.style.setProperty('--mx', (relX * MAX_PULL).toFixed(1) + 'px');
    btn.style.setProperty('--my', (relY * MAX_PULL).toFixed(1) + 'px');
  });
  document.addEventListener('mouseleave', () => {
    if (current) { current.style.setProperty('--mx', '0px'); current.style.setProperty('--my', '0px'); current = null; }
  });
})();

/* ============================================================
   Ripple effect for .btn (hero buttons + Contact CTA buttons).
   Event-delegated on document so it works for buttons rendered later
   by subscribeSetting callbacks, without needing to re-bind listeners.
   ============================================================ */
(function initRipple() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('pointerdown', (e) => {
    if (reduceMotion.matches || document.body.classList.contains('motion-reduced')) return;
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.4;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
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
let heroIntroPlayed = false; // realtime hero edits shouldn't replay the load animation, just update the text
subscribeSetting('hero', (d) => {
  d = { ...HERO_DEFAULTS, ...(d || {}) };
  const nameEl = document.getElementById('hero-name');
  // One <span class="word"> per word so the heading can reveal word-by-word
  // (see .display .word in style.css — background-attachment:fixed keeps
  // the existing gradient text-clip looking continuous across the split).
  const words = String(d.name).trim().split(/\s+/).filter(Boolean);
  nameEl.innerHTML = words.map(w => `<span class="word">${escapeHtml(w)}</span>`).join(' ');
  document.getElementById('rail-brand-fallback').textContent = (d.name || 'P').charAt(0);
  document.getElementById('mobile-brand-fallback').textContent = (d.name || 'P').charAt(0);
  document.getElementById('hero-arabic').textContent = d.arabic || '';
  document.getElementById('hero-actions').innerHTML = `
    <a class="btn btn-primary reveal-item" href="${escapeHtml(d.btn1_link)}">${escapeHtml(d.btn1_text)}</a>
    <a class="btn btn-ghost reveal-item" href="${escapeHtml(d.btn2_link)}" target="_blank" rel="noopener">${escapeHtml(d.btn2_text)}</a>
  `;
  if (!heroIntroPlayed) { heroIntroPlayed = true; playHeroIntro(nameEl); }
});

// One-time hero load animation: heading words in, then subtitle, then CTA
// buttons — overlapping slightly rather than strictly sequential so the
// whole thing reads as one quick, fluid motion instead of a slow relay.
// Tuned to land comfortably inside ~1s total for a typical 2-4 word name.
function playHeroIntro(nameEl) {
  const WORD_STEP = 55;
  const wordSpans = nameEl.querySelectorAll('.word');
  requestAnimationFrame(() => {
    wordSpans.forEach((w, i) => {
      w.style.transitionDelay = (i * WORD_STEP) + 'ms';
      requestAnimationFrame(() => w.classList.add('in'));
    });
  });
  const subtitle = document.getElementById('hero-arabic');
  setTimeout(() => subtitle.classList.add('in'), 260);
  const ctaButtons = document.querySelectorAll('#hero-actions .reveal-item');
  ctaButtons.forEach((btn, i) => setTimeout(() => btn.classList.add('in'), 350 + i * 70));
  const marquee = document.querySelector('#home .marquee');
  if (marquee) setTimeout(() => marquee.classList.add('in'), 480);
}

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
  const container = document.getElementById('about-items');
  container.innerHTML = (d.items || []).map(it => `
    <div class="about-card reveal-item">
      <div class="about-icon">${escapeHtml(it.icon || '•')}</div>
      <div class="about-label">${escapeHtml(it.label || '')}</div>
      <div class="about-text">${escapeHtml(it.text || '')}</div>
    </div>
  `).join('');
  window.__revealIfVisible && window.__revealIfVisible(container);
});

subscribeSetting('cms_skills', (v) => {
  const skills = Array.isArray(v) && v.length ? v : [];
  const grid = document.getElementById('skills-grid');
  grid.innerHTML = skills.map(s => `
    <div class="reveal-item">
      <div class="skill-row-top"><span>${escapeHtml(s.name)}</span><span>${escapeHtml(String(s.level ?? ''))}%</span></div>
      <div class="skill-track"><div class="skill-fill" style="width:${Math.max(0, Math.min(100, Number(s.level) || 0))}%;"></div></div>
    </div>
  `).join('');
  window.__revealIfVisible && window.__revealIfVisible(grid);
  // marquee ticker reuses the same skill names, doubled for seamless loop
  const names = skills.map(s => s.name).filter(Boolean);
  const track = document.getElementById('marquee-track');
  if (track && names.length) {
    const text = names.map(n => `✦ ${escapeHtml(n)}`).join('   ');
    track.innerHTML = text + '   ' + text;
  }
});

const CONTACT_ICONS = { Email: '✉', GitHub: '⌥', Telegram: '✈', WhatsApp: '☎', Facebook: 'f' };
subscribeSetting('contact', (d) => {
  d = d || {};
  const whatsappLink = d.whatsapp ? 'https://wa.me/' + d.whatsapp.replace(/[^0-9]/g, '') : null;
  const rows = [
    ['Email', d.email, d.email ? 'mailto:' + d.email : null],
    ['WhatsApp', d.whatsapp, whatsappLink],
    ['GitHub', d.github, d.github],
    ['Telegram', d.telegram, d.telegram],
    ['Facebook', d.facebook, d.facebook],
  ].filter(r => r[1] && r[2]);
  // Buttons only ever show an icon + platform label — never the raw email/
  // phone/handle. The href still carries the real destination; clicking is
  // what "reveals" it (opens mail client, wa.me, profile, etc).
  document.getElementById('contact-orbit').innerHTML = rows.map(([label, , link]) => `
    <a class="btn btn-cta reveal-item" href="${escapeHtml(link)}" target="_blank" rel="noopener">
      <span class="btn-cta-icon" aria-hidden="true">${CONTACT_ICONS[label] || '→'}</span>
      <span>${label}</span>
    </a>
  `).join('');
  window.__revealIfVisible && window.__revealIfVisible(document.getElementById('contact-orbit'));
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
    <div class="work-card reveal-item" role="button" tabindex="0" aria-label="${escapeHtml(img.caption ? 'View image: ' + img.caption : 'View image')}" data-src="${escapeHtml(img.image_url)}" data-caption="${escapeHtml(img.caption || '')}">
      <img src="${escapeHtml(img.image_url)}" alt="${escapeHtml(img.caption || '')}" loading="lazy" onload="this.classList.add('loaded')" onerror="this.parentElement.style.display='none'" />
      <div class="work-overlay" aria-hidden="true"><span class="work-view-btn">View</span></div>
      ${img.caption ? `<div class="work-caption">${escapeHtml(img.caption)}</div>` : ''}
    </div>
  `).join('');
  grid.querySelectorAll('.work-card').forEach(card => {
    card.addEventListener('click', () => openLightbox(card.dataset.src, card.dataset.caption, card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(card.dataset.src, card.dataset.caption, card); }
    });
  });
  window.__revealIfVisible && window.__revealIfVisible(grid);
}, { order: 'created_at', ascending: false });

subscribeTable('achievements', (items) => {
  const published = items.filter(a => a.published !== false);
  const list = document.getElementById('ach-list');
  if (!published.length) { list.innerHTML = '<p class="empty-note">No achievements logged yet.</p>'; return; }
  list.innerHTML = published.map(a => `
    <div class="ach-row reveal-item">
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
  window.__revealIfVisible && window.__revealIfVisible(list);
}, { order: 'created_at', ascending: true });

subscribeTable('educational', (items) => {
  const published = items.filter(e => e.published !== false);
  const rows = document.getElementById('edu-rows');
  if (!published.length) { rows.innerHTML = '<p class="empty-note">No entries yet.</p>'; return; }
  rows.innerHTML = published.map(e => `
    <div class="edu-row reveal-item">
      <div class="edu-year">${escapeHtml(e.year || '')}</div>
      <div>
        <div class="edu-cat">${escapeHtml(e.cat || '')}</div>
        <div class="edu-title">${escapeHtml(e.title || '')}</div>
        ${e.description ? `<div class="edu-desc">${escapeHtml(e.description)}</div>` : ''}
      </div>
    </div>
  `).join('');
  window.__revealIfVisible && window.__revealIfVisible(rows);
}, { order: 'created_at', ascending: true });
