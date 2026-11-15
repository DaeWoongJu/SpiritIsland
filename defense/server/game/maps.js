'use strict';
// 요괴 퇴마 디펜스 — 맵. 손으로 만든 맵 + 시드로 만든 맵 수십 개 + 매판 새로 만드는 랜덤 맵.
// 길은 3칸 간격의 굵은 격자(노드) 위에 놓이므로, 나란한 길 사이에는 항상 유닛을 세울 2칸이 남습니다.

const W = 24;
const H = 15;
const CW = 8; // 굵은 격자 가로 노드 수 (x = 1,4,...,22)
const CH = 5; // 세로 노드 수 (y = 1,4,...,13)
const tx = (c) => c * 3 + 1;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const THEMES = {
  bamboo: { name: '대나무숲', ground: '#3d6b3a', ground2: '#467a41', path: '#a8895a', edge: '#7a6040', decor: ['🎋', '🌿', '🪨'] },
  lantern: { name: '등불 거리', ground: '#4a3048', ground2: '#553755', path: '#8a7a6a', edge: '#5a4a40', decor: ['🏮', '🏯', '🪨'] },
  snow: { name: '설산', ground: '#c8d8e8', ground2: '#d8e4f0', path: '#8898a8', edge: '#687888', decor: ['🌲', '⛄', '🪨'] },
  desert: { name: '모래 협곡', ground: '#c8a060', ground2: '#d4ac6c', path: '#987040', edge: '#785430', decor: ['🌵', '🪨', '🦴'] },
  swamp: { name: '안개 늪', ground: '#3a5048', ground2: '#425a50', path: '#6a6a48', edge: '#4a4a30', decor: ['🍄', '🌾', '🪵'] },
  temple: { name: '옛 사찰', ground: '#5a6a48', ground2: '#647452', path: '#b0a890', edge: '#807860', decor: ['⛩️', '🌸', '🪨'] },
  lava: { name: '화산', ground: '#3a2a2a', ground2: '#442f2f', path: '#c86030', edge: '#883818', decor: ['🌋', '🪨', '🔥'] },
  sea: { name: '해안 절벽', ground: '#4a8a78', ground2: '#529684', path: '#d8c898', edge: '#a89868', decor: ['🌴', '🐚', '🪨'] },
  night: { name: '달밤 들판', ground: '#2a3458', ground2: '#303c64', path: '#7a7a98', edge: '#585878', decor: ['🌾', '🪦', '🌳'] },
  autumn: { name: '단풍 계곡', ground: '#8a5a30', ground2: '#966438', path: '#c8a878', edge: '#987850', decor: ['🍁', '🍂', '🌳'] },
};

// ───────── 길 만들기 ─────────

/** 굵은 격자에서 왼쪽 끝 → 오른쪽 끝으로 가는 겹치지 않는 길 (무작위 깊이 우선 탐색) */
function walkPath(r, { cols = [0, CW - 1], rows = [0, CH - 1], from = 'left', to = 'right', minLen = 12, avoid = new Set() }) {
  const inside = (x, y) => x >= cols[0] && x <= cols[1] && y >= rows[0] && y <= rows[1];
  const onSide = (x, y, side) => (side === 'left' ? x === cols[0] : side === 'right' ? x === cols[1] : side === 'top' ? y === rows[0] : y === rows[1]);
  const starts = [];
  for (let x = cols[0]; x <= cols[1]; x++) for (let y = rows[0]; y <= rows[1]; y++) if (onSide(x, y, from) && !avoid.has(x + ',' + y)) starts.push([x, y]);
  for (let attempt = 0; attempt < 40; attempt++) {
    const s = starts[Math.floor(r() * starts.length)];
    const path = [s];
    const used = new Set([s.join(',')]);
    let steps = 0;
    const dfs = () => {
      if (++steps > 4000) return false;
      const [x, y] = path[path.length - 1];
      if (onSide(x, y, to) && path.length >= minLen) return true;
      for (const [dx, dy] of shuffle(DIRS.slice(), r)) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (!inside(nx, ny) || used.has(k) || avoid.has(k)) continue;
        path.push([nx, ny]); used.add(k);
        if (dfs()) return true;
        path.pop(); used.delete(k);
      }
      return false;
    };
    if (dfs()) return path;
  }
  return null;
}

