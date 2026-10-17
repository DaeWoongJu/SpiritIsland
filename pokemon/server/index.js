'use strict';
// 포켓몬스터 골드 온라인 서버: 정적 파일 + 원본 그림 + WebSocket (같은 세계를 여러 명이 함께)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const crypto = require('crypto');
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const { ensureWorld, SRC_DIR } = require('./build');
const dex = require('./dex');
const ko = require('./ko');
const { Battle } = require('./battle');

const PORT = Number(process.env.PORT) || 3600;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SAVE_DIR = process.env.SAVE_DIR ? path.join(process.env.SAVE_DIR, 'pokemon') : path.join(__dirname, '..', '..', 'saves', 'pokemon');
const LOOKS = ['빨강', '파랑', '초록', '갈색'];
const BADGE_HM = { ZEPHYRBADGE: 'HM_FLASH', HIVEBADGE: 'HM_CUT', PLAINBADGE: 'HM_STRENGTH', FOGBADGE: 'HM_SURF', STORMBADGE: 'HM_FLY', GLACIERBADGE: 'HM_WHIRLPOOL', RISINGBADGE: 'HM_WATERFALL' };
const LEADER_BADGE = { FALKNER: 'ZEPHYRBADGE', BUGSY: 'HIVEBADGE', WHITNEY: 'PLAINBADGE', MORTY: 'FOGBADGE', CHUCK: 'STORMBADGE', JASMINE: 'MINERALBADGE', PRYCE: 'GLACIERBADGE', CLAIR: 'RISINGBADGE', BROCK: 'BOULDERBADGE', MISTY: 'CASCADEBADGE', LT_SURGE: 'THUNDERBADGE', ERIKA: 'RAINBOWBADGE', JANINE: 'SOULBADGE', SABRINA: 'MARSHBADGE', BLAINE: 'VOLCANOBADGE', BLUE: 'EARTHBADGE' };
const STARTERS = [152, 155, 158];
// 이야기 장치를 다 만들지 않았으므로 처음부터 켜 두는 이벤트 (검은먹시티 체육관 바위 다리)
const ALWAYS_ON = ['EVENT_BOULDER_IN_BLACKTHORN_GYM_1', 'EVENT_BOULDER_IN_BLACKTHORN_GYM_2', 'EVENT_BOULDER_IN_BLACKTHORN_GYM_3'];

let W = null; // world
let worldGz = null;

// ───────────── HTTP ─────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const GFX_ROOT = path.join(SRC_DIR, 'gfx');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(W ? 'ok' : 'loading'); return; }
  if (url.pathname === '/world.json') {
    if (!W) { res.writeHead(503); res.end('loading'); return; }
    const gz = /gzip/.test(req.headers['accept-encoding'] || '');
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-cache', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
    res.end(gz ? worldGz : JSON.stringify(W));
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p.startsWith('/gold/')) {
    // 원본 그림 (png 만)
    const file = path.normalize(path.join(SRC_DIR, p.slice(6)));
    const real = (() => { try { return fs.realpathSync(file); } catch { return null; } })();
    const root = (() => { try { return fs.realpathSync(GFX_ROOT); } catch { return GFX_ROOT; } })();
    if (!real || !real.startsWith(root) || path.extname(real) !== '.png') { res.writeHead(404); res.end(); return; }
    fs.readFile(real, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=86400' });
      res.end(data);
    });
    return;
  }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ───────────── 저장 ─────────────
function saveFile(id) { return path.join(SAVE_DIR, id + '.json'); }
function nameId(name) { return 'p_' + crypto.createHash('sha1').update(name).digest('hex').slice(0, 16); }
function loadPlayer(name) {
  try { return JSON.parse(fs.readFileSync(saveFile(nameId(name)), 'utf8')); } catch { return null; }
}
function savePlayer(p) {
  if (!p || !p.data) return;
  try {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
    const f = saveFile(p.id);
    fs.writeFileSync(f + '.tmp', JSON.stringify(p.data));
    fs.renameSync(f + '.tmp', f);
  } catch (e) { console.error('[저장 실패]', e.message); }
}
function listSaves() {
  try {
    return fs.readdirSync(SAVE_DIR).filter((f) => f.endsWith('.json')).map((f) => {
      try { const d = JSON.parse(fs.readFileSync(path.join(SAVE_DIR, f), 'utf8')); return { name: d.name, badges: d.badges.length, party: d.party.length, lead: d.party[0] ? d.party[0].species : null, at: d.savedAt || 0 }; } catch { return null; }
    }).filter(Boolean).sort((a, b) => b.at - a.at);
  } catch { return []; }
}

function newPlayerData(name, look) {
  const flags = {};
  for (const e of W.initialEvents) flags[e] = true;
  for (const e of ALWAYS_ON) flags[e] = true;
  return {
    v: 1, name, look: look | 0, map: W.spawn.map, x: W.spawn.x, y: W.spawn.y, dir: 'down', surf: false,
    money: 3000, party: [], box: [], bag: { POTION: 1 }, badges: [], flags, beaten: {}, seen: [], caught: [],
    lastHeal: { map: 'PLAYERS_HOUSE_1F', x: 7, y: 4 }, visited: ['NEW_BARK_TOWN'], repel: 0, created: Date.now(), playMs: 0, fruit: {},
  };
}

// ───────────── 사람들 ─────────────
const players = new Map(); // id → player
const requests = new Map(); // id → { from, to, kind }
const trades = new Map(); // id → trade

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function sendTo(p, msg) { if (p) send(p.ws, msg); }
function online() { return [...players.values()].filter((p) => p.ws && p.ws.readyState === 1); }
function say(p, text, extra = {}) { sendTo(p, { t: 'say', text: Array.isArray(text) ? text : [[text]], ...extra }); }

function publicPlayer(p) {
  const d = p.data;
  return { id: p.id, name: d.name, look: d.look, map: d.map, x: d.x, y: d.y, dir: d.dir, surf: !!d.surf, bike: !!p.bike, battle: !!p.battle, team: p.team || null, lead: d.party[0] ? { species: d.party[0].species, shiny: !!d.party[0].shiny } : null };
}
function broadcastPlayers() {
  const list = online().filter((p) => p.data).map(publicPlayer);
  for (const p of online()) send(p.ws, { t: 'players', list, you: p.id });
}
function sendState(p) {
  if (!p.data) return;
  const d = p.data;
  sendTo(p, {
    t: 'state',
    me: {
      id: p.id, name: d.name, look: d.look, map: d.map, x: d.x, y: d.y, dir: d.dir, surf: !!d.surf, money: d.money,
      party: d.party.map((m) => dex.publicMon(m, true)), box: d.box.map((m) => dex.publicMon(m, false)),
      bag: d.bag, badges: d.badges, flags: d.flags, beaten: d.beaten, seen: d.seen, caught: d.caught, visited: d.visited, repel: d.repel,
      team: p.team || null, playMs: d.playMs + (Date.now() - (p.since || Date.now())), fruit: d.fruit,
    },
  });
}

