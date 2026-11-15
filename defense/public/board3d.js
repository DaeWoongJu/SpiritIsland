/* 요괴 퇴마 디펜스 — 3D 전장 (three.js)
 * 만화풍 셀 셰이딩 + 검은 외곽선 캐릭터, 디오라마 지형, 타격 효과(번쩍임·밀려남·파편·숫자·화면 흔들림).
 * app.js 가 window.Board3D 로 사용한다. 캐릭터는 모두 도형을 조합해 직접 만든 것. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const S = {
  ok: false, renderer: null, scene: null, camera: null, wrap: null, overlay: null, octx: null,
  map: null, cat: null, W: 24, H: 15, units: new Map(), enemies: new Map(), dying: [], parts: [], projs: [], arcs: [], rings: [],
  texts: [], zaps: [], tints: [], shake: 0, camBase: new THREE.Vector3(), camLook: new THREE.Vector3(), world: null, dyn: null,
  hover: null, selRing: null, rangeMesh: null, hoverMesh: null, zoneMeshes: [], flows: [], portals: [], clock: new THREE.Clock(), dpr: 1,
};

// ───────── 공용 재료 ─────────
const gradTex = (() => {
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toon = (opts = {}) => new THREE.MeshToonMaterial({ gradientMap: gradTex, ...opts });
const VCOL = toon({ vertexColors: true });
const OUTLINE = new THREE.ShaderMaterial({
  uniforms: { t: { value: 0.022 } },
  vertexShader: 'uniform float t; void main(){ vec3 p = position + normal * t; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.06, 0.03, 0.06, 1.0); }',
  side: THREE.BackSide,
});
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
/** 아래가 밝고 위로 갈수록 사라지는 세로 그라데이션 (등급 오라 기둥) */
const auraTex = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d'); const r = g.createLinearGradient(0, 64, 0, 0);
  r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
})();
const C = (hex) => new THREE.Color(hex);
const shade = (hex, k) => { const c = C(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };

// ───────── 도형 조합 → 하나의 지오메트리 (색은 꼭짓점 색) ─────────
function part(geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const g = geo.index ? geo : geo; // 모두 인덱스형
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
  g.applyMatrix4(m);
  const col = C(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
const merge = (parts) => { const g = mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q))); g.computeBoundingSphere(); return g; };
const Cyl = (a, b, h, n = 10, open = false, ts = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(a, b, h, n, 1, open, ts, tl);
const Sph = (r, w = 12, h = 8, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) => new THREE.SphereGeometry(r, w, h, ps, pl, ts, tl);
const Box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const Cone = (r, h, n = 8) => new THREE.ConeGeometry(r, h, n);
const Tor = (r, t, a = 6, b = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, a, b, arc);

// ───────── 유닛 생김새 ─────────
const SKIN = '#f6d3b3';
const LOOK = {
  novice: { robe: '#2a3550', haori: '#5a6a8a', hair: '#1a1a1a', wep: 'katana', fx: '#ffffff' },
  hunter: { robe: '#4a3a20', haori: '#7a8a3a', hair: '#3a2a1a', wep: 'bow', fx: '#c8f8a8', extra: 'hood' },
  talisman: { robe: '#e8e0d0', haori: '#c83838', hair: '#1a1a1a', wep: 'talisman', fx: '#ffe080', extra: 'hat' },
  powder: { robe: '#3a3a3a', haori: '#a86a28', hair: '#5a3a1a', wep: 'bomb', fx: '#ffa040', extra: 'band' },
  needle: { robe: '#284028', haori: '#58a858', hair: '#202820', wep: 'bow', fx: '#80ff80', extra: 'mask' },
  wave: { robe: '#183058', haori: '#3888d8', hair: '#101828', wep: 'katana', fx: '#58c8ff' },
  wind: { robe: '#2a5a3a', haori: '#98d8a8', hair: '#d8d8d8', wep: 'bow', fx: '#c8ffd8' },
  frost: { robe: '#d8e8f8', haori: '#68a8e8', hair: '#e8f0ff', wep: 'staff', fx: '#a8e8ff' },
  spark: { robe: '#302848', haori: '#e8d040', hair: '#f8e060', wep: 'staff', fx: '#fff080', extra: 'spiky' },
  monk: { robe: '#6a4020', haori: '#c88838', hair: null, wep: 'hammer', fx: '#ffd090' },
  flame: { robe: '#7a1810', haori: '#e85020', hair: '#f8a020', wep: 'katana', fx: '#ff7030', extra: 'spiky' },
  spear: { robe: '#28304a', haori: '#f8d838', hair: '#202020', wep: 'spear', fx: '#fff070', extra: 'band' },
  moon: { robe: '#1a1838', haori: '#5858b8', hair: '#c8c8f0', wep: 'bow', fx: '#c8c0ff', extra: 'tail' },
  petal: { robe: '#f8e8f0', haori: '#f898c0', hair: '#3a1828', wep: 'staff', fx: '#ffb0d8', extra: 'tail' },
  shadow: { robe: '#181818', haori: '#383848', hair: '#101010', wep: 'katana', fx: '#b090ff', extra: 'mask' },
  sun: { robe: '#a82010', haori: '#f8c030', hair: '#f8f0d0', wep: 'katana', fx: '#ffd040', extra: 'spiky' },
  storm: { robe: '#203858', haori: '#a8c8e8', hair: '#e8e8e8', wep: 'bow', fx: '#d0f0ff', extra: 'tail' },
  queen: { robe: '#c8e8ff', haori: '#3878c8', hair: '#f8f8ff', wep: 'staff', fx: '#a8f0ff', extra: 'crown' },
  thunder: { robe: '#282040', haori: '#f8e040', hair: '#f8f8f8', wep: 'spear', fx: '#fff060', extra: 'horns' },
  emperor: { robe: '#f8f0e0', haori: '#d8a020', hair: '#101010', wep: 'katana', fx: '#ffe8a0', extra: 'crown' },
  fox: { robe: '#f8f0f0', haori: '#f86838', hair: '#f8f0e0', wep: 'staff', fx: '#ff9050', extra: 'ears' },
  bird: { robe: '#18284a', haori: '#38b8f8', hair: '#f8f8f8', wep: 'bow', fx: '#80e0ff', extra: 'wings' },
  h_flame: { wep: 'katana', extra: 'spiky' }, h_water: { wep: 'katana', extra: 'tail' }, h_thunder: { wep: 'katana', extra: 'spiky' },
  h_wind: { wep: 'katana', extra: 'spiky' }, h_moth: { wep: 'staff', extra: 'ears' }, h_stone: { wep: 'hammer', extra: 'bald' },
  h_sound: { wep: 'katana', extra: 'band' }, h_moon: { wep: 'bow', extra: 'tail' },
  x_allstar: { wep: 'katana', extra: 'band' }, x_crimson: { wep: 'katana', extra: 'horns' }, x_spider: { wep: 'staff', extra: 'tail' }, x_snow: { wep: 'katana', extra: 'crown' },
  x_inferno: { wep: 'katana', extra: 'spiky' }, x_abyss: { wep: 'bow', extra: 'hat' }, x_shadowlord: { wep: 'katana', extra: 'mask' }, x_dawn: { wep: 'staff', extra: 'crown' },
};
function lookOf(t) {
  const l = { ...(LOOK[t.id] || LOOK.novice) };
  if (t.look) Object.assign(l, t.look);
  if (l.extra === 'bald') l.hair = null;
  return l;
}

const charGeoCache = new Map();
function charGeometry(t) {
  if (charGeoCache.has(t.id)) return charGeoCache.get(t.id);
  const L = lookOf(t);
  const P = [];
  const dark = shade(L.robe, 0.55);
  // 하카마 + 발
  P.push(part(Cyl(0.16, 0.25, 0.34, 12), dark, { p: [0, 0.17, 0] }));
  P.push(part(Box(0.1, 0.05, 0.16), '#2a2020', { p: [0.08, 0.02, 0.03] }), part(Box(0.1, 0.05, 0.16), '#2a2020', { p: [-0.08, 0.02, 0.03] }));
  // 몸통 + 띠
  P.push(part(Cyl(0.14, 0.17, 0.26, 12), L.robe, { p: [0, 0.46, 0] }));
  P.push(part(Cyl(0.175, 0.175, 0.05, 12), '#f0e8d8', { p: [0, 0.36, 0] }));
  // 하오리 (앞이 트인 겉옷)
  P.push(part(Cyl(0.19, 0.28, 0.46, 14, true, 0.45, Math.PI * 2 - 0.9), L.haori, { p: [0, 0.38, -0.01] }));
  P.push(part(Cyl(0.192, 0.282, 0.06, 14, true, 0.45, Math.PI * 2 - 0.9), shade(L.haori, 0.6), { p: [0, 0.18, -0.01] }));
  // 소매 + 손
  for (const sx of [1, -1]) {
    P.push(part(Cyl(0.065, 0.1, 0.26, 8), L.haori, { p: [sx * 0.21, 0.43, 0.02], r: [0.3, 0, sx * 0.35] }));
    P.push(part(Sph(0.048, 8, 6), SKIN, { p: [sx * 0.25, 0.3, 0.07] }));
  }
  // 머리
  P.push(part(Sph(0.17, 16, 12), SKIN, { p: [0, 0.75, 0] }));
  for (const sx of [1, -1]) {
    P.push(part(Sph(0.032, 8, 6), '#1a1020', { p: [sx * 0.062, 0.75, 0.148], s: [1, 1.3, 0.6] }));
    P.push(part(Sph(0.011, 6, 4), '#ffffff', { p: [sx * 0.07, 0.765, 0.165] }));
  }
  if (L.extra === 'mask') P.push(part(Sph(0.172, 14, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.3), '#202028', { p: [0, 0.75, 0.005] }));
  // 머리카락
  if (L.hair) {
    P.push(part(Sph(0.185, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), L.hair, { p: [0, 0.77, -0.018] }));
    P.push(part(Sph(0.16, 12, 8), L.hair, { p: [0, 0.73, -0.07], s: [1.05, 1, 0.8] }));
    for (const bx of [-0.09, 0, 0.09]) P.push(part(Cone(0.05, 0.12, 5), L.hair, { p: [bx, 0.83, 0.13], r: [Math.PI * 0.85, 0, 0] }));
    if (L.extra === 'spiky') for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; P.push(part(Cone(0.06, 0.2, 5), L.hair, { p: [Math.sin(a) * 0.12, 0.88, Math.cos(a) * 0.1 - 0.05], r: [-Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9] })); }
    if (L.extra === 'tail') P.push(part(Cyl(0.05, 0.02, 0.32, 6), L.hair, { p: [0, 0.68, -0.2], r: [0.5, 0, 0] }));
  } else P.push(part(Sph(0.172, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), shade(SKIN, 0.9), { p: [0, 0.755, 0] }));
  if (L.extra === 'hood') P.push(part(Sph(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), L.haori, { p: [0, 0.76, -0.03] }));
  if (L.extra === 'hat') { P.push(part(Cone(0.36, 0.16, 16), '#d8b868', { p: [0, 0.95, 0] })); }
  if (L.extra === 'band') P.push(part(Tor(0.175, 0.022, 6, 16), '#d83030', { p: [0, 0.82, 0], r: [Math.PI / 2, 0, 0] }));
  if (L.extra === 'crown') { P.push(part(Cyl(0.13, 0.13, 0.07, 10, true), '#f8d040', { p: [0, 0.96, 0] })); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; P.push(part(Cone(0.03, 0.08, 4), '#f8d040', { p: [Math.sin(a) * 0.13, 1.02, Math.cos(a) * 0.13] })); } }
  if (L.extra === 'horns') for (const sx of [1, -1]) P.push(part(Cone(0.035, 0.16, 6), '#f8e8a0', { p: [sx * 0.1, 0.94, 0.02], r: [0, 0, -sx * 0.4] }));
  if (L.extra === 'ears') for (const sx of [1, -1]) P.push(part(Cone(0.06, 0.16, 4), L.hair || L.haori, { p: [sx * 0.11, 0.95, -0.02], r: [0, 0, -sx * 0.3] }));
  if (L.extra === 'wings') for (const sx of [1, -1]) P.push(part(Box(0.42, 0.24, 0.03), L.haori, { p: [sx * 0.3, 0.6, -0.2], r: [0.2, sx * 0.4, sx * 0.4] }));
  // 등급 장식
  if (t.tier >= 3) for (const sx of [1, -1]) P.push(part(Sph(0.08, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), shade(L.haori, 0.75), { p: [sx * 0.2, 0.56, 0] }));
  if (t.tier >= 4 || t.hero) P.push(part(Cyl(0.24, 0.36, 0.5, 14, true, Math.PI * 0.75, Math.PI * 0.5), shade(L.haori, 0.8), { p: [0, 0.34, -0.06] }));
  const g = merge(P);
  charGeoCache.set(t.id, g);
  return g;
}