/** 가장자리(side)에서 출발해 정해진 노드(target)에서 끝나는 겹치지 않는 길 */
function walkTo(r, { from, target, minLen = 8, maxLen = 40, avoid = new Set() }) {
  const onSide = (x, y) => (from === 'left' ? x === 0 : from === 'right' ? x === CW - 1 : from === 'top' ? y === 0 : y === CH - 1);
  const tk = target.join(',');
  const starts = [];
  for (let x = 0; x < CW; x++) for (let y = 0; y < CH; y++) if (onSide(x, y) && !avoid.has(x + ',' + y) && x + ',' + y !== tk) starts.push([x, y]);
  if (!starts.length) return null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const s = starts[Math.floor(r() * starts.length)];
    const path = [s];
    const used = new Set([s.join(',')]);
    let steps = 0;
    const dfs = () => {
      if (++steps > 5000) return false;
      const [x, y] = path[path.length - 1];
      if (x + ',' + y === tk) return path.length >= minLen;
      if (path.length >= maxLen) return false;
      for (const [dx, dy] of shuffle(DIRS.slice(), r)) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= CW || ny >= CH || used.has(k) || (avoid.has(k) && k !== tk)) continue;
        if (path.length > 1 && onSide(nx, ny) && k !== tk) continue; // 입구 가장자리를 다시 따라가지 않게
        path.push([nx, ny]); used.add(k);
        if (dfs()) return true;
        path.pop(); used.delete(k);
      }
      return false;
    };
    if (dfs()) return path;
  }
  return null;
}

/** 무작위 덩어리(폴리오미노)의 둘레를 따라가는 순환 길 */
function loopPath(r, { cols = [0, CW - 2], rows = [0, CH - 2], size = [5, 12] } = {}) {
  // 칸 (cx, cy)는 노드 (cx..cx+1, cy..cy+1)로 둘러싸인 사각형
  for (let attempt = 0; attempt < 200; attempt++) {
    const n = size[0] + Math.floor(r() * (size[1] - size[0] + 1));
    const cells = new Set();
    const sx = cols[0] + Math.floor(r() * (cols[1] - cols[0] + 1));
    const sy = rows[0] + Math.floor(r() * (rows[1] - rows[0] + 1));
    cells.add(sx + ',' + sy);
    let guard = 0;
    while (cells.size < n && guard++ < 500) {
      const arr = [...cells];
      const [x, y] = arr[Math.floor(r() * arr.length)].split(',').map(Number);
      const [dx, dy] = DIRS[Math.floor(r() * 4)];
      const nx = x + dx, ny = y + dy;
      if (nx < cols[0] || nx > cols[1] || ny < rows[0] || ny > rows[1]) continue;
      cells.add(nx + ',' + ny);
    }
    const has = (x, y) => cells.has(x + ',' + y);
    // 대각선으로만 닿는 곳(꼬임) 금지
    let bad = false;
    for (let x = cols[0] - 1; x <= cols[1] && !bad; x++) for (let y = rows[0] - 1; y <= rows[1]; y++) {
      const a = has(x, y), b = has(x + 1, y), c = has(x, y + 1), d = has(x + 1, y + 1);
      if ((a && d && !b && !c) || (b && c && !a && !d)) { bad = true; break; }
    }
    if (bad) continue;
    // 둘레 간선 (시계 방향)
    const next = new Map();
    let dup = false;
    const addEdge = (a, b) => { if (next.has(a)) dup = true; next.set(a, b); };
    for (const k of cells) {
      const [x, y] = k.split(',').map(Number);
      if (!has(x, y - 1)) addEdge(`${x},${y}`, `${x + 1},${y}`);
      if (!has(x + 1, y)) addEdge(`${x + 1},${y}`, `${x + 1},${y + 1}`);
      if (!has(x, y + 1)) addEdge(`${x + 1},${y + 1}`, `${x},${y + 1}`);
      if (!has(x - 1, y)) addEdge(`${x},${y + 1}`, `${x},${y}`);
    }
    if (dup) continue;
    const start = next.keys().next().value;
    const loop = [];
    let cur = start;
    do { loop.push(cur.split(',').map(Number)); cur = next.get(cur); } while (cur !== start && loop.length <= next.size);
    if (loop.length !== next.size || loop.length < 10) continue; // 구멍이 있으면 둘레가 둘로 갈라짐
    return loop;
  }
  return null;
}

