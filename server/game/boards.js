'use strict';
// 섬 보드 정의.
// 모든 보드는 같은 모양(바다 1칸 + 지역 8칸)을 공유하고, 지형과 초기 배치만 다르다.
// 보드 로컬 좌표: x 0..300, y 0..260, 바다는 왼쪽(x≈0..50).
// 지역 간 인접 관계는 다각형이 공유하는 변으로부터 자동 계산된다(보드 사이 인접 포함).

const BOARD_W = 300;
const BOARD_H = 260;

const SHAPES = {
  0: [[0, 0], [50, 0], [40, 90], [55, 170], [45, 260], [0, 260]], // 바다
  1: [[50, 0], [140, 0], [130, 70], [40, 90]],
  2: [[40, 90], [130, 70], [150, 130], [120, 180], [55, 170]],
  3: [[55, 170], [120, 180], [150, 260], [45, 260]],
  4: [[140, 0], [230, 0], [220, 80], [130, 70]],
  5: [[130, 70], [220, 80], [230, 150], [150, 130]],
  6: [[150, 130], [230, 150], [240, 260], [150, 260], [120, 180]],
  7: [[230, 0], [300, 0], [300, 120], [230, 150], [220, 80]],
  8: [[230, 150], [300, 120], [300, 260], [240, 260]],
};

// 지형: M=산, J=정글, S=사막, W=습지
// 초기 배치: e=탐험가, t=마을, c=도시, d=다한, b=황폐
const BOARDS = {
  A: {
    terrain: { 1: 'M', 2: 'W', 3: 'J', 4: 'S', 5: 'W', 6: 'M', 7: 'S', 8: 'J' },
    setup: { 2: { c: 1, d: 1 }, 3: { d: 2 }, 4: { b: 1 }, 6: { d: 1 }, 7: { d: 2 }, 8: { t: 1 } },
  },
  B: {
    terrain: { 1: 'W', 2: 'M', 3: 'S', 4: 'J', 5: 'S', 6: 'W', 7: 'M', 8: 'J' },
    setup: { 1: { d: 1 }, 2: { c: 1 }, 3: { d: 2 }, 4: { b: 1 }, 6: { t: 1 }, 7: { d: 1 }, 8: { d: 2 } },
  },
  C: {
    terrain: { 1: 'J', 2: 'S', 3: 'M', 4: 'W', 5: 'M', 6: 'J', 7: 'W', 8: 'S' },
    setup: { 1: { d: 1 }, 2: { c: 1, d: 1 }, 3: { d: 1 }, 5: { b: 1 }, 6: { d: 2 }, 7: { t: 1 }, 8: { d: 1 } },
  },
  D: {
    terrain: { 1: 'S', 2: 'J', 3: 'W', 4: 'M', 5: 'J', 6: 'S', 7: 'W', 8: 'M' },
    setup: { 1: { d: 2 }, 2: { c: 1 }, 3: { d: 1 }, 5: { b: 1, d: 1 }, 6: { t: 1 }, 7: { d: 2 } },
  },
  // 들쭉날쭉한 대지 추가 보드
  E: {
    terrain: { 1: 'M', 2: 'J', 3: 'S', 4: 'W', 5: 'S', 6: 'M', 7: 'J', 8: 'W' },
    setup: { 1: { d: 1 }, 2: { t: 1, d: 1 }, 3: { d: 2 }, 5: { b: 1 }, 6: { d: 1 }, 7: { c: 1 }, 8: { d: 2 } },
  },
  F: {
    terrain: { 1: 'W', 2: 'S', 3: 'J', 4: 'M', 5: 'W', 6: 'J', 7: 'S', 8: 'M' },
    setup: { 1: { d: 2 }, 2: { c: 1 }, 4: { d: 1 }, 5: { b: 1, d: 1 }, 6: { t: 1 }, 7: { d: 1 }, 8: { d: 2 } },
  },
};

const TERRAIN_NAMES = { M: '산', J: '정글', S: '사막', W: '습지' };

// 보드 수에 따른 기본(격자) 배치. flipX/flipY는 보드를 거울 반전한다.
const LAYOUTS = {
  1: [{ board: 'A', ox: 0, oy: 0, flipX: false, flipY: false }],
  2: [
    { board: 'A', ox: 0, oy: 0, flipX: false, flipY: false },
    { board: 'B', ox: BOARD_W, oy: 0, flipX: true, flipY: false },
  ],
  3: [
    { board: 'A', ox: 0, oy: 0, flipX: false, flipY: false },
    { board: 'B', ox: BOARD_W, oy: 0, flipX: true, flipY: false },
    { board: 'C', ox: 0, oy: BOARD_H, flipX: false, flipY: true },
  ],
  4: [
    { board: 'A', ox: 0, oy: 0, flipX: false, flipY: false },
    { board: 'B', ox: BOARD_W, oy: 0, flipX: true, flipY: false },
    { board: 'C', ox: 0, oy: BOARD_H, flipX: false, flipY: true },
    { board: 'D', ox: BOARD_W, oy: BOARD_H, flipX: true, flipY: true },
  ],
};

