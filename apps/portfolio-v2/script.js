/* ============================================================
   PORTFOLIO V2 — "THE CINEMATIC FUTURE CITY"
   Implements CINEMATIC-FUTURE-CITY-ARCHITECTURE.md.

   This is a from-scratch build sharing NOTHING presentational with
   the previous Portfolio V2 (no glass cards, no dot-rail, no
   particle-field background) — it is a full WebGL city with a
   scroll-driven camera flight and a holographic content layer.

   Data model: reuses the exact same shared content (hero / about /
   contact / cms_skills / gallery / achievements / educational / logo)
   that Portfolio V1 reads — see shared/supabase.js. Gallery rows are
   read with 4 additional optional columns (title/tech_tags/demo_url/
   repo_url) added additively in SETUP.sql for the Project Boulevard;
   V1 does not reference them and is unaffected.

   Business logic (auth/CRUD/storage/version-switching) is NEVER
   duplicated here — only `shared/supabase.js` and `shared/api.js`
   are imported, exactly like every other app in this project.
   ============================================================ */

import { getSetting, subscribeSetting, listRows, subscribeTable, recordVisit } from '../../shared/supabase.js';
import { watchVersionSwitch } from '../../shared/api.js';

watchVersionSwitch('portfolio', 'v2');
recordVisit();

if (new URLSearchParams(location.search).get('preview') === '1') {
  document.title = '[PREVIEW] ' + document.title;
}

/* ============================================================
   0. SMALL UTILITIES
   ============================================================ */
const rand = (a, b) => a + Math.random() * (b - a);
const choice = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function lerpColor(c1, c2, t) {
  const c = new THREE.Color(c1).lerp(new THREE.Color(c2), clamp(t, 0, 1));
  return c;
}
// smootherstep — used to ease every zone transition (arrival/departure)
function smoother(p) { p = clamp(p, 0, 1); return p * p * p * (p * (p * 6 - 15) + 10); }
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
}

const reduceMotionOS = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   1. CONTENT STATE (populated from Supabase, drives both the
      holographic panels AND the data-driven world layout)
   ============================================================ */
const content = {
  hero: { name: 'Your Name', arabic: '', btn1_text: 'Resume', btn1_link: '#', btn2_text: 'GitHub', btn2_link: 'https://github.com' },
  about: { intro: '', items: [] },
  contact: {},
  skills: [],       // [{name, level}]
  projects: [],     // gallery rows, published only
  achievements: [], // published only
  education: [],    // published only
  logo: null,
  siteMeta: null,
};

/* ============================================================
   2. DOM REFERENCES
   ============================================================ */
const canvas = document.getElementById('city-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingFill = document.getElementById('loading-fill');
const loadingSub = document.getElementById('loading-sub');
const prelude = document.getElementById('prelude');
const hud = document.getElementById('hud');
const hudName = document.getElementById('hud-name');
const hudZone = document.getElementById('hud-zone');
const progressFill = document.getElementById('progress-fill');
const a11yToggle = document.getElementById('a11y-toggle');
const spacer = document.getElementById('scroll-spacer');

let reducedMotion = reduceMotionOS;
function setReducedMotion(on) {
  reducedMotion = on;
  a11yToggle.setAttribute('aria-pressed', String(on));
  a11yToggle.textContent = 'Reduced Motion: ' + (on ? 'On' : 'Off');
}
setReducedMotion(reduceMotionOS);
a11yToggle.addEventListener('click', () => setReducedMotion(!reducedMotion));

/* ============================================================
   3. THREE.JS BASE SCENE
   ============================================================ */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030814);
scene.fog = new THREE.FogExp2(0x061422, 0.0026); // atmospheric perspective — Part 4.4 / 3.5

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 4000);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Base lighting: single night-time baseline, mood tinting layered per-district (Part 10) ----
const hemi = new THREE.HemisphereLight(0x2a3a55, 0x05070c, 0.55);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xbfd4ff, 0.35);
moon.position.set(-200, 400, -300);
scene.add(moon);
const moodLight = new THREE.PointLight(0xffffff, 1.4, 260, 2);
moodLight.position.set(0, 40, 0);
scene.add(moodLight);

// ---- Stars ----
(function addStars() {
  const starCount = 1400;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = rand(600, 1500);
    const theta = rand(0, Math.PI * 2);
    const phi = rand(0.05, 0.55) * Math.PI;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 120;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xdfefff, size: 1.4, transparent: true, opacity: 0.7, sizeAttenuation: true });
  scene.add(new THREE.Points(geo, mat));
})();

// ---- Procedural environment map (real reflections without an external HDRI file) ----
// Builds a tiny gradient "night sky" scene once, bakes it into a PMREM env map,
// and assigns it to scene.environment so every MeshStandardMaterial with
// metalness/roughness gets physically-plausible reflections for free.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
function buildEnvironmentMap() {
  const envScene = new THREE.Scene();
  const skyGeo = new THREE.SphereGeometry(50, 16, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(0x0b1626) },
      bottom: { value: new THREE.Color(0x02030a) },
      horizonGlow: { value: new THREE.Color(0x3a4a66) },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top; uniform vec3 bottom; uniform vec3 horizonGlow;
      void main(){
        float h = normalize(vPos).y;
        vec3 col = mix(bottom, top, smoothstep(-0.2, 0.6, h));
        col = mix(horizonGlow, col, smoothstep(-0.05, 0.25, abs(h)));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));
  const rt = pmremGenerator.fromScene(envScene, 0.04);
  scene.environment = rt.texture;
  envScene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
}
buildEnvironmentMap();

// ---- Post-processing: bloom (for neon/window glow) on top of ACES tone mapping ----
let composer = null, bloomPass = null;
if (window.THREE.EffectComposer) {
  composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.82);
  composer.addPass(bloomPass);
  window.addEventListener('resize', () => composer.setSize(window.innerWidth, window.innerHeight));
}

/* ============================================================
   4. TEXTURE FACTORIES (canvas-generated, so windows can
      re-light over time without new assets — Part 9 / 12.5)
   ============================================================ */
