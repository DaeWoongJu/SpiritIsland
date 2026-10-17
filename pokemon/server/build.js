'use strict';
// 포켓몬 골드 원본 자료 변환기
// pret/pokegold 디스어셈블리(공개 저장소)를 처음 한 번 내려받아 맵·타일·스프라이트·포켓몬·기술·트레이너 자료를
// 게임이 쓰는 world.json 으로 바꾼다. 그림 파일(png)은 내려받은 폴더에서 그대로 브라우저로 보낸다.
// 닌텐도 자료는 저장소에 넣지 않고, 실행하는 컴퓨터의 pokemon/cache/ 에만 저장된다.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');
const scripts = require('./scripts');

const CACHE_DIR = process.env.POKEMON_CACHE || path.join(__dirname, '..', 'cache');
const SRC_DIR = process.env.POKEGOLD_DIR || path.join(CACHE_DIR, 'pokegold');
const WORLD_FILE = path.join(CACHE_DIR, 'world.json');
const COMMIT = 'ef0201d8daf47e8b3ea1518eacf890f37d4cd5e8';
const TARBALL = `https://codeload.github.com/pret/pokegold/tar.gz/${COMMIT}`;
const BUILD_VERSION = 15; // 변환 방식이 바뀌면 올려서 다시 변환

// ───────────── 내려받기 + 압축 풀기 ─────────────
function download(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'pokemon-gold-online' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(download(new URL(res.headers.location, url).href, redirects - 1));
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`다운로드 실패 (${res.statusCode}) ${url}`)); return; }
      const chunks = [];
      let got = 0;
      res.on('data', (c) => {
        chunks.push(c); got += c.length;
        if (process.stdout.isTTY) process.stdout.write(`\r  내려받는 중... ${(got / 1048576).toFixed(1)}MB`);
      });
      res.on('end', () => { if (process.stdout.isTTY) process.stdout.write('\n'); resolve(Buffer.concat(chunks)); });
      res.on('error', reject);
    }).on('error', reject);
  });
}

/** tar(.gz) 풀기: 필요한 폴더만 */
function untar(buf, dest, keep) {
  let off = 0;
  let longName = null;
  let paxPath = null;
  const str = (b) => b.toString('utf8').replace(/\0.*$/s, '');
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((x) => x === 0)) break;
    let name = str(h.subarray(0, 100));
    const prefix = str(h.subarray(345, 500));
    if (prefix) name = prefix + '/' + name;
    const size = parseInt(str(h.subarray(124, 136)).trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    const body = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') { longName = str(body); continue; }
    if (type === 'x') { const m = body.toString('utf8').match(/\d+ path=([^\n]*)\n/); paxPath = m ? m[1] : null; continue; }
    if (type === 'g') continue;
    if (longName) { name = longName; longName = null; }
    if (paxPath) { name = paxPath; paxPath = null; }
    const rel = name.split('/').slice(1).join('/'); // 맨 앞 폴더(pokegold-<sha>) 빼기
    if (!rel || !keep(rel)) continue;
    const out = path.join(dest, rel);
    if (!out.startsWith(dest)) continue;
    if (type === '5') { fs.mkdirSync(out, { recursive: true }); continue; }
    if (type !== '0' && type !== '\0' && type !== '7') continue;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, body);
  }
}