function addSeen(d, sp) { if (!d.seen.includes(sp)) d.seen.push(sp); }
function addCaught(d, sp) { addSeen(d, sp); if (!d.caught.includes(sp)) d.caught.push(sp); }

/** 가방 */
function bagAdd(d, item, n = 1) { d.bag[item] = Math.min(999, (d.bag[item] || 0) + n); }
function bagUse(d, item, n = 1) { if (!d.bag[item] || d.bag[item] < n) return false; d.bag[item] -= n; if (d.bag[item] <= 0) delete d.bag[item]; return true; }
function bagFor(d) { return { has: (i) => (d.bag[i] || 0) > 0, use: (i) => bagUse(d, i) }; }
function itemKo(c) { return ko.itemName(c, W.items); }

/** 포켓몬 받기: 자리가 없으면 PC 로 */
function receiveMon(p, mon, verb = '받았다') {
  const d = p.data;
  mon.ot = mon.ot || d.name; mon.otId = mon.otId || p.id;
  addCaught(d, mon.species);
  const nm = dex.displayName(mon);
  if (d.party.length < 6) { d.party.push(mon); return [`${d.name}${ko.hasBatchim(d.name) ? '은' : '는'} ${ko.josa(nm, '을/를')} ${verb}!`]; }
  d.box.push(mon);
  return [`${d.name}${ko.hasBatchim(d.name) ? '은' : '는'} ${ko.josa(nm, '을/를')} ${verb}!`, `지닌 포켓몬이 가득이라 ${ko.josa(nm, '은/는')} PC로 보내졌다.`];
}

// ───────────── 맵 도우미 ─────────────
function obj(mapId, idx) { const m = W.maps[mapId]; return m && m.objects[idx]; }
function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function partner(p) {
  if (!p.team) return null;
  const q = players.get(p.team);
  if (!q || !q.data || q.team !== p.id || !q.ws || q.ws.readyState !== 1) return null;
  if (q.battle || q.trade || q.data.map !== p.data.map || q.busy) return null;
  if (!q.data.party.some((m) => m.hp > 0 && !m.egg)) return null;
  return q;
}
function canFight(p) { return p.data.party.some((m) => m.hp > 0 && !m.egg); }

// ───────────── 야생 ─────────────
function rollSlot(slots, probs) {
  const r = crypto.randomInt(100);
  let acc = 0;
  for (let i = 0; i < slots.length; i++) { acc += probs[i]; if (r < acc) return slots[i]; }
  return slots[slots.length - 1];
}
function rollWild(mapId, kind, rod) {
  const t = dex.timeOfDay();
  if (kind === 'grass') {
    const g = W.wild.grass[mapId];
    if (!g) return null;
    const [lv, sp] = rollSlot(g[t], [30, 30, 20, 10, 5, 4, 1]);
    return { species: sp, level: lv };
  }
  if (kind === 'water') {
    const g = W.wild.water[mapId];
    if (!g) return null;
    const [lv, sp] = rollSlot(g.slots, [60, 30, 10]);
    return { species: sp, level: lv };
  }
  if (kind === 'fish') {
    const m = W.maps[mapId];
    const grp = W.fish.groups[m && m.fishgroup];
    if (!grp) return null;
    if (crypto.randomInt(256) >= 128) return null; // 안 걸림
    const table = grp[rod] || grp.old;
    const r = crypto.randomInt(256);
    let e = table.find((x) => r <= x[0]) || table[table.length - 1];
    if (e[1] === 'T') {
      const tg = W.fish.time[e[2]];
      const [sp, lv] = t === 'nite' ? tg[1] : tg[0];
      return { species: sp, level: lv };
    }
    return { species: e[1], level: e[2] };
  }
  if (kind === 'tree') {
    const sets = W.treemons[mapId];
    if (!sets || !sets.length) return null;
    const set = sets[crypto.randomInt(sets.length) === 0 ? Math.min(1, sets.length - 1) : 0];
    const r = crypto.randomInt(100);
    let acc = 0;
    for (const [pct, sp, lv] of set) { acc += pct; if (r < acc) return { species: sp, level: lv }; }
    return set.length ? { species: set[0][1], level: set[0][2] } : null;
  }
  return null;
}

// ───────────── 배틀 시작/끝 ─────────────
function startBattle(opts) {
  const b = new Battle(opts.battle);
  b.meta = opts.meta || {};
  b.humans = opts.humans;
  for (const p of b.humans) { p.battle = b; p.busy = false; }
  b.on('update', (events) => {
    for (const p of b.humans) {
      sendTo(p, { t: 'battle', events, view: b.view(p.id) });
      if (p.data) sendState(p);
    }
    // 연결 끊긴 사람은 대신 고르기
    for (const p of b.humans) if (!p.ws || p.ws.readyState !== 1) setTimeout(() => { if (p.battle === b && !b.result) b.autoAnswer(p.id); }, 800);
    if (b.result && !b.ended) { b.ended = true; setImmediate(() => endBattle(b)); }
  });
  broadcastPlayers();
  b.start();
  return b;
}

function ctrlFor(p, opts = {}) {
  return { id: p.id, human: true, name: p.data.name, party: opts.party || p.data.party, slots: opts.slots || 1, bag: bagFor(p.data) };
}

function wildBattle(p, kind, rod, fixed) {
  if (p.battle || !canFight(p)) return;
  const q = fixed ? null : partner(p);
  const mons = [];
  const first = fixed || rollWild(p.data.map, kind, rod);
  if (!first || !first.species) { if (kind === 'fish') say(p, '…아무것도 걸리지 않았다!'); return; }
  // 벌레퇴치스프레이: 맨 앞 포켓몬보다 레벨이 낮으면 안 나옴
  const lead = p.data.party.find((m) => m.hp > 0 && !m.egg);
  if (!fixed && p.data.repel > 0 && lead && first.level < lead.level) return;
  mons.push(dex.makeMon(first.species, first.level));
  if (q) { const second = rollWild(p.data.map, kind, rod) || first; mons.push(dex.makeMon(second.species, second.level)); }
  for (const m of mons) { addSeen(p.data, m.species); if (q) addSeen(q.data, m.species); }
  const humans = q ? [p, q] : [p];
  const sideA = { name: p.data.name, ctrls: humans.map((h) => Object.assign(ctrlFor(h), { bag: bagFor(h.data) })) };
  for (let i = 0; i < sideA.ctrls.length; i++) sideA.ctrls[i].bag = bagFor(humans[i].data);
  const battle = {
    kind: 'wild',
    sides: [sideA, { name: '야생', ctrls: [{ id: 'wild', ai: 'wild', name: '야생', party: mons, slots: mons.length }] }],
  };
  const b = startBattle({ battle, humans, meta: { fixed, kind } });
  b.fishing = kind === 'fish';
  for (const ctrl of b.sides[0].ctrls) { const h = humans.find((x) => x.id === ctrl.id); ctrl.bag = bagFor(h.data); }
  if (q) say(q, `${ko.josa(p.data.name, '이/가')} 야생 포켓몬을 만났다! 함께 싸우자!`, { toast: true });
}

