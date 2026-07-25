/* ============================================================
   ADMIN V1 — UI helpers
   These are pure presentation utilities (cursor FX, mobile menu,
   glitch FX, HTML-escaping) originally shared with Portfolio V1's
   script.js. Admin V1 keeps its own copy here so it never depends
   on the portfolio app's file — each app owns its UI independently;
   only shared/ (data/business logic) is actually shared.
   ============================================================ */

'use strict';

export function initCursor() {
  const cursor = document.getElementById('cursor');
  const trail = document.getElementById('cursor-trail');
  if (!cursor || !trail) return;
  if ('ontouchstart' in window) { cursor.style.display = 'none'; trail.style.display = 'none'; return; }

  let tx = 0, ty = 0, cx = 0, cy = 0;
  document.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  cursor.style.left = '-100px'; cursor.style.top = '-100px';
  trail.style.left = '-100px'; trail.style.top = '-100px';

  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  }, { passive: true });

  function animTrail() {
    cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
    trail.style.left = cx + 'px'; trail.style.top = cy + 'px';
    requestAnimationFrame(animTrail);
  }
  animTrail();

  document.querySelectorAll('a, button, .btn-cyber, .nav-card, .contact-card').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.style.transform = 'translate(-50%,-50%) scale(2)');
    el.addEventListener('mouseleave', () => cursor.style.transform = 'translate(-50%,-50%) scale(1)');
  });
}

export function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;
  if (hamburger.dataset.menuBound === '1') return;
  hamburger.dataset.menuBound = '1';

  const setOpen = (open) => {
    mobileMenu.classList.toggle('open', open);
    hamburger.classList.toggle('open', open);
    hamburger.classList.toggle('active', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
  };

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!mobileMenu.classList.contains('open'));
  });

  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));

  document.addEventListener('click', e => {
    if (mobileMenu.classList.contains('open') &&
        !hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') setOpen(false);
  });
}

export function initGlitchEffects() {
  const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  const minDelay = isLowEnd ? 6000 : 3000;
  function randomGlitch() {
    const elements = document.querySelectorAll('.hero-name, .hero-portfolio, .page-title');
    if (elements.length > 0) {
      const el = elements[Math.floor(Math.random() * elements.length)];
      el.classList.add('glitch-active');
      setTimeout(() => el.classList.remove('glitch-active'), 200);
    }
    setTimeout(randomGlitch, minDelay + Math.random() * 5000);
  }
  randomGlitch();
  if (!isLowEnd) {
    function bodyGlitch() {
      document.body.style.filter = `hue-rotate(${Math.random() * 20 - 10}deg)`;
      setTimeout(() => { document.body.style.filter = 'none'; }, 100);
      setTimeout(bodyGlitch, 8000 + Math.random() * 10000);
    }
    setTimeout(bodyGlitch, 5000);
  }
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}