/** 굵은 격자 노드 목록 → 칸 좌표 꼭짓점 (일직선 중간 노드는 생략) */
function toTiles(nodes) {
  const pts = nodes.map(([x, y]) => [tx(x), tx(y)]);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = out[out.length - 1], n = pts[i + 1];
    if (a && n && ((a[0] === p[0] && p[0] === n[0]) || (a[1] === p[1] && p[1] === n[1]))) continue;
    out.push(p);
  }
  return out;
}

/** 길 끝을 화면 밖으로 한 칸 연장 (입구) */
function extendOut(pts, atStart) {
  const i = atStart ? 0 : pts.length - 1;
  const p = pts[i];
  let q;
  if (p[0] <= 1) q = [-1, p[1]];
  else if (p[0] >= W - 2) q = [W, p[1]];
  else if (p[1] <= 1) q = [p[0], -1];
  else q = [p[0], H];
  if (atStart) pts.unshift(q); else pts.push(q);
  return pts;
}

/** 길 꼭짓점 → 길 칸 목록 */
function rasterize(pts, loop) {
  const set = new Set();
  const n = pts.length;
  for (let i = 0; i < (loop ? n : n - 1); i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
    let x = x1, y = y1;
    for (;;) {
      if (x >= 0 && x < W && y >= 0 && y < H) set.add(x + ',' + y);
      if (x === x2 && y === y2) break;
      x += dx; y += dy;
    }
  }
  return set;
}

// ───────── 맵 종류별 만들기 ─────────

const line = (nodes) => ({ pts: extendOut(toTiles(nodes), true), loop: false });
const lineOut = (nodes) => ({ pts: extendOut(extendOut(toTiles(nodes), true), false), loop: false });

const SIDES = ['left', 'right', 'top', 'bottom'];
/** 외길: 한쪽 가장자리 입구에서 반대쪽(또는 옆쪽) 가장자리로 빠져나감 */
function genLine(r, long = false) {
  const from = SIDES[Math.floor(r() * 4)];
  const opp = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[from];
  const to = r() < 0.7 ? opp : SIDES.filter((x) => x !== from && x !== opp)[Math.floor(r() * 2)];
  const nodes = walkPath(r, { from, to, minLen: long ? 22 + Math.floor(r() * 6) : 14 + Math.floor(r() * 6) }) || walkPath(r, { from: 'left', to: 'right', minLen: 12 });
  return { kind: 'line', paths: [lineOut(nodes)] };
}
/** 결계 돌격: 한쪽 입구에서 들어와 맵 가운데 결계(⛩️)까지 */
function genCenter(r) {
  for (let t = 0; t < 60; t++) {
    const base = [3 + Math.floor(r() * 2), 1 + Math.floor(r() * 3)];
    const a = walkTo(r, { from: SIDES[Math.floor(r() * 4)], target: base, minLen: 13 + Math.floor(r() * 6), maxLen: 26 });
    if (a) return { kind: 'line', paths: [line(a)], base: [base.map(tx)] };
  }
  return genLine(r);
}
function genLoop(r, big = false) {
  return { kind: 'loop', paths: [{ pts: toTiles(loopPath(r, { size: big ? [12, 20] : [6, 14] })), loop: true }] };
}

const GENERATORS = { line: (r) => genLine(r), long: (r) => genLine(r, true), center: genCenter, loop: (r) => genLoop(r), bigloop: (r) => genLoop(r, true) };
const KIND_NAMES = { line: '외길', long: '긴 외길', center: '결계 돌격', loop: '순환', bigloop: '큰 순환' };

