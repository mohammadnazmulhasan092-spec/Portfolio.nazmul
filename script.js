/* ============================================
   CYBERPUNK PORTFOLIO — MAIN SCRIPT
   Supabase backend + Vanilla JS
   ============================================ */

'use strict';

import {
  supabase, onAuthChange, recordVisit, getVisitorStats,
  subscribeSetting, subscribeTable
} from './supabase.js';

// ============================================
// DEFAULT DATA (fallback if DB empty)
// ============================================
export const DEFAULTS = {
  name: 'MOHAMMAD NAZMUL HASAN',
  arabic: 'لَا إِلَٰهَ إِلَّا اللهُ مُحَمَّدٌ رَسُوْلُ اللهِ',
  btn1_text: 'HADI',
  btn1_link: '#',
  btn2_text: 'GITHUB',
  btn2_link: 'https://github.com',
  about_intro: 'A technology enthusiast driven by curiosity, continuous learning, and a passion for cybersecurity. I enjoy exploring how digital systems work and how they can be made safer, smarter, and more reliable for everyone.',
  about_items: [
    { icon: '🎓', label: 'AS A STUDENT', text: 'Every day is an opportunity to learn something new, improve existing skills, and move one step closer to excellence.' },
    { icon: '📖', label: 'MY APPROACH', text: 'I focus on understanding fundamentals, practicing consistently, and building knowledge that creates long-term value.' },
    { icon: '🎯', label: 'MY GOAL', text: 'To build expertise in cybersecurity and contribute to a more secure and trustworthy digital future.' },
    { icon: '👥', label: 'MY VALUES', text: 'Integrity. Responsibility. Privacy. Respect. These principles guide every step of my learning journey.' },
    { icon: '💡', label: 'I BELIEVE', text: 'Consistent effort, even in small amounts, creates extraordinary results over time.' }
  ],
  skills: [
    { name: 'HTML', level: 90 },
    { name: 'CSS', level: 85 },
    { name: 'JavaScript', level: 75 },
    { name: 'Responsive Design', level: 80 },
    { name: 'Cybersecurity Fundamentals', level: 70 }
  ],
  contact_telegram: 'https://t.me/username',
  contact_whatsapp: '+8801700000000',
  contact_email: 'mohammadnazmulhasan092@gmail.com'
};

// ============================================
// CURSOR
// ============================================
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

// ============================================
// LOADING SCREEN
// ============================================
export function initLoader() {
  const screen = document.getElementById('loading-screen');
  if (!screen) return;

  // Make sure body is in booting state
  document.body.classList.add('booting');

  const lines = [
    '[ SYSTEM INITIALIZING ]',
    '',
    'Loading Interface...',
    'Loading Profile...',
    'Loading Experience...',
    'Loading Portfolio...',
  ];
  const container = document.getElementById('boot-lines-container');
  const accessGranted = document.getElementById('boot-access-granted');
  let i = 0;
  function showNext() {
    if (i >= lines.length) {
      // Show ACCESS GRANTED
      setTimeout(() => {
        if (accessGranted) accessGranted.style.display = 'block';
        setTimeout(() => {
          // Fade out loading screen, reveal homepage
          screen.style.transition = 'opacity 0.8s ease';
          screen.style.opacity = '0';
          setTimeout(() => {
            screen.remove();
            // Remove booting → homepage becomes visible
            document.body.classList.remove('booting');
          }, 800);
        }, 1200);
      }, 300);
      return;
    }
    if (lines[i] === '') {
      const br = document.createElement('div');
      br.style.height = '10px';
      container.appendChild(br);
      i++; showNext(); return;
    }
    const div = document.createElement('div');
    div.className = 'boot-line active';
    div.textContent = lines[i];
    container.appendChild(div);
    setTimeout(() => { div.classList.remove('active'); div.classList.add('done'); i++; showNext(); }, 420);
  }
  showNext();
}

// ============================================
// NAV UNDERLINE
// ============================================
export function initNavUnderline() {
  const links = document.querySelectorAll('.nav-links li a');
  const underline = document.querySelector('.nav-underline');
  if (!underline || !links.length) return;
  function moveUnderline(el) {
    const rect = el.getBoundingClientRect();
    const navRect = el.closest('ul').getBoundingClientRect();
    underline.style.left = (rect.left - navRect.left) + 'px';
    underline.style.width = rect.width + 'px';
  }
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
      setTimeout(() => moveUnderline(link), 100);
    }
    link.addEventListener('click', () => { links.forEach(l => l.classList.remove('active')); link.classList.add('active'); moveUnderline(link); });
    link.addEventListener('mouseenter', () => moveUnderline(link));
  });
}

// ============================================
// GLITCH EFFECTS
// ============================================
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

// ============================================
// LIVE FEED
// ============================================
export function initLiveFeed() {
  const container = document.getElementById('live-feed-content');
  if (!container) return;
  function r(min, max) { return Math.floor(Math.random() * (max - min) + min); }
  const messages = [
    () => `[+] Scanning network topology...`,
    () => `[+] Packet analysis: ${r(100,999)} packets/sec`,
    () => `[+] Firewall status: ACTIVE`,
    () => `[+] Encryption: AES-256-GCM`,
    () => `[+] Supabase sync: ONLINE`,
    () => `[+] Justice module: ENGAGED`,
    () => `[+] Target: CORRUPTION`,
    () => `[+] Anonymous mode: ON`,
    () => `[+] SSL/TLS handshake OK`,
    () => `[+] Zero-day scanner: IDLE`
  ];
  let msgIdx = 0;
  const maxLines = 5;
  function addLine() {
    const line = document.createElement('div');
    line.className = 'feed-line typing';
    line.textContent = messages[msgIdx % messages.length]();
    msgIdx++;
    container.appendChild(line);
    requestAnimationFrame(() => {
      setTimeout(() => line.classList.add('visible'), 50);
      setTimeout(() => line.classList.remove('typing'), 1000);
    });
    const lines = container.querySelectorAll('.feed-line');
    if (lines.length > maxLines) {
      lines[0].style.opacity = '0';
      setTimeout(() => lines[0].remove(), 300);
    }
    setTimeout(addLine, 1800 + Math.random() * 1500);
  }
  addLine();
}

// ============================================
// MOBILE MENU
// ============================================
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

