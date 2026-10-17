'use strict';
(() => {
// 그래픽: 원본 png(회색 4단계)를 게임보이 컬러 팔레트로 칠해서 캔버스로 만든다
const G = (window.G = window.G || {});
G.W = null; // world.json
G.SCREEN_W = 160;
G.SCREEN_H = 144;

const imgCache = new Map();
/** 원본 그림 불러오기 → { w, h, gray: Uint8Array(색번호 0~3), rgba } */
G.loadImg = function loadImg(path) {
  if (!path) return Promise.resolve(null);
  if (imgCache.has(path)) return imgCache.get(path);
  const pr = new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, im.width, im.height).data;
      const gray = new Uint8Array(im.width * im.height);
      for (let i = 0; i < gray.length; i++) {
        const v = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
        gray[i] = v >= 213 ? 0 : v >= 128 ? 1 : v >= 43 ? 2 : 3;
      }
      resolve({ w: im.width, h: im.height, gray, rgba: d, el: im });
    };
    im.onerror = () => resolve(null);
    im.src = '/gold/' + path;
  });
  pr.then((v) => { pr.done = v; }); // 동기적으로 꺼내 쓰려고 표시
  imgCache.set(path, pr);
  return pr;
};
/** 이미 불러온 그림 (아직이면 null) */
G.img = function img(path) { const p = imgCache.get(path); return p ? p.done || null : null; };

G.rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** 회색 번호 그림을 팔레트로 칠하기 (transparent0: 0번 색 투명) */
G.colorize = function colorize(im, pal, transparent0 = false, sx = 0, sy = 0, sw = im.w, sh = im.h, flip = false) {
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const x = c.getContext('2d');
  const out = x.createImageData(sw, sh);
  for (let y = 0; y < sh; y++) {
    for (let xx = 0; xx < sw; xx++) {
      const srcX = flip ? sx + sw - 1 - xx : sx + xx;
      const v = im.gray[(sy + y) * im.w + srcX];
      const o = (y * sw + xx) * 4;
      if (transparent0 && v === 0) { out.data[o + 3] = 0; continue; }
      const col = pal[v] || [0, 0, 0];
      out.data[o] = col[0]; out.data[o + 1] = col[1]; out.data[o + 2] = col[2]; out.data[o + 3] = 255;
    }
  }
  x.putImageData(out, 0, 0);
  return c;
};

/** 원래 색 그대로인 그림(포켓몬·트레이너) → 흰 배경 투명 */
const rgbaCache = new Map();
G.picCanvas = function picCanvas(path, { flip = false, transparentWhite = true } = {}) {
  const key = path + (flip ? ':f' : '') + (transparentWhite ? ':t' : '');
  if (rgbaCache.has(key)) return rgbaCache.get(key);
  const im = G.img(path);
  if (!im) { G.loadImg(path); return null; }
  const c = document.createElement('canvas');
  c.width = im.w; c.height = im.h;
  const x = c.getContext('2d');
  const out = x.createImageData(im.w, im.h);
  for (let y = 0; y < im.h; y++) for (let xx = 0; xx < im.w; xx++) {
    const sx = flip ? im.w - 1 - xx : xx;
    const s = (y * im.w + sx) * 4, o = (y * im.w + xx) * 4;
    const r = im.rgba[s], g = im.rgba[s + 1], b = im.rgba[s + 2];
    out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b;
    out.data[o + 3] = transparentWhite && r > 240 && g > 240 && b > 240 ? 0 : 255;
  }
  x.putImageData(out, 0, 0);
  rgbaCache.set(key, c);
  return c;
};

// ───────── 시간대 / 팔레트 ─────────
G.timeOfDay = function timeOfDay() {
  const h = new Date().getHours();
  return h >= 4 && h < 10 ? 0 : h >= 10 && h < 18 ? 1 : 2; // 0 아침 1 낮 2 밤
};
G.todName = () => ['아침', '낮', '밤'][G.timeOfDay()];

const ENV_LIST = { TOWN: 'OutdoorColors', ROUTE: 'OutdoorColors', INDOOR: 'IndoorColors', GATE: 'IndoorColors', CAVE: 'DungeonColors', DUNGEON: 'DungeonColors', ENVIRONMENT_5: 'Env5Colors' };
G.mapTod = function mapTod(map, flash) {
  const t = { AUTO: G.timeOfDay(), MORN: 0, DAY: 1, NITE: 2, DARK: 3 }[map.palette] ?? 1;
  if (t === 3 && flash) return 1;
  return t;
};
G.mapPalettes = function mapPalettes(map, flash) {
  const W = G.W;
  const t = G.mapTod(map, flash);
  const list = W.palettes.env[ENV_LIST[map.env] || 'OutdoorColors'];
  const row = list[t] || list[1];
  const bg = W.palettes.bg;
  const pals = row.map((i) => [bg[i * 4], bg[i * 4 + 1], bg[i * 4 + 2], bg[i * 4 + 3]]);
  if (map.env === 'TOWN' || map.env === 'ROUTE') {
    const rp = W.palettes.roof;
    const base = map.group * 4 + (t >= 2 ? 2 : 0);
    if (rp[base]) pals[6] = [pals[6][0], rp[base], rp[base + 1], pals[6][3]];
  }
  return pals;
};
G.objPalette = function objPalette(pal, t) {
  const o = G.W.palettes.obj;
  const i = ((Math.min(3, t) * 8) + (pal & 7)) * 4;
  return [o[i], o[i + 1], o[i + 2], o[i + 3]];
};

