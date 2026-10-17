'use strict';
(() => {
// 필드: 맵 그리기, 걷기, 문·계단 이동, 이웃 맵 연결, 사람(NPC) 움직임, 말 걸기, 트레이너 시선
const G = window.G;

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
G.DIRS = DIRS;

const ow = (G.ow = {
  mapId: null, map: null, x: 0, y: 0, dir: 'down', surf: false, bike: false,
  anim: null, step: 0, turnDelay: 0, objs: [], others: new Map(), blockOver: new Map(), locked: 0,
  lastOutside: null, fade: 0, fadeDir: 0, popup: null, flash: false, strength: false, bumps: { key: null, n: 0 }, emote: null,
});

const C = () => G.W.coll;
const perm = (coll) => (coll == null ? 15 : G.W.collPerm[coll] & 15);
const isGrass = (c) => c === C().TALL_GRASS || c === C().LONG_GRASS;
const isWaterColl = (c) => perm(c) === 1;
function isDoorish(c) {
  const k = C();
  return [k.DOOR, k.STAIRCASE, k.CAVE, k.LADDER, k.WARP_PANEL, k.PIT, k.DOOR_75, k.DOOR_79, k.DOOR_7D, k.STAIRCASE_73, k.CAVE_74, k.WARP_77, k.WARP_7F].includes(c);
}
function carpetDir(c) {
  const k = C();
  return c === k.WARP_CARPET_DOWN ? 'down' : c === k.WARP_CARPET_UP ? 'up' : c === k.WARP_CARPET_LEFT ? 'left' : c === k.WARP_CARPET_RIGHT ? 'right' : null;
}
function hopDir(c) {
  const k = C();
  if (c === k.HOP_DOWN) return ['down'];
  if (c === k.HOP_RIGHT) return ['right'];
  if (c === k.HOP_LEFT) return ['left'];
  if (c === k.HOP_UP) return ['up'];
  if (c === k.HOP_DOWN_RIGHT) return ['down', 'right'];
  if (c === k.HOP_DOWN_LEFT) return ['down', 'left'];
  return null;
}
function wallSides(c) {
  const k = C();
  return { [k.RIGHT_WALL]: ['right'], [k.LEFT_WALL]: ['left'], [k.UP_WALL]: ['up'], [k.DOWN_WALL]: ['down'], [k.DOWN_RIGHT_WALL]: ['down', 'right'], [k.DOWN_LEFT_WALL]: ['down', 'left'], [k.UP_RIGHT_WALL]: ['up', 'right'], [k.UP_LEFT_WALL]: ['up', 'left'] }[c] || null;
}

// ───────── 맵 좌표 ─────────
/** 맵 밖 좌표를 이웃 맵 좌표로 */
G.resolve = function resolve(mapId, x, y) {
  const m = G.W.maps[mapId];
  if (!m) return null;
  const W2 = m.w * 2, H2 = m.h * 2;
  if (x >= 0 && y >= 0 && x < W2 && y < H2) return { mapId, x, y };
  const tryDir = (dir) => {
    const c = m.conn[dir];
    if (!c) return null;
    const t = G.W.maps[c.map];
    if (!t) return null;
    const off = c.off * 2;
    let nx, ny;
    if (dir === 'north') { nx = x - off; ny = y + t.h * 2; }
    else if (dir === 'south') { nx = x - off; ny = y - H2; }
    else if (dir === 'west') { nx = x + t.w * 2; ny = y - off; }
    else { nx = x - W2; ny = y - off; }
    if (nx >= 0 && ny >= 0 && nx < t.w * 2 && ny < t.h * 2) return { mapId: c.map, x: nx, y: ny };
    return null;
  };
  const dirs = [];
  if (y < 0) dirs.push('north'); if (y >= H2) dirs.push('south'); if (x < 0) dirs.push('west'); if (x >= W2) dirs.push('east');
  for (const d of dirs) { const r = tryDir(d); if (r) return r; }
  return null;
};
G.blockAt = function blockAt(mapId, bx, by) {
  const m = G.W.maps[mapId];
  const ov = ow.blockOver.get(mapId);
  const i = by * m.w + bx;
  if (ov && ov.has(i)) return ov.get(i);
  return m.blocks[i];
};
G.collAt = function collAt(mapId, x, y) {
  const r = G.resolve(mapId, x, y);
  if (!r) return null;
  const m = G.W.maps[r.mapId];
  const b = G.blockAt(r.mapId, r.x >> 1, r.y >> 1);
  const ts = G.W.tilesets[m.tileset];
  const cl = ts.collision[b];
  return cl ? cl[(r.y & 1) * 2 + (r.x & 1)] : 7;
};
function warpAt(mapId, x, y) { const m = G.W.maps[mapId]; return m.warps.findIndex((w) => w.x === x && w.y === y); }

// ───────── 맵에 들어가기 ─────────
function objVisible(o, idx, mapId) {
  if (o.sprite == null || o.sprite >= 0xf0 || !G.W.sprites[o.sprite]) return false;
  const me = G.me;
  if (!me) return true;
  const f = me.flags || {};
  const cls = o.leader && o.trainer ? o.trainer.split(':')[0] : null;
  if (cls === 'RED') return (me.badges || []).length >= 16;
  if (o.flag && f[o.flag] && !(cls && G.W.leaderBadge && G.W.leaderBadge[cls])) return false;
  if (o.itemball && f[`ITEM:${mapId}:${idx}`]) return false;
  if (o.wild && f[`STATIC:${mapId}:${idx}`]) return false;
  if ((ow.removed || new Set()).has(`${mapId}:${idx}`)) return false;
  if (f[`HIDE:${mapId}:${idx}`]) return false;
  // 시간대
  const tod = ['MORN', 'DAY', 'NITE'][G.timeOfDay()];
  if (o.h1 === -1 && ['MORN', 'DAY', 'NITE'].includes(o.h2name)) return o.h2name === tod;
  if (o.h1 >= 0 && o.h2 >= 0) { const h = new Date().getHours(); return o.h1 <= o.h2 ? h >= o.h1 && h <= o.h2 : h >= o.h1 || h <= o.h2; }
  return true;
}
G.objVisible = objVisible;

function faceOf(move) {
  const m = { STANDING_DOWN: 'down', STANDING_UP: 'up', STANDING_LEFT: 'left', STANDING_RIGHT: 'right' }[move];
  return m || 'down';
}

G.loadMapObjects = function loadMapObjects() {
  const m = ow.map;
  ow.objs = m.objects.map((o, idx) => ({ o, idx, x: o.x, y: o.y, dir: faceOf(o.move), visible: objVisible(o, idx, ow.mapId), anim: null, next: 60 + Math.random() * 120, home: { x: o.x, y: o.y } }));
};
G.refreshObjects = function refreshObjects() {
  for (const r of ow.objs) r.visible = objVisible(r.o, r.idx, ow.mapId);
  applyTileChanges(ow.mapId);
};
/** 이벤트에 따라 바뀌는 블록 (사천왕 방 문 등) */
function applyTileChanges(mapId) {
  const m = G.W.maps[mapId];
  if (!m || !m.tileChanges || !m.tileChanges.length) return;
  if (!ow.blockOver.has(mapId)) ow.blockOver.set(mapId, new Map());
  const ov = ow.blockOver.get(mapId);
  const f = (G.me && G.me.flags) || {};
  for (const tc of m.tileChanges) {
    const i = (tc.y >> 1) * m.w + (tc.x >> 1);
    if (!!f[tc.flag] === tc.need) ov.set(i, tc.b);
    else if (ov.get(i) === tc.b) ov.delete(i);
  }
}

G.enterMap = function enterMap(mapId, x, y, dir) {
  const prevLandmark = ow.map ? ow.map.landmark : null;
  const prevEnv = ow.map ? ow.map.env : null;
  ow.mapId = mapId; ow.map = G.W.maps[mapId]; ow.x = x; ow.y = y; if (dir) ow.dir = dir;
  if (ow.map.env === 'TOWN' || ow.map.env === 'ROUTE') ow.lastOutside = { map: mapId, x, y };
  if (ow.map.env !== 'CAVE' && ow.map.env !== 'DUNGEON') ow.flash = false;
  G.loadMapObjects();
  applyTileChanges(mapId);
  // 그림 미리 불러오기
  const ts = G.W.tilesets[ow.map.tileset];
  const files = [ts.png, ...ow.map.objects.map((o) => G.W.sprites[o.sprite] && G.W.sprites[o.sprite].file)];
  for (const dirName of ['north', 'south', 'west', 'east']) { const c = ow.map.conn[dirName]; if (c && G.W.maps[c.map]) files.push(G.W.tilesets[G.W.maps[c.map].tileset].png); }
  G.preload(files);
  G.net.send({ t: 'enter', map: mapId, x, y, dir: ow.dir });
  if (ow.map.landmark !== prevLandmark && ['TOWN', 'ROUTE', 'CAVE', 'DUNGEON'].includes(ow.map.env) && !(prevEnv && ['INDOOR', 'GATE'].includes(prevEnv) && false)) {
    ow.popup = { text: G.landmarkName(ow.map.landmark), t: 150 };
  }
};
G.landmarkName = (lm) => (G.LANDMARKS && G.LANDMARKS[lm]) || lm;

// ───────── 그리기 ─────────
function screenOrigin() {
  let px = ow.x * 16, py = ow.y * 16;
  if (ow.anim) { const k = ow.anim.t / ow.anim.frames; px += ow.anim.dx * 16 * ow.anim.len * k; py += ow.anim.dy * 16 * ow.anim.len * k; }
  return { left: Math.round(px - 64), top: Math.round(py - 64), px, py };
}

G.drawOverworld = function drawOverworld(ctx) {
  const m = ow.map;
  if (!m) return;
  const meta = G.metatiles(m, ow.flash);
  const { left, top } = screenOrigin();
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, 160, 144);
  if (meta) {
    const bx0 = Math.floor(left / 32), by0 = Math.floor(top / 32);
    for (let by = by0; by <= by0 + 5; by++) {
      for (let bx = bx0; bx <= bx0 + 5; bx++) {
        let block;
        let sheet = meta;
        if (bx >= 0 && by >= 0 && bx < m.w && by < m.h) block = G.blockAt(ow.mapId, bx, by);
        else {
          const r = G.resolve(ow.mapId, bx * 2, by * 2);
          if (r) { block = G.blockAt(r.mapId, r.x >> 1, r.y >> 1); const nm = G.W.maps[r.mapId]; if (nm.tileset !== m.tileset) sheet = G.metatiles(nm, false) || meta; }
          else block = m.border;
        }
        if (block == null) continue;
        ctx.drawImage(sheet, (block % 16) * 32, Math.floor(block / 16) * 32, 32, 32, bx * 32 - left, by * 32 - top, 32, 32);
      }
    }
  }
  // 사람들 (y 순서)
  const t = G.mapTod(m, ow.flash);
  const list = [];
  for (const r of ow.objs) if (r.visible) list.push({ kind: 'obj', r, y: objPixel(r).y });
  for (const [, o] of ow.others) if (o.map === ow.mapId) list.push({ kind: 'other', o, y: o.py });
  const me = screenOrigin();
  list.push({ kind: 'me', y: me.py });
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if (it.kind === 'obj') drawObj(ctx, it.r, left, top, t);
    else if (it.kind === 'other') drawPerson(ctx, it.o.look, it.o.px - left, it.o.py - top, it.o.dir, it.o.walk, it.o.surf, it.o.bike, t, it.o);
    else drawPerson(ctx, G.me ? G.me.look : 0, me.px - left, me.py - top, ow.dir, ow.anim ? ow.anim.t / ow.anim.frames : 0, ow.surf, ow.bike, t, null, ow.anim && ow.anim.jump);
  }
  if (ow.emote) {
    const e = ow.emote;
    const x = e.x * 16 - left, y = e.y * 16 - top - 20;
    ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 3, y, 10, 14);
    ctx.fillStyle = '#101010'; ctx.fillRect(x + 3, y, 10, 1); ctx.fillRect(x + 3, y + 13, 10, 1); ctx.fillRect(x + 3, y, 1, 14); ctx.fillRect(x + 12, y, 1, 14);
    ctx.fillRect(x + 7, y + 2, 2, 7); ctx.fillRect(x + 7, y + 10, 2, 2);
  }
  // 어두운 동굴: 플래시 없으면 주변만 보이게
  if (m.palette === 'DARK' && !ow.flash) {
    const g = ctx.createRadialGradient(72, 68, 10, 72, 68, 40);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 160, 144);
  }
  if (ow.popup && ow.popup.t > 0) {
    ow.popup.t--;
    const w = Math.min(152, Math.ceil(G.measure(ctx, ow.popup.text)) + 20);
    const y = ow.popup.t > 130 ? -24 + (150 - ow.popup.t) * 1.4 : ow.popup.t < 20 ? -24 + ow.popup.t * 1.4 : 4;
    G.box(ctx, 4, Math.round(y), w, 24);
    G.text(ctx, ow.popup.text, 12, Math.round(y) + 7);
  }
};