function trainerBattle(p, mapId, idx) {
  const o = obj(mapId, idx);
  if (!o || !o.trainer || p.battle || !canFight(p)) return;
  const tr = W.trainers[o.trainer];
  if (!tr) return;
  if (p.data.beaten[o.trainer]) return;
  const cls = W.trainerClasses.find((c) => c.id === tr.cls) || {};
  const party = tr.party.map((x) => {
    const m = dex.makeMon(x.species, x.level, { moves: x.moves, item: x.item, dvs: { atk: 9, def: 8, spd: 8, spc: 8 } });
    return m;
  });
  for (const m of party) addSeen(p.data, m.species);
  const q = partner(p);
  const humans = q ? [p, q] : [p];
  if (q) for (const m of party) addSeen(q.data, m.species);
  const title = ko.trainerTitle(tr.cls);
  const name = ko.trainerName(tr.cls, tr.name);
  const battle = {
    kind: 'trainer',
    trainer: { cls: tr.cls, title, name, reward: cls.reward || 10, pic: cls.pic, beaten: o.beaten || null },
    sides: [
      { name: p.data.name, ctrls: humans.map((h) => ctrlFor(h)) },
      { name, ctrls: [{ id: 'trainer', ai: 'trainer', name, party, slots: q && party.length > 1 ? 2 : 1 }] },
    ],
  };
  startBattle({ battle, humans, meta: { trainerKey: o.trainer, map: mapId, idx, leader: !!o.leader, cls: tr.cls, gives: o.gives || [], win: o.win, sets: [o.beatFlag, ...(o.sets || [])].filter(Boolean) } });
  if (q) say(q, `${ko.josa(p.data.name, '이/가')} 트레이너와 승부를 시작했다! 함께 싸우자!`, { toast: true });
}

function pvpBattle(a, b, doubles) {
  const clone = (party) => party.map((m) => { const c = JSON.parse(JSON.stringify(m)); dex.healMon(c); return c; });
  const battle = {
    kind: 'pvp',
    sides: [
      { name: a.data.name, ctrls: [ctrlFor(a, { party: clone(a.data.party), slots: doubles ? 2 : 1 })] },
      { name: b.data.name, ctrls: [ctrlFor(b, { party: clone(b.data.party), slots: doubles ? 2 : 1 })] },
    ],
  };
  for (const m of b.data.party) addSeen(a.data, m.species);
  for (const m of a.data.party) addSeen(b.data, m.species);
  startBattle({ battle, humans: [a, b], meta: { pvp: true } });
}

function blackout(p) {
  const d = p.data;
  const lost = Math.floor(d.money / 2);
  d.money -= lost;
  for (const m of d.party) dex.healMon(m);
  d.map = d.lastHeal.map; d.x = d.lastHeal.x; d.y = d.lastHeal.y; d.dir = 'down'; d.surf = false;
  sendTo(p, { t: 'warp', map: d.map, x: d.x, y: d.y, dir: 'down', fade: true });
  say(p, [[`${d.name}에게는 싸울 수 있는 포켓몬이 없다!`], [`${d.name}${ko.hasBatchim(d.name) ? '은' : '는'} 눈앞이 캄캄해졌다!`], ...(lost ? [[`${lost}원을 잃었다…`]] : [])]);
}

function endBattle(b) {
  const r = b.result;
  for (const p of b.humans) p.battle = null;
  const post = (p) => {
    const list = b.after.get(p.id) || [];
    const items = [];
    for (const a of list) {
      const mon = p.data.party.find((m) => m.uid === a.uid);
      if (!mon) continue;
      if (a.kind === 'learn') items.push({ kind: 'learn', uid: mon.uid, move: a.move });
      if (a.kind === 'evocheck' && mon.hp > 0) { const into = dex.levelEvolution(mon); if (into) items.push({ kind: 'evolve', uid: mon.uid, into }); }
    }
    p.post = items;
    return items;
  };
  if (b.kind === 'pvp') {
    const w = r.winner >= 0 ? b.sides[r.winner].name : null;
    for (const p of b.humans) {
      sendTo(p, { t: 'battleEnd', result: r, text: [[w ? `${w}의 승리!` : '무승부!']] });
      savePlayer(p); sendState(p);
    }
    broadcastPlayers();
    return;
  }
  const meta = b.meta;
  for (const p of b.humans) {
    const d = p.data;
    const text = [];
    const won = r.winner === 0;
    if (r.reason === 'caught' && r.catcher === p.id) {
      const lines = receiveMon(p, r.caught, '잡았다');
      if (lines.length > 1) text.push([lines[1]]);
    }
    if (b.payDay && won) { d.money += b.payDay; text.push([`${d.name}${ko.hasBatchim(d.name) ? '은' : '는'} ${b.payDay}원을 주웠다!`]); }
    if (b.kind === 'trainer' && won) {
      d.beaten[meta.trainerKey] = true;
      for (const f of meta.sets || []) d.flags[f] = true;
      if (meta.win) text.push(...meta.win);
      const prize = b.moneyWon || 0;
      if (prize) { d.money += prize; text.push([`${d.name}${ko.hasBatchim(d.name) ? '은' : '는'} 상금으로`, `${prize}원을 받았다!`]); }
      if (meta.leader && LEADER_BADGE[meta.cls] && !d.badges.includes(LEADER_BADGE[meta.cls])) {
        const badge = LEADER_BADGE[meta.cls];
        d.badges.push(badge);
        text.push([`${d.name}${ko.hasBatchim(d.name) ? '은' : '는'} ${ko.josa(ko.BADGES[badge], '을/를')} 받았다!`]);
        if (BADGE_HM[badge] && !d.bag[BADGE_HM[badge]]) { bagAdd(d, BADGE_HM[badge]); text.push([`${ko.josa(itemKo(BADGE_HM[badge]), '을/를')} 받았다!`, `(${ko.moveName(W.items[BADGE_HM[badge]].move)})`]); }
      }
      for (const g of meta.gives || []) {
        const key = `GIVE:${meta.trainerKey}:${g}`;
        if (d.flags[key] || !W.items[g]) continue;
        d.flags[key] = true; bagAdd(d, g);
        text.push([`${d.name}${ko.hasBatchim(d.name) ? '은' : '는'} ${ko.josa(itemKo(g), '을/를')} 받았다!`]);
      }
    }
    if (meta.fixed && meta.fixed.flagKey && (won || r.reason === 'caught' || r.reason === 'faint' || r.reason === 'draw')) d.flags[meta.fixed.flagKey] = true;
    const lost = !canFight(p);
    // 행복도: 이긴 배틀
    if (won) for (const m of d.party) if (m.hp > 0) m.happiness = Math.min(255, m.happiness + 1);
    const items = lost ? [] : post(p);
    sendTo(p, { t: 'battleEnd', result: r, text, post: items.map((x) => postInfo(p, x)) });
    if (lost) blackout(p);
    savePlayer(p);
    sendState(p);
  }
  broadcastPlayers();
}