// ============================================
// AUDIO
// ============================================
export function initAudio() {
  const btn = document.getElementById('audio-toggle');
  if (!btn) return;
  let audioCtx = null, playing = false, intervalId = null;
  function createBeep() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = 200 + Math.random() * 400;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
  }
  btn.addEventListener('click', () => {
    playing = !playing;
    btn.textContent = playing ? '🔊' : '🔈';
    if (playing) { intervalId = setInterval(createBeep, 800); }
    else { clearInterval(intervalId); }
  });
}

// ============================================
// TOAST
// ============================================
export function showToast(msg = '✓ SAVED', isError = false) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'success-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'success-toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ============================================
// LOAD HOME PAGE CONTENT FROM SUPABASE
// ============================================
export async function loadHomeContent() {
  // Hero
  subscribeSetting('hero', (data) => {
    const d = data || {};
    const nameEl = document.getElementById('hero-name');
    if (nameEl) nameEl.textContent = d.name || DEFAULTS.name;
    const arabicEl = document.getElementById('arabic-text');
    if (arabicEl) arabicEl.textContent = d.arabic || DEFAULTS.arabic;
    const btn1 = document.getElementById('btn1');
    if (btn1) { btn1.textContent = d.btn1_text || DEFAULTS.btn1_text; btn1.href = d.btn1_link || DEFAULTS.btn1_link; }
    const btn2 = document.getElementById('btn2');
    if (btn2) { btn2.textContent = d.btn2_text || DEFAULTS.btn2_text; btn2.href = d.btn2_link || DEFAULTS.btn2_link; }
  });

  // About
  subscribeSetting('about', (data) => {
    const d = data || {};
    const introEl = document.getElementById('about-intro');
    if (introEl) introEl.textContent = d.intro || DEFAULTS.about_intro;
    const itemsEl = document.getElementById('about-items');
    const items = d.items || DEFAULTS.about_items;
    if (itemsEl && items) {
      itemsEl.innerHTML = items.map(item => `
        <div class="about-item">
          <div class="about-icon">${escapeHtml(item.icon || '')}</div>
          <div>
            <div class="about-label">${escapeHtml(item.label || '')}</div>
            <div class="about-text">${escapeHtml(item.text || '')}</div>
          </div>
        </div>
      `).join('');
    }
  });

  recordVisit();
  loadVisitorPanel();
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

// ============================================
// VISITOR PANEL
// ============================================
async function loadVisitorPanel() {
  const panel = document.getElementById('visitor-panel');
  if (!panel) return;

  const stats = await getVisitorStats();
  const total = stats.total_visits || 0;
  const sessionStart = new Date().toLocaleTimeString();

  panel.innerHTML = `
    <div class="panel-title">// NETWORK ANALYTICS</div>
    <div class="visitor-stats">
      <div class="visitor-stat">
        <div class="visitor-stat-num" id="visit-counter">0</div>
        <div class="visitor-stat-label">TOTAL VISITORS</div>
      </div>
      <div class="visitor-stat">
        <div class="visitor-stat-num">${sessionStart}</div>
        <div class="visitor-stat-label">SESSION START</div>
      </div>
      <div class="visitor-stat">
        <div class="visitor-stat-num" id="uptime-counter">00:00</div>
        <div class="visitor-stat-label">SESSION TIME</div>
      </div>
    </div>
  `;

  let count = 0;
  const target = total;
  const step = Math.max(1, Math.floor(target / 50));
  const timer = setInterval(() => {
    count = Math.min(count + step, target);
    const el = document.getElementById('visit-counter');
    if (el) el.textContent = count.toLocaleString();
    if (count >= target) clearInterval(timer);
  }, 30);

  const startTime = Date.now();
  setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const el = document.getElementById('uptime-counter');
    if (el) el.textContent = `${m}:${s}`;
  }, 1000);
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // initLoader and initLiveFeed are replaced by premium versions below
  initCursor();
  initNavUnderline();
  initGlitchEffects();
  initMobileMenu();
  initAudio();
  if (document.getElementById('hero-name')) loadHomeContent();
  initImageOptimizations();
  initMobileNavActive();
});

// ============================================
// LAZY LOADING & IMAGE FALLBACKS
// ============================================
function initImageOptimizations() {
  if ('IntersectionObserver' in window) {
    const imgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          img.classList.add('loaded');
          imgObserver.unobserve(img);
        }
      });
    }, { rootMargin: '100px' });

    document.querySelectorAll('img[loading="lazy"]').forEach(img => imgObserver.observe(img));
    document.querySelectorAll('img:not([loading="lazy"])').forEach(img => {
      if (img.complete) img.classList.add('loaded');
      else img.addEventListener('load', () => img.classList.add('loaded'));
    });
  }
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', function() {
      this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"%3E%3Crect fill="%23010801" width="200" height="150"/%3E%3Crect fill="none" stroke="%2300cc33" stroke-width="1" x="1" y="1" width="198" height="148"/%3E%3Ctext fill="%23007a1e" font-family="monospace" font-size="12" x="50%25" y="45%25" text-anchor="middle"%3E[IMAGE%3C/text%3E%3Ctext fill="%23007a1e" font-family="monospace" font-size="12" x="50%25" y="60%25" text-anchor="middle"%3ENOT FOUND]%3C/text%3E%3C/svg%3E';
      this.style.opacity = '0.4';
      this.classList.add('img-error');
    });
  });
}

// ============================================
// MOBILE NAV ACTIVE STATE
// ============================================
function initMobileNavActive() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

// ============================================
// TOUCH SWIPE — close mobile menu on swipe-up
// ============================================
(function initSwipeClose() {
  let touchStartY = 0;
  document.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const deltaY = touchStartY - e.changedTouches[0].clientY;
    const menu = document.getElementById('mobile-menu');
    const burger = document.getElementById('hamburger');
    if (menu && menu.classList.contains('open') && deltaY > 50) {
      menu.classList.remove('open');
      if (burger) { burger.classList.remove('open', 'active'); burger.setAttribute('aria-expanded', 'false'); }
      document.body.style.overflow = '';
    }
  }, { passive: true });
})();

// Re-export realtime helpers so pages can import a single module
export { subscribeSetting, subscribeTable, onAuthChange };

