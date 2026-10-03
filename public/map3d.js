/* 정령섬 온라인 — 3D 지도 (three.js). app.js 가 window.Map3D 를 통해 사용한다. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const TERRAIN = {
  M: { h: 18, top: '#9a9ea3', side: '#6b6560', name: '산' },
  J: { h: 12, top: '#3f8f45', side: '#5a4a35', name: '정글' },
  S: { h: 8, top: '#e0c27e', side: '#a8875a', name: '사막' },
  W: { h: 6, top: '#5aa59c', side: '#5b5a45', name: '습지' },
};
const BASE = -8; // 해수면 아래부터 솟은 절벽

const S = {
  ready: false, container: null, renderer: null, scene: null, camera: null, controls: null,
  lands: {}, landMeshes: [], pieces: null, labels: null, clock: new THREE.Clock(), ocean: null,
  hooks: {}, selectable: new Set(), focus: new Set(), hover: null, animated: [], mapKey: null, running: false,
  W: 600, H: 260,
};

function supported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

// ───────── 랜덤 (지도마다 같은 장식 배치) ─────────
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

function pip(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
    if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ───────── 텍스처 ─────────
function terrainTexture(t) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const base = new THREE.Color(TERRAIN[t].top);
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 256, 256);
  const r = rng(hash(t));
  const shade = (k) => { const col = base.clone().offsetHSL(0, 0, k); return `#${col.getHexString()}`; };
  for (let i = 0; i < 900; i++) {
    g.fillStyle = shade((r() - 0.5) * 0.12);
    g.globalAlpha = 0.5;
    const x = r() * 256; const y = r() * 256; const s = 2 + r() * (t === 'J' ? 14 : 8);
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 0.35;
  g.strokeStyle = shade(t === 'S' ? -0.12 : 0.1);
  g.lineWidth = 2;
  if (t === 'S' || t === 'W') {
    for (let y = 10; y < 256; y += 22) {
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 20 + y) * 4);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 60, 1 / 60);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const textCache = new Map();
function textSprite(text, { bg = 'rgba(12,17,23,0.85)', fg = '#f6eacb', border = 'rgba(217,180,90,0.8)', size = 1, font = 700 } = {}) {
  const key = [text, bg, fg, border, font].join('|');
  let mat = textCache.get(key);
  if (!mat) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const fs = 44;
    g.font = `${font} ${fs}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
    const w = Math.ceil(g.measureText(text).width) + 40;
    c.width = w; c.height = 72;
    g.font = `${font} ${fs}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
    g.fillStyle = bg; g.strokeStyle = border; g.lineWidth = 4;
    const r = 30;
    g.beginPath(); g.roundRect(2, 2, w - 4, 68, r); g.fill(); g.stroke();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, 38);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    mat.userData.aspect = w / 72;
    textCache.set(key, mat);
  }
  const sp = new THREE.Sprite(mat);
  const h = 7 * size;
  sp.scale.set(h * mat.userData.aspect, h, 1);
  sp.renderOrder = 10;
  return sp;
}

// ───────── 조각 모델 ─────────
const MATS = {};
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!MATS[key]) MATS[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...opts });
  return MATS[key];
}
const GEO = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 12),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 16, 12),
  oct: new THREE.OctahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.12, 8, 32),
};
function mesh(geo, material, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function makePiece(kind, color) {
  const g = new THREE.Group();
  if (kind === 'explorer') {
    g.add(mesh(GEO.cyl, mat('#efe4c8'), 1.6, 4.2, 1.6, 0, 2.1, 0));
    g.add(mesh(GEO.sph, mat('#f3d9b5'), 1.4, 1.4, 1.4, 0, 5.1, 0));
    g.add(mesh(GEO.cyl, mat('#6b4a2a'), 0.25, 6, 0.25, 2, 3, 0));
  } else if (kind === 'town') {
    g.add(mesh(GEO.box, mat('#e8d2a0'), 6, 4, 5, 0, 2, 0));
    const roof = mesh(GEO.cone4, mat('#a0472d'), 4.9, 3.2, 4.2, 0, 5.6, 0);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  } else if (kind === 'city') {
    g.add(mesh(GEO.box, mat('#b9bcc4'), 9, 3.5, 7, 0, 1.75, 0));
    for (const [x, z, h] of [[-3, -2, 9], [3, -2, 7.5], [0, 2, 11]]) {
      g.add(mesh(GEO.box, mat('#a3a7b0'), 2.6, h, 2.6, x, h / 2, z));
      g.add(mesh(GEO.cone4, mat('#3c4a66'), 2.2, 2.6, 2.2, x, h + 1.3, z));
    }
  } else if (kind === 'dahan') {
    g.add(mesh(GEO.cone, mat('#7e5130'), 2.3, 5, 2.3, 0, 2.5, 0));
    g.add(mesh(GEO.sph, mat('#8d5d38'), 1.5, 1.5, 1.5, 0, 5.6, 0));
    g.add(mesh(GEO.cyl, mat('#d9b45a'), 0.2, 7.5, 0.2, -2, 3.8, 0));
    g.add(mesh(GEO.cone, mat('#c0392b'), 0.5, 1.6, 0.5, -2, 8.2, 0));
  } else if (kind === 'blight') {
    const m = mat('#2a0d10', { emissive: '#8a1a10', emissiveIntensity: 0.6, roughness: 0.4 });
    for (const [x, z, s, r] of [[0, 0, 3.2, 0], [2.2, 1.4, 2.2, 0.7], [-2, 1.2, 2, 1.3]]) {
      const o = mesh(GEO.oct, m, s * 0.7, s * 1.5, s * 0.7, x, s * 1.1, z);
      o.rotation.set(r * 0.3, r, r * 0.2);
      g.add(o);
    }
  } else if (kind === 'presence') {
    const orb = mesh(GEO.sph, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.2 }), 3, 3, 3, 0, 5, 0);
    g.add(orb);
    g.add(mesh(GEO.cyl, mat('#2b2b2b'), 2.4, 1, 2.4, 0, 0.5, 0));
    g.userData.bob = orb;
  }
  return g;
}

// ───────── 장면 구성 ─────────
function init(container, hooks) {
  if (S.ready) return true;
  if (!supported()) return false;
  S.container = container;
  S.hooks = hooks || {};
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  S.renderer = renderer;

  const scene = new THREE.Scene();
  const sky = document.createElement('canvas'); sky.width = 2; sky.height = 256;
  const sg = sky.getContext('2d'); const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0d1d2e'); grad.addColorStop(0.55, '#1d4560'); grad.addColorStop(1, '#3a6f85');
  sg.fillStyle = grad; sg.fillRect(0, 0, 2, 256);
  const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  scene.fog = new THREE.Fog('#1d4560', 700, 1600);
  S.scene = scene;

  scene.add(new THREE.HemisphereLight('#cfe8ff', '#3a2e1c', 0.85));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
  sun.position.set(-220, 380, 260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -420, right: 420, top: 320, bottom: -320, near: 50, far: 1200 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(38, 1, 5, 4000);
  S.camera = camera;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 1.2;
  controls.minPolarAngle = 0.15;
  controls.minDistance = 120;
  controls.maxDistance = 1100;
  controls.screenSpacePanning = false;
  S.controls = controls;

  // 바다
  const og = new THREE.PlaneGeometry(2400, 1800, 120, 90);
  og.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(og, new THREE.MeshStandardMaterial({ color: '#1b5f86', roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.93 }));
  ocean.receiveShadow = true;
  ocean.userData.base = og.attributes.position.array.slice();
  scene.add(ocean);
  S.ocean = ocean;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1800).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0b2a3d' }));
  floor.position.y = -30;
  scene.add(floor);

  S.pieces = new THREE.Group(); scene.add(S.pieces);
  S.labels = new THREE.Group(); scene.add(S.labels);

  // 입력
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(S.landMeshes, false)[0];
    return hit ? hit.object.userData.landId : null;
  };
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const id = pick(e);
    if (id && S.hooks.onClick) S.hooks.onClick(id);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    const id = pick(e);
    if (id !== S.hover) { S.hover = id; applyHighlights(); }
    renderer.domElement.style.cursor = id && S.selectable.has(id) ? 'pointer' : 'grab';
    if (S.hooks.onHover) S.hooks.onHover(id, e);
  });
  renderer.domElement.addEventListener('pointerleave', () => { S.hover = null; applyHighlights(); if (S.hooks.onHover) S.hooks.onHover(null); });

  new ResizeObserver(() => resize()).observe(container);
  S.ready = true;
  resize();
  start();
  return true;
}

function resize() {
  if (!S.renderer) return;
  const w = S.container.clientWidth || 1;
  const h = S.container.clientHeight || 1;
  S.renderer.setSize(w, h, false);
  S.camera.aspect = w / h;
  S.camera.updateProjectionMatrix();
}

function resetView() {
  const W = S.W; const H = S.H;
  const aspect = S.camera.aspect || 1.6;
  const fitW = W / (2 * Math.tan((S.camera.fov * Math.PI) / 360) * aspect);
  const fitH = H / (2 * Math.tan((S.camera.fov * Math.PI) / 360));
  const d = Math.max(fitW, fitH) * 0.92 + 30;
  S.camera.position.set(0, d * 0.8, d * 0.6);
  S.controls.target.set(0, 0, 8);
  S.controls.update();
}

function buildIsland(state) {
  for (const m of S.landMeshes) { S.scene.remove(m.userData.group); }
  S.landMeshes = []; S.lands = {};
  S.W = state.mapSize.width; S.H = state.mapSize.height;
  const ox = S.W / 2; const oz = S.H / 2;
  const texCache = {};
  for (const l of Object.values(state.lands)) {
    const T = TERRAIN[l.terrain];
    const pts = l.poly.map(([x, y]) => new THREE.Vector2(x - ox, -(y - oz)));
    const shape = new THREE.Shape(pts);
    const depth = T.h - BASE;
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelOffset: -1.2, bevelSegments: 2, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, BASE, 0);
    texCache[l.terrain] ||= terrainTexture(l.terrain);
    const topMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texCache[l.terrain], roughness: 0.9, metalness: 0 });
    const sideMat = new THREE.MeshStandardMaterial({ color: T.side, roughness: 0.95 });
    const m = new THREE.Mesh(geo, [topMat, sideMat]);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.landId = l.id;
    const group = new THREE.Group();
    group.add(m);
    // 테두리 (이벤트 표시용)
    const edgePts = l.poly.map(([x, y]) => new THREE.Vector3(x - ox, T.h + 0.4, y - oz));
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edgePts), new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35 }));
    group.add(edge);
    decorate(group, l, ox, oz);
    m.userData.group = group;
    S.scene.add(group);
    S.landMeshes.push(m);
    S.lands[l.id] = { mesh: m, group, topMat, edge, h: T.h, center: [l.center[0] - ox, l.center[1] - oz], terrain: l.terrain };
  }
  S.mapKey = Object.keys(state.lands).join(',');
  resetView();
}

function decorate(group, l, ox, oz) {
  const r = rng(hash(l.id));
  const T = TERRAIN[l.terrain];
  const xs = l.poly.map((p) => p[0]); const ys = l.poly.map((p) => p[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const want = { M: 5, J: 14, S: 6, W: 9 }[l.terrain];
  const spots = [];
  for (let tries = 0; spots.length < want && tries < 400; tries++) {
    const p = [minX + r() * (maxX - minX), minY + r() * (maxY - minY)];
    if (!pip(p, l.poly)) continue;
    if ([[6, 0], [-6, 0], [0, 6], [0, -6]].some(([dx, dy]) => !pip([p[0] + dx, p[1] + dy], l.poly))) continue;
    if (Math.hypot(p[0] - l.center[0], p[1] - l.center[1] + 4) < 30) continue; // 중앙은 조각 자리
    if (spots.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 9)) continue;
    spots.push(p);
  }
  for (const [x, y] of spots) {
    const wx = x - ox; const wz = y - oz; const top = T.h;
    const k = 0.7 + r() * 0.6;
    if (l.terrain === 'M') {
      group.add(mesh(GEO.cone, mat('#7d8288', { flatShading: true }), 8 * k, 14 * k, 8 * k, wx, top + 7 * k, wz));
      group.add(mesh(GEO.cone, mat('#f2f4f6', { flatShading: true }), 3.3 * k, 4.5 * k, 3.3 * k, wx, top + 12.2 * k, wz));
    } else if (l.terrain === 'J') {
      group.add(mesh(GEO.cyl, mat('#5b3d22'), 0.7, 3 * k, 0.7, wx, top + 1.5 * k, wz));
      group.add(mesh(GEO.cone, mat(r() < 0.5 ? '#2f7a34' : '#3a8f3c', { flatShading: true }), 3.6 * k, 8 * k, 3.6 * k, wx, top + 6.5 * k, wz));
    } else if (l.terrain === 'S') {
      if (r() < 0.5) group.add(mesh(GEO.sph, mat('#d4b26c'), 7 * k, 2 * k, 5 * k, wx, top, wz));
      else group.add(mesh(new THREE.DodecahedronGeometry(1, 0), mat('#a8875a', { flatShading: true }), 2.2 * k, 1.6 * k, 2 * k, wx, top + 1, wz));
    } else if (l.terrain === 'W') {
      if (r() < 0.4) {
        const pool = mesh(GEO.cyl, mat('#4a9fc0', { roughness: 0.15, metalness: 0.2 }), 6 * k, 0.3, 4 * k, wx, top + 0.15, wz);
        pool.castShadow = false;
        group.add(pool);
      } else {
        for (let i = 0; i < 3; i++) group.add(mesh(GEO.cyl, mat('#3d6b35'), 0.25, 5 * k, 0.25, wx + (i - 1) * 1.4, top + 2.5 * k, wz + (r() - 0.5) * 2));
      }
    }
  }
}

// ───────── 상태 반영 ─────────
function render(state, prompt, info) {
  if (!S.ready) return;
  const key = Object.keys(state.lands).join(',');
  if (S.mapKey !== key) buildIsland(state);
  S.selectable = new Set(prompt && prompt.type === 'land' ? prompt.options : []);
  S.focus = new Set((prompt && prompt.focus) || []);
  S.landPrompt = !!(prompt && prompt.type === 'land');
  S.events = {};
  const pr = { ravage: 3, build: 2, explore: 1, shield: 0 };
  for (const e of state.events || []) if (!S.events[e.landId] || pr[e.kind] > pr[S.events[e.landId]]) S.events[e.landId] = e.kind;
  applyHighlights();
  buildPieces(state, info);
}

function applyHighlights() {
  for (const [id, L] of Object.entries(S.lands)) {
    const sel = S.selectable.has(id);
    const dim = S.landPrompt && !sel;
    L.topMat.color.set(dim ? '#80858c' : '#ffffff');
    L.topMat.emissive.set(sel ? '#ffcf5a' : S.focus.has(id) ? '#ff9a3a' : '#000000');
    L.topMat.emissiveIntensity = sel ? 0.25 : S.focus.has(id) ? 0.3 : 0;
    L.group.position.y = (S.hover === id && sel) ? 2 : 0;
    const ev = S.events && S.events[id];
    const col = { ravage: '#ff3b30', build: '#ffb547', explore: '#f0f6ff', shield: '#6fcf97' }[ev];
    L.edge.material.color.set(sel ? '#ffe08a' : col || '#000000');
    L.edge.material.opacity = sel || col ? 1 : 0.35;
  }
}

function buildPieces(state, info) {
  S.pieces.clear();
  S.labels.clear();
  S.animated = [];
  for (const l of Object.values(state.lands)) {
    const L = S.lands[l.id];
    if (!L) continue;
    const [cx, cz] = L.center;
    const top = L.h;
    // 지역 명패
    const label = textSprite(`${l.id} ${TERRAIN[l.terrain].name}${l.coastal ? ' · 해안' : ''}`, { size: 1.15 });
    label.position.set(cx, top + 26, cz - 18);
    S.labels.add(label);
    const items = [];
    if (l.cities.length) items.push({ kind: 'city', n: l.cities.length, dmg: l.cities.some((h) => h < 3) });
    if (l.towns.length) items.push({ kind: 'town', n: l.towns.length, dmg: l.towns.some((h) => h < 2) });
    if (l.explorers) items.push({ kind: 'explorer', n: l.explorers });
    if (l.dahan.length) items.push({ kind: 'dahan', n: l.dahan.length, dmg: l.dahan.some((h) => h < 2) });
    if (l.blight) items.push({ kind: 'blight', n: l.blight });
    for (const [pid, n] of Object.entries(l.presence)) {
      if (!n) continue;
      items.push({ kind: 'presence', n, color: info.spiritColor(pid), sacred: info.isSacred(pid, l.id) });
    }
    const perRow = 4; const sp = 18; const PS = 1.75;
    items.forEach((it, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, items.length - row * perRow);
      const col = i % perRow;
      const x = cx + (col - (inRow - 1) / 2) * sp;
      const z = cz - 2 + row * sp;
      const g = makePiece(it.kind, it.color);
      g.position.set(x, top, z);
      g.scale.setScalar(PS);
      g.rotation.y = (hash(l.id + i) % 100) / 100 - 0.5;
      S.pieces.add(g);
      if (g.userData.bob) S.animated.push({ obj: g.userData.bob, phase: i + l.num });
      if (it.sacred) {
        const ring = mesh(GEO.torus, mat('#ffd86b', { emissive: '#ffb020', emissiveIntensity: 0.6 }), 4.6 * PS, 4.6 * PS, 4.6 * PS, x, top + 0.8, z);
        ring.rotation.x = Math.PI / 2;
        S.pieces.add(ring);
      }
      if (it.n > 1 || it.dmg) {
        const b = textSprite(`${it.n}${it.dmg ? '!' : ''}`, { bg: it.dmg ? 'rgba(168,35,31,0.95)' : 'rgba(20,24,29,0.92)', size: 0.9 });
        b.position.set(x + 5, top + (it.kind === "city" ? 25 : 18), z);
        S.pieces.add(b);
      }
    });
    if (l.defend) { const d = textSprite(`🛡 방어 ${l.defend}`, { bg: 'rgba(36,73,109,0.92)', size: 0.75 }); d.position.set(cx, top + 15, cz + 18); S.labels.add(d); }
    if (l.skip) { const d = textSprite('💤 행동 건너뜀', { bg: 'rgba(58,53,82,0.92)', size: 0.75 }); d.position.set(cx, top + 15, cz + 26); S.labels.add(d); }
  }
}

// ───────── 루프 ─────────
function start() {
  if (S.running) return;
  S.running = true;
  const loop = () => {
    if (!S.running) return;
    requestAnimationFrame(loop);
    if (document.hidden || !S.container.offsetParent) return;
    const t = S.clock.getElapsedTime();
    // 파도
    const pos = S.ocean.geometry.attributes.position;
    const base = S.ocean.userData.base;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]; const z = base[i * 3 + 2];
      pos.array[i * 3 + 1] = Math.sin(x * 0.02 + t * 0.9) * 1.1 + Math.cos(z * 0.025 + t * 0.7) * 0.9;
    }
    pos.needsUpdate = true;
    if (((t * 10) | 0) % 3 === 0) S.ocean.geometry.computeVertexNormals();
    for (const a of S.animated) a.obj.position.y = 5 + Math.sin(t * 2 + a.phase) * 0.6;
    for (const L of Object.values(S.lands)) {
      if (S.selectable.has(L.mesh.userData.landId)) L.topMat.emissiveIntensity = 0.18 + Math.sin(t * 4) * 0.12;
    }
    S.controls.update();
    S.renderer.render(S.scene, S.camera);
  };
  loop();
}

window.Map3D = { init, render, resetView, supported };
window.dispatchEvent(new Event('map3d-ready'));