function makeWindowCanvas(cols, rows, baseHex) {
  const c = document.createElement('canvas');
  c.width = cols * 8; c.height = rows * 8;
  const ctx = c.getContext('2d');
  const draw = (litRatio) => {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = Math.random() < litRatio;
        ctx.fillStyle = lit
          ? `rgba(${choice([255, 255, 230])},${choice([220, 235, 200])},${choice([160, 190, 255])},${rand(0.55, 1)})`
          : 'rgba(10,14,22,0.9)';
        ctx.fillRect(x * 8 + 1, y * 8 + 1, 6, 6);
      }
    }
  };
  draw(rand(0.18, 0.4));
  return { canvas: c, ctx, redraw: draw };
}

function makeBillboardCanvas(lines, accentHex) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 288;
  const ctx = c.getContext('2d');
  const draw = (text) => {
    ctx.fillStyle = '#050a12'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = accentHex; ctx.lineWidth = 6; ctx.strokeRect(6, 6, c.width - 12, c.height - 12);
    ctx.fillStyle = accentHex;
    ctx.font = 'bold 40px Sora, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, c.height / 2);
  };
  draw(choice(lines));
  return { canvas: c, ctx, draw, lines };
}

/* ============================================================
   5. BUILDING FACTORY (modular-kit-flavored: shared proportions,
      per-instance material/window variation — Part 4, 5, 6, 17.2)
   ============================================================ */
const FACADE_PALETTES = [
  { glass: 0x1c2b3d, trim: 0x9fb4c8 },
  { glass: 0x18232f, trim: 0xc8b98a },
  { glass: 0x1a2230, trim: 0x8ab0c8 },
  { glass: 0x211c30, trim: 0xb69fe0 },
];

function createBuilding({ width, depth, height, palette, crown = 'flat', windowRows = null, litRatio = null }) {
  const group = new THREE.Group();
  const pal = palette || choice(FACADE_PALETTES);
  const cols = Math.max(3, Math.round(width / 3));
  const rows = windowRows || Math.max(4, Math.round(height / 3.2));
  const tex = makeWindowCanvas(cols, rows, '#' + pal.glass.toString(16).padStart(6, '0'));
  if (litRatio) tex.redraw(litRatio);
  const canvasTex = new THREE.CanvasTexture(tex.canvas);
  canvasTex.encoding = THREE.sRGBEncoding;

  const bodyMat = new THREE.MeshStandardMaterial({
    map: canvasTex, roughness: 0.35, metalness: 0.55,
    color: 0xffffff, emissive: 0x0a0e14, emissiveIntensity: 0.15,
    envMap: scene.environment, envMapIntensity: 1.1,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
  body.position.y = height / 2;
  group.add(body);

  // grime/weathering: soft vertical streaks + corner darkening, randomized per
  // instance so no two buildings read as identical (Part 6 "imperfection" rule)
  (function addGrime() {
    const gc = document.createElement('canvas'); gc.width = 64; gc.height = 128;
    const gctx = gc.getContext('2d');
    gctx.clearRect(0, 0, 64, 128);
    const streaks = Math.floor(rand(3, 8));
    for (let i = 0; i < streaks; i++) {
      const x = rand(0, 64);
      const grad = gctx.createLinearGradient(x, 0, x, rand(40, 128));
      grad.addColorStop(0, 'rgba(20,18,14,' + rand(0.08, 0.22) + ')');
      grad.addColorStop(1, 'rgba(20,18,14,0)');
      gctx.fillStyle = grad;
      gctx.fillRect(x - rand(1, 3), 0, rand(2, 6), 128);
    }
    gctx.fillStyle = 'rgba(10,10,8,0.14)';
    gctx.fillRect(0, 108, 64, 20); // base grime near street level
    const gtex = new THREE.CanvasTexture(gc);
    const grimeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.05, height, depth + 0.05),
      new THREE.MeshBasicMaterial({ map: gtex, transparent: true, opacity: rand(0.5, 0.9), depthWrite: false })
    );
    grimeMesh.position.y = height / 2;
    group.add(grimeMesh);
  })();

  // trim bands — exposed structural steel / aluminum panels (Part 4.1)
  const trimMat = new THREE.MeshStandardMaterial({ color: pal.trim, roughness: 0.5, metalness: 0.7 });
  const bandCount = Math.max(1, Math.round(height / 24));
  for (let i = 1; i <= bandCount; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.6, depth + 0.4), trimMat);
    band.position.y = (height / (bandCount + 1)) * i;
    group.add(band);
  }

  // rooftop treatment (Part 4.1's rooftop gardens / mechanical penthouses,
  // Part 5's rooftop-profile uniqueness)
  if (crown === 'spire') {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(width * 0.12, height * 0.35, 8), trimMat);
    spire.position.y = height + (height * 0.35) / 2;
    group.add(spire);
    const beacon = new THREE.PointLight(0xff5566, 1.2, 40);
    beacon.position.y = height + height * 0.35;
    group.add(beacon);
  } else if (crown === 'penthouse') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, height * 0.06, depth * 0.6), trimMat);
    top.position.y = height + (height * 0.06) / 2;
    group.add(top);
    for (let i = 0; i < 2; i++) {
      const hv = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.05, width * 0.05, height * 0.05, 10), trimMat);
      hv.position.set(rand(-width * 0.2, width * 0.2), height + height * 0.09, rand(-depth * 0.2, depth * 0.2));
      group.add(hv);
    }
  } else if (crown === 'garden') {
    const garden = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.6, depth * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.9 }));
    garden.position.y = height + 0.3;
    group.add(garden);
  } else if (crown === 'dome') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(width * 0.5, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xd8e4ee, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 }));
    dome.position.y = height;
    group.add(dome);
  }

  // physical imperfection: subtle per-instance dirt/streak overlay (Part 6)
  bodyMat.roughness = clamp(bodyMat.roughness + rand(-0.08, 0.08), 0.15, 0.85);

  group.userData.relight = (ratio) => { tex.redraw(ratio); canvasTex.needsUpdate = true; };
  group.userData.bodyMat = bodyMat;
  return group;
}

/* ============================================================
   6. VEHICLES, PEOPLE, VEGETATION, PROPS (Part 12 ambient life)
   ============================================================ */
