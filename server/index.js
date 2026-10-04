'use strict';
// 정령섬 온라인 서버: 정적 파일 + WebSocket 방(로비) + 게임 진행
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const { Game, PIECE_NAMES, ELEMENT_NAMES, growthLabel } = require('./game/game');
const { SPIRITS, EXPANSIONS } = require('./game/spirits');
const { PRESETS, ADVERSARIES } = require('./game/adversaries');
const { POWERS } = require('./game/powers');
const { FEAR_CARDS } = require('./game/fear');
const { TERRAIN_NAMES } = require('./game/boards');
const savegame = require('../shared/savegame');

const saves = savegame.store('spirit-island');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const THREE_DIR = path.dirname(path.dirname(require.resolve('three')));
const CUSTOM_ART_DIR = path.join(__dirname, '..', 'custom-art');

/** custom-art 폴더에 사용자가 넣은 정령 그림 목록 { spiritId: url } */
function customArt() {
  const out = {};
  let files = [];
  try { files = fs.readdirSync(CUSTOM_ART_DIR); } catch { return out; }
  for (const f of files) {
    const m = f.match(/^([a-z]+)\.(png|jpe?g|webp|gif|svg)$/i);
    if (m && SPIRITS.some((sp) => sp.id === m[1].toLowerCase())) out[m[1].toLowerCase()] = `/custom-art/${encodeURIComponent(f)}`;
  }
  return out;
}
const MAX_PLAYERS = 6; // 방에 들어올 수 있는 사람 수
const MAX_SPIRITS = 6; // 게임 전체 정령(보드) 수

// ───────────── 정적 데이터(카탈로그) ─────────────
const CATALOG = {
  spirits: SPIRITS.map((s) => ({
    id: s.id, exp: s.exp || 'base', name: s.name, en: s.en, color: s.color, complexity: s.complexity, summary: s.summary,
    growth: s.growth.map((g) => g.actions.map(growthLabel)),
    energyTrack: s.energyTrack, cardTrack: s.cardTrack, special: s.special, setupText: s.setupText, uniques: s.uniques, tip: s.tip || '',
    innates: s.innates.map((i) => ({ id: i.id, name: i.name, speed: i.speed, target: i.target, levels: i.levels })),
  })),
  powers: Object.fromEntries(POWERS.map((p) => [p.id, {
    id: p.id, name: p.name, en: p.en, cost: p.cost, speed: p.speed, kind: p.kind, elements: p.elements, target: p.target, text: p.text, threshold: p.threshold || null,
  }])),
  fear: FEAR_CARDS.map((f) => ({ id: f.id, name: f.name, levels: f.levels.map((l) => l.text) })),
  pieces: PIECE_NAMES,
  elements: ELEMENT_NAMES,
  terrains: TERRAIN_NAMES,
  expansions: EXPANSIONS,
  presets: PRESETS.map((p) => ({ id: p.id, name: p.name, desc: p.desc })),
  adversaries: ADVERSARIES.map((a) => ({ id: a.id, exp: a.exp, name: a.name, en: a.en, levels: a.levels.map((l) => ({ name: l.name, text: l.text })) })),
};

const DEFAULT_SETTINGS = () => ({
  expansions: EXPANSIONS.map((e) => e.id),
  map: { layout: 'auto', boards: 'ordered', extraBoard: false },
  pace: 'manual', // 침략자 단계 진행: manual(모두 '다음'을 눌러야 진행) / slow / normal
  difficulty: { preset: 'normal', adversary: null, level: 0 },
});