function postInfo(p, x) {
  const mon = p.data.party.find((m) => m.uid === x.uid);
  return { ...x, name: mon ? dex.displayName(mon) : '', moveName: x.move ? ko.moveName(x.move) : null, intoName: x.into ? ko.speciesName(x.into) : null, from: mon ? mon.species : null, moves: mon ? mon.moves.map((m) => ko.moveName(m.id)) : [] };
}

// ───────────── 메시지 처리 ─────────────
const handlers = {
  hello(p, msg) {
    const name = String(msg.name || '').trim().slice(0, 10);
    if (!name) return sendTo(p, { t: 'error', text: '이름을 입력하세요.' });
    const id = nameId(name);
    const old = players.get(id);
    if (old && old !== p && old.ws && old.ws.readyState === 1) {
      send(old.ws, { t: 'kicked', text: '다른 창에서 같은 이름으로 접속했습니다.' });
      try { old.ws.close(); } catch { /* 이미 닫힘 */ }
    }
    if (old && old !== p) { p.team = old.team; if (old.battle) { p.battle = old.battle; const i = old.battle.humans.indexOf(old); if (i >= 0) old.battle.humans[i] = p; } }
    p.id = id;
    p.data = old ? old.data : loadPlayer(name);
    const isNew = !p.data;
    if (!p.data) p.data = newPlayerData(name, msg.look);
    for (const e of ALWAYS_ON) p.data.flags[e] = true;
    if (msg.look !== undefined && isNew) p.data.look = Math.max(0, Math.min(3, msg.look | 0));
    p.since = Date.now();
    players.set(id, p);
    sendTo(p, { t: 'welcome', id, isNew, looks: LOOKS });
    sendState(p);
    broadcastPlayers();
    if (p.battle) sendTo(p, { t: 'battle', events: [], view: p.battle.view(p.id) });
    for (const q of online()) if (q !== p) say(q, `${ko.josa(name, '이/가')} 들어왔다!`, { toast: true });
    savePlayer(p);
  },

  move(p, msg) {
    const d = p.data;
    if (!d || p.battle) return;
    const changedMap = d.map !== msg.map;
    if (!W.maps[msg.map]) return;
    d.map = msg.map; d.x = msg.x | 0; d.y = msg.y | 0; d.dir = msg.dir || d.dir; d.surf = !!msg.surf; p.bike = !!msg.bike;
    if (msg.step && d.repel > 0) { d.repel--; if (d.repel === 0) say(p, '벌레퇴치스프레이의 효과가 사라졌다!'); }
    if (msg.step) {
      for (const m of d.party) {
        if (!m.egg) continue;
        m.eggSteps = (m.eggSteps || 0) - 1;
        if (m.eggSteps > 0) continue;
        m.egg = false; m.eggSteps = 0; m.happiness = 120;
        addCaught(d, m.species);
        say(p, [['어라…?'], [`알에서 ${ko.josa(ko.speciesName(m.species), '이/가')} 태어났다!`]]);
        sendState(p);
      }
    }
    if (changedMap) {
      const lm = W.maps[d.map].landmark;
      if (W.flypoints.some((f) => f.landmark === lm) && !d.visited.includes(lm)) d.visited.push(lm);
    }
    p.busy = !!msg.busy;
    const pub = publicPlayer(p);
    for (const q of online()) if (q !== p) send(q.ws, { t: 'pmove', p: pub, step: !!msg.step });
    if (changedMap) { savePlayer(p); }
  },

  busy(p, msg) { p.busy = !!msg.busy; },

  encounter(p, msg) {
    if (!p.data || p.battle) return;
    const kind = ['grass', 'water', 'fish', 'tree'].includes(msg.kind) ? msg.kind : 'grass';
    if (kind === 'fish') { const rod = { OLD_ROD: 'old', GOOD_ROD: 'good', SUPER_ROD: 'super' }[msg.rod]; if (!rod || !p.data.bag[msg.rod]) return; return wildBattle(p, 'fish', rod); }
    wildBattle(p, kind);
  },

  trainer(p, msg) { trainerBattle(p, msg.map, msg.idx | 0); },

  staticMon(p, msg) {
    const o = obj(msg.map, msg.idx | 0);
    if (!o || !o.wild) return;
    const key = o.flag || `STATIC:${msg.map}:${msg.idx}`;
    if (p.data.flags[key]) return;
    wildBattle(p, 'static', null, { species: o.wild.species, level: o.wild.level, flagKey: key });
  },

  act(p, msg) {
    const b = p.battle;
    if (!b) return;
    const err = b.answer(p.id, msg.key, msg.action);
    if (err) sendTo(p, { t: 'battleError', text: err, view: b.view(p.id) });
  },

  forfeit(p) { if (p.battle && p.battle.kind === 'pvp') p.battle.forfeit(p.id); },

  // 배틀 후 기술 배우기 / 진화
  learn(p, msg) {
    const i = (p.post || []).findIndex((x) => x.kind === 'learn' && x.uid === msg.uid && x.move === msg.move);
    if (i < 0) return;
    p.post.splice(i, 1);
    const mon = p.data.party.find((m) => m.uid === msg.uid);
    if (mon && msg.slot >= 0) dex.learnMove(mon, msg.move, msg.slot | 0);
    savePlayer(p); sendState(p);
  },
  evolve(p, msg) {
    const i = (p.post || []).findIndex((x) => x.kind === 'evolve' && x.uid === msg.uid);
    if (i < 0) return;
    const it = p.post.splice(i, 1)[0];
    const mon = p.data.party.find((m) => m.uid === msg.uid);
    if (!mon || !msg.accept) return sendState(p);
    const learn = dex.evolve(mon, it.into);
    addCaught(p.data, it.into);
    const more = [];
    for (const mv of learn) { if (!dex.learnMove(mon, mv)) { const x = { kind: 'learn', uid: mon.uid, move: mv }; p.post.push(x); more.push(postInfo(p, x)); } }
    savePlayer(p); sendState(p);
    if (more.length) sendTo(p, { t: 'post', post: more });
  },

  // 말 걸기 (서버가 정해야 하는 것만)
  heal(p) {
    const d = p.data;
    for (const m of d.party) dex.healMon(m);
    d.lastHeal = { map: d.map, x: d.x, y: d.y };
    savePlayer(p); sendState(p);
  },
  pickup(p, msg) {
    const o = obj(msg.map, msg.idx | 0);
    if (!o || !o.itemball) return;
    const key = o.flag || `ITEM:${msg.map}:${msg.idx}`;
    if (p.data.flags[key]) return;
    p.data.flags[key] = true;
    bagAdd(p.data, o.itemball.item, o.itemball.qty);
    say(p, [[`${p.data.name}${ko.hasBatchim(p.data.name) ? '은' : '는'} ${ko.josa(itemKo(o.itemball.item), '을/를')} 찾았다!`]], { hide: { map: msg.map, idx: msg.idx | 0 } });
    savePlayer(p); sendState(p);
  },
  hidden(p, msg) {
    const m = W.maps[msg.map];
    const s = m && m.signs[msg.idx | 0];
    if (!s || !s.hidden) return;
    const key = s.hidden.flag || `HIDDEN:${msg.map}:${msg.idx}`;
    if (p.data.flags[key]) return;
    p.data.flags[key] = true;
    bagAdd(p.data, s.hidden.item);
    say(p, [[`${p.data.name}${ko.hasBatchim(p.data.name) ? '은' : '는'} ${ko.josa(itemKo(s.hidden.item), '을/를')} 찾았다!`]]);
    savePlayer(p); sendState(p);
  },
  gift(p, msg) {
    const o = obj(msg.map, msg.idx | 0);
    const d = p.data;
    if (!o) return;
    const lines = [];
    if (o.gift) {
      const isStarter = STARTERS.includes(o.gift.species) && msg.map === 'ELMS_LAB';
      const key = isStarter ? 'GOT_STARTER' : (o.flag || `GIFT:${msg.map}:${msg.idx}`);
      if (d.flags[key]) return say(p, isStarter ? '이미 공박사님께 포켓몬을 받았다.' : '…');
      if (d.party.length >= 6 && d.box.length >= 300) return say(p, '더 이상 포켓몬을 받을 수 없다!');
      d.flags[key] = true;
      if (o.flag) d.flags[o.flag] = true;
      const mon = dex.makeMon(o.gift.species, o.gift.level, { item: o.gift.item, ot: d.name, otId: p.id });
      if (o.gift.egg) { mon.egg = true; mon.eggSteps = 600; }
      lines.push(...receiveMon(p, mon));
      if (isStarter) {
        bagAdd(d, 'POKE_BALL', 5);
        lines.push('공박사: 포켓몬 도감과 몬스터볼 5개도 가져가렴!');
        lines.push('야생 포켓몬을 만나면 몬스터볼을 던져서 잡을 수 있단다.');
        lines.push('포켓몬센터에서는 포켓몬을 공짜로 회복시켜 준단다!');
      }
    }
    for (const g of o.gives || []) {
      const key = `GIVE:${msg.map}:${msg.idx}:${g}`;
      if (d.flags[key] || !W.items[g]) continue;
      d.flags[key] = true;
      bagAdd(d, g);
      lines.push(`${d.name}${ko.hasBatchim(d.name) ? '은' : '는'} ${ko.josa(itemKo(g), '을/를')} 받았다!`);
    }
    if (lines.length) say(p, lines.map((l) => [l]));
    savePlayer(p); sendState(p);
  },
  fruit(p, msg) {
    const o = obj(msg.map, msg.idx | 0);
    if (!o || !o.fruit) return;
    const key = `${msg.map}:${msg.idx}`;
    const today = new Date().toDateString();
    if (p.data.fruit[key] === today) return say(p, [['열매가 없다…']]);
    p.data.fruit[key] = today;
    bagAdd(p.data, o.fruit);
    say(p, [['열매가 열리는 나무다.'], [`${ko.josa(itemKo(o.fruit), '을/를')} 손에 넣었다!`]]);
    savePlayer(p); sendState(p);
  },
  mart(p, msg) {
    const list = W.marts[msg.mart];
    if (!list) return;
    sendTo(p, { t: 'mart', items: list.map((c) => ({ id: c, name: itemKo(c), price: W.items[c].price })) });
  },
  buy(p, msg) {
    const it = W.items[msg.item];
    const n = Math.max(1, Math.min(99, msg.qty | 0));
    if (!it || !Object.values(W.marts).some((l) => l.includes(msg.item))) return;
    const cost = it.price * n;
    if (p.data.money < cost) return say(p, '돈이 모자랍니다.');
    p.data.money -= cost;
    bagAdd(p.data, msg.item, n);
    savePlayer(p); sendState(p);
    sendTo(p, { t: 'bought', item: msg.item, qty: n });
  },
  sell(p, msg) {
    const it = W.items[msg.item];
    const n = Math.max(1, Math.min(99, msg.qty | 0));
    if (!it || !it.price || it.pocket === 'KEY_ITEM' || it.hm) return;
    if (!bagUse(p.data, msg.item, n)) return;
    p.data.money += Math.floor(it.price / 2) * n;
    savePlayer(p); sendState(p);
  },

  // 가방 / 포켓몬 정리
  swap(p, msg) {
    const party = p.data.party;
    const a = msg.a | 0, b = msg.b | 0;
    if (!party[a] || !party[b] || p.battle) return;
    [party[a], party[b]] = [party[b], party[a]];
    savePlayer(p); sendState(p); broadcastPlayers();
  },
  toss(p, msg) { const it = W.items[msg.item]; if (!it || it.pocket === 'KEY_ITEM' || it.hm) return; bagUse(p.data, msg.item, Math.max(1, msg.qty | 0)); savePlayer(p); sendState(p); },
  giveItem(p, msg) {
    const mon = p.data.party.find((m) => m.uid === msg.uid);
    const it = W.items[msg.item];
    if (!mon || !it || it.pocket === 'KEY_ITEM' || it.hm || it.tm || !bagUse(p.data, msg.item)) return;
    if (mon.item) bagAdd(p.data, mon.item);
    mon.item = msg.item;
    say(p, `${ko.josa(dex.displayName(mon), '에게')} ${ko.josa(itemKo(msg.item), '을/를')} 지니게 했다.`);
    savePlayer(p); sendState(p);
  },
  takeItem(p, msg) {
    const mon = p.data.party.find((m) => m.uid === msg.uid);
    if (!mon || !mon.item) return;
    bagAdd(p.data, mon.item);
    say(p, `${ko.josa(dex.displayName(mon), '에게서')} ${ko.josa(itemKo(mon.item), '을/를')} 받았다.`);
    mon.item = null;
    savePlayer(p); sendState(p);
  },
  useItem(p, msg) {
    const d = p.data;
    const item = msg.item;
    const it = W.items[item];
    if (!it || !d.bag[item] || p.battle) return;
    const mon = d.party.find((m) => m.uid === msg.uid);
    const name = mon ? dex.displayName(mon) : '';
    const done = (text, consume = true) => { if (consume && !it.hm && it.pocket !== 'KEY_ITEM') bagUse(d, item); savePlayer(p); sendState(p); if (text) say(p, text); };
    if (item === 'REPEL' || item === 'SUPER_REPEL' || item === 'MAX_REPEL') { d.repel = { REPEL: 100, SUPER_REPEL: 200, MAX_REPEL: 250 }[item]; return done('벌레퇴치스프레이를 뿌렸다!'); }
    if (item === 'ESCAPE_ROPE') { d.map = d.lastHeal.map; d.x = d.lastHeal.x; d.y = d.lastHeal.y; sendTo(p, { t: 'warp', map: d.map, x: d.x, y: d.y, dir: 'down', fade: true }); return done('동굴탈출로프를 사용했다!'); }
    if (!mon) return;
    if (it.tm || it.hm) {
      if (!dex.canLearnTM(mon, it.move)) return say(p, `${ko.josa(name, '은/는')} ${ko.josa(ko.moveName(it.move), '을/를')} 배울 수 없다!`);
      if (mon.moves.some((m) => m.id === it.move)) return say(p, `${ko.josa(name, '은/는')} 이미 ${ko.josa(ko.moveName(it.move), '을/를')} 알고 있다!`);
      if (mon.moves.length >= 4 && !(msg.slot >= 0 && msg.slot < 4)) return sendTo(p, { t: 'needSlot', item, uid: mon.uid, move: it.move, moveName: ko.moveName(it.move), moves: mon.moves.map((m) => ko.moveName(m.id)) });
      dex.learnMove(mon, it.move, mon.moves.length >= 4 ? msg.slot | 0 : -1);
      return done(`${ko.josa(name, '은/는')} ${ko.josa(ko.moveName(it.move), '을/를')} 배웠다!`, !!it.tm);
    }
    const evo = dex.itemEvolution(mon, item);
    if (evo) {
      bagUse(d, item);
      const learn = dex.evolve(mon, evo);
      addCaught(d, evo);
      for (const mv of learn) dex.learnMove(mon, mv);
      savePlayer(p); sendState(p);
      return sendTo(p, { t: 'evolved', from: evo, name, into: ko.speciesName(evo) });
    }
    if (item === 'RARE_CANDY') {
      if (mon.level >= 100) return say(p, '효과가 없을 것 같다…');
      const s = W.species[mon.species];
      const res = dex.gainExp(mon, dex.expForLevel(s.growth, mon.level + 1) - mon.exp);
      bagUse(d, item);
      const text = [[`${ko.josa(name, '은/는')} 레벨 ${ko.roNum(mon.level)} 올랐다!`]];
      p.post = p.post || [];
      const post = [];
      for (const mv of res.learn) { if (dex.learnMove(mon, mv)) text.push([`${ko.josa(name, '은/는')} 새로 ${ko.josa(ko.moveName(mv), '을/를')} 배웠다!`]); else { const x = { kind: 'learn', uid: mon.uid, move: mv }; p.post.push(x); post.push(postInfo(p, x)); } }
      const into = dex.levelEvolution(mon);
      if (into) { const x = { kind: 'evolve', uid: mon.uid, into }; p.post.push(x); post.push(postInfo(p, x)); }
      savePlayer(p); sendState(p);
      say(p, text);
      if (post.length) sendTo(p, { t: 'post', post });
      return;
    }
    const VIT = { HP_UP: 0, PROTEIN: 1, IRON: 2, CARBOS: 3, CALCIUM: 4 };
    if (VIT[item] !== undefined) {
      const i = VIT[item];
      if (mon.statExp[i] >= 25600) return say(p, '효과가 없을 것 같다…');
      mon.statExp[i] = Math.min(25600, mon.statExp[i] + 2560);
      dex.refreshStats(mon);
      return done(`${name}의 능력이 올라갔다!`);
    }
    if (item === 'PP_UP') { const m = mon.moves[msg.slot | 0] || mon.moves[0]; const base = W.moves[m.id].pp; if (m.max >= Math.floor(base * 1.6)) return say(p, '효과가 없을 것 같다…'); m.max += Math.floor(base / 5); m.pp += Math.floor(base / 5); return done(`${ko.moveName(m.id)}의 PP가 올라갔다!`); }
    if (mon.egg) return say(p, '효과가 없을 것 같다…');
    if (item === 'REVIVE' || item === 'MAX_REVIVE') {
      if (mon.hp > 0) return say(p, '효과가 없을 것 같다…');
      mon.hp = item === 'MAX_REVIVE' ? mon.stats[0] : Math.floor(mon.stats[0] / 2);
      return done(`${ko.josa(name, '은/는')} 기운을 되찾았다!`);
    }
    if (/ETHER|ELIXER/.test(item)) {
      const full = /MAX/.test(item);
      const ms = /ELIXER/.test(item) ? mon.moves : [mon.moves[msg.slot | 0] || mon.moves.find((m) => m.pp < m.max)].filter(Boolean);
      if (!ms.some((m) => m.pp < m.max)) return say(p, '효과가 없을 것 같다…');
      for (const m of ms) m.pp = full ? m.max : Math.min(m.max, m.pp + 10);
      return done('PP가 회복되었다!');
    }
    let used = false;
    const text = [];
    if (it.healHP && mon.hp > 0 && mon.hp < mon.stats[0]) {
      const before = mon.hp; mon.hp = Math.min(mon.stats[0], mon.hp + it.healHP); used = true;
      text.push([`${name}의 체력이 ${mon.hp - before} 회복되었다!`]);
    }
    if (it.healStatus && mon.status && mon.hp > 0 && (it.healStatus === 'ALL' || it.healStatus === mon.status || (it.healStatus === 'PSN' && mon.status === 'TOX'))) {
      mon.status = null; mon.sleep = 0; used = true; text.push([`${ko.josa(name, '은/는')} 건강해졌다!`]);
    }
    if (!used) return say(p, '효과가 없을 것 같다…');
    if (/BERRY|MILK|WATER|SODA|LEMONADE|POWDER|ROOT|HERB/.test(item)) mon.happiness = Math.max(0, mon.happiness - (/POWDER|ROOT|HERB/.test(item) ? 5 : 0));
    done(text);
  },

  // PC
  deposit(p, msg) {
    const d = p.data;
    const i = d.party.findIndex((m) => m.uid === msg.uid);
    if (i < 0 || d.party.length <= 1) return say(p, '마지막 포켓몬은 맡길 수 없다!');
    if (!d.party.some((m, k) => k !== i && m.hp > 0 && !m.egg)) return say(p, '싸울 수 있는 포켓몬이 없어지면 안 된다!');
    d.box.push(d.party.splice(i, 1)[0]);
    savePlayer(p); sendState(p); broadcastPlayers();
  },
  withdraw(p, msg) {
    const d = p.data;
    const i = d.box.findIndex((m) => m.uid === msg.uid);
    if (i < 0) return;
    if (d.party.length >= 6) return say(p, '지닌 포켓몬이 가득이다!');
    d.party.push(d.box.splice(i, 1)[0]);
    savePlayer(p); sendState(p); broadcastPlayers();
  },
  release(p, msg) {
    const d = p.data;
    const i = d.box.findIndex((m) => m.uid === msg.uid);
    if (i < 0) return;
    const m = d.box.splice(i, 1)[0];
    say(p, `${ko.josa(dex.displayName(m), '을/를')} 놓아주었다. 잘 가!`);
    savePlayer(p); sendState(p);
  },
  nickname(p, msg) {
    const mon = [...p.data.party, ...p.data.box].find((m) => m.uid === msg.uid);
    if (!mon || (mon.otId && mon.otId !== p.id)) return;
    const n = String(msg.nick || '').trim().slice(0, 10);
    if (n) mon.nick = n; else delete mon.nick;
    savePlayer(p); sendState(p);
  },

  // 필드 기술
  fly(p, msg) {
    const d = p.data;
    const f = W.flypoints.find((x) => x.landmark === msg.landmark);
    if (!f || !d.visited.includes(f.landmark)) return;
    if (!d.party.some((m) => m.moves.some((x) => x.id === 'FLY') && m.hp > 0)) return say(p, '공중날기를 쓸 수 있는 포켓몬이 없다!');
    d.map = f.map; d.x = f.x; d.y = f.y; d.surf = false;
    sendTo(p, { t: 'warp', map: f.map, x: f.x, y: f.y, dir: 'down', fade: true });
    savePlayer(p); broadcastPlayers();
  },

  // 다른 사람과
  ask(p, msg) {
    const q = players.get(msg.to);
    if (!q || !q.data || !q.ws || q.ws.readyState !== 1) return say(p, '상대가 없다.');
    if (q.battle || q.trade) return say(p, `${ko.josa(q.data.name, '은/는')} 지금 바쁘다.`);
    const kind = ['battle1', 'battle2', 'trade', 'team', 'unteam'].includes(msg.kind) ? msg.kind : 'battle1';
    if (kind === 'unteam') {
      if (p.team === q.id) { p.team = null; q.team = null; sendState(p); sendState(q); say(p, `${ko.josa(q.data.name, '과/와')} 따로 다니기로 했다.`); say(q, `${ko.josa(p.data.name, '이/가')} 동행을 끝냈다.`); broadcastPlayers(); }
      return;
    }
    if ((kind === 'battle1' || kind === 'battle2') && (!canFight(p) || !canFight(q))) return say(p, '싸울 수 있는 포켓몬이 없다!');
    if (kind === 'battle2' && (p.data.party.filter((m) => m.hp > 0 && !m.egg).length < 2 || q.data.party.filter((m) => m.hp > 0 && !m.egg).length < 2)) return say(p, '더블배틀은 둘 다 포켓몬이 2마리 이상 있어야 한다!');
    const id = crypto.randomBytes(4).toString('hex');
    requests.set(id, { id, from: p.id, to: q.id, kind, at: Date.now() });
    const label = { battle1: '싱글 배틀', battle2: '더블 배틀', trade: '포켓몬 교환', team: '함께 다니기(협동 배틀)' }[kind];
    sendTo(q, { t: 'asked', id, from: p.id, name: p.data.name, kind, label });
    say(p, `${ko.josa(q.data.name, '에게')} ${label} 신청을 보냈다. 대답을 기다리는 중…`, { toast: true });
  },
  answer(p, msg) {
    const r = requests.get(msg.id);
    if (!r || r.to !== p.id) return;
    requests.delete(msg.id);
    const a = players.get(r.from);
    if (!a || !a.data) return;
    if (!msg.yes) { say(a, `${ko.josa(p.data.name, '은/는')} 거절했다.`, { toast: true }); return; }
    if (a.battle || p.battle || a.trade || p.trade) return say(p, '지금은 할 수 없다.');
    if (r.kind === 'battle1' || r.kind === 'battle2') return pvpBattle(a, p, r.kind === 'battle2');
    if (r.kind === 'team') {
      a.team = p.id; p.team = a.id;
      sendState(a); sendState(p);
      say(a, `${ko.josa(p.data.name, '과/와')} 함께 다니게 되었다! 같은 맵에서 야생 포켓몬이나 트레이너를 만나면 둘이 함께 싸운다!`);
      say(p, `${ko.josa(a.data.name, '과/와')} 함께 다니게 되었다! 같은 맵에서 야생 포켓몬이나 트레이너를 만나면 둘이 함께 싸운다!`);
      broadcastPlayers();
      return;
    }
    if (r.kind === 'trade') {
      const t = { id: crypto.randomBytes(4).toString('hex'), a: a.id, b: p.id, offer: {}, ok: {} };
      trades.set(t.id, t);
      a.trade = t; p.trade = t;
      sendTrade(t);
    }
  },
  tradeOffer(p, msg) {
    const t = p.trade;
    if (!t) return;
    if (!p.data.party.some((m) => m.uid === msg.uid)) return;
    t.offer[p.id] = msg.uid; t.ok = {};
    sendTrade(t);
  },
  tradeOk(p) {
    const t = p.trade;
    if (!t || !t.offer[t.a] || !t.offer[t.b]) return;
    t.ok[p.id] = true;
    if (t.ok[t.a] && t.ok[t.b]) return doTrade(t);
    sendTrade(t);
  },
  tradeCancel(p) {
    const t = p.trade;
    if (!t) return;
    endTrade(t, `${p.data.name}${ko.hasBatchim(p.data.name) ? '이' : '가'} 교환을 그만두었다.`);
  },

  chat(p, msg) {
    const text = String(msg.text || '').slice(0, 80).trim();
    if (!text || !p.data) return;
    for (const q of online()) send(q.ws, { t: 'chat', name: p.data.name, text });
  },
  look(p, msg) { if (p.data) { p.data.look = Math.max(0, Math.min(3, msg.look | 0)); savePlayer(p); sendState(p); broadcastPlayers(); } },
  save(p) { savePlayer(p); say(p, `${p.data.name}${ko.hasBatchim(p.data.name) ? '은' : '는'} 레포트를 확실히 기록했다!`); },
};