function transform(pt, place) {
  let [x, y] = pt;
  if (place.flipX) x = BOARD_W - x;
  if (place.flipY) y = BOARD_H - y;
  return [x + place.ox, y + place.oy];
}

// 두 선분이 같은 직선 위에서 길이>0만큼 겹치는지
function segmentsOverlap(a1, a2, b1, b2) {
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  if (Math.abs(cross(a1, a2, b1)) > 1e-6 || Math.abs(cross(a1, a2, b2)) > 1e-6) return false;
  const dx = a2[0] - a1[0];
  const dy = a2[1] - a1[1];
  const len2 = dx * dx + dy * dy;
  const t = (p) => ((p[0] - a1[0]) * dx + (p[1] - a1[1]) * dy) / len2;
  const lo = Math.max(0, Math.min(t(b1), t(b2)));
  const hi = Math.min(1, Math.max(t(b1), t(b2)));
  return hi - lo > 1e-6;
}

function polygonsShareEdge(p, q) {
  for (let i = 0; i < p.length; i++) {
    const a1 = p[i];
    const a2 = p[(i + 1) % p.length];
    for (let j = 0; j < q.length; j++) {
      if (segmentsOverlap(a1, a2, q[j], q[(j + 1) % q.length])) return true;
    }
  }
  return false;
}

function centroid(poly) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

/**
 * 배치 계산.
 * layout: 'auto'(격자, 4개까지) | 'coast'(세로 해안선, 6개까지) | 'row'(2개를 위아래로 — coast 와 같음)
 */
function makeLayout(letters, layout) {
  const n = letters.length;
  if (layout !== 'coast' && n <= 4) return LAYOUTS[n].map((pl, i) => ({ ...pl, board: letters[i] }));
  return letters.map((board, i) => ({ board, ox: 0, oy: i * BOARD_H, flipX: false, flipY: i % 2 === 1 }));
}

// 게임용 지역 맵을 만든다. 반환: { lands: {id: land}, oceans: {id: ocean}, width, height }
// arg: 플레이어 수(숫자) 또는 { boards: ['A','B',...], layout }
function buildIsland(arg) {
  const letters = typeof arg === 'number' ? ['A', 'B', 'C', 'D'].slice(0, arg) : arg.boards;
  const layoutName = typeof arg === 'number' ? 'auto' : (arg.layout || 'auto');
  if (!letters.length || letters.length > 6) throw new Error('지원하지 않는 보드 수: ' + letters.length);
  const layout = makeLayout(letters, layoutName);
  const lands = {};
  const oceans = {};
  for (const place of layout) {
    const def = BOARDS[place.board];
    const oceanPoly = SHAPES[0].map((p) => transform(p, place));
    oceans[place.board + '0'] = { id: place.board + '0', board: place.board, poly: oceanPoly, center: centroid(oceanPoly) };
    for (let n = 1; n <= 8; n++) {
      const poly = SHAPES[n].map((p) => transform(p, place));
      const s = def.setup[n] || {};
      lands[place.board + n] = {
        id: place.board + n,
        board: place.board,
        num: n,
        terrain: def.terrain[n],
        poly,
        center: centroid(poly),
        coastal: false,
        adj: [],
        explorers: s.e || 0,
        towns: Array(s.t || 0).fill(2),
        cities: Array(s.c || 0).fill(3),
        dahan: Array(s.d || 0).fill(2),
        blight: s.b || 0,
        presence: {},
        defend: 0,
        flags: {},
      };
    }
  }
  const ids = Object.keys(lands);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = lands[ids[i]];
      const b = lands[ids[j]];
      if (polygonsShareEdge(a.poly, b.poly)) {
        a.adj.push(b.id);
        b.adj.push(a.id);
      }
    }
    const land = lands[ids[i]];
    land.coastal = Object.values(oceans).some((o) => polygonsShareEdge(land.poly, o.poly));
  }
  const width = Math.max(...layout.map((l) => l.ox)) + BOARD_W;
  const height = Math.max(...layout.map((l) => l.oy)) + BOARD_H;
  return { lands, oceans, width, height, boards: layout.map((l) => l.board) };
}

module.exports = { buildIsland, TERRAIN_NAMES, BOARDS };
