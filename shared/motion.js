/* ============================================================
   shared/motion.js
   Presentation-only cinematic motion utilities, shared between
   Portfolio V2 and Admin V2 (the two apps sharing the dark
   glass/aurora design system). Pure UI polish — no data, no
   auth, no business logic — so it belongs in shared/ next to
   supabase.js / api.js without growing either of those files
   into a catch-all.

   Every helper is defensive (no-ops safely if targets don't
   exist), skips pointer-only effects on touch devices, and
   re-checks prefers-reduced-motion / the CMS "reduced motion"
   toggle (body.motion-reduced) on every interaction rather than
   once at load, so Admin V2's Style Studio motion switch keeps
   working live for anything wired up here.
   ============================================================ */

const TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches;

export function reducedMotionNow() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains('motion-reduced');
}

/* ---- Custom cursor: lagging glow ring + tight dot, desktop only ---- */
export function initCustomCursor(hoverSelector) {
  if (TOUCH) return;
  const dot = document.createElement('div'); dot.className = 'mx-cursor-dot';
  const ring = document.createElement('div'); ring.className = 'mx-cursor-ring';
  document.body.append(dot, ring);
  let mx = -100, my = -100, rx = -100, ry = -100, shown = false;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (!shown) { shown = true; document.body.classList.add('mx-cursor-on'); }
    if (reducedMotionNow()) { dot.style.transform = `translate(${mx}px,${my}px)`; return; }
    dot.style.transform = `translate(${mx}px,${my}px)`;
  });
  window.addEventListener('mouseleave', () => document.body.classList.remove('mx-cursor-on'));

  function loop() {
    requestAnimationFrame(loop);
    if (!shown || document.hidden) return;
    const ease = reducedMotionNow() ? 1 : 0.16;
    rx += (mx - rx) * ease; ry += (my - ry) * ease;
    ring.style.transform = `translate(${rx}px,${ry}px)`;
  }
  loop();

  if (hoverSelector) {
    document.addEventListener('mouseover', (e) => { if (e.target.closest(hoverSelector)) ring.classList.add('mx-cursor-hot'); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest(hoverSelector)) ring.classList.remove('mx-cursor-hot'); });
  }
}

/* ---- Magnetic hover — delegated, so it works on content rendered later ---- */
export function initMagnetic(selector, strength = 14) {
  if (TOUCH) return;
  let current = null;
  document.addEventListener('mousemove', (e) => {
    const el = e.target.closest(selector);
    if (el) {
      current = el;
      if (reducedMotionNow()) return;
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * strength;
      const y = ((e.clientY - r.top) / r.height - 0.5) * strength;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    } else if (current) {
      current.style.transform = '';
      current = null;
    }
  });
}

/* ---- Ripple click — delegated ---- */
export function initRipple(selector) {
  document.addEventListener('click', (e) => {
    if (reducedMotionNow()) return;
    const el = e.target.closest(selector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 1.7;
    const span = document.createElement('span');
    span.className = 'mx-ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = (e.clientX - r.left - size / 2) + 'px';
    span.style.top = (e.clientY - r.top - size / 2) + 'px';
    el.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  });
}

/* ---- 3D tilt — delegated ---- */
export function initTilt(selector, maxDeg = 6) {
  if (TOUCH) return;
  let current = null;
  document.addEventListener('mousemove', (e) => {
    const el = e.target.closest(selector);
    if (el) {
      current = el;
      if (reducedMotionNow()) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * maxDeg * 2, ry = (px - 0.5) * maxDeg * 2;
      el.style.transform = `perspective(700px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`;
    } else if (current) {
      current.style.transform = '';
      current = null;
    }
  });
}

/* ---- Luxury loader — call the returned function once the app is ready ---- */
export function initLoader(overlaySelector, minMs = 450) {
  const el = document.querySelector(overlaySelector);
  if (!el) return () => {};
  const start = Date.now();
  let done = false;
  return function hide() {
    if (done) return;
    done = true;
    const wait = reducedMotionNow() ? 0 : Math.max(0, minMs - (Date.now() - start));
    setTimeout(() => {
      el.classList.add('mx-loader-out');
      setTimeout(() => el.remove(), 650);
    }, wait);
  };
}

/* ---- Character-by-character reveal (keeps any gradient text-clip on the parent) ---- */
export function splitChars(el) {
  if (!el || el.dataset.mxSplit) return;
  const text = el.textContent;
  if (!text) return;
  el.dataset.mxSplit = '1';
  el.textContent = '';
  [...text].forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '\u00A0' : ch;
    span.style.setProperty('--i', i);
    span.className = 'mx-char';
    el.appendChild(span);
  });
  el.classList.add('mx-char-wrap');
}