// ============================================
// SITE-WIDE: APPEARANCE THEME + FOOTER LOGO + FOOTER HAMBURGER
// ============================================
export function initAppearance() {
  // Apply settings as CSS variables on :root; persisted in DB as 'appearance'.
  const root = document.documentElement;
  const body = document.body;
  const apply = (d) => {
    d = d || {};
    if (d.text_color)  root.style.setProperty('--theme-text-color', d.text_color);
    if (d.brightness !== undefined) root.style.setProperty('--theme-text-brightness', String(d.brightness));
    if (d.font_scale !== undefined) {
      root.style.setProperty('--theme-font-scale', String(d.font_scale));
      root.style.fontSize = (16 * (d.font_scale || 1)) + 'px';
    }
    if (d.font_family) {
      // Extract just the font-family value (strip any trailing "; font-style: italic" etc)
      const ff = d.font_family.split(';')[0].trim();
      const style = d.font_family.includes('italic') ? 'italic' : 'normal';
      root.style.setProperty('--theme-font-family', ff);
      root.style.setProperty('--font-main', ff);
      root.style.setProperty('--font-mono', ff);
      root.style.setProperty('--font-code', ff);
      // Apply directly to body and all text elements
      body.style.fontFamily = ff;
      body.style.fontStyle = style;
      document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,div,button,input,textarea,select,li,td,th,label').forEach(el => {
        el.style.fontFamily = ff;
        if (style === 'italic') el.style.fontStyle = 'italic';
      });
    } else {
      root.style.removeProperty('--theme-font-family');
      root.style.removeProperty('--font-main');
      root.style.removeProperty('--font-mono');
      root.style.removeProperty('--font-code');
      body.style.fontFamily = '';
      body.style.fontStyle = '';
    }
    if (d.apply_color) body.classList.add('theme-text-applied');
    else body.classList.remove('theme-text-applied');
  };
  // Apply cached value instantly to avoid FOUC
  try {
    const cached = JSON.parse(localStorage.getItem('appearance.cache') || 'null');
    if (cached) apply(cached);
  } catch {}
  subscribeSetting('appearance', (d) => {
    apply(d);
    try { localStorage.setItem('appearance.cache', JSON.stringify(d || {})); } catch {}
  });

  // Re-apply font to any dynamically injected elements
  const observer = new MutationObserver(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('appearance.cache') || 'null');
      if (cached && cached.font_family) {
        const ff = cached.font_family.split(';')[0].trim();
        const style = cached.font_family.includes('italic') ? 'italic' : 'normal';
        document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,div,button,li').forEach(el => {
          if (!el.style.fontFamily) {
            el.style.fontFamily = ff;
            if (style === 'italic') el.style.fontStyle = 'italic';
          }
        });
      }
    } catch {}
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function initFooterLogo() {
  const img = document.getElementById('header-logo-img');
  const fallback = document.getElementById('header-logo-fallback');
  if (!img) return;
  const apply = (d) => {
    const url = d && d.url;
    if (url) {
      img.src = url;
      img.style.display = 'block';
      if (fallback) fallback.style.display = 'none';
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
      if (fallback) fallback.style.display = 'flex';
    }
  };
  try {
    const cached = JSON.parse(localStorage.getItem('logo.cache') || 'null');
    if (cached) apply(cached);
  } catch {}
  subscribeSetting('logo', (d) => {
    apply(d);
    try { localStorage.setItem('logo.cache', JSON.stringify(d || {})); } catch {}
  });
}

export function initFooterHamburger() {
  const fb = document.getElementById('footer-hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!fb || !mobileMenu) return;
  const hamburger = document.getElementById('hamburger');
  fb.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !mobileMenu.classList.contains('open');
    mobileMenu.classList.toggle('open', open);
    fb.classList.toggle('open', open);
    fb.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (hamburger) {
      hamburger.classList.toggle('open', open);
      hamburger.classList.toggle('active', open);
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    document.body.style.overflow = open ? 'hidden' : '';
  });
  // Close when a link inside the mobile menu is clicked
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    fb.classList.remove('open');
    fb.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }));
}

// Auto-init these site-wide helpers on every page load (idempotent — guarded by element presence)
document.addEventListener('DOMContentLoaded', () => {
  try { initAppearance(); } catch {}
  try { initFooterLogo(); } catch {}
  try { initFooterHamburger(); } catch {}
});

/* ============================================
   ▓▓ PREMIUM UPGRADE LAYER ▓▓
   ============================================ */

// ---------- ISLAMIC HEADER (HOMEPAGE ONLY) ----------
export function initIslamicHeader() {
  if (document.querySelector('.islamic-header')) return;
  // Only on homepage (hero element exists only on index.html)
  if (!document.getElementById('hero')) return;
  const header = document.createElement('header');
  header.className = 'islamic-header';
  header.setAttribute('role', 'banner'); header.setAttribute('data-cms-section', 'islamic-header');
  header.innerHTML = `
    <div class="islamic-text" id="islamic-text">ﷻ لَا إِلٰهَ إِلَّا اللّٰهُ مُحَمَّدٌ رَسُوْلُ اللّٰهِ ﷺ</div>
    <div class="islamic-sub">In The Name Of Allah</div>
  `;
  // Insert AFTER the nav so the nav doesn't overlap it
  const nav = document.querySelector('nav');
  if (nav && nav.parentNode) nav.parentNode.insertBefore(header, nav.nextSibling);
  else document.body.insertBefore(header, document.body.firstChild);
}

// ---------- HERO ENHANCEMENTS ----------
const TYPED_PHRASES = [
  'Future Cybersecurity Professional',
  'Technology Enthusiast',
  'Continuous Learner',
  'Digital Explorer'
];

export function initHeroEnhancements() {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const bracket = hero.querySelector('.hero-bracket-box');
  if (!bracket) return;

  // Remove duplicate arabic now that header shows it
  const oldArabic = document.getElementById('arabic-text');
  if (oldArabic && oldArabic.closest('#hero')) oldArabic.remove();

  // Subtitle
  if (!hero.querySelector('.hero-subtitle')) {
    const sub = document.createElement('div');
    sub.className = 'hero-subtitle';
    sub.textContent = 'CYBERSECURITY • TECHNOLOGY • DIGITAL FUTURE';
    bracket.insertAdjacentElement('afterend', sub);
  }

  // Typing line
  if (!hero.querySelector('.hero-typed-wrap')) {
    const wrap = document.createElement('div');
    wrap.className = 'hero-typed-wrap';
    wrap.innerHTML = '> <span class="hero-typed" id="hero-typed"></span>';
    hero.querySelector('.hero-subtitle').insertAdjacentElement('afterend', wrap);
    startTyping();
  }

  // Tagline
  if (!hero.querySelector('.hero-tagline')) {
    const tag = document.createElement('div');
    tag.className = 'hero-tagline';
    tag.innerHTML = 'Building Knowledge. <span>Securing The Future.</span>';
    const btns = hero.querySelector('.hero-buttons');
    if (btns) btns.insertAdjacentElement('beforebegin', tag);
    else hero.appendChild(tag);
  }
}