/** 방장이 보낸 설정을 검증해서 정리 */
function cleanSettings(input, prev) {
  const out = JSON.parse(JSON.stringify(prev));
  if (!input || typeof input !== 'object') return out;
  if (Array.isArray(input.expansions)) {
    out.expansions = EXPANSIONS.filter((e) => e.required || input.expansions.includes(e.id)).map((e) => e.id);
  }
  if (input.map && typeof input.map === 'object') {
    if (['auto', 'coast'].includes(input.map.layout)) out.map.layout = input.map.layout;
    if (['ordered', 'random'].includes(input.map.boards)) out.map.boards = input.map.boards;
    if (typeof input.map.extraBoard === 'boolean') out.map.extraBoard = input.map.extraBoard;
  }
  if (input.difficulty && typeof input.difficulty === 'object') {
    const d = input.difficulty;
    if (PRESETS.some((p) => p.id === d.preset)) out.difficulty.preset = d.preset;
    if (d.adversary === null || ADVERSARIES.some((a) => a.id === d.adversary)) out.difficulty.adversary = d.adversary;
    if (Number.isInteger(d.level) && d.level >= 0 && d.level <= 6) out.difficulty.level = d.level;
  }
  if (['manual', 'slow', 'normal'].includes(input.pace)) out.pace = input.pace;
  const adv = ADVERSARIES.find((a) => a.id === out.difficulty.adversary);
  if (adv && !out.expansions.includes(adv.exp)) out.difficulty.adversary = null;
  if (!out.difficulty.adversary) out.difficulty.level = 0;
  return out;
}

const spiritExp = (id) => (SPIRITS.find((s) => s.id === id) || {}).exp || 'base';
const totalSpirits = (room) => room.players.reduce((a, p) => a + p.spiritIds.length, 0);

// ───────────── HTTP ─────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  let p = decodeURIComponent(url.pathname);
  // 3D 지도용 three.js 를 node_modules 에서 제공
  if (p.startsWith('/vendor/three/')) {
    const rel = p.slice('/vendor/three/'.length);
    const file = path.normalize(path.join(THREE_DIR, rel));
    if (!file.startsWith(THREE_DIR) || !/^(build|examples[\\/]jsm)[\\/]/.test(path.relative(THREE_DIR, file))) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
      res.end(data);
    });
    return;
  }
  if (p.startsWith('/custom-art/')) {
    const file = path.normalize(path.join(CUSTOM_ART_DIR, p.slice('/custom-art/'.length)));
    if (!file.startsWith(CUSTOM_ART_DIR)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
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

// ───────────── 방 관리 ─────────────
/** @type {Map<string, any>} */
const rooms = new Map();
/** token -> { roomCode, playerId } */
const sessions = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join(''); } while (rooms.has(code));
  return code;
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function roomInfo(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: !!room.game,
    loading: !!room.loading,
    resume: room.resume ? resumeInfo(room) : null,
    players: room.players.map((p) => ({ id: p.id, name: p.name, spiritIds: p.spiritIds, connected: !!(p.ws && p.ws.readyState === 1) })),
    settings: room.settings,
    maxSpirits: MAX_SPIRITS,
    chat: room.chat.slice(-50),
  };
}

/** 이어하기 대기실 정보: 저장된 자리(플레이어)와 누가 앉았는지 */
function resumeInfo(room) {
  const sv = room.resume;
  return {
    id: sv.id, savedAt: sv.savedAt, summary: sv.summary,
    slots: sv.roster.map((s) => ({ id: s.id, name: s.name, spiritIds: s.spiritIds, taken: room.players.some((p) => p.id === s.id) })),
  };
}

function saveList() { return saves.list(); }

/** 지금 게임을 파일로 저장 (선택할 때마다 자동으로) */
function saveNow(room) {
  const g = room.game;
  if (!g || g.result || room.tutorial || room.loading || !room.saveId) return;
  clearTimeout(room.saveTimer);
  saves.write({
    v: 1, id: room.saveId, savedAt: Date.now(), seed: g.seed,
    settings: room.settings, roster: room.roster,
    seats: room.seats.map((x) => ({ id: x.id, owner: x.slot, name: x.name, spiritId: x.spiritId })),
    history: g.history,
    summary: { turn: g.turn, spirits: g.players.map((p) => p.spiritId), preset: room.settings.difficulty.preset, adversary: room.settings.difficulty.adversary, level: room.settings.difficulty.level },
  });
}
function scheduleSave(room) {
  clearTimeout(room.saveTimer);
  room.saveTimer = setTimeout(() => saveNow(room), 300);
}

function broadcastRoom(room) {
  const info = roomInfo(room);
  for (const p of room.players) send(p.ws, { t: 'room', room: info, you: p.id });
}

function stateMsg(room, player, state) {
  const seats = room.seats.filter((x) => x.owner === player.id).map((x) => x.id);
  const prompts = Object.fromEntries(seats.map((id) => [id, room.game.currentPrompt(id)]));
  return { t: 'state', state, prompts, seats };
}