/* ---- Sliding active-tab indicator ---- */
export function initSlidingIndicator(containerSelector, itemSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return () => {};
  let bar = container.querySelector('.mx-tab-indicator');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'mx-tab-indicator';
    container.appendChild(bar);
  }
  function move() {
    const active = container.querySelector(itemSelector + '.active');
    if (!active) { bar.style.opacity = '0'; return; }
    bar.style.opacity = '1';
    bar.style.width = active.offsetWidth + 'px';
    bar.style.transform = `translateX(${active.offsetLeft}px)`;
  }
  window.addEventListener('resize', move);
  requestAnimationFrame(move);
  return move;
}

/* ---- Trigger a one-off shake (e.g. on a failed form/login) ---- */
export function shake(el) {
  if (!el || reducedMotionNow()) return;
  el.classList.remove('mx-shake');
  void el.offsetWidth; // restart animation
  el.classList.add('mx-shake');
}

/* ============================================================
   PHASE 2 — additions on top of the above. Same rules: defensive,
   reduced-motion-aware, touch-safe, no data/business logic.
   ============================================================ */

/* ---- Hide nav on scroll down, reveal on scroll up ---- */
export function initNavAutoHide(selector, threshold = 12) {
  const el = document.querySelector(selector);
  if (!el) return;
  let lastY = window.scrollY, ticking = false;
  function onScroll() {
    const y = Math.max(0, window.scrollY);
    if (Math.abs(y - lastY) > threshold) {
      if (y > lastY && y > 80) el.classList.add('mx-nav-hidden');
      else el.classList.remove('mx-nav-hidden');
      lastY = y;
    }
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
}

/* ---- Dock-style neighbor magnify (macOS dock feel) for nav items ---- */
export function initDockMagnify(containerSelector, itemSelector, opts = {}) {
  if (TOUCH) return;
  const container = document.querySelector(containerSelector);
  if (!container) return;
  const maxScale = opts.maxScale ?? 1.3;
  const range = opts.range ?? 70;
  container.addEventListener('mousemove', (e) => {
    if (reducedMotionNow()) return;
    container.querySelectorAll(itemSelector).forEach((item) => {
      const r = item.getBoundingClientRect();
      const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      const scale = dist < range ? 1 + (maxScale - 1) * (1 - dist / range) : 1;
      item.style.setProperty('--mx-dock-scale', scale.toFixed(3));
    });
  });
  container.addEventListener('mouseleave', () => {
    container.querySelectorAll(itemSelector).forEach((item) => item.style.removeProperty('--mx-dock-scale'));
  });
}

/* ---- Mouse-follow spotlight — exposes --mx-x / --mx-y for a CSS radial-gradient to consume ---- */
export function initSpotlight(selector) {
  if (TOUCH) return;
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return;
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx-x', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
    el.style.setProperty('--mx-y', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
  });
}

/* ---- Pause ambient CSS animations while their container is offscreen (perf) ---- */
export function initPauseOffscreen(selector, className = 'mx-in-view') {
  const els = document.querySelectorAll(selector);
  if (!els.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle(className, entry.isIntersecting));
  }, { threshold: 0.05 });
  els.forEach((el) => io.observe(el));
}

/* ---- Generic scroll-linked parallax for elements with data-mx-parallax="<speed>" ---- */
export function initParallax(root = document) {
  const els = Array.from(root.querySelectorAll('[data-mx-parallax]'));
  if (!els.length) return;
  let ticking = false;
  function update() {
    if (!reducedMotionNow()) {
      const y = window.scrollY;
      els.forEach((el) => {
        const speed = parseFloat(el.dataset.mxParallax) || 0.1;
        el.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`;
      });
    }
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}
