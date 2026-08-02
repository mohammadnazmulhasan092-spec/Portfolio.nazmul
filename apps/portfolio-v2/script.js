/* ============================================================
   PORTFOLIO V2 — script v3
   Presentation + interaction only. All data comes from the SAME
   shared modules Portfolio V1 uses (shared/supabase.js, shared/
   api.js) — no business logic is duplicated here.
   New in this version: a Three.js background scene whose camera
   moves through a set of waypoints as the page is scrolled — the
   "3D animated, camera moving" frontend requested to replace the
   previous editorial V2 design. Everything else (data subscriptions,
   Style Studio, Section visibility, Copy overrides, lightbox) keeps
   the exact same setting keys and table shapes as before, so Admin
   V2 needs no data-model changes to drive this page.
   ============================================================ */

import { subscribeSetting, subscribeTable } from '../../shared/supabase.js';
import { watchVersionSwitch } from '../../shared/api.js';
import {
  initCustomCursor, initMagnetic, initRipple, initTilt, initLoader, splitChars,
  initNavAutoHide, initDockMagnify, initSpotlight, initPauseOffscreen, initParallax
} from '../../shared/motion.js';

watchVersionSwitch('portfolio', 'v2');

/* ============================================================
   CINEMATIC MOTION LAYER — presentation only, wired alongside
   the existing subscriptions below. See shared/motion.js for
   the implementation (shared with Admin V2).
   ============================================================ */
initCustomCursor('a, button, .glass-card, .work-card, .contact-pill, .rail-dot, .tab');
initMagnetic('.btn');
initRipple('.btn');
initTilt('.glass-card, .work-card, .about-card, .ach-row, .contact-pill');
const hideLoader = initLoader('#mx-loader', 500);
if (document.readyState === 'complete') hideLoader();
else window.addEventListener('load', hideLoader);

/* ---- Phase 2: nav dock/auto-hide, hero spotlight, ambient-glow pause, parallax ---- */
initNavAutoHide('.rail');
initNavAutoHide('.tabbar');
initDockMagnify('.rail-dots', '.rail-dot', { maxScale: 1.35, range: 70 });
initDockMagnify('.tabbar', '.tab', { maxScale: 1.15, range: 60 });
initSpotlight('.hero-panel');
initPauseOffscreen('.panel'); // gates the ambient (idle) glass-card glow to the section currently in view
initParallax();

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
   Same setting keys as before (cms_v2_style / cms_v2_sections /
   cms_v2_copy) — only the visual system they drive has changed.
   ============================================================ */
const ACCENT_PRESETS = {
  sunset: { a: '#ff8a5c', b: '#8b6bff' },
  ocean:  { a: '#2dd4bf', b: '#3b82f6' },
  forest: { a: '#84cc16', b: '#059669' },
  rose:   { a: '#fb7185', b: '#d946ef' },
};

let currentAccent = ACCENT_PRESETS.sunset;
const accentListeners = [];