function objPixel(r) {
  let x = r.x * 16, y = r.y * 16;
  if (r.anim) { const k = r.anim.t / r.anim.frames; x -= r.anim.dx * 16 * (1 - k); y -= r.anim.dy * 16 * (1 - k); }
  return { x, y };
}

function frameFor(dir, walkK, stepParity) {
  // 0 아래 1 위 2 옆(왼쪽) 3 아래걷기 4 위걷기 5 옆걷기
  const walking = walkK > 0 && walkK < 0.5;
  if (dir === 'down') return walking ? { f: 3, flip: !!stepParity } : { f: 0, flip: false };
  if (dir === 'up') return walking ? { f: 4, flip: !!stepParity } : { f: 1, flip: false };
  if (dir === 'left') return { f: walking ? 5 : 2, flip: false };
  return { f: walking ? 5 : 2, flip: true };
}

function drawObj(ctx, r, left, top, t) {
  const o = r.o;
  const spr = G.W.sprites[o.sprite];
  if (!spr) return;
  const p = objPixel(r);
  const x = p.x - left, y = p.y - top - 4;
  if (x < -16 || y < -20 || x > 160 || y > 144) return;
  if (spr.kind === 'ICON') {
    const c = G.icon(spr.mon, Math.floor(performance.now() / 400) % 2);
    if (c) ctx.drawImage(c, x, y);
    return;
  }
  const pal = o.pal != null ? o.pal & 7 : spr.pal;
  let fr;
  if (spr.kind === 'STILL_SPRITE') fr = { f: 0, flip: false };
  else fr = frameFor(r.dir, r.anim ? r.anim.t / r.anim.frames : 0, r.parity);
  const c = G.spriteFrame(spr.file, pal, t, fr.f, fr.flip);
  if (c) ctx.drawImage(c, x, y);
  grassOver(ctx, r.x, r.y, left, top, r.anim);
}

