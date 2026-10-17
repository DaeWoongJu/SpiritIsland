'use strict';
// 하트골드·소울실버(pret/pokeheartgold) 그림을 처음 켤 때 내려받아 쓰기 좋은 PNG로 바꿔 둔다.
//  - 배틀 포켓몬 그림(앞·뒤, 이로치 포함)
//  - 필드 사람 그림(주인공 광·코토네, 관장, 사람들)과 데리고 다니는 포켓몬 그림
// 내려받기에 실패하면 원래 골드 그림으로 그대로 한다.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');

const HG_COMMIT = '708163e10169173d2bbab252538231721d983155';
const HG_RAW = `https://raw.githubusercontent.com/pret/pokeheartgold/${HG_COMMIT}/`;
const VERSION = 1;

// 골드 사람 그림 → 하트골드 필드 모델 번호
const NPC = {
  SPRITE_GAMEBOY_KID: 161, SPRITE_RIVAL: 58, SPRITE_OAK: 160, SPRITE_RED: 170, SPRITE_BLUE: 169, SPRITE_BILL: 181, SPRITE_ELDER: 227,
  SPRITE_JANINE: 166, SPRITE_KURT: 223, SPRITE_MOM: 159, SPRITE_BLAINE: 168, SPRITE_REDS_MOM: 192, SPRITE_DAISY: 191, SPRITE_ELM: 54,
  SPRITE_WILL: 154, SPRITE_FALKNER: 146, SPRITE_WHITNEY: 148, SPRITE_BUGSY: 147, SPRITE_MORTY: 149, SPRITE_CHUCK: 150, SPRITE_JASMINE: 151,
  SPRITE_PRYCE: 152, SPRITE_CLAIR: 153, SPRITE_BROCK: 167, SPRITE_KAREN: 157, SPRITE_BRUNO: 156, SPRITE_MISTY: 164, SPRITE_LANCE: 158,
  SPRITE_SURGE: 162, SPRITE_ERIKA: 165, SPRITE_KOGA: 155, SPRITE_SABRINA: 163,
  SPRITE_COOLTRAINER_M: 122, SPRITE_COOLTRAINER_F: 125, SPRITE_BUG_CATCHER: 116, SPRITE_TWIN: 118, SPRITE_YOUNGSTER: 115, SPRITE_LASS: 119,
  SPRITE_TEACHER: 123, SPRITE_BEAUTY: 124, SPRITE_SUPER_NERD: 2, SPRITE_ROCKER: 120, SPRITE_POKEFAN_M: 126, SPRITE_POKEFAN_F: 127,
  SPRITE_GRAMPS: 128, SPRITE_GRANNY: 129, SPRITE_SWIMMER_GUY: 138, SPRITE_SWIMMER_GIRL: 139, SPRITE_BIG_SNORLAX: 194, SPRITE_SURFING_PIKACHU: 68,
  SPRITE_ROCKET: 174, SPRITE_ROCKET_GIRL: 173, SPRITE_NURSE: 133, SPRITE_LINK_RECEPTIONIST: 134, SPRITE_CLERK: 132, SPRITE_FISHER: 143,
  SPRITE_FISHING_GURU: 42, SPRITE_SCIENTIST: 136, SPRITE_KIMONO_GIRL: 180, SPRITE_SAGE: 172, SPRITE_UNUSED_GUY: 120, SPRITE_GENTLEMAN: 137,
  SPRITE_BLACK_BELT: 140, SPRITE_RECEPTIONIST: 135, SPRITE_OFFICER: 37, SPRITE_CAL: 120, SPRITE_SLOWPOKE: 209, SPRITE_CAPTAIN: 182,
  SPRITE_GYM_GUIDE: 121, SPRITE_SAILOR: 144, SPRITE_BIKER: 179, SPRITE_PHARMACIST: 16, SPRITE_SUDOWOODO: 186, SPRITE_POKE_BALL: 94,
  SPRITE_ROCK: 92, SPRITE_BOULDER: 91, SPRITE_FRUIT_TREE: 251, SPRITE_GOLD_TROPHY: 229, SPRITE_SILVER_TROPHY: 230,
};
const PLAYER = { hero: 69, heroine: 70, bikeHero: 71, bikeHeroine: 72 };
const FOLLOW_BASE = 297; // 데리고 다니는 포켓몬 모델 시작 번호

// ───────── PNG ─────────
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
/** 팔레트 PNG → { w, h, idx(색 번호), pal[[r,g,b]] } */
function decodeIndexedPNG(buf) {
  let p = 8, w = 0, h = 0, depth = 8, type = 3;
  const idat = []; let pal = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), t = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; }
    else if (t === 'PLTE') { pal = []; for (let i = 0; i < d.length; i += 3) pal.push([d[i], d[i + 1], d[i + 2]]); }
    else if (t === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (type !== 3) throw new Error('팔레트 PNG가 아님');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = Math.ceil((w * depth) / 8);
  const out = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i > 0 ? line[i - 1] : 0, b = prev[i], c = i > 0 ? prev[i - 1] : 0;
      if (f === 1) line[i] = (line[i] + a) & 255;
      else if (f === 2) line[i] = (line[i] + b) & 255;
      else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  const idx = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const bit = x * depth, byte = out[y * stride + (bit >> 3)];
    idx[y * w + x] = depth === 8 ? byte : (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  }
  return { w, h, idx, pal };
}