function sendState(room, player) {
  if (!room.game) return;
  send(player.ws, stateMsg(room, player, room.game.view()));
}

function broadcastState(room) {
  if (!room.game) return;
  const state = room.game.view();
  for (const p of room.players) send(p.ws, stateMsg(room, p, state));
}

async function startGame(room) {
  const sv = room.resume;
  if (sv) {
    // 이어하기: 저장된 좌석 그대로. 아무도 앉지 않은 자리는 방장이 대신 조종
    room.settings = sv.settings;
    room.roster = sv.roster;
    room.seats = sv.seats.map((x) => ({ ...x, slot: x.owner, owner: room.players.some((p) => p.id === x.owner) ? x.owner : room.hostId }));
  } else {
    // 한 사람이 정령을 여러 개 조종할 수 있다 — 정령마다 좌석(seat)을 만든다
    room.seats = [];
    for (const p of room.players) {
      p.spiritIds.forEach((sid, k) => {
        room.seats.push({ id: `${p.id}-${k}`, owner: p.id, slot: p.id, name: p.spiritIds.length > 1 ? `${p.name}·${k + 1}` : p.name, spiritId: sid });
      });
    }
    room.roster = room.players.map((p) => ({ id: p.id, name: p.name, spiritIds: [...p.spiritIds] }));
  }
  const pace = {
    stepDelay: { slow: 5000, normal: 2500 }[room.settings.pace] || 1500,
    stepManual: room.tutorial || !room.settings.pace || room.settings.pace === 'manual',
  };
  const game = new Game(room.seats.map((x) => ({ id: x.id, name: x.name, spiritId: x.spiritId })), {
    settings: room.settings,
    stepDelay: sv ? 0 : pace.stepDelay,
    stepManual: sv ? false : pace.stepManual,
    tutorial: !!room.tutorial,
    seed: sv ? sv.seed : room.tutorial ? 20261003 : undefined,
  });
  room.game = game;
  room.saveId = sv ? sv.id : savegame.newSaveId(room.code);
  room.resume = null;
  savegame.record(game, () => scheduleSave(room));
  game.run().then(() => {
    if (room.game !== game) return;
    if (game.result && room.saveId) { clearTimeout(room.saveTimer); saves.remove(room.saveId); }
    broadcastState(room);
  });
  if (sv) {
    // 저장된 선택들을 빠르게 다시 진행해서 저장 시점으로 돌아감
    room.loading = true;
    broadcastRoom(room);
    const r = await savegame.replay(game, sv.history || [], () => { game.stepDelay = pace.stepDelay; game.stepManual = pace.stepManual; });
    room.loading = false;
    if (room.game !== game) return;
    if (!r.ok) {
      room.chat.push({ from: '안내', text: `저장 기록 일부(${r.at + 1}번째 선택부터)를 되살리지 못해 그 시점부터 이어서 진행합니다.`, at: Date.now() });
    }
    game.log('💾 저장된 게임을 불러왔습니다. 이어서 진행합니다.');
    saveNow(room);
  }
  game.on('update', () => broadcastState(room));
  broadcastRoom(room);
  broadcastState(room);
}

/** 이어하기 대기실에서 내 자리 정하기: 이름이 같은 빈자리 → 아무 빈자리 */
function freeSlot(room, name, except) {
  const free = room.resume.roster.filter((s) => s.id !== except && !room.players.some((p) => p.id === s.id));
  return free.find((s) => s.name === name) || free[0] || null;
}
function sitAt(room, player, slot) {
  if (room.hostId === player.id) room.hostId = slot.id;
  player.id = slot.id;
  player.spiritIds = [...slot.spiritIds];
  if (player.token) sessions.set(player.token, { roomCode: room.code, playerId: slot.id });
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = room.players.some((p) => p.ws && p.ws.readyState === 1);
    if (anyone) room.lastActive = now;
    else if (now - room.lastActive > 60 * 60 * 1000) {
      for (const p of room.players) sessions.delete(p.token);
      rooms.delete(code);
    }
  }
}
setInterval(cleanupRooms, 5 * 60 * 1000).unref();