function drawPerson(ctx, look, sx, sy, dir, walkK, surf, bike, t, other, jump) {
  const sprites = G.W.sprites;
  let file = sprites[1].file;
  if (bike && sprites[2] && sprites[2].file) file = sprites[2].file;
  let y = sy - 4;
  if (jump) y -= Math.round(Math.sin(walkK * Math.PI) * 8);
  if (surf) {
    const surfSpr = G.surfSprite || (G.surfSprite = Object.values(sprites).find((s) => s.file && /\/surf\.png$/.test(s.file)));
    if (surfSpr) {
      const fr = frameFor(dir, 0, 0);
      const c = G.spriteFrame(surfSpr.file, 1, t, fr.f, fr.flip);
      if (c) ctx.drawImage(c, Math.round(sx), Math.round(y + (Math.floor(performance.now() / 500) % 2)));
    }
    return;
  }
  const fr = frameFor(dir, walkK, other ? other.parity : ow.step & 1);
  const c = G.spriteFrame(file, G.LOOK_PAL[look & 3] ?? 0, t, fr.f, fr.flip);
  if (c) ctx.drawImage(c, Math.round(sx), Math.round(y));
  if (other) {
    ctx.font = '8px Galmuri9'; // 이름표
    const w = Math.ceil(G.measure(ctx, other.name)) + 4;
    ctx.fillStyle = 'rgba(16,16,16,0.7)'; ctx.fillRect(Math.round(sx + 8 - w / 2), Math.round(y - 11), w, 10);
    G.text(ctx, other.name, Math.round(sx + 8), Math.round(y - 11), '#f8f8f8', 'center');
    if (other.battle) { ctx.fillStyle = '#e83020'; ctx.fillRect(Math.round(sx + 12), Math.round(y - 2), 4, 4); }
  }
  if (!jump && !other) grassOver(ctx, ow.x, ow.y, Math.round(screenOrigin().left), Math.round(screenOrigin().top), ow.anim, true);
}

/** 풀숲 위에 서 있으면 아랫부분을 풀이 가림 */
function grassOver(ctx, x, y, left, top, anim, isMe) {
  if (anim) return;
  const c = G.collAt(ow.mapId, x, y);
  if (c !== C().TALL_GRASS) return;
  const meta = G.metatiles(ow.map, ow.flash);
  if (!meta) return;
  const r = G.resolve(ow.mapId, x, y);
  if (!r) return;
  const b = G.blockAt(r.mapId, r.x >> 1, r.y >> 1);
  const qx = (x & 1) * 16, qy = (y & 1) * 16;
  ctx.drawImage(meta, (b % 16) * 32 + qx, Math.floor(b / 16) * 32 + qy + 8, 16, 8, x * 16 - left, y * 16 - top + 8, 16, 8);
  void isMe;
}

// ───────── 움직이기 ─────────
function occupied(mapId, x, y, except) {
  if (mapId !== ow.mapId) return null;
  for (const r of ow.objs) {
    if (!r.visible || r === except) continue;
    if (r.x === x && r.y === y) return r;
    if (r.anim && r.x - r.anim.dx === x && r.y - r.anim.dy === y) return r;
  }
  return null;
}
G.objAt = (x, y) => occupied(ow.mapId, x, y);
function otherAt(x, y) { for (const [, o] of ow.others) if (o.map === ow.mapId && o.x === x && o.y === y) return o; return null; }

function heldDir() {
  const h = G.input.held;
  for (const d of ['up', 'down', 'left', 'right']) if (G.input.pressed[d]) return d;
  if (h[ow.lastDir]) return ow.lastDir;
  for (const d of ['up', 'down', 'left', 'right']) if (h[d]) return d;
  return null;
}

G.updateOverworld = function updateOverworld() {
  if (!ow.map) return;
  updateNPCs();
  updateOthers();
  if (ow.fadeDir) return;
  if (ow.anim) { stepAnim(); return; }
  if (G.uiBusy() || sc.active || ow.locked > 0 || G.battle || G.waitingBattle > 0) { if (ow.locked > 0 && !G.uiBusy()) ow.locked--; return; }
  const d = heldDir();
  if (d) {
    ow.lastDir = d;
    if (d !== ow.dir) { ow.dir = d; ow.turnDelay = G.input.pressed[d] ? 5 : 0; G.net.sendMove(false); if (ow.turnDelay) return; }
    if (ow.turnDelay > 0) { ow.turnDelay--; return; }
    tryStep(d);
    return;
  }
  ow.turnDelay = 0;
  if (G.input.pressed.a) { interact(); return; }
  if (G.input.pressed.start) { G.openStartMenu(); return; }
  if (G.input.pressed.select && G.me && G.me.bag.BICYCLE) { toggleBike(); }
};