// ───────── NSBTX (필드 모델 그림) ─────────
function readDict(b, off) {
  const n = b[off + 1];
  let p = off + 4 + 8 + 4 * n;
  const unit = b.readUInt16LE(p); p += 4;
  const items = [];
  for (let i = 0; i < n; i++) items.push(b.subarray(p + i * unit, p + (i + 1) * unit));
  p += unit * n;
  return items.map((d, i) => ({ d, name: b.toString('latin1', p + i * 16, p + i * 16 + 16).replace(/\0.*$/, '') }));
}
function parseBTX(b) {
  if (b.toString('latin1', 0, 4) !== 'BTX0') throw new Error('BTX0 아님');
  const t = b.readUInt32LE(0x10);
  const texInfo = t + b.readUInt16LE(t + 0x0E), texData = t + b.readUInt32LE(t + 0x14);
  const palInfo = t + b.readUInt32LE(t + 0x34), palData = t + b.readUInt32LE(t + 0x38);
  const texs = readDict(b, texInfo).map(({ d, name }) => {
    const p = d.readUInt16LE(2);
    return { name, n: +(name.split('.').pop()) || 0, off: texData + (d.readUInt16LE(0) << 3), w: 8 << ((p >> 4) & 7), h: 8 << ((p >> 7) & 7), fmt: (p >> 10) & 7, c0: (p >> 13) & 1 };
  }).sort((a, z) => a.n - z.n);
  const pals = readDict(b, palInfo).map(({ d, name }) => ({ name, off: palData + (d.readUInt16LE(0) << 3) }));
  return { b, texs, pals };
}
function texRGBA(btx, tex, pal) {
  const { b } = btx, { w, h, fmt } = tex, out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let idx, a = 255;
    if (fmt === 3) { idx = (b[tex.off + (i >> 1)] >> ((i & 1) * 4)) & 15; if (idx === 0 && tex.c0) a = 0; }
    else if (fmt === 2) { idx = (b[tex.off + (i >> 2)] >> ((i & 3) * 2)) & 3; if (idx === 0 && tex.c0) a = 0; }
    else if (fmt === 4) { idx = b[tex.off + i]; if (idx === 0 && tex.c0) a = 0; }
    else if (fmt === 1) { const v = b[tex.off + i]; idx = v & 31; a = Math.min(255, (v >> 5) * 37); }
    else if (fmt === 6) { const v = b[tex.off + i]; idx = v & 7; a = ((v >> 3) * 255 / 31) | 0; }
    else return null;
    const c = b.readUInt16LE(pal.off + idx * 2);
    out[i * 4] = ((c & 31) * 255 / 31) | 0; out[i * 4 + 1] = (((c >> 5) & 31) * 255 / 31) | 0; out[i * 4 + 2] = (((c >> 10) & 31) * 255 / 31) | 0; out[i * 4 + 3] = a;
  }
  return out;
}
/** 모델의 모든 그림을 가로로 이어 붙인 띠 (팔레트마다 한 줄) */
function modelSheet(buf, maxFrames = 32) {
  const btx = parseBTX(buf);
  const texs = btx.texs.slice(0, maxFrames);
  const fw = Math.max(...texs.map((t) => t.w)), fh = Math.max(...texs.map((t) => t.h));
  const rows = Math.min(2, btx.pals.length);
  const W = fw * texs.length, H = fh * rows;
  const img = Buffer.alloc(W * H * 4);
  for (let r = 0; r < rows; r++) texs.forEach((t, k) => {
    const px = texRGBA(btx, t, btx.pals[r]);
    if (!px) return;
    for (let y = 0; y < t.h; y++) px.copy(img, ((r * fh + y) * W + k * fw) * 4, y * t.w * 4, (y + 1) * t.w * 4);
  });
  return { png: encodePNG(W, H, img), frames: texs.length, fw, fh, rows };
}

/** 배틀 그림: 위 줄 보통 [앞1, 앞2, 뒤], 아래 줄 이로치 (각 80×80) */
function battleSheet(frontBuf, backBuf) {
  const f = decodeIndexedPNG(frontBuf), bk = decodeIndexedPNG(backBuf);
  const normal = f.pal, shiny = bk.pal; // 뒤 그림의 팔레트가 이로치 색
  const W = 240, H = 160, img = Buffer.alloc(W * H * 4);
  const put = (src, sx, dx, dy, pal) => {
    for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) {
      const i = src.idx[y * src.w + sx + x];
      if (!i) continue;
      const c = pal[i] || [0, 0, 0], o = ((dy + y) * W + dx + x) * 4;
      img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; img[o + 3] = 255;
    }
  };
  for (const [row, pal] of [[0, normal], [1, shiny]]) {
    put(f, 0, 0, row * 80, pal);
    put(f, f.w >= 160 ? 80 : 0, 80, row * 80, pal);
    put(bk, 0, 160, row * 80, pal);
  }
  return encodePNG(W, H, img);
}