function createCar(colorHex) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.6, envMap: scene.environment, envMapIntensity: 1 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0c1622, roughness: 0.1, metalness: 0.4, envMap: scene.environment, envMapIntensity: 1.4 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 4.4), bodyMat);
  body.position.y = 0.42; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 2.1), glassMat);
  cabin.position.set(0, 0.86, -0.2); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 12);
  [[0.85, -1.4], [-0.85, -1.4], [0.85, 1.4], [-0.85, 1.4]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.32, z); g.add(w);
  });
  const headlight = new THREE.PointLight(0xfff2cc, 0.5, 8);
  headlight.position.set(0, 0.5, 2.3); g.add(headlight);
  return g;
}

function createTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 }));
  trunk.position.y = 1.1; g.add(trunk);
  const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0),
    new THREE.MeshStandardMaterial({ color: choice([0x2c5a34, 0x2f6a3a, 0x275030]), roughness: 0.85, flatShading: true }));
  canopy.position.y = 2.6; g.add(canopy);
  g.userData.swayPhase = rand(0, Math.PI * 2);
  g.userData.swayTarget = canopy;
  return g;
}

function createPedestrianSprite() {
  const c = document.createElement('canvas'); c.width = 24; c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(10,12,18,0.82)';
  ctx.beginPath(); ctx.ellipse(12, 8, 6, 7, 0, 0, Math.PI * 2); ctx.fill(); // head
  ctx.fillRect(6, 15, 12, 22); // torso
  ctx.fillRect(6, 36, 5, 12); ctx.fillRect(13, 36, 5, 12); // legs
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.1, 2.2, 1);
  return sprite;
}

function createCloudSprite(size, opacity) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(210,225,240,0.9)');
  grad.addColorStop(0.5, 'rgba(180,200,220,0.5)');
  grad.addColorStop(1, 'rgba(180,200,220,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size * 0.6, 1);
  return s;
}

function createStreetlight() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x333a44, metalness: 0.6, roughness: 0.5 }));
  pole.position.y = 2.5; g.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xfff2cc, emissiveIntensity: 1.2 }));
  lamp.position.y = 5.1; g.add(lamp);
  return g;
}

function createFountainParticles() {
  const count = 60;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0;
    phases[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xbfe8ff, size: 0.18, transparent: true, opacity: 0.85 });
  const pts = new THREE.Points(geo, mat);
  pts.userData.phases = phases;
  return pts;
}

/* ============================================================
   7. WORLD GROUPS
   ============================================================ */
const worldGroup = new THREE.Group();
scene.add(worldGroup);

const cloudGroupNear = new THREE.Group(); scene.add(cloudGroupNear); // Zone 0/1 dense cover
const skyCloudGroup = new THREE.Group(); scene.add(skyCloudGroup);   // Part 12.8 thin background clouds
const backdropGroup = new THREE.Group(); worldGroup.add(backdropGroup); // Part 3.5 / 7.3 filler city
const trafficGroup = new THREE.Group(); worldGroup.add(trafficGroup);
const droneGroup = new THREE.Group(); worldGroup.add(droneGroup);
const pedestrianGroup = new THREE.Group(); worldGroup.add(pedestrianGroup);
const vegetationGroup = new THREE.Group(); worldGroup.add(vegetationGroup);
const streetlightGroup = new THREE.Group(); worldGroup.add(streetlightGroup);
const billboardGroup = new THREE.Group(); worldGroup.add(billboardGroup);
const fountainGroup = new THREE.Group(); worldGroup.add(fountainGroup);
const boulevardGroup = new THREE.Group(); worldGroup.add(boulevardGroup);
const campusGroup = new THREE.Group(); worldGroup.add(campusGroup);
const learningGroup = new THREE.Group(); worldGroup.add(learningGroup);
const roadGroup = new THREE.Group(); worldGroup.add(roadGroup);

// ---- Zone 0/1 cloud cover ----
for (let i = 0; i < 46; i++) {
  const s = createCloudSprite(rand(60, 140), rand(0.5, 0.9));
  s.position.set(rand(-260, 260), rand(150, 260), rand(-120, 260));
  s.userData.drift = rand(2, 6);
  cloudGroupNear.add(s);
}
// ---- Thin, always-drifting sky-layer clouds (Part 12 item 8) ----
for (let i = 0; i < 24; i++) {
  const s = createCloudSprite(rand(90, 180), rand(0.12, 0.25));
  s.position.set(rand(-500, 900), rand(220, 340), rand(-100, 1700));
  s.userData.drift = rand(1, 3);
  skyCloudGroup.add(s);
}

// ---- Ground plane + simple road ribbon along the whole route ----
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2400, 2400),
  new THREE.MeshStandardMaterial({ color: 0x0b1119, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
worldGroup.add(ground);

function makeRoadTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#161b22'; ctx.fillRect(0, 0, 64, 512);
  ctx.strokeStyle = 'rgba(255,220,140,0.6)'; ctx.lineWidth = 3; ctx.setLineDash([26, 22]);
  ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(32, 512); ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 60);
  return tex;
}
const roadTex = makeRoadTexture();
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 1900),
  new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 })
);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.02, 850);
roadGroup.add(road);

// ---- Distant filler city (Part 3.5 / 7.3 — "the city continues beyond view") ----
(function buildBackdrop() {
  for (let i = 0; i < 220; i++) {
    const w = rand(10, 26), d = rand(10, 26), h = rand(14, 90);
    const b = createBuilding({ width: w, depth: d, height: h, crown: choice(['flat', 'penthouse', 'garden']), windowRows: 6, litRatio: rand(0.1, 0.3) });
    const side = choice([-1, 1]);
    b.position.set(side * rand(70, 340), 0, rand(-100, 1750));
    b.userData.bodyMat.emissiveIntensity = 0.08;
    backdropGroup.add(b);
  }
  // distant construction cranes — Part 6.2, reinforces "city continues, has its own life"
  for (let i = 0; i < 5; i++) {
    const crane = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 46, 6), new THREE.MeshStandardMaterial({ color: 0xd9a441 }));
    mast.position.y = 23; crane.add(mast);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(34, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xd9a441 }));
    arm.position.y = 45; crane.add(arm);
    crane.position.set(choice([-1, 1]) * rand(200, 320), 0, rand(0, 1700));
    backdropGroup.add(crane);
  }
})();