function toggleBike() {
  if (ow.surf || !['TOWN', 'ROUTE'].includes(ow.map.env) && !/CAVE|DUNGEON/.test(ow.map.env)) { if (!ow.bike) { G.say('여기서는 자전거를 탈 수 없다!'); return; } }
  ow.bike = !ow.bike;
  G.say(ow.bike ? `${G.me.name}${G.josaEunNeun(G.me.name)} 자전거에 올라탔다.` : `${G.me.name}${G.josaEunNeun(G.me.name)} 자전거에서 내렸다.`);
  G.net.sendMove(false);
}
G.toggleBike = toggleBike;

function speed() { return ow.bike || (G.input.held.b && G.settings.run !== false) ? 2 : 1; }

function bump() {
  if (!ow.bumpT || ow.bumpT < performance.now()) { G.sfx('bump'); ow.bumpT = performance.now() + 250; }
}

function tryStep(dir) {
  const [dx, dy] = DIRS[dir];
  const curColl = G.collAt(ow.mapId, ow.x, ow.y);
  const wi = warpAt(ow.mapId, ow.x, ow.y);
  if (wi >= 0 && carpetDir(curColl) === dir) { doWarp(wi); return; }
  const nx = ow.x + dx, ny = ow.y + dy;
  const r = G.resolve(ow.mapId, nx, ny);
  if (!r) { if (wi >= 0 && !isDoorish(curColl)) { doWarp(wi); return; } bump(); return; }
  // 포켓몬 없이 마을 밖으로
  if (r.mapId !== ow.mapId && G.me && !G.me.party.length && ow.mapId === 'NEW_BARK_TOWN') {
    ow.locked = 10;
    G.say([['앗, 잠깐!'], ['포켓몬 없이 풀숲에 들어가면 위험해!', '먼저 공박사님 연구소에 가 보렴.']]);
    return;
  }
  const coll = G.collAt(ow.mapId, nx, ny);
  // 벽 한쪽만 막힌 칸
  const ws = wallSides(curColl);
  if (ws && ws.includes(dir)) { bump(); return; }
  const wt = wallSides(coll);
  if (wt && wt.includes(OPP[dir])) { bump(); return; }
  // 턱 뛰어넘기: 원작처럼 턱 칸 위에 서서 그 방향으로 누르면 두 칸 뛴다
  const hop = hopDir(curColl);
  if (hop && hop.includes(dir) && !ow.surf) {
    const lx = ow.x + dx * 2, ly = ow.y + dy * 2;
    const lc = G.collAt(ow.mapId, lx, ly);
    if (perm(lc) === 0 && !occupied(ow.mapId, lx, ly)) { startAnim(dx, dy, 2, true); return; }
    bump(); return;
  }
  const p = perm(coll);
  if (ow.surf) {
    if (p === 15 || (p !== 1 && p !== 0)) { bump(); return; }
    if (coll === C().WATERFALL) { bump(); return; }
  } else if (p !== 0) {
    bump();
    return;
  }
  const blocker = occupied(r.mapId, r.x, r.y);
  if (blocker) {
    // 바위 밀기 (괴력)
    if (blocker.o.std === 'StrengthBoulder' && ow.strength) {
      const bx = r.x + dx, by = r.y + dy;
      if (perm(G.collAt(ow.mapId, bx, by)) === 0 && !occupied(ow.mapId, bx, by) && !otherAt(bx, by)) {
        blocker.anim = { dx, dy, t: 0, frames: 16 }; blocker.x = bx; blocker.y = by; G.sfx('bump');
      }
      bump(); return;
    }
    const key = `${blocker.idx}`;
    // 따로따로 여러 번 눌러 부딪혀야 비켜 줌 (누르고 있는 것은 한 번)
    if (ow.bumps.key !== key) ow.bumps = { key, n: 0 };
    if (G.input.pressed[dir]) ow.bumps.n++;
    if (ow.bumps.n < 5 || blocker.o.type === 'TRAINER' || blocker.o.std || blocker.o.wild || blocker.o.itemball) { bump(); return; }
    // 길을 계속 막고 서 있으면 비켜 줌 (이야기 진행을 다 만들지 않았으므로)
    G.toast(`${G.me.name}: 잠깐 지나갈게요!`);
  }
  ow.bumps = { key: null, n: 0 };
  startAnim(dx, dy, 1, false, p === 0 && ow.surf ? 'dismount' : null);
}

function startAnim(dx, dy, len, jump, extra) {
  const frames = jump ? 24 : 16 / speed();
  ow.anim = { dx, dy, len, t: 0, frames: Math.max(4, frames), jump, extra };
  if (jump) G.sfx('bump');
}

function stepAnim() {
  const a = ow.anim;
  a.t++;
  if (a.t < a.frames) return;
  ow.anim = null;
  ow.step++;
  if (a.script) { ow.x += a.dx * a.len; ow.y += a.dy * a.len; return; }
  let nx = ow.x + a.dx * a.len, ny = ow.y + a.dy * a.len;
  const r = G.resolve(ow.mapId, nx, ny);
  if (r && r.mapId !== ow.mapId) G.enterMap(r.mapId, r.x, r.y);
  else if (r) { ow.x = r.x; ow.y = r.y; }
  if (a.extra === 'dismount') ow.surf = false;
  afterStep();
}

function afterStep() {
  G.net.sendMove(true);
  // 밟으면 시작하는 원작 장면
  const ces = ow.map.coordEvents || [];
  const scene = (G.me && G.me.scenes && G.me.scenes[ow.mapId]) || 0;
  const ci = ces.findIndex((c) => c.x === ow.x && c.y === ow.y && c.scene === scene);
  if (ci >= 0) { G.net.send({ t: 'coord', map: ow.mapId, i: ci }); scriptPending(); return; }
  const coll = G.collAt(ow.mapId, ow.x, ow.y);
  const wi = warpAt(ow.mapId, ow.x, ow.y);
  if (wi >= 0 && (isDoorish(coll) || (!carpetDir(coll) && !hasFloorAround()))) { doWarp(wi); return; }
  // 얼음 미끄러지기
  if (coll === C().ICE && ow.lastDir) {
    const [dx, dy] = DIRS[ow.dir];
    const nc = G.collAt(ow.mapId, ow.x + dx, ow.y + dy);
    if (perm(nc) === 0 && !occupied(ow.mapId, ow.x + dx, ow.y + dy)) { ow.anim = { dx, dy, len: 1, t: 0, frames: 8, slide: true }; return; }
  }
  if (checkTrainers()) return;
  maybeEncounter(coll);
}
function hasFloorAround() { return true; }