const wepGeoCache = new Map();
function weaponGeometry(kind, L, big) {
  const key = kind + (big ? '!' : '') + L.fx;
  if (wepGeoCache.has(key)) return wepGeoCache.get(key);
  const P = [];
  const k = big ? 1.25 : 1;
  if (kind === 'katana') {
    P.push(part(Cyl(0.02, 0.02, 0.14, 6), '#3a2418', { p: [0, 0.05, 0] }));
    P.push(part(Cyl(0.045, 0.045, 0.015, 10), '#c8a040', { p: [0, 0.13, 0] }));
    P.push(part(Box(0.035, 0.55 * k, 0.012), big ? L.fx : '#e8eef8', { p: [0, 0.13 + 0.275 * k, 0] }));
  } else if (kind === 'spear') {
    P.push(part(Cyl(0.018, 0.018, 0.95, 6), '#5a3a20', { p: [0, 0.3, 0] }));
    P.push(part(Cone(0.04, 0.18, 6), '#e8eef8', { p: [0, 0.86, 0] }));
  } else if (kind === 'hammer') {
    P.push(part(Cyl(0.022, 0.022, 0.6, 6), '#5a3a20', { p: [0, 0.2, 0] }));
    P.push(part(Box(0.14 * k, 0.2 * k, 0.24 * k), '#6a6a78', { p: [0, 0.52, 0] }));
  } else if (kind === 'bow') {
    P.push(part(Tor(0.28, 0.018, 4, 16, Math.PI), '#6a4020', { r: [0, Math.PI / 2, Math.PI / 2], p: [0, 0.2, 0] }));
    P.push(part(Cyl(0.004, 0.004, 0.56, 3), '#f0f0f0', { p: [0, 0.2, -0.0] }));
  } else if (kind === 'staff' || kind === 'talisman') {
    P.push(part(Cyl(0.018, 0.022, 0.8, 6), '#6a4a28', { p: [0, 0.25, 0] }));
    if (kind === 'talisman') P.push(part(Box(0.1, 0.18, 0.01), '#f8f0d0', { p: [0.06, 0.6, 0] }));
    else P.push(part(Tor(0.07, 0.015, 6, 12), '#c8a040', { p: [0, 0.68, 0] }));
  } else if (kind === 'bomb') {
    P.push(part(Sph(0.08, 10, 8), '#2a2a30', { p: [0, 0.06, 0] }));
    P.push(part(Cyl(0.01, 0.01, 0.08, 4), '#c8a060', { p: [0.03, 0.15, 0], r: [0, 0, -0.5] }));
  }
  const g = merge(P);
  wepGeoCache.set(key, g);
  return g;
}