/* ============================================================
   8. DISTRICT DEFINITIONS (fixed, singular landmarks)
      Positions/sizes chosen so silhouettes differ per Part 5.
   ============================================================ */
const Z = {
  cloudEnd: 40,
  descentEnd: 300,
  streetEnd: 430,
  hqZ: 480,
  boulevardStart: 560,
};

// ---- Headquarters (Zone 3) — tallest single central tower, tapered crown ----
const hqHeight = 150;
const hq = createBuilding({ width: 30, depth: 30, height: hqHeight, palette: FACADE_PALETTES[1], crown: 'spire', windowRows: 30, litRatio: 0.5 });
hq.position.set(0, 0, Z.hqZ);
worldGroup.add(hq);

// ---- Museum + Tower are positioned once total boulevard/campus length is known ----
let museum = null;
let tower = null;
let towerHeight = 190;

/* ============================================================
   9. DATA-DRIVEN DISTRICTS (rebuilt whenever content changes)
   ============================================================ */
let layout = null; // computed by rebuildLayout()

function clearGroup(group) {
  while (group.children.length) {
    const c = group.children.pop();
    c.traverse?.(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }
}

const holoAnchors = []; // {id, obj3d/position, kind, data}

function rebuildLayout() {
  holoAnchors.length = 0;
  clearGroup(boulevardGroup);
  clearGroup(campusGroup);
  clearGroup(learningGroup);
  clearGroup(fountainGroup);
  clearGroup(streetlightGroup);

  // HQ anchor (identity + about, per resolved "About" placement — Part 2)
  holoAnchors.push({ id: 'hq', kind: 'hq', pos: new THREE.Vector3(0, hqHeight * 0.55, Z.hqZ) });

  const projects = content.projects.length ? content.projects : [{ title: 'Project coming soon', caption: '', tech_tags: [], demo_url: '', repo_url: '' }];
  const eduItems = content.education.length ? content.education : [{ cat: '', title: 'Education stage coming soon', description: '', year: '' }];

  // ---- ZONE 4: PROJECT BOULEVARD — real avenue, length driven by project count (Part 3.3) ----
  const spacing = 46;
  let z = Z.boulevardStart;
  projects.forEach((p, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const width = rand(12, 20), depth = rand(12, 20), height = rand(30, 78);
    const b = createBuilding({ width, depth, height, crown: choice(['penthouse', 'garden', 'flat']), litRatio: rand(0.25, 0.55) });
    b.position.set(side * 24, 0, z);
    boulevardGroup.add(b);
    if (i % 3 === 0) {
      const sl = createStreetlight(); sl.position.set(-side * 10, 0, z - 8); streetlightGroup.add(sl);
    }
    holoAnchors.push({ id: 'project-' + i, kind: 'project', pos: new THREE.Vector3(side * 24, height * 0.6, z), data: p });
    z += spacing;
  });
  const boulevardEnd = z;

  // ---- ZONE 5: TECHNOLOGY CAMPUS — campus buildings + floating rotating skill icons ----
  const campusZStart = boulevardEnd + 40;
  const campusCenter = new THREE.Vector3(46, 0, campusZStart + 90);
  for (let i = 0; i < 5; i++) {
    const w = rand(14, 22), d = rand(14, 22), h = rand(20, 40);
    const b = createBuilding({ width: w, depth: d, height: h, palette: FACADE_PALETTES[3], crown: 'penthouse', litRatio: rand(0.3, 0.5) });
    const angle = (i / 5) * Math.PI * 1.4;
    b.position.set(campusCenter.x + Math.cos(angle) * 34, 0, campusCenter.z + Math.sin(angle) * 34);
    campusGroup.add(b);
  }
  const skills = content.skills.length ? content.skills : [{ name: 'Skill' }];
  const iconGeoPool = [new THREE.IcosahedronGeometry(1.6, 0), new THREE.OctahedronGeometry(1.7, 0), new THREE.TorusGeometry(1.3, 0.4, 8, 16)];
  skills.forEach((s, i) => {
    const angle = (i / skills.length) * Math.PI * 2;
    const r = 20 + (i % 3) * 6;
    const pos = new THREE.Vector3(campusCenter.x + Math.cos(angle) * r, rand(14, 26), campusCenter.z + Math.sin(angle) * r);
    const mesh = new THREE.Mesh(choice(iconGeoPool), new THREE.MeshStandardMaterial({
      color: 0xb98bff, emissive: 0x6a3fbf, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.4, wireframe: Math.random() < 0.35,
    }));
    mesh.position.copy(pos);
    mesh.userData.spin = rand(0.2, 0.6);
    campusGroup.add(mesh);
    holoAnchors.push({ id: 'skill-' + i, kind: 'skill', pos, data: s });
  });
  const campusZEnd = campusZStart + 200;

  // ---- ZONE 6: LEARNING CAMPUS — one building per education stage, visited in sequence ----
  const learnZStart = campusZEnd + 40;
  const learnCenter = new THREE.Vector3(-46, 0, learnZStart + 30);
  let lz = learnCenter.z;
  eduItems.forEach((e, i) => {
    const w = 16, d = 16, h = rand(24, 46);
    const b = createBuilding({ width: w, depth: d, height: h, palette: FACADE_PALETTES[2], crown: 'garden', litRatio: rand(0.25, 0.4) });
    b.position.set(learnCenter.x + (i % 2 === 0 ? -14 : 14), 0, lz);
    learningGroup.add(b);
    holoAnchors.push({ id: 'edu-' + i, kind: 'education', pos: new THREE.Vector3(learnCenter.x + (i % 2 === 0 ? -14 : 14), h * 0.6, lz), data: e });
    lz += 44;
  });
  const learnZEnd = lz + 20;

  // ---- ZONE 7: MUSEUM — singular, calm, distinct silhouette (dome) ----
  const museumZ = learnZEnd + 70;
  if (museum) worldGroup.remove(museum);
  museum = createBuilding({ width: 42, depth: 30, height: 22, palette: { glass: 0x22241c, trim: 0xd8c79a }, crown: 'dome', windowRows: 4, litRatio: 0.35 });
  museum.position.set(0, 0, museumZ);
  worldGroup.add(museum);
  holoAnchors.push({ id: 'museum', kind: 'museum-hub', pos: new THREE.Vector3(0, 14, museumZ) });
  content.achievements.forEach((a, i) => {
    const angle = (i / Math.max(1, content.achievements.length)) * Math.PI * 2;
    holoAnchors.push({ id: 'ach-' + i, kind: 'achievement', pos: new THREE.Vector3(Math.cos(angle) * 16, 10 + (i % 3) * 3, museumZ + Math.sin(angle) * 12), data: a });
  });

  // ---- ZONE 8: COMMUNICATION TOWER — tallest structure, climax ----
  const towerZ = museumZ + 120;
  towerHeight = 210;
  if (tower) worldGroup.remove(tower);
  tower = createBuilding({ width: 26, depth: 26, height: towerHeight, palette: FACADE_PALETTES[1], crown: 'spire', windowRows: 40, litRatio: 0.6 });
  tower.position.set(0, 0, towerZ);
  worldGroup.add(tower);
  holoAnchors.push({ id: 'tower', kind: 'tower', pos: new THREE.Vector3(0, towerHeight * 0.5, towerZ) });

  // fountains along boulevard + campus plazas (Part 12 item 6)
  [{ x: 0, z: Z.hqZ + 40 }, { x: campusCenter.x, z: campusCenter.z - 40 }].forEach(p => {
    const f = createFountainParticles(); f.position.set(p.x, 0.5, p.z); fountainGroup.add(f);
  });

  // vegetation scattered along the whole route
  clearGroup(vegetationGroup);
  const totalZ = towerZ + 80;
  for (let i = 0; i < 140; i++) {
    const t = createTree();
    t.position.set(rand(-60, 60), 0, rand(Z.hqZ - 20, totalZ));
    vegetationGroup.add(t);
  }

  // billboards
  clearGroup(billboardGroup);
  const nameForAds = content.hero.name || 'PORTFOLIO';
  const billboardLines = [nameForAds.toUpperCase(), 'NOW HIRING: CURIOSITY', 'BUILD THE FUTURE', 'EST. TODAY'];
  for (let i = 0; i < 10; i++) {
    const bc = makeBillboardCanvas(billboardLines, choice(['#6fe3ff', '#ffd27a', '#b98bff']));
    const tex = new THREE.CanvasTexture(bc.canvas);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    const side = choice([-1, 1]);
    plane.position.set(side * 32, rand(20, 50), rand(Z.hqZ, totalZ));
    plane.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    plane.userData.cycle = bc;
    billboardGroup.add(plane);
  }

  // pedestrians
  clearGroup(pedestrianGroup);
  for (let i = 0; i < 50; i++) {
    const p = createPedestrianSprite();
    p.position.set(rand(-30, 30), 1.1, rand(Z.hqZ, totalZ));
    p.userData.speed = rand(0.4, 1.1);
    p.userData.dir = choice([-1, 1]);
    pedestrianGroup.add(p);
  }

  // traffic
  clearGroup(trafficGroup);
  const carColors = [0xdedede, 0xff5544, 0x4488ff, 0xffcc33, 0x33cc88];
  for (let i = 0; i < 26; i++) {
    const car = createCar(choice(carColors));
    car.position.set(choice([-4, 4]), 0, rand(0, totalZ));
    car.userData.speed = rand(12, 26);
    car.userData.lane = car.position.x;
    trafficGroup.add(car);
  }

  // drones
  clearGroup(droneGroup);
  for (let i = 0; i < 14; i++) {
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), new THREE.MeshStandardMaterial({ color: 0xaee8ff, emissive: 0x2a6a80, emissiveIntensity: 0.6 }));
    d.position.set(rand(-50, 50), rand(20, 60), rand(0, totalZ));
    d.userData.phase = rand(0, Math.PI * 2);
    d.userData.radius = rand(6, 18);
    d.userData.center = d.position.clone();
    droneGroup.add(d);
  }

  layout = { boulevardEnd, campusZStart, campusZEnd, campusCenter, learnZStart, learnZEnd, learnCenter, museumZ, towerZ, totalZ };
  buildCameraPath();
  buildScrollHeight();
  renderHoloContent();
}