// ───────── 손으로 만든 맵 (굵은 격자 노드) ─────────
const HAND = [
  { id: 'h-ring', name: '첫 번째 결계', theme: 'temple', kindName: '순환', make: () => ({ kind: 'loop', paths: [{ pts: toTiles([[1, 1], [6, 1], [6, 3], [1, 3]]), loop: true }] }), note: '연습용 사각 순환' },
  { id: 'h-snake', name: '굽이굽이 뱀길', theme: 'bamboo', kindName: '긴 외길', make: () => ({ kind: 'line', paths: [lineOut([[0, 0], [7, 0], [7, 2], [0, 2], [0, 4], [7, 4]])] }), note: '세 번 꺾이는 긴 길' },
  { id: 'h-spiral', name: '소용돌이 사당', theme: 'night', kindName: '결계 돌격', make: () => ({ kind: 'line', paths: [line([[0, 0], [7, 0], [7, 4], [0, 4], [0, 1], [6, 1], [6, 3], [1, 3], [1, 2], [5, 2]])], base: [[tx(5), tx(2)]] }), note: '가운데 사당으로 빨려드는 길' },
  { id: 'h-zigzag', name: '번개 고개', theme: 'snow', kindName: '외길', make: () => ({ kind: 'line', paths: [lineOut([[0, 4], [1, 4], [1, 0], [3, 0], [3, 4], [5, 4], [5, 0], [7, 0]])] }), note: '위아래로 오르내리는 길' },
  { id: 'h-coast', name: '파도 치는 해안선', theme: 'sea', kindName: '외길', make: () => ({ kind: 'line', paths: [lineOut([[0, 1], [2, 1], [2, 3], [4, 3], [4, 1], [6, 1], [6, 3], [7, 3]])] }), note: '파도 모양 길' },
  { id: 'h-figure', name: '용암 8자 고리', theme: 'lava', kindName: '큰 순환', make: () => ({ kind: 'loop', paths: [{ pts: toTiles([[0, 0], [3, 0], [3, 2], [6, 2], [6, 0], [7, 0], [7, 4], [4, 4], [4, 3], [1, 3], [1, 4], [0, 4]]), loop: true }] }), note: '울퉁불퉁 큰 순환' },
];

// ───────── 시드로 만든 맵 목록 ─────────
const GEN_LIST = [
  ['달빛 대나무숲', 'bamboo', 'line'], ['바람 우는 죽림', 'bamboo', 'loop'], ['청죽 쌍갈래', 'bamboo', 'twin'], ['죽순 언덕', 'bamboo', 'merge'],
  ['붉은 등불 골목', 'lantern', 'line'], ['야시장 회랑', 'lantern', 'loop'], ['기와지붕 두 거리', 'lantern', 'twinloop'], ['등롱 축제길', 'lantern', 'merge'],
  ['얼어붙은 산사', 'snow', 'line'], ['눈보라 순환로', 'snow', 'loop'], ['설원 두 갈래', 'snow', 'twin'], ['빙하 골짜기', 'snow', 'merge'],
  ['모래바람 협곡', 'desert', 'line'], ['신기루 고리', 'desert', 'loop'], ['쌍둥이 사구', 'desert', 'twinloop'], ['사막 대상로', 'desert', 'merge'],
  ['안개 낀 늪지', 'swamp', 'line'], ['물귀신 연못', 'swamp', 'loop'], ['버섯 숲 갈림길', 'swamp', 'twin'], ['썩은 나무 다리', 'swamp', 'merge'],
  ['벚꽃 사찰 마당', 'temple', 'line'], ['천 개의 도리이', 'temple', 'loop'], ['쌍탑 정원', 'temple', 'twinloop'], ['종소리 언덕', 'temple', 'merge'],
  ['불타는 분화구', 'lava', 'line'], ['마그마 회오리', 'lava', 'loop'], ['쌍화산 지대', 'lava', 'twin'], ['용암 강 합류점', 'lava', 'merge'],
  ['갈매기 절벽', 'sea', 'line'], ['소용돌이 만', 'sea', 'loop'], ['두 섬 사이', 'sea', 'twinloop'], ['난파선 해변', 'sea', 'merge'],
  ['보름달 들판', 'night', 'line'], ['반딧불 원무', 'night', 'loop'], ['묘지 두 갈래', 'night', 'twin'], ['별똥별 언덕', 'night', 'merge'],
  ['단풍 물든 계곡', 'autumn', 'line'], ['낙엽 회오리', 'autumn', 'loop'], ['가을 두 오솔길', 'autumn', 'twin'], ['추수 들녘', 'autumn', 'twinloop'],
  ['깊은 대숲 미로', 'bamboo', 'line'], ['한밤의 장터', 'lantern', 'loop'], ['설산 정상', 'snow', 'twinloop'], ['황금 모래성', 'desert', 'twin'],
  ['독무 습지', 'swamp', 'twinloop'], ['산신각 오르막', 'temple', 'twin'], ['지옥불 고리', 'lava', 'twinloop'], ['등대 가는 길', 'sea', 'twin'],
];