// ───────── 내려받기 ─────────
function get(url, tries = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'pokemon-gold-online' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`${res.statusCode} ${url}`)); return; }
      const cs = []; res.on('data', (c) => cs.push(c)); res.on('end', () => resolve(Buffer.concat(cs))); res.on('error', reject);
    }).on('error', reject);
  }).catch((e) => (tries > 1 ? new Promise((r) => setTimeout(r, 800)).then(() => get(url, tries - 1)) : Promise.reject(e)));
}
function fetchSrc(rel) {
  const local = process.env.HGSS_DIR;
  if (local && fs.existsSync(path.join(local, rel))) return Promise.resolve(fs.readFileSync(path.join(local, rel)));
  return get(HG_RAW + rel);
}
async function pool(list, n, fn) {
  let i = 0;
  const run = async () => { while (i < list.length) { const k = i++; await fn(list[k], k); } };
  await Promise.all(Array.from({ length: n }, run));
}

/** 포켓몬 번호 → 데리고 다니는 포켓몬 모델 번호 */
function followerTable(lutSrc, idxSrc) {
  const val = {};
  for (const m of idxSrc.matchAll(/#define\s+(FOLLOWER_MON_\w+)\s+(\d+)/g)) val[m[1]] = +m[2];
  const body = lutSrc.slice(lutSrc.indexOf('sModelIndexLUT[]'));
  const names = [...body.slice(0, body.indexOf('};')).matchAll(/FOLLOWER_MON_\w+/g)].map((m) => m[0]);
  const out = {};
  names.forEach((n, sp) => { if (sp > 0 && sp <= 251 && val[n] !== undefined) out[sp] = FOLLOW_BASE + val[n]; });
  return out;
}

async function ensureHgss({ cacheDir, srcDir, log = console.log }) {
  const dir = path.join(cacheDir, 'hgss');
  const manFile = path.join(dir, 'manifest.json');
  try { const m = JSON.parse(fs.readFileSync(manFile, 'utf8')); if (m.v === VERSION && m.complete) return m; } catch { /* 새로 만듦 */ }
  fs.mkdirSync(path.join(dir, 'mon'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'ow'), { recursive: true });
  log('하트골드·소울실버 그림을 내려받는 중... (처음 한 번만)');
  // 골드 그림 번호
  const spriteNum = {};
  {
    let v = 0;
    for (const l of fs.readFileSync(path.join(srcDir, 'constants/sprite_constants.asm'), 'utf8').split('\n')) {
      const t = l.replace(/;.*/, '').trim();
      if (/^const_def/.test(t)) v = 0;
      const m = t.match(/^const\s+(SPRITE_\w+)/);
      if (m) spriteNum[m[1]] = v++;
    }
  }
  const npc = {};
  for (const [k, v] of Object.entries(NPC)) if (spriteNum[k] !== undefined) npc[spriteNum[k]] = v;
  const follow = followerTable((await fetchSrc('src/follow_mon.c')).toString(), (await fetchSrc('include/constants/follow_mon_idx.h')).toString());
  const models = new Set([...Object.values(npc), ...Object.values(PLAYER), ...Object.values(follow)]);
  const frames = {};
  let fail = 0;
  await pool([...models], 8, async (id) => {
    const out = path.join(dir, 'ow', `${id}.png`);
    try {
      const buf = await fetchSrc(`files/data/mmodel/mmodel/mmodel_${String(id).padStart(8, '0')}.NSBTX`);
      const s = modelSheet(buf, id >= FOLLOW_BASE ? 8 : 32);
      fs.writeFileSync(out, s.png);
      frames[id] = { n: s.frames, w: s.fw, h: s.fh, rows: s.rows };
    } catch { fail++; }
  });
  const mons = Array.from({ length: 251 }, (_, i) => i + 1);
  let done = 0;
  await pool(mons, 8, async (sp) => {
    let ok = false;
    for (const sex of ['male', 'female']) { // 암컷만 있는 포켓몬(니드런♀ 등)
      const d = `files/poketool/pokegra/pokegra/${String(sp).padStart(4, '0')}/${sex}/`;
      try {
        const [f, b] = await Promise.all([fetchSrc(d + 'front.png'), fetchSrc(d + 'back.png')]);
        fs.writeFileSync(path.join(dir, 'mon', `${sp}.png`), battleSheet(f, b));
        ok = true; break;
      } catch { /* 다음 */ }
    }
    if (!ok) fail++;
    if (++done % 50 === 0) log(`  포켓몬 그림 ${done}/251`);
  });
  const man = { v: VERSION, complete: fail === 0, fail, npc, follow, player: PLAYER, frames };
  fs.writeFileSync(manFile, JSON.stringify(man));
  log(fail ? `하트골드 그림 준비 (실패 ${fail}개는 골드 그림으로)` : '하트골드 그림 준비 완료!');
  return man;
}

module.exports = { ensureHgss, decodeIndexedPNG, parseBTX, modelSheet, battleSheet };