function startTyping() {
  const el = document.getElementById('hero-typed');
  if (!el) return;
  let phraseIdx = 0, charIdx = 0, deleting = false;
  function tick() {
    const phrase = TYPED_PHRASES[phraseIdx % TYPED_PHRASES.length];
    if (!deleting) {
      charIdx++;
      el.textContent = phrase.slice(0, charIdx);
      if (charIdx >= phrase.length) { deleting = true; return setTimeout(tick, 1600); }
      setTimeout(tick, 55 + Math.random() * 45);
    } else {
      charIdx--;
      el.textContent = phrase.slice(0, charIdx);
      if (charIdx <= 0) { deleting = false; phraseIdx++; return setTimeout(tick, 250); }
      setTimeout(tick, 30);
    }
  }
  tick();
}

// ---------- AMBIENT PARTICLES ----------
export function initAmbientParticles() {
  if (document.querySelector('.ambient-particles')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wrap = document.createElement('div');
  wrap.className = 'ambient-particles';
  const count = window.innerWidth < 640 ? 14 : 28;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const size = 1 + Math.random() * 3;
    p.style.width = p.style.height = size + 'px';
    p.style.left = (Math.random() * 100) + 'vw';
    p.style.animationDuration = (10 + Math.random() * 18) + 's';
    p.style.animationDelay = (-Math.random() * 20) + 's';
    p.style.opacity = (0.25 + Math.random() * 0.55).toFixed(2);
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
}

// ---------- SCROLL REVEAL ----------
export function initScrollReveal() {
  const targets = document.querySelectorAll('.cyber-panel, .nav-card, .bottom-cards > *, .contact-card, .achievement-card, .gallery-item');
  if (!targets.length || !('IntersectionObserver' in window)) {
    targets.forEach(t => t.classList.add('reveal','in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(t => { t.classList.add('reveal'); io.observe(t); });
}

// ---------- LIGHTBOX (gallery) ----------
export function initLightbox() {
  const imgs = document.querySelectorAll('.gallery-item img, .gallery img');
  if (!imgs.length) return;
  let box = document.querySelector('.lightbox');
  if (!box) {
    box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = '<button class="lightbox-close" aria-label="Close">[ X ] CLOSE</button><img alt="">';
    document.body.appendChild(box);
    box.addEventListener('click', (e) => {
      if (e.target === box || e.target.classList.contains('lightbox-close')) {
        box.classList.remove('open');
        document.body.classList.remove('lightbox-open');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        box.classList.remove('open');
        document.body.classList.remove('lightbox-open');
      }
    });
  }
  const target = box.querySelector('img');
  imgs.forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      target.src = img.currentSrc || img.src;
      box.classList.add('open');
      document.body.classList.add('lightbox-open');
    });
  });
}

// ---------- OVERRIDE: LIVE FEED (user-spec messages) ----------
export function initLiveFeedPremium() {
  const container = document.getElementById('live-feed-content');
  if (!container) return;
  container.innerHTML = '';
  const messages = [
    '[+] Learning Status: ACTIVE',
    '[+] Skill Development: IN PROGRESS',
    '[+] Portfolio Status: ONLINE',
    '[+] Knowledge Base: EXPANDING',
    '[+] Cybersecurity Journey: ACTIVE'
  ];
  let idx = 0;
  const maxLines = 5;
  function typeLine(text, done) {
    const line = document.createElement('div');
    line.className = 'feed-line typing visible';
    container.appendChild(line);
    let i = 0;
    (function step() {
      line.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, 22);
      else { line.classList.remove('typing'); done && done(); }
    })();
    const lines = container.querySelectorAll('.feed-line');
    if (lines.length > maxLines) {
      lines[0].style.opacity = '0';
      setTimeout(() => lines[0].remove(), 300);
    }
  }
  function loop() {
    typeLine(messages[idx % messages.length], () => {
      idx++;
      setTimeout(loop, 1500 + Math.random() * 800);
    });
  }
  loop();
}

// ---------- OVERRIDE: LOADER (user-spec text) ----------
export function initLoaderPremium() {
  const screen = document.getElementById('loading-screen');
  if (!screen) return;
  const container = screen.querySelector('.boot-terminal');
  if (!container) return;
  container.innerHTML = `<div class="boot-bar"><div class="boot-bar-fill"></div></div>`;

  const lines = [
    '[ SYSTEM INITIALIZING ]',
    'Loading Interface...',
    'Loading Profile...',
    'Loading Experience...',
    'Loading Portfolio...',
    'ACCESS GRANTED',
    'Welcome, Visitor.'
  ];
  let i = 0;
  (function next() {
    if (i >= lines.length) {
      setTimeout(() => {
        screen.style.transition = 'opacity 0.7s ease';
        screen.style.opacity = '0';
        setTimeout(() => screen.remove(), 750);
      }, 450);
      return;
    }
    const div = document.createElement('div');
    div.className = 'boot-line active';
    if (lines[i] === 'ACCESS GRANTED' || lines[i] === 'Welcome, Visitor.') {
      div.classList.add('success');
    }
    div.textContent = lines[i];
    container.insertBefore(div, container.querySelector('.boot-bar'));
    setTimeout(() => { div.classList.remove('active'); div.classList.add('done'); i++; next(); }, 380);
  })();
}