function makeUnit(t, owner, cat) {
  const L = lookOf(t);
  const root = new THREE.Group();
  const scale = t.hidden ? 1.5 : t.hero ? 1.45 : 1.08 + t.tier * 0.06;
  // 받침: 등급 색 + 주인 색 테두리
  const tierCol = cat.tiers[t.tier - 1].color;
  const base = new THREE.Mesh(Cyl(0.38, 0.42, 0.07, 24), toon({ color: tierCol }));
  base.position.y = 0.035; base.receiveShadow = true;
  root.add(base);
  const ownerRing = new THREE.Mesh(Tor(0.4, 0.035, 6, 32), new THREE.MeshBasicMaterial({ color: cat.colors[owner] }));
  ownerRing.rotation.x = Math.PI / 2; ownerRing.position.y = 0.075;
  root.add(ownerRing);
  const body = new THREE.Group();
  body.position.y = 0.07;
  body.scale.setScalar(scale);
  root.add(body);
  const geo = charGeometry(t);
  const mesh = new THREE.Mesh(geo, VCOL); mesh.castShadow = true;
  const out = new THREE.Mesh(geo, OUTLINE);
  body.add(mesh, out);
  // 무기 (오른손에서 휘두름)
  const pivot = new THREE.Group();
  pivot.position.set(-0.25, 0.32, 0.08);
  const wg = weaponGeometry(L.wep, L, t.tier >= 4);
  const wm = new THREE.Mesh(wg, VCOL); wm.castShadow = true;
  const wo = new THREE.Mesh(wg, OUTLINE);
  pivot.add(wm, wo);
  if (L.wep === 'staff') { const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: L.fx, blending: THREE.AdditiveBlending, depthWrite: false })); orb.position.y = 0.68; orb.scale.setScalar(0.28); pivot.add(orb); }
  if (L.wep === 'bow') { pivot.position.set(0.24, 0.42, 0.14); pivot.rotation.set(0, 0, 0.2); }
  body.add(pivot);
  // 등급 오라: 등급 색 빛기둥 (높을수록 크고 진하게, 히든은 무지개 + 도는 고리)
  const AURA = { 1: [0.2, 0.75], 2: [0.42, 0.95], 3: [0.55, 1.1], 4: [0.65, 1.3], 5: [0.75, 1.5], 6: [0.7, 1.45], 7: [0.85, 1.9] };
  const [aOp, aH] = AURA[t.tier] || AURA[1];
  const aura = new THREE.Mesh(Cyl(0.44, 0.48, aH, 24, true), new THREE.MeshBasicMaterial({ map: auraTex, color: t.hero ? L.fx : tierCol, transparent: true, opacity: aOp, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  aura.position.y = aH / 2 + 0.05;
  root.add(aura);
  const rings = [];
  if (t.tier >= 5) {
    for (let i = 0; i < (t.hidden ? 3 : 1); i++) {
      const rg = new THREE.Mesh(Tor(0.5 + i * 0.08, 0.018, 6, 40), new THREE.MeshBasicMaterial({ color: tierCol, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      rg.rotation.x = Math.PI / 2; rg.position.y = 0.2 + i * 0.35;
      root.add(rg); rings.push(rg);
    }
  }
  // 높은 등급: 빛 + 후광
  let glow = null;
  if (t.tier >= 4 || t.hero) {
    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: t.hero || t.hidden ? L.fx : tierCol, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    glow.scale.setScalar(t.hero ? 1.6 : 1.3); glow.position.y = 0.5;
    root.add(glow);
  }
  if (t.tier === 5) { const halo = new THREE.Mesh(Tor(0.14, 0.015, 6, 24), new THREE.MeshBasicMaterial({ color: '#fff3a0' })); halo.rotation.x = Math.PI / 2; halo.position.y = 1.08; body.add(halo); }
  return { root, body, pivot, base, glow, aura, aOp, rings, t, L, wep: L.wep, atkT: -9, face: 0, faceTo: 0, lunge: new THREE.Vector3(), scale };
}

// ───────── 요괴 생김새 ─────────
const enemyGeoCache = new Map();
function enemyGeometry(k) {
  if (enemyGeoCache.has(k)) return enemyGeoCache.get(k);
  const P = [];
  const eyes = (y, z, gap = 0.08, r = 0.045, col = '#fff8e0', pup = '#100808') => { for (const sx of [1, -1]) { P.push(part(Sph(r, 8, 6), col, { p: [sx * gap, y, z] })); P.push(part(Sph(r * 0.5, 6, 4), pup, { p: [sx * gap, y, z + r * 0.7] })); } };
  const horns = (y, gap, col = '#f8e8b0', h = 0.14) => { for (const sx of [1, -1]) P.push(part(Cone(0.04, h, 6), col, { p: [sx * gap, y, 0], r: [0, 0, -sx * 0.35] })); };
  switch (k) {
    case 'imp': case 'mini': case 'b_ogre': {
      const col = k === 'imp' ? '#d84838' : k === 'mini' ? '#8848b8' : '#c83020';
      P.push(part(Sph(0.24, 14, 10), col, { p: [0, 0.3, 0], s: [1, 1.05, 0.95] }));
      P.push(part(Cyl(0.2, 0.22, 0.08, 12), '#e8c060', { p: [0, 0.16, 0] }));
      for (const sx of [1, -1]) { P.push(part(Cyl(0.05, 0.06, 0.14, 6), shade(col, 0.8), { p: [sx * 0.1, 0.05, 0] })); P.push(part(Sph(0.06, 8, 6), col, { p: [sx * 0.25, 0.28, 0.06] })); }
      eyes(0.38, 0.19, 0.08, 0.055);
      P.push(part(Box(0.14, 0.03, 0.02), '#fff', { p: [0, 0.25, 0.22] }));
      horns(0.53, 0.1);
      if (k !== 'imp') { P.push(part(Cyl(0.03, 0.08, 0.45, 8), '#5a3a20', { p: [0.3, 0.35, 0.1], r: [0.3, 0, -0.4] })); for (let i = 0; i < 4; i++) P.push(part(Cone(0.02, 0.06, 4), '#ccc', { p: [0.38 + i * 0.02, 0.5 + i * 0.03, 0.15], r: [0, 0, -1.2] })); }
      if (k === 'b_ogre') { P.push(part(Cyl(0.12, 0.12, 0.07, 8, true), '#f8d040', { p: [0, 0.58, 0] })); }
      break;
    }
    case 'wisp':
      P.push(part(Sph(0.18, 12, 10), '#a8d8ff', { p: [0, 0.32, 0] }));
      P.push(part(Cone(0.17, 0.32, 10), '#d8f0ff', { p: [0, 0.55, -0.04], r: [-0.3, 0, 0] }));
      eyes(0.34, 0.15, 0.06, 0.04, '#203060', '#000');
      break;
    case 'armor':
      P.push(part(Box(0.3, 0.3, 0.2), '#585868', { p: [0, 0.32, 0] }));
      P.push(part(Sph(0.15, 10, 8), '#e8e0d0', { p: [0, 0.6, 0] }));
      P.push(part(Cone(0.18, 0.18, 8), '#484858', { p: [0, 0.76, 0] }));
      for (const sx of [1, -1]) { P.push(part(Sph(0.035, 6, 4), '#ff3030', { p: [sx * 0.05, 0.6, 0.13] })); P.push(part(Cyl(0.04, 0.04, 0.2, 6), '#e8e0d0', { p: [sx * 0.08, 0.1, 0] })); P.push(part(Sph(0.09, 8, 6), '#686878', { p: [sx * 0.2, 0.45, 0] })); }
      P.push(part(Box(0.04, 0.5, 0.03), '#c8c8d8', { p: [0.24, 0.35, 0.12] }));
      break;
    case 'slime': case 'slime_s':
      P.push(part(Sph(0.25, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), '#58d868', { p: [0, 0.06, 0], s: [1, 1.1, 1] }));
      P.push(part(Sph(0.1, 8, 6), '#a8f8a8', { p: [0.08, 0.25, 0.08] }));
      eyes(0.2, 0.2, 0.07, 0.045);
      break;
    case 'troll':
      P.push(part(Sph(0.3, 14, 10), '#6a8a48', { p: [0, 0.38, 0], s: [1.1, 1, 0.9] }));
      P.push(part(Sph(0.16, 10, 8), '#7a9a58', { p: [0, 0.68, 0.06] }));
      for (const sx of [1, -1]) { P.push(part(Cyl(0.08, 0.1, 0.2, 6), '#4a6a38', { p: [sx * 0.15, 0.08, 0] })); P.push(part(Cone(0.025, 0.08, 5), '#fff', { p: [sx * 0.06, 0.62, 0.19] })); P.push(part(Cyl(0.08, 0.06, 0.34, 6), '#6a8a48', { p: [sx * 0.33, 0.35, 0.05], r: [0, 0, sx * 0.3] })); }
      eyes(0.72, 0.18, 0.06, 0.035, '#ffe040', '#300');
      horns(0.82, 0.08, '#d8c8a0', 0.1);
      break;
    case 'crow':
      P.push(part(Sph(0.18, 12, 8), '#1a1a28', { p: [0, 0.3, 0], s: [0.9, 0.9, 1.2] }));
      P.push(part(Sph(0.12, 10, 8), '#22222e', { p: [0, 0.45, 0.14] }));
      P.push(part(Cone(0.05, 0.16, 6), '#f8a020', { p: [0, 0.43, 0.3], r: [Math.PI / 2, 0, 0] }));
      eyes(0.48, 0.24, 0.05, 0.03, '#ff4040', '#000');
      P.push(part(Box(0.2, 0.02, 0.15), '#1a1a28', { p: [0, 0.3, -0.25] }));
      break;
    case 'spider':
      P.push(part(Sph(0.2, 12, 8), '#3a2848', { p: [0, 0.25, -0.12] }));
      P.push(part(Sph(0.13, 10, 8), '#4a3858', { p: [0, 0.22, 0.12] }));
      for (let i = 0; i < 4; i++) for (const sx of [1, -1]) P.push(part(Cyl(0.015, 0.015, 0.36, 4), '#2a1838', { p: [sx * 0.2, 0.15, 0.12 - i * 0.08], r: [0, 0, sx * 1.0] }));
      for (let i = 0; i < 4; i++) P.push(part(Sph(0.025, 6, 4), '#ff3030', { p: [(i - 1.5) * 0.04, 0.27, 0.24] }));
      break;
    case 'snake': case 'b_serpent': {
      const col = k === 'snake' ? '#58a048' : '#2a8a58';
      for (let i = 0; i < 5; i++) P.push(part(Sph(0.13 - i * 0.015, 10, 8), i % 2 ? shade(col, 0.85) : col, { p: [Math.sin(i * 1.3) * 0.08, 0.12, -i * 0.15] }));
      P.push(part(Sph(0.15, 12, 8), col, { p: [0, 0.22, 0.14], s: [1, 0.8, 1.2] }));
      eyes(0.3, 0.24, 0.07, 0.035, '#ffe040', '#000');
      if (k === 'b_serpent') { P.push(part(Cyl(0.1, 0.1, 0.06, 8, true), '#f8d040', { p: [0, 0.36, 0.12] })); horns(0.36, 0.08, '#f8d040', 0.1); }
      break;
    }
    case 'b_centi':
      for (let i = 0; i < 7; i++) { P.push(part(Sph(0.15, 10, 8), i % 2 ? '#8a3018' : '#a84020', { p: [0, 0.16, 0.4 - i * 0.16] })); for (const sx of [1, -1]) P.push(part(Cyl(0.015, 0.015, 0.28, 4), '#3a1808', { p: [sx * 0.18, 0.08, 0.4 - i * 0.16], r: [0, 0, sx * 1.1] })); }
      eyes(0.24, 0.53, 0.07, 0.04, '#ffe040', '#000');
      horns(0.3, 0.06, '#e8c060', 0.16);
      break;
    case 'chest':
      P.push(part(Sph(0.22, 12, 8), '#58a848', { p: [0, 0.18, 0], s: [1.1, 0.8, 1] }));
      P.push(part(Box(0.24, 0.16, 0.18), '#c88828', { p: [0, 0.38, -0.05] }));
      P.push(part(Box(0.26, 0.04, 0.2), '#f8d040', { p: [0, 0.46, -0.05] }));
      for (const sx of [1, -1]) { P.push(part(Sph(0.06, 8, 6), '#fff', { p: [sx * 0.1, 0.32, 0.12] })); P.push(part(Sph(0.03, 6, 4), '#000', { p: [sx * 0.1, 0.33, 0.17] })); }
      break;
    case 'b_king':
      P.push(part(Cyl(0.18, 0.34, 0.6, 12), '#28142e', { p: [0, 0.3, 0] }));
      P.push(part(Cyl(0.3, 0.42, 0.62, 14, true, Math.PI * 0.6, Math.PI * 0.8), '#6a1828', { p: [0, 0.32, -0.04] }));
      P.push(part(Sph(0.2, 14, 10), '#3a2040', { p: [0, 0.75, 0] }));
      for (const sx of [1, -1]) { P.push(part(Sph(0.035, 6, 4), '#ff3030', { p: [sx * 0.07, 0.78, 0.18] })); P.push(part(Cone(0.05, 0.3, 6), '#1a0a10', { p: [sx * 0.14, 1.0, 0], r: [0, 0, -sx * 0.4] })); P.push(part(Sph(0.11, 8, 6), '#4a2050', { p: [sx * 0.26, 0.58, 0] })); }
      P.push(part(Cyl(0.15, 0.15, 0.08, 10, true), '#f8c030', { p: [0, 0.92, 0] }));
      break;
    default:
      P.push(part(Sph(0.22, 10, 8), '#a84848', { p: [0, 0.25, 0] }));
  }
  const g = merge(P);
  enemyGeoCache.set(k, g);
  return g;
}
const ENEMY_SCALE = (k, fl) => 1.2 * (fl & 32 ? 2.2 : fl & 64 ? 1.5 : k === 'troll' ? 1.25 : k === 'slime_s' ? 0.6 : k === 'chest' ? 1.1 : 1);

function makeEnemy(ent) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const geo = enemyGeometry(ent.k);
  const mat = toon({ vertexColors: true, emissive: new THREE.Color(0, 0, 0) });
  if (ent.k === 'wisp') mat.emissive.set('#3070a0');
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
  const out = new THREE.Mesh(geo, OUTLINE);
  body.add(mesh, out);
  let wings = null;
  if (ent.k === 'crow') {
    wings = [1, -1].map((sx) => { const w = new THREE.Mesh(Box(0.32, 0.02, 0.16), toon({ color: '#20202c' })); w.geometry.translate(sx * 0.16, 0, 0); w.position.set(sx * 0.08, 0.36, 0); body.add(w); return w; });
  }
  const sc = ENEMY_SCALE(ent.k, ent.fl || 0);
  body.scale.setScalar(sc);
  let aura = null;
  if ((ent.fl || 0) & 32 || ent.k === 'wisp') {
    aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: ent.k === 'wisp' ? '#80c0ff' : '#ff3050', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
    aura.scale.setScalar(ent.k === 'wisp' ? 0.9 : 2.6); aura.position.y = ent.k === 'wisp' ? 0.35 : 0.7;
    root.add(aura);
  }
  return { root, body, mat, wings, sc, flash: 0, knock: 0, knockDir: new THREE.Vector3(), face: 0, lx: null, lz: null, aura, hp: 100, born: performance.now() };
}

// ───────── 지형 ─────────
const PROP = {};
function propGeometry(ch, th) {
  const key = ch + th.name;
  if (PROP[key]) return PROP[key];
  const P = [];
  switch (ch) {
    case '🎋': for (let i = 0; i < 3; i++) { P.push(part(Cyl(0.035, 0.04, 1.1 + i * 0.25, 6), '#78b848', { p: [(i - 1) * 0.15, 0.55 + i * 0.12, (i % 2) * 0.1] })); P.push(part(Cone(0.12, 0.3, 5), '#5a9a38', { p: [(i - 1) * 0.15 + 0.08, 0.9 + i * 0.2, (i % 2) * 0.1], r: [0, 0, -1] })); } break;
    case '🌿': case '🌾': for (let i = 0; i < 5; i++) P.push(part(Cone(0.05, 0.35, 4), ch === '🌾' ? '#c8b060' : '#5aa848', { p: [Math.sin(i * 2.4) * 0.15, 0.17, Math.cos(i * 2.4) * 0.15], r: [Math.sin(i) * 0.3, 0, Math.cos(i) * 0.3] })); break;
    case '🪨': case '🐚': case '🦴': P.push(part(new THREE.DodecahedronGeometry(0.28, 0), ch === '🦴' ? '#e8e0d0' : '#8a8890', { p: [0, 0.16, 0], s: [1.2, 0.7, 1] })); P.push(part(new THREE.DodecahedronGeometry(0.14, 0), '#9a98a0', { p: [0.25, 0.08, 0.12] })); break;
    case '🏮': P.push(part(Cyl(0.03, 0.03, 0.9, 6), '#3a2418', { p: [0, 0.45, 0] })); P.push(part(Box(0.3, 0.04, 0.04), '#3a2418', { p: [0.1, 0.88, 0] })); break;
    case '🏯': P.push(part(Box(0.55, 0.35, 0.55), '#e8e0d0', { p: [0, 0.18, 0] })); P.push(part(Cone(0.55, 0.28, 4), '#3a3048', { p: [0, 0.48, 0], r: [0, Math.PI / 4, 0] })); P.push(part(Box(0.35, 0.25, 0.35), '#e8e0d0', { p: [0, 0.72, 0] })); P.push(part(Cone(0.4, 0.25, 4), '#3a3048', { p: [0, 0.96, 0], r: [0, Math.PI / 4, 0] })); break;
    case '🌲': P.push(part(Cyl(0.05, 0.07, 0.3, 6), '#5a3a20', { p: [0, 0.15, 0] })); for (let i = 0; i < 3; i++) P.push(part(Cone(0.36 - i * 0.09, 0.4, 8), th.name === '설산' ? (i === 2 ? '#f8f8ff' : '#2a5a48') : '#2a6a3a', { p: [0, 0.4 + i * 0.25, 0] })); break;
    case '⛄': P.push(part(Sph(0.2, 10, 8), '#f8f8ff', { p: [0, 0.2, 0] })); P.push(part(Sph(0.14, 10, 8), '#f8f8ff', { p: [0, 0.48, 0] })); P.push(part(Cone(0.03, 0.12, 5), '#f87820', { p: [0, 0.48, 0.15], r: [Math.PI / 2, 0, 0] })); break;
    case '🌵': P.push(part(Cyl(0.08, 0.09, 0.7, 8), '#4a8a38', { p: [0, 0.35, 0] })); P.push(part(Cyl(0.05, 0.05, 0.3, 6), '#4a8a38', { p: [0.14, 0.45, 0], r: [0, 0, -0.4] })); break;
    case '🍄': P.push(part(Cyl(0.05, 0.06, 0.2, 6), '#f0e8d8', { p: [0, 0.1, 0] })); P.push(part(Sph(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#c83838', { p: [0, 0.18, 0] })); P.push(part(Cyl(0.03, 0.04, 0.12, 6), '#f0e8d8', { p: [0.18, 0.06, 0.1] })); P.push(part(Sph(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#8848b8', { p: [0.18, 0.11, 0.1] })); break;
    case '🪵': P.push(part(Cyl(0.12, 0.12, 0.6, 8), '#6a4428', { p: [0, 0.12, 0], r: [0, 0, Math.PI / 2] })); break;
    case '⛩️': P.push(part(Cyl(0.04, 0.05, 0.8, 8), '#c83020', { p: [-0.3, 0.4, 0] }), part(Cyl(0.04, 0.05, 0.8, 8), '#c83020', { p: [0.3, 0.4, 0] }), part(Box(0.9, 0.07, 0.1), '#2a1a1a', { p: [0, 0.82, 0] }), part(Box(0.7, 0.05, 0.07), '#c83020', { p: [0, 0.68, 0] })); break;
    case '🌸': case '🍁': case '🌳': case '🌴': {
      P.push(part(Cyl(0.05, 0.08, 0.6, 6), '#5a3a20', { p: [0, 0.3, 0] }));
      const leaf = ch === '🌸' ? '#f8a8c8' : ch === '🍁' ? '#e85020' : ch === '🌴' ? '#4a9a38' : '#3a8a3a';
      if (ch === '🌴') for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; P.push(part(Box(0.45, 0.03, 0.12), leaf, { p: [Math.sin(a) * 0.2, 0.62, Math.cos(a) * 0.2], r: [0, a + Math.PI / 2, -0.4] })); }
      else for (let i = 0; i < 4; i++) P.push(part(Sph(0.24 - i * 0.02, 10, 8), i % 2 ? shade(leaf, 0.85) : leaf, { p: [Math.sin(i * 1.7) * 0.15, 0.72 + (i % 2) * 0.12, Math.cos(i * 1.7) * 0.15] }));
      break;
    }
    case '🌋': P.push(part(Cone(0.4, 0.5, 8), '#4a3030', { p: [0, 0.25, 0] })); P.push(part(Cyl(0.1, 0.1, 0.04, 8), '#ff6020', { p: [0, 0.48, 0] })); break;
    case '🔥': P.push(part(Cone(0.12, 0.35, 6), '#ff8030', { p: [0, 0.18, 0] }), part(Cone(0.07, 0.25, 6), '#ffe060', { p: [0, 0.14, 0.02] })); break;
    case '🪦': P.push(part(Box(0.3, 0.4, 0.1), '#8a8a98', { p: [0, 0.2, 0] })); break;
    case '🍂': for (let i = 0; i < 6; i++) P.push(part(Box(0.12, 0.02, 0.08), i % 2 ? '#d88030' : '#b85020', { p: [Math.sin(i * 2) * 0.2, 0.02, Math.cos(i * 2) * 0.2], r: [0, i, 0] })); break;
    default: P.push(part(new THREE.DodecahedronGeometry(0.2, 0), '#888', { p: [0, 0.12, 0] }));
  }
  PROP[key] = merge(P);
  return PROP[key];
}

const tileToWorld = (x, y) => [x + 0.5 - S.W / 2, y + 0.5 - S.H / 2];
const worldX = (fx) => fx - S.W / 2;
const worldZ = (fy) => fy - S.H / 2;
const clampTile = ([x, y]) => [Math.max(0, Math.min(S.W - 1, x)), Math.max(0, Math.min(S.H - 1, y))];

function buildWorld(map, cat) {
  if (S.world) { S.scene.remove(S.world); S.world.traverse((o) => { if (o.material && o.material !== VCOL && o.material !== OUTLINE) o.material.dispose?.(); }); }
  for (const u of S.units.values()) S.dyn.remove(u.root);
  for (const e of S.enemies.values()) S.dyn.remove(e.root);
  S.units.clear(); S.enemies.clear();
  S.map = map; S.cat = cat; S.W = map.W; S.H = map.H;
  const th = cat.themes[map.theme];
  const world = new THREE.Group();
  S.world = world;
  S.scene.add(world);
  const sky = C(th.ground).lerp(C('#101820'), 0.75);
  S.scene.background = sky;
  S.scene.fog = new THREE.Fog(sky, 30, 60);
  // 땅 (풀 칸은 높게, 길은 낮게 → 길이 파인 디오라마)
  const pathSet = new Set(map.pathTiles.map(([x, y]) => x + ',' + y));
  const r = mulberry(map.W * 131 + map.H + map.name.length);
  const nGrass = map.W * map.H - pathSet.size;
  const grass = new THREE.InstancedMesh(Box(1, 0.3, 1), toon({ color: '#ffffff' }), nGrass);
  const path = new THREE.InstancedMesh(Box(1, 0.16, 1), toon({ color: '#ffffff' }), pathSet.size);
  grass.receiveShadow = path.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  let gi = 0, pi = 0;
  for (let y = 0; y < map.H; y++) for (let x = 0; x < map.W; x++) {
    const [wx, wz] = tileToWorld(x, y);
    if (pathSet.has(x + ',' + y)) {
      m4.makeTranslation(wx, -0.22, wz); path.setMatrixAt(pi, m4);
      path.setColorAt(pi++, C(th.path).multiplyScalar(0.92 + r() * 0.14));
    } else {
      m4.makeTranslation(wx, -0.15, wz); grass.setMatrixAt(gi, m4);
      grass.setColorAt(gi++, C((x + y) % 2 ? th.ground : th.ground2).multiplyScalar(0.93 + r() * 0.12));
    }
  }
  world.add(grass, path);
  // 받침 (디오라마 바닥)
  const slab = new THREE.Mesh(Box(map.W + 0.5, 1.4, map.H + 0.5), toon({ color: shade(th.edge, 0.7) }));
  slab.position.y = -1.0; slab.receiveShadow = true;
  world.add(slab);
  const rim = new THREE.Mesh(Box(map.W + 0.7, 0.12, map.H + 0.7), toon({ color: shade(th.ground, 0.6) }));
  rim.position.y = -0.36; world.add(rim);
  // 풀 장식 (한 번에 그림)
  const tuftGeo = merge([part(Cone(0.035, 0.16, 4), th.ground2, { p: [0, 0.08, 0] }), part(Cone(0.03, 0.12, 4), th.ground2, { p: [0.05, 0.06, 0.03], r: [0, 0, -0.3] })]);
  const tuftN = 420;
  const tufts = new THREE.InstancedMesh(tuftGeo, toon({ vertexColors: true, color: C('#ffffff').lerp(C(th.ground2), 0.0).multiplyScalar(1.25) }), tuftN);
  let tn = 0;
  for (let i = 0; i < tuftN * 3 && tn < tuftN; i++) {
    const x = Math.floor(r() * map.W), y = Math.floor(r() * map.H);
    if (pathSet.has(x + ',' + y)) continue;
    const [wx, wz] = tileToWorld(x, y);
    m4.compose(new THREE.Vector3(wx + (r() - 0.5) * 0.8, 0, wz + (r() - 0.5) * 0.8), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(1, 0.6 + r() * 0.8, 1));
    tufts.setMatrixAt(tn++, m4);
  }
  tufts.count = tn;
  world.add(tufts);
  // 장식물
  for (const [x, y, ch] of map.decor) {
    const g = propGeometry(ch, th);
    const m = new THREE.Mesh(g, VCOL); m.castShadow = true;
    const o = new THREE.Mesh(g, OUTLINE);
    const grp = new THREE.Group(); grp.add(m, o);
    const [wx, wz] = tileToWorld(x, y);
    grp.position.set(wx, 0, wz); grp.rotation.y = r() * 6; grp.scale.setScalar(0.85 + r() * 0.3);
    if (ch === '🏮') { const lamp = new THREE.Mesh(Cyl(0.11, 0.11, 0.22, 10), new THREE.MeshBasicMaterial({ color: '#ff6040' })); lamp.position.set(0.22, 0.72, 0); grp.add(lamp); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff8040', blending: THREE.AdditiveBlending, depthWrite: false })); gl.position.copy(lamp.position); gl.scale.setScalar(0.9); grp.add(gl); }
    world.add(grp);
  }
  // 입구 (소용돌이 문) · 결계
  S.portals = [];
  const seen = new Set();
  for (const p of map.paths) {
    const st = clampTile(p.pts[0]);
    const key = p.loop ? p.pts[0].join(',') + (p.start || 0) : st.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    let pos = st;
    if (p.loop && p.start) { // 순환 길의 반대편 입구
      const tiles = loopTiles(p.pts); pos = tiles[Math.floor(tiles.length * p.start)];
    }
    const [wx, wz] = tileToWorld(pos[0], pos[1]);
    const g = new THREE.Group();
    const ring = new THREE.Mesh(Tor(0.42, 0.07, 8, 24), toon({ color: '#5a2a7a', emissive: '#401060' }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.MeshBasicMaterial({ color: '#c060ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = -0.05;
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#b050ff', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
    gl.scale.set(1.4, 1.4, 1); gl.position.y = 0.3;
    g.add(ring, disc, gl);
    g.position.set(wx, -0.12, wz);
    world.add(g);
    S.portals.push({ g, ring, disc });
  }
  // 소환진 (본 전장만): 빛나는 마법진
  S.summonFx = null;
  if (map.summon && map.kindName !== '보스방' && map.kindName !== '이벤트') {
    const [sx, sz] = tileToWorld(map.summon[0], map.summon[1]);
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), new THREE.MeshBasicMaterial({ color: '#ffd870', transparent: true, opacity: 0.16, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    const ring1 = new THREE.Mesh(new THREE.RingGeometry(1.36, 1.46, 48), new THREE.MeshBasicMaterial({ color: '#ffe8a0', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    ring1.rotation.x = -Math.PI / 2;
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.96, 6), new THREE.MeshBasicMaterial({ color: '#ffd060', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    ring2.rotation.x = -Math.PI / 2;
    const ring3 = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.96, 3), new THREE.MeshBasicMaterial({ color: '#ffd060', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    ring3.rotation.x = -Math.PI / 2;
    g.add(disc, ring1, ring2, ring3);
    g.position.set(sx, 0.025, sz);
    world.add(g);
    S.summonFx = { g, ring2, ring3, disc };
  }
  const gates = [];
  if (map.base) for (const b of map.base) gates.push(b);
  else if (map.kind !== 'loop') for (const p of map.paths) gates.push(clampTile(p.pts[p.pts.length - 1]));
  const gseen = new Set();
  S.domes = [];
  for (const b of gates) {
    if (gseen.has(b.join(','))) continue; gseen.add(b.join(','));
    const [wx, wz] = tileToWorld(b[0], b[1]);
    const g = propGeometry('⛩️', th);
    const grp = new THREE.Group(); grp.add(new THREE.Mesh(g, VCOL), new THREE.Mesh(g, OUTLINE));
    grp.position.set(wx, -0.12, wz); grp.scale.setScalar(1.3);
    world.add(grp);
    const dome = new THREE.Mesh(Sph(0.95, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#80d0ff', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    dome.position.set(wx, -0.12, wz);
    world.add(dome);
    S.domes.push(dome);
  }
  // 길 위를 흐르는 빛 (방향 표시)
  S.flows = [];
  const fseen = new Set();
  for (const p of map.paths) {
    const k = JSON.stringify(p.pts) + (p.start || 0);
    if (fseen.has(k)) continue; fseen.add(k);
    const pts = p.pts.map(([x, y]) => new THREE.Vector3(x + 0.5 - S.W / 2, -0.08, y + 0.5 - S.H / 2));
    if (p.loop) pts.push(pts[0].clone());
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const len = cum[cum.length - 1];
    for (let i = 0; i < Math.ceil(len / 2.5); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff0c0', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.45 }));
      sp.scale.setScalar(0.28);
      world.add(sp);
      S.flows.push({ sp, pts, cum, len, off: i * 2.5 + (p.start || 0) * len, loop: p.loop });
    }
  }
  fitCamera();
}
function loopTiles(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
    let x = x1, y = y1;
    while (x !== x2 || y !== y2) { out.push([x, y]); x += dx; y += dy; }
  }
  return out;
}
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ───────── 카메라 ─────────
function fitCamera() {
  if (!S.wrap) return;
  const w = S.wrap.clientWidth, h = S.wrap.clientHeight;
  if (!w || !h) return;
  S.renderer.setSize(w, h, false);
  S.overlay.width = Math.round(w * S.dpr); S.overlay.height = Math.round(h * S.dpr);
  S.camera.aspect = w / h;
  S.camera.updateProjectionMatrix();
  const dir = new THREE.Vector3(0, 1.6, 1).normalize();
  const look = new THREE.Vector3(0, 0, 0.3);
  const corners = [];
  for (const x of [-S.W / 2 - 0.3, S.W / 2 + 0.3]) for (const z of [-S.H / 2 - 0.3, S.H / 2 + 0.6]) for (const y of [0, 0.9]) corners.push(new THREE.Vector3(x, y, z));
  let lo = 5, hi = 80;
  for (let i = 0; i < 30; i++) {
    const d = (lo + hi) / 2;
    S.camera.position.copy(look).addScaledVector(dir, d);
    S.camera.lookAt(look);
    S.camera.updateMatrixWorld();
    const ok = corners.every((c) => { const p = c.clone().project(S.camera); return Math.abs(p.x) <= 0.97 && Math.abs(p.y) <= 0.95; });
    if (ok) hi = d; else lo = d;
  }
  S.fitDist = hi; S.dir = dir; S.look0 = look.clone();
  applyZoom();
}
/** 마우스 휠 확대 (커서 위치를 중심으로) */
function applyZoom() {
  const z = S.zoom || 1;
  const look = S.look0.clone().add(S.pan || new THREE.Vector3());
  S.camera.position.copy(look).addScaledVector(S.dir, S.fitDist * z);
  S.camera.lookAt(look);
  S.camera.updateMatrixWorld();
  S.camBase.copy(S.camera.position); S.camLook.copy(look);
}
function onWheel(e) {
  if (!S.map) return;
  e.preventDefault();
  const before = pick(e.clientX, e.clientY);
  S.zoom = Math.max(0.45, Math.min(1, (S.zoom || 1) * (e.deltaY > 0 ? 1.12 : 0.89)));
  if (S.zoom >= 0.999) S.pan = new THREE.Vector3();
  applyZoom();
  const after = pick(e.clientX, e.clientY);
  if (before && after && S.zoom < 0.999) {
    S.pan = (S.pan || new THREE.Vector3()).add(new THREE.Vector3(before.fx - after.fx, 0, before.fy - after.fy));
    const lim = (1 - S.zoom) * 0.5;
    S.pan.x = Math.max(-S.W * lim, Math.min(S.W * lim, S.pan.x));
    S.pan.z = Math.max(-S.H * lim, Math.min(S.H * lim, S.pan.z));
    applyZoom();
  }
}

// ───────── 파티클 · 효과 ─────────
function spark(pos, color, n = 6, speed = 2.5, size = 0.18, life = 0.45, up = 1.5, grav = 6) {
  for (let i = 0; i < n; i++) {
    if (S.parts.length > 500) { const old = S.parts.shift(); (old.sp || old.mesh).removeFromParent(); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.copy(pos);
    sp.scale.setScalar(size);
    S.dyn.add(sp);
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
    S.parts.push({ sp, v: new THREE.Vector3(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s), t: 0, life: life * (0.6 + Math.random() * 0.6), size, grav });
  }
}
function chunks(pos, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(Box(0.08, 0.08, 0.08), toon({ color }));
    m.position.copy(pos);
    S.dyn.add(m);
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2;
    S.parts.push({ mesh: m, v: new THREE.Vector3(Math.cos(a) * s, 2 + Math.random() * 2.5, Math.sin(a) * s), t: 0, life: 0.7 + Math.random() * 0.3, grav: 12, spin: Math.random() * 10 });
  }
}
const arcGeo = new THREE.RingGeometry(0.28, 0.62, 20, 1, -1.2, 2.4);
function slashArc(pos, color, scale = 1, yaw = 0) {
  const m = new THREE.Mesh(arcGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  m.position.copy(pos); m.position.y += 0.35;
  m.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.9, 0, yaw + (Math.random() - 0.5));
  m.scale.setScalar(scale);
  S.dyn.add(m);
  S.arcs.push({ m, t: 0, life: 0.18, s0: scale });
}
function shock(pos, color, radius = 1, life = 0.35) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos.x, 0.08, pos.z);
  S.dyn.add(m);
  S.rings.push({ m, t: 0, life, r: radius });
}
const arrowGeo = merge([part(Cyl(0.012, 0.012, 0.4, 4), '#e8d8b0', { r: [Math.PI / 2, 0, 0] }), part(Cone(0.03, 0.08, 4), '#d0d8e0', { p: [0, 0, 0.22], r: [Math.PI / 2, 0, 0] })]);
function projectile(from, to, kind, color, onHit) {
  let obj;
  if (kind === 'bow') { obj = new THREE.Mesh(arrowGeo, VCOL); }
  else { obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false })); obj.scale.setScalar(kind === 'bomb' ? 0.3 : 0.45); }
  obj.position.copy(from);
  S.dyn.add(obj);
  const dist = from.distanceTo(to);
  S.projs.push({ obj, from: from.clone(), to: to.clone(), t: 0, life: Math.min(0.32, 0.06 + dist * 0.045), arc: kind === 'bomb' ? 1.2 : kind === 'bow' ? 0.3 : 0.15, onHit, trail: kind !== 'bow' ? color : null });
}

// 화면 글자 (데미지 숫자 등) — 겹쳐 그리는 2D 캔버스
function floatText(pos, text, color, size = 16, life = 0.75, rise = 0.9) { if (S.texts.length > 120) S.texts.shift(); S.texts.push({ pos: pos.clone(), text, color, size, t: 0, life, rise }); }

// ───────── 외부에서 부르는 함수 ─────────
function init(wrap, overlayCanvas) {
  try {
    const c = document.createElement('canvas');
    if (!(c.getContext('webgl2') || c.getContext('webgl'))) return false;
  } catch { return false; }
  S.wrap = wrap;
  S.overlay = overlayCanvas;
  S.octx = overlayCanvas.getContext('2d');
  S.dpr = Math.min(2, window.devicePixelRatio || 1);
  S.renderer = new THREE.WebGLRenderer({ antialias: true });
  S.renderer.setPixelRatio(S.dpr);
  S.renderer.shadowMap.enabled = true;
  S.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  S.renderer.outputColorSpace = THREE.SRGBColorSpace;
  const gl = S.renderer.domElement;
  gl.className = 'board3d';
  wrap.insertBefore(gl, overlayCanvas);
  S.scene = new THREE.Scene();
  S.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200);
  S.scene.add(new THREE.HemisphereLight('#e8f0ff', '#4a3a30', 1.4));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  sun.position.set(-8, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 12, bottom: -12, near: 1, far: 50 });
  sun.shadow.bias = -0.0008;
  S.scene.add(sun);
  S.dyn = new THREE.Group();
  S.scene.add(S.dyn);
  // 고른 칸 · 사거리 · 선택 표시
  S.hoverMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false }));
  S.hoverMesh.rotation.x = -Math.PI / 2; S.hoverMesh.visible = false;
  S.selTileMesh = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: '#ffe08a', side: THREE.DoubleSide }));
  S.selTileMesh.rotation.x = -Math.PI / 2; S.selTileMesh.visible = false;
  S.rangeMesh = new THREE.Group();
  S.rangeMesh.add(new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, depthWrite: false })));
  S.rangeMesh.add(new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false })));
  S.rangeMesh.rotation.x = -Math.PI / 2; S.rangeMesh.visible = false;
  S.selRing = new THREE.Mesh(Tor(0.5, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  S.selRing.rotation.x = Math.PI / 2; S.selRing.visible = false;
  S.aimMesh = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 48), new THREE.MeshBasicMaterial({ color: '#ff7050', transparent: true, opacity: 0.9, depthWrite: false }));
  S.aimMesh.rotation.x = -Math.PI / 2; S.aimMesh.visible = false;
  S.scene.add(S.hoverMesh, S.selTileMesh, S.rangeMesh, S.selRing, S.aimMesh);
  new ResizeObserver(() => fitCamera()).observe(wrap);
  overlayCanvas.addEventListener('wheel', onWheel, { passive: false });
  S.ok = true;
  return true;
}