// ───────────── WebSocket ─────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let token = null;
  let room = null;
  let player = null;

  const fail = (msg) => send(ws, { t: 'error', msg });

  const attach = (r, p) => {
    room = r;
    player = p;
    if (p.ws && p.ws !== ws) { try { p.ws.close(); } catch { /* ignore */ } }
    p.ws = ws;
    sessions.set(token, { roomCode: r.code, playerId: p.id });
    r.lastActive = Date.now();
    broadcastRoom(r);
    sendState(r, p);
  };

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;

    switch (msg.t) {
      case 'hello': {
        token = typeof msg.token === 'string' && msg.token.length >= 16 ? msg.token : crypto.randomBytes(16).toString('hex');
        send(ws, { t: 'welcome', token, catalog: { ...CATALOG, customArt: customArt() }, lan: lanAddresses().map((ip) => `http://${ip}:${PORT}`), saves: saveList() });
        const sess = sessions.get(token);
        if (sess && rooms.has(sess.roomCode)) {
          const r = rooms.get(sess.roomCode);
          const p = r.players.find((x) => x.id === sess.playerId);
          if (p) attach(r, p);
        }
        break;
      }
      case 'create': {
        if (!token) return fail('먼저 연결하세요.');
        if (room) return fail('이미 방에 있습니다.');
        const name = cleanName(msg.name);
        const code = makeCode();
        const r = { code, hostId: null, players: [], game: null, chat: [], lastActive: Date.now(), settings: DEFAULT_SETTINGS(), seats: [] };
        const p = { id: crypto.randomBytes(6).toString('hex'), name, spiritIds: [], token, ws: null };
        r.players.push(p);
        r.hostId = p.id;
        rooms.set(code, r);
        attach(r, p);
        break;
      }
      case 'tutorial': {
        // 혼자 하는 튜토리얼: 대지의 활력 + 입문 난이도로 바로 시작
        if (!token) return fail('먼저 연결하세요.');
        if (room) return fail('이미 방에 있습니다.');
        const code = makeCode();
        const r = { code, hostId: null, players: [], game: null, chat: [], lastActive: Date.now(), settings: DEFAULT_SETTINGS(), seats: [], tutorial: true };
        r.settings.difficulty.preset = 'intro';
        const p = { id: crypto.randomBytes(6).toString('hex'), name: cleanName(msg.name), spiritIds: ['earth'], token, ws: null };
        r.players.push(p);
        r.hostId = p.id;
        rooms.set(code, r);
        attach(r, p);
        startGame(r);
        break;
      }
      case 'listSaves': {
        send(ws, { t: 'saves', list: saveList() });
        break;
      }
      case 'deleteSave': {
        if (room) return;
        saves.remove(msg.id);
        send(ws, { t: 'saves', list: saveList() });
        break;
      }
      case 'resume': {
        // 저장된 게임으로 새 방을 만들고 대기실에서 친구들을 기다림
        if (!token) return fail('먼저 연결하세요.');
        if (room) return fail('이미 방에 있습니다.');
        const sv = saves.load(msg.id);
        if (!sv || !Array.isArray(sv.roster) || !sv.roster.length) return fail('저장된 게임을 찾을 수 없습니다.');
        const code = makeCode();
        const r = { code, hostId: null, players: [], game: null, chat: [], lastActive: Date.now(), settings: sv.settings, seats: [], resume: sv };
        const name = cleanName(msg.name);
        const slot = freeSlot(r, name);
        const p = { id: slot.id, name, spiritIds: [...slot.spiritIds], token, ws: null };
        r.players.push(p);
        r.hostId = p.id;
        rooms.set(code, r);
        attach(r, p);
        break;
      }
      case 'claimSlot': {
        if (!room || room.game || !room.resume) return;
        const slot = room.resume.roster.find((s) => s.id === msg.slot);
        if (!slot || room.players.some((p) => p.id === slot.id)) return fail('이미 누가 앉은 자리입니다.');
        sitAt(room, player, slot);
        broadcastRoom(room);
        break;
      }
      case 'cancelResume': {
        if (!room || room.game || !room.resume) return;
        if (room.hostId !== player.id) return fail('방장만 할 수 있습니다.');
        room.resume = null;
        room.settings = cleanSettings(room.settings, DEFAULT_SETTINGS());
        broadcastRoom(room);
        break;
      }
      case 'quitGame': {
        // 게임 도중 그만두기: 저장하고 대기실로 (나중에 '이어하기'로 계속)
        if (!room || !room.game) return;
        if (room.hostId !== player.id) return fail('방장만 게임을 그만둘 수 있습니다.');
        if (room.loading) return fail('불러오는 중입니다. 잠시 후 다시 시도하세요.');
        const g = room.game;
        const savable = !g.result && !room.tutorial;
        if (savable) saveNow(room);
        clearTimeout(room.saveTimer);
        g.removeAllListeners();
        room.game = null;
        const sv = savable ? saves.load(room.saveId) : null;
        // 게임 중에 '나가기'로 완전히 떠난 사람은 방에서 정리
        room.players = room.players.filter((p) => p.id === room.hostId || sessions.has(p.token));
        if (sv) {
          room.resume = sv;
          // 지금 방에 없는 저장 자리는 비워 둠, 방에 있는데 자리가 없는 사람은 빈자리로
          for (const p of room.players) if (!sv.roster.some((s) => s.id === p.id)) { const slot = freeSlot(room, p.name, p.id); if (slot) sitAt(room, p, slot); }
          room.chat.push({ from: '안내', text: `게임을 저장했습니다 (${g.turn}턴). '저장된 게임 이어하기'로 계속할 수 있어요.`, at: Date.now() });
        }
        broadcastRoom(room);
        break;
      }
      case 'join': {
        if (!token) return fail('먼저 연결하세요.');
        if (room) return fail('이미 방에 있습니다.');
        const code = String(msg.code || '').trim().toUpperCase();
        const r = rooms.get(code);
        if (!r) return fail('방을 찾을 수 없습니다: ' + code);
        if (r.game) return fail('이미 게임이 시작된 방입니다.');
        if (r.players.length >= MAX_PLAYERS) return fail(`방이 가득 찼습니다 (최대 ${MAX_PLAYERS}명).`);
        const p = { id: crypto.randomBytes(6).toString('hex'), name: cleanName(msg.name), spiritIds: [], token, ws: null };
        if (r.resume) {
          const slot = freeSlot(r, p.name);
          if (!slot) return fail('저장된 게임의 자리가 모두 찼습니다.');
          p.id = slot.id; p.spiritIds = [...slot.spiritIds];
        }
        r.players.push(p);
        attach(r, p);
        break;
      }
      case 'leave': {
        if (!room || !player) return;
        sessions.delete(token);
        if (!room.game) {
          room.players = room.players.filter((p) => p !== player);
          if (!room.players.length) rooms.delete(room.code);
          else {
            if (room.hostId === player.id) room.hostId = room.players[0].id;
            broadcastRoom(room);
          }
        } else {
          player.ws = null;
          broadcastRoom(room);
        }
        room = null;
        player = null;
        send(ws, { t: 'left' });
        break;
      }
      case 'pickSpirit': {
        // mode: 'replace'(이 정령 하나만) | 'add'(추가로 조종) | 'remove'
        if (!room || room.game) return;
        if (room.resume) return fail('저장된 게임을 이어하는 중에는 정령을 바꿀 수 없습니다.');
        const mode = ['replace', 'add', 'remove'].includes(msg.mode) ? msg.mode : 'replace';
        let sid = msg.spiritId;
        if (sid === 'random') {
          const taken = new Set(room.players.flatMap((p) => p.spiritIds));
          const pool = SPIRITS.filter((sp) => room.settings.expansions.includes(sp.exp || 'base') && !taken.has(sp.id));
          if (!pool.length) return fail('고를 수 있는 정령이 없습니다.');
          sid = pool[crypto.randomInt(pool.length)].id;
        }
        if (!SPIRITS.some((sp) => sp.id === sid)) return fail('알 수 없는 정령입니다.');
        if (mode === 'remove') { player.spiritIds = player.spiritIds.filter((x) => x !== sid); broadcastRoom(room); break; }
        if (!room.settings.expansions.includes(spiritExp(sid))) return fail('이 정령의 확장판이 꺼져 있습니다.');
        if (room.players.some((p) => p !== player && p.spiritIds.includes(sid))) return fail('다른 플레이어가 이미 고른 정령입니다.');
        if (mode === 'replace') player.spiritIds = [sid];
        else if (!player.spiritIds.includes(sid)) {
          if (totalSpirits(room) >= MAX_SPIRITS) return fail(`정령은 게임 전체에서 최대 ${MAX_SPIRITS}개까지입니다.`);
          player.spiritIds.push(sid);
        }
        broadcastRoom(room);
        break;
      }
      case 'setSettings': {
        if (!room || room.game) return;
        if (room.resume) return fail('저장된 게임을 이어하는 중에는 설정을 바꿀 수 없습니다.');
        if (room.hostId !== player.id) return fail('방장만 설정을 바꿀 수 있습니다.');
        room.settings = cleanSettings(msg.settings, room.settings);
        // 꺼진 확장판의 정령은 선택 해제
        for (const p of room.players) p.spiritIds = p.spiritIds.filter((sid) => room.settings.expansions.includes(spiritExp(sid)));
        broadcastRoom(room);
        break;
      }
      case 'start': {
        if (!room || room.game) return;
        if (room.hostId !== player.id) return fail('방장만 게임을 시작할 수 있습니다.');
        if (room.resume) { startGame(room); break; }
        if (room.players.some((p) => !p.spiritIds.length)) return fail('모든 플레이어가 정령을 하나 이상 골라야 합니다.');
        if (totalSpirits(room) > MAX_SPIRITS) return fail(`정령은 최대 ${MAX_SPIRITS}개까지입니다.`);
        startGame(room);
        break;
      }
      case 'answer': {
        if (!room || !room.game || !player || room.loading) return;
        const seat = room.seats.find((x) => x.id === msg.seat && x.owner === player.id) || room.seats.find((x) => x.owner === player.id);
        if (!seat) return;
        const err = room.game.answer(seat.id, msg.promptId, msg.value);
        if (err) { fail(err); sendState(room, player); }
        break;
      }
      case 'ackStep': {
        if (!room || !room.game || !player || room.loading) return;
        for (const seat of room.seats) {
          // 내 좌석 + 접속이 끊긴 사람의 좌석은 대신 확인
          const owner = room.players.find((x) => x.id === seat.owner);
          if (seat.owner === player.id || !owner || !owner.ws) room.game.ackStep(seat.id, msg.no);
        }
        break;
      }
      case 'backToLobby': {
        if (!room || !room.game) return;
        if (room.hostId !== player.id) return fail('방장만 할 수 있습니다.');
        if (!room.game.result) return fail('게임이 아직 끝나지 않았습니다.');
        room.game.removeAllListeners();
        room.game = null;
        broadcastRoom(room);
        break;
      }
      case 'chat': {
        if (!room || !player) return;
        const text = String(msg.text || '').slice(0, 300).trim();
        if (!text) return;
        room.chat.push({ from: player.name, text, at: Date.now() });
        if (room.chat.length > 100) room.chat.shift();
        broadcastRoom(room);
        break;
      }
      default:
    }
  });

  ws.on('close', () => {
    if (room && player && player.ws === ws) {
      player.ws = null;
      const g = room.game;
      if (g && g.invaderStep && g.stepWaiter && room.players.some((x) => x.ws)) for (const seat of room.seats) if (seat.owner === player.id) g.ackStep(seat.id, g.invaderStep.no);
      broadcastRoom(room);
    }
  });
});

function cleanName(name) {
  const s = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s || '정령' + crypto.randomInt(100, 999);
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[오류] ${PORT}번 포트가 이미 사용 중입니다. 정령섬 서버가 이미 켜져 있는지 확인하거나, 다른 포트로 실행하세요 (예: PORT=3001).`);
    if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
  } else console.error(err);
  process.exitCode = 1;
});

server.listen(PORT, () => {
  const line = '─'.repeat(52);
  console.log(`\n${line}\n  🌋 정령섬 온라인 서버가 실행되었습니다\n${line}`);
  console.log(`  내 컴퓨터에서 접속   : http://localhost:${PORT}`);
  const lan = lanAddresses();
  if (lan.length) {
    console.log('  같은 와이파이 친구   : ' + lan.map((ip) => `http://${ip}:${PORT}`).join('  또는  '));
  }
  console.log('  멀리 있는 친구       : 새 창에서 "npm run share" 실행 → 나오는 https 주소 공유');
  console.log(`  종료하려면 이 창을 닫거나 Ctrl+C 를 누르세요.\n${line}\n`);
  if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
});

module.exports = { server };