// ---------- OVERRIDE: VISITOR PANEL (+base, with admin overrides) ----------
const VISITOR_BASE = 1000;
// Track when the site session started (page load time)
const __SESSION_START = Date.now();
async function loadVisitorPanelPremium() {
  const panel = document.getElementById('visitor-panel');
  if (!panel) return;

  const vl = (typeof cms !== 'undefined' && cms.visitor_labels) ? cms.visitor_labels : {
    total: 'TOTAL VISITORS', last: 'LAST VISIT', session: 'SESSION TIME',
    base: VISITOR_BASE, total_override: '', last_override: ''
  };

  let total = 0;
  try {
    const stats = await getVisitorStats();
    total = (stats?.total_visits || 0);
  } catch (e) { /* offline fallback */ }

  total = (vl.base ?? VISITOR_BASE) + (total || 0);
  let lastVisit = new Date().toLocaleString();

  if (vl.total_override !== '' && vl.total_override != null) total     = parseInt(vl.total_override, 10) || 0;
  if (vl.last_override  !== '' && vl.last_override  != null) lastVisit = String(vl.last_override);

  panel.innerHTML = `
    <div class="panel-title">// VISITOR ANALYTICS</div>
    <div class="visitor-stats">
      <div class="visitor-stat">
        <div class="visitor-stat-num" id="visit-counter">0</div>
        <div class="visitor-stat-label">${escapeHtml(vl.total || 'TOTAL VISITORS')}</div>
      </div>
      <div class="visitor-stat">
        <div class="visitor-stat-num" id="session-timer" style="font-size:clamp(18px,4.5vw,24px);letter-spacing:1px;">00:00:00</div>
        <div class="visitor-stat-label">${escapeHtml(vl.session || 'SESSION TIME')}</div>
      </div>
      <div class="visitor-stat">
        <div class="visitor-stat-num" style="font-size:11px;letter-spacing:1px;">${escapeHtml(lastVisit)}</div>
        <div class="visitor-stat-label">${escapeHtml(vl.last || 'LAST VISIT')}</div>
      </div>
    </div>
  `;

  // Animated count-up for total visitors
  let count = 0;
  const target = total;
  const step = Math.max(7, Math.floor(target / 60));
  const timer = setInterval(() => {
    count = Math.min(count + step, target);
    const el = document.getElementById('visit-counter');
    if (el) el.textContent = count.toLocaleString();
    if (count >= target) clearInterval(timer);
  }, 28);

  // Very slow live-tick: add +1 every 2-4 minutes
  if (!window.__visitorTickStarted) {
    window.__visitorTickStarted = true;
    function scheduleTick() {
      const delay = 120000 + Math.random() * 120000; // 2–4 minutes
      setTimeout(() => {
        const el = document.getElementById('visit-counter');
        if (el) {
          const cur = parseInt(el.textContent.replace(/[^\d]/g, ''), 10) || target;
          el.textContent = (cur + 1).toLocaleString();
        }
        scheduleTick();
      }, delay);
    }
    scheduleTick();
  }

  // Session timer — runs once globally; update every second
  if (!window.__sessionTimerStarted) {
    window.__sessionTimerStarted = true;
    setInterval(() => {
      const el = document.getElementById('session-timer');
      if (!el) return;
      const elapsed = Math.floor((Date.now() - __SESSION_START) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      el.textContent = `${h}:${m}:${s}`;
    }, 1000);
  }
}

// ---------- TWINKLING STARS (background) ----------
export function initStarsBg() {
  const wrap = document.getElementById('stars-bg');
  if (!wrap || wrap.dataset.ready) return;
  wrap.dataset.ready = '1';
  const count = window.innerWidth < 640 ? 60 : 140;
  let html = '';
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 100).toFixed(2);
    const y = (Math.random() * 100).toFixed(2);
    const layer = Math.floor(Math.random() * 3);
    const sizes = [0.9, 1.6, 2.6];
    const s = (sizes[layer] + Math.random() * 0.6).toFixed(1);
    const d = (2 + Math.random() * 4).toFixed(2);
    const delay = (-Math.random() * 6).toFixed(2);
    const tz = [-80, 0, 60][layer];
    html += `<i style="left:${x}vw;top:${y}vh;width:${s}px;height:${s}px;--sd:${d}s;--dl:${delay}s;--tz:${tz}px;animation-duration:${d}s;animation-delay:${delay}s"></i>`;
  }
  wrap.innerHTML = html;
}

// ---------- HACKER SCENE (homepage background) ----------
export function initHackerScene() {
  const scene = document.getElementById('hacker-scene');
  if (!scene) return;
  const screen = document.getElementById('hs-screen');
  if (!screen) return;
  // Double-height buffer so -50% translateY scroll is seamless
  function genBinary(rows, cols) {
    let s = '';
    for (let r = 0; r < rows; r++) {
      let row = '';
      for (let c = 0; c < cols; c++) row += Math.random() < 0.5 ? '0' : '1';
      s += row + '\n';
    }
    return s;
  }
  function paint() {
    // 2× height: top half scrolls out, bottom half seamlessly takes over
    screen.textContent = genBinary(50, 60) + genBinary(50, 60);
  }
  paint();
  setInterval(paint, 200);
}

// ---------- SHOOTING STARS (occasional streaks) ----------
export function initShootingStars() {
  const wrap = document.getElementById('shooting-stars');
  if (!wrap) return;
  function launch() {
    const star = document.createElement('i');
    star.style.left = (60 + Math.random() * 40) + 'vw';
    star.style.top  = (Math.random() * 50) + 'vh';
    star.classList.add('fly');
    wrap.appendChild(star);
    setTimeout(() => star.remove(), 1700);
    setTimeout(launch, 2500 + Math.random() * 5000);
  }
  setTimeout(launch, 1500);
}

// ---------- SKILLS ----------
export function initSkills() {
  const grid = document.getElementById('skills-grid');
  if (!grid) return;
  const skills = (typeof cms !== 'undefined' && Array.isArray(cms.skills) && cms.skills.length)
    ? cms.skills
    : (DEFAULTS.skills || []);
  grid.innerHTML = skills.map(sk => `
    <div class="skill-card">
      <div class="skill-card-header">
        <span class="skill-name">${escapeHtml(sk.name)}</span>
        <span class="skill-pct">${sk.level}%</span>
      </div>
      <div class="skill-bar"><div class="skill-bar-fill" style="width:0%" data-target="${sk.level}"></div></div>
    </div>
  `).join('');
  requestAnimationFrame(() => {
    grid.querySelectorAll('.skill-bar-fill').forEach(el => {
      setTimeout(() => { el.style.width = el.dataset.target + '%'; }, 200);
    });
  });
}