function maybeEncounter(coll) {
  if (!G.me || !G.me.party.some((m) => m.hp > 0 && !m.egg)) return;
  const W = G.W;
  const grass = W.wild.grass[ow.mapId];
  const water = W.wild.water[ow.mapId];
  const cave = ['CAVE', 'DUNGEON'].includes(ow.map.env);
  let rate = 0, kind = null;
  if (ow.surf && water) { rate = water.rate; kind = 'water'; }
  else if (!ow.surf && grass && (isGrass(coll) || cave)) { rate = grass.rates[G.timeOfDay()]; kind = 'grass'; }
  if (!kind) return;
  if (Math.random() * 100 < rate * (ow.bike ? 0.6 : 0.85)) {
    G.net.send({ t: 'encounter', kind });
    G.waitingBattle = 40;
  }
}

// ───────── 문 · 계단 ─────────
async function doWarp(wi) {
  const w = ow.map.warps[wi];
  if (!w) return;
  let dest = w.to, idx = w.idx;
  let tx, ty;
  if (idx === -1 || !G.W.maps[dest]) {
    if (!ow.prevWarp) return;
    dest = ow.prevWarp.map; tx = ow.prevWarp.x; ty = ow.prevWarp.y;
  } else {
    const dm = G.W.maps[dest];
    const dw = dm.warps[idx - 1];
    if (!dw) return;
    tx = dw.x; ty = dw.y;
  }
  ow.prevWarp = { map: ow.mapId, x: ow.x, y: ow.y };
  await G.fadeOut();
  G.enterMap(dest, tx, ty);
  const coll = G.collAt(dest, tx, ty);
  const toDoor = coll === C().DOOR || coll === C().DOOR_75 || coll === C().DOOR_79 || coll === C().DOOR_7D;
  G.net.sendMove(false);
  await G.fadeIn();
  if (toDoor && perm(G.collAt(dest, tx, ty + 1)) === 0) { ow.dir = 'down'; startAnim(0, 1, 1, false, 'exit'); }
}
G.doWarp = doWarp;

// 앞의 화면 전환이 아직 끝나지 않았으면 먼저 끝난 것으로 처리 (기다리던 쪽이 멈춰 버리지 않게)
function settleFade() { const r = ow.fadeDone; ow.fadeDone = null; if (r) r(); }
G.fadeOut = function fadeOut() { settleFade(); return new Promise((r) => { ow.fadeDir = 1; ow.fadeDone = r; }); };
G.fadeIn = function fadeIn() { settleFade(); return new Promise((r) => { ow.fadeDir = -1; ow.fadeDone = r; }); };
G.updateFade = function updateFade() {
  if (!ow.fadeDir) return;
  ow.fade = Math.max(0, Math.min(1, ow.fade + ow.fadeDir * 0.125));
  if ((ow.fadeDir > 0 && ow.fade >= 1) || (ow.fadeDir < 0 && ow.fade <= 0)) { ow.fadeDir = 0; const r = ow.fadeDone; ow.fadeDone = null; if (r) r(); }
};
G.drawFade = function drawFade(ctx) {
  if (ow.fade <= 0) return;
  ctx.fillStyle = `rgba(248,248,248,${ow.fade})`;
  ctx.fillRect(0, 0, 160, 144);
};

/** 서버가 보낸 순간이동 (기절 · 날기 · 탈출로프) */
G.teleport = async function teleport(map, x, y, dir, fade = true) {
  if (fade) await G.fadeOut();
  ow.surf = false; ow.bike = false;
  G.enterMap(map, x, y, dir || 'down');
  G.net.sendMove(false);
  if (fade) await G.fadeIn();
};

// ───────── NPC 움직임 ─────────
function updateNPCs() {
  for (const r of ow.objs) {
    if (r.anim) { r.anim.t++; if (r.anim.t >= r.anim.frames) r.anim = null; continue; }
    if (!r.visible || r.busy || sc.active) continue;
    const mv = r.o.move;
    if (--r.next > 0) continue;
    r.next = 60 + Math.random() * 150;
    if (mv === 'SPINRANDOM_SLOW' || mv === 'SPINRANDOM_FAST') { r.dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)]; if (mv === 'SPINRANDOM_FAST') r.next = 30 + Math.random() * 60; continue; }
    let dirs = null;
    if (mv === 'WANDER' || mv === 'SWIM_WANDER') dirs = ['up', 'down', 'left', 'right'];
    else if (mv === 'WALK_UP_DOWN') dirs = ['up', 'down'];
    else if (mv === 'WALK_LEFT_RIGHT') dirs = ['left', 'right'];
    if (!dirs) continue;
    if (G.uiBusy() && G.talking === r) continue;
    const d = dirs[Math.floor(Math.random() * dirs.length)];
    r.dir = d;
    const [dx, dy] = DIRS[d];
    const nx = r.x + dx, ny = r.y + dy;
    const rx = Math.max(1, r.o.rx || 0), ry = Math.max(1, r.o.ry || 0);
    if (Math.abs(nx - r.home.x) > rx || Math.abs(ny - r.home.y) > ry) continue;
    const c = G.collAt(ow.mapId, nx, ny);
    const swim = mv === 'SWIM_WANDER';
    if ((swim ? perm(c) !== 1 : perm(c) !== 0) || occupied(ow.mapId, nx, ny, r) || otherAt(nx, ny)) continue;
    if ((nx === ow.x && ny === ow.y) || (ow.anim && nx === ow.x + ow.anim.dx && ny === ow.y + ow.anim.dy)) continue;
    if (isDoorish(c) || warpAt(ow.mapId, nx, ny) >= 0) continue;
    r.x = nx; r.y = ny; r.parity = !r.parity;
    r.anim = { dx, dy, t: 0, frames: 16 };
  }
}