/* ============================================================
   10. CAMERA PATH — single continuous spline, scroll-driven
   ============================================================ */
const ZONE_WEIGHTS_BASE = { cloud: 3, descent: 9, street: 5, hq: 4.5, boulevardPer: 2.4, campus: 6, learnPer: 2.1, museum: 5, tower: 5.5 };
let zoneRanges = []; // [{name, t0, t1, hold}]
let pathCurve = null;

function buildCameraPath() {
  const projectCount = Math.max(1, content.projects.length);
  const eduCount = Math.max(1, content.education.length);
  const w = ZONE_WEIGHTS_BASE;
  const weights = [
    ['cloud', w.cloud, true],
    ['descent', w.descent, false],
    ['street', w.street, false],
    ['hq', w.hq, true],
    ['boulevard', w.boulevardPer * projectCount, false],
    ['campus', w.campus, false],
    ['learning', w.learnPer * eduCount, false],
    ['museum', w.museum, true],
    ['tower', w.tower, true],
  ];
  const total = weights.reduce((s, x) => s + x[1], 0);
  let cursor = 0;
  zoneRanges = weights.map(([name, weight, hold]) => {
    const t0 = cursor / total; cursor += weight; const t1 = cursor / total;
    return { name, t0, t1, hold };
  });

  const pts = [
    new THREE.Vector3(0, 230, -20),
    new THREE.Vector3(0, 230, Z.cloudEnd),
    new THREE.Vector3(6, 150, Z.descentEnd * 0.5),
    new THREE.Vector3(-6, 60, Z.descentEnd),
    new THREE.Vector3(4, 22, Z.streetEnd),
    new THREE.Vector3(10, 17, Z.hqZ - 25),
    new THREE.Vector3(10, 17, Z.hqZ + 10),
  ];
  // boulevard: weave gently down the avenue center
  const bSteps = 6;
  for (let i = 1; i <= bSteps; i++) {
    const zz = lerp(Z.boulevardStart, layout.boulevardEnd, i / bSteps);
    pts.push(new THREE.Vector3(Math.sin(i) * 6, 15, zz));
  }
  pts.push(new THREE.Vector3(layout.campusCenter.x * 0.5, 15, layout.campusZStart));
  pts.push(new THREE.Vector3(layout.campusCenter.x, 16, layout.campusCenter.z));
  pts.push(new THREE.Vector3(layout.campusCenter.x * 0.5, 16, layout.campusZEnd));
  pts.push(new THREE.Vector3(layout.learnCenter.x * 0.5, 16, layout.learnZStart));
  pts.push(new THREE.Vector3(layout.learnCenter.x, 16, (layout.learnZStart + layout.learnZEnd) / 2));
  pts.push(new THREE.Vector3(layout.learnCenter.x * 0.5, 17, layout.learnZEnd));
  pts.push(new THREE.Vector3(0, 20, layout.museumZ - 22));
  pts.push(new THREE.Vector3(0, 20, layout.museumZ + 6));
  pts.push(new THREE.Vector3(0, 30, layout.towerZ - 40));
  pts.push(new THREE.Vector3(0, 34, layout.towerZ - 6));

  pathCurve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
}