// ---------- BOOT (premium overrides run after the original DOMContentLoaded) ----------
window.addEventListener('DOMContentLoaded', () => {
  if (document.body && document.body.classList.contains('admin-body')) return;
  if (document.getElementById('dashboard-page')) return;
  initStarsBg();
  initHackerScene();
  initShootingStars();
  initIslamicHeader();
  initAmbientParticles();
  startLoaderWithCms();
  initHeroEnhancements();
  initLiveFeedPremium();
  initLightbox();
  initSkills();
  if (document.getElementById('visitor-panel')) {
    setTimeout(loadVisitorPanelPremium, 50);
  }
  // Scroll reveal last so all panels are mounted
  setTimeout(initScrollReveal, 100);
});

/* ============================================
   ▓▓ CMS BINDINGS — every premium string is editable ▓▓
   ============================================ */

const CMS_DEFAULTS = {
  islamic: {
    text: 'ﷻ لَا إِلٰهَ إِلَّا اللّٰهُ مُحَمَّدٌ رَسُوْلُ اللّٰهِ ﷺ',
    sub:  'In The Name Of Allah'
  },
  hero_extra: {
    subtitle: 'CYBERSECURITY • TECHNOLOGY • DIGITAL FUTURE',
    tagline_a: 'Building Knowledge.',
    tagline_b: 'Securing The Future.'
  },
  typing_phrases: [
    'Future Cybersecurity Professional',
    'Technology Enthusiast',
    'Continuous Learner',
    'Digital Explorer'
  ],
  loader_lines: [
    '[+] INITIALIZING CYBER SYSTEM...',
    '[+] LOADING SECURITY PROTOCOLS...',
    '[+] ESTABLISHING ENCRYPTED CONNECTION...',
    '[+] SYNCING SUPABASE DATABASE...',
    '[+] BYPASSING FIREWALL...',
    '[+] ACCESS GRANTED — WELCOME TO THE GRID'
  ],
  live_feed: [
    '[+] Learning Status: ACTIVE',
    '[+] Skill Development: IN PROGRESS',
    '[+] Portfolio Status: ONLINE',
    '[+] Knowledge Base: EXPANDING',
    '[+] Cybersecurity Journey: ACTIVE'
  ],
  visitor_labels: {
    total: 'TOTAL VISITORS',
    today: 'TODAY',
    session: 'SESSION TIME',
    last:  'LAST VISIT',
    base:  1000,
    total_override:  '',
    today_override:  '',
    last_override:   ''
  },
  skills: [
    { name: 'HTML', level: 90 },
    { name: 'CSS', level: 85 },
    { name: 'JavaScript', level: 75 },
    { name: 'Responsive Design', level: 80 },
    { name: 'Cybersecurity Fundamentals', level: 70 }
  ],
  footer: { quote: '© All Rights Reserved' },
  nav_menu: { home: 'HOME', educational: 'EDUCATIONAL', contact: 'CONTACT' },
  theme: { name: 'green' },                          // green | blue | red | purple
  visual: { glow: 1, anim: 1, particles: 1, matrix: 1, grid: 1 },
  sections: {}                                       // { sectionId: false } to hide
};

// in-memory cache populated from Supabase, falls back to defaults
const cms = JSON.parse(JSON.stringify(CMS_DEFAULTS));

async function loadCmsAll() {
  const keys = Object.keys(CMS_DEFAULTS);
  const settings = {};
  await Promise.all(keys.map(async k => {
    try {
      const v = await (await import('./supabase.js')).getSetting('cms_' + k);
      if (v && typeof v === 'object') settings[k] = v;
      if (Array.isArray(v)) settings[k] = v;
    } catch (_) {}
  }));
  for (const k of keys) {
    if (settings[k] != null) cms[k] = settings[k];
  }
}

function applyTheme(name) {
  document.body.classList.remove('theme-green','theme-blue','theme-red','theme-purple');
  document.body.classList.add('theme-' + (name || 'green'));
}
function applyVisual(v) {
  const r = document.documentElement.style;
  r.setProperty('--cms-glow-intensity', String(v.glow ?? 1));
  r.setProperty('--cms-anim-speed', String(v.anim ?? 1));
  r.setProperty('--cms-particle-opacity', String(v.particles ?? 1));
  const grid = document.querySelector('.grid-bg');
  if (grid) grid.style.opacity = String(v.grid ?? 1);
}
function applySections(map) {
  document.querySelectorAll('[data-cms-section]').forEach(el => {
    const id = el.getAttribute('data-cms-section');
    const hidden = map && map[id] === false;
    el.setAttribute('data-cms-hidden', hidden ? '1' : '0');
  });
}

// Subscribe to live edits
async function subscribeCms() {
  const { subscribeSetting } = await import('./supabase.js');
  subscribeSetting('cms_islamic', v => {
    if (v) cms.islamic = v;
    const t = document.getElementById('islamic-text');
    const s = document.querySelector('.islamic-header .islamic-sub');
    if (t) t.textContent = cms.islamic.text;
    if (s) s.textContent = cms.islamic.sub;
  });
  subscribeSetting('cms_hero_extra', v => {
    if (v) cms.hero_extra = v;
    const sub = document.querySelector('.hero-subtitle');
    if (sub) sub.textContent = cms.hero_extra.subtitle;
    const tag = document.querySelector('.hero-tagline');
    if (tag) tag.innerHTML = `${cms.hero_extra.tagline_a} <span>${cms.hero_extra.tagline_b}</span>`;
  });
  subscribeSetting('cms_typing_phrases', v => { if (Array.isArray(v) && v.length) cms.typing_phrases = v; });
  subscribeSetting('cms_loader_lines', v => { if (Array.isArray(v) && v.length) cms.loader_lines = v; });
  subscribeSetting('cms_live_feed',     v => { if (Array.isArray(v) && v.length) { cms.live_feed = v; initLiveFeedPremium(); } });
  subscribeSetting('cms_visitor_labels',v => { if (v) cms.visitor_labels = { ...cms.visitor_labels, ...v }; if (document.getElementById('visitor-panel')) loadVisitorPanelPremium(); });
  subscribeSetting('cms_skills',        v => { if (Array.isArray(v) && v.length) { cms.skills = v; initSkills(); } });
  subscribeSetting('cms_footer',        v => {
    if (v) cms.footer = v;
    document.querySelectorAll('.footer-copy').forEach(el => el.textContent = cms.footer.quote);
  });
  subscribeSetting('cms_nav_menu',      v => {
    if (v) cms.nav_menu = { ...cms.nav_menu, ...v };
    const map = { 'index.html': cms.nav_menu.home, 'educational.html': cms.nav_menu.educational, 'contact.html': cms.nav_menu.contact };
    document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
      const k = (a.getAttribute('href') || '').split('/').pop();
      if (map[k]) a.textContent = map[k];
    });
  });
  subscribeSetting('cms_theme',    v => { if (v) cms.theme = v; applyTheme(cms.theme.name); });
  subscribeSetting('cms_visual',   v => { if (v) cms.visual = { ...cms.visual, ...v }; applyVisual(cms.visual); });
  subscribeSetting('cms_sections', v => { if (v) cms.sections = v; applySections(cms.sections); });
}