async function ensureSource(log) {
  if (fs.existsSync(path.join(SRC_DIR, 'maps', 'NewBarkTown.asm'))) return;
  log('포켓몬 골드 원본 자료(pret/pokegold)를 처음 한 번 내려받습니다. (몇 MB, 인터넷 필요)');
  const gz = await download(TARBALL);
  const tar = zlib.gunzipSync(gz);
  const tmp = SRC_DIR + '.tmp';
  fs.rmSync(tmp, { recursive: true, force: true });
  untar(tar, tmp, (rel) => /^(constants|data|maps|gfx|engine\/events)\//.test(rel));
  fs.rmSync(SRC_DIR, { recursive: true, force: true });
  fs.renameSync(tmp, SRC_DIR);
}

// ───────────── asm 읽기 도우미 ─────────────
const read = (rel) => fs.readFileSync(path.join(SRC_DIR, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(SRC_DIR, rel));
const lines = (rel) => read(rel).split(/\r?\n/).map((l) => l.replace(/;.*$/, '').replace(/\s+$/, ''));
const args = (s) => s.split(',').map((x) => x.trim()).filter((x) => x !== '');

/** 상수 표: 이름 → 숫자 */
const K = Object.create(null);
function num(expr) {
  if (expr == null) return NaN;
  let e = String(expr).trim();
  if (e in K) return K[e];
  if (/^-?\d+$/.test(e)) return Number(e);
  e = e.replace(/\$([0-9a-fA-F]+)/g, (_, h) => String(parseInt(h, 16)))
    .replace(/%([01]+)/g, (_, b) => String(parseInt(b, 2)))
    .replace(/\bpercent\b/g, '* 255 / 100')
    .replace(/[A-Za-z_][A-Za-z0-9_]*/g, (n) => (n in K ? String(K[n]) : 'NaN'));
  if (!/^[\d\s+\-*/()<>|&.NaN]*$/.test(e)) return NaN;
  try { return Math.floor(Function(`return (${e})`)()); } catch { return NaN; }
}

/** const_def / const / DEF EQU 형식의 상수 파일 읽기 */
function loadConsts(rel, special) {
  let v = 0, step = 1;
  const order = [];
  for (const l of lines(rel)) {
    const t = l.trim();
    let m;
    if (special && special(t)) continue;
    if ((m = t.match(/^const_def\s*(.*)$/))) { const a = args(m[1]); v = a[0] !== undefined ? num(a[0]) : 0; step = a[1] !== undefined ? num(a[1]) : 1; continue; }
    if ((m = t.match(/^const\s+(\w+)/))) { K[m[1]] = v; order.push([m[1], v]); v += step; continue; }
    if ((m = t.match(/^const_skip\s*(.*)$/))) { v += (m[1] ? num(m[1]) : 1) * step; continue; }
    if ((m = t.match(/^const_next\s+(.*)$/))) { v = num(m[1]); continue; }
    if ((m = t.match(/^DEF\s+(\w+)\s+EQU\s+(.+)$/))) { if (m[2].trim() === 'const_value') K[m[1]] = v; else { const n = num(m[2]); if (!Number.isNaN(n)) K[m[1]] = n; } continue; }
    if ((m = t.match(/^DEF\s+(\w+)\s*=\s*(.+)$/))) { const n = num(m[2]); if (!Number.isNaN(n)) K[m[1]] = n; }
  }
  return order;
}

/** 라벨별로 줄 묶기 (지역 라벨 .Foo 는 앞 전역 라벨에 붙임) */
function splitLabels(ls) {
  const out = new Map();
  let cur = null, global = null;
  for (const raw of ls) {
    const m = raw.match(/^(\.?[A-Za-z_][\w.]*)::?\s*(.*)$/);
    if (m && !/^\s/.test(raw)) {
      const name = m[1].startsWith('.') ? (global || '') + m[1] : m[1];
      if (!m[1].startsWith('.')) global = m[1];
      const prev = cur;
      cur = { name, lines: [] };
      if (prev) prev.next = name;
      out.set(name, cur);
      if (m[2]) cur.lines.push(m[2].trim());
      continue;
    }
    if (cur && raw.trim()) cur.lines.push(raw.trim());
  }
  return out;
}

// ───────────── 글 (대사) ─────────────
const TEXTS = new Map(); // label → [[줄...], ...] (문단)
function cleanStr(s) {
  return s.replace(/<PLAYER>/g, '{PLAYER}').replace(/<RIVAL>/g, '{RIVAL}').replace(/<PKMN>|<PK><MN>/g, 'POKéMON')
    .replace(/<……>|<⋯>/g, '……').replace(/<PO><KE>/g, 'POKé').replace(/<BSP>/g, ' ').replace(/<USER>|<TARGET>|<ENEMY>/g, '')
    .replace(/<[A-Z_]+>/g, '').replace(/#/g, 'POKé').replace(/@/g, '');
}
function parseTextBlocks(ls) {
  const labels = splitLabels(ls);
  for (const [name, b] of labels) {
    const paras = [];
    let para = null, ok = false, far = null;
    for (const l of b.lines) {
      let m;
      if ((m = l.match(/^(text|line|cont|para|page|next)\s+"(.*)"$/))) {
        ok = true;
        const s = cleanStr(m[2]);
        if (m[1] === 'text' && para && para.length) { para[para.length - 1] += s; continue; }
        if (m[1] === 'text' || m[1] === 'para' || m[1] === 'page' || !para) { para = [s]; paras.push(para); } else para.push(s);
      } else if ((m = l.match(/^text_far\s+(\w+)/))) { far = m[1]; ok = true; }
      else if (/^text_ram|^text_decimal/.test(l)) { ok = true; if (para) para[para.length - 1] += '…'; }
      else if (/^(text_start|text_end|done|prompt|text_promptbutton|text_waitbutton|sound_\w+|text_pause|text_linkwaitbutton)\b/.test(l)) { ok = true; }
      else if (ok) break;
    }
    if (far) TEXTS.set(name, { far });
    else if (ok && paras.length) TEXTS.set(name, paras.map((p) => p.filter((x) => x !== '' || p.length === 1)));
  }
}
function getText(label) {
  let t = TEXTS.get(label);
  for (let i = 0; t && t.far && i < 4; i++) t = TEXTS.get(t.far);
  return Array.isArray(t) ? t : null;
}

// ───────────── 본 변환 ─────────────
function build(log = console.log) {
  for (const k of Object.keys(K)) delete K[k];
  TEXTS.clear();
  // 상수
  loadConsts('constants/pokemon_constants.asm');
  loadConsts('constants/move_constants.asm');
  loadConsts('constants/type_constants.asm');
  // 아이템 상수 (add_tm/add_hm 도 아이템 번호를 이어서 차지함)
  {
    let v = 0;
    const tmOrder = [];
    for (const l of lines('constants/item_constants.asm')) {
      const t = l.trim(); let m;
      if (/^const_def/.test(t)) v = 0;
      else if ((m = t.match(/^const\s+(\w+)/))) { K[m[1]] = v++; }
      else if ((m = t.match(/^const_skip/))) v++;
      else if ((m = t.match(/^add_(tm|hm)\s+(\w+)/))) { const name = (m[1] === 'tm' ? 'TM_' : 'HM_') + m[2]; K[name] = v++; tmOrder.push([name, m[2]]); }
    }
    K.__tmOrder = tmOrder;
  }
  loadConsts('constants/sprite_constants.asm');
  loadConsts('constants/sprite_data_constants.asm');
  loadConsts('constants/landmark_constants.asm');
  loadConsts('constants/tileset_constants.asm');
  loadConsts('constants/collision_constants.asm');
  loadConsts('constants/map_object_constants.asm');
  loadConsts('constants/mart_constants.asm');
  loadConsts('constants/map_data_constants.asm');
  if (exists('constants/fruit_tree_constants.asm')) loadConsts('constants/fruit_tree_constants.asm');
  // 트레이너: trainerclass 마다 const_def 1
  const trainerClasses = [];
  {
    let cls = -1, v = 1;
    for (const l of lines('constants/trainer_constants.asm')) {
      const t = l.trim(); let m;
      if ((m = t.match(/^trainerclass\s+(\w+)/))) { cls++; K[m[1]] = cls; trainerClasses.push({ id: m[1], members: [] }); v = 1; }
      else if (cls >= 0 && (m = t.match(/^const\s+(\w+)/))) { trainerClasses[cls].members.push(m[1]); K['TR_' + m[1]] = v++; }
    }
  }
  // 맵 상수: newgroup / map_const
  const mapConsts = {};
  {
    let group = 0, n = 0;
    for (const l of lines('constants/map_constants.asm')) {
      const t = l.trim(); let m;
      if ((m = t.match(/^newgroup\s+(\w+)/))) { group++; n = 0; }
      else if ((m = t.match(/^map_const\s+(\w+)\s*,\s*(\d+)\s*,\s*(\d+)/))) { n++; mapConsts[m[1]] = { group, num: n, w: +m[2], h: +m[3] }; }
    }
  }

  // ── 글 모으기
  for (const f of fs.readdirSync(path.join(SRC_DIR, 'data', 'text'))) if (f.endsWith('.asm')) parseTextBlocks(lines('data/text/' + f));
  if (exists('engine/events/std_scripts.asm')) parseTextBlocks(lines('engine/events/std_scripts.asm'));

  // ── 타일셋
  const tilesetNames = []; // index → TilesetJohto
  for (const l of lines('data/tilesets.asm')) { const m = l.match(/^\s*tileset\s+(\w+)/); if (m) tilesetNames.push(m[1]); }
  const gfxLabels = {}; // label → file
  {
    let pending = [];
    for (const l of lines('gfx/tilesets.asm')) {
      const m = l.match(/^(\w+)::?/); if (m) { pending.push(m[1]); continue; }
      const inc = l.match(/INCBIN\s+"([^"]+)"/);
      if (inc) { for (const p of pending) gfxLabels[p] = inc[1]; pending = []; }
      else if (/^\s*INCLUDE\s+"([^"]+)"/.test(l)) { const f = l.match(/"([^"]+)"/)[1]; for (const p of pending) gfxLabels[p] = f; pending = []; }
    }
  }
  const palMapLabels = {};
  {
    let pending = [];
    for (const l of lines('gfx/tileset_palette_maps.asm')) {
      const m = l.match(/^(\w+)::?/); if (m) { pending.push(m[1]); continue; }
      const inc = l.match(/INCLUDE\s+"([^"]+)"/);
      if (inc) { for (const p of pending) palMapLabels[p] = inc[1]; pending = []; }
    }
  }
  const PALNAMES = ['GRAY', 'RED', 'GREEN', 'WATER', 'YELLOW', 'BROWN', 'ROOF', 'TEXT'];
  const COLL = {}; for (const [k, v] of Object.entries(K)) if (k.startsWith('COLL_')) COLL[k.slice(5)] = v;
  const tilesets = tilesetNames.map((name, idx) => {
    const g = gfxLabels[name + 'GFX'], meta = gfxLabels[name + 'Meta'], coll = gfxLabels[name + 'Coll'];
    const png = g ? g.replace(/\.2bpp(\.lz)?$/, '.png') : null;
    const metaBuf = meta && exists(meta) ? fs.readFileSync(path.join(SRC_DIR, meta)) : Buffer.alloc(0);
    const collision = [];
    if (coll && exists(coll)) for (const l of lines(coll)) {
      const m = l.match(/^\s*tilecoll\s+(.+)$/);
      if (m) collision.push(args(m[1]).map((c) => (c in COLL ? COLL[c] : (num('$' + c) || 0))));
    }
    const palMap = [];
    const pm = palMapLabels[name + 'PalMap'];
    if (pm && exists(pm)) for (const l of lines(pm)) {
      const m = l.match(/^\s*tilepal\s+\d+\s*,\s*(.+)$/);
      if (m) for (const p of args(m[1])) palMap.push(Math.max(0, PALNAMES.indexOf(p)));
    }
    return { name, idx, png: png && exists(png) ? png : null, meta: [...metaBuf], collision, palMap };
  });

  // ── 색 (팔레트)
  const rgbList = (rel) => {
    const out = [];
    for (const l of read(rel).split('\n')) {
      const m = l.match(/^\s*RGB\s+(.+?)\s*(;.*)?$/);
      if (!m) continue;
      const nums = args(m[1].replace(/;.*/, '')).map(Number);
      for (let i = 0; i + 2 < nums.length; i += 3) out.push([nums[i], nums[i + 1], nums[i + 2]]);
    }
    return out.map(([r, g, b]) => [r * 255 / 31 | 0, g * 255 / 31 | 0, b * 255 / 31 | 0]);
  };
  const bgPal = rgbList('gfx/tilesets/bg_tiles.pal'); // 42 palettes × 4
  const objPal = rgbList('gfx/overworld/npc_sprites.pal'); // 4 times × 8 × 4
  const roofPal = rgbList('gfx/tilesets/roofs.pal'); // groups × 4 (낮 2, 밤 2)
  const envColors = {};
  {
    let cur = null;
    for (const l of lines('data/maps/environment_colors.asm')) {
      const m = l.match(/^\.(\w+):/); if (m) { cur = m[1]; envColors[cur] = []; continue; }
      const d = l.match(/^\s*db\s+(.+)$/); if (d && cur) envColors[cur].push(args(d[1]).map((x) => num(x)));
    }
  }
  const roofs = [];
  for (const l of lines('data/maps/roofs.asm')) { const m = l.match(/^\s*db\s+(-1|ROOF_\w+)\s*$/); if (m) roofs.push(m[1] === '-1' ? -1 : K[m[1]]); }
  const roofFiles = [];
  for (const l of lines('data/maps/roofs.asm')) { const m = l.match(/INCBIN\s+"([^"]+)"/); if (m) roofFiles.push(m[1].replace('.2bpp', '.png')); }

  // ── 맵
  const maps = {};
  const nameToConst = {};
  {
    let cur = null;
    for (const l of lines('data/maps/attributes.asm')) {
      let m;
      if ((m = l.match(/^\s*map_attributes\s+(\w+)\s*,\s*(\w+)\s*,\s*(\S+)/))) {
        const mc = mapConsts[m[2]];
        if (!mc) { cur = null; continue; }
        cur = maps[m[2]] = { id: m[2], name: m[1], w: mc.w, h: mc.h, group: mc.group, border: num(m[3]), conn: {} };
        nameToConst[m[1]] = m[2];
      } else if (cur && (m = l.match(/^\s*connection\s+(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*,\s*(.+)$/))) {
        const a = args(m[4]);
        const off = a.length === 3 ? num(a[0]) - num(a[1]) : num(a[0]);
        cur.conn[m[1]] = { map: m[3], off };
      }
    }
  }
  for (const l of lines('data/maps/maps.asm')) {
    const mm = l.match(/^\s*map\s+(.+)$/);
    if (!mm) continue;
    const m = [null, ...args(mm[1])];
    if (m.length < 9) continue;
    const mp = maps[nameToConst[m[1]]];
    if (!mp) continue;
    mp.tileset = K[m[2]];
    mp.env = m[3];
    mp.landmark = m[4].replace(/^LANDMARK_/, '');
    mp.music = m[5];
    mp.palette = m[7].replace(/^PALETTE_/, '');
    mp.fishgroup = m[8].replace(/^FISHGROUP_/, '');
  }
  {
    let pending = [];
    for (const l of lines('data/maps/blocks.asm')) {
      const m = l.match(/^(\w+)_Blocks::?/); if (m) { pending.push(m[1]); continue; }
      const inc = l.match(/INCBIN\s+"([^"]+)"/);
      if (inc) {
        const buf = exists(inc[1]) ? fs.readFileSync(path.join(SRC_DIR, inc[1])) : null;
        for (const p of pending) { const mp = maps[nameToConst[p]]; if (mp && buf) mp.blocks = [...buf.subarray(0, mp.w * mp.h)]; }
        pending = [];
      }
    }
  }

  // ── 아이템
  const itemNames = [];
  for (const l of lines('data/items/names.asm')) { const m = l.match(/^\s*li\s+"(.*)"/); if (m) itemNames.push(cleanStr(m[1])); }
  const items = {};
  {
    const ids = Object.entries(K).filter(([k, v]) => v > 0 && v < 256 && !k.startsWith('__') && itemNames[v - 1] !== undefined);
    // 아이템 상수만 고르기: item_constants 에서 읽은 순서를 다시 사용
    let v = 0;
    for (const l of lines('constants/item_constants.asm')) {
      const t = l.trim(); let m;
      if (/^const_def/.test(t)) v = 0;
      else if ((m = t.match(/^const\s+(\w+)/))) { if (v > 0) items[m[1]] = { id: v, const: m[1], name: itemNames[v - 1] || m[1] }; v++; }
      else if (/^const_skip/.test(t)) v++;
      else if ((m = t.match(/^add_(tm|hm)\s+(\w+)/))) { const c = (m[1] === 'tm' ? 'TM_' : 'HM_') + m[2]; items[c] = { id: v, const: c, name: itemNames[v - 1] || c, move: m[2] }; v++; }
    }
    let i = 0;
    const byId = Object.values(items).sort((a, b) => a.id - b.id);
    for (const l of lines('data/items/attributes.asm')) {
      const m = l.match(/^\s*item_attribute\s+(.+)$/);
      if (!m) continue;
      const a = args(m[1]);
      const it = byId.find((x) => x.id === i + 1);
      i++;
      if (!it) continue;
      it.price = num(a[0]) || 0; it.held = a[1]; it.heldParam = num(a[2]) || 0; it.pocket = a[4]; it.field = a[5]; it.battle = a[6];
    }
  }
  let tmNum = 0, hmNum = 0;
  for (const [c] of K.__tmOrder) {
    const it = items[c]; if (!it) continue;
    if (c.startsWith('TM_')) { it.tm = ++tmNum; it.name = 'TM' + String(tmNum).padStart(2, '0'); } else { it.hm = ++hmNum; it.name = 'HM' + String(hmNum).padStart(2, '0'); }
  }
  for (const l of lines('data/items/heal_hp.asm')) { const m = l.match(/^\s*dbw\s+(\w+)\s*,\s*(\w+)/); if (m && items[m[1]]) items[m[1]].healHP = m[2] === 'MAX_STAT_VALUE' ? 999 : num(m[2]); }
  for (const l of lines('data/items/heal_status.asm')) {
    const m = l.match(/^\s*db\s+(\w+)\s*,\s*\w+\s*,\s*(.+)$/);
    if (!m || !items[m[1]]) continue;
    const s = m[2];
    items[m[1]].healStatus = /%11111111/.test(s) ? 'ALL' : (s.match(/PSN|BRN|FRZ|SLP|PAR/) || ['ALL'])[0];
  }
  const marts = {};
  {
    const labels = splitLabels(lines('data/items/marts.asm'));
    const order = [];
    for (const l of lines('data/items/marts.asm')) { const m = l.match(/^\s*dw\s+(Mart\w+)/); if (m) order.push(m[1]); }
    const martConsts = Object.entries(K).filter(([k]) => k.startsWith('MART_')).sort((a, b) => a[1] - b[1]);
    for (const [c, v] of martConsts) {
      const lab = labels.get(order[v]);
      if (!lab) continue;
      marts[c] = lab.lines.map((l) => (l.match(/^db\s+(\w+)$/) || [])[1]).filter((x) => x && items[x]);
    }
  }
  const fruitTrees = [];
  for (const l of lines('data/items/fruit_trees.asm')) { const m = l.match(/^\s*db\s+(\w+)\s*;\s*(\w+)?/); if (m && items[m[1]]) fruitTrees.push(m[1]); }
  // 원본 주석은 지워졌으므로 순서로 FRUITTREE_* 연결
  const fruitConsts = Object.entries(K).filter(([k]) => k.startsWith('FRUITTREE_') && k !== 'FRUITTREE_EMPTY').sort((a, b) => a[1] - b[1]);
  const fruitTreeItems = {};
  fruitConsts.forEach(([c, v]) => { if (fruitTrees[v - 1]) fruitTreeItems[c] = fruitTrees[v - 1]; });

  // ── 포켓몬
  const speciesOrder = Object.entries(K).filter(([k, v]) => v >= 1 && v <= 251 && /^[A-Z][A-Z0-9_]*$/.test(k)).filter(([k]) => exists('data/pokemon/base_stats/' + k.toLowerCase() + '.asm') || exists('data/pokemon/base_stats/' + k.toLowerCase().replace(/__/g, '_') + '.asm'));
  const bsFiles = {};
  for (const l of lines('data/pokemon/base_stats.asm')) { const m = l.match(/INCLUDE\s+"(data\/pokemon\/base_stats\/[^"]+)"/); if (m) bsFiles[Object.keys(bsFiles).length + 1] = m[1]; }
  const species = {};
  const speciesConst = {};
  for (let id = 1; id <= 251; id++) {
    const f = bsFiles[id];
    if (!f) continue;
    const ls = lines(f);
    const s = { id };
    let dbn = 0;
    for (const l of ls) {
      let m;
      if ((m = l.match(/^\s*db\s+(\w+)\s*$/)) && dbn === 0) { s.const = m[1]; dbn++; continue; }
      if ((m = l.match(/^\s*db\s+(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/))) { s.base = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number); continue; }
      if (s.base && !s.types && (m = l.match(/^\s*db\s+(\w+)\s*,\s*(\w+)\s*$/))) { s.types = [m[1], m[2]]; continue; }
      if (s.types && s.catchRate === undefined && (m = l.match(/^\s*db\s+(\d+)\s*$/))) { s.catchRate = +m[1]; continue; }
      if (s.catchRate !== undefined && s.baseExp === undefined && (m = l.match(/^\s*db\s+(\d+)\s*$/))) { s.baseExp = +m[1]; continue; }
      if ((m = l.match(/^\s*db\s+(\w+)\s*,\s*(\w+)\s*$/)) && s.baseExp !== undefined && !s.items) { s.items = [m[1], m[2]].filter((x) => x !== 'NO_ITEM'); continue; }
      if ((m = l.match(/^\s*db\s+(GENDER_\w+)/))) { s.gender = m[1].replace('GENDER_', ''); continue; }
      if ((m = l.match(/^\s*db\s+(\d+)\s*;\s*$/)) && s.gender && s.hatch === undefined) { continue; }
      if ((m = l.match(/^\s*db\s+(GROWTH_\w+)/))) { s.growth = m[1].replace('GROWTH_', ''); continue; }
      if ((m = l.match(/^\s*tmhm\s*(.*)$/))) { s.tmhm = args(m[1]); continue; }
      if ((m = l.match(/^\s*dn\s+(EGG_\w+)\s*,\s*(EGG_\w+)/))) { s.egg = [m[1], m[2]]; }
    }
    if (!s.const) continue;
    // 그림 폴더
    let dir = s.const.toLowerCase();
    if (s.const === 'UNOWN') dir = 'unown_a';
    if (!exists(`gfx/pokemon/${dir}/back.png`)) {
      const alt = fs.readdirSync(path.join(SRC_DIR, 'gfx', 'pokemon')).find((d) => d.replace(/_/g, '') === dir.replace(/_/g, ''));
      if (alt) dir = alt;
    }
    s.front = `gfx/pokemon/${dir}/front_gold.png`;
    if (!exists(s.front)) s.front = `gfx/pokemon/${dir}/front.png`;
    s.back = `gfx/pokemon/${dir}/back.png`;
    if (s.types && s.types[0] === s.types[1]) s.types = [s.types[0]];
    species[id] = s;
    speciesConst[s.const] = id;
  }
  void speciesOrder;
  // 진화 + 기술 배우기
  {
    const order = [];
    for (const l of lines('data/pokemon/evos_attacks_pointers.asm')) { const m = l.match(/^\s*dw\s+(\w+)/); if (m) order.push(m[1]); }
    const labels = splitLabels(lines('data/pokemon/evos_attacks.asm'));
    order.forEach((lab, i) => {
      const s = species[i + 1];
      const b = labels.get(lab);
      if (!s || !b) return;
      s.evos = []; s.learnset = [];
      let phase = 0;
      for (const l of b.lines) {
        const m = l.match(/^db\s+(.+)$/);
        if (!m) continue;
        const a = args(m[1]);
        if (a.length === 1 && a[0] === '0') { phase++; if (phase >= 2) break; continue; }
        if (phase === 0) {
          const kind = a[0].replace('EVOLVE_', '');
          if (kind === 'STAT') s.evos.push({ kind, level: num(a[1]), stat: a[2], into: speciesConst[a[3]] || K[a[3]] });
          else s.evos.push({ kind, param: kind === 'LEVEL' ? num(a[1]) : a[1], into: speciesConst[a[2]] || K[a[2]] });
        } else s.learnset.push([num(a[0]), a[1]]);
      }
    });
  }
  // 메뉴 아이콘
  {
    let i = 1;
    for (const l of lines('data/pokemon/menu_icons.asm')) {
      const m = l.match(/^\s*db\s+ICON_(\w+)/);
      if (!m) continue;
      const s = species[i++];
      if (!s) continue;
      const f = `gfx/icons/${m[1].toLowerCase()}.png`;
      s.icon = exists(f) ? f : null;
    }
  }

  // ── 기술
  const moves = {};
  {
    let id = 1;
    for (const l of lines('data/moves/moves.asm')) {
      const m = l.match(/^\s*move\s+(.+)$/);
      if (!m) continue;
      const a = args(m[1]);
      moves[a[0]] = { id: id++, const: a[0], effect: a[1].replace('EFFECT_', ''), power: num(a[2]), type: a[3], acc: num(a[4]), pp: num(a[5]), chance: num(a[6]) };
    }
    const names = [];
    for (const l of lines('data/moves/names.asm')) { const mm = l.match(/^\s*li\s+"(.*)"/); if (mm) names.push(cleanStr(mm[1])); }
    for (const mv of Object.values(moves)) mv.en = names[mv.id - 1] || mv.const;
  }
  // ── 타입 상성
  const types = Object.entries(K).filter(([k]) => /^(NORMAL|FIGHTING|FLYING|POISON|GROUND|ROCK|BIRD|BUG|GHOST|STEEL|CURSE_TYPE|FIRE|WATER|GRASS|ELECTRIC|PSYCHIC_TYPE|ICE|DRAGON|DARK)$/.test(k)).map(([k]) => k);
  const matchups = [];
  {
    let foresight = false;
    for (const l of lines('data/types/type_matchups.asm')) {
      if (/^\s*db\s+-2/.test(l)) { foresight = true; continue; }
      const m = l.match(/^\s*db\s+(\w+)\s*,\s*(\w+)\s*,\s*(\w+)/);
      if (m) matchups.push([m[1], m[2], m[3] === 'SUPER_EFFECTIVE' ? 2 : m[3] === 'NOT_VERY_EFFECTIVE' ? 0.5 : m[3] === 'NO_EFFECT' ? 0 : 1, foresight ? 1 : 0]);
    }
  }

  // ── 트레이너
  const trainerAttrs = [];
  {
    let cur = null;
    for (const l of lines('data/trainers/attributes.asm')) {
      let m;
      if ((m = l.match(/^\s*db\s+(\w+)\s*,\s*(\w+)\s*$/)) && !cur) { cur = { items: [m[1], m[2]].filter((x) => x !== 'NO_ITEM') }; continue; }
      if (cur && (m = l.match(/^\s*db\s+(\d+)\s*$/))) { cur.reward = +m[1]; trainerAttrs.push(cur); cur = null; }
    }
  }
  const classNames = [];
  for (const l of lines('data/trainers/class_names.asm')) { const m = l.match(/^\s*li\s+"(.*)"/); if (m) classNames.push(cleanStr(m[1])); }
  const picFiles = {};
  {
    for (const f of ['gfx/pics.asm', 'gfx/pics_gold.asm']) if (exists(f)) {
      let pending = [];
      for (const l of lines(f)) {
        const m = l.match(/^(\w+)::?/); if (m) pending.push(m[1]);
        const inc = l.match(/INCBIN\s+"([^"]+)"/);
        if (inc) { for (const p of pending) picFiles[p] = inc[1].replace(/\.2bpp(\.lz)?$/, '.png'); pending = []; }
      }
    }
  }
  const trainerPics = [];
  for (const l of lines('data/trainers/pic_pointers.asm')) { const m = l.match(/^\s*dba_pic\s+(\w+)/); if (m) trainerPics.push(picFiles[m[1]] || null); }
  const trainers = {};
  {
    const groupOrder = [];
    for (const l of lines('data/trainers/party_pointers.asm')) { const m = l.match(/^\s*dw\s+(\w+)/); if (m) groupOrder.push(m[1]); }
    const groups = splitLabels(lines('data/trainers/parties.asm'));
    groupOrder.forEach((g, ci) => {
      const cls = trainerClasses[ci + 1] || trainerClasses[ci];
      const clsIdx = K[cls.id];
      const b = groups.get(g);
      if (!b) return;
      let cur = null, idx = 0;
      for (const l of b.lines) {
        let m;
        if ((m = l.match(/^db\s+"(.*)"\s*,\s*(TRAINERTYPE_\w+)/))) {
          idx++;
          const key = cls.id + ':' + (cls.members[idx - 1] || idx);
          cur = trainers[key] = { cls: cls.id, clsIdx, name: cleanStr(m[1]), kind: m[2].replace('TRAINERTYPE_', ''), party: [] };
          continue;
        }
        if (!cur) continue;
        if (/^db\s+-1/.test(l)) { cur = null; continue; }
        if ((m = l.match(/^db\s+(.+)$/))) {
          const a = args(m[1]);
          const p = { level: num(a[0]), species: speciesConst[a[1]] };
          let k = 2;
          if (cur.kind === 'ITEM' || cur.kind === 'ITEM_MOVES') { if (a[k] !== 'NO_ITEM') p.item = a[k]; k++; }
          if (cur.kind === 'MOVES' || cur.kind === 'ITEM_MOVES') p.moves = a.slice(k, k + 4).filter((x) => x !== 'NO_MOVE');
          if (p.species) cur.party.push(p);
        }
      }
    });
  }
  const trainerClassInfo = trainerClasses.map((c, i) => ({ id: c.id, name: classNames[i - 1] || c.id, reward: (trainerAttrs[i - 1] || {}).reward || 10, pic: trainerPics[i - 1] || null }));

  // ── 야생
  const wild = { grass: {}, water: {} };
  for (const f of ['data/wild/johto_grass.asm', 'data/wild/kanto_grass.asm']) {
    let cur = null;
    for (const l of lines(f)) {
      let m;
      if ((m = l.match(/^\s*def_grass_wildmons\s+(\w+)/))) { cur = { map: m[1], rates: null, slots: [] }; continue; }
      if (!cur) continue;
      if (/end_grass_wildmons/.test(l)) { const s = cur.slots; wild.grass[cur.map] = { rates: cur.rates, morn: s.slice(0, 7), day: s.slice(7, 14), nite: s.slice(14, 21) }; cur = null; continue; }
      if ((m = l.match(/^\s*db\s+(\d+)\s*percent\s*,\s*(\d+)\s*percent\s*,\s*(\d+)\s*percent/))) { cur.rates = [+m[1], +m[2], +m[3]]; continue; }
      if ((m = l.match(/^\s*db\s+(\d+)\s*,\s*(\w+)/))) cur.slots.push([+m[1], speciesConst[m[2]]]);
    }
  }
  for (const f of ['data/wild/johto_water.asm', 'data/wild/kanto_water.asm']) {
    let cur = null;
    for (const l of lines(f)) {
      let m;
      if ((m = l.match(/^\s*def_water_wildmons\s+(\w+)/))) { cur = { map: m[1], rate: 0, slots: [] }; continue; }
      if (!cur) continue;
      if (/end_water_wildmons/.test(l)) { wild.water[cur.map] = { rate: cur.rate, slots: cur.slots }; cur = null; continue; }
      if ((m = l.match(/^\s*db\s+(\d+)\s*percent\s*$/))) { cur.rate = +m[1]; continue; }
      if ((m = l.match(/^\s*db\s+(\d+)\s*,\s*(\w+)/))) cur.slots.push([+m[1], speciesConst[m[2]]]);
    }
  }
  const fish = { groups: {}, time: [] };
  {
    const ls = lines('data/wild/fish.asm');
    const groupNames = [];
    for (const l of ls) { const m = l.match(/^\s*fishgroup\s+[^,]+,\s*\.(\w+)_Old/); if (m) groupNames.push(m[1]); }
    const fg = Object.entries(K).filter(([k]) => k.startsWith('FISHGROUP_') && k !== 'FISHGROUP_NONE').sort((a, b) => a[1] - b[1]);
    const labels = splitLabels(ls.map((l) => l.replace(/^(\.\w+):/, 'FishGroups$1:')));
    fg.forEach(([c, v]) => {
      const g = groupNames[v - 1];
      if (!g) return;
      const rod = (r) => ((labels.get(`FishGroups.${g}_${r}`) || {}).lines || []).map((l) => {
        const m = l.match(/^db\s+(\d+)\s*percent\s*(\+\s*1)?\s*,\s*(.+)$/);
        if (!m) return null;
        const chance = Math.round(+m[1] * 255 / 100) + (m[2] ? 1 : 0);
        const tg = m[3].match(/time_group\s+(\d+)/);
        if (tg) return [chance, 'T', +tg[1]];
        const a = args(m[3]);
        return [chance, speciesConst[a[0]], num(a[1])];
      }).filter(Boolean);
      fish.groups[c.replace('FISHGROUP_', '')] = { old: rod('Old'), good: rod('Good'), super: rod('Super') };
    });
    let inTime = false;
    for (const l of ls) {
      if (/^TimeFishGroups/.test(l)) { inTime = true; continue; }
      if (!inTime) continue;
      const m = l.match(/^\s*db\s+(\w+)\s*,\s*(\d+)\s*,\s*(\w+)\s*,\s*(\d+)/);
      if (m) fish.time.push([[speciesConst[m[1]], +m[2]], [speciesConst[m[3]], +m[4]]]);
    }
  }
  // 박치기 나무
  const treemons = {};
  if (exists('data/wild/treemons.asm') && exists('data/wild/treemon_maps.asm')) {
    const tl = lines('data/wild/treemons.asm');
    const setNames = [];
    for (const l of tl) { const m = l.match(/^\s*dw\s+TreeMonSet_(\w+)/); if (m) setNames.push(m[1]); }
    const labels = splitLabels(tl);
    const sets = {};
    for (const [name, b] of labels) {
      const m = name.match(/^TreeMonSet_(\w+)$/);
      if (!m) continue;
      const out = []; let cur = [];
      for (const l of b.lines) {
        if (/^db\s+-1/.test(l)) { out.push(cur); cur = []; continue; }
        const d = l.match(/^db\s+(\d+)\s*,\s*(\w+)\s*,\s*(\d+)/);
        if (d) cur.push([+d[1], speciesConst[d[2]], +d[3]]);
      }
      sets[m[1].toUpperCase()] = out;
    }
    for (const l of lines('data/wild/treemon_maps.asm')) {
      const m = l.match(/^\s*treemon_map\s+(\w+)\s*,\s*TREEMON_SET_(\w+)/);
      if (m && sets[m[2]]) treemons[m[1]] = sets[m[2]];
    }
  }

  // ── 맵 이벤트 + 스크립트
  const spriteFiles = {};
  {
    for (const l of lines('gfx/sprites.asm')) { const m = l.match(/^(\w+)::?\s*INCBIN\s+"([^"]+)"/); if (m) spriteFiles[m[1]] = m[2].replace('.2bpp', '.png'); }
  }
  const sprites = {};
  {
    let i = 1;
    for (const l of lines('data/sprites/sprites.asm')) {
      const m = l.match(/^\s*overworld_sprite\s+(\w+)\s*,\s*(\d+)\s*,\s*(\w+)\s*,\s*(\w+)/);
      if (!m) continue;
      sprites[i] = { file: spriteFiles[m[1]] || null, kind: m[3], pal: K[m[4]] || 0 };
      i++;
    }
    // 포켓몬 모양 스프라이트 → 메뉴 아이콘
    let j = K.SPRITE_POKEMON || 0x80;
    for (const l of lines('data/sprites/sprite_mons.asm')) {
      const m = l.match(/^\s*db\s+(\w+)/);
      if (!m || !speciesConst[m[1]]) continue;
      const s = species[speciesConst[m[1]]];
      sprites[j++] = { file: s.icon, kind: 'ICON', pal: K.PAL_OW_RED || 0, mon: s.id };
    }
  }
  // 처음부터 켜져 있는 이벤트 (숨겨진 사람/물건)
  const initialEvents = [];
  if (exists('engine/events/std_scripts.asm')) {
    let on = false;
    for (const l of lines('engine/events/std_scripts.asm')) {
      if (/^InitializeEventsScript:/.test(l)) { on = true; continue; }
      if (!on) continue;
      if (/^\S/.test(l) && l.trim()) break;
      const m = l.match(/^\s*setevent\s+(\w+)/);
      if (m) initialEvents.push(m[1]);
    }
  }
  const variableSprites = {};
  if (exists('engine/events/std_scripts.asm')) for (const l of lines('engine/events/std_scripts.asm')) {
    const m = l.match(/^\s*variablesprite\s+(\w+)\s*,\s*(\w+)/);
    if (m && K[m[1]] !== undefined && variableSprites[K[m[1]]] === undefined) variableSprites[K[m[1]]] = K[m[2]];
  }
  const badgeHMs = {};
  const mapEvents = {};
  const scriptFiles = [];
  for (const l of lines('data/maps/scripts.asm')) { const m = l.match(/INCLUDE\s+"(maps\/[^"]+)"/); if (m) scriptFiles.push(m[1]); }
  const fileOfMap = {};
  for (const f of scriptFiles) fileOfMap[path.basename(f, '.asm')] = f;
  for (const mp of Object.values(maps)) {
    const f = fileOfMap[mp.name];
    if (!f || !exists(f)) continue;
    const ls = lines(f);
    parseTextBlocks(ls);
    mapEvents[mp.id] = { ls, labels: splitLabels(ls) };
  }
  const summarize = (labels, name, depth = 0) => {
    const b = labels.get(name);
    if (!b || depth > 3) return null;
    const out = {};
    const firstText = (ls) => { for (const l of ls) { const m = l.match(/^(?:writetext|jumptext|jumptextfaceplayer|farwritetext|farjumptext)\s+(\w+)/); if (m) { const t = getText(m[1]); if (t) return t; } } return null; };
    const ls = [...b.lines];
    // 지역 라벨도 붙이기 + 끝나지 않고 다음 라벨로 이어지는 경우 따라가기
    let last = b;
    for (const [k, v] of labels) if (k.startsWith(name + '.')) { ls.push(...v.lines); last = v; }
    const END = /^(end|return|endcallback|jumptext\w*|jumpstd|sjump|farjumptext|jumptextfaceplayer|endifjustbattled|pokemart|itemball|fruittree|hiddenitem)\b/;
    for (let i = 0; i < 2 && last.next && !(last.lines.length && END.test(last.lines[last.lines.length - 1])); i++) {
      last = labels.get(last.next);
      if (!last) break;
      ls.push(...last.lines);
    }
    for (const l of ls) {
      let m;
      if (!out.trainer && (m = l.match(/^trainer\s+(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)/))) {
        out.trainer = `${m[1]}:${m[2]}`; out.beatFlag = m[3]; out.seen = getText(m[4]); out.beaten = getText(m[5]);
      } else if (!out.trainer && (m = l.match(/^loadtrainer\s+(\w+)\s*,\s*(\w+)/))) {
        out.trainer = `${m[1]}:${m[2]}`; out.leader = true;
      } else if (!out.wild && (m = l.match(/^loadwildmon\s+(\w+)\s*,\s*(\d+)/)) && !ls.some((x) => /^catchtutorial/.test(x))) {
        out.wild = { species: speciesConst[m[1]], level: +m[2] };
      } else if (!out.gift && (m = l.match(/^givepoke\s+(\w+)\s*,\s*(\d+)(?:\s*,\s*(\w+))?/))) {
        out.gift = { species: speciesConst[m[1]], level: +m[2], item: m[3] && m[3] !== 'NO_ITEM' ? m[3] : undefined };
      } else if (!out.gift && (m = l.match(/^giveegg\s+(\w+)\s*,\s*(\d+)/))) {
        out.gift = { species: speciesConst[m[1]], level: +m[2], egg: true };
      } else if (!out.itemball && (m = l.match(/^itemball\s+(\w+)(?:\s*,\s*(\d+))?/))) {
        out.itemball = { item: m[1], qty: m[2] ? +m[2] : 1 };
      } else if (!out.hidden && (m = l.match(/^hiddenitem\s+(\w+)\s*,\s*(\w+)/))) {
        out.hidden = { item: m[1], flag: m[2] };
      } else if (!out.mart && (m = l.match(/^pokemart\s+\w+\s*,\s*(\w+)/))) {
        out.mart = m[1];
      } else if (!out.fruit && (m = l.match(/^fruittree\s+(\w+)/))) {
        out.fruit = fruitTreeItems[m[1]] || 'BERRY';
      } else if ((m = l.match(/^jumpstd\s+(\w+)/))) {
        const std = m[1].replace(/Script$/, '');
        if (!out.std) out.std = std;
      } else if ((m = l.match(/^setflag\s+ENGINE_(\w+BADGE)/))) {
        out.badge = m[1];
      } else if ((m = l.match(/^(?:verbosegiveitem|giveitem)\s+(\w+)/))) {
        (out.gives ||= []).push(m[1]);
      } else if ((m = l.match(/^(?:sjump|scall)\s+(\w+)/)) && depth < 2 && !m[1].startsWith('.')) {
        const sub = summarize(labels, m[1], depth + 1);
        if (sub) for (const [k, v] of Object.entries(sub)) if (out[k] === undefined) out[k] = v;
      }
    }
    if (out.trainer && !out.leader) {
      const after = labels.get(name + '.Script') || labels.get(name + '.AfterScript');
      out.after = after ? firstText(after.lines) : null;
    }
    if (out.leader) {
      const before = []; for (const l of b.lines) { if (/^loadtrainer/.test(l)) break; before.push(l); }
      out.seen = firstText(before);
      const wl = b.lines.find((l) => /^winlosstext/.test(l));
      if (wl) out.beaten = getText(args(wl.replace(/^winlosstext\s+/, ''))[0]);
      const done = labels.get(name + '.FightDone') || labels.get(name + '.SpeechAfterTM');
      out.after = done ? firstText(done.lines) : null;
      const afterBattle = []; let seen = false; for (const l of b.lines) { if (seen) afterBattle.push(l); if (/^startbattle/.test(l)) seen = true; }
      out.win = firstText(afterBattle);
      out.sets = afterBattle.map((l) => (l.match(/^setevent\s+(EVENT_\w+)/) || [])[1]).filter(Boolean);
    }
    if (!out.text) out.text = firstText(ls);
    return out;
  };
  const MOVE = (n) => (n || '').replace('SPRITEMOVEDATA_', '');
  /** 라벨과 그 지역 라벨들의 줄 (지역 라벨 이름도 줄로 남겨서 조건 구간을 나눔) */
  const linesWithLocals = (ev, name) => {
    const out = [];
    for (const [k, v] of ev.labels) {
      if (k === name) out.push(...v.lines);
      else if (k.startsWith(name + '.')) { out.push(k.slice(name.length)); out.push(...v.lines); }
    }
    return out;
  };
  // 장면 번호표 (scene_script 순서대로 0, 1, 2 …)
  const sceneTable = {};
  for (const ev of Object.values(mapEvents)) {
    let n = 0;
    for (const l of ev.ls) {
      const m = l.match(/^\s*(scene_script\s+\w+\s*,|scene_const)\s*(SCENE_\w+)/);
      if (m) sceneTable[m[2]] = n++;
    }
  }
  for (const f of ['constants/script_constants.asm', 'constants/ram_constants.asm', 'constants/battle_constants.asm']) if (exists(f)) loadConsts(f);
  const scriptEnv = { args, num, getText, speciesConst, sceneVal: (n) => (n in sceneTable ? sceneTable[n] : (num(n) || 0)) };
  for (const mp of Object.values(maps)) {
    const ev = mapEvents[mp.id];
    mp.warps = []; mp.signs = []; mp.objects = []; mp.coords = [];
    if (!ev) continue;
    const sc = scripts.compile(ev.ls, scriptEnv);
    mp.script = { ops: sc.ops, moves: sc.moves, objConsts: sc.objConsts, scenes: sc.scenes, callbacks: sc.callbacks };
    mp.coordEvents = sc.coords;
    const pcOf = (label) => (label && sc.at[label] !== undefined ? sc.at[label] : -1);
    // 맵에 들어올 때 블록 바꾸기 (예: 사천왕 방 문은 이기면 열림)
    mp.tileChanges = [];
    for (const l of ev.ls) {
      const cb = l.match(/^\s*callback\s+MAPCALLBACK_TILES\s*,\s*(\w+)/);
      if (!cb) continue;
      const lab = ev.labels.get(cb[1]);
      if (!lab) continue;
      let flag = null, need = true;
      const jumps = {}; // .라벨 → 그 라벨로 뛰어갈 때의 조건
      for (const line of linesWithLocals(ev, cb[1])) {
        let m;
        if ((m = line.match(/^checkevent\s+(EVENT_\w+)/))) { flag = m[1]; continue; }
        if ((m = line.match(/^iffalse\s+(\.\w+)/))) { if (flag) jumps[m[1]] = { flag, need: false }; need = true; continue; }
        if ((m = line.match(/^iftrue\s+(\.\w+)/))) { if (flag) jumps[m[1]] = { flag, need: true }; need = false; continue; }
        if (/^\./.test(line)) { const j = jumps[line]; flag = j ? j.flag : null; need = j ? j.need : true; continue; }
        if ((m = line.match(/^changeblock\s+(\d+)\s*,\s*(\d+)\s*,\s*(\$?\w+)/)) && flag) mp.tileChanges.push({ flag, need, x: +m[1], y: +m[2], b: num(m[3]) });
      }
    }
    for (const l of ev.ls) {
      let m;
      if ((m = l.match(/^\s*warp_event\s+(.+)$/))) {
        const a = args(m[1]);
        mp.warps.push({ x: num(a[0]), y: num(a[1]), to: a[2], idx: num(a[3]) });
      } else if ((m = l.match(/^\s*bg_event\s+(.+)$/))) {
        const a = args(m[1]);
        const s = summarize(ev.labels, a[3]) || {};
        const sign = { x: num(a[0]), y: num(a[1]), kind: a[2].replace('BGEVENT_', '') };
        if (s.hidden) sign.hidden = s.hidden;
        if (s.std) sign.std = s.std;
        if (s.text) sign.text = s.text;
        sign.pc = pcOf(a[3]);
        mp.signs.push(sign);
      } else if ((m = l.match(/^\s*object_event\s+(.+)$/))) {
        const a = args(m[1]);
        let sprite = K[a[2]];
        if (variableSprites[sprite] !== undefined) sprite = variableSprites[sprite];
        const o = {
          x: num(a[0]), y: num(a[1]), sprite, move: MOVE(a[3]), rx: num(a[4]) || 0, ry: num(a[5]) || 0,
          h1: num(a[6]), h2: a[7] in K ? K[a[7]] : num(a[7]), h2name: a[7], pal: a[8] === '0' ? null : (K[a[8]] ?? null), type: a[9].replace('OBJECTTYPE_', ''),
          sight: num(a[10]) || 0, flag: a[12] && a[12] !== '-1' ? a[12] : null,
        };
        const s = summarize(ev.labels, a[11]) || {};
        Object.assign(o, s);
        if (o.trainer && !trainers[o.trainer]) {
          // CLASS:ID → 상수 이름으로 다시 찾기
          const [c, id] = o.trainer.split(':');
          const alt = Object.keys(trainers).find((k) => k === `${c}:${id}`);
          if (!alt) delete o.trainer;
        }
        if (o.badge && o.gives) badgeHMs[o.badge] = o.gives;
        o.pc = pcOf(a[11]);
        mp.objects.push(o);
      }
    }
    delete mp.coords;
  }
  // 체육관 관장 → 체육관 맵 표시
  for (const k of Object.keys(mapEvents)) delete mapEvents[k];

  // ── 플레이어/전투 그림
  const ui = {
    font: 'gfx/font/font.png',
    playerBack: exists('gfx/player/chris_back.png') ? 'gfx/player/chris_back.png' : null,
    playerFront: picFiles.ChrisPic || (exists('gfx/player/chris.png') ? 'gfx/player/chris.png' : null),
    balls: exists('gfx/battle/balls.png') ? 'gfx/battle/balls.png' : null,
    shadow: exists('gfx/overworld/shadow.png') ? 'gfx/overworld/shadow.png' : null,
    cutTree: exists('gfx/overworld/cut_tree.png') ? 'gfx/overworld/cut_tree.png' : null,
    grass: exists('gfx/overworld/grass_rustle.png') ? 'gfx/overworld/grass_rustle.png' : null,
  };

  // ── 날기 장소 / 나무 자르기·소용돌이 블록
  const spawns = [];
  for (const l of lines('data/maps/spawn_points.asm')) { const m = l.match(/^\s*spawn\s+(\w+)\s*,\s*(\d+)\s*,\s*(\d+)/); if (m) spawns.push({ map: m[1], x: +m[2], y: +m[3] }); }
  const spawnConsts = Object.entries(K).filter(([k]) => k.startsWith('SPAWN_')).sort((a, b) => a[1] - b[1]);
  const spawnByName = {}; for (const [k, v] of spawnConsts) if (spawns[v]) spawnByName[k] = spawns[v];
  const flypoints = [];
  if (exists('data/maps/flypoints.asm')) for (const l of lines('data/maps/flypoints.asm')) {
    const m = l.match(/^\s*db\s+LANDMARK_(\w+)\s*,\s*(SPAWN_\w+)/);
    if (m && spawnByName[m[2]]) flypoints.push({ landmark: m[1], ...spawnByName[m[2]] });
  }
  const fieldBlocks = { cut: {}, whirlpool: {} };
  if (exists('data/collision/field_move_blocks.asm')) {
    const ls = lines('data/collision/field_move_blocks.asm');
    let table = null; const ptr = {}; let cur = null;
    for (const l of ls) {
      let m;
      if (/^CutTreeBlockPointers/.test(l)) { table = 'cut'; continue; }
      if (/^WhirlpoolBlockPointers/.test(l)) { table = 'whirlpool'; continue; }
      if ((m = l.match(/^\s*dbw\s+(TILESET_\w+)\s*,\s*\.(\w+)/))) { (ptr[table + '.' + m[2]] ||= []).push(K[m[1]]); continue; }
      if ((m = l.match(/^\.(\w+):/))) { cur = ptr[table + '.' + m[1]] ? { table, sets: ptr[table + '.' + m[1]] } : null; continue; }
      if (cur && (m = l.match(/^\s*db\s+(\$?\w+)\s*,\s*(\$?\w+)(?:\s*,\s*(\$?\w+))?/))) {
        for (const ts of cur.sets) (fieldBlocks[cur.table][ts] ||= []).push([num(m[1]), num(m[2]), num(m[3] || '0')]);
      }
    }
  }

  // 충돌 종류별 통과 여부: 0 땅, 1 물, 15 벽 (+16 말걸기)
  const collPerm = [];
  for (const l of lines('data/collision/collision_permissions.asm')) {
    const m = l.match(/^\s*db\s+(.+)$/);
    if (!m) continue;
    collPerm.push(m[1].split('|').reduce((a, x) => a | (num(x.trim()) || 0), 0));
  }

  const world = {
    v: BUILD_VERSION, collPerm, coll: COLL, commit: COMMIT,
    tilesets, maps, sprites, roofs, roofFiles,
    palettes: { bg: bgPal, obj: objPal, roof: roofPal, env: envColors },
    species, moves, items, marts, types, matchups,
    trainers, trainerClasses: trainerClassInfo,
    wild, fish, treemons, initialEvents, ui, flypoints, spawn: spawnByName.SPAWN_HOME || spawns[0], fieldBlocks,
  };
  return world;
}

async function ensureWorld({ log = console.log, force = false } = {}) {
  if (!force && fs.existsSync(WORLD_FILE)) {
    try {
      const w = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
      if (w.v === BUILD_VERSION && fs.existsSync(path.join(SRC_DIR, 'gfx'))) return w;
    } catch { /* 다시 만듦 */ }
  }
  await ensureSource(log);
  log('맵과 포켓몬 자료를 변환하는 중...');
  const w = build(log);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(WORLD_FILE, JSON.stringify(w));
  log(`변환 완료: 맵 ${Object.keys(w.maps).length}개, 포켓몬 ${Object.keys(w.species).length}종, 기술 ${Object.keys(w.moves).length}개`);
  return w;
}

module.exports = { ensureWorld, build, SRC_DIR, CACHE_DIR };

if (require.main === module) {
  ensureWorld({ force: process.argv.includes('--force') }).catch((e) => { console.error(e); process.exit(1); });
}