function decorate(map, r) {
  const pathSet = new Set();
  for (const p of map.paths) for (const k of rasterize(p.pts, p.loop)) pathSet.add(k);
  const decor = [];
  const theme = THEMES[map.theme];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (pathSet.has(x + ',' + y)) continue;
    // 길 바로 옆은 비워 둠 (근접 유닛 자리)
    let near = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (pathSet.has(x + dx + ',' + (y + dy))) near = true;
    if (!near && r() < 0.07) decor.push([x, y, theme.decor[Math.floor(r() * theme.decor.length)]]);
  }
  map.decor = decor;
  map.pathTiles = [...pathSet].map((k) => k.split(',').map(Number));
  return map;
}

function build(id, name, theme, kind, seed, note) {
  const r = rng(seed);
  const g = GENERATORS[kind](r);
  return decorate({ id, name, theme, kindName: KIND_NAMES[kind], W, H, seed, note: note || `${THEMES[theme].name} · ${KIND_NAMES[kind]}`, ...g }, r);
}

const MAPS = [];
for (const h of HAND) {
  const m = { id: h.id, name: h.name, theme: h.theme, kindName: h.kindName, W, H, seed: 7, note: h.note, ...h.make() };
  MAPS.push(decorate(m, rng(h.id.length * 977)));
}
const KIND_OF = { line: 'line', twin: 'center', merge: 'long', loop: 'loop', twinloop: 'bigloop' };
GEN_LIST.forEach(([name, theme, kind], i) => MAPS.push(build('g' + (i + 1), name, theme, KIND_OF[kind], 1000 + i * 7919)));
const MAP_MAP = Object.fromEntries(MAPS.map((m) => [m.id, m]));

/** 보스방 (각자) · 스토리 이벤트 전장 (함께) */
const ROOM_MAP = decorate({ id: 'room', name: '보스방', theme: 'night', kind: 'loop', kindName: '보스방', W, H, seed: 3, note: '보스 스토리 (함께)', paths: [{ pts: toTiles([[1, 1], [6, 1], [6, 3], [1, 3]]), loop: true }] }, rng(4242));
const EVENT_MAP = decorate({ id: 'event', name: '스토리 이벤트 전장', theme: 'lava', kind: 'loop', kindName: '이벤트', W, H, seed: 5, note: '둘이 함께', paths: [{ pts: toTiles([[0, 0], [3, 0], [3, 1], [4, 1], [4, 0], [7, 0], [7, 4], [4, 4], [4, 3], [3, 3], [3, 4], [0, 4]]), loop: true }] }, rng(777));

/** 완전 랜덤 맵 (매번 새로) */
function randomMap(seed) {
  const r = rng(seed);
  const kinds = Object.keys(GENERATORS);
  const themes = Object.keys(THEMES);
  const kind = kinds[Math.floor(r() * kinds.length)];
  const theme = themes[Math.floor(r() * themes.length)];
  return build('random', `🎲 무작위 ${THEMES[theme].name}`, theme, kind, seed);
}

/** 화면용 요약 (목록에 넣을 것만) */
function summary(m) {
  return { id: m.id, name: m.name, theme: m.theme, kind: m.kind, kindName: m.kindName, note: m.note, paths: m.paths, decor: m.decor, pathTiles: m.pathTiles, base: m.base || null, W, H };
}

module.exports = { W, H, THEMES, MAPS, MAP_MAP, ROOM_MAP, EVENT_MAP, randomMap, summary, rasterize, rng };