// Make premium initializers consult cms before painting
const _origInitIslamic = initIslamicHeader;
initIslamicHeader = function () {
  _origInitIslamic();
  const t = document.getElementById('islamic-text');
  const s = document.querySelector('.islamic-header .islamic-sub');
  if (t) t.textContent = cms.islamic.text;
  if (s) s.textContent = cms.islamic.sub;
};

const _origInitHero = initHeroEnhancements;
initHeroEnhancements = function () {
  // Patch the global phrase list before hero typing starts
  TYPED_PHRASES.length = 0;
  cms.typing_phrases.forEach(p => TYPED_PHRASES.push(p));
  _origInitHero();
  const sub = document.querySelector('.hero-subtitle');
  if (sub) sub.textContent = cms.hero_extra.subtitle;
  const tag = document.querySelector('.hero-tagline');
  if (tag) tag.innerHTML = `${cms.hero_extra.tagline_a} <span>${cms.hero_extra.tagline_b}</span>`;
};

const _origInitLoader = initLoaderPremium;
initLoaderPremium = function () {
  // Patch loader lines used by the original implementation by overriding inline
  const screen = document.getElementById('loading-screen');
  if (!screen) return;
  const container = screen.querySelector('.boot-terminal');
  if (!container) return;
  container.innerHTML = `<div class="boot-bar"><div class="boot-bar-fill"></div></div>`;
  const lines = cms.loader_lines;
  let i = 0;
  (function next() {
    if (i >= lines.length) {
      setTimeout(() => {
        screen.style.transition = 'opacity 0.7s ease';
        screen.style.opacity = '0';
        setTimeout(() => { document.body.classList.remove('booting'); screen.remove(); }, 750);
      }, 450);
      return;
    }
    const div = document.createElement('div');
    div.className = 'boot-line active';
    if (i >= lines.length - 2) div.classList.add('success');
    div.textContent = lines[i];
    container.insertBefore(div, container.querySelector('.boot-bar'));
    setTimeout(() => { div.classList.remove('active'); div.classList.add('done'); i++; next(); }, 380);
  })();
};

// Fetch admin-customized loader lines (if any) with a short bounded wait,
// then start the loader exactly once. A network hiccup or slow response
// just falls back to the defaults already in `cms.loader_lines` — the
// loader is never blocked or delayed waiting on the network.
async function startLoaderWithCms() {
  try {
    const { getSetting } = await import('./supabase.js');
    const timeout = new Promise(resolve => setTimeout(() => resolve(null), 350));
    const fetched = await Promise.race([getSetting('cms_loader_lines'), timeout]);
    if (Array.isArray(fetched) && fetched.length) cms.loader_lines = fetched;
  } catch (_) { /* use defaults */ }
  initLoaderPremium();
}

const _origInitFeed = initLiveFeedPremium;
initLiveFeedPremium = function () {
  const container = document.getElementById('live-feed-content');
  if (!container) return;
  container.innerHTML = '';
  const messages = cms.live_feed;
  let idx = 0;
  const maxLines = 5;
  function typeLine(text, done) {
    const line = document.createElement('div');
    line.className = 'feed-line typing visible';
    container.appendChild(line);
    let i = 0;
    (function step() {
      line.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, 22);
      else { line.classList.remove('typing'); done && done(); }
    })();
    const lines = container.querySelectorAll('.feed-line');
    if (lines.length > maxLines) { lines[0].style.opacity = '0'; setTimeout(() => lines[0].remove(), 300); }
  }
  (function loop() {
    typeLine(messages[idx % messages.length], () => { idx++; setTimeout(loop, 1500 + Math.random() * 800); });
  })();
};

// CMS boot — fetch first, then re-run premium initializers, then subscribe
(async function bootCms() { if (document.body && document.body.classList.contains("admin-body")) return; if (document.getElementById("dashboard-page")) return;
  await loadCmsAll();
  applyTheme(cms.theme.name);
  applyVisual(cms.visual);
  // Re-apply premium pieces with CMS values once DOM is ready
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }
  // Re-run with patched values (idempotent: each init guards by existence)
  // NOTE: initLoaderPremium is intentionally NOT re-run here. It already
  // started (and is usually still animating) by the time this resolves;
  // calling it again would start a second concurrent boot-line loop and
  // cause the loading screen to flicker/duplicate lines. The loader
  // instead fetches its own lines up front — see startLoaderWithCms().
  initIslamicHeader();
  initHeroEnhancements();
  initLiveFeedPremium();
  initSkills();
  if (document.getElementById('visitor-panel')) loadVisitorPanelPremium();
  applySections(cms.sections);
  // Footer copy
  document.querySelectorAll('.footer-copy').forEach(el => el.textContent = cms.footer.quote);
  await subscribeCms();
})();

/* ============================================================
   v13 — runtime helpers (Dec 2026)
   - initHackerSceneV13: JS-driven binary roll (keeps monitor full)
   - initPerTextStyles : reads `per_text_styles` setting and applies
                         per-element font-size + color on every page
   - initBgScene      : ensures hacker-scene & stars exist on sub-pages
   ============================================================ */