subscribeSetting('cms_v2_style', (v) => {
  const s = v || {};
  const preset = ACCENT_PRESETS[s.preset] || ACCENT_PRESETS.sunset;
  currentAccent = preset;
  document.documentElement.style.setProperty('--amber', preset.a);
  document.documentElement.style.setProperty('--violet', preset.b);
  accentListeners.forEach(fn => fn(preset));

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
   3D BACKGROUND — Three.js scene with scroll-driven camera
   A field of soft particles plus a handful of slowly-rotating
   low-poly shapes. The camera travels through one waypoint per
   section as the page scrolls, giving the "camera moving" feel;
   a gentle mouse-parallax offset is layered on top on desktop.
   Skips entirely (falls back to the CSS gradient background) if
   Three.js failed to load or WebGL isn't available.
   ============================================================ */
(function initScene() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) { return; }

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07070c, 0.045);
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 7);

  function setSize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  setSize();
  window.addEventListener('resize', setSize);

  // ---- lights ----
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  const key = new THREE.PointLight(0x8b6bff, 2.2, 30);
  key.position.set(4, 3, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0xff8a5c, 1.6, 30);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  function hexToThree(hex) { return new THREE.Color(hex); }
  accentListeners.push((preset) => {
    key.color = hexToThree(preset.b);
    rim.color = hexToThree(preset.a);
    dustMat.color = hexToThree(preset.a);
  });

  // ---- floating low-poly shapes ----
  const shapesGroup = new THREE.Group();
  scene.add(shapesGroup);
  const geoPool = [
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.TorusKnotGeometry(0.7, 0.22, 100, 12),
    new THREE.OctahedronGeometry(0.9, 0),
    new THREE.DodecahedronGeometry(0.8, 0),
  ];
  const shapeCount = isTouch ? 4 : 7;
  const shapes = [];
  for (let i = 0; i < shapeCount; i++) {
    const geo = geoPool[i % geoPool.length];
    const wire = i % 2 === 0;
    const mat = wire
      ? new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.18 })
      : new THREE.MeshStandardMaterial({ color: 0x8b6bff, roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    const angle = (i / shapeCount) * Math.PI * 2;
    const radius = 4 + (i % 3);
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.3) * 2.4, Math.sin(angle) * radius - 4);
    mesh.userData.spin = 0.05 + Math.random() * 0.15;
    mesh.userData.axis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
    shapesGroup.add(mesh);
    shapes.push(mesh);
  }

  // ---- particle field ----
  const particleCount = isTouch ? 260 : 700;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 6;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, transparent: true, opacity: 0.5 });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // ---- sparse "dust" layer — fewer, closer, slower, warm-tinted — adds depth separation from the star field above ----
  const dustCount = isTouch ? 60 : 140;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 14;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 8 + 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xff8a5c, size: 0.03, transparent: true, opacity: 0.35 });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // ---- camera waypoints, one per section (home, skills, work, achievements, education, about, contact) ----
  const WAYPOINTS = [
    { pos: [0, 0, 7],       look: [0, 0, 0] },
    { pos: [2.2, 0.6, 6],   look: [0.6, 0, -1] },
    { pos: [-2, -0.4, 5.5], look: [-0.6, 0.1, -1] },
    { pos: [1.6, 1, 6.2],   look: [0.3, -0.2, -1] },
    { pos: [-1.6, -1, 5.8], look: [-0.3, 0.3, -1] },
    { pos: [0.6, 0.8, 5],   look: [0, 0, -1] },
    { pos: [0, 0, 4.3],     look: [0, 0, -1] },
  ];

  let targetProgress = 0, smoothProgress = 0;
  function updateScrollProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    targetProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress);
  updateScrollProgress();

  let mouseX = 0, mouseY = 0;
  if (!isTouch) {
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });
  }

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    if (document.hidden) return; // pause rendering entirely while the tab is backgrounded
    const dt = Math.min(clock.getDelta(), 0.05);

    smoothProgress += (targetProgress - smoothProgress) * (reduceMotion ? 1 : 0.06);
    const scaled = smoothProgress * (WAYPOINTS.length - 1);
    const i0 = Math.floor(scaled);
    const i1 = Math.min(i0 + 1, WAYPOINTS.length - 1);
    const t = scaled - i0;
    const a = WAYPOINTS[i0], b = WAYPOINTS[i1];

    tmpPos.set(
      a.pos[0] + (b.pos[0] - a.pos[0]) * t,
      a.pos[1] + (b.pos[1] - a.pos[1]) * t,
      a.pos[2] + (b.pos[2] - a.pos[2]) * t
    );
    tmpLook.set(
      a.look[0] + (b.look[0] - a.look[0]) * t,
      a.look[1] + (b.look[1] - a.look[1]) * t,
      a.look[2] + (b.look[2] - a.look[2]) * t
    );

    camera.position.x = tmpPos.x + mouseX * 0.35;
    camera.position.y = tmpPos.y - mouseY * 0.25;
    camera.position.z = tmpPos.z;
    camera.lookAt(tmpLook);

    if (!reduceMotion) {
      shapes.forEach(mesh => mesh.rotateOnAxis(mesh.userData.axis, mesh.userData.spin * dt));
      shapesGroup.rotation.y += dt * 0.02;
      particles.rotation.y += dt * 0.01;
      dust.rotation.y -= dt * 0.015;
      dust.position.y = Math.sin(clock.elapsedTime * 0.15) * 0.3;
      // interactive lighting — key light drifts slightly toward the cursor
      key.position.x += ((4 + mouseX * 2) - key.position.x) * 0.03;
      key.position.y += ((3 - mouseY * 2) - key.position.y) * 0.03;
    }

    renderer.render(scene, camera);
  }
  animate();
})();

/* ============================================================
   Scroll-linked progress bar + active-section sync for both the
   desktop rail and the mobile tab bar (whole-page scroll — no
   scroll-snap container, so the 3D camera reads continuous motion)
   ============================================================ */
(function initScrollSystem() {
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
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = `scaleX(${pct})`;
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
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
  const heroNameEl = document.getElementById('hero-name');
  heroNameEl.textContent = d.name;
  splitChars(heroNameEl);
  document.getElementById('rail-brand-fallback').textContent = (d.name || 'P').charAt(0);
  document.getElementById('mobile-brand-fallback').textContent = (d.name || 'P').charAt(0);
  document.getElementById('hero-arabic').textContent = d.arabic || '';
  document.getElementById('hero-actions').innerHTML = `
    <a class="btn btn-primary" href="${escapeHtml(d.btn1_link)}">${escapeHtml(d.btn1_text)}</a>
    <a class="btn btn-ghost" href="${escapeHtml(d.btn2_link)}" target="_blank" rel="noopener">${escapeHtml(d.btn2_text)}</a>
  `;
});

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
    <div class="glass-card">
      <div class="skill-row-top"><span>${escapeHtml(s.name)}</span><span>${escapeHtml(String(s.level ?? ''))}%</span></div>
      <div class="skill-track"><div class="skill-fill" style="width:${Math.max(0, Math.min(100, Number(s.level) || 0))}%;"></div></div>
    </div>
  `).join('');
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
   DATA — gallery / achievements / educational
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