/** 화면 좌표 → 칸 */
const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function pick(cx, cy) {
  const r = S.renderer.domElement.getBoundingClientRect();
  const v = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(v, S.camera);
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(ground, p)) return null;
  const fx = p.x + S.W / 2, fy = p.z + S.H / 2;
  return { fx, fy, x: Math.floor(fx), y: Math.floor(fy) };
}

function project(v) {
  const p = v.clone().project(S.camera);
  return [((p.x + 1) / 2) * S.overlay.width, ((1 - p.y) / 2) * S.overlay.height, p.z];
}

/** 서버 효과 이벤트 하나 */
function fx(f, app) {
  if (!S.ok || !S.map) return;
  const kind = f[0];
  const wp = (x10, y10, y = 0.4) => new THREE.Vector3(worldX(x10 / 10), y, worldZ(y10 / 10));
  switch (kind) {
    case 'atk': {
      const [, uid0, eid, dmg, k, tier, crit, ex, ey] = f;
      const uid = (S.leaderOf && S.leaderOf.get(uid0)) || uid0;
      const u = S.units.get(uid);
      const target = S.enemies.get(eid);
      const tpos = target ? target.root.position.clone().setY(0.4 * (target.sc || 1)) : wp(ex, ey);
      const color = u ? u.L.fx : '#ffffff';
      const hitNow = () => hitEffect(target, tpos, dmg, crit, k, tier, color, u && u.t.hero);
      if (u) {
        u.atkT = performance.now();
        u.faceTo = Math.atan2(tpos.x - u.root.position.x, tpos.z - u.root.position.z);
        const melee = u.t.cat === 'blade';
        if (melee) { u.lunge.set(tpos.x - u.root.position.x, 0, tpos.z - u.root.position.z).normalize().multiplyScalar(0.18); hitNow(); }
        else {
          const from = u.root.position.clone().setY(0.75 * u.scale);
          projectile(from, tpos, u.wep === 'bow' ? 'bow' : u.wep === 'bomb' ? 'bomb' : 'orb', color, hitNow);
        }
        app.Sound.play(melee ? 'slash' : u.wep === 'bow' ? 'arrow' : 'zap');
      } else hitNow();
      break;
    }
    case 'hit': { const [, eid, dmg, ex, ey] = f; const t = S.enemies.get(eid); hitEffect(t, t ? t.root.position.clone().setY(0.4) : wp(ex, ey), dmg, 0, 'splash', 1, '#ffb060', false, true); break; }
    case 'zap': { S.zaps.push({ a: wp(f[1], f[2], 0.45), b: wp(f[3], f[4], 0.45), t: 0, life: 0.2, hero: f[5] }); break; }
    case 'die': {
      const [, id, x10, y10, big] = f;
      const e = S.enemies.get(id);
      const pos = e ? e.root.position.clone() : wp(x10, y10, 0);
      pos.y = 0.35;
      chunks(pos, big ? '#ff5070' : '#f8d8c0', big ? 30 : 7);
      spark(pos, big ? '#ffd040' : '#ffffff', big ? 30 : 6, big ? 5 : 2.5, big ? 0.4 : 0.2, 0.5);
      if (e) { e.dead = performance.now(); S.enemies.delete(id); S.dying.push(e); }
      if (big) { S.shake = Math.max(S.shake, big === 2 ? 0.5 : 0.25); shock(pos, '#ffd060', big === 2 ? 4 : 2, 0.6); floatText(pos.clone().setY(1.2), big === 2 ? '격파!!' : '격파!', '#ffd040', big === 2 ? 34 : 24, 1.3, 0.6); }
      app.Sound.play(big ? 'bigkill' : 'kill');
      break;
    }
    case 'summon': case 'merge': case 'hero': {
      const [wx, wz] = tileToWorld(f[1], f[2]);
      const tier = kind === 'hero' ? f[3] || 6 : f[3];
      const col = S.cat.tiers[tier - 1].color;
      const pos = new THREE.Vector3(wx, 0.1, wz);
      shock(pos, col, tier >= 4 ? 2.2 : 1, 0.5);
      spark(pos.clone().setY(0.3), col, tier >= 4 ? 24 : 10, 1.5, 0.25, 0.7, 3, 2);
      if (kind !== 'summon' || tier >= 4) { const pillar = new THREE.Mesh(Cyl(0.35, 0.35, 4, 16, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); pillar.position.set(wx, 2, wz); S.dyn.add(pillar); S.rings.push({ m: pillar, t: 0, life: 0.8, pillar: true }); }
      if (kind === 'merge') floatText(pos.clone().setY(1.2), '합성!', col, 22, 1);
      if (kind === 'hero') { floatText(pos.clone().setY(1.5), '영웅 등장!', col, 28, 1.4); S.shake = Math.max(S.shake, 0.25); }
      break;
    }
    case 'slash': {
      const pos = wp(f[1], f[2], 0.1);
      shock(pos, '#ffffff', 2.8, 0.5); shock(pos, '#ff6040', 2.2, 0.7);
      for (let i = 0; i < 6; i++) slashArc(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3)), '#ffffff', 2.2, Math.random() * 6);
      S.shake = Math.max(S.shake, 0.45);
      break;
    }
    case 'rain': break;
    case 'seal': S.tints.push({ color: '#a080ff', t: 0, life: 1.2 }); for (const d of S.domes || []) d.material.opacity = 0.5; break;
    case 'goldrain': S.tints.push({ color: '#ffd040', t: 0, life: 0.9 }); break;
    case 'temper': S.tints.push({ color: '#ff8040', t: 0, life: 0.7 }); break;
    case 'leak': S.tints.push({ color: '#ff0000', t: 0, life: 0.5 }); S.shake = Math.max(S.shake, 0.2); for (const d of S.domes || []) d.material.color.set('#ff4040'); setTimeout(() => { for (const d of S.domes || []) d.material.color.set('#80d0ff'); }, 300); break;
    case 'ping': { const pos = wp(f[1], f[2], 0.1); const col = S.cat.colors[f[3]]; shock(pos, col, 1.2, 1); setTimeout(() => shock(pos, col, 1.2, 1), 300); floatText(pos.clone().setY(1), '❗', col, 30, 1.5, 0.3); break; }
    case 'miss': floatText(wp(f[1], f[2], 0.8), '회피', '#cccccc', 14, 0.6); break;
    case 'heal': floatText(wp(f[1], f[2], 1.4), '💚 회복', '#80ff80', 20, 1); spark(wp(f[1], f[2], 0.5), '#60ff80', 14, 1, 0.3, 0.8, 2, -1); break;
    case 'brood': floatText(wp(f[1], f[2], 1.4), '새끼 소환!', '#ffa080', 18, 1); break;
    case 'mission': S.tints.push({ color: '#fff0a0', t: 0, life: 0.6 }); break;
    case 'tele': {
      const [wx, wz] = tileToWorld(f[1], f[2]);
      const pos = new THREE.Vector3(wx, 0.1, wz);
      const pillar = new THREE.Mesh(Cyl(0.3, 0.3, 3, 16, true), new THREE.MeshBasicMaterial({ color: '#a0e0ff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      pillar.position.set(wx, 1.5, wz); S.dyn.add(pillar); S.rings.push({ m: pillar, t: 0, life: 0.5, pillar: true });
      spark(pos.clone().setY(0.4), '#c0f0ff', 10, 1.2, 0.2, 0.5, 2.5, 0);
      app.Sound.play('arrow');
      break;
    }
    default:
  }
}

function hitEffect(target, pos, dmg, crit, k, tier, color, hero, secondary) {
  if (target) {
    target.flash = 1;
    target.knock = secondary ? 0.06 : 0.1 + Math.min(0.15, tier * 0.025);
    target.squash = 1;
  }
  if (!secondary) {
    if (k === 'blade' || k === 'chain' && false) slashArc(pos, color, 0.8 + tier * 0.15 + (hero ? 0.5 : 0), Math.random() * 6);
    spark(pos, color, crit ? 10 : 4 + tier, 2.2, 0.16 + tier * 0.02, 0.35);
    if (k === 'splash') shock(pos, color, 0.9 + tier * 0.2, 0.3);
    if (k === 'blade' && tier >= 3) slashArc(pos, '#ffffff', 0.7 + tier * 0.12, Math.random() * 6);
  } else spark(pos, color, 2, 1.5, 0.14, 0.3);
  if (dmg > 0) {
    const big = crit || hero;
    floatText(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.45, 0)), fmtDmg(dmg) + (crit ? '!' : ''), crit ? '#ffe040' : hero ? color : secondary ? '#ffc890' : '#ffffff', crit ? 24 : hero ? 19 : secondary ? 12 : 14 + Math.min(4, tier), crit ? 0.9 : 0.6);
  }
  if (crit && target && target.sc > 1.5) S.shake = Math.max(S.shake, 0.12);
}
const fmtDmg = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : String(n));