// ───────── 타일셋 → 메타타일(32×32) 그림 ─────────
const tsCache = new Map();
G.metatiles = function metatiles(map, flash) {
  const W = G.W;
  const ts = W.tilesets[map.tileset];
  const t = G.mapTod(map, flash);
  const roof = (map.env === 'TOWN' || map.env === 'ROUTE') && map.tileset <= 3 ? W.roofs[map.group] : -1;
  const key = `${map.tileset}:${map.env}:${t}:${map.group}:${roof}`;
  if (tsCache.has(key)) return tsCache.get(key);
  const im = ts && ts.png ? G.img(ts.png) : null;
  const roofIm = roof >= 0 && W.roofFiles[roof] ? G.img(W.roofFiles[roof]) : null;
  if (!im || (roof >= 0 && W.roofFiles[roof] && !roofIm)) {
    if (ts && ts.png) G.loadImg(ts.png);
    if (roof >= 0 && W.roofFiles[roof]) G.loadImg(W.roofFiles[roof]);
    return null;
  }
  const pals = G.mapPalettes(map, flash);
  const n = ts.meta.length / 16;
  const c = document.createElement('canvas');
  c.width = 16 * 32; c.height = Math.ceil(n / 16) * 32;
  const x = c.getContext('2d');
  const out = x.createImageData(c.width, c.height);
  const tilesPerRow = im.w / 8;
  const nTiles = tilesPerRow * (im.h / 8);
  const roofTiles = roofIm ? (roofIm.w / 8) * (roofIm.h / 8) : 0;
  for (let b = 0; b < n; b++) {
    const bx = (b % 16) * 32, by = Math.floor(b / 16) * 32;
    for (let r = 0; r < 4; r++) for (let cc = 0; cc < 4; cc++) {
      const tile = ts.meta[b * 16 + r * 4 + cc];
      const pal = pals[ts.palMap[tile] ?? 0] || pals[0];
      let src = im, srcTile = tile, srcPerRow = tilesPerRow;
      if (roofIm && tile >= 0x0a && tile < 0x0a + roofTiles) { src = roofIm; srcTile = tile - 0x0a; srcPerRow = roofIm.w / 8; }
      for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) {
        let v = 0;
        if (src === roofIm || tile < nTiles) {
          const tx = (srcTile % srcPerRow) * 8 + px, ty = Math.floor(srcTile / srcPerRow) * 8 + py;
          v = src.gray[ty * src.w + tx];
        }
        const col = tile >= 0x60 && src !== roofIm ? pals[0][0] : pal[v];
        const o = ((by + r * 8 + py) * c.width + bx + cc * 8 + px) * 4;
        out.data[o] = col[0]; out.data[o + 1] = col[1]; out.data[o + 2] = col[2]; out.data[o + 3] = 255;
      }
    }
  }
  x.putImageData(out, 0, 0);
  tsCache.set(key, c);
  return c;
};
G.clearTileCache = () => tsCache.clear();

// ───────── 필드 스프라이트 (16×16 프레임) ─────────
const sprCache = new Map();
/** frame: 0 아래 1 위 2 옆 3 아래걷기 4 위걷기 5 옆걷기 */
G.spriteFrame = function spriteFrame(file, pal, t, frame, flip) {
  const key = `${file}:${pal}:${t}:${frame}:${flip ? 1 : 0}`;
  if (sprCache.has(key)) return sprCache.get(key);
  const im = G.img(file);
  if (!im) { G.loadImg(file); return null; }
  const frames = Math.max(1, Math.floor(im.h / 16));
  const f = Math.min(frame, frames - 1);
  const c = G.colorize(im, G.objPalette(pal, t), true, 0, f * 16, 16, 16, flip);
  sprCache.set(key, c);
  return c;
};
/** 플레이어 모습 색 (빨강/파랑/초록/갈색) */
G.LOOK_PAL = [0, 1, 2, 3];

/** 포켓몬 메뉴 아이콘 (16×16, 2프레임) */
const iconPal = [[255, 255, 255], [224, 152, 120], [128, 64, 48], [16, 16, 16]];
G.icon = function icon(speciesId, frame = 0) {
  const s = G.W.species[speciesId];
  const file = s && s.icon;
  if (!file) return null;
  const key = `icon:${file}:${frame}`;
  if (sprCache.has(key)) return sprCache.get(key);
  const im = G.img(file);
  if (!im) { G.loadImg(file); return null; }
  const c = G.colorize(im, iconPal, true, 0, (frame % Math.max(1, im.h / 16)) * 16, 16, 16);
  sprCache.set(key, c);
  return c;
};

/** 주인공 뒷모습 (배틀) */
G.playerBack = function playerBack(look) {
  const key = `pback:${look}`;
  if (sprCache.has(key)) return sprCache.get(key);
  const im = G.img(G.W.ui.playerBack);
  if (!im) { G.loadImg(G.W.ui.playerBack); return null; }
  const tint = [[248, 248, 248], [248, 176, 128], [[224, 56, 32], [48, 88, 224], [40, 160, 56], [144, 88, 40]][look & 3], [16, 16, 16]];
  const c = G.colorize(im, tint, true);
  sprCache.set(key, c);
  return c;
};

/** 볼(필드에서 던지는 몬스터볼 등) 작은 그림 */
G.drawBall = function drawBall(ctx, x, y, open = false) {
  ctx.fillStyle = '#e83020'; ctx.fillRect(x + 1, y, 6, 3);
  ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 1, y + 4, 6, 3);
  ctx.fillStyle = '#101010'; ctx.fillRect(x, y + 3, 8, 1); ctx.fillRect(x + 3, y + 2, 2, 3);
  if (open) { ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x + 2, y - 2, 4, 2); }
};

// 모든 원본 그림 미리 불러오기 (필요한 것만)
G.preload = function preload(paths) { return Promise.all(paths.filter(Boolean).map((p) => G.loadImg(p))); };
})();