export const PER_TEXT_TARGETS = [
  { id:'hero-name',     label:'Hero Name (MOHAMMAD NAZMUL HASAN)', selector:'#hero-name',          single:true  },
  { id:'arabic-text',   label:'Arabic Line',                       selector:'#arabic-text',        single:true  },
  { id:'about-intro',   label:'About Intro Paragraph',             selector:'#about-intro',        single:true  },
  { id:'about-label',   label:'About Item Labels',                 selector:'.about-label',        single:false },
  { id:'about-text',    label:'About Item Text',                   selector:'.about-text',         single:false },
  { id:'panel-title',   label:'Panel Titles',                      selector:'.panel-title',        single:false },
  { id:'status-key',    label:'Status Keys',                       selector:'.status-key',         single:false },
  { id:'status-value',  label:'Status Values',                     selector:'.status-value',       single:false },
  { id:'system-secure', label:'System Secure Line',                selector:'.system-secure',      single:true  },
  { id:'live-feed',     label:'Live Feed Lines',                   selector:'.live-feed-content',  single:false },
  { id:'skill-name',    label:'Skill Names',                       selector:'.skill-name',         single:false },
  { id:'skill-pct',     label:'Skill Percentages',                 selector:'.skill-pct',          single:false },
  { id:'btn-cyber',     label:'Hero Buttons',                      selector:'.btn-cyber',          single:false },
  { id:'card-label',    label:'Bottom Card Labels',                selector:'.card-label',         single:false },
  { id:'nav-link',      label:'Nav Links',                         selector:'.nav-links a, .mobile-menu a', single:false },
  { id:'logo-text',     label:'Logo Text',                         selector:'.logo-text',          single:false },
  { id:'page-title',    label:'Page Titles',                       selector:'.page-title',         single:false },
  { id:'page-subtitle', label:'Page Subtitles',                    selector:'.page-subtitle',      single:false },
  { id:'footer-copy',   label:'Footer Copy',                       selector:'.footer-copy',        single:false }
];

export function initPerTextStyles() {
  const STYLE_ID = 'per-text-styles-runtime';
  let lastData = {};
  function applyTextOverrides(d) {
    for (const t of PER_TEXT_TARGETS) {
      if (!t.single) continue;
      const v = d[t.id];
      const el = document.querySelector(t.selector);
      if (!el) continue;
      if (v && v.text) {
        if (!el.dataset.ptOriginal) el.dataset.ptOriginal = el.textContent;
        if (el.textContent !== v.text) el.textContent = v.text;
      } else if (el.dataset.ptOriginal) {
        el.textContent = el.dataset.ptOriginal;
        delete el.dataset.ptOriginal;
      }
    }
  }
  function apply(d) {
    d = d || {};
    lastData = d;
    let css = '';
    for (const t of PER_TEXT_TARGETS) {
      const v = d[t.id];
      if (!v) continue;
      const decls = [];
      if (v.size)  decls.push(`font-size:${v.size} !important;`);
      if (v.color) decls.push(`color:${v.color} !important;`);
      if (v.color) decls.push(`-webkit-text-fill-color:${v.color} !important;`);
      if (v.color) decls.push(`background:none !important;-webkit-background-clip:initial !important;background-clip:initial !important;`);
      if (decls.length) css += `${t.selector}{${decls.join('')}}\n`;
    }
    let tag = document.getElementById(STYLE_ID);
    if (!tag) {
      tag = document.createElement('style');
      tag.id = STYLE_ID;
      document.head.appendChild(tag);
    }
    tag.textContent = css;
    applyTextOverrides(d);
    try { localStorage.setItem('per_text_styles.cache', JSON.stringify(d)); } catch {}
  }
  try {
    const cached = JSON.parse(localStorage.getItem('per_text_styles.cache') || 'null');
    if (cached) apply(cached);
  } catch {}
  try {
    subscribeSetting('per_text_styles', apply);
  } catch (e) { /* setting may not exist yet */ }
  // Re-apply text overrides whenever DOM changes (e.g. CMS replaces content)
  try {
    const mo = new MutationObserver(() => applyTextOverrides(lastData));
    mo.observe(document.body, { childList:true, subtree:true, characterData:true });
  } catch {}
}

/* v13 — Hacker scene driven from JS so monitor never empties */
export function initHackerSceneV13() {
  const screen = document.getElementById('hs-screen');
  if (!screen) return;
  // Stop any previous interval to avoid double-paint
  if (screen.__v13Interval) { clearInterval(screen.__v13Interval); }
  const COLS = 60;
  let ROWS = 48; // enough to fill the monitor at smallest line-height
  function row() {
    let r = '';
    for (let i = 0; i < COLS; i++) r += Math.random() < 0.5 ? '0' : '1';
    return r;
  }
  // Compute rows that fit comfortably
  function computeRows() {
    const m = document.querySelector('.hs-monitor');
    if (!m) return;
    const h = m.clientHeight || 100;
    const lh = parseFloat(getComputedStyle(screen).lineHeight) || 6;
    ROWS = Math.max(30, Math.ceil(h / lh) + 4);
  }
  computeRows();
  window.addEventListener('resize', () => { computeRows(); });
  const lines = [];
  for (let i = 0; i < ROWS; i++) lines.push(row());
  screen.textContent = lines.join('\n');
  screen.__v13Interval = setInterval(() => {
    lines.push(row());
    while (lines.length > ROWS) lines.shift();
    screen.textContent = lines.join('\n');
  }, 130);
}

/* Inject background scene into a page that doesn't include it */
export function ensureBackgroundScene() {
  if (document.getElementById('hacker-scene')) return; // already there
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="stars-bg" id="stars-bg" aria-hidden="true"></div>
    <div class="hacker-scene" id="hacker-scene" aria-hidden="true">
      <div class="hs-desk"></div>
      <div class="hs-keyboard"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="hs-monitor">
        <div class="hs-screen" id="hs-screen"></div>
        <div class="hs-scanline"></div>
        <div class="hs-flicker"></div>
      </div>
      <div class="hs-figure">
        <div class="hs-hat"></div>
        <div class="hs-head"></div>
        <div class="hs-body"></div>
        <div class="hs-arm hs-arm-l"></div>
        <div class="hs-arm hs-arm-r"></div>
      </div>
    </div>
    <div class="shooting-stars" id="shooting-stars" aria-hidden="true"></div>
  `;
  // Prepend so it sits behind everything
  while (wrap.firstChild) document.body.insertBefore(wrap.firstChild, document.body.firstChild);
}

/* Convenience boot for sub-pages */
export function initBgSceneAll() {
  ensureBackgroundScene();
  try { initStarsBg(); } catch {}
  try { initHackerSceneV13(); } catch {}
  try { initShootingStars(); } catch {}
  try { initIslamicHeader(); } catch {}
}

/* Auto-init per-text styles + replace old hacker scene loop on every page */
window.addEventListener('DOMContentLoaded', () => {
  // Replace the v0 hacker scene loop with the v13 always-full version
  setTimeout(() => { try { initHackerSceneV13(); } catch {} }, 50);
  // Apply per-text style overrides
  try { initPerTextStyles(); } catch {}
});