function updateOthers() {
  for (const [, o] of ow.others) {
    const tx = o.x * 16, ty = o.y * 16;
    if (o.px === undefined || Math.abs(tx - o.px) > 48 || Math.abs(ty - o.py) > 48) { o.px = tx; o.py = ty; o.walk = 0; continue; }
    const sp = o.bike ? 2 : 1.5;
    const ddx = tx - o.px, ddy = ty - o.py;
    if (ddx || ddy) {
      o.px += Math.sign(ddx) * Math.min(Math.abs(ddx), sp);
      o.py += Math.sign(ddy) * Math.min(Math.abs(ddy), sp);
      o.walk = 0.25;
    } else o.walk = 0;
  }
}

// ───────── 트레이너 시선 ─────────
function checkTrainers() {
  if (!G.me || !G.me.party.some((m) => m.hp > 0)) return false;
  for (const r of ow.objs) {
    const o = r.o;
    if (!r.visible || o.type !== 'TRAINER' || !o.trainer || !o.sight) continue;
    if (G.me.beaten && G.me.beaten[o.trainer]) continue;
    const [dx, dy] = DIRS[r.dir];
    for (let k = 1; k <= o.sight; k++) {
      const x = r.x + dx * k, y = r.y + dy * k;
      if (k > 1) { const c = G.collAt(ow.mapId, x - dx, y - dy); if (perm(c) !== 0 || occupied(ow.mapId, x - dx, y - dy, r)) break; }
      if (x === ow.x && y === ow.y) { spotted(r, k); return true; }
    }
  }
  return false;
}

async function spotted(r, dist) {
  ow.locked = 600;
  r.busy = true;
  ow.emote = { x: r.x, y: r.y };
  G.sfx('select');
  await G.wait(40);
  ow.emote = null;
  const [dx, dy] = DIRS[r.dir];
  for (let k = 1; k < dist; k++) {
    r.x += dx; r.y += dy; r.parity = !r.parity;
    r.anim = { dx, dy, t: 0, frames: 16 };
    await G.wait(16);
  }
  ow.dir = OPP[r.dir];
  await G.say(r.o.seen || [['승부다!']]);
  r.busy = false;
  ow.locked = 0;
  G.net.send({ t: 'trainer', map: ow.mapId, idx: r.idx });
  G.waitingBattle = 90;
}

// ───────── 말 걸기 ─────────
const STD = {
  PokecenterSign: [['포켓몬의 체력을 회복합니다!'], ['포켓몬센터']],
  MartSign: [['포켓몬 용품은 여기서!'], ['프렌들리숍']],
  PictureBookshelf: [['포켓몬 그림책이 가득 꽂혀 있다.']],
  MagazineBookshelf: [['포켓몬 잡지가 꽂혀 있다…', '포켓몬 그림책도 있다.']],
  DifficultBookshelf: [['어려워 보이는 책이 가득 꽂혀 있다.']],
  TrashCan: [['아무것도 없다…', '휴지통이다.']],
  IncenseBurner: [['향이 피어오르고 있다…']],
  Radio1: [['라디오에서 노래가 흘러나온다…']], Radio2: [['라디오에서 노래가 흘러나온다…']],
  TownMap: [['지도다.', '조토 지방이 그려져 있다.']],
  Window: [['창밖이 보인다.']], TV: [['TV에서 영화를 하고 있다!', '소년 네 명이 철길 위를 걷고 있다…']],
  HomepageScript: [['포켓몬 홈페이지다…']], ElevatorButton: [['엘리베이터 버튼이다.']],
  GymStatue1: [['포켓몬 체육관']], GymStatue2: [['포켓몬 체육관']],
  Pokecenter2FSign: [['링크 클럽은 준비 중입니다.']], StrengthBoulder: [['커다란 바위다.', '괴력이 있으면 밀 수 있을 것 같다.']],
  SmashRock: [['깨질 것 같은 바위다.', '바위깨기를 쓰면 깨질지도 모른다.']],
};
const TILE_TEXT = () => {
  const k = C();
  return { [k.BOOKSHELF]: STD.DifficultBookshelf, [k.TV]: STD.TV, [k.RADIO]: STD.Radio1, [k.TOWN_MAP]: STD.TownMap, [k.WINDOW]: STD.Window, [k.MART_SHELF]: [['포켓몬 용품이 진열되어 있다.']], [k.INCENSE_BURNER]: STD.IncenseBurner };
};

G.knows = (move) => G.me && G.me.party.some((m) => !m.egg && m.hp > 0 && m.moves.some((x) => x.id === move));
G.knowsName = (move) => { const m = G.me.party.find((p) => !p.egg && p.moves.some((x) => x.id === move)); return m ? m.name : ''; };

async function interact() {
  const [dx, dy] = DIRS[ow.dir];
  let fx = ow.x + dx, fy = ow.y + dy;
  // 다른 사람
  const other = otherAt(fx, fy);
  if (other) { G.playerMenu(other); return; }
  let r = occupied(ow.mapId, fx, fy);
  const fColl = G.collAt(ow.mapId, fx, fy);
  if (!r && fColl === C().COUNTER) { r = occupied(ow.mapId, fx + dx, fy + dy); if (r) { fx += dx; fy += dy; } }
  if (r) { await talk(r); return; }
  // 표지판
  const signIdx = ow.map.signs.findIndex((s) => s.x === fx && s.y === fy);
  if (signIdx >= 0) {
    const s = ow.map.signs[signIdx];
    if (s.kind === 'UP' && ow.dir !== 'up') { /* 위에서만 읽음 */ }
    else if (s.kind === 'ITEM' || s.hidden) { if (s.hidden && !(G.me.flags[s.hidden.flag] || G.me.flags[`HIDDEN:${ow.mapId}:${signIdx}`])) { G.net.send({ t: 'hidden', map: ow.mapId, idx: signIdx }); return; } }
    else {
      if (s.std === 'PCScript' || s.std === 'PokecenterPC' || /PC$/.test(s.std || '')) { G.openPC(); return; }
      if (s.pc >= 0) { G.net.send({ t: 'sign', map: ow.mapId, idx: signIdx }); await scriptPending(); return; }
      const txt = s.text || STD[s.std] || null;
      if (txt) { await G.say(txt); return; }
    }
  }
  // 타일
  if (fColl === C().PC) { G.openPC(); return; }
  const tt = TILE_TEXT()[fColl];
  if (tt) { await G.say(tt); return; }
  // 필드 기술
  if (!ow.surf && isWaterColl(fColl) && fColl !== C().WHIRLPOOL) {
    if (G.knows('SURF')) {
      if (await G.yesno('물이 파랗다. 파도타기를 쓰겠습니까?')) {
        await G.say(`${G.knowsName('SURF')}의 파도타기!`);
        ow.surf = true; ow.bike = false;
        startAnim(dx, dy, 1, false);
      }
    } else await G.say('물이 파랗다…');
    return;
  }
  if (fColl === C().WATERFALL && ow.surf) {
    if (G.knows('WATERFALL')) { if (await G.yesno('폭포다. 폭포오르기를 쓰겠습니까?')) await climbWaterfall(); }
    else await G.say('엄청난 기세의 폭포다!');
    return;
  }
  if (fColl === C().WHIRLPOOL) {
    if (G.knows('WHIRLPOOL')) { if (await G.yesno('소용돌이다. 회오리를 쓰겠습니까?')) replaceFacingBlock('whirlpool', fx, fy); }
    else await G.say('물이 거세게 소용돌이치고 있다!');
    return;
  }
  if (fColl === C().CUT_TREE || cutBlock(fx, fy)) {
    if (G.knows('CUT')) { if (await G.yesno('잘릴 것 같은 나무다. 풀베기를 쓰겠습니까?')) { await G.say(`${G.knowsName('CUT')}의 풀베기!`); replaceFacingBlock('cut', fx, fy); } }
    else if (fColl === C().CUT_TREE) await G.say('잘릴 것 같은 나무다.');
    return;
  }
  if (fColl === C().HEADBUTT_TREE) {
    if (G.knows('HEADBUTT')) {
      if (await G.yesno('포켓몬이 있을지도 모른다. 박치기를 쓰겠습니까?')) {
        await G.say(`${G.knowsName('HEADBUTT')}의 박치기!`);
        if (Math.random() < 0.5) { G.net.send({ t: 'encounter', kind: 'tree' }); G.waitingBattle = 60; }
        else await G.say('…아무것도 없다.');
      }
    }
    return;
  }
}