/** 매 프레임 */
/** 느린 컴퓨터면 자동으로 그래픽을 낮춤 (그림자·해상도) */
function autoQuality(rawDt) {
  if (S.lowQ) return;
  S.fpsN = (S.fpsN || 0) + 1; S.fpsT = (S.fpsT || 0) + rawDt;
  if (S.fpsT < 4) return;
  const fps = S.fpsN / S.fpsT;
  S.fpsN = 0; S.fpsT = 0;
  if (fps < 32) setQuality(false);
}
function setQuality(high) {
  S.lowQ = !high;
  S.renderer.shadowMap.enabled = high;
  S.dpr = high ? Math.min(2, window.devicePixelRatio || 1) : 1;
  S.renderer.setPixelRatio(S.dpr);
  S.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  fitCamera();
}

function render(app, now) {
  if (!S.ok || !S.map) return;
  const rawDt = S.clock.getDelta();
  const dt = Math.min(0.05, rawDt);
  if (!document.hidden && rawDt < 1) autoQuality(rawDt);
  const v = app.vf || app.v;
  const T = now / 1000;
  // ── 유닛 ── (같은 칸의 같은 유닛은 한 모델로, 머리 위에 ×n)
  const seen = new Set();
  S.stacks = new Map();
  S.leaderOf = new Map();
  for (const u of v.units) {
    const key = `${u[1]}|${u[2]}|${u[3]},${u[4]}`;
    const st = S.stacks.get(key);
    if (!st) S.stacks.set(key, { lead: u, n: 1, ids: [u[0]] }); else { st.n++; st.ids.push(u[0]); if (u[0] < st.lead[0]) st.lead = u; }
  }
  for (const st of S.stacks.values()) for (const id of st.ids) S.leaderOf.set(id, st.lead[0]);
  for (const u of v.units) {
    const [id, owner, type, x, y, , lvl] = u;
    seen.add(id);
    let o = S.units.get(id);
    if (!o) { o = makeUnit(app.unitMap[type], owner, S.cat); S.dyn.add(o.root); S.units.set(id, o); o.root.scale.setScalar(0.01); o.born = now; }
    const [wx, wz] = tileToWorld(x, y);
    o.root.position.x += (wx - o.root.position.x) * Math.min(1, dt * 12);
    o.root.position.z += (wz - o.root.position.z) * Math.min(1, dt * 12);
    const grow = Math.min(1, (now - o.born) / 250);
    o.root.scale.setScalar(grow < 1 ? 0.01 + grow * 1.1 : 1);
    // 공격 모션
    const at = (now - o.atkT) / 1000;
    const swing = at < 0.25 ? at / 0.25 : 1;
    let d = o.faceTo - o.face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    o.face += d * Math.min(1, dt * 14);
    o.body.rotation.y = o.face;
    const lungeK = at < 0.08 ? at / 0.08 : at < 0.3 ? 1 - (at - 0.08) / 0.22 : 0;
    o.body.position.x = o.lunge.x * lungeK; o.body.position.z = o.lunge.z * lungeK;
    o.body.position.y = 0.07 + Math.abs(Math.sin(T * 2.2 + id)) * 0.025;
    if (o.wep === 'bow') o.pivot.rotation.x = at < 0.2 ? -0.4 * (1 - swing) : 0;
    else if (o.wep === 'staff' || o.wep === 'talisman') o.pivot.rotation.x = at < 0.3 ? -1.2 * Math.sin(swing * Math.PI) : -0.2;
    else if (o.wep === 'bomb') o.pivot.rotation.x = at < 0.3 ? -2 * Math.sin(swing * Math.PI) : 0;
    else o.pivot.rotation.x = at < 0.25 ? -2.4 + swing * 3.6 : -0.7 + Math.sin(T * 1.5 + id) * 0.05;
    if (o.glow) { o.glow.material.opacity = 0.35 + Math.sin(T * 3 + id) * 0.15; }
    o.lvl = lvl;
    o.root.visible = S.leaderOf.get(id) === id;
    if (o.root.visible) {
      // 오라 맥박 · 히든은 무지개로 바뀌고 고리가 돌고 반짝임
      o.aura.material.opacity = o.aOp * (0.75 + Math.sin(T * 2.5 + id) * 0.25);
      o.aura.rotation.y = T * 0.5;
      if (o.t.hidden) {
        const col = new THREE.Color().setHSL((T * 0.15 + id * 0.1) % 1, 0.9, 0.6);
        o.aura.material.color.copy(col);
        o.rings.forEach((rg, i) => { rg.material.color.setHSL((T * 0.15 + i * 0.33) % 1, 0.95, 0.65); rg.rotation.z = T * (i % 2 ? -2 : 2); rg.position.y = 0.2 + i * 0.35 + Math.sin(T * 2 + i) * 0.08; });
        if (Math.random() < dt * 8) spark(o.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8)), col.getStyle(), 1, 0.3, 0.2, 0.7, 0.8, -1);
      } else o.rings.forEach((rg) => { rg.rotation.z = T * 1.5; rg.position.y = 0.25 + Math.sin(T * 2) * 0.1; });
      if (o.t.tier >= 4 && !o.t.hidden && Math.random() < dt * 3) spark(o.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.2, (Math.random() - 0.5) * 0.7)), S.cat.tiers[o.t.tier - 1].color, 1, 0.1, 0.15, 0.9, 1.2, -1);
    }
  }
  for (const [id, o] of S.units) if (!seen.has(id)) { S.dyn.remove(o.root); spark(o.root.position.clone().setY(0.4), '#ffffff', 8, 1.5, 0.2, 0.4); S.units.delete(id); }
  // ── 요괴 ──
  const eseen = new Set();
  for (const ent of app.ents.values()) {
    eseen.add(ent.id);
    let o = S.enemies.get(ent.id);
    if (!o) { o = makeEnemy(ent); S.dyn.add(o.root); S.enemies.set(ent.id, o); }
    const p = app.entPos(ent, now);
    const wx = worldX(p.x), wz = worldZ(p.y);
    if (o.lx != null) {
      const dx = wx - o.lx, dz = wz - o.lz;
      if (dx * dx + dz * dz > 1e-6) { const f = Math.atan2(dx, dz); let dd = f - o.face; while (dd > Math.PI) dd -= Math.PI * 2; while (dd < -Math.PI) dd += Math.PI * 2; o.face += dd * Math.min(1, dt * 10); }
    }
    o.lx = wx; o.lz = wz;
    const fl = ent.fl || 0;
    // 밀려남
    o.knock = Math.max(0, o.knock - dt * 1.2);
    const kb = o.knock;
    o.root.position.set(wx - Math.sin(o.face) * kb, (fl & 16 ? 0.55 + Math.sin(T * 4 + ent.id) * 0.06 : -0.12), wz - Math.cos(o.face) * kb);
    o.body.rotation.y = o.face;
    const stun = fl & 2;
    const hop = stun ? 0 : Math.abs(Math.sin(T * (ent.k === 'slime' || ent.k === 'slime_s' ? 6 : 9) + ent.id));
    o.squash = Math.max(0, (o.squash || 0) - dt * 6);
    const sq = 1 - o.squash * 0.25;
    o.body.scale.set(o.sc * (2 - sq), o.sc * sq * (1 + hop * 0.06), o.sc * (2 - sq));
    o.body.position.y = hop * 0.05;
    o.body.rotation.z = stun ? Math.sin(T * 12) * 0.1 : Math.sin(T * 9 + ent.id) * 0.06;
    if (o.wings) for (const [i, w] of o.wings.entries()) w.rotation.z = (i ? -1 : 1) * Math.sin(T * 16 + ent.id) * 0.7;
    // 색: 맞으면 하얗게, 감속 파랗게, 독 초록, 화상 주황
    o.flash = Math.max(0, o.flash - dt * 7);
    const em = o.mat.emissive;
    em.setRGB(0, 0, 0);
    if (ent.k === 'wisp') em.set('#3070a0');
    if (fl & 1) em.add(new THREE.Color(0.05, 0.12, 0.35));
    if (fl & 8) em.add(new THREE.Color(0.05, 0.25, 0.02));
    if (fl & 4) em.add(new THREE.Color(0.3, 0.1, 0));
    if (o.flash > 0) em.lerp(new THREE.Color(1, 1, 1), o.flash);
    if (fl & 4 && Math.random() < dt * 10) spark(o.root.position.clone().setY(0.4 * o.sc), '#ff7030', 1, 0.3, 0.16, 0.4, 2, -2);
    if (o.aura) o.aura.material.opacity = 0.45 + Math.sin(T * 6) * 0.15;
    o.hp = ent.hp; o.fl = fl; o.k = ent.k;
  }
  for (const [id, o] of S.enemies) if (!eseen.has(id)) { o.dead = now; S.enemies.delete(id); S.dying.push(o); }
  S.dying = S.dying.filter((o) => {
    const t = (now - o.dead) / 220;
    if (t >= 1) { S.dyn.remove(o.root); o.mat.dispose(); return false; }
    o.body.scale.setScalar(o.sc * (1 + t * 0.4) * (1 - t));
    o.mat.emissive.setRGB(1, 1, 1);
    return true;
  });
  // ── 입구 · 결계 · 흐르는 빛 ──
  for (const p of S.portals) { p.ring.rotation.z = T * 1.5; p.disc.material.opacity = 0.4 + Math.sin(T * 3) * 0.15; }
  for (const d of S.domes || []) { d.material.opacity += ((v.sealed ? 0.35 : 0.14 + Math.sin(T * 2) * 0.04) - d.material.opacity) * Math.min(1, dt * 3); }
  for (const f of S.flows) {
    let s = (f.off + T * 1.2) % f.len;
    if (!f.loop && s > f.len - 0.3) s = 0;
    let i = 1; while (i < f.cum.length - 1 && f.cum[i] < s) i++;
    const k = (s - f.cum[i - 1]) / (f.cum[i] - f.cum[i - 1] || 1);
    f.sp.position.lerpVectors(f.pts[i - 1], f.pts[i], k);
    const inside = Math.abs(f.sp.position.x) < S.W / 2 && Math.abs(f.sp.position.z) < S.H / 2;
    f.sp.visible = inside;
  }
  // ── 효과 갱신 ──
  S.parts = S.parts.filter((p) => {
    p.t += dt;
    const o = p.sp || p.mesh;
    if (p.t >= p.life) { o.removeFromParent(); if (p.mesh) { p.mesh.material.dispose(); p.mesh.geometry.dispose(); } else p.sp.material.dispose(); return false; }
    p.v.y -= p.grav * dt;
    o.position.addScaledVector(p.v, dt);
    if (o.position.y < 0 && p.mesh) { o.position.y = 0; p.v.multiplyScalar(0.5); p.v.y = Math.abs(p.v.y) * 0.4; }
    const k = 1 - p.t / p.life;
    if (p.sp) { p.sp.material.opacity = k; p.sp.scale.setScalar(p.size * (0.5 + k * 0.7)); }
    else { p.mesh.rotation.x += p.spin * dt; p.mesh.scale.setScalar(Math.min(1, k * 2)); }
    return true;
  });
  S.arcs = S.arcs.filter((a) => { a.t += dt; const k = a.t / a.life; if (k >= 1) { a.m.removeFromParent(); a.m.material.dispose(); return false; } a.m.material.opacity = 1 - k; a.m.scale.setScalar(a.s0 * (0.8 + k * 0.5)); a.m.rotation.z += dt * 14; return true; });
  S.rings = S.rings.filter((r) => { r.t += dt; const k = r.t / r.life; if (k >= 1) { r.m.removeFromParent(); r.m.material.dispose(); r.m.geometry.dispose(); return false; } r.m.material.opacity = (1 - k) * (r.pillar ? 0.6 : 1); if (r.pillar) r.m.scale.set(1 - k * 0.7, 1, 1 - k * 0.7); else r.m.scale.setScalar(0.2 + k * r.r); return true; });
  S.projs = S.projs.filter((p) => {
    p.t += dt;
    const k = Math.min(1, p.t / p.life);
    const prev = p.obj.position.clone();
    p.obj.position.lerpVectors(p.from, p.to, k);
    p.obj.position.y += Math.sin(k * Math.PI) * p.arc;
    if (p.obj.isMesh) { p.obj.lookAt(p.obj.position.clone().add(p.obj.position.clone().sub(prev))); }
    if (p.trail && Math.random() < 0.7) spark(p.obj.position, p.trail, 1, 0.2, 0.18, 0.2, 0, 0);
    if (k >= 1) { p.obj.removeFromParent(); if (p.obj.material !== VCOL) p.obj.material.dispose(); p.onHit(); return false; }
    return true;
  });
  // ── 화살비 구역 ──
  while (S.zoneMeshes.length < v.zones.length) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: '#b8f8a0', transparent: true, opacity: 0.18, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; S.dyn.add(m); S.zoneMeshes.push(m);
  }
  S.zoneMeshes.forEach((m, i) => { m.visible = i < v.zones.length; });
  for (const [i, [x10, y10, r]] of v.zones.entries()) {
    const m = S.zoneMeshes[i];
    m.scale.setScalar(r); m.position.set(worldX(x10 / 10), 0.04, worldZ(y10 / 10));
    if (Math.random() < 0.8) { const a = Math.random() * 6.28, d = Math.random() * r; projectile(new THREE.Vector3(m.position.x + Math.cos(a) * d - 0.6, 3, m.position.z + Math.sin(a) * d - 0.6), new THREE.Vector3(m.position.x + Math.cos(a) * d, 0.1, m.position.z + Math.sin(a) * d), 'bow', '#fff', () => spark(new THREE.Vector3(m.position.x + Math.cos(a) * d, 0.1, m.position.z + Math.sin(a) * d), '#d8ffc8', 2, 1, 0.12, 0.25)); }
  }
  // ── 고른 칸 · 마우스 · 사거리 ──
  const h = app.hover;
  const free = h && app.freeTile(h.x, h.y);
  S.hoverMesh.visible = !!free && !app.aiming;
  if (free) { const [wx, wz] = tileToWorld(h.x, h.y); S.hoverMesh.position.set(wx, 0.02, wz); S.hoverMesh.material.color.set(app.sel || (app.multi && app.multi.length) ? '#80ff80' : '#ffffff'); }
  S.selTileMesh.visible = !!app.selTile;
  if (app.selTile) { const [wx, wz] = tileToWorld(app.selTile[0], app.selTile[1]); S.selTileMesh.position.set(wx, 0.03, wz); S.selTileMesh.rotation.z = T * 2; }
  const selU = app.sel && v.units.find((u) => u[0] === app.sel);
  const hovU = !selU && h && v.units.find((u) => u[3] === h.x && u[4] === h.y);
  const showU = selU || hovU;
  S.rangeMesh.visible = !!showU;
  if (showU) {
    const t = app.unitMap[showU[2]];
    let range = t.range;
    if (app.info.players[showU[1]].leader === 'archer' && t.cat === 'bow') range += 0.6;
    const [wx, wz] = tileToWorld(showU[3], showU[4]);
    S.rangeMesh.position.set(wx, 0.03, wz); S.rangeMesh.scale.setScalar(range);
  }
  S.selRing.visible = false;
  S.selRings ||= [];
  const selIds = (app.multi && app.multi.length ? app.multi : app.sel ? [app.sel] : []).filter((id) => S.units.has(id));
  while (S.selRings.length < selIds.length) { const m = S.selRing.clone(); S.scene.add(m); S.selRings.push(m); }
  S.selRings.forEach((m, i) => {
    m.visible = i < selIds.length;
    if (!m.visible) return;
    const o = S.units.get(selIds[i]);
    m.position.set(o.root.position.x, 0.12, o.root.position.z); m.scale.setScalar(1 + Math.sin(T * 6) * 0.06);
  });
  if (S.summonFx) { S.summonFx.ring2.rotation.z = T * 0.6; S.summonFx.ring3.rotation.z = -T * 0.8; S.summonFx.disc.material.opacity = 0.13 + Math.sin(T * 2) * 0.05; }
  S.aimMesh.visible = !!(app.aiming && h);
  if (S.aimMesh.visible) { S.aimMesh.position.set(worldX(h.fx), 0.05, worldZ(h.fy)); S.aimMesh.scale.setScalar(app.info.players[app.myIdx].leader === 'sword' ? 2.6 : 2.3); }
  // ── 카메라 흔들림 ──
  S.shake = Math.max(0, S.shake - dt * 1.6);
  const sh = S.shake * S.shake;
  S.camera.position.set(S.camBase.x + (Math.random() - 0.5) * sh * 1.2, S.camBase.y + (Math.random() - 0.5) * sh * 0.8, S.camBase.z + (Math.random() - 0.5) * sh * 1.2);
  S.camera.lookAt(S.camLook);
  S.renderer.render(S.scene, S.camera);
  drawOverlay(app, now, dt);
}