function sendTrade(t) {
  const a = players.get(t.a), b = players.get(t.b);
  for (const [me, other] of [[a, b], [b, a]]) {
    if (!me) continue;
    sendTo(me, {
      t: 'trade', id: t.id,
      mine: me.data.party.map((m) => dex.publicMon(m, true)), theirs: other.data.party.map((m) => dex.publicMon(m, true)),
      myOffer: t.offer[me.id] || null, theirOffer: t.offer[other.id] || null, myOk: !!t.ok[me.id], theirOk: !!t.ok[other.id], otherName: other.data.name,
    });
  }
}
function endTrade(t, text) {
  trades.delete(t.id);
  for (const id of [t.a, t.b]) { const q = players.get(id); if (q && q.trade === t) { q.trade = null; sendTo(q, { t: 'tradeEnd', text }); } }
}
function doTrade(t) {
  const a = players.get(t.a), b = players.get(t.b);
  const ia = a.data.party.findIndex((m) => m.uid === t.offer[a.id]);
  const ib = b.data.party.findIndex((m) => m.uid === t.offer[b.id]);
  if (ia < 0 || ib < 0) return endTrade(t, '교환할 수 없었다.');
  const ma = a.data.party[ia], mb = b.data.party[ib];
  a.data.party[ia] = mb; b.data.party[ib] = ma;
  const evo = (p, mon) => {
    addCaught(p.data, mon.species);
    const e = dex.tradeEvolution(mon);
    if (!e) return null;
    const from = dex.displayName(mon);
    if (e.useItem) mon.item = null;
    const learn = dex.evolve(mon, e.into);
    for (const mv of learn) dex.learnMove(mon, mv);
    addCaught(p.data, e.into);
    return `${ko.josa(from, '은/는')} ${ko.josa(ko.speciesName(e.into), '으로/로')} 진화했다!`;
  };
  const ea = evo(a, mb), eb = evo(b, ma);
  trades.delete(t.id);
  a.trade = null; b.trade = null;
  sendTo(a, { t: 'tradeDone', got: dex.publicMon(mb, false), gave: dex.publicMon(ma, false), evo: ea });
  sendTo(b, { t: 'tradeDone', got: dex.publicMon(ma, false), gave: dex.publicMon(mb, false), evo: eb });
  savePlayer(a); savePlayer(b); sendState(a); sendState(b); broadcastPlayers();
}