function cutBlock(fx, fy) {
  const r = G.resolve(ow.mapId, fx, fy);
  if (!r) return false;
  const list = G.W.fieldBlocks.cut[G.W.maps[r.mapId].tileset] || [];
  const b = G.blockAt(r.mapId, r.x >> 1, r.y >> 1);
  return list.some((e) => e[0] === b && e[2] === 0);
}
function replaceFacingBlock(kind, fx, fy) {
  const r = G.resolve(ow.mapId, fx, fy);
  if (!r) return;
  const m = G.W.maps[r.mapId];
  const list = G.W.fieldBlocks[kind][m.tileset] || [];
  const bi = (r.y >> 1) * m.w + (r.x >> 1);
  const b = G.blockAt(r.mapId, r.x >> 1, r.y >> 1);
  const e = list.find((x) => x[0] === b);
  if (!e) return;
  if (!ow.blockOver.has(r.mapId)) ow.blockOver.set(r.mapId, new Map());
  ow.blockOver.get(r.mapId).set(bi, e[1]);
  G.sfx('hit');
}
async function climbWaterfall() {
  await G.say(`${G.knowsName('WATERFALL')}의 폭포오르기!`);
  for (let i = 0; i < 30; i++) {
    const [dx, dy] = DIRS[ow.dir];
    if (G.collAt(ow.mapId, ow.x + dx, ow.y + dy) !== C().WATERFALL && i > 0) { startAnim(dx, dy, 1); return; }
    ow.x += dx; ow.y += dy;
    await G.wait(8);
  }
}

async function talk(r) {
  const o = r.o;
  G.talking = r;
  if (!['STILL', 'STANDING_DOWN', 'STANDING_UP', 'STANDING_LEFT', 'STANDING_RIGHT'].includes(o.move) || o.type === 'SCRIPT') {
    const spr = G.W.sprites[o.sprite];
    if (spr && spr.kind !== 'STILL_SPRITE') r.dir = OPP[ow.dir];
  }
  r.busy = true;
  try { await talkInner(r); } finally { r.busy = false; G.talking = null; }
}

async function talkInner(r) {
  const o = r.o, me = G.me;
  const mapId = ow.mapId;
  // 시선으로 싸우는 트레이너
  if (o.type === 'TRAINER' && o.trainer) {
    if (!me.beaten[o.trainer]) {
      if (!me.party.some((m) => m.hp > 0 && !m.egg)) { await G.say('싸울 수 있는 포켓몬이 없다!'); return; }
      await G.say(o.seen || o.text || [['승부다!']]);
      G.net.send({ t: 'trainer', map: mapId, idx: r.idx });
      G.waitingBattle = 90;
      return;
    }
    await G.say(o.after || o.win || o.text || [['…']]);
    return;
  }
  if (o.itemball) { G.net.send({ t: 'pickup', map: mapId, idx: r.idx }); return; }
  if (o.fruit) { G.net.send({ t: 'fruit', map: mapId, idx: r.idx }); return; }
  if (o.std === 'SmashRock') {
    if (G.knows('ROCK_SMASH') && await G.yesno('깨질 것 같은 바위다. 바위깨기를 쓰겠습니까?')) {
      await G.say(`${G.knowsName('ROCK_SMASH')}의 바위깨기!`);
      (ow.removed ||= new Set()).add(`${mapId}:${r.idx}`); r.visible = false; G.sfx('hit');
    } else if (!G.knows('ROCK_SMASH')) await G.say(STD.SmashRock);
    return;
  }
  if (o.std === 'StrengthBoulder') {
    if (G.knows('STRENGTH')) {
      if (ow.strength) await G.say('바위를 밀 수 있다!');
      else if (await G.yesno('커다란 바위다. 괴력을 쓰겠습니까?')) { ow.strength = true; await G.say(`${G.knowsName('STRENGTH')}의 괴력!`); await G.say('이제 바위를 밀 수 있다!'); }
    } else await G.say(STD.StrengthBoulder);
    return;
  }
  // 나머지는 원작 스크립트 그대로 (대사, 질문, 선물, 배틀 …)
  if (o.pc >= 0) { G.net.send({ t: 'talk', map: mapId, idx: r.idx }); await scriptPending(); return; }
  const txt = o.text || STD[o.std] || null;
  await G.say(txt || [['…']]);
}