function zoneAt(t) {
  for (const z of zoneRanges) if (t >= z.t0 && t <= z.t1) return z;
  return zoneRanges[zoneRanges.length - 1];
}

// Remap raw scroll t -> curve parameter u, easing (slowing) at every zone boundary
function remapT(t) {
  const zone = zoneAt(t);
  const span = zone.t1 - zone.t0 || 1e-6;
  const local = (t - zone.t0) / span;
  const eased = smoother(local);
  return zone.t0 + eased * span;
}

function cameraPointAt(u) {
  u = clamp(u, 0, 0.999);
  const pos = pathCurve.getPointAt(u);
  const ahead = pathCurve.getPointAt(clamp(u + 0.01, 0, 0.999));
  return { pos, ahead };
}

/* ============================================================
   11. SCROLL HEIGHT (kept consistent with the zone weights above)
   ============================================================ */
function buildScrollHeight() {
  const projectCount = Math.max(1, content.projects.length);
  const eduCount = Math.max(1, content.education.length);
  const vh = window.innerHeight;
  const totalVh = 6 + 11 + 6 + 5 + (5.5 * projectCount) + 9 + (4.6 * eduCount) + 6 + 7;
  spacer.style.height = (totalVh * vh) + 'px';
}
window.addEventListener('resize', () => { if (layout) buildScrollHeight(); });

/* ============================================================
   12. HOLOGRAPHIC CONTENT LAYER (real HTML, projected each frame)
   ============================================================ */