function drawOverlay(app, now, dt) {
  const g = S.octx, W = S.overlay.width, H = S.overlay.height, k = S.dpr;
  const v = app.vf || app.v;
  g.clearRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // 체력 막대
  for (const o of S.enemies.values()) {
    const boss = o.fl & 32, mini = o.fl & 64;
    if (o.hp >= 100 && !boss && !mini) continue;
    const [x, y] = project(o.root.position.clone().setY(o.root.position.y + (boss ? 2.1 : mini ? 1.25 : 0.95 * o.sc)));
    const w = (boss ? 90 : mini ? 54 : 34) * k, hh = (boss ? 8 : 5) * k;
    g.fillStyle = '#000b'; g.fillRect(x - w / 2 - k, y - k, w + 2 * k, hh + 2 * k);
    g.fillStyle = o.hp > 50 ? '#5ee05e' : o.hp > 25 ? '#f8d040' : '#f85050';
    g.fillRect(x - w / 2, y, (w * o.hp) / 100, hh);
    if (o.fl & 2) { g.font = `${14 * k}px sans-serif`; g.fillText('💫', x, y - 12 * k); }
  }
  // 유닛 머리 위: 이름표(등급 색) · 무리 수 ×n · 영웅 레벨 · 합성 가능 ✦
  const ready = new Set();
  const cnt = {};
  for (const u of app.v.units) if (u[1] === app.myIdx) cnt[u[2]] = (cnt[u[2]] || 0) + 1;
  for (const [id, n] of Object.entries(cnt)) { const need = app.cat.mergeNeed[app.unitMap[id].tier]; if (need && n >= need) ready.add(id); }
  const fsz = Math.max(9, Math.min(12, 11 * (S.zoom ? 1 / Math.sqrt(S.zoom) : 1)));
  for (const st of (S.stacks || new Map()).values()) {
    const u = st.lead;
    const o = S.units.get(u[0]); if (!o || !o.root.visible) continue;
    const t = o.t;
    const col = t.hidden ? `hsl(${(now / 15) % 360},90%,70%)` : S.cat.tiers[t.tier - 1].color;
    const [x, y] = project(o.root.position.clone().setY(1.12 * o.scale + 0.1));
    let label = t.name + (t.hero ? ` Lv.${u[6]}` : '');
    g.font = `800 ${fsz * k}px 'Noto Sans KR', sans-serif`;
    const w = g.measureText(label).width + 10 * k;
    g.fillStyle = 'rgba(12,8,16,0.72)';
    roundRect(g, x - w / 2, y - 8 * k, w, 16 * k, 7 * k); g.fill();
    g.strokeStyle = col; g.lineWidth = (t.tier >= 4 ? 1.8 : 1) * k; g.stroke();
    g.fillStyle = col; g.fillText(label, x, y + 0.5 * k);
    if (st.n > 1) {
      // 무리 수
      const bx = x + w / 2 + 2 * k, by = y - 9 * k;
      g.font = `900 ${13 * k}px 'Jua', sans-serif`;
      const s2 = `×${st.n}`;
      const bw = g.measureText(s2).width + 10 * k;
      g.fillStyle = '#ffd040'; roundRect(g, bx - 4 * k, by - 2 * k, bw, 18 * k, 9 * k); g.fill();
      g.fillStyle = '#2a1408'; g.textAlign = 'left'; g.fillText(s2, bx + 1 * k, by + 7.5 * k); g.textAlign = 'center';
    }
    if (u[1] === app.myIdx && ready.has(u[2])) { g.font = `bold ${13 * k}px sans-serif`; g.fillStyle = '#ffe060'; g.strokeStyle = '#000'; g.lineWidth = 2.5 * k; g.strokeText('✦', x - w / 2 - 7 * k, y); g.fillText('✦', x - w / 2 - 7 * k, y); }
  }
  // 번개
  S.zaps = S.zaps.filter((z) => {
    z.t += dt; if (z.t >= z.life) return false;
    const [ax, ay] = project(z.a), [bx, by] = project(z.b);
    g.save(); g.globalAlpha = 1 - z.t / z.life; g.strokeStyle = z.hero ? '#fff6a0' : '#d8f0ff'; g.shadowColor = '#80c0ff'; g.shadowBlur = 12 * k; g.lineWidth = (z.hero ? 4 : 2.5) * k;
    g.beginPath(); g.moveTo(ax, ay);
    for (let i = 1; i < 6; i++) { const q = i / 6; g.lineTo(ax + (bx - ax) * q + (Math.random() - 0.5) * 18 * k, ay + (by - ay) * q + (Math.random() - 0.5) * 18 * k); }
    g.lineTo(bx, by); g.stroke(); g.restore();
    return true;
  });
  // 숫자
  S.texts = S.texts.filter((t) => {
    t.t += dt; if (t.t >= t.life) return false;
    const q = t.t / t.life;
    const [x, y] = project(t.pos.clone().setY(t.pos.y + q * t.rise));
    const pop = q < 0.15 ? 0.6 + (q / 0.15) * 0.6 : 1.2 - Math.min(0.2, (q - 0.15));
    g.globalAlpha = q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1;
    g.font = `900 ${t.size * pop * k}px 'Jua', 'Noto Sans KR', sans-serif`;
    g.lineWidth = 4 * k; g.strokeStyle = '#1a0a10'; g.strokeText(t.text, x, y); g.fillStyle = t.color; g.fillText(t.text, x, y);
    g.globalAlpha = 1;
    return true;
  });
  // 드래그 선택 상자
  if (app.drag && app.drag.on) {
    const r = S.overlay.getBoundingClientRect();
    const x1 = (Math.min(app.drag.x0, app.drag.x1) - r.left) * k, y1 = (Math.min(app.drag.y0, app.drag.y1) - r.top) * k;
    const w = Math.abs(app.drag.x1 - app.drag.x0) * k, hh = Math.abs(app.drag.y1 - app.drag.y0) * k;
    g.fillStyle = '#80ff8022'; g.fillRect(x1, y1, w, hh);
    g.strokeStyle = '#80ff80'; g.lineWidth = 2 * k; g.strokeRect(x1, y1, w, hh);
  }
  // 화면 색
  S.tints = S.tints.filter((t) => { t.t += dt; if (t.t >= t.life) return false; g.globalAlpha = (1 - t.t / t.life) * 0.28; g.fillStyle = t.color; g.fillRect(0, 0, W, H); g.globalAlpha = 1; return true; });
  if (v.sealed) { g.fillStyle = '#a080ff14'; g.fillRect(0, 0, W, H); }
  g.font = `${30 * k}px Jua, sans-serif`; g.lineWidth = 6 * k; g.strokeStyle = '#000';
  if (v.paused) { g.fillStyle = '#0008'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.strokeText('⏸ 일시정지', W / 2, H / 2); g.fillText('⏸ 일시정지', W / 2, H / 2); }
  else if (!v.wave) { const s = `${v.nextIn}초 뒤 요괴가 양쪽에서 몰려와요! 빈칸을 누르고 Q로 소환!`; g.font = `${22 * k}px Jua, sans-serif`; g.fillStyle = '#fff'; g.strokeText(s, W / 2, 34 * k); g.fillText(s, W / 2, 34 * k); }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

window.Board3D = {
  init, pick, render, fx,
  setup(map, cat) { buildWorld(map, cat); },
  get ok() { return S.ok; },
  get lowQuality() { return !!S.lowQ; },
  setQuality,
  /** 유닛의 화면 좌표 (드래그 선택용) */
  unitScreen(id) { const o = S.units.get(id); if (!o) return null; const p = o.root.position.clone().setY(0.4).project(S.camera); const r = S.renderer.domElement.getBoundingClientRect(); return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height]; },
  /** 칸 중심의 화면 좌표 (자동 테스트용) */
  toScreen(x, y) { const [wx, wz] = tileToWorld(x, y); const p = new THREE.Vector3(wx, 0.3, wz).project(S.camera); const r = S.renderer.domElement.getBoundingClientRect(); return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height]; },
  resize: fitCamera,
};
if (window.app && window.app.on3dReady) window.app.on3dReady();