// ───────── 원작 스크립트 재생 ─────────
const sc = { active: false, queue: [], running: false, done: null, timer: 0 };
G.inScript = () => sc.active;
/** 서버에 스크립트를 부탁했으면 끝날 때까지 기다린다 */
function scriptPending() {
  sc.active = true;
  clearTimeout(sc.timer);
  sc.timer = setTimeout(() => { if (sc.active && !sc.running && !sc.queue.length && !sc.started) endScript(); }, 5000);
  return new Promise((r) => { const prev = sc.done; sc.done = () => { if (prev) prev(); r(); }; });
}
function endScript() {
  sc.active = false; sc.started = false;
  G.showMonPreview = null;
  ow.emote = null;
  G.refreshObjects();
  G.net.sendMove(false);
  const d = sc.done; sc.done = null; if (d) d();
}
G.onScript = function onScript(msg) {
  sc.active = true; sc.started = true;
  sc.queue.push(msg);
  pump();
};
G.onObjects = function onObjects(msg) {
  for (const x of msg.out || []) { const r = ow.objs[x.hide ?? x.show]; if (r) r.visible = x.show !== undefined; }
};
async function pump() {
  if (sc.running) return;
  sc.running = true;
  try {
    while (sc.queue.length) {
      const msg = sc.queue.shift();
      try { await playScript(msg); } catch (e) { console.error(e); if (msg.wait) G.net.send({ t: 'scriptAnswer', id: msg.id, v: 0 }); }
      if (msg.end) endScript();
    }
  } finally { sc.running = false; }
}
const objR = (i) => (i === -1 ? null : ow.objs[i]);
async function moveAlong(target, steps) {
  for (const st of steps) {
    if (st.k === 'sleep') { await G.wait(st.n); continue; }
    if (st.k === 'hide') { const r = objR(target); if (r) r.visible = false; continue; }
    if (st.k === 'show') { const r = objR(target); if (r) r.visible = true; continue; }
    const [dx, dy] = DIRS[st.d] || [0, 0];
    if (target === -1) {
      ow.dir = st.d;
      if (st.k === 'turn') { await G.wait(4); continue; }
      const len = st.k === 'jump' ? 2 : 1;
      ow.anim = { dx, dy, len, t: 0, frames: st.k === 'jump' ? 24 : Math.round(16 / (st.sp || 1)), jump: st.k === 'jump', script: true };
      while (ow.anim) await G.frame();
      continue;
    }
    const r = objR(target);
    if (!r) continue;
    r.dir = st.d;
    if (st.k === 'turn') { await G.wait(4); continue; }
    const len = st.k === 'jump' ? 2 : 1;
    for (let k = 0; k < len; k++) {
      r.x += dx; r.y += dy; r.parity = !r.parity;
      r.anim = { dx, dy, t: 0, frames: Math.round(16 / (st.sp || 1)) };
      while (r.anim) await G.frame();
    }
  }
}
async function playScript(msg) {
  const out = msg.out || [];
  // 예/아니오 질문은 마지막 대사를 띄운 채로 묻는다
  let ask = null;
  if (msg.wait === 'yn') { const last = out[out.length - 1]; if (last && last.text) { ask = last.text; out.pop(); } }
  for (const x of out) {
    if (x.text) await G.say(x.text);
    else if (x.face !== undefined) { const r = objR(x.face); if (r) r.dir = OPP[ow.dir]; }
    else if (x.turn !== undefined) { if (x.turn === -1) ow.dir = x.dir; else { const r = objR(x.turn); if (r) r.dir = x.dir; } }
    else if (x.move !== undefined) await moveAlong(x.move, x.steps || []);
    else if (x.hide !== undefined) { const r = objR(x.hide); if (r) r.visible = false; }
    else if (x.show !== undefined) { const r = objR(x.show); if (r) { r.visible = true; r.o && (r.dir = r.dir || 'down'); } }
    else if (x.mvobj !== undefined) { const r = objR(x.mvobj); if (r) { r.x = x.x; r.y = x.y; r.home = { x: x.x, y: x.y }; } }
    else if (x.emote !== undefined) {
      const r = objR(x.emote);
      ow.emote = r ? { x: r.x, y: r.y } : { x: ow.x, y: ow.y };
      G.sfx('select'); await G.wait(30); ow.emote = null;
    }
    else if (x.pic !== undefined) {
      G.showMonPreview = x.pic;
      for (let k = 0; k < 300; k++) { await G.frame(); if (k > 10 && (G.input.pressed.a || G.input.pressed.b)) break; }
    }
    else if (x.closepic) G.showMonPreview = null;
    else if (x.pause) await G.wait(Math.min(120, x.pause));
    else if (x.heal) { G.sfx('heal'); await G.fadeOut(); await G.wait(30); await G.fadeIn(); }
    else if (x.nurse) await G.nurse();
    else if (x.pc) G.openPC();
    else if (x.mart) G.net.send({ t: 'mart', mart: x.mart });
    else if (x.std) { if (STD[x.std]) await G.say(STD[x.std]); }
    else if (x.sfx) G.sfx(x.sfx === 'item' ? 'level' : x.sfx);
    else if (x.shake) { G.sfx('hit'); await G.wait(20); }
    else if (x.warp) await G.teleport(x.warp.map, x.warp.x, x.warp.y, ow.dir, true);
  }
  if (msg.wait === 'yn') {
    const v = await G.yesno(ask);
    G.showMonPreview = null;
    G.net.send({ t: 'scriptAnswer', id: msg.id, v: v ? 1 : 0 });
  } else if (msg.wait === 'battle') {
    G.net.send({ t: 'scriptAnswer', id: msg.id, v: 1 });
    G.waitingBattle = 90;
  }
}

G.nurse = async function nurse() {
  await G.say([['포켓몬센터에 어서 오세요!'], ['이곳에서는 포켓몬의 체력을', '회복시켜 드립니다.']]);
  if (!await G.yesno('포켓몬을 맡기시겠습니까?')) { await G.say('또 이용해 주세요!'); return; }
  await G.say([['그럼 잠시 맡겨 주세요!']], { auto: 30 });
  G.net.send({ t: 'heal' });
  G.sfx('heal');
  await G.wait(60);
  await G.say([['오래 기다리셨습니다!'], ['맡기신 포켓몬은', '모두 건강해졌습니다!'], ['또 이용해 주세요!']]);
};

// ───────── 다른 사람 위치 ─────────
G.setOthers = function setOthers(list, myId) {
  const seen = new Set();
  for (const p of list) {
    if (p.id === myId) continue;
    seen.add(p.id);
    const o = ow.others.get(p.id) || {};
    Object.assign(o, p);
    ow.others.set(p.id, o);
  }
  for (const id of [...ow.others.keys()]) if (!seen.has(id)) ow.others.delete(id);
};
G.moveOther = function moveOther(p, step) {
  const o = ow.others.get(p.id) || {};
  if (step) o.parity = !o.parity;
  Object.assign(o, p);
  ow.others.set(p.id, o);
};
})();