// ───────────── WebSocket ─────────────
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  const p = { ws, id: null, data: null };
  send(ws, { t: 'hi', saves: W ? listSaves() : [], looks: LOOKS });
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!W) return;
    if (msg.t !== 'hello' && !p.data) return;
    const h = handlers[msg.t];
    if (!h) return;
    try { h(p, msg); } catch (e) { console.error('[오류]', msg.t, e); }
  });
  ws.on('close', () => {
    if (!p.data) return;
    p.data.playMs += Date.now() - (p.since || Date.now());
    p.since = Date.now();
    savePlayer(p);
    if (p.trade) endTrade(p.trade, `${p.data.name}의 연결이 끊어졌다.`);
    if (p.battle) {
      const b = p.battle;
      setTimeout(() => {
        const cur = players.get(p.id);
        if (b.result) return;
        if (cur && cur !== p && cur.ws && cur.ws.readyState === 1) return; // 다시 들어옴
        if (b.kind === 'pvp') b.forfeit(p.id); else b.autoAnswer(p.id);
      }, 15000);
      b.autoAnswer(p.id);
    }
    setTimeout(broadcastPlayers, 50);
  });
});

// 오래된 신청 정리 + 주기 저장
setInterval(() => {
  const now = Date.now();
  for (const [id, r] of requests) if (now - r.at > 60000) requests.delete(id);
  for (const p of online()) if (p.data) savePlayer(p);
}, 30000).unref();

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}