function renderHoloContent() {
  // Resync anchor -> live content. rebuildLayout() only runs when an item
  // COUNT changes (it re-lays-out buildings); a plain edit (same count)
  // only calls this function, so anchors must re-point at the latest row
  // objects here or the holographic panel would keep showing stale text.
  let pi = 0, si = 0, ei = 0, ai = 0;
  holoAnchors.forEach(a => {
    if (a.kind === 'project') a.data = content.projects[pi++] ?? a.data;
    else if (a.kind === 'skill') a.data = content.skills[si++] ?? a.data;
    else if (a.kind === 'education') a.data = content.education[ei++] ?? a.data;
    else if (a.kind === 'achievement') a.data = content.achievements[ai++] ?? a.data;
  });

  document.getElementById('hq-name').textContent = content.hero.name || '—';
  document.getElementById('hq-role').innerHTML = content.hero.arabic ? `<em>${escapeHtml(content.hero.arabic)}</em>` : '';
  document.getElementById('hq-intro').textContent = content.about.intro || '';

  const bWrap = document.getElementById('boulevard-panels');
  bWrap.innerHTML = holoAnchors.filter(a => a.kind === 'project').map(a => `
    <div class="holo-panel" id="holo-${a.id}" data-anchor="${a.id}">
      <p class="holo-kicker">Project Boulevard</p>
      <h3>${escapeHtml(a.data.title || a.data.caption || 'Untitled project')}</h3>
      <p>${escapeHtml(a.data.caption || '')}</p>
      ${(a.data.tech_tags && a.data.tech_tags.length) ? `<div class="holo-tags">${a.data.tech_tags.map(t => `<span class="holo-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="holo-links">
        ${a.data.demo_url ? `<a href="${escapeHtml(a.data.demo_url)}" target="_blank" rel="noopener">Live demo →</a>` : ''}
        ${a.data.repo_url ? `<a href="${escapeHtml(a.data.repo_url)}" target="_blank" rel="noopener">Source →</a>` : ''}
      </div>
    </div>`).join('');

  const sWrap = document.getElementById('skill-labels');
  sWrap.innerHTML = holoAnchors.filter(a => a.kind === 'skill').map(a => `
    <div class="holo-panel" id="holo-${a.id}" data-anchor="${a.id}" style="min-width:120px;max-width:160px;padding:8px 12px;">
      <h3 style="font-size:13px;margin:0;">${escapeHtml(a.data.name || '')}</h3>
      ${a.data.level != null ? `<p style="margin:2px 0 0;">${escapeHtml(String(a.data.level))}%</p>` : ''}
    </div>`).join('');

  const eWrap = document.getElementById('education-panels');
  eWrap.innerHTML = holoAnchors.filter(a => a.kind === 'education').map(a => `
    <div class="holo-panel" id="holo-${a.id}" data-anchor="${a.id}">
      <p class="holo-kicker">${escapeHtml(a.data.cat || 'Learning Campus')}</p>
      <h3>${escapeHtml(a.data.title || '')}</h3>
      ${a.data.year ? `<p class="holo-meta">${escapeHtml(a.data.year)}</p>` : ''}
      <p>${escapeHtml(a.data.description || '')}</p>
    </div>`).join('');

  const mWrap = document.getElementById('museum-panels');
  mWrap.innerHTML = holoAnchors.filter(a => a.kind === 'achievement').map(a => `
    <div class="holo-panel" id="holo-${a.id}" data-anchor="${a.id}">
      <p class="holo-kicker">Museum</p>
      <h3>${escapeHtml(a.data.title || '')}</h3>
      ${a.data.date ? `<p class="holo-meta">${escapeHtml(a.data.date)}</p>` : ''}
      <p>${escapeHtml(a.data.description || '')}</p>
    </div>`).join('');

  const c = content.contact || {};
  const whatsappLink = c.whatsapp ? 'https://wa.me/' + String(c.whatsapp).replace(/[^0-9]/g, '') : null;
  const rows = [
    ['Email', c.email, c.email ? 'mailto:' + c.email : null],
    ['GitHub', c.github, c.github],
    ['Telegram', c.telegram, c.telegram],
    ['WhatsApp', c.whatsapp, whatsappLink],
    ['Facebook', c.facebook, c.facebook],
  ].filter(r => r[1] && r[2]);
  document.getElementById('contact-panels').innerHTML = rows.map(([label, value, link]) => `
    <div class="contact-row"><span>${label}</span><a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(value)}</a></div>
  `).join('') || '<p>Contact details coming soon.</p>';

  // rebind holo-panel elements into a fresh lookup used by the render loop
  holoElements.clear();
  document.querySelectorAll('.holo-panel[data-anchor]').forEach(el => holoElements.set(el.dataset.anchor, el));
}
const holoElements = new Map();

/* ============================================================
   13. LOAD CONTENT (one-shot first, then realtime subscriptions)
   ============================================================ */
async function loadInitialContent() {
  loadingSub.textContent = 'Reading city records…';
  const [hero, about, contact, skills, logo, siteMeta, gallery, achievements, educational] = await Promise.all([
    getSetting('hero'), getSetting('about'), getSetting('contact'), getSetting('cms_skills'),
    getSetting('logo'), getSetting('site_meta'),
    listRows('gallery', { order: 'created_at', ascending: true }),
    listRows('achievements', { order: 'created_at', ascending: true }),
    listRows('educational', { order: 'created_at', ascending: true }),
  ]);
  if (hero) content.hero = { ...content.hero, ...hero };
  if (about) content.about = { ...content.about, ...about };
  if (contact) content.contact = contact;
  if (Array.isArray(skills)) content.skills = skills;
  content.logo = logo;
  content.siteMeta = siteMeta;
  content.projects = (gallery || []).filter(g => g.published);
  content.achievements = (achievements || []).filter(a => a.published !== false);
  content.education = (educational || []).filter(e => e.published !== false);
  hudName.textContent = content.hero.name || 'Portfolio';
  if (siteMeta && siteMeta.title) document.title = siteMeta.title;
}

function wireLiveSubscriptions() {
  subscribeSetting('hero', v => { if (v) { content.hero = { ...content.hero, ...v }; hudName.textContent = content.hero.name || 'Portfolio'; renderHoloContent(); } });
  subscribeSetting('about', v => { if (v) { content.about = { ...content.about, ...v }; renderHoloContent(); } });
  subscribeSetting('contact', v => { content.contact = v || {}; renderHoloContent(); });
  subscribeSetting('site_meta', v => { content.siteMeta = v; if (v && v.title) document.title = v.title; });
  subscribeSetting('cms_skills', v => {
    const next = Array.isArray(v) ? v : [];
    if (JSON.stringify(next) !== JSON.stringify(content.skills)) { content.skills = next; rebuildLayout(); }
  });
  subscribeTable('gallery', rows => {
    const next = (rows || []).filter(r => r.published);
    if (next.length !== content.projects.length) { content.projects = next; rebuildLayout(); }
    else { content.projects = next; renderHoloContent(); }
  });
  subscribeTable('achievements', rows => {
    const next = (rows || []).filter(a => a.published !== false);
    if (next.length !== content.achievements.length) { content.achievements = next; rebuildLayout(); }
    else { content.achievements = next; renderHoloContent(); }
  });
  subscribeTable('educational', rows => {
    const next = (rows || []).filter(e => e.published !== false);
    if (next.length !== content.education.length) { content.education = next; rebuildLayout(); }
    else { content.education = next; renderHoloContent(); }
  });
}

/* ============================================================
   14. SCROLL / INTERACTION STATE
   ============================================================ */
let hasScrolled = false;
let displayedT = 0; // smoothed
let rawT = 0;

window.addEventListener('scroll', () => {
  if (!hasScrolled && window.scrollY > 2) {
    hasScrolled = true;
    prelude.classList.add('fade');
    hud.classList.add('show');
  }
  const max = Math.max(1, document.body.scrollHeight - window.innerHeight);
  rawT = clamp(window.scrollY / max, 0, 1);
}, { passive: true });

/* ============================================================
   15. RENDER LOOP
   ============================================================ */
const clock = new THREE.Clock();
let lastRelight = 0;
let lastBillboardCycle = 0;

function updateAmbientLife(dt, elapsed) {
  // traffic — driven by elapsed time, never by scroll (Part 12 design rule)
  trafficGroup.children.forEach(car => {
    car.position.z += car.userData.speed * dt * (reducedMotion ? 0.4 : 1);
    if (car.position.z > layout.totalZ) car.position.z = -20;
  });
  // pedestrians
  pedestrianGroup.children.forEach(p => {
    p.position.x += p.userData.dir * p.userData.speed * dt * 0.3;
    if (Math.abs(p.position.x) > 34) p.userData.dir *= -1;
  });
  // vegetation sway
  vegetationGroup.children.forEach(t => {
    const s = Math.sin(elapsed * 0.6 + t.userData.swayPhase) * 0.05;
    t.userData.swayTarget.rotation.z = s;
  });
  // drones — independent looping paths
  droneGroup.children.forEach(d => {
    d.userData.phase += dt * 0.4;
    d.position.x = d.userData.center.x + Math.cos(d.userData.phase) * d.userData.radius;
    d.position.z = d.userData.center.z + Math.sin(d.userData.phase) * d.userData.radius;
    d.position.y = d.userData.center.y + Math.sin(elapsed * 0.8 + d.userData.phase) * 2;
    d.rotation.y += dt;
  });
  // fountains
  fountainGroup.children.forEach(f => {
    const pos = f.geometry.attributes.position;
    const phases = f.userData.phases;
    for (let i = 0; i < phases.length; i++) {
      phases[i] += dt * 0.6;
      if (phases[i] > 1) phases[i] = 0;
      const p = phases[i];
      const a = (i / phases.length) * Math.PI * 2;
      pos.array[i * 3] = Math.cos(a) * p * 1.4;
      pos.array[i * 3 + 1] = Math.sin(p * Math.PI) * 3.2;
      pos.array[i * 3 + 2] = Math.sin(a) * p * 1.4;
    }
    pos.needsUpdate = true;
  });
  // near clouds drift (zone0/1) + thin sky clouds (always)
  cloudGroupNear.children.forEach(s => { s.position.x += dt * s.userData.drift * 0.2; });
  skyCloudGroup.children.forEach(s => { s.position.x += dt * s.userData.drift * 0.15; if (s.position.x > 900) s.position.x = -500; });

  // Part 9 — world memory: window relighting + billboard campaign rotation,
  // on independent, non-scroll-driven timers, so the same location reads
  // slightly different on a later visit within the same session.
  if (elapsed - lastRelight > 26) {
    lastRelight = elapsed;
    [boulevardGroup, campusGroup, learningGroup].forEach(g => {
      g.children.forEach(b => { if (Math.random() < 0.5) b.userData.relight?.(rand(0.15, 0.6)); });
    });
    // backdrop is 220 buildings — relight only a small, staggered slice per tick to avoid a frame hitch
    for (let i = 0; i < 12; i++) {
      const b = choice(backdropGroup.children);
      b?.userData.relight?.(rand(0.1, 0.3));
    }
  }
  if (elapsed - lastBillboardCycle > 14) {
    lastBillboardCycle = elapsed;
    billboardGroup.children.forEach(plane => {
      const cyc = plane.userData.cycle;
      if (cyc && Math.random() < 0.6) { cyc.draw(choice(cyc.lines)); plane.material.map.needsUpdate = true; }
    });
  }
}

function moodColorAtZ(z) {
  if (z < Z.hqZ + 30) return 0xffe3b0;                       // HQ — prestige/authority
  if (layout && z < layout.boulevardEnd + 20) return 0x6fe3ff; // Boulevard — innovation
  if (layout && z < layout.campusZEnd + 20) return 0xb98bff;   // Tech Campus — advanced research
  if (layout && z < layout.learnZEnd + 20) return 0x9fd8ff;    // Learning Campus — baseline
  if (layout && z < layout.museumZ + 40) return 0xffe9c7;      // Museum — elegance/calm
  return 0xffd27a;                                              // Tower — hope/invitation
}

function updateHoloPanels() {
  const v = new THREE.Vector3();
  for (const anchor of holoAnchors) {
    const el = holoElements.get(anchor.id);
    if (!el) continue;
    v.copy(anchor.pos).project(camera);
    const dist = anchor.pos.distanceTo(camera.position);
    const inView = v.z < 1 && dist < 130;
    if (!inView) { el.classList.remove('visible'); continue; }
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    const near = dist < 55;
    el.classList.toggle('scale-near', near);
    el.classList.toggle('scale-far', !near);
    el.classList.add('visible');
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (layout) {
    // smooth the scroll input so motion never feels jumpy
    const target = hasScrolled ? rawT : 0;
    displayedT = lerp(displayedT, target, reducedMotion ? 1 : 1 - Math.pow(0.001, dt));

    if (reducedMotion) {
      // Part 11.3 — discrete jumps between zone resting positions, no sweeping motion
      const zone = zoneAt(displayedT);
      const u = clamp((zone.t0 + zone.t1) / 2, 0, 0.999);
      const { pos, ahead } = cameraPointAt(u);
      camera.position.copy(pos);
      camera.lookAt(ahead);
    } else {
      const u = remapT(displayedT);
      const { pos, ahead } = cameraPointAt(u);
      // idle sway — camera never perfectly locked-off, even at a full stop
      const sway = new THREE.Vector3(Math.sin(elapsed * 0.35) * 0.5, Math.sin(elapsed * 0.5) * 0.3, 0);
      camera.position.copy(pos).add(sway);
      camera.lookAt(ahead.clone().add(sway));
    }

    // mood lighting follows the camera's current z (Part 10)
    const mood = moodColorAtZ(camera.position.z);
    moodLight.color = lerpColor(moodLight.color.getHex(), mood, 0.06);
    moodLight.position.set(camera.position.x, camera.position.y + 20, camera.position.z + 20);

    updateAmbientLife(dt, elapsed);
    updateHoloPanels();

    // HUD zone label + progress
    const zone = zoneAt(displayedT);
    const labelMap = { cloud: 'Cloudbank', descent: 'Descent', street: 'Street Level', hq: 'Headquarters', boulevard: 'Project Boulevard', campus: 'Technology Campus', learning: 'Learning Campus', museum: 'Museum', tower: 'Communication Tower' };
    hudZone.textContent = labelMap[zone.name] || '';
    progressFill.style.height = (displayedT * 100) + '%';
  } else {
    // pre-layout idle hold in the cloudbank
    camera.position.set(Math.sin(elapsed * 0.2) * 2, 230 + Math.sin(elapsed * 0.3) * 1.5, Math.cos(elapsed * 0.2) * 2);
    camera.lookAt(0, 225, 40);
    cloudGroupNear.children.forEach(s => { s.position.x += dt * s.userData.drift * 0.2; });
  }

  if (composer) composer.render(); else renderer.render(scene, camera);
}

/* ============================================================
   16. BOOT
   ============================================================ */
(async function boot() {
  loadingFill.style.width = '20%';
  await loadInitialContent();
  loadingFill.style.width = '70%';
  rebuildLayout();
  wireLiveSubscriptions();
  loadingFill.style.width = '100%';
  loadingSub.textContent = 'Ready.';
  setTimeout(() => loadingScreen.classList.add('hidden'), 350);
  animate();
})();