async function main() {
  W = await ensureWorld({ log: (s) => console.log('  ' + s) });
  dex.init(W);
  W.leaderBadge = LEADER_BADGE;
  W.ko = { species: ko.KO.species, moves: Object.fromEntries(Object.values(W.moves).map((m) => [m.const, ko.moveName(m.const)])), items: Object.fromEntries(Object.keys(W.items).map((c) => [c, itemKo(c)])), types: ko.TYPES, landmarks: ko.LANDMARKS, badges: ko.BADGES };
  worldGz = zlib.gzipSync(JSON.stringify(W));
  server.listen(PORT, '0.0.0.0', () => {
    const lan = lanAddresses();
    console.log('');
    console.log('  ★ 포켓몬스터 골드 온라인 서버가 켜졌습니다!');
    console.log(`  - 이 컴퓨터:  http://localhost:${PORT}`);
    for (const ip of lan) console.log(`  - 옆 컴퓨터:  http://${ip}:${PORT}   (같은 와이파이/공유기)`);
    console.log('  게임하는 동안 이 창을 닫지 마세요.');
    console.log('');
    if (process.argv.includes('--open')) {
      const url = `http://localhost:${PORT}`;
      const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      exec(cmd, () => {});
    }
  });
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.log(`  포트 ${PORT} 가 이미 사용 중입니다. 서버가 이미 켜져 있는지 확인하세요.`); process.exit(1); }
  throw e;
});

if (require.main === module) {
  main().catch((e) => {
    console.error('\n  [!] 시작하지 못했습니다:', e.message);
    console.error('      처음 실행할 때는 원본 자료를 내려받기 위해 인터넷 연결이 필요합니다.');
    process.exit(1);
  });
}

module.exports = { main, server, handlers, players };
